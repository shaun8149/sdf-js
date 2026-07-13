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
  value: 0.1, // near-black even under the direct key — the monolith stays a void
  kind: 'normal',
  roughness: 0.48,
  clearcoat: 0.45,
};
const RED_MAT = {
  hue: 0.995,
  sat: 0.85,
  value: 0.78,
  glow: 0.12,
  kind: 'normal',
  roughness: 0.3,
  clearcoat: 0.5,
};
const GOLD_MAT = {
  hue: 0.11,
  sat: 0.78,
  value: 0.95,
  glow: 0.1,
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
  // NOTE: no 'cracked' pattern — on near-black rock the grain is invisible
  // but applyPattern still burns per-pixel ALU on every leaf. Texture comes
  // from roughness/clearcoat under the rig instead.
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
  const mx = N > 0 ? 0 : 0;
  const subjects = [];

  if (N === 0) {
    // COVER — the monolith forest (user art direction): the 2001 title slab
    // up front, then rank after rank of TALLER black monoliths receding into
    // the haze. Depth is the awe: each rank grows and darkens into distance.
    subjects.push(rock('mono-title', [0, 2.7, -1.4], [2.4, 5.4, 0.6], ROCK_MAT));
    for (let rank = 0; rank < 4; rank++) {
      const z = -6 - rank * 6.5;
      const h = 8 + rank * 3.5; // taller as they recede — the skyline climbs
      for (const side of [-1, 1]) {
        for (let j = 0; j < 2; j++) {
          const x = side * (3.4 + j * 3.0 + rank * 1.1);
          subjects.push(
            rock(
              `forest-${rank}-${side < 0 ? 'l' : 'r'}${j}`,
              [x, h / 2, z - j * 2.2],
              [1.6 + rank * 0.35, h + j * 1.6, 0.7],
              ROCK_MAT,
              { rotate: [0, side * (0.12 + 0.08 * j), 0] },
            ),
          );
        }
      }
    }
  } else {
    // CONTENTS — the source deck's cover diagram, translated to 3D (user art
    // direction): one great black dome half-buried at centre, six red orbs
    // strung along a 180° arc facing the camera, one landing per beat. The
    // six lines of text ride the subtitle column only — no floor captions.
    subjects.push({
      id: 'dome',
      type: 'sphere',
      args: { radius: 2.6 },
      transform: { translate: [0, 0, -1.2] },
      material: { ...ROCK_MAT, roughness: 0.4 },
    });
    const R = 4.1;
    // R2 critique ("米奇耳朵"): orbs at y 0.62 projected tangent to the dome's
    // crown — two shapes counting as one blob. Lift them to a clean SATELLITE
    // RING (y 2.2) with edge padding so the perspective never overlaps the end
    // orbs, and give each a glowing stem: "the core radiates six points" now
    // reads in geometry, not just in subtitles.
    const ORB_Y = 2.2;
    const PAD = 0.35; // rad — end-orb breathing room against perspective overlap
    bullets.forEach((_, k) => {
      const a = PAD + ((Math.PI - 2 * PAD) * (k + 0.5)) / N; // padded sweep, screen left → right
      const x = Math.cos(a) * R;
      const z = -1.2 + Math.sin(a) * R * 0.3; // R3: 0.85 depth blew end orbs into frame-clipping balloons
      const drop = 1.6;
      const t0 = introLead + k * holdEach - 0.35;
      const t1 = t0 + 0.55;
      subjects.push({
        id: `orb-${k}`,
        type: 'sphere',
        args: { radius: 0.42 },
        transform: { translate: [x, ORB_Y, z] },
        material: emphasis.has(k) ? GOLD_MAT : RED_MAT,
        animation: [
          {
            channel: 'transform.translate.y',
            expr: `${(ORB_Y + drop).toFixed(3)} - ${drop.toFixed(3)} * smoothstep(${t0.toFixed(2)}, ${t1.toFixed(2)}, t) + 0.04 * sin(0.6 * t + ${((k * 1.7) % 6.28).toFixed(2)})`,
          },
        ],
      });
      // the stem: a faint vertical light column under each landing point
      // (yaw-free capsule — stays inside the analytic renderer's support set)
      subjects.push({
        id: `orb-stem-${k}`,
        type: 'capsule',
        args: { radius: 0.05, height: ORB_Y - 0.6 },
        transform: { translate: [x, (ORB_Y - 0.3) / 2 + 0.15, z] },
        material: { hue: 0.995, sat: 0.15, value: 0.8, glow: 0.5, kind: 'normal', roughness: 0.4 }, // R3: light, not a pink plastic stick
      });
    });
  }

  // Distant floaters: the same black rock, scattered mid-air far behind and
  // beside the stage — the motif that makes the world read as one place. All
  // share the slow bob; deterministic layout from index math (no randomness).
  const FLOATERS = [
    [-6.5, 3.4, -6, 1.6, 0.9],
    [4.8, 2.6, -7.5, 1.2, 0.7],
    [-3.2, 4.6, -9, 2.2, 1.1],
    [7.2, 4.0, -5, 0.9, 0.55],
    [-9.5, 5.8, -12, 2.6, 1.4],
    [10.5, 5.2, -10, 1.9, 1.0],
    [2.2, 7.0, -14, 3.1, 1.6],
    [-5.8, 6.4, -16, 2.4, 1.2],
    [6.8, 2.0, -13, 1.1, 0.6],
  ];
  if (N > 0) FLOATERS.length = 0; // contents page: the dome owns the stage
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
  const shots =
    N === 0
      ? [
          // cover: ground-level, looking up the title slab with the forest
          // skyline climbing behind it
          {
            duration: introLead,
            pos: [2.8, 1.0, 8.6],
            target: [0, 3.1, -1.4],
            fov: 44,
            aperture: 0.35,
            focalDistance: 9.2,
            ease: 'out',
          },
          {
            duration: driftDur,
            pos: [-2.4, 1.6, 7.2],
            target: [0.4, 4.2, -8],
            fov: 46,
            transition: 'blend',
            aperture: 0.26,
            focalDistance: 9.5,
            ease: 'smooth',
          },
          {
            duration: 2.0,
            pos: [0.8, 2.6, 9.6 * (env ? env.payoffZoom : 1)],
            target: [0, 3.4, -6],
            fov: 46,
            transition: 'blend',
            aperture: 0.12,
            focalDistance: 11.0,
            ease: 'out',
          },
        ]
      : [
          // contents: settle level with the satellite ring — target rides at
          // ring height so the horizon sits on the lower third (R2: the old
          // high-drift framing wasted the bottom 45% on empty platform)
          {
            duration: introLead,
            pos: [0.5, 2.0, 8.8],
            target: [0, 1.3, 0.6],
            fov: 46,
            aperture: 0.3,
            focalDistance: 8.6,
            ease: 'out',
          },
          {
            duration: driftDur,
            pos: [-1.6, 2.5, 7.6],
            target: [0.3, 1.5, 0.4],
            fov: 46,
            transition: 'blend',
            aperture: 0.24,
            focalDistance: 8.0,
            ease: 'smooth',
          },
          {
            duration: 2.0,
            pos: [0.6, 3.6, 9.6 * (env ? env.payoffZoom : 1)],
            target: [0, 1.1, -0.4],
            fov: 44,
            transition: 'blend',
            aperture: 0.12,
            focalDistance: 10.0,
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
      anchor: [0, 3.6, -1.2],
      role: 'title',
    },
  ];
  bullets.forEach((b, k) => {
    const a = (Math.PI * (k + 0.5)) / N;
    overlay.push({
      text: b,
      anchor: [Math.cos(a) * 4.1, 0.62, -1.2 + Math.sin(a) * 4.1 * 0.85],
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
