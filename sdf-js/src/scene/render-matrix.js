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
const itemMat = (emphasized) =>
  emphasized
    ? { hue: 0.11, sat: 0.78, value: 0.95, glow: 0.22, kind: 'normal', roughness: 0.22, clearcoat: 0.6 }
    : { hue: 0.57, sat: 0.55, value: 0.72, kind: 'normal', roughness: 0.3, clearcoat: 0.45 };

export function renderMatrix(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderMatrix: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'matrix')
    throw new Error(`renderMatrix: expected structure 'matrix', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);

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

  // the board: one thin tile per cell (self-laid, so item positions match exactly)
  for (let yi = 0; yi < Y; yi++)
    for (let xi = 0; xi < X; xi++)
      subjects.push({
        id: `cell-${xi}-${yi}`,
        type: 'box',
        args: { dims: [cellW, cellH, 0.1] },
        transform: { translate: [cellX(xi), cellY(yi), 0] },
        material: { ...TILE_MAT },
      });

  // items slam onto their cells one by one (drop along z from the camera side)
  const introLead = 1.6;
  const holdEach = 0.9;
  const zFinal = 0.18; // proud of the board face
  const zStart = 2.4; // launched from the camera side
  order.forEach((i, k) => {
    const [xi, yi] = ir.cells[i];
    const size = mag ? 0.22 + 0.3 * Math.sqrt((Number(mag[i]) || 0) / mMax) : 0.3;
    const t0 = introLead + k * holdEach - 0.35;
    const t1 = t0 + 0.45;
    subjects.push({
      id: `item-${i}`,
      type: 'rounded_box',
      args: { dims: [size, size, 0.14], cornerR: 0.03 },
      transform: { translate: [cellX(xi), cellY(yi), zFinal] },
      material: itemMat(emphasis.has(i)),
      animation: [
        {
          channel: 'transform.translate.z',
          expr: `${zStart.toFixed(3)} - ${(zStart - zFinal).toFixed(3)} * smoothstep(${Math.max(0.2, t0).toFixed(2)}, ${t1.toFixed(2)}, t)`,
        },
      ],
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
    { text: String(ir.title || 'Matrix').toUpperCase(), anchor: [0, cy + boardH / 2 + 0.8, 0], role: 'title' },
  ];
  xCats.forEach((c, xi) =>
    overlay.push({ text: String(c), anchor: [cellX(xi), cy + boardH / 2 + 0.32, 0], role: 'card', align: 'center' }),
  );
  yCats.forEach((c, yi) =>
    overlay.push({ text: String(c), anchor: [-boardW / 2 - 0.55, cellY(yi), 0], role: 'card', align: 'right' }),
  );
  order.forEach((i, k) => {
    const [xi, yi] = ir.cells[i];
    overlay.push({
      text: nodes[i],
      anchor: [cellX(xi), cellY(yi) - 0.34, 0.2],
      role: emphasis.has(i) ? 'value' : 'card',
      align: 'center',
      ...(emphasis.has(i) ? { radius: 0.4 } : {}),
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
