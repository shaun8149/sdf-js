// sdf-js/src/scene/render-hold.js
// Structure renderer #6: hold → BLACK MONOLITH FIELD. Reads the IR ONLY.
//
// A hold page has no chartable structure — a cover, a narration beat, a product
// tour. Division of labour (user-locked 2026-07-11): the 3D world TELLS THE
// STORY and never carries sentences — narrative text lives on the screen-space
// stage layer (figure-core renders `title`/`screen` overlay roles as big 2D
// typography). What the world contributes here is PRESENCE: a black rock
// monolith as the title's backdrop, one smaller black stone per bullet (the
// COUNT is geometry even when the words are not), and a loose field of the
// same black rocks floating in the distance — the visual motif of the deck.
//
// Fighting-game grammar, hold variation — the INTERLUDE:
//   1. slow push-in on the title monolith (the breath between rounds)
//   2. drift as the bullet stones drop in one per beat
//   3. payoff pull-back (auto-tagged 'station' by the renderIR seam)
// No super — hold pages never punch; they set up the next station's hit.
import { validateIR } from './ir.js';
import { getEnvironment } from './environments.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

// Black rock: near-black, matte-leaning, cracked stone grain. The gold variant
// marks the emphasized bullet's stone.
const ROCK_MAT = {
  hue: 0.62,
  sat: 0.25,
  value: 0.17,
  kind: 'normal',
  roughness: 0.42,
  clearcoat: 0.5,
};
const GOLD_MAT = {
  hue: 0.11,
  sat: 0.78,
  value: 0.95,
  glow: 0.22,
  kind: 'normal',
  roughness: 0.22,
  clearcoat: 0.6,
};

const rock = (id, [x, y, z], [w, h, d], material, extra = {}) => {
  const s = {
    id,
    type: 'rounded_box',
    args: { dims: [w, h, d], cornerR: 0.06 },
    transform: { translate: [x, y, z], ...(extra.rotate ? { rotate: extra.rotate } : {}) },
    material,
  };
  if (material !== GOLD_MAT) s.pattern = 'cracked'; // stone grain; gold stays polished
  if (extra.animation) s.animation = extra.animation;
  return s;
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
  const introLead = 2.2;
  const holdEach = 1.0;

  // ---- geometry ------------------------------------------------------------------
  // Title monolith: the big black rock the title reads against. Offset right —
  // the stage layer's bullet column owns the LEFT of the screen (+x renders
  // screen-left, so the rock sits at negative x... the studio's +x→screen-left
  // mirror strikes again; -x is screen-RIGHT).
  const mx = N > 0 ? -2.3 : 0;
  const subjects = [rock('mono-title', [mx, 2.1, -1.2], [4.4, 2.6, 0.6], ROCK_MAT)];

  // Bullet stones: one black stone per bullet, a rising diagonal past the title
  // monolith — the COUNT of points is world-geometry even though the words are
  // screen typography. Each drops in on its beat (transplant-safe smoothstep)
  // and hangs with a slow idle bob (the "floating rocks" read).
  bullets.forEach((_, k) => {
    const x = mx - 1.7 - k * 0.85; // -x is screen-RIGHT: the stone line rises away from the monolith
    const y = 1.3 + k * 0.45;
    const z = 0.2 - k * 0.7;
    const drop = 0.7;
    const t0 = introLead + k * holdEach - 0.35;
    const t1 = t0 + 0.55;
    const phase = (k * 1.7) % 6.28;
    subjects.push(
      rock(`stone-${k}`, [x, y, z], [0.62, 0.42, 0.5], emphasis.has(k) ? GOLD_MAT : ROCK_MAT, {
        rotate: [0, 0.22 * (k % 2 === 0 ? 1 : -1), 0],
        animation: [
          {
            channel: 'transform.translate.y',
            expr: `${(y + drop).toFixed(3)} - ${drop.toFixed(3)} * smoothstep(${t0.toFixed(2)}, ${t1.toFixed(2)}, t) + 0.05 * sin(0.6 * t + ${phase.toFixed(2)})`,
          },
        ],
      }),
    );
  });

  // Distant floaters: the same black rock, scattered mid-air far behind and
  // beside the stage — the motif that makes the world read as one place. All
  // share the slow bob; deterministic layout from index math (no randomness).
  const FLOATERS = [
    [-6.5, 3.4, -6, 1.6, 0.9],
    [4.8, 2.6, -7.5, 1.2, 0.7],
    [-3.2, 4.6, -9, 2.2, 1.1],
    [7.2, 4.0, -5, 0.9, 0.55],
    [1.5, 5.2, -11, 1.8, 0.95],
  ];
  FLOATERS.forEach(([x, y, z, w, h], i) => {
    subjects.push(
      rock(`floater-${i}`, [x, y, z], [w, h, w * 0.55], ROCK_MAT, {
        rotate: [0, 0.5 * i - 1, 0],
        animation: [
          {
            channel: 'transform.translate.y',
            expr: `${y.toFixed(3)} - 0.000 * smoothstep(0.00, 1.00, t) + ${(0.07 + 0.02 * i).toFixed(2)} * sin(${(0.35 + 0.08 * i).toFixed(2)} * t + ${((i * 2.1) % 6.28).toFixed(2)})`,
          },
        ],
      }),
    );
  });

  // ---- camera: three quiet beats ---------------------------------------------------
  const driftDur = Math.max(2.2, N * holdEach + 0.8);
  const shots = [
    {
      duration: introLead,
      pos: [mx + 0.6, 2.0, 5.8],
      target: [mx, 2.1, 0],
      fov: 44,
      aperture: 0.35,
      focalDistance: 6.4,
      ease: 'out',
    },
    {
      duration: driftDur,
      pos: [mx - 1.8, 2.3, 5.2],
      target: [mx + (N > 0 ? 1.0 : 0), 1.9, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.26,
      focalDistance: 5.6,
      ease: 'smooth',
    },
    {
      duration: 2.0,
      pos: [mx + 0.8, 2.8, 8.2 * (env ? env.payoffZoom : 1)],
      target: [mx, 2.2, -1],
      fov: 46,
      transition: 'blend',
      aperture: 0.12,
      focalDistance: 8.6,
      ease: 'out',
    },
  ];

  // ---- overlay: narrative → the stage layer ------------------------------------------
  // title/screen roles are STAGE items — figure-core renders them as pure 2D
  // typography (huge title, bullet column). anchor is kept only as a fallback
  // for hosts without the stage layer.
  const overlay = [
    {
      text: String(ir.title || bullets[0] || ''),
      anchor: [mx, 3.6, -1.2],
      role: 'title',
    },
  ];
  bullets.forEach((b, k) => {
    overlay.push({
      text: b,
      anchor: [mx - 1.7 - k * 0.85, 1.3 + k * 0.45, 0.2 - k * 0.7],
      role: 'screen',
      revealAt: introLead + k * holdEach + 0.25,
    });
  });

  return {
    v: 1,
    name: `(hold) ${ir.title || 'interlude'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots },
    defaults: env ? env.defaults : { stage: { size: [16, 12, 12] } },
  };
}
