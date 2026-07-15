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
  } else if (ir.form === 'circles') {
    // CONCEPT CIRCLES — the source page draws N labelled circles side by side
    // (p7: 技术 / 世界 / 人). Three peer spheres in a row, EQUAL size (they are
    // peers, not a ranking), each naming its own idea. Reusable: any deck
    // emitting hold + form:'circles' gets this.
    const CR = 1.35;
    const CCY = 3.0;
    const gap = CR * 2 + 1.5;
    bullets.forEach((_, k) => {
      // +x renders screen-LEFT → k=0 sits screen-left (reading order L→R)
      const x = ((N - 1) / 2 - k) * gap;
      subjects.push({
        id: `circle-${k}`,
        type: 'sphere',
        args: { radius: CR },
        transform: { translate: [x, CCY, -1.0] },
        material: emphasis.has(k) ? GOLD_MAT : RED_MAT,
      });
    });
  } else {
    // CONTENTS — the source page-2 diagram, FLOATING AND UPRIGHT (user art
    // direction 2026-07-14: "一个半球悬空不是很帅吗?你把半球立起来"): a
    // hemisphere hangs in mid-air with its FLAT FACE toward screen-left —
    // from outside the screen it reads as the page's vertical half-disc —
    // and the six numbered balls ride its curved rim top → bottom, exactly
    // the original's ①…⑥ ladder. (cut-sphere is y-cut; roll +90° stands it
    // up — the analytic tier learned roll + cut-sphere for this shot.)
    const HR = 2.4; // hemisphere radius
    const HCY = 3.7; // float height of the hemisphere's centre
    subjects.push({
      id: 'dome',
      type: 'cut-sphere',
      args: { radius: HR, h: 0 },
      transform: { translate: [0.6, HCY, -1.2], rotate: [0, 0, Math.PI / 2] },
      material: { ...ROCK_MAT, roughness: 0.4 },
    });
    // balls on the curved rim, top → bottom down the screen-right side.
    // STATIC (user-locked 2026-07-15): only the CAMERA animates.
    const R = HR + 0.75;
    const E0 = 1.28; // rad above horizontal for ball ①  (~73°)
    bullets.forEach((_, k) => {
      const e = E0 - (k * (2 * E0)) / Math.max(1, N - 1); // ① top … ⑥ bottom
      const x = 0.6 - Math.cos(e) * R; // -x renders screen-RIGHT (the curved side)
      const y = HCY + Math.sin(e) * R;
      subjects.push({
        id: `orb-${k}`,
        type: 'sphere',
        args: { radius: 0.42 },
        transform: { translate: [x, y, -1.2] },
        material: emphasis.has(k) ? GOLD_MAT : RED_MAT,
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
  // STATIC (user-locked 2026-07-15): only the CAMERA animates.
  FLOATERS.forEach(([x, y, z, w, h], i) => {
    subjects.push(
      rock(`floater-${i}`, [x, y, z], [w, h, w * 0.55], ROCK_MAT, { rotate: [0, 0.5 * i - 1, 0] }),
    );
  });

  // ---- camera: three quiet beats ---------------------------------------------------
  const driftDur = Math.max(2.2, N * holdEach + 0.8);
  // concept circles: a flat row of peers — meet it square on, drift across it
  const circlesRow = ir.form === 'circles' ? (N - 1) * (1.35 * 2 + 1.5) + 2.7 : 0;
  // the frame is WIDE (16:9+), so the row's width is not the binding constraint
  // at this fov — a distance sized off the vertical fov parks the camera twice
  // as far as it needs and the circles read as buttons.
  const circlesD = Math.max(7, circlesRow * 0.68);
  const shots =
    ir.form === 'circles'
      ? [
          {
            duration: introLead,
            pos: [0.4, 3.2, circlesD + 0.8],
            target: [0, 3.0, -1.0],
            fov: 46,
            aperture: 0.2,
            focalDistance: circlesD + 0.8,
            ease: 'out',
          },
          {
            duration: driftDur,
            pos: [-1.2, 3.1, circlesD - 0.6],
            target: [0.2, 3.0, -1.0],
            fov: 46,
            transition: 'blend',
            aperture: 0.18,
            focalDistance: circlesD - 0.6,
            ease: 'smooth',
          },
          {
            duration: 2.0,
            pos: [0.2, 3.3, (circlesD + 1.2) * (env ? env.payoffZoom : 1)],
            target: [0, 3.0, -1.0],
            fov: 46,
            transition: 'blend',
            aperture: 0.12,
            focalDistance: circlesD + 1.2,
            ease: 'out',
          },
        ]
      : N === 0
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
            // contents: EYE-LEVEL with the FLOATING half-disc, straight in from
            // outside the screen — the page-2 composition hangs mid-air, so the
            // camera meets it at its heart (~y 3.4). Lateral drift only.
            {
              duration: introLead,
              pos: [0.3, 3.4, 8.8],
              target: [-0.6, 3.5, -1.2],
              fov: 46,
              aperture: 0.28,
              focalDistance: 9.8,
              ease: 'out',
            },
            {
              duration: driftDur,
              pos: [-1.7, 3.7, 7.9],
              target: [-0.4, 3.6, -1.2],
              fov: 46,
              transition: 'blend',
              aperture: 0.22,
              focalDistance: 9.0,
              ease: 'smooth',
            },
            {
              duration: 2.0,
              pos: [-0.4, 3.7, 9.4 * (env ? env.payoffZoom : 1)],
              target: [-0.6, 3.6, -1.2],
              fov: 45,
              transition: 'blend',
              aperture: 0.12,
              focalDistance: 10.4,
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
      anchor: [0, 7.1, -1.2],
      role: 'title',
    },
  ];
  const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  if (ir.form === 'circles') {
    // Each circle names its OWN idea — the text sits directly under the sphere
    // it belongs to (the user's "外圍做三塊文本"), never pooled in one column.
    const gap = 1.35 * 2 + 1.5;
    bullets.forEach((b, k) => {
      const x = ((N - 1) / 2 - k) * gap;
      overlay.push({
        text: b,
        anchor: [x, 3.0 - 1.35 - 0.55, -0.6],
        role: 'card',
        align: 'center',
        revealAt: introLead + k * holdEach + 0.25,
      });
      overlay.push({
        text: CIRCLED[k] || String(k + 1),
        anchor: [x, 3.0 + 1.35 + 0.45, -0.6],
        role: 'value',
        revealAt: introLead + k * holdEach + 0.3,
      });
    });
  } else
    bullets.forEach((b, k) => {
      // same rim math as the orbs (top → bottom down the curved right side)
      const e = 1.28 - (k * 2.56) / Math.max(1, N - 1);
      const x = 0.6 - Math.cos(e) * 3.15;
      const y = 3.7 + Math.sin(e) * 3.15;
      overlay.push({
        // The source page-2 lists its numbered items to the RIGHT of the
        // semicircle, beside their balls — the left column put the words on the
        // OPPOSITE side from the geometry they name (user-locked 2026-07-15).
        text: b,
        anchor: [x, y, -1.2],
        role: 'screen',
        side: 'right',
        revealAt: introLead + k * holdEach + 0.25,
      });
      // the source page numbers its balls — the digit rides ITS orb (anchor
      // layer: a label bound to geometry), landing right after the drop
      overlay.push({
        text: CIRCLED[k] || String(k + 1),
        anchor: [x, y + 0.66, -1.2],
        role: 'value',
        revealAt: introLead + k * holdEach + 0.3,
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
