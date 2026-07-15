// sdf-js/src/scene/render-roadmap.js
// Structure renderer #9: roadmap → THE CLIMBING TIMELINE. Reads the IR ONLY.
//
// A roadmap / milestone timeline / product-evolution page becomes a line of
// dated nodes that CLIMB left→right: each milestone is a sphere lifted higher
// than the last, connected by capsule segments — the rising line reads as
// progress/growth (native for a milestone curve or a staged evolution). The
// camera travels the climb. All analytic primitives (sphere / capsule / box),
// so it stays on the fast zero-march tier. Reusable: any deck emitting
// structure:'roadmap' gets this — no per-page geometry.
//
// IR:
//   { structure:'roadmap',
//     title,
//     milestones: [ { date, label, detail? }, … ],
//     emphasis?: <index>,  callout? }
import { validateIR } from './ir.js';
import { getEnvironment } from './environments.js';

const NODE_R = 0.36;
const RAIL_Y = 1.2; // the timeline baseline height
const CLIMB = 0.62; // how much each milestone rises above the previous

const NODE_MAT = (emph, accent) =>
  emph
    ? {
        hue: 0.11,
        sat: 0.78,
        value: 0.95,
        glow: 0.1,
        kind: 'normal',
        roughness: 0.24,
        clearcoat: 0.6,
      }
    : accent
      ? {
          hue: accent.h,
          sat: accent.s * 0.9,
          value: Math.max(0.4, accent.v),
          kind: 'normal',
          roughness: 0.3,
          clearcoat: 0.45,
        }
      : { hue: 0.57, sat: 0.6, value: 0.78, kind: 'normal', roughness: 0.3, clearcoat: 0.45 };
const RAIL_MAT = { hue: 0.6, sat: 0.08, value: 0.5, kind: 'normal', roughness: 0.6 };
const SEG_MAT = { hue: 0.57, sat: 0.35, value: 0.7, glow: 0.06, kind: 'normal', roughness: 0.4 };

export function renderRoadmap(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderRoadmap: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'roadmap')
    throw new Error(`renderRoadmap: expected structure 'roadmap', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);

  const ms = Array.isArray(ir.milestones) ? ir.milestones : [];
  const N = ms.length;
  const emphasisIdx = Number.isInteger(ir.emphasis) ? ir.emphasis : N - 1;
  const stride = 2.9;
  // +x renders screen-LEFT → i=0 sits screen-left (time reads L→R)
  const xOf = (i) => ((N - 1) / 2 - i) * stride;
  const yOf = (i) => RAIL_Y + 0.5 + i * CLIMB; // the line climbs over time
  const span = (N - 1) * stride;

  const introLead = 1.6;
  const holdEach = 1.05;
  const riseAt = (i) => introLead + i * holdEach - 0.4;

  const subjects = [];

  // the base rail (a low horizontal groove the whole timeline sits on)
  subjects.push({
    id: 'rail',
    type: 'box',
    args: { dims: [span + stride, 0.1, 0.34] },
    transform: { translate: [0, RAIL_Y, 0] },
    material: RAIL_MAT,
  });

  // connector segments (node i → node i+1) — the rising line. Each is a capsule
  // between two node points; it rises with the LATER node's beat.
  for (let i = 0; i < N - 1; i++) {
    const a = [xOf(i), yOf(i), 0];
    const b = [xOf(i + 1), yOf(i + 1), 0];
    const t0 = riseAt(i + 1);
    subjects.push({
      id: `seg-${i}`,
      type: 'capsule',
      args: { a: [0, 0, 0], b: [b[0] - a[0], b[1] - a[1], b[2] - a[2]], radius: 0.06 },
      transform: { translate: a },
      material: SEG_MAT,
      animation: [
        {
          channel: 'transform.translate.y',
          expr: `${(a[1] - 1.1).toFixed(3)} + 1.100 * smoothstep(${t0.toFixed(2)}, ${(t0 + 0.5).toFixed(2)}, t)`,
        },
      ],
    });
  }

  ms.forEach((m, i) => {
    const x = xOf(i);
    const y = yOf(i);
    const t0 = riseAt(i);
    const emph = i === emphasisIdx;
    // post from the rail up to the node — the milestone stands on the timeline
    const postH = y - RAIL_Y;
    subjects.push({
      id: `post-${i}`,
      type: 'box',
      args: { dims: [0.1, postH, 0.1] },
      transform: { translate: [x, RAIL_Y + postH / 2, 0] },
      material: RAIL_MAT,
      animation: [
        {
          channel: 'transform.translate.y',
          expr: `${(RAIL_Y + postH / 2 - 1.1).toFixed(3)} + 1.100 * smoothstep(${t0.toFixed(2)}, ${(t0 + 0.5).toFixed(2)}, t)`,
        },
      ],
    });
    // the milestone node
    subjects.push({
      id: `node-${i}`,
      type: 'sphere',
      args: { radius: emph ? NODE_R * 1.35 : NODE_R },
      transform: { translate: [x, y, 0] },
      material: NODE_MAT(emph, opts.accent),
      animation: [
        {
          channel: 'transform.translate.y',
          expr: `${(y - 1.1).toFixed(3)} + 1.100 * smoothstep(${t0.toFixed(2)}, ${(t0 + 0.5).toFixed(2)}, t) + 0.02 * sin(1.1 * t + ${((i * 1.7) % 6.28).toFixed(2)})`,
        },
      ],
    });
  });

  // ---- labels: date on the rail, milestone label by the node ------------------
  const overlay = [
    {
      text: String(ir.title || 'Roadmap').toUpperCase(),
      anchor: [0, yOf(N - 1) + 1.4, 0],
      role: 'title',
    },
  ];
  ms.forEach((m, i) => {
    const x = xOf(i);
    const y = yOf(i);
    const revealAt = introLead + i * holdEach + 0.3;
    if (m.date)
      overlay.push({
        text: String(m.date),
        anchor: [x, RAIL_Y - 0.35, 0.25],
        role: 'card',
        align: 'center',
        revealAt,
      });
    // milestone label sits ABOVE its node (a diagram, not narration); the
    // diagonal climb spreads neighbours so they don't stack
    overlay.push({
      text: String(m.label || ''),
      anchor: [x, y + 0.6, 0.2],
      role: 'card',
      align: 'center',
      revealAt,
    });
  });

  // ---- camera: travel the climb -----------------------------------------------
  const D = Math.max(10, span * 0.55 + 6);
  const shots = [
    // establishing: low, looking up the whole rising line
    {
      duration: introLead,
      pos: [span * 0.28, RAIL_Y + 1.0, D],
      target: [0, yOf(Math.floor(N / 2)) - 0.3, 0],
      fov: 50,
      aperture: 0.12,
      focalDistance: D,
      ease: 'out',
    },
  ];
  ms.forEach((_, i) => {
    shots.push({
      duration: holdEach,
      pos: [xOf(i) * 0.6 + 0.6, yOf(i) + 0.4, D * 0.6],
      target: [xOf(i), yOf(i), 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.2,
      focalDistance: D * 0.6,
      shake: 0.04,
      ease: 'smooth',
    });
  });
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0);
  shots.push({
    duration: 1.0,
    pos: [xOf(emphasisIdx) + 0.5, yOf(emphasisIdx) + 0.3, 2.4],
    target: [xOf(emphasisIdx), yOf(emphasisIdx), 0],
    fov: 42,
    transition: 'cut',
    beat: 'super',
    aperture: [0.8, 0.4],
    focalDistance: 2.6,
    shake: [0.4, 0.06],
    ambient: [0.2, 1.0],
    exposure: [1.15, 1.0],
    ease: 'out',
  });
  const payoffDist = (D + 1.5) * (env ? env.payoffZoom : 1);
  shots.push({
    duration: 2.2,
    pos: [span * 0.12, yOf(N - 1) * 0.6 + 1.4, payoffDist],
    target: [0, yOf(Math.floor(N / 2)) - 0.2, 0],
    fov: 48,
    transition: 'blend',
    aperture: 0.12,
    focalDistance: payoffDist,
    ease: 'out',
  });

  if (ir.callout && ir.callout.text)
    overlay.push({
      text: String(ir.callout.text),
      sub: ir.callout.sub ? String(ir.callout.sub) : undefined,
      role: 'insight',
      revealAt: superAt + 0.25,
    });

  return {
    v: 1,
    name: `(roadmap) ${ir.title || 'timeline'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env ? env.defaults : { stage: { size: [Math.max(16, span + 8), 12, 12] } },
  };
}
