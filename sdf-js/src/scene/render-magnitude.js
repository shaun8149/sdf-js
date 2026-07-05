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

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

const monoMat = (i, N, emphasized) => {
  if (emphasized)
    return { hue: 0.11, sat: 0.78, value: 0.95, kind: 'normal', roughness: 0.22, clearcoat: 0.6 };
  const k = N > 1 ? i / (N - 1) : 0;
  return {
    hue: 0.55 + 0.09 * k,
    sat: 0.62 + 0.14 * k,
    value: 0.82 - 0.22 * k,
    kind: 'normal',
    roughness: 0.3,
    clearcoat: 0.45,
  };
};

export function renderMagnitude(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderMagnitude: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'magnitude')
    throw new Error(`renderMagnitude: expected structure 'magnitude', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);

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
  const W = 0.72; // monolith footprint
  const gapX = 0.55;
  const stride = W + gapX;
  const H_MAX = 3.4;
  const height = (i) => Math.max(0.12, (Number(mag[i]) / mMax) * H_MAX);
  const xOf = (i) => (i - (N - 1) / 2) * stride;

  // Tracking-beat timing: monolith i erupts as the camera's beat i begins.
  const introLead = 2.1; // hero 0.9 + crane 1.2
  const holdEach = 1.1;
  const riseStart = (k) => introLead + k * holdEach - 0.45;

  const subjects = [];
  order.forEach((i, k) => {
    const H = height(i);
    const yFinal = H / 2; // box centre when standing on the floor
    const buried = H + 0.3; // start fully underground, then erupt
    const t0 = Math.max(0.2, riseStart(k));
    const t1 = t0 + 0.6;
    subjects.push({
      id: `mono-${i}`,
      type: 'box',
      args: { dims: [W, H, W] },
      transform: { translate: [xOf(i), yFinal, 0] },
      material: monoMat(i, N, emphasis.has(i)),
      animation: [
        {
          channel: 'transform.translate.y',
          expr: `${(yFinal - buried).toFixed(3)} + ${buried.toFixed(3)} * smoothstep(${t0.toFixed(2)}, ${t1.toFixed(2)}, t)`,
        },
      ],
    });
  });

  // ---- camera: five beats, magnitude variation --------------------------------
  const rowSpan = (N - 1) * stride + W;
  const tallH = height(tallest);
  const gx = xOf(emphasisIdx);
  const gH = height(emphasisIdx);
  const shots = [
    // 1 — hero low angle at the tallest (the champion)
    {
      duration: 0.9,
      pos: [xOf(tallest) + 1.6, 0.5, 3.6],
      target: [xOf(tallest), tallH * 0.72, 0],
      fov: 54,
      aperture: 0.55, // hero: shallow focus on the subject
      focalDistance: 4,
      ease: 'out',
    },
    // 2 — crane over the lineup
    {
      duration: 1.2,
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
    shots.push({
      duration: holdEach,
      pos: [x + 0.9, Math.min(1.1, H * 0.55 + 0.35), 2.5],
      target: [x, Math.max(H * 0.55, 0.5), 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.25,
      focalDistance: 2.7,
      shake: 0.05,
      ease: 'smooth',
    });
  });
  // 4 — the super: at the emphasis monolith's base, looking UP its height
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0); // presentation time of the impact
  shots.push({
    duration: 1.0,
    pos: [gx + 0.75, 0.35, 1.35],
    target: [gx, gH * 0.85, 0],
    fov: 44,
    transition: 'cut',
    aperture: [0.9, 0.45], // rack focus: the world falls away, the subject stays
    focalDistance: 1.8,
    shake: [0.5, 0.06], // impact-then-settle
    exposure: [1.45, 1.0],
    ease: 'out',
  });
  // 5 — payoff pull-back: the whole skyline
  const payoffDist = (rowSpan * 0.85 + 3.2) * (env ? env.payoffZoom : 1);
  shots.push({
    duration: 2.4,
    pos: [1.2, tallH * 0.55 + 1.0 + (env ? 0.5 : 0), payoffDist],
    target: [0, tallH * 0.4, 0],
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
  order.forEach((i, k) => {
    const x = xOf(i);
    const H = height(i);
    const revealAt = introLead + k * holdEach + 0.35;
    overlay.push({
      text: nodes[i],
      anchor: [x, -0.02, W * 0.5 + 0.35],
      role: 'card',
      revealAt,
    });
    overlay.push({
      text: String(mag[i]),
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
