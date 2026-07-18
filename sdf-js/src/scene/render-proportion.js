// sdf-js/src/scene/render-proportion.js
// Structure renderer #8: proportion → PIE ROW. Reads the IR ONLY.
//
// A share / breakdown / composition page (one or several pie charts) becomes a
// row of upright pie coins FACING THE CAMERA. Each pie is ONE analytic 'pie'
// subject — the analytic renderer colours its angular slices by baked palette
// (see render/analytic.js), so a colored pie is zero-march and fully reusable:
// any deck emitting structure:'proportion' gets analytic pies for free, no
// per-page geometry. This is the anti-"每次手搓" fix — the component lives once.
//
// IR:
//   { structure:'proportion',
//     title,
//     groups: [ { label, values:[…], sliceLabels:[…] }, … ],   // one pie each
//     emphasis?: <groupIndex>,  callout? }
import { validateIR } from './ir.js';
import { getEnvironment } from './environments.js';

// Categorical slice palette (0..1 RGB) — kept CONSISTENT across every pie in
// the row so the same category reads the same colour pie-to-pie (社交's 移动
// slice and 新闻's 移动 slice match). Data keeps its colour in the white world
// (baked in args.slices, so tone.js never whitens it — pies are data, like the
// blue magnitude bars).
const SLICE_PALETTE = [
  [0.2, 0.52, 0.88], // blue
  [0.96, 0.35, 0.32], // coral
  [0.36, 0.68, 0.24], // green
  [0.58, 0.42, 0.8], // purple
  [0.97, 0.66, 0.13], // amber
  [0.16, 0.68, 0.68], // teal
];

const R = 1.5; // pie radius
const THICK = 0.42;
const CY = 3.2; // pie centre float height

// values → cumulative slice descriptors {end, rgb} for the analytic pie type.
// opts.colors (per-group, optional): explicit [r,g,b] per slice to match a
// source page exactly (e.g. p27: 今日头条 coral, 百度 blue, 微信 green, 其他
// purple). Falls back to the shared categorical palette by slice index.
function buildSlices(values, colors) {
  const v = values.map((x) => Math.max(0, Number(x) || 0));
  const sum = v.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return v.map((x, i) => {
    acc += x / sum;
    const rgb =
      Array.isArray(colors) && Array.isArray(colors[i])
        ? colors[i]
        : SLICE_PALETTE[i % SLICE_PALETTE.length];
    return { end: Math.min(1, acc), rgb, frac: x / sum };
  });
}

export function renderProportion(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderProportion: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'proportion')
    throw new Error(`renderProportion: expected structure 'proportion', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);

  const groups = Array.isArray(ir.groups) ? ir.groups : [];
  const G = groups.length;
  const emphasis = Number.isInteger(ir.emphasis) ? ir.emphasis : G > 1 ? Math.floor(G / 2) : 0;
  const stride = 2 * R + 1.9;
  // +x renders screen-LEFT → g=0 sits screen-left (reading order L→R)
  const xOf = (g) => ((G - 1) / 2 - g) * stride;
  const rowSpan = (G - 1) * stride + 2 * R;

  const subjects = [];
  const overlay = [
    {
      text: String(ir.title || 'Proportion').toUpperCase(),
      anchor: [0, CY + R + 1.4, 0],
      role: 'title',
    },
  ];

  const introLead = 1.6;
  const holdEach = 1.15;

  groups.forEach((grp, g) => {
    const values = (grp.values || []).map((x) => Number(x) || 0);
    const slices = buildSlices(values, grp.colors);
    const x = xOf(g);
    // STATIC (user-locked 2026-07-15): only the CAMERA animates. A bobbing pie
    // never matches the source page's geometry at any given frame, and motion
    // under a moving camera splits the viewer's attention.
    subjects.push({
      id: `pie-${g}`,
      type: 'pie-chart',
      args: { radius: R, thickness: THICK, startAngle: Math.PI / 2, slices },
      transform: { translate: [x, CY, 0] },
      material: { hue: 0.58, sat: 0.2, value: 0.7, kind: 'normal', roughness: 0.4, clearcoat: 0.4 },
    });
    // a slim pedestal so the pie reads as STANDING in the room
    subjects.push({
      id: `pie-stem-${g}`,
      type: 'box',
      args: { dims: [0.34, CY - R - 0.1, 0.34] },
      transform: { translate: [x, (CY - R - 0.1) / 2, -0.1] },
      material: { hue: 0.6, sat: 0.05, value: 0.5, kind: 'normal', roughness: 0.6 },
    });

    // group label ABOVE the pie — the source page captions each pie on top
    // (2D-fidelity round 2: up/down must match the original)
    overlay.push({
      text: String(grp.label || ''),
      anchor: [x, CY + R + 0.5, 0],
      role: 'card',
      align: 'center',
      revealAt: introLead + g * holdEach + 0.2,
    });
    // slice % chips at each slice centroid on the disc face (clockwise from 12)
    const sliceLabels = grp.sliceLabels || [];
    let accStart = 0;
    slices.forEach((sl, si) => {
      const mid = accStart + sl.frac / 2; // 0..1 around the circle
      accStart += sl.frac;
      if (sl.frac < 0.06) return; // skip slivers — the chip would collide
      const ang = Math.PI / 2 - mid * 2 * Math.PI; // clockwise from 12 o'clock
      const rr = R * 0.58;
      const pct = Math.round(sl.frac * 100);
      // -Math.cos: the shader negates hp.x to sweep clockwise ON SCREEN, so a
      // slice at screen-angle `ang` sits at WORLD x = -R·cos(ang). The chip must
      // use the same flip or it points at the mirror-image wedge.
      overlay.push({
        text: sliceLabels[si] ? `${sliceLabels[si]} ${pct}%` : `${pct}%`,
        anchor: [x - Math.cos(ang) * rr, CY + Math.sin(ang) * rr, THICK / 2 + 0.05],
        role: 'value',
        revealAt: introLead + g * holdEach + 0.45,
      });
    });
  });

  // ---- camera: frontal read, calm dolly, payoff -------------------------------
  const D = Math.max(9, rowSpan * 0.82 + 3.2);
  const shots = [
    {
      duration: introLead,
      pos: [0.4, CY + 0.3, D + 0.6],
      target: [0, CY, 0],
      fov: 46,
      aperture: 0.22,
      focalDistance: D + 0.6,
      ease: 'out',
    },
  ];
  // dolly to each pie as it spins up (gentle — pies are calm)
  groups.forEach((_, g) => {
    shots.push({
      duration: holdEach,
      pos: [xOf(g) * 0.5, CY + 0.25, D - 0.8],
      target: [xOf(g), CY, 0],
      fov: 45,
      transition: 'blend',
      aperture: 0.2,
      focalDistance: D - 0.8,
      ease: 'smooth',
    });
  });
  // super: a soft push on the emphasis pie (keeps the deck's beat rhythm, no
  // aggressive crash — proportion reads calm)
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0);
  shots.push({
    duration: 1.0,
    pos: [xOf(emphasis) + 0.4, CY + 0.2, D * 0.45],
    target: [xOf(emphasis), CY, 0],
    fov: 42,
    transition: 'blend',
    beat: 'super',
    aperture: [0.5, 0.28],
    focalDistance: D * 0.45,
    shake: [0.18, 0.05],
    ease: 'out',
  });
  shots.push({
    duration: 2.0,
    pos: [0.3, CY + 0.6, (D + 1.0) * (env ? env.payoffZoom : 1)],
    target: [0, CY - 0.1, 0],
    fov: 46,
    transition: 'blend',
    aperture: 0.12,
    focalDistance: D + 1.0,
    ease: 'out',
  });

  if (ir.callout && ir.callout.text) {
    overlay.push({
      text: String(ir.callout.text),
      sub: ir.callout.sub ? String(ir.callout.sub) : undefined,
      role: 'insight',
      revealAt: superAt + 0.2,
    });
  }

  return {
    v: 1,
    name: `(proportion) ${ir.title || 'pies'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.12 }] },
    defaults: env ? env.defaults : { stage: { size: [Math.max(16, rowSpan + 6), 12, 12] } },
  };
}
