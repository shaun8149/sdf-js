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
import { getEnvironment, horizonSilhouettes } from './environments.js';

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
const seqDuration = (shots) => shots.reduce((s, sh) => s + (sh.duration || 0), 0);

// ---- Deck archetypes ---------------------------------------------------------
// The station LAYOUT is itself structure-aware (the deck-scale half of the
// "geometric cores" thesis): a linear pitch is a corridor, an agenda-around-a-
// theme is a ring, a portfolio is a plaza. Stations are never rotated — every
// structure keeps facing +z so its own camera grammar stays valid; the layout
// only chooses WHERE stations stand (and therefore how the transits sweep and
// what the finale reveals).
export const DECK_LAYOUTS = ['line', 'radial', 'grid'];

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
  const stride = opts.stride ?? 16;
  const layout = DECK_LAYOUTS.includes(opts.layout ?? deck.layout)
    ? (opts.layout ?? deck.layout)
    : 'line';
  const origins = stationOrigins(deck.slides.length, stride, layout);

  const subjects = [];
  const overlay = [];
  const shots = [];
  const hitstops = [];
  let clock = 0;
  let prevPayoff = null;
  // Per-station shader switching (M3 perf): the ONE-shader deck world hits
  // Apple GPUs' super-linear giant-shader cost (register pressure kills
  // occupancy at compile time — runtime branch-skipping proved useless, see
  // 2026-07-10 perf A/B). So we also emit a WINDOW TIMELINE: which stations
  // the camera can actually see during each span. The runtime swaps in a
  // small per-window shader as playback crosses each boundary.
  const windows = [];

  deck.slides.forEach((ir, k) => {
    // Render the station at the origin on its own clock, then transplant.
    // opts.stage: each station gets its own fitted platform disc (a subject, so
    // it transplants with the station); the station's stage DEFAULTS (lights /
    // postFx / room shell) are discarded here on purpose — the deck owns the
    // world and applies ONE theatre layer below (walls would slice the deck
    // axis, and MAX_EXTRA_LIGHTS=4 can't do per-station rigs).
    const st = renderIR(ir, opts.stage ? { stage: true } : {});
    const origin = origins[k];

    // Transit shot: whip from the previous station's payoff toward this one's
    // hero position (fast lateral sling, a touch of shake — the stage change).
    const hero = st.cameraSequence.shots[0];
    const heroPos = addV(hero.pos, origin);
    const heroTarget = addV(hero.target, origin);
    if (k > 0) {
      const dur = 1.2;
      shots.push({
        duration: dur,
        pos: [
          (prevPayoff.pos[0] + heroPos[0]) / 2,
          Math.max(prevPayoff.pos[1], heroPos[1]) + 1.6,
          Math.max(prevPayoff.pos[2], heroPos[2]) + 2.0,
        ],
        target: [(prevPayoff.target[0] + heroTarget[0]) / 2, heroTarget[1], heroTarget[2]],
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
      clock += dur;
    }

    // Subjects: shift origin (static translate) + rewrite build-ins (y & time).
    for (const s of st.subjects) {
      const moved = JSON.parse(JSON.stringify(s));
      moved.id = `s${k}-${s.id}`;
      moved.transform = moved.transform || {};
      moved.transform.translate = addV(moved.transform.translate || [0, 0, 0], origin);
      if (Array.isArray(moved.animation)) {
        moved.animation = moved.animation.map((a) => ({
          ...a,
          expr: shiftBuildInExpr(
            a.expr,
            a.channel === 'transform.translate.y' ? origin[1] : 0,
            clock,
          ),
        }));
      }
      subjects.push(moved);
    }

    // Overlay: shift anchors + reveal times; station titles reveal with their slide.
    for (const o of st.overlay || []) {
      overlay.push({
        ...o,
        anchor: addV(o.anchor, origin),
        revealAt: (o.revealAt ?? 0) + clock,
      });
    }

    // Camera: shift shots in space + append (time shift is implicit — durations chain).
    // Beat tags ride along; tagged shots get their station index for the presenter.
    st.cameraSequence.shots.forEach((sh) => {
      shots.push({
        ...sh,
        pos: addV(sh.pos, origin),
        target: addV(sh.target, origin),
        ...(sh.beat ? { station: k } : {}),
      });
    });
    // Hitstops ride the deck timeline: shift each station's freezes by its start.
    for (const h of st.cameraSequence.hitstops || []) {
      hitstops.push({ at: h.at + clock, hold: h.hold });
    }
    const stationDur = seqDuration(st.cameraSequence.shots);
    windows.push({
      kind: 'station',
      stations: [k],
      start: clock,
      end: clock + stationDur,
      origin: [...origin],
    });
    clock += stationDur;
    const last = st.cameraSequence.shots[st.cameraSequence.shots.length - 1];
    prevPayoff = { pos: addV(last.pos, origin), target: addV(last.target, origin) };

    // Breadcrumb path to the next station: a chain of low flat markers along
    // the segment between the two origins (any layout), each oriented to face
    // the walk direction — the transit flies over a PATH instead of empty
    // floor, and the eye is led to the next arena.
    if (k < deck.slides.length - 1) {
      const next = origins[k + 1];
      const dx = next[0] - origin[0];
      const dz = next[2] - origin[2];
      const yaw = Math.atan2(dz, dx); // marker long axis along the segment
      const dots = 5;
      for (let d = 1; d <= dots; d++) {
        const f = d / (dots + 1);
        subjects.push({
          id: `path-${k}-${d}`,
          type: 'box',
          args: { dims: [0.9, 0.06, 0.28] },
          transform: {
            translate: [origin[0] + dx * f, 0.03, origin[2] + dz * f],
            rotate: [0, -yaw, 0],
          },
          material: {
            hue: 0.58,
            sat: 0.25,
            value: 0.75,
            kind: 'normal',
            roughness: 0.5,
            clearcoat: 0.2,
          },
        });
      }
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
      duration: 3.0,
      pos: [cx + span * 0.25, span * 0.5 + 4.5, cz + span * 0.95],
      target: [cx, 1.2, cz],
      fov: 48,
      transition: 'blend',
      aperture: 0.08,
      focalDistance: span * 1.05,
      ease: 'out',
      beat: 'finale', // presenter mode: the money-shot hold
    });
    windows.push({
      kind: 'finale',
      stations: deck.slides.map((_, i) => i),
      start: clock,
      end: clock + 3.0,
    });
  }

  // World dressing: envs bring their own terrain; the DEFAULT open world gets a
  // ring of cheap hill silhouettes around the deck's centroid, so transits fly
  // toward a horizon instead of an empty plain.
  const worldSubjects = env
    ? env.subjects
    : horizonSilhouettes([
        origins.reduce((s, o) => s + o[0], 0) / origins.length,
        origins.reduce((s, o) => s + o[2], 0) / origins.length,
      ]);

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
        glow: { amount: 0.3, k: 6.0 },
        postFx: { vignetteStrength: 0.58, exposure: 0.92, bloomMix: 0.24 },
      }
    : null;

  return {
    v: 1,
    name: `(deck) ${deck.title || `${deck.slides.length} stations`}${opts.env ? ` · ${opts.env}` : ''}`,
    subjects: [...subjects, ...worldSubjects],
    overlay,
    cameraSequence: { loop: false, shots, hitstops },
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
// filmed). Relies on assembleDeck's own naming: station subjects are prefixed
// `s${k}-`, breadcrumb paths `path-${k}-` (connecting k → k+1); anything else
// is shared world dressing (horizon hills, env terrain) and stays in every
// window so the backdrop never pops.
// Shader cost is SUPER-linear in leaf count on Apple GPUs, so even the cheap
// horizon-hill silhouettes (14 leaves ringing the deck centroid) dominate a
// 5-subject station window. Keep only the nearest few per window — they are
// distant near-black bumps, so the far-side ones dropping out of a window is
// invisible while the statement count halves. Env terrains (alpine etc.) are
// NOT trimmed: their pieces are large and continuous, and cutting one leaves
// a hole in the world.
const HILLS_PER_WINDOW = 6;
export function sliceDeckWindow(scene, win) {
  if (!win || win.kind === 'finale') return scene;
  const wanted = new Set(win.stations);
  const keep = (s) => {
    const id = typeof s.id === 'string' ? s.id : '';
    const st = /^s(\d+)-/.exec(id);
    if (st) return wanted.has(Number(st[1]));
    const path = /^path-(\d+)-/.exec(id);
    if (path) {
      const i = Number(path[1]);
      return wanted.has(i) || wanted.has(i + 1);
    }
    return true;
  };
  let subjects = scene.subjects.filter(keep);
  if (Array.isArray(win.origin)) {
    const hills = subjects.filter((s) => typeof s.id === 'string' && s.id.startsWith('horizon-'));
    if (hills.length > HILLS_PER_WINDOW) {
      const distSq = (s) => {
        const t = (s.transform && s.transform.translate) || [0, 0, 0];
        return (t[0] - win.origin[0]) ** 2 + (t[2] - win.origin[2]) ** 2;
      };
      const near = new Set(
        [...hills].sort((a, b) => distSq(a) - distSq(b)).slice(0, HILLS_PER_WINDOW),
      );
      subjects = subjects.filter((s) => !s.id || !s.id.startsWith('horizon-') || near.has(s));
    }
  }
  return { ...scene, subjects };
}
