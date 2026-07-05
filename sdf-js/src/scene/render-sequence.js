// sdf-js/src/scene/render-sequence.js
// Structure renderer #1: sequence → funnel. Reads the IR ONLY (never 2D x/y).
// The "time dimension": camera fly-through + per-stage build-in (each stage is its OWN
// subject that drops into place via a transform.translate.y smoothstep window, staggered
// by order — needs the expr builtins from #193) + revealAt-tagged overlay labels.
import { validateIR } from './ir.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

// area-proportional boundary radii (sqrt of magnitude), plus a tip. Length N+1.
export function magnitudeToRadii(magnitude, maxR = 1.4, tipR = 0.12) {
  const m = (magnitude || []).map((x) => Math.max(0, Number(x) || 0));
  const mMax = Math.max(...m, 1);
  const r = m.map((x) => Math.max(tipR, maxR * Math.sqrt(x / mMax)));
  r.push(tipR); // converge to a tip below the last stage
  return r;
}

const DEFAULT_MAT = {
  hue: 0.04,
  sat: 0.72,
  value: 0.82,
  kind: 'normal',
  roughness: 0.3,
  clearcoat: 0.45,
};

export function renderSequence(ir) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderSequence: invalid IR — ${v.errors.join('; ')}`);

  const nodes = ir.nodes.map(label);
  const N = nodes.length;
  const mag = ir.magnitude || nodes.map(() => 1);
  const order = ir.order && ir.order.length === N ? ir.order : nodes.map((_, i) => i);
  const emphasis = new Set(ir.emphasis || [N - 1]);

  const stageHeight = 0.55,
    gap = 0.12;
  const radii = magnitudeToRadii(mag, 1.4, 0.12);
  const totalH = N * stageHeight + (N - 1) * gap;
  const topY = 1.6 + totalH / 2; // funnel centred around y≈1.6
  const stageY = (i) => topY - stageHeight / 2 - i * (stageHeight + gap); // centre Y of stage i
  const holdEach = 1.2; // seconds between successive stage reveals
  const drop = 0.9; // stage starts this far above its slot, then drops in

  // ONE subject per stage (a single-band frustum) so each builds in independently.
  // build-in: translate.y from (yc + drop) → yc over [revealStart, revealEnd], then holds.
  // The translate.y channel REPLACES the static y (applyTransform resolveVec3Field), so the
  // expr must produce the FULL y. Reveal windows stagger by the node's position in `order`.
  const subjects = [];
  order.forEach((i, k) => {
    const yc = stageY(i);
    const revealStart = 0.2 + k * holdEach;
    const revealEnd = revealStart + 0.7;
    const yFull = (yc + drop).toFixed(3);
    subjects.push({
      id: `stage-${i}`,
      type: 'funnel-3d',
      args: { stages: 1, radii: [radii[i], radii[i + 1]], stageHeight, gap: 0 },
      transform: { translate: [0, yc, 0] },
      material: { ...DEFAULT_MAT, value: emphasis.has(i) ? 0.9 : 0.72 },
      animation: [
        {
          channel: 'transform.translate.y',
          expr: `${yFull} - ${drop} * smoothstep(${revealStart.toFixed(2)}, ${revealEnd.toFixed(2)}, t)`,
        },
      ],
    });
  });

  // fly-through: start above the mouth, descend through the axis to the emphasis stage.
  const shots = [
    {
      duration: 0.01,
      pos: [0.6, topY + 2.4, 6.2],
      target: [0, topY, 0],
      fov: 52,
      aperture: 0,
      focalDistance: 6,
      ease: 'smooth',
    },
  ];
  for (let i = 0; i < N; i++) {
    const y = stageY(i);
    shots.push({
      duration: holdEach,
      pos: [0, y + 0.9, Math.max(2.6, radii[i] * 3.2 + 2.2)],
      target: [0, y, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0,
      focalDistance: 4,
      ease: 'smooth',
    });
  }

  // labels → overlay, reveal-tagged just after each stage settles.
  const overlay = [
    { text: String(ir.title || nodes[0]).toUpperCase(), anchor: [0, topY + 1.4, 0], role: 'title' },
  ];
  order.forEach((i, k) => {
    const y = stageY(i);
    const revealAt = 0.2 + k * holdEach + 0.5; // just after this stage's build-in
    overlay.push({
      text: nodes[i],
      anchor: [radii[i] + 0.5, y, 0],
      role: 'card',
      align: 'left',
      revealAt,
    });
    overlay.push({
      text: String(mag[i]),
      anchor: [0, y, radii[i] + 0.2],
      role: 'value',
      radius: emphasis.has(i) ? 0.5 : 0.36,
      revealAt,
    });
  });

  return {
    v: 1,
    name: `(sequence) ${ir.title || 'funnel'}`,
    subjects,
    overlay,
    cameraSequence: { loop: false, shots },
    defaults: { stage: { size: [16, 12, 11] } },
  };
}

// IR → 2D funnel atom args (for the flat counterpart / blind test)
export function renderSequence2d(ir) {
  const nodes = ir.nodes.map(label);
  const mag = ir.magnitude || nodes.map(() => 1);
  return {
    type: 'funnel',
    args: { title: ir.title || '', stages: nodes.map((n, i) => ({ label: n, value: mag[i] })) },
  };
}
