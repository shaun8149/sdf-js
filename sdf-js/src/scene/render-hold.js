// sdf-js/src/scene/render-hold.js
// Structure renderer #6: hold → TITLE CARD. Reads the IR ONLY (never 2D x/y).
//
// A hold page has no chartable structure — a cover, a narration beat, a product
// tour. In a deck it is the interlude between arenas: the world quiets down,
// one monument holds the frame, and the SPEAKER carries the content. So the
// geometry is deliberately minimal (a stele + one gold band + a pip per
// bullet) and all narrative text rides the DOM overlay (two-text-systems rule:
// only geometry-bound data labels ever go into the SDF).
//
// Fighting-game grammar, hold variation — the INTERLUDE:
//   1. slow push-in on the stele (the breath between rounds)
//   2. lateral drift while bullet pips drop in one per beat
//   3. payoff pull-back (auto-tagged 'station' by the renderIR seam)
// No super — hold pages never punch; they set up the next station's hit.
import { validateIR } from './ir.js';
import { getEnvironment } from './environments.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

const pipMat = (emphasized) =>
  emphasized
    ? {
        hue: 0.11,
        sat: 0.78,
        value: 0.95,
        metal: 0,
        glow: 0.22,
        kind: 'normal',
        roughness: 0.22,
        clearcoat: 0.6,
      }
    : {
        hue: 0.58,
        sat: 0.55,
        value: 0.8,
        kind: 'normal',
        roughness: 0.3,
        clearcoat: 0.45,
      };

export function renderHold(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderHold: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'hold')
    throw new Error(`renderHold: expected structure 'hold', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);

  const bullets = (ir.nodes || []).map(label).filter(Boolean);
  const N = bullets.length;
  const emphasis = new Set(ir.emphasis || []);

  // ---- geometry: stele + gold band + bullet pips -------------------------------
  // The stele stands left-of-centre so the bullet column (camera right) shares
  // the frame instead of hiding behind it. Static on purpose — the anchor of a
  // narration beat must not fidget.
  const steleX = N > 0 ? -1.3 : 0;
  const subjects = [
    {
      id: 'plinth',
      type: 'box',
      args: { dims: [2.6, 0.14, 1.1] },
      transform: { translate: [steleX, 0.07, 0] },
      material: { hue: 0.58, sat: 0.1, value: 0.55, kind: 'normal', roughness: 0.6 },
    },
    {
      id: 'stele',
      type: 'rounded_box',
      args: { dims: [2.1, 2.5, 0.16], cornerR: 0.05 },
      transform: { translate: [steleX, 1.39, 0] },
      material: {
        hue: 0.62,
        sat: 0.45,
        value: 0.34,
        kind: 'normal',
        roughness: 0.26,
        clearcoat: 0.55,
      },
    },
    {
      // gold band near the stele's crown — the 3D "title underline"
      id: 'band',
      type: 'box',
      args: { dims: [2.1, 0.07, 0.18] },
      transform: { translate: [steleX, 2.28, 0] },
      material: {
        hue: 0.11,
        sat: 0.78,
        value: 0.95,
        glow: 0.25,
        kind: 'normal',
        roughness: 0.2,
        clearcoat: 0.6,
      },
    },
  ];

  // Bullet pips: a floating column at camera-right, one dropping in per beat.
  // Drop (not erupt) — items arriving from above read as points being SET DOWN
  // on the argument, and the drop shape is assembleDeck-transplant safe.
  const pipX = 0.9;
  const pipTopY = 1.1 + N * 0.28;
  const introLead = 2.2; // the hero push-in
  const holdEach = 1.0;
  bullets.forEach((_, k) => {
    const y = pipTopY - k * 0.56;
    const drop = 0.5;
    const t0 = introLead + k * holdEach - 0.35;
    const t1 = t0 + 0.5;
    subjects.push({
      id: `pip-${k}`,
      type: 'rounded_box',
      args: { dims: [0.3, 0.3, 0.3], cornerR: 0.09 },
      transform: { translate: [pipX, y, 0] },
      material: pipMat(emphasis.has(k)),
      animation: [
        {
          channel: 'transform.translate.y',
          expr: `${(y + drop).toFixed(3)} - ${drop.toFixed(3)} * smoothstep(${t0.toFixed(2)}, ${t1.toFixed(2)}, t)`,
        },
      ],
    });
  });

  // ---- camera: three quiet beats ------------------------------------------------
  const driftDur = Math.max(2.2, N * holdEach + 0.8);
  const shots = [
    {
      duration: introLead,
      pos: [steleX + 0.9, 1.5, 5.6],
      target: [steleX + (N > 0 ? 0.7 : 0), 1.5, 0],
      fov: 46,
      aperture: 0.4,
      focalDistance: 5.2,
      ease: 'out',
    },
    {
      duration: driftDur,
      pos: [steleX - 1.4, 1.8, 5.0],
      target: [N > 0 ? (steleX + pipX) / 2 + 0.4 : steleX, 1.5, 0],
      fov: 44,
      transition: 'blend',
      aperture: 0.3,
      focalDistance: 5.0,
      ease: 'smooth',
    },
    {
      duration: 2.0,
      pos: [steleX + 0.6, 2.1, 6.8 * (env ? env.payoffZoom : 1)],
      target: [steleX + (N > 0 ? 0.8 : 0), 1.4, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.14,
      focalDistance: 6.8,
      ease: 'out',
    },
  ];

  // ---- overlay: title on the stele, one card per bullet -------------------------
  const overlay = [
    {
      text: String(ir.title || bullets[0] || ''),
      anchor: [steleX, 3.0, 0],
      role: 'title',
    },
  ];
  bullets.forEach((b, k) => {
    overlay.push({
      text: b,
      anchor: [pipX + 0.35, pipTopY - k * 0.56, 0],
      role: 'card',
      revealAt: introLead + k * holdEach + 0.25,
    });
  });

  return {
    v: 1,
    name: `(hold) ${ir.title || 'interlude'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots },
    defaults: env ? env.defaults : { stage: { size: [14, 10, 10] } },
  };
}
