// sdf-js/src/scene/render-magnitude.js
// Structure renderer #4: magnitude → MONOLITH ROW. Reads the IR ONLY (never 2D x/y).
//
// Why monoliths are the native 3D form for magnitude: a 2D bar chart is read
// from OUTSIDE — the eye compares heights on paper. In 3D the camera walks AMONG
// the quantities: a low-angle tracking shot makes the biggest value physically
// tower over you (the body-scale read no flat chart has), while equal footprints
// keep the comparison honest (height stays the linear encoding; the DOM value
// labels carry the exact numbers).
//
// Fighting-game grammar, magnitude variation — the CHARACTER-SELECT ROW:
//   1. hero — low angle at the tallest monolith (the champion)
//   2. crane — up and over: the whole lineup
//   3. TRACKING SHOT — the camera dollies along the row; each monolith ERUPTS
//      from the ground as the camera passes it (rise, not drop — growth reads
//      upward). One beat per monolith.
//   4. the SUPER — hard cut punch-in at the emphasis monolith's base, looking
//      UP its full height + shake + exposure pop
//   5. payoff pull-back — the whole skyline in one frame
import { validateIR } from './ir.js';
import { getEnvironment } from './environments.js';
import { MODULE, SCALE, centeredRow, rowSpan as rowSpanOf } from './layout-tokens.js';
import { TEMPO, introLead as introLeadOf } from './tempo-tokens.js';
import { deriveMagnitudeInsight } from './insights.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

// Section color programming: the station's chapter accent drives the family
// hue (deck-level color program, shared palette with the 2D end); gold stays
// the deck-wide CHAMPION mark. No accent → the classic blue family.
const monoMat = (i, N, emphasized, accent) => {
  if (emphasized)
    return {
      hue: 0.11,
      sat: 0.78,
      value: 0.95,
      metal: 0,
      glow: 0.1, // R1 critique: glow 0.22 × super exposure clipped gold to cream
      kind: 'normal',
      roughness: 0.22,
      clearcoat: 0.6,
    };
  const k = N > 1 ? i / (N - 1) : 0;
  if (accent)
    return {
      hue: accent.h,
      sat: Math.min(1, accent.s * (0.8 + 0.25 * k)),
      value: Math.max(0.28, accent.v * (1.0 - 0.3 * k)),
      kind: 'normal',
      roughness: 0.3,
      clearcoat: 0.45,
    };
  return {
    hue: 0.55 + 0.09 * k,
    sat: 0.62 + 0.14 * k,
    value: 0.82 - 0.22 * k,
    kind: 'normal',
    roughness: 0.3,
    clearcoat: 0.45,
  };
};

// ---- horizontal ranked bars (orientation:'horizontal') ------------------------
// Categories stacked top→bottom; each bar is a box growing screen-right, length
// ∝ value. Bars slide in from the right (translate.x build-in) staggered by
// rank; the camera walks down the ranking. Category names bind at each bar's
// left end (the ranking axis), value chips at the right end. Analytic-safe.
function renderHorizontalBars(ir, opts, env) {
  const nodes = ir.nodes.map(label);
  const N = nodes.length;
  const mag = ir.magnitude;
  const mMax = Math.max(...mag.map((x) => Number(x) || 0), 1e-9);
  const order = ir.order && ir.order.length === N ? ir.order : nodes.map((_, i) => i);
  let longest = 0;
  for (let i = 1; i < N; i++) if (mag[i] > mag[longest]) longest = i;
  const emphasisIdx = ir.emphasis && ir.emphasis.length ? ir.emphasis[0] : longest;
  const emphasis = new Set(ir.emphasis && ir.emphasis.length ? ir.emphasis : [longest]);

  const L_MAX = 8.5; // longest bar
  const BAR_H = 0.72;
  const DEPTH = 0.72;
  const PITCH = 1.18;
  const lenOf = (i) => Math.max(0.2, (Number(mag[i]) / mMax) * L_MAX);
  const top = ((N - 1) / 2) * PITCH;
  const yOf = (k) => top - k * PITCH; // rank k (0 = top)

  const introLead = introLeadOf();
  const holdEach = TEMPO.beatHold;

  const subjects = [];
  order.forEach((i, k) => {
    const L = lenOf(i);
    const y = yOf(k);
    const xc = -L / 2; // grows screen-right (-x)
    // STATIC (user-locked 2026-07-15): only the CAMERA animates. A bar that
    // slides in is the wrong length at every frame but the last — the chart
    // must match the source page's geometry the moment it is on screen.
    subjects.push({
      id: `hbar-${i}`,
      type: 'rounded_box',
      args: { dims: [L, BAR_H, DEPTH], cornerR: 0.05 },
      transform: { translate: [xc, y, 0] },
      material: monoMat(k, N, emphasis.has(i), opts.accent),
    });
  });
  // a baseline spine at x=0 (where every bar starts) + a back wall of guards
  subjects.push({
    id: 'baseline',
    type: 'box',
    args: { dims: [0.08, N * PITCH + 0.4, 0.3] },
    transform: { translate: [0.06, 0, -0.1] },
    material: { hue: 0.6, sat: 0.08, value: 0.5, kind: 'normal', roughness: 0.6 },
  });

  const rowH = N * PITCH;
  const D = Math.max(11, L_MAX * 1.05 + 3.5);
  const shots = [
    // establishing: the whole ranking, slightly high
    {
      duration: introLead,
      pos: [-L_MAX * 0.35, top + 1.2, D],
      target: [-L_MAX * 0.4, 0, 0],
      fov: 48,
      aperture: 0.14,
      focalDistance: D,
      ease: 'out',
    },
  ];
  // walk down the ranking, one bar per beat
  order.forEach((i, k) => {
    const L = lenOf(i);
    shots.push({
      duration: holdEach,
      pos: [-L * 0.5 + 0.5, yOf(k) + 0.5, D * 0.62],
      target: [-L * 0.5, yOf(k), 0],
      fov: 44,
      transition: 'blend',
      aperture: 0.2,
      focalDistance: D * 0.62,
      shake: 0.04,
      ease: 'smooth',
    });
  });
  // super: punch on the emphasis (longest) bar's tip
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0);
  const eL = lenOf(emphasisIdx);
  const eRank = order.indexOf(emphasisIdx);
  shots.push({
    duration: TEMPO.superHold,
    pos: [-eL + 0.6, yOf(eRank) + 0.3, 2.6],
    target: [-eL * 0.72, yOf(eRank), 0],
    fov: 44,
    transition: 'cut',
    beat: 'super',
    aperture: [0.8, 0.4],
    focalDistance: 2.8,
    shake: [0.4, 0.06],
    ambient: [0.2, 1.0],
    exposure: [1.15, 1.0],
    ease: 'out',
  });
  // payoff: the whole ranking in frame
  const payoffDist = (D + 1.5) * (env ? env.payoffZoom : 1);
  shots.push({
    duration: TEMPO.payoff,
    pos: [-L_MAX * 0.4, top + 1.6, payoffDist],
    target: [-L_MAX * 0.42, 0, 0],
    fov: 47,
    transition: 'blend',
    aperture: 0.12,
    focalDistance: payoffDist,
    ease: 'out',
  });

  const overlay = [
    {
      text: String(ir.title || nodes[longest]).toUpperCase(),
      anchor: [0, top + 1.5, 0],
      role: 'title',
    },
  ];
  const shortAxis = nodes.every((n) => String(n).trim().length <= 10);
  order.forEach((i, k) => {
    const L = lenOf(i);
    const y = yOf(k);
    const revealAt = introLead + k * holdEach + 0.35;
    // category name at the bar's LEFT start (the ranking axis, screen-left)
    overlay.push({
      text: nodes[i],
      anchor: [0.3, y, DEPTH * 0.5 + 0.15],
      role: shortAxis ? 'card' : 'screen',
      align: 'left',
      revealAt,
    });
    // value chip at the bar's right tip
    overlay.push({
      text: (ir.display && ir.display[i]) || String(mag[i]),
      anchor: [-L - 0.3, y, 0],
      role: 'value',
      radius: emphasis.has(i) ? 0.46 : 0.34,
      revealAt,
    });
  });
  const insight = deriveMagnitudeInsight(ir);
  const payoffStart = superAt + TEMPO.superHold;
  if (insight)
    overlay.push({
      text: insight.text,
      sub: insight.sub + (insight.note ? ` · ${insight.note}` : ''),
      role: 'insight',
      revealAt: payoffStart + 0.4,
    });
  if (ir.callout && ir.callout.text)
    overlay.push({
      text: String(ir.callout.text),
      sub: ir.callout.sub ? String(ir.callout.sub) : undefined,
      role: 'insight',
      revealAt: superAt + 0.25,
      hideAt: insight ? payoffStart + 0.4 : undefined,
    });

  return {
    v: 1,
    name: `(magnitude·horizontal) ${ir.title || nodes[longest]}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env
      ? env.defaults
      : { stage: { size: [Math.max(16, L_MAX + 8), Math.max(12, rowH + 4), 12] } },
  };
}

export function renderMagnitude(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderMagnitude: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'magnitude')
    throw new Error(`renderMagnitude: expected structure 'magnitude', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);
  // orientation:'horizontal' → ranked HORIZONTAL bars (categories top→bottom,
  // length ∝ value growing screen-right). The 2D source's horizontal bar chart
  // (rankings, long category names) reads natively this way; the vertical
  // monolith row is the default. Analytic-safe (boxes) — same fast tier.
  if (ir.orientation === 'horizontal') return renderHorizontalBars(ir, opts, env);

  const nodes = ir.nodes.map(label);
  const N = nodes.length;
  const mag = ir.magnitude;
  const mMax = Math.max(...mag.map((x) => Number(x) || 0), 1e-9);
  const order = ir.order && ir.order.length === N ? ir.order : nodes.map((_, i) => i);
  let tallest = 0;
  for (let i = 1; i < N; i++) if (mag[i] > mag[tallest]) tallest = i;
  const emphasisIdx = ir.emphasis && ir.emphasis.length ? ir.emphasis[0] : tallest;
  const emphasis = new Set(ir.emphasis && ir.emphasis.length ? ir.emphasis : [tallest]);

  // Row layout: equal footprints, height = linear encoding (honest comparison).
  // Dimensions come from the shared layout tokens (Layer B): the module system
  // owns footprint/gap/plinth; this renderer owns only the ENCODING (height ∝
  // magnitude) and the monumental register choice.
  const W = MODULE.unit; // monolith footprint
  const H_MAX = SCALE.monumental; // the champion TOWERS (analytic engine pays for it)
  const height = (i) => Math.max(0.12, (Number(mag[i]) / mMax) * H_MAX);
  // R2 (2D-similarity): studio +x renders screen-LEFT, so a straight
  // centeredRow(i) plays the years right-to-left — the mirror of the source
  // page. Flip the index: node 0 lands screen-left, reading order matches 2D.
  const xOf = (i) => centeredRow(N - 1 - i, N);

  // Tracking-beat timing: monolith i erupts as the camera's beat i begins.
  // Durations come from the shared tempo tokens (Layer B temporal half).
  const introLead = introLeadOf(); // hero + crane
  const holdEach = TEMPO.beatHold;
  const riseStart = (k) => introLead + k * holdEach - 0.45;

  const subjects = [];
  order.forEach((i, k) => {
    const H = height(i);
    const yFinal = H / 2; // box centre when standing on the floor
    // Plinth: a base slab each monolith stands ON — turns a floating box into
    // a mounted monument.
    subjects.push({
      id: `plinth-${i}`,
      type: 'box',
      args: { dims: [W + MODULE.plinthPad, MODULE.plinthH, W + MODULE.plinthPad] },
      transform: { translate: [xOf(i), MODULE.plinthH / 2, 0] },
      material: {
        hue: 0.58,
        sat: 0.1,
        value: 0.55,
        kind: 'normal',
        roughness: 0.6,
        clearcoat: 0.1,
      },
    });
    // STATIC (user-locked 2026-07-15): only the CAMERA animates — an erupting
    // monolith is the wrong height at every frame but the last.
    const craft = {
      id: `mono-${i}`,
      type: 'rounded_box', // beveled edges — a hewn stone, not a raw prim
      args: { dims: [W, H, W], cornerR: 0.045 },
      transform: { translate: [xOf(i), yFinal, 0] },
      material: monoMat(i, N, emphasis.has(i), opts.accent),
    };
    if (!emphasis.has(i)) craft.pattern = 'cracked'; // stone grain; the gold champion stays polished
    subjects.push(craft);
  });

  // Flanking stone rows: two receding lines of black slabs behind the row —
  // perspective guides converging on the data, and their long directional
  // shadows dress the floor for free (analytic soft shadows).
  const rowSpanG = rowSpanOf(N);
  for (let g = 0; g < 3; g++) {
    const gh = 2.2 + g * 1.3;
    // R2 (第三层深度): the nearest guard pair sits CAMERA-SIDE (z +1.2,
    // between lens and subject) — during the tracking walk it sweeps the
    // frame edge out of focus, buying parallax and physical presence; the
    // deeper pairs stay behind as the perspective guides.
    // Wave B: each PAIR is one subject with a mirror modifier (the symmetric
    // placement is data, not two hand-placed boxes).
    const fg = g === 0;
    subjects.push({
      id: `guard-${g}`,
      type: 'box',
      args: { dims: [0.9, gh, 0.5] },
      modifiers: [{ type: 'mirror', axis: 'x' }],
      transform: {
        translate: [
          rowSpanG / 2 + (fg ? 4.6 : 2.6 + g * 1.4), // R3: 3.4/z1.7 smeared bokeh blobs onto the columns at payoff
          gh / 2,
          fg ? 1.2 : -2.4 - g * 2.2,
        ],
        rotate: [0, 0.3, 0],
      },
      material: {
        hue: 0.62,
        sat: 0.25,
        value: 0.14,
        kind: 'normal',
        roughness: 0.5,
        clearcoat: 0.35,
      },
    });
  }

  // ---- camera: five beats, magnitude variation --------------------------------
  const rowSpan = rowSpanOf(N);
  const tallH = height(tallest);
  const gx = xOf(emphasisIdx);
  const gH = height(emphasisIdx);
  const shots = [
    // 1 — hero low angle at the tallest (the champion)
    {
      duration: TEMPO.hero,
      pos: [xOf(tallest) + 1.6, 0.5, 3.6],
      target: [xOf(tallest), tallH * 0.72, 0],
      fov: 54,
      aperture: 0.55, // hero: shallow focus on the subject
      focalDistance: 4,
      ease: 'out',
    },
    // 2 — crane over the lineup
    {
      duration: TEMPO.crane,
      pos: [0.6, tallH + 2.2, rowSpan * 0.5 + 2.6],
      target: [0, tallH * 0.45, 0],
      fov: 48,
      transition: 'blend',
      aperture: 0.3,
      focalDistance: rowSpan * 0.6 + 3,
      ease: 'inout',
    },
  ];
  // 3 — tracking shot along the row (low, close — the walk among giants)
  order.forEach((i) => {
    const x = xOf(i);
    const H = height(i);
    // R1 critique: the beat SELLS height but tall columns lost their tops and
    // value chips off-frame, with the crown out of focus. Keep the low intimate
    // camera (the compression IS the register contrast), but tilt UP at giants
    // (target rides to H*0.75), widen the lens, and focus on the column's
    // actual midpoint so the whole subject sits inside the depth of field.
    const tall = H > SCALE.intimate * 2;
    const posY = Math.min(SCALE.intimate, H * 0.55 + 0.35);
    const targetY = tall ? H * 0.75 : Math.max(H * 0.55, 0.5);
    shots.push({
      duration: holdEach,
      // camera rides the INTIMATE register during the walk-among-giants — the
      // scale contrast against SCALE.monumental is the "对比" operator itself
      pos: [x + 0.9, posY, 2.5],
      target: [x, targetY, 0],
      fov: tall ? 52 : 46,
      transition: 'blend',
      aperture: tall ? 0.16 : 0.25,
      focalDistance: Math.hypot(0.9, 2.5, Math.max(0, H / 2 - posY)),
      shake: 0.05,
      ease: 'smooth',
    });
  });
  // 4 — the super: at the emphasis monolith's base, looking UP its height
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0); // presentation time of the impact
  shots.push({
    duration: TEMPO.superHold,
    // R1 critique: title safe-area — the DOM title owns the top-left, so the
    // framing yields right and slightly down; the champion no longer wears
    // the headline across its face
    pos: [gx + 0.75 + rowSpan * 0.06, 0.22, 1.3],
    target: [gx + rowSpan * 0.06, gH * 0.85, 0],
    fov: 44,
    transition: 'cut',
    beat: 'super',
    aperture: [0.9, 0.45], // rack focus: the world falls away, the subject stays
    focalDistance: 1.8,
    shake: [0.5, 0.06], // impact-then-settle
    ambient: [0.15, 1.0], // spotlight crash: surroundings collapse on the hit, then recover
    exposure: [1.2, 1.0], // R1: 1.45 clipped the gold champion to cream — the DARK world sells the hit, not a blown subject
    ease: 'out',
  });
  // 5 — payoff pull-back: the whole skyline
  const payoffDist = (rowSpan * 0.85 + 3.2) * (env ? env.payoffZoom : 1);
  shots.push({
    duration: TEMPO.payoff,
    // title safe-area: shift the whole skyline right of the DOM headline and
    // keep the champion's crown off the frame's top edge
    pos: [1.2 + rowSpan * 0.12, tallH * 0.55 + 1.8 + (env ? 0.5 : 0), payoffDist],
    target: [rowSpan * 0.12, tallH * 0.38, 0],
    fov: 44,
    transition: 'blend',
    aperture: 0.12, // deep focus: the whole story stays sharp
    focalDistance: payoffDist,
    ease: 'out',
  });

  // labels: name card + value chip per monolith, revealed with its beat
  const overlay = [
    {
      text: String(ir.title || nodes[tallest]).toUpperCase(),
      anchor: [0, tallH + 1.3, 0],
      role: 'title',
    },
  ];
  // R1 — the floating INSIGHT layer ("数据在场,结论缺席" critique): the chart
  // finishes the derivation for the reader. Rules-first arithmetic on the
  // magnitude array (multiple / CAGR / share lead / retention), cited sources
  // in the sub line, revealed on the payoff beat when the whole row is in
  // frame for the first time.
  const payoffStart = superAt + TEMPO.superHold;
  const insight = deriveMagnitudeInsight(ir);
  if (insight) {
    overlay.push({
      text: insight.text,
      sub: insight.sub + (insight.note ? ` · ${insight.note}` : ''),
      role: 'insight',
      revealAt: payoffStart + 0.4,
    });
  }
  // ir.callout — page-critical text the structure can't encode (e.g. the
  // funding ASK next to the DAU target). Shown on the SUPER beat, yields to
  // the insight at payoff.
  if (ir.callout && ir.callout.text) {
    overlay.push({
      text: String(ir.callout.text),
      sub: ir.callout.sub ? String(ir.callout.sub) : undefined,
      role: 'insight',
      revealAt: superAt + 0.25,
      hideAt: insight ? payoffStart + 0.4 : undefined,
    });
  }
  // R3: SHORT axis labels (years, category codes ≤6 chars) bind to the WORLD
  // at the plinth's front edge — a 2D bar chart's year sits under its bar, and
  // the subtitle-column mapping made readers count rows. Sentences still go to
  // the subtitle column.
  const shortAxis = nodes.every((n) => String(n).trim().length <= 6);
  order.forEach((i, k) => {
    const x = xOf(i);
    const H = height(i);
    const revealAt = introLead + k * holdEach + 0.35;
    overlay.push({
      text: nodes[i],
      anchor: [x, -0.02, W * 0.5 + (shortAxis ? 0.6 : 0.35)],
      role: shortAxis ? 'card' : 'screen',
      revealAt,
    });
    overlay.push({
      // ir.display[i]: the human formatting of the number ("$240.5M") — IR
      // magnitude is a bare number for geometry, but the label must not lose
      // the 2D end's formatting (Rule 18-24: numbers are payload).
      text: (ir.display && ir.display[i]) || String(mag[i]),
      anchor: [x, H + 0.32, 0],
      role: 'value',
      radius: emphasis.has(i) ? 0.5 : 0.36,
      revealAt,
    });
  });

  return {
    v: 1,
    name: `(magnitude) ${ir.title || nodes[tallest]}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env ? env.defaults : { stage: { size: [Math.max(16, rowSpan + 6), 12, 12] } },
  };
}
