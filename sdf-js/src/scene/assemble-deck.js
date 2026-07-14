// sdf-js/src/scene/assemble-deck.js
// P3 — deck assembly: MULTIPLE IRs → ONE continuous 3D world (one SceneData).
//
// The thesis move: a deck is not N slides, it is one world with N stations.
// Each slide's structure renders at its own station along the deck axis; the
// camera plays each station's five-beat grammar in place, then a TRANSIT shot
// whips to the next station (the fighting-game stage transition — one arena
// finishes, the camera slings to the next).
//
// Division of labour: structure renderers stay pure (they render at the origin
// on their own clock); THIS module owns placement — it shifts each station's
// subjects/labels in SPACE (station origin) and its build-ins/reveals/camera
// in TIME (station start). Build-in exprs are strings the renderers bake, so
// the shift rewrites them with a STRICT parser that throws on any unknown
// shape (fail loud, never silently mis-animate).
import { renderIR } from './render-ir.js';
import { getEnvironment, horizonSilhouettes, boulderHorizon } from './environments.js';
import { makeDeckDecor } from './deck-decor.js';
import { shiftModifier } from './modifiers.js';
import { TEMPO } from './tempo-tokens.js';

// Every structure renderer emits build-ins of exactly this shape:
//   "<A> - <D> * smoothstep(<t0>, <t1>, t)"            (drop from above)
//   "<A> + <D> * smoothstep(<t0>, <t1>, t)"            (erupt from below)
//   … + optional " + <I> * sin(<F> * t + <P>)" idle tail (breathing)
// Shift: A += dy (the y-channel constant), t0/t1 += dt; the idle tail is
// time-invariant in amplitude but its PHASE must rewind by F*dt so the motion
// is continuous across the station's shifted clock.
const EXPR_RE =
  /^(-?[\d.]+) (\+|-) ([\d.]+) \* smoothstep\((-?[\d.]+), (-?[\d.]+), t\)(?: \+ ([\d.]+) \* sin\(([\d.]+) \* t \+ (-?[\d.]+)\))?$/;
export function shiftBuildInExpr(expr, dy, dt) {
  const m = String(expr).match(EXPR_RE);
  if (!m) throw new Error(`assemble-deck: unrecognized build-in expr shape: "${expr}"`);
  const [, A, sign, D, t0, t1, idleAmp, idleFreq, idlePhase] = m;
  let out = `${(Number(A) + dy).toFixed(3)} ${sign} ${D} * smoothstep(${(Number(t0) + dt).toFixed(2)}, ${(Number(t1) + dt).toFixed(2)}, t)`;
  if (idleAmp != null) {
    const p = Number(idlePhase) - Number(idleFreq) * dt;
    out += ` + ${idleAmp} * sin(${idleFreq} * t + ${p.toFixed(2)})`;
  }
  return out;
}

const addV = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// rgb [0-255] triple → {h,s,v} in 0..1 (scene materials speak HSV)
export function rgbToHsv([r, g, b]) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d + 6) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

// Section color programming (the 2D end's applySectionAccents, spatialized):
// a long deck in one accent reads monotone. hold pages (cover / contents /
// interludes) keep the ANCHOR hue; every content station takes the next hue
// from the palette. Deterministic rotation, no LLM.
function assignAccents(slides, palette) {
  if (!palette || !Array.isArray(palette.colors) || !palette.colors.length)
    return slides.map(() => null);
  const anchor = rgbToHsv(palette.anchor || palette.colors[0]);
  const GOLD_H = 0.11; // the deck-wide champion mark — accents must not impersonate it
  const pool = palette.colors
    .filter((c) => !palette.anchor || c.join(',') !== palette.anchor.join(','))
    .map(rgbToHsv)
    .filter((a) => Math.min(Math.abs(a.h - GOLD_H), 1 - Math.abs(a.h - GOLD_H)) > 0.06);
  let next = 0;
  return slides.map((ir) => {
    if (ir.structure === 'hold') return anchor;
    const a = pool.length ? pool[next % pool.length] : anchor;
    next++;
    return a;
  });
}
const seqDuration = (shots) => shots.reduce((s, sh) => s + (sh.duration || 0), 0);

// ---- Deck archetypes ---------------------------------------------------------
// The station LAYOUT is itself structure-aware (the deck-scale half of the
// "geometric cores" thesis): a linear pitch is a corridor, an agenda-around-a-
// theme is a ring, a portfolio is a plaza. Stations are never rotated — every
// structure keeps facing +z so its own camera grammar stays valid; the layout
// only chooses WHERE stations stand (and therefore how the transits sweep and
// what the finale reveals).
export const DECK_LAYOUTS = ['line', 'radial', 'grid', 'courtyard', 'theater'];

// ---- Courtyard (Phase 1 main archetype, spec 2026-07-12) -----------------------
// Chapters (zones) become ARC CLUSTERS on the ring: intra-zone neighbors sit
// one stride apart, zone boundaries get a wider threshold gap — the chapter
// structure is readable in the plan itself. If the deck opens on a hold page
// (a cover), that station moves to the RING CENTER: the Wave-0 spike showed
// the cover's monolith forest already marches toward the centre, so instead
// of fighting it (the swallowed-monument finding) the cover IS the
// centerpiece — the world's entrance, ringed by its chapters.
// Zones are a planSpace-INTERNAL concept (debate 决策②): truth source is the
// deck's hand-annotated `zones` (IR-level, Phase 1) — never inferred here.
function courtyardPlan(slides, zones, stride) {
  const centerIdx = slides[0] && slides[0].structure === 'hold' ? 0 : null;
  const ringMembers = [];
  const zoneOf = new Array(slides.length).fill(0);
  zones.forEach((members, z) =>
    members.forEach((i) => {
      zoneOf[i] = z;
      if (i !== centerIdx) ringMembers.push(i);
    }),
  );
  // collapse guard (debate 落地 #9): a courtyard of 1-station chapters is a
  // plain ring wearing a costume — the detector must refuse, not fake it
  if (ringMembers.length / zones.length < 2) return null;
  const thresholdGap = stride * 0.9; // the chapter seam, readable in plan
  const C = ringMembers.length * stride + zones.length * thresholdGap;
  const R = Math.max(stride * 0.75, C / (2 * Math.PI));
  const origins = new Array(slides.length);
  if (centerIdx != null) origins[centerIdx] = [0, 0, 0];
  let arc = thresholdGap / 2; // start past half a seam so zone 0 is centered on +z
  let prevZone = ringMembers.length ? zoneOf[ringMembers[0]] : 0;
  for (const i of ringMembers) {
    if (zoneOf[i] !== prevZone) {
      arc += thresholdGap;
      prevZone = zoneOf[i];
    }
    const th = arc / R;
    origins[i] = [Math.sin(th) * R, 0, Math.cos(th) * R];
    arc += stride;
  }
  return { origins, center: [0, 0], ringR: R, zoneOf, centerIdx };
}

// ---- Finale-LOD proxies (Infinigen placeholder pattern) -----------------------
// One grounded silhouette box per station, fit to the world-space bounds of its
// CONTENT subjects. Stands in for far-station geometry in finale/overlook
// windows, where the pull-back distance makes data detail sub-pixel but the
// station's mass must keep holding the composition.
function newBounds() {
  return { minX: Infinity, maxX: -Infinity, maxY: 0, minZ: Infinity, maxZ: -Infinity };
}

// Rough per-type half-extents — silhouette fidelity, not collision precision.
function halfExtents(s) {
  const a = s.args || {};
  if (Array.isArray(a.dims)) return [a.dims[0] / 2, a.dims[1] / 2, a.dims[2] / 2];
  if (a.radius != null && a.height != null) return [a.radius, a.height / 2 + a.radius, a.radius]; // cylinder/capsule-ish
  if (a.radius != null) return [a.radius, a.radius, a.radius];
  return [0.8, 0.8, 0.8]; // exotic prims: a nudge, the AABB is dominated by placement
}

function accumulateBounds(b, s) {
  const t = (s.transform && s.transform.translate) || [0, 0, 0];
  const h = halfExtents(s);
  b.minX = Math.min(b.minX, t[0] - h[0]);
  b.maxX = Math.max(b.maxX, t[0] + h[0]);
  b.maxY = Math.max(b.maxY, t[1] + h[1]);
  b.minZ = Math.min(b.minZ, t[2] - h[2]);
  b.maxZ = Math.max(b.maxZ, t[2] + h[2]);
}

function stationProxy(k, b) {
  if (!b || !Number.isFinite(b.minX)) return null;
  const w = Math.max(2, b.maxX - b.minX);
  const d = Math.max(2, b.maxZ - b.minZ);
  const h = Math.max(1.5, b.maxY);
  return {
    id: `proxy-${k}`,
    collection: `proxy-${k}`,
    type: 'box',
    args: { dims: [w, h, d] },
    transform: { translate: [(b.minX + b.maxX) / 2, h / 2, (b.minZ + b.maxZ) / 2] },
    // massing-family silhouette discipline: dark, matte, zero glow
    material: {
      hue: 0.62,
      sat: 0.22,
      value: 0.2,
      metal: 0,
      glow: 0,
      kind: 'normal',
      roughness: 0.6,
    },
  };
}

// Zone massing (spec §4): 1 hull + 1 tower per chapter at a FIXED band outside
// the ring (Wave-0 spike: a multiplicative push collapses on wide-arc zones
// and lands inside the crane near-field). Independent `massing-` prefix —
// sliceDeckWindow keeps these in EVERY window and never distance-culls them
// (the far side is exactly what foreshadowing needs); the horizon-slab quota
// shrinks in exchange (dressing budget conservation, see sliceDeckWindow).
function zoneMassing(zones, origins, ringR, center, centerIdx) {
  const out = [];
  const mat = {
    hue: 0.62,
    sat: 0.28,
    value: 0.32,
    metal: 0,
    glow: 0,
    kind: 'normal',
    roughness: 0.85,
  };
  // WORLD-HEART PROXY (blind-test round 1 fix): the cover forest lives in
  // station 0's windows only, so during every chapter the courtyard centre
  // simply DID NOT EXIST, then popped in at each threshold — the single
  // biggest continuity break vs radial ("世界的延续感"). A few always-on
  // silhouette blocks (massing- prefix = kept in every window) stand in for
  // the forest at distance; when the real forest is present they sit inside
  // its dark mass and disappear into it.
  if (centerIdx != null) {
    const heart = [
      { t: [center[0], 3.2, center[1] - 6], d: [2.2, 6.4, 2.2] },
      { t: [center[0] - 2.6, 2.4, center[1] - 11], d: [1.8, 4.8, 1.8] },
      { t: [center[0] + 2.8, 2.9, center[1] - 15], d: [1.9, 5.8, 1.9] },
    ];
    heart.forEach((h, i) =>
      out.push({
        id: `massing-center-${i}`,
        type: 'box',
        args: { dims: h.d },
        transform: { translate: h.t },
        material: mat,
      }),
    );
  }
  const bandR = ringR + 34;
  zones.forEach((members, z) => {
    const pts = members.map((i) => origins[i]).filter(Boolean);
    // accumulator is an [x, z] PAIR — origins are [x, y, z] triples
    const c = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[2]], [0, 0]).map((v) => v / pts.length);
    const len = Math.hypot(c[0] - center[0], c[1] - center[1]) || 1;
    const bx = center[0] + ((c[0] - center[0]) / len) * bandR;
    const bz = center[1] + ((c[1] - center[1]) / len) * bandR;
    const W = 7 + members.length * 1.4; // chapter weight → skyline width
    const H = 4.2 + members.length * 1.1;
    out.push({
      id: `massing-z${z}-hull`,
      type: 'ellipsoid',
      args: { dims: [W, H, W * 0.55] },
      transform: { translate: [bx, -H * 0.45, bz] }, // crest only — a ridge, not a dome
      material: mat,
    });
    out.push({
      id: `massing-z${z}-tower`,
      type: 'box',
      args: { dims: [W * 0.22, H * 1.6, W * 0.22] },
      transform: { translate: [bx + W * 0.28, H * 0.4, bz - W * 0.1] },
      material: mat,
    });
  });
  return out;
}

function stationOrigins(n, stride, layout) {
  if (layout === 'radial') {
    // neighbor arc spacing ≈ stride; camera-side (+z) faces outward from the top
    const R = Math.max(stride * 0.75, (stride * n) / (2 * Math.PI));
    return Array.from({ length: n }, (_, k) => {
      const th = (k * 2 * Math.PI) / n;
      return [Math.sin(th) * R, 0, Math.cos(th) * R];
    });
  }
  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(n));
    return Array.from({ length: n }, (_, k) => [
      (k % cols) * stride,
      0,
      -Math.floor(k / cols) * stride, // rows recede — the city-of-data look
    ]);
  }
  if (layout === 'theater') {
    // Theater rides the line but CENTERED on the world origin: the studio's
    // key light and room shading anchor there (lightFromSpherical around 0),
    // so an 0..N*stride line walks its far acts out of the lit zone — by
    // station 6 the floor fell to raw dark checker. ±half-span keeps every
    // act inside the light's reach (plus figure.js raises the rig for decks).
    return Array.from({ length: n }, (_, k) => [(k - (n - 1) / 2) * stride, 0, 0]);
  }
  return Array.from({ length: n }, (_, k) => [k * stride, 0, 0]); // line
}

/**
 * assembleDeck(deck, opts) → SceneData
 * @param {object} deck  { title?, layout?: 'line'|'radial'|'grid', slides: IR[] }
 * @param {object} opts  { env?, stride? (default 16), layout? (overrides deck.layout) }
 */
export function assembleDeck(deck, opts = {}) {
  if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0)
    throw new Error('assembleDeck: deck.slides must be a non-empty array of IRs');
  const env = getEnvironment(opts.env);
  const accents = assignAccents(deck.slides, opts.palette);
  // Layer C v1 (Wave 2): opts.decorSeed is the deck's art identity — one hash,
  // one voice across every station and transit. Absent → no decor (goldens and
  // existing consumers unchanged).
  // opts.dressing='nature'(OPT-IN):Layer C 装饰换资产工厂语汇(聚簇石群+
  // 背风林分,Infinigen 八课的 deck 消费端);默认 stelae 不动,golden 不动。
  const decor = makeDeckDecor(opts.decorSeed, { style: opts.dressing || 'stelae' });
  const stride = opts.stride ?? 16;
  let layout = DECK_LAYOUTS.includes(opts.layout ?? deck.layout)
    ? (opts.layout ?? deck.layout)
    : 'line';
  let plan = null;
  if (layout === 'courtyard') {
    const zones = opts.zones ?? deck.zones;
    plan = Array.isArray(zones) && zones.length ? courtyardPlan(deck.slides, zones, stride) : null;
    if (plan) plan.zones = zones;
    else {
      // no zone annotation, or 1-station chapters: refusing is the CORRECT
      // behavior (debate 落地 #9) — degrade to the shipped ring, loudly.
      console.warn(
        'assembleDeck: courtyard needs zone annotation with ≥2 stations per chapter on average — falling back to radial',
      );
      layout = 'radial';
    }
  }
  const origins = plan ? plan.origins : stationOrigins(deck.slides.length, stride, layout);

  const subjects = [];
  const overlay = [];
  const shots = [];
  const hitstops = [];
  let clock = 0;
  let prevPayoff = null;
  // Chapter narration (R2, layout-agnostic): when the deck carries zones +
  // chapters metadata, a zone-crossing transit gets a floating chapter card —
  // the transit was the one wordless span in the whole deck, and the chapter
  // conclusion/tease is exactly transit-sized text.
  const zoneOfIdx = Array.isArray(deck.zones)
    ? (() => {
        const z = new Array(deck.slides.length).fill(null);
        deck.zones.forEach((ms, zi) => ms.forEach((i) => (z[i] = zi)));
        return z;
      })()
    : null;
  // Per-station shader switching (M3 perf): the ONE-shader deck world hits
  // Apple GPUs' super-linear giant-shader cost (register pressure kills
  // occupancy at compile time — runtime branch-skipping proved useless, see
  // 2026-07-10 perf A/B). So we also emit a WINDOW TIMELINE: which stations
  // the camera can actually see during each span. The runtime swaps in a
  // small per-window shader as playback crosses each boundary.
  const windows = [];
  // Finale-LOD (Infinigen placeholder pattern): per-station world-space bounds
  // accumulated during transplant → one grounded silhouette box per station.
  // The finale/overlook windows swap far-station CONTENT for these proxies
  // (at pull-back distance the data detail is sub-pixel; the full-world
  // shader cost was ~85s of a 112s analytic warmup). Content subjects only —
  // decor stelae ring at r≈8-12 and would balloon the silhouette.
  const stationBounds = [];

  deck.slides.forEach((ir, k) => {
    // Render the station at the origin on its own clock, then transplant.
    // opts.stage: each station gets its own fitted platform disc (a subject, so
    // it transplants with the station); the station's stage DEFAULTS (lights /
    // postFx / room shell) are discarded here on purpose — the deck owns the
    // world and applies ONE theatre layer below (walls would slice the deck
    // axis, and MAX_EXTRA_LIGHTS=4 can't do per-station rigs).
    const st = renderIR(ir, {
      ...(opts.stage ? { stage: true } : {}),
      ...(accents[k] ? { accent: accents[k] } : {}),
    });
    const origin = origins[k];

    // Transit shot: whip from the previous station's payoff toward this one's
    // hero position (fast lateral sling, a touch of shake — the stage change).
    const hero = st.cameraSequence.shots[0];
    const heroPos = addV(hero.pos, origin);
    const heroTarget = addV(hero.target, origin);
    if (k > 0) {
      // THRESHOLD (courtyard only): at a chapter seam, rise and look back
      // across the courtyard before the whip — the one beat whose JOB is the
      // vista (debate: vista is material CONSUMED BY designated shots, never
      // an ambient promise). Sees the whole ring → an honest full-world
      // window ('finale' kind: sliceDeckWindow returns the unsliced scene).
      if (plan && plan.zoneOf[k] !== plan.zoneOf[k - 1]) {
        // Blind-test round 1 rewrite: the threshold is now a LONGER SLING in
        // radial's own camera language (what won the continuity read), not a
        // detour to a map view — the camera keeps travelling, the gaze drifts
        // toward the courtyard heart mid-flight and flows on to the new
        // chapter. Window is a plain transit (2 stations + always-on massing
        // + world-heart proxy), NOT full-world: the geometry pop at full-
        // world boundaries was the continuity break itself.
        const dur = TEMPO.threshold;
        const [cx, cz] = plan.center;
        const risePos = [
          (prevPayoff.pos[0] + heroPos[0]) / 2 + (cx - (prevPayoff.pos[0] + heroPos[0]) / 2) * 0.2,
          Math.max(prevPayoff.pos[1], heroPos[1]) + 3.4,
          (prevPayoff.pos[2] + heroPos[2]) / 2 + (cz - (prevPayoff.pos[2] + heroPos[2]) / 2) * 0.2,
        ];
        const riseTarget = [cx * 0.6 + heroTarget[0] * 0.4, 1.2, cz * 0.6 + heroTarget[2] * 0.4];
        shots.push({
          duration: dur,
          pos: risePos,
          target: riseTarget,
          fov: 52,
          transition: 'blend',
          aperture: 0.1, // deep focus — the vista beat reads the WORLD, not a subject
          focalDistance: plan.ringR,
          shake: [0.1, 0.05], // the sling keeps its physicality across the seam
          ease: 'inout',
        });
        const prevO = origins[k - 1];
        windows.push({
          kind: 'transit',
          stations: [k - 1, k],
          start: clock,
          end: clock + dur,
          origin: [(prevO[0] + origin[0]) / 2, 0, (prevO[2] + origin[2]) / 2],
        });
        clock += dur;
        prevPayoff = { pos: risePos, target: riseTarget };
      }
      const dur = TEMPO.transit;
      shots.push({
        duration: dur,
        pos: [
          (prevPayoff.pos[0] + heroPos[0]) / 2,
          Math.max(prevPayoff.pos[1], heroPos[1]) + 1.6,
          Math.max(prevPayoff.pos[2], heroPos[2]) + 2.0,
        ],
        // R1 critique: an arithmetic-midpoint target frames the VOID between
        // stations at mid-whip. Weight the gaze 70/30 toward where we're
        // GOING — the next arena grows from the frame's third, never the edge.
        target: [
          prevPayoff.target[0] * 0.3 + heroTarget[0] * 0.7,
          heroTarget[1],
          prevPayoff.target[2] * 0.3 + heroTarget[2] * 0.7,
        ],
        fov: 50,
        transition: 'blend',
        aperture: 0,
        focalDistance: stride * 0.8,
        shake: [0.14, 0.05], // sling settles as the next station arrives
        ease: 'whip', // gentle launch, FAST mid-flight, gentle arrival
      });
      const prev = origins[k - 1];
      windows.push({
        kind: 'transit',
        stations: [k - 1, k],
        start: clock,
        end: clock + dur,
        origin: [(prev[0] + origin[0]) / 2, 0, (prev[2] + origin[2]) / 2],
      });
      // chapter card on zone-crossing transits (needs deck.zones + chapters)
      if (
        zoneOfIdx &&
        Array.isArray(deck.chapters) &&
        zoneOfIdx[k] != null &&
        zoneOfIdx[k] !== zoneOfIdx[k - 1]
      ) {
        const ch = deck.chapters[zoneOfIdx[k]];
        if (ch && ch.title)
          overlay.push({
            text: String(ch.title),
            sub: ch.note ? String(ch.note) : undefined,
            role: 'insight',
            panel: 'center', // R3: the chapter card owns the mid-frame void, not the destination's corner
            revealAt: clock + 0.15,
            hideAt: clock + dur,
          });
      }
      clock += dur;
    }

    // Subjects: shift origin (static translate) + rewrite build-ins (y & time).
    for (const s of st.subjects) {
      const moved = JSON.parse(JSON.stringify(s));
      moved.id = `s${k}-${s.id}`;
      // Wave A2: collection assigned AT BIRTH (renderer-assigned wins) — ids
      // are pure identity, routing rides the tag from the moment it exists.
      moved.collection = moved.collection || `station-${k}`;
      moved.transform = moved.transform || {};
      moved.transform.translate = addV(moved.transform.translate || [0, 0, 0], origin);
      if (Array.isArray(moved.animation)) {
        // Every translate CHANNEL shifts by ITS origin component — an expr
        // writes an ABSOLUTE coordinate, so a station-local x/z flight (the
        // evolution past→present orbs, the matrix z-slams) must be rebased
        // exactly like the static translate above. (Pre-2026-07-14 only y
        // shifted — a latent bug hidden by line-layout stations all sitting
        // at z=0 and x-flights not existing yet.)
        const CHANNEL_AXIS = {
          'transform.translate.x': 0,
          'transform.translate.y': 1,
          'transform.translate.z': 2,
        };
        moved.animation = moved.animation.map((a) => ({
          ...a,
          expr: shiftBuildInExpr(
            a.expr,
            CHANNEL_AXIS[a.channel] != null ? origin[CHANNEL_AXIS[a.channel]] : 0,
            clock,
          ),
        }));
      }
      // Wave B: modifier spatial anchors (mirror planes, radial centers,
      // scatter regions) ride the transplant like build-in exprs do — this
      // module owns placement, patterns stay renderer-local.
      if (Array.isArray(moved.modifiers)) {
        moved.modifiers = moved.modifiers.map((m) => shiftModifier(m, origin));
      }
      subjects.push(moved);
      accumulateBounds((stationBounds[k] = stationBounds[k] || newBounds()), moved);
    }

    // Overlay: shift anchors + reveal times; station titles reveal with their
    // slide. Narrative roles (stage-layer subtitles) also get hideAt = the
    // station's end: during the transit sling the frame is IN FLIGHT and the
    // outgoing station's words must clear the screen — the next title landing
    // WITH its arena is what makes the cut read intentional.
    const stationEnd = clock + seqDuration(st.cameraSequence.shots);
    const accCss = accents[k]
      ? (() => {
          const { h, s: sat, v } = accents[k];
          return `hsl(${(h * 360).toFixed(0)} ${(sat * 100).toFixed(0)}% ${(v * 58).toFixed(0)}%)`;
        })()
      : null;
    for (const o of st.overlay || []) {
      overlay.push({
        ...o,
        ...(o.anchor ? { anchor: addV(o.anchor, origin) } : {}),
        revealAt: (o.revealAt ?? 0) + clock,
        // renderer-set hideAt is station-local → shift; narrative roles
        // without one clear at the station's end (transit flies clean)
        ...(o.hideAt != null
          ? { hideAt: o.hideAt + clock }
          : o.role === 'card' || o.role === 'value'
            ? { hideAt: stationEnd + 0.4 } // R3: cards/values lingered into the transit flight
            : { hideAt: stationEnd }),
        // the DOM layer paints in the station's chapter color too: the value
        // chip's fill and the CURRENT subtitle line pick it up
        ...(accCss ? { accentColor: accCss } : {}),
      });
    }

    // Camera: shift shots in space + append (time shift is implicit — durations chain).
    // Beat tags ride along; tagged shots get their station index for the presenter.
    // TOTAL CONTINUITY (2026-07-12 user directive: camera continuity is the
    // FIRST element of world-feel — no discontinuity may exist in deck
    // playback): every station shot becomes a blend. The evaluator's default
    // transition is 'cut', so an unmarked hero shot was a hard jump at every
    // station entry, and the SUPER's hard cut was a jump mid-station. The
    // super keeps its punch through ease 'out' (fast rush + settle), shake,
    // exposure and hitstop — impact stays, teleporting goes. Solo figure
    // pages (?ir=) keep the fighting-game cuts untouched.
    st.cameraSequence.shots.forEach((sh) => {
      shots.push({
        ...sh,
        pos: addV(sh.pos, origin),
        target: addV(sh.target, origin),
        transition: 'blend',
        ...(sh.beat ? { station: k } : {}),
      });
    });
    // Hitstops ride the deck timeline: shift each station's freezes by its start.
    for (const h of st.cameraSequence.hitstops || []) {
      hitstops.push({ at: h.at + clock, hold: h.hold });
    }
    // Layer C: stelae ring in the station's annulus (outside the fitted
    // platform, inside the transit corridor). The `s${k}-decor-` prefix means
    // sliceDeckWindow scopes these to this station's windows automatically.
    // own collection: routes with the station but drops at finale distance
    // (stelae are sub-pixel from the money shot; they'd eat the leaf budget)
    if (decor)
      subjects.push(
        ...decor.station(k, origin).map((d) => ({ ...d, collection: `station-${k}-decor` })),
      );

    const stationDur = seqDuration(st.cameraSequence.shots);
    windows.push({
      kind: 'station',
      // NOTE: the cover window stays single-station on purpose — carrying the
      // whole world here was tried and cost 48s to FIRST FRAME (the giant
      // shader becomes the boot shader). The world-heart proxy + chapter
      // massing already ride every window, so the world's silhouette is
      // present from frame one at leaf-budget cost; only ring station
      // CONTENT appears at the overlook (a reveal that beat can own).
      stations: [k],
      start: clock,
      end: clock + stationDur,
      origin: [...origin],
      // ambience tier (2D's page-tier system, spatialized): hold pages are
      // HERO — full skyline; data stations trim ambience to keep focus
      tier: ir.structure === 'hold' ? 'hero' : 'content',
    });
    clock += stationDur;
    const last = st.cameraSequence.shots[st.cameraSequence.shots.length - 1];
    prevPayoff = { pos: addV(last.pos, origin), target: addV(last.target, origin) };

    // OVERLOOK (courtyard only): right after the cover station at the centre,
    // one high beat framing the whole courtyard — the 2D TOC page's 3D twin
    // ("here is everything we will visit"). Full-world window, like finale.
    if (plan && k === plan.centerIdx) {
      const dur = TEMPO.overlook;
      const [cx, cz] = plan.center;
      // near-top-down: the overlook reads as the deck's MAP ("here is
      // everything we will visit") — 3/4 views kept letting the centre forest
      // dominate; the plan itself (arcs + seams) is the subject
      const pos = [cx, plan.ringR * 2.2 + 6, cz + plan.ringR * 0.9];
      shots.push({
        duration: dur,
        pos,
        target: [cx, 0, cz],
        fov: 58, // wide: the WHOLE ring in frame, not a crop of it
        transition: 'blend',
        aperture: 0.08,
        focalDistance: plan.ringR * 2.2,
        ambient: 1.6, // the map beat lifts over the stage dimming…
        exposure: 1.35, // …and gets an exposure step so the arcs stay readable
        ease: 'inout',
        beat: 'overlook',
      });
      windows.push({
        kind: 'finale',
        stations: deck.slides.map((_, i) => i),
        // finale-LOD anchor: the station the camera rises FROM keeps its real
        // content (no swap in front of the lens); every other station shows
        // its silhouette proxy — the overlook is a map beat, massing-level
        // information is exactly what it communicates.
        anchor: plan.centerIdx,
        start: clock,
        end: clock + dur,
      });
      clock += dur;
      prevPayoff = { pos, target: [cx, 0.8, cz] };
    }

    // Breadcrumb path to the next station: a chain of low flat markers along
    // the segment between the two origins (any layout), each oriented to face
    // the walk direction — the transit flies over a PATH instead of empty
    // floor, and the eye is led to the next arena.
    if (k < deck.slides.length - 1) {
      const next = origins[k + 1];
      const dx = next[0] - origin[0];
      const dz = next[2] - origin[2];
      const yaw = Math.atan2(dz, dx); // marker long axis along the segment
      const dots = 7; // R3: five chips read as debris; seven make a line
      const step = [dx / (dots + 1), 0, dz / (dots + 1)];
      // Wave B: ONE runway subject with an array modifier — the seven strips
      // used to be hand-unrolled; the placement pattern is now data.
      subjects.push({
        id: `path-${k}-runway`,
        collection: `path-${k}`,
        type: 'box',
        // R1 critique: 0.9×0.06 chips were invisible in the transit frame —
        // the flight had no guide line. Long low glowing strips read as a
        // runway; the ground between stations stops being a black gap.
        args: { dims: [1.7, 0.05, 0.32] },
        modifiers: [{ type: 'array', count: dots, offset: step }],
        transform: {
          translate: [origin[0] + step[0], 0.03, origin[2] + step[2]],
          rotate: [0, -yaw, 0],
        },
        material: {
          hue: 0.58,
          sat: 0.25,
          value: 0.85,
          glow: 0.45, // R3: 0.12 was invisible in the dark field — the runway must READ
          kind: 'normal',
          roughness: 0.5,
          clearcoat: 0.2,
        },
      });
      // Layer C: inlay flanking the breadcrumbs (path-${k}-decor- prefix →
      // lives only in this transit's windows, dropped inside stations).
      // own collection: same window routing as the runway, but droppable at
      // finale distance (inlay plates are sub-pixel from the money shot)
      if (decor)
        subjects.push(
          ...decor.segment(k, origin, next).map((d) => ({ ...d, collection: `path-${k}-decor` })),
        );
    }
  });

  // ---- Deck finale: one frame that holds the WHOLE presentation --------------
  // After the last station's payoff, pull up and back until every station is in
  // frame — the thesis money shot ("your entire deck is one world"). Framing
  // scales with the layout's actual extent; deep focus so nothing blurs away.
  {
    const cx = origins.reduce((s, o) => s + o[0], 0) / origins.length;
    const cz = origins.reduce((s, o) => s + o[2], 0) / origins.length;
    const span = Math.max(1, ...origins.map((o) => Math.hypot(o[0] - cx, o[2] - cz))) * 2 + stride;
    shots.push({
      duration: TEMPO.finale,
      pos: [cx + span * 0.25, span * 0.5 + 4.5, cz + span * 0.95],
      target: [cx, 1.2, cz],
      fov: 48,
      transition: 'blend',
      aperture: 0.08,
      focalDistance: span * 1.05,
      // R3 ("停电现场" critique): the thesis frame inherited the stage's
      // combat dimming and read as a blackout — it gets the overlook's lift
      ambient: 1.7,
      exposure: 1.35,
      ease: 'out',
      beat: 'finale', // presenter mode: the money-shot hold
    });
    // closing card: the deck's last spoken line is its THESIS — it must be
    // seen, not just heard (deck.finale = { text, sub }, optional metadata)
    if (deck.finale && deck.finale.text) {
      overlay.push({
        text: String(deck.finale.text),
        sub: deck.finale.sub ? String(deck.finale.sub) : undefined,
        role: 'insight',
        panel: 'center',
        revealAt: clock + 0.5,
      });
    }
    windows.push({
      kind: 'finale',
      stations: deck.slides.map((_, i) => i),
      // finale-LOD anchor: the pull-back rises from the LAST station — it
      // stays real (nothing swaps in front of the lens); the rest of the ring
      // shows silhouette proxies, sub-pixel-different at this distance.
      anchor: deck.slides.length - 1,
      start: clock,
      end: clock + TEMPO.finale,
    });
  }

  // World dressing: envs bring their own terrain; the DEFAULT open world gets a
  // ring of cheap hill silhouettes around the deck's centroid, so transits fly
  // toward a horizon instead of an empty plain.
  // opts.horizon = 'boulders' (OPT-IN, Infinigen 研读第三课): the skyline ring
  // becomes a weighted 3-species boulder mixed forest (placeholder form —
  // analytic-safe, same leaf budget and cull semantics as the slabs). Default
  // stays the black-slab monoliths; goldens untouched.
  const skylineCenter = [
    origins.reduce((s, o) => s + o[0], 0) / origins.length,
    origins.reduce((s, o) => s + o[2], 0) / origins.length,
  ];
  const worldSubjects = env
    ? env.subjects
    : opts.horizon === 'boulders'
      ? boulderHorizon(skylineCenter, 135, opts.decorSeed || deck.title || 'skyline')
      : horizonSilhouettes(skylineCenter);
  // Courtyard: chapter massing joins the world (background swapped from pure
  // scenery to MEANING — user decision 2026-07-12: slabs yield their quota).
  const massingSubjects = plan
    ? zoneMassing(plan.zones, origins, plan.ringR, plan.center, plan.centerIdx)
    : [];

  const baseDefaults = env
    ? env.defaults
    : {
        camera: {
          yaw: 0,
          pitch: -0.1,
          distance: 12,
          focal: 1.2,
          targetX: 0,
          targetY: 2,
          targetZ: 0,
        },
        light: { azimuth: 0.5, altitude: 0.7, distance: 40, intensity: 1.1 },
      };

  // Deck theatre layer (opts.stage): the open-world version of the fighting-game
  // stage — dark miss-sky, mildly dimmed ambient (transits must stay readable),
  // silhouette glow on every station, vignette + a touch of bloom. No room shell,
  // no per-station lights (see the station comment above).
  const stageDefaults = opts.stage
    ? {
        studioBg: 'dark',
        interiorDark: 0.4,
        glow: { amount: 0.3, k: 3.5 }, // R2: k=6 died on large-radius motifs (the dome)
        postFx: { vignetteStrength: 0.58, exposure: 0.92, bloomMix: 0.24 },
      }
    : null;

  // ---- Wave A (Blender borrow): collections + material registry ---------------
  // Collections make the slicing semantics DATA: every subject carries a
  // collection tag from its creation site (Wave A2 — no id-regex tagging
  // anywhere), the registry says how each collection behaves in a window
  // (kind / cull policy / dressing budget). The id prefixes are pure identity.
  const allSubjects = [
    ...subjects,
    ...stationBounds.map((b, k) => stationProxy(k, b)).filter(Boolean),
    ...massingSubjects.map((s) => ({ ...s, collection: 'massing' })),
    ...worldSubjects.map((s) => ({ ...s, collection: env ? 'env' : 'horizon' })),
  ];
  const collections = {};
  deck.slides.forEach((ir, k) => {
    // tier rides the registry: hold stations are HERO (narrative anchors) and
    // keep their real geometry even in the finale — an AABB proxy turns the
    // cover's monolith + satellite ring into a frame-dominating warehouse box
    const tier = ir.structure === 'hold' ? 'hero' : 'content';
    collections[`station-${k}`] = { kind: 'station', station: k, tier };
    collections[`station-${k}-decor`] = { kind: 'station', station: k, tier, finaleDrop: true };
    // finale-LOD: the proxy collection exists in NO normal window and stands
    // in for far-station content in finale/overlook windows only
    collections[`proxy-${k}`] = { kind: 'proxy', station: k, tier };
    if (k < deck.slides.length - 1) {
      collections[`path-${k}`] = { kind: 'transit-path', from: k };
      collections[`path-${k}-decor`] = { kind: 'transit-path', from: k, finaleDrop: true };
    }
  });
  collections.massing = { kind: 'dressing', cull: 'never' };
  collections.horizon = {
    kind: 'dressing',
    cull: 'nearest',
    budget: { hero: HILLS_HERO, content: HILLS_CONTENT },
    yieldTo: 'massing', // dressing budget conservation (spec §4)
  };
  collections.env = { kind: 'dressing', cull: 'never' };
  // Wave A2: no regex tagging — every creation site above attaches its own
  // collection. A subject slipping through untagged would be kept in EVERY
  // window (silent leaf bloat), so it's a hard error here, not a fallback.
  for (const s of allSubjects) {
    if (!s.collection)
      throw new Error(`assembleDeck: subject '${s.id}' has no collection (untagged producer)`);
  }
  // Material registry: auto-dedup the inline materials (36 kinds × ~300 uses on
  // the reference deck). Names are deterministic by first appearance; subjects
  // hold string refs, resolveMaterialRefs() inflates them before compile.
  const materials = {};
  const matName = new Map();
  for (const s of allSubjects) {
    if (!s.material || typeof s.material !== 'object') continue;
    const key = JSON.stringify(s.material);
    let name = matName.get(key);
    if (!name) {
      name = `mat-${matName.size}`;
      matName.set(key, name);
      materials[name] = s.material;
    }
    s.material = name;
  }

  // ---- theater 镜头轨道(2026-07-14 user 方向:像看话剧)------------------------
  // 相机钉在一条水平轨道上:全程同高(railY)同距(railDist),幕间只有 x 平移
  // (blend = 整个 shot 时长的插值 → transit 即全程推轨),幕内静止持机。
  // 只替换 shots/hitstops —— 时间线(窗口/reveal/字幕/章节卡)原封不动:每个
  // shot 的时长 = 对应窗口的跨度。冲击装置(急推/shake/hitstop/曝光爆点)全部
  // 不用:观众的思考连续性优先于震撼(radial 保留原语法,两种语气并存)。
  if (layout === 'theater') {
    const FOV = 42;
    const halfTan = Math.tan((FOV * Math.PI) / 360);
    // 每站的取景需求(竖装下最高点、横装下最宽处),轨道取全 deck 最大值 ——
    // 一条轨走到底,小场景取景略松,换来绝对的平移连续性
    const frame = origins.map((_, k) => {
      const b = stationBounds[k];
      if (!b || !Number.isFinite(b.minX)) return { d: 10, ty: 1.6 };
      const halfW = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
      const topY = Math.max(1.6, b.maxY);
      const d = Math.max(7, (topY * 1.3) / halfTan, (halfW * 1.2) / (halfTan * 1.7));
      return { d, ty: Math.min(topY * 0.45, 3.2) };
    });
    // 轨道距离取中位数并箝制:极端站(cover 的舞台背板等)不该决定整条轨 ——
    // 背板被裁是对的,它本来就是背景;数据主体的可读性优先
    const ds = frame.map((f) => f.d).sort((a, b) => a - b);
    const railDist = Math.min(26, Math.max(10, ds[Math.floor(ds.length / 2)]));
    const tys = frame.map((f) => f.ty).sort((a, b) => a - b);
    const railY = tys[Math.floor(tys.length / 2)] + railDist * 0.08; // 轻微俯视
    const railShots = [];
    for (const w of windows) {
      const dur = w.end - w.start;
      if (w.kind === 'station' || w.kind === 'transit') {
        // station:持本站机位(与前一 transit 同 pose → 静止);
        // transit:去往站的机位(与前一 pose 差一段 x → 全程水平推轨)
        const k = w.kind === 'station' ? w.stations[0] : w.stations[1];
        const o = origins[k];
        railShots.push({
          duration: dur,
          pos: [o[0], railY, o[2] + railDist],
          target: [o[0], frame[k].ty, o[2]],
          fov: FOV,
          transition: 'blend',
          ease: 'inout',
          ...(w.kind === 'station' ? { beat: 'station', station: k } : {}),
        });
      } else {
        // finale:沿轨道法线纯直退,拉到整排入画 —— 谢幕,不炫技
        const cx = origins.reduce((s, o) => s + o[0], 0) / origins.length;
        const span = (origins[origins.length - 1][0] - origins[0][0]) / 2 + stride;
        const d = Math.max(railDist * 1.5, (span * 1.1) / (halfTan * 1.7));
        railShots.push({
          duration: dur,
          pos: [cx, railY + d * 0.1, d],
          target: [cx, railY * 0.5, 0],
          fov: FOV,
          transition: 'blend',
          ease: 'out',
          ambient: 1.7,
          exposure: 1.35,
          beat: 'finale',
        });
      }
    }
    shots.length = 0;
    shots.push(...railShots);
    hitstops.length = 0;
  }

  return {
    v: 1,
    name: `(deck) ${deck.title || `${deck.slides.length} stations`}${opts.env ? ` · ${opts.env}` : ''}`,
    collections,
    materials,
    subjects: allSubjects,
    overlay,
    // flow: steadicam smoothing (total-continuity lock) — deck playback is one
    // breathing take; the runtime erases shot-boundary velocity kinks.
    cameraSequence: { loop: false, shots, hitstops, flow: true },
    deckWindows: windows,
    // One shared open world — no per-station stage room (walls would slice the
    // deck axis). Ground/sky come from the environment or the page defaults.
    defaults: stageDefaults ? { ...baseDefaults, ...stageDefaults } : baseDefaults,
  };
}

// ---- Window slicing (per-station shader switching) ---------------------------
// Cut ONE window's SceneData out of the assembled deck. Only `subjects` is
// filtered — camera timeline, overlay and defaults are shared by reference so
// the presentation clock, teleprompter and postFx are byte-identical across
// window swaps (the swap changes WHICH GEOMETRY EXISTS, never when/how it is
// filmed). Routing is entirely `subject.collection` + the scene.collections
// registry (Wave A2 — ids are pure identity): station-k / path-k membership
// decides window inclusion; dressing collections (massing/horizon/env) stay
// in every window so the backdrop never pops.
// Shader cost is SUPER-linear in leaf count on Apple GPUs, so even the cheap
// horizon-hill silhouettes (14 leaves ringing the deck centroid) dominate a
// 5-subject station window. Keep only the nearest few per window — they are
// distant near-black bumps, so the far-side ones dropping out of a window is
// invisible while the statement count halves. Env terrains (alpine etc.) are
// NOT trimmed: their pieces are large and continuous, and cutting one leaves
// a hole in the world.
const HILLS_HERO = 7;
const HILLS_CONTENT = 3;
export function sliceDeckWindow(scene, win, opts = {}) {
  if (!win) return scene;
  const cols = scene.collections;
  if (!cols) return scene; // no routing data → nothing to slice (whole world)

  // Finale-LOD: the full-world money shot swaps far-station CONTENT for the
  // per-station silhouette proxies. The ANCHOR station (the one the camera
  // rises from) keeps its real geometry — nothing may swap in front of the
  // lens (total-continuity lock); at pull-back distance every other station's
  // proxy is visually equivalent while the shader drops from ~390 leaves to
  // well under the raymarch window cap. Runways stay (they draw the world's
  // connective lines); transit inlay decor is sub-pixel and drops.
  // opts.finaleLite (raymarch tiers): hero stations ALSO stand as proxies —
  // their exotic prims + the leaf count push the D3D/ANGLE compiler off a
  // cliff (~104s for the 87-leaf hero-real finale vs seconds at ~50 leaves).
  // The analytic tier keeps heroes real: closed-form intersectors don't pay
  // that cliff, and hero silhouettes are the money shot's composition.
  if (win.kind === 'finale') {
    if (win.anchor == null) return scene; // pre-LOD producer → whole world
    // real geometry: the anchor (camera rises from it) + hero stations
    // (narrative anchors whose silhouette IS their identity)
    const real = (c) => c.station === win.anchor || (!opts.finaleLite && c.tier === 'hero');
    const keep = (s) => {
      const c = cols[s.collection];
      if (!c) return true;
      if (c.finaleDrop) return false; // decor: sub-pixel at pull-back distance
      if (c.kind === 'proxy') return !real(c);
      if (c.kind === 'station') return real(c);
      return true; // dressing + runways
    };
    return { ...scene, subjects: scene.subjects.filter(keep) };
  }
  const wanted = new Set(win.stations);

  // Wave A2: collection-driven slicing ONLY — the routing rules live in DATA
  // (scene.collections), ids are pure identity. The pre-Wave-A id-regex
  // fallback is gone; assembleDeck hard-errors on untagged subjects instead.
  const keepByCollection = (s) => {
    const c = cols[s.collection];
    if (!c) return true; // untagged → shared dressing
    if (c.kind === 'proxy') return false; // finale/overlook stand-ins only
    if (c.kind === 'station') return wanted.has(c.station);
    if (c.kind === 'transit-path') {
      // Station windows keep only the OUTGOING segment (the world never pops
      // in ahead of the lens — total-continuity lock); transit windows carry
      // both segments they touch.
      if (win.kind === 'station') return wanted.has(c.from);
      return wanted.has(c.from) || wanted.has(c.from + 1);
    }
    return true; // dressing/decor: kept (nearest-cull handled below)
  };
  let subjects = scene.subjects.filter(keepByCollection);

  if (Array.isArray(win.origin)) {
    // Dressing budget CONSERVATION (spec §4): 'never'-culled dressing (chapter
    // massing) stays in every window — the far side is exactly what
    // foreshadowing needs; the nearest-culled collection's quota shrinks in
    // exchange (yieldTo), so the per-window dressing total stays in one band.
    const tierKey = win.tier === 'hero' ? 'hero' : 'content';
    const cullNearest = (memberOf, budget) => {
      const members = subjects.filter(memberOf);
      if (members.length <= budget) return;
      const distSq = (s) => {
        const t = (s.transform && s.transform.translate) || [0, 0, 0];
        return (t[0] - win.origin[0]) ** 2 + (t[2] - win.origin[2]) ** 2;
      };
      const near = new Set(members.sort((a, b) => distSq(a) - distSq(b)).slice(0, budget));
      subjects = subjects.filter((s) => !memberOf(s) || near.has(s));
    };
    for (const [name, c] of Object.entries(cols)) {
      if (c.kind !== 'dressing' || c.cull !== 'nearest') continue;
      const yieldCount = c.yieldTo ? subjects.filter((s) => s.collection === c.yieldTo).length : 0;
      const base =
        (c.budget && c.budget[tierKey]) ?? (tierKey === 'hero' ? HILLS_HERO : HILLS_CONTENT);
      cullNearest((s) => s.collection === name, Math.max(0, base - yieldCount));
    }
  }
  return { ...scene, subjects };
}
