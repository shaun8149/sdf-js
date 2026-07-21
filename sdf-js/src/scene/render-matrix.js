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
const PAST_AXIS_RE = /过去|以前|历史|旧|before|past|then|legacy|former|earlier/i;
const PRESENT_AXIS_RE = /现在|当前|未来|新|after|present|now|today|current|future/i;
const isEraAxis = (axis) => {
  if (!Array.isArray(axis) || axis.length !== 2) return false;
  const a = String(axis[0] || '');
  const b = String(axis[1] || '');
  return (
    (PAST_AXIS_RE.test(a) && PRESENT_AXIS_RE.test(b)) ||
    (PAST_AXIS_RE.test(b) && PRESENT_AXIS_RE.test(a))
  );
};

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

// ---- versus form -----------------------------------------------------------------
// A two-contender comparison (推荐引擎 VS 搜索引擎, N dimensions) is not a
// quadrant wall — it's an AISLE. Two walls of panels face each other across a
// walkway, one dimension per bay, and the camera WALKS the aisle: each step is
// one dimension's head-to-head. That dolly-through is the read 2D can't do —
// the page's flat table becomes a corridor of confrontations.
//   1. establishing — the aisle entrance, both walls converging to the horizon
//   2. the walk — one beat per dimension, camera advancing bay by bay
//   3. the SUPER — punch-in on the emphasis panel
//   4. payoff — high reverse from the far end, the whole corridor in one frame
function renderVersusForm(ir, env, opts) {
  const nodes = ir.nodes.map(label);
  const [xCats, yCats] = ir.axes;
  const Y = yCats.length;
  const emphasis = new Set(ir.emphasis && ir.emphasis.length ? ir.emphasis : []);
  const WALL_X = 2.35; // half-width of the aisle; contender 0 at +x (screen-left)
  const ROW_GAP = 2.3;
  const PANEL_Y = 1.75;
  const rowZ = (yi) => -yi * ROW_GAP;
  const sideX = (xi) => (xi === 0 ? WALL_X : -WALL_X);

  const subjects = [];
  // header steles: one per contender at the aisle entrance
  xCats.forEach((c, xi) => {
    subjects.push({
      id: `vs-stele-${xi}`,
      type: 'rounded_box',
      args: { dims: [0.5, 2.6, 0.5], cornerR: 0.08 },
      transform: { translate: [sideX(xi), 1.4, ROW_GAP * 0.8] },
      material:
        xi === 0
          ? {
              hue: 0.995,
              sat: 0.8,
              value: 0.75,
              glow: 0.1,
              kind: 'normal',
              roughness: 0.3,
              clearcoat: 0.5,
            }
          : { hue: 0.6, sat: 0.25, value: 0.35, kind: 'normal', roughness: 0.45, clearcoat: 0.3 },
    });
  });
  // panels: one bay per dimension, both walls
  // the two walls carry team colors: contender 0 warm, contender 1 cool —
  // the aisle reads as a confrontation even before any text lands
  const WALL_MATS = [
    { hue: 0.07, sat: 0.42, value: 0.78, kind: 'normal', roughness: 0.35, clearcoat: 0.4 },
    { hue: 0.6, sat: 0.28, value: 0.45, kind: 'normal', roughness: 0.45, clearcoat: 0.3 },
  ];
  ir.cells.forEach((c, i) => {
    const [xi, yi] = c;
    subjects.push({
      id: `vs-panel-${xi}-${yi}`,
      type: 'rounded_box',
      args: { dims: [0.36, 1.25, 1.65], cornerR: 0.07 },
      transform: { translate: [sideX(xi), PANEL_Y, rowZ(yi)] },
      material: emphasis.has(i)
        ? itemMat(true, opts.accent)
        : xi === 0 && opts.accent
          ? itemMat(false, opts.accent)
          : WALL_MATS[xi],
    });
  });
  // center spine: low guide blocks between bays — the walkway reads as built
  for (let yi = 0; yi < Y; yi++) {
    subjects.push({
      id: `vs-spine-${yi}`,
      type: 'rounded_box',
      args: { dims: [0.28, 0.14, 0.28], cornerR: 0.05 },
      transform: { translate: [0, 0.12, rowZ(yi)] },
      material: { hue: 0.6, sat: 0.2, value: 0.4, glow: 0.06, kind: 'normal', roughness: 0.6 },
    });
  }

  // ---- camera: walk the aisle ---------------------------------------------------
  const introLead = 1.5;
  const holdEach = 1.15;
  const endZ = rowZ(Y - 1);
  const shots = [
    // 1 — establishing: entrance, both walls converging
    {
      duration: introLead,
      pos: [0, 2.6, ROW_GAP * 1.9],
      target: [0, PANEL_Y, endZ * 0.45],
      fov: 52,
      aperture: 0.18,
      focalDistance: ROW_GAP * 2.2,
      ease: 'out',
    },
  ];
  // 2 — the walk: one beat per dimension bay
  for (let yi = 0; yi < Y; yi++) {
    shots.push({
      duration: holdEach,
      pos: [0, 2.15, rowZ(yi) + ROW_GAP * 1.35],
      target: [0, PANEL_Y - 0.1, rowZ(yi) - ROW_GAP * 0.4],
      fov: 50,
      transition: 'blend',
      aperture: 0.3,
      focalDistance: ROW_GAP * 1.5,
      ease: 'smooth',
    });
  }
  // 3 — the super: punch-in on the emphasis panel (or contender 0's last bay)
  const eIdx =
    ir.emphasis && ir.emphasis.length ? ir.emphasis[0] : ir.cells.findIndex((c) => c[0] === 0);
  const [exi, eyi] = ir.cells[eIdx] || [0, 0];
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0);
  shots.push({
    duration: 1.0,
    // three-quarter framing from the aisle, a full bay back — the emphasis
    // panel reads WITH its opponent across the aisle, not as a wall of paint
    pos: [sideX(exi) * 0.15, PANEL_Y + 0.5, rowZ(eyi) + 2.9],
    target: [sideX(exi) * 0.85, PANEL_Y, rowZ(eyi) - 0.3],
    fov: 46,
    transition: 'cut',
    beat: 'super',
    aperture: [0.8, 0.4],
    focalDistance: 3.1,
    shake: [0.4, 0.05],
    ambient: [0.2, 1.0],
    exposure: [1.2, 1.0],
    ease: 'out',
  });
  // 4 — payoff: high three-quarter from the entrance, the whole corridor
  // receding to its vanishing point (the shot the flat table can't make)
  shots.push({
    duration: 2.3,
    pos: [3.4, 5.2, ROW_GAP * (env ? 2.4 * env.payoffZoom : 2.4)],
    target: [0, PANEL_Y - 0.25, endZ * 0.55],
    fov: 50,
    transition: 'blend',
    aperture: 0.1,
    focalDistance: Math.abs(endZ) * 0.7 + ROW_GAP * 2.5,
    ease: 'out',
  });

  // ---- overlay -------------------------------------------------------------------
  const overlay = [
    {
      text: String(ir.title || 'Versus').toUpperCase(),
      anchor: [0, 4.6, ROW_GAP * 0.5],
      role: 'title',
    },
  ];
  xCats.forEach((c, xi) =>
    overlay.push({
      text: String(c),
      anchor: [sideX(xi), 3.1, ROW_GAP * 0.8],
      role: 'card',
      align: 'center',
    }),
  );
  yCats.forEach((c, yi) =>
    overlay.push({
      text: String(c),
      anchor: [0, PANEL_Y + 1.05, rowZ(yi)],
      role: 'card',
      align: 'center',
      revealAt: introLead + yi * holdEach + 0.1,
    }),
  );
  // panel texts ride the two narration columns — the comparison's text lives
  // in TWO places (user-locked 2026-07-15: 对比必须把文本放在两个地方)
  ir.cells.forEach((c, i) => {
    const [xi, yi] = c;
    overlay.push({
      text: nodes[i],
      anchor: [sideX(xi), PANEL_Y - 0.85, rowZ(yi)],
      role: 'screen',
      side: xi === 0 ? 'left' : 'right',
      align: 'center',
      revealAt: introLead + yi * holdEach + 0.25,
    });
  });

  return {
    v: 1,
    name: `(matrix·versus) ${ir.title || 'versus'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env ? env.defaults : { stage: { size: [16, 12, Math.max(14, Y * ROW_GAP + 8)] } },
  };
}

// renderEvolutionForm assumes axes[0] = [past, present] IN THAT ORDER; an
// extractor that lists [现在, 过去] would render history upside down. Swap
// the era pair (and flip the matching cell index) when past comes second.
function normalizeEraOrder(ir) {
  const [a, b] = ir.axes[0];
  if (PAST_AXIS_RE.test(String(a)) && !PRESENT_AXIS_RE.test(String(a))) return ir;
  if (PAST_AXIS_RE.test(String(b)) || !PRESENT_AXIS_RE.test(String(a))) {
    return {
      ...ir,
      axes: [[b, a], ir.axes[1]],
      cells: ir.cells.map(([x, y]) => [1 - x, y]),
    };
  }
  return ir;
}

export function renderMatrix(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderMatrix: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'matrix')
    throw new Error(`renderMatrix: expected structure 'matrix', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);
  if ((ir.form === 'evolution' || (!ir.form && isEraAxis(ir.axes[0]))) && ir.axes[0].length === 2)
    return renderEvolutionForm(normalizeEraOrder(ir), env);
  // era axis on the ROWS (the 2015 flagship p4: axes = [3 dimensions,
  // [过去, 现在]]) — same evolution read, transposed orientation. Swap axes
  // and cell coordinates into the branch's expected shape.
  if (!ir.form && ir.axes[1].length === 2 && isEraAxis(ir.axes[1]) && !isEraAxis(ir.axes[0])) {
    const t = {
      ...ir,
      axes: [ir.axes[1], ir.axes[0]],
      cells: ir.cells.map(([x, y]) => [y, x]),
    };
    return renderEvolutionForm(normalizeEraOrder(t), env);
  }
  // versus: explicit form, or the unmistakable shape — exactly 2 contenders
  // compared across ≥3 dimensions (p5/p6 VS tables). SWOT (2×2) stays a wall.
  if (
    (ir.form === 'versus' || (!ir.form && ir.axes[0].length === 2 && ir.axes[1].length >= 3)) &&
    ir.axes[0].length === 2
  )
    return renderVersusForm(ir, env, opts);

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
    // Cell texts ride the narration columns — but a matrix is a COMPARISON,
    // so each side gets its OWN column: the first axis category's entries
    // read down the LEFT, the last category's down the RIGHT. Stacking every
    // column's text in one place destroys the contrast the page exists to
    // make (user-locked 2026-07-15: 对比必须把文本放在两个地方). MIDDLE
    // columns (X ≥ 3, e.g. p6's 头条/Google/趋势) anchor as world cards at
    // their own cells — the text stays WITH its geometry.
    const isMiddle = X >= 3 && xi > 0 && xi < X - 1;
    overlay.push({
      text: nodes[i],
      anchor: [cellX(xi), cellY(yi) - 0.34, 0.2],
      role: isMiddle ? 'card' : 'screen',
      ...(isMiddle ? {} : { side: xi === 0 ? 'left' : 'right' }),
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
