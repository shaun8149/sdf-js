// sdf-js/src/scene/render-matrix.js
// Structure renderer #5: matrix → the QUADRANT WALL. Reads the IR ONLY.
//
// Matrix is the one structure where 3D must stay HUMBLE: a 2-axis classification
// is natively flat (the stage-idiom ledger's "3D ties or loses" list), so the
// native form is an upright grid WALL facing the camera — a war-room board on
// the stage — not a forced volume. What 3D adds is presentation: items SLAM onto
// the board one by one (build-in), the camera walks the cells, and the emphasis
// item gets the punch-in. Honest layout, theatrical delivery.
//
// Fighting-game grammar, matrix variation — the BRIEFING BOARD:
//   1. establishing — the whole empty board, axes readable
//   2. items slam on cell by cell (order), camera tracks the drops loosely
//   3. the SUPER — punch-in at the emphasis item + shake
//   4. payoff pull-back — the filled board in one frame
import { validateIR } from './ir.js';
import { getEnvironment } from './environments.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

const TILE_MAT = { hue: 0.6, sat: 0.1, value: 0.3, kind: 'normal', roughness: 0.7, clearcoat: 0.1 };
const itemMat = (emphasized, accent) =>
  emphasized
    ? {
        hue: 0.11,
        sat: 0.78,
        value: 0.95,
        glow: 0.1,
        kind: 'normal',
        roughness: 0.22,
        clearcoat: 0.6,
      }
    : accent
      ? {
          hue: accent.h,
          sat: accent.s,
          value: Math.max(0.32, accent.v * 0.85),
          kind: 'normal',
          roughness: 0.3,
          clearcoat: 0.45,
        }
      : { hue: 0.57, sat: 0.55, value: 0.72, kind: 'normal', roughness: 0.3, clearcoat: 0.45 };

// ---- evolution form ------------------------------------------------------------
// A matrix whose X axis is a two-state TIME axis (past → present) reads better
// as the source diagram it usually comes from: the PAST as grounded blocks,
// the PRESENT as red orbs floating above, one rising trail per dimension.
// Opt-in via ir.form === 'evolution' (needs exactly 2 x-categories).
const EVO_RED = {
  hue: 0.995,
  sat: 0.85,
  value: 0.78,
  glow: 0.12,
  kind: 'normal',
  roughness: 0.3,
  clearcoat: 0.5,
};
const EVO_ROCK = {
  hue: 0.62,
  sat: 0.25,
  value: 0.14,
  kind: 'normal',
  roughness: 0.5,
  clearcoat: 0.35,
};

function renderEvolutionForm(ir, env) {
  const nodes = ir.nodes.map(label);
  const [xCats, yCats] = ir.axes; // xCats = [past, present]
  const D = yCats.length; // dimensions → columns (source page order, L→R)
  const emphasis = new Set(ir.emphasis && ir.emphasis.length ? ir.emphasis : []);
  // VERTICAL time axis (fidelity round vs source p4, 2026-07-14): the original
  // reads PAST (bottom row of tablets) rising to PRESENT (top row of circles),
  // with ONE BIG UPWARD ARROW on the left edge naming the direction. Each orb
  // RISES from its past tablet to its present seat — the transformation is
  // the motion itself, and the arrow says so explicitly.
  const colX = (yi) => -(yi - (D - 1) / 2) * 3.6; // +x renders screen-left → negate
  const PAST_Y = 0.95;
  const NOW_Y = 4.3;
  const introLead = 1.6;
  const holdEach = 1.1;
  const riseStart = introLead + 1.3; // past shown → arrow rises → orbs ascend

  const subjects = [];
  const overlay = [
    {
      text: String(ir.title || 'Evolution').toUpperCase(),
      anchor: [0, NOW_Y + 2.0, 0],
      role: 'title',
    },
  ];
  // the ARROW column sits at the far screen-left edge, exactly like the page
  const AX = colX(0) + 3.3; // +x renders screen-left → one lane left of column 0
  // strata labels ride the arrow: 过去 at its foot, 现在 at its tip
  overlay.push({
    text: String(xCats[0]),
    anchor: [AX, PAST_Y, 0],
    role: 'card',
    align: 'right',
  });
  overlay.push({
    text: String(xCats[1]),
    anchor: [AX, NOW_Y, 0],
    role: 'card',
    align: 'right',
  });
  // 2D-fidelity: the DIMENSION names (yCats — the source page's column
  // footers, e.g. 产生和消费方式/流动方式/终端) are payload, not chrome. One
  // footer card per column, revealed with the establishing beat.
  yCats.forEach((yc, yi) => {
    overlay.push({
      text: String(yc),
      anchor: [colX(yi), 0.08, 1.6],
      role: 'card',
      align: 'center',
      revealAt: 0.3 + yi * 0.15,
    });
  });

  let k = 0;
  ir.cells.forEach((c, i) => {
    const [xi, yi] = c;
    const x = colX(yi);
    if (xi === 0) {
      // the PAST: a grounded tablet at the column's foot
      subjects.push({
        id: `past-${i}`,
        type: 'rounded_box',
        args: { dims: [2.6, 1.1, 0.5], cornerR: 0.08 },
        transform: { translate: [x, PAST_Y, 0] },
        material: EVO_ROCK,
      });
      overlay.push({
        // the PAST stratum reads down the LEFT column; the PRESENT down the
        // RIGHT (a two-stratum comparison needs its text in two places)
        text: nodes[i],
        anchor: [x, PAST_Y - 0.75, 0.5],
        role: 'screen',
        side: 'left',
        revealAt: 0.4 + yi * 0.2,
      });
    } else {
      // the PRESENT: a red orb at the upper stratum. STATIC (user-locked
      // 2026-07-15): only the CAMERA animates — a rising orb is at the wrong
      // height at every frame but the last, so the page never matches its
      // source diagram while it plays.
      const t1 = riseStart + k * holdEach + 0.75;
      subjects.push({
        id: `now-${i}`,
        type: 'sphere',
        args: { radius: emphasis.has(i) ? 0.85 : 0.7 },
        transform: { translate: [x, NOW_Y, 0] },
        material: emphasis.has(i) ? { ...EVO_RED, glow: 0.24 } : EVO_RED,
      });
      overlay.push({
        text: nodes[i],
        anchor: [x, NOW_Y + 1.0, 0.4],
        role: 'screen',
        side: 'right',
        revealAt: t1 + 0.1,
      });
      k++;
    }
  });

  // THE BIG UPWARD ARROW — far screen-left, foot at the past stratum, tip at
  // the present stratum (the source page's red rising arrow). Vertical shaft
  // + a stepped head narrowing upward (analytic tier: no z-rotation, so the
  // wedge is stacked slabs). STATIC (user-locked 2026-07-15): only the CAMERA
  // animates — the arrow stands drawn from frame one, like the source page.
  const arrowMat = { ...EVO_RED, glow: 0.16 };
  const shaftH = NOW_Y - PAST_Y - 0.9;
  const shaftY = PAST_Y + shaftH / 2;
  subjects.push({
    id: 'arrow-shaft',
    type: 'rounded_box',
    args: { dims: [0.34, shaftH, 0.3], cornerR: 0.06 },
    transform: { translate: [AX, shaftY, 0] },
    material: arrowMat,
  });
  for (let j = 0; j < 4; j++) {
    const hy = PAST_Y + shaftH + 0.1 + j * 0.22;
    subjects.push({
      id: `arrow-head-${j}`,
      type: 'box',
      args: { dims: [1.15 - j * 0.27, 0.22, 0.3] },
      transform: { translate: [AX, hy, 0] },
      material: arrowMat,
    });
  }

  const emphasisIdx =
    ir.emphasis && ir.emphasis.length ? ir.emphasis[0] : ir.cells.findIndex((c) => c[0] === 1);
  const [, eyi] = ir.cells[emphasisIdx] || [1, 0];
  const span = D * 3.6 + 3;
  const shots = [
    // 1 — establishing on the PAST stratum (the story starts at the ground)
    {
      duration: introLead,
      pos: [0.8, 1.5, 9.2],
      target: [0.4, 1.5, 0],
      fov: 47,
      aperture: 0.26,
      focalDistance: 9.4,
      ease: 'out',
    },
    // 2 — the ascent: tilt up with the arrow + the rising orbs
    {
      duration: Math.max(2.2, 1.3 + k * holdEach),
      pos: [-0.8, 2.6, 9.8],
      target: [0, 3.0, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.22,
      focalDistance: 10.0,
      ease: 'smooth',
    },
    // 3 — the SUPER: punch-in on the emphasized present orb (round B: pulled
    // back a step so the orb reads WITH its neighbours, not as an abstract
    // red planet filling the frame)
    {
      duration: 1.0,
      pos: [colX(eyi) + 0.9, NOW_Y + 0.15, 3.4],
      target: [colX(eyi) - 0.3, NOW_Y - 0.1, 0],
      fov: 43,
      transition: 'cut',
      beat: 'super',
      aperture: [0.9, 0.45],
      focalDistance: 3.4,
      shake: [0.5, 0.06],
      ambient: [0.15, 1.0],
      exposure: [1.2, 1.0],
      ease: 'out',
    },
    // 4 — payoff: both strata + the arrow in one frame
    {
      duration: 2.2,
      pos: [0, 2.8, (span * 0.72 + 4.5) * (env ? env.payoffZoom : 1)],
      target: [0, 2.5, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.12,
      focalDistance: span * 0.72 + 4.5,
      ease: 'out',
    },
  ];
  const superAt = shots[0].duration + shots[1].duration;

  return {
    v: 1,
    name: `(matrix·evolution) ${ir.title || 'Evolution'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env ? env.defaults : { stage: { size: [Math.max(16, span + 6), 12, 12] } },
  };
}

export function renderMatrix(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderMatrix: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'matrix')
    throw new Error(`renderMatrix: expected structure 'matrix', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);
  if (ir.form === 'evolution' && ir.axes[0].length === 2) return renderEvolutionForm(ir, env);

  const nodes = ir.nodes.map(label);
  const N = nodes.length;
  const [xCats, yCats] = ir.axes;
  const X = xCats.length;
  const Y = yCats.length;
  const order = ir.order && ir.order.length === N ? ir.order : nodes.map((_, i) => i);
  const emphasis = new Set(ir.emphasis && ir.emphasis.length ? ir.emphasis : []);
  const mag = ir.magnitude || null;
  const mMax = mag ? Math.max(...mag.map((x) => Number(x) || 0), 1e-9) : 1;

  // Board layout: upright XY wall facing +z, centred at (0, cy). Cell size adapts
  // so a 2×2 SWOT and a 5×5 heatmap both frame well.
  const cellW = Math.min(1.7, 5.6 / X);
  const cellH = Math.min(1.3, 3.9 / Y);
  const gap = 0.12;
  const boardW = X * cellW + (X - 1) * gap;
  const boardH = Y * cellH + (Y - 1) * gap;
  const cy = 1.15 + boardH / 2; // board bottom edge ~1.15 above the floor
  // NOTE: studio camera is +x → screen-LEFT, so negate to keep axes[0] order
  // reading left→right on screen (the funnel-slice lift hit the same trap).
  const cellX = (xi) => -(xi - (X - 1) / 2) * (cellW + gap);
  const cellY = (yi) => cy + ((Y - 1) / 2 - yi) * (cellH + gap); // row 0 on top

  const subjects = [];

  // The backboard: one deep slab the whole grid mounts on — the wall reads as
  // a MASS, not a floating plane (3D-first: every element carries thickness).
  subjects.push({
    id: 'backboard',
    type: 'rounded_box',
    args: { dims: [boardW + 0.5, boardH + 0.5, 0.28], cornerR: 0.08 },
    transform: { translate: [0, cy, -0.34] },
    material: { hue: 0.62, sat: 0.3, value: 0.22, kind: 'normal', roughness: 0.4, clearcoat: 0.3 },
  });

  // the board: one thick beveled block per cell, proud of the backboard
  for (let yi = 0; yi < Y; yi++)
    for (let xi = 0; xi < X; xi++)
      subjects.push({
        id: `cell-${xi}-${yi}`,
        type: 'rounded_box',
        args: { dims: [cellW, cellH, 0.3], cornerR: 0.06 },
        transform: { translate: [cellX(xi), cellY(yi), 0] },
        material: { ...TILE_MAT },
      });

  // items slam onto their cells one by one (drop along z from the camera side).
  // Full cubes, not plaques — the slam lands a BODY on the board.
  const introLead = 1.6;
  const holdEach = 0.9;
  const zStart = 2.4; // launched from the camera side
  // STATIC (user-locked 2026-07-15): only the CAMERA animates — the board is
  // fully filled from frame one, exactly like the source page.
  order.forEach((i) => {
    const [xi, yi] = ir.cells[i];
    const size = mag ? 0.24 + 0.32 * Math.sqrt((Number(mag[i]) || 0) / mMax) : 0.34;
    const zFinal = 0.15 + size / 2 + 0.02; // clear the thick cell face
    subjects.push({
      id: `item-${i}`,
      type: 'rounded_box',
      args: { dims: [size, size, size], cornerR: 0.06 },
      transform: { translate: [cellX(xi), cellY(yi), zFinal] },
      material: itemMat(emphasis.has(i), opts.accent),
    });
  });

  // Flank rocks: the black-stone motif beside the board — depth layers behind
  // the flat wall (static, like everything else).
  [
    [-(boardW / 2 + 2.4), cy + 0.8, -2.2, 1.5, 0.9],
    [boardW / 2 + 2.7, cy - 0.4, -3.0, 1.9, 1.1],
    [-(boardW / 2 + 4.2), cy + 2.2, -5.5, 2.6, 1.4],
    [boardW / 2 + 4.8, cy + 1.6, -6.5, 2.2, 1.2],
  ].forEach(([fx, fy, fz, fw, fh], fi) => {
    subjects.push({
      id: `flank-${fi}`,
      type: 'box',
      args: { dims: [fw, fh, fw * 0.5] },
      transform: { translate: [fx, fy, fz], rotate: [0, 0.5 * fi - 0.9, 0] },
      material: {
        hue: 0.62,
        sat: 0.25,
        value: 0.14,
        kind: 'normal',
        roughness: 0.5,
        clearcoat: 0.35,
      },
    });
  });

  // ---- camera: briefing-board beats -------------------------------------------
  const emphasisIdx = ir.emphasis && ir.emphasis.length ? ir.emphasis[0] : order[order.length - 1];
  const [exi, eyi] = ir.cells[emphasisIdx];
  const viewD = Math.max(4.6, boardW * 1.05 + 1.6);
  const shots = [
    // 1 — establishing: the whole board, axes readable
    {
      duration: introLead,
      pos: [boardW * 0.18, cy + 0.5, viewD + 1.2],
      target: [0, cy, 0],
      fov: 48,
      aperture: 0.12,
      focalDistance: viewD,
      ease: 'out',
    },
  ];
  // 2 — loose tracking: drift toward each item as it lands
  order.forEach((i) => {
    const [xi, yi] = ir.cells[i];
    shots.push({
      duration: holdEach,
      pos: [cellX(xi) * 0.55, cellY(yi) * 0.35 + cy * 0.65, viewD * 0.78],
      target: [cellX(xi), cellY(yi), 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.2,
      focalDistance: viewD * 0.78,
      ease: 'smooth',
    });
  });
  // 3 — the super: punch-in at the emphasis item
  shots.push({
    duration: 0.9,
    pos: [cellX(exi) + 0.5, cellY(eyi) + 0.2, 2.1],
    target: [cellX(exi), cellY(eyi), 0.2],
    fov: 44,
    transition: 'cut',
    beat: 'super',
    aperture: [0.7, 0.35],
    focalDistance: 2.0,
    shake: [0.35, 0.05],
    exposure: [1.3, 1.0],
    ease: 'out',
  });
  // 4 — payoff: the filled board
  shots.push({
    duration: 2.2,
    pos: [0, cy + 0.4, viewD + 0.6],
    target: [0, cy, 0],
    fov: 48,
    transition: 'blend',
    aperture: 0.1,
    focalDistance: viewD,
    ease: 'inout',
  });

  // ---- overlay: title, axis labels, item labels --------------------------------
  const overlay = [
    {
      text: String(ir.title || 'Matrix').toUpperCase(),
      anchor: [0, cy + boardH / 2 + 0.8, 0],
      role: 'title',
    },
  ];
  xCats.forEach((c, xi) =>
    overlay.push({
      text: String(c),
      anchor: [cellX(xi), cy + boardH / 2 + 0.32, 0],
      role: 'card',
      align: 'center',
    }),
  );
  yCats.forEach((c, yi) =>
    overlay.push({
      text: String(c),
      anchor: [-boardW / 2 - 0.55, cellY(yi), 0],
      role: 'card',
      align: 'right',
    }),
  );
  order.forEach((i, k) => {
    const [xi, yi] = ir.cells[i];
    overlay.push({
      // Cell texts ride the narration column — but a 2-column matrix is a
      // COMPARISON, so each side gets its OWN column: axes[0][0]'s entries read
      // down the LEFT, axes[0][1]'s down the RIGHT. Stacking both sides in one
      // column destroys the contrast the page exists to make (user-locked
      // 2026-07-15: 对比必须把文本放在两个地方). Axis labels stay ANCHORED.
      text: nodes[i],
      anchor: [cellX(xi), cellY(yi) - 0.34, 0.2],
      role: 'screen',
      ...(X === 2 ? { side: xi === 0 ? 'left' : 'right' } : {}),
      align: 'center',
      revealAt: introLead + k * holdEach + 0.15,
    });
  });

  return {
    v: 1,
    name: `(matrix) ${ir.title || 'matrix'}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots },
    defaults: env ? env.defaults : { stage: { size: [Math.max(16, boardW + 8), 12, 12] } },
  };
}
