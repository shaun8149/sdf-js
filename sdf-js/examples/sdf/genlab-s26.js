import {
  rectangle,
  rounded_rectangle,
  polygon,
  ellipse,
  union,
  intersection,
  dilate,
  render,
} from '../../src/index.js';

// --- Palette: Bologna dust ---------------------------------------------------
const WALL_TOP = [226, 218, 203];
const WALL_BOT = [209, 200, 184];
const TABLE = [191, 179, 160];
const TABLE_EDGE = [163, 151, 134];
const SHADOW = [174, 162, 147];
const OUTLINE = [92, 83, 74];

const C_TALL = [163, 174, 173]; // pale grey-blue bottle
const C_TALL_HL = [186, 194, 191];
const C_OCHRE = [186, 158, 112]; // ochre bottle
const C_OCHRE_HL = [204, 180, 138];
const C_BONE = [228, 220, 203]; // cream jar
const C_BONE_HL = [239, 233, 219];
const C_ROSE = [193, 155, 142]; // dusty rose jar
const C_ROSE_HL = [209, 175, 163];

// --- Ground ------------------------------------------------------------------
const tabletop = rectangle([3.0, 1.2], [0, -0.9]); // y  -1.50 .. -0.30
const tableFace = rectangle([3.0, 0.8], [0, -1.02]); // y  -1.42 .. -0.62

// --- Vessel A: tall slim bottle (back left, tallest) -------------------------
const bodyA = rounded_rectangle([0.28, 0.56], 0.05, [-0.34, -0.06]);
const shoulderA = polygon([
  [-0.48, 0.14],
  [-0.2, 0.14],
  [-0.27, 0.34],
  [-0.41, 0.34],
]);
const neckA = rectangle([0.09, 0.24], [-0.34, 0.44]);
const lipA = rounded_rectangle([0.14, 0.06], 0.02, [-0.34, 0.58]);
const bottleA = union(union(union(bodyA, shoulderA, { k: 0.035 }), neckA, { k: 0.02 }), lipA);
const hlA = intersection(bottleA, rounded_rectangle([0.07, 1.1], 0.03, [-0.43, 0.02]));

// --- Vessel B: ochre bottle (back right) -------------------------------------
const bodyC = rounded_rectangle([0.24, 0.4], 0.04, [0.36, -0.16]);
const shoulderC = polygon([
  [0.24, 0.0],
  [0.48, 0.0],
  [0.42, 0.2],
  [0.3, 0.2],
]);
const neckC = rectangle([0.08, 0.16], [0.36, 0.27]);
const lipC = rounded_rectangle([0.12, 0.05], 0.02, [0.36, 0.365]);
const bottleC = union(union(union(bodyC, shoulderC, { k: 0.03 }), neckC, { k: 0.02 }), lipC);
const hlC = intersection(bottleC, rounded_rectangle([0.06, 0.8], 0.03, [0.28, -0.1]));

// --- Vessel C: bone-white jar (front centre-left) ----------------------------
const bodyB = rounded_rectangle([0.36, 0.44], [0.08, 0.08, 0.04, 0.04], [-0.1, -0.24]);
const neckB = rectangle([0.2, 0.06], [-0.1, 0.0]);
const lipB = rounded_rectangle([0.28, 0.06], 0.02, [-0.1, 0.05]);
const jarB = union(union(bodyB, neckB, { k: 0.02 }), lipB);
const hlB = intersection(jarB, rounded_rectangle([0.08, 0.62], 0.04, [-0.25, -0.24]));

// --- Vessel D: squat rose jar (front right, lowest) --------------------------
const bodyD = rounded_rectangle([0.42, 0.3], [0.12, 0.12, 0.04, 0.04], [0.28, -0.33]);
const lipD = rounded_rectangle([0.3, 0.06], 0.02, [0.28, -0.16]);
const jarD = union(bodyD, lipD, { k: 0.015 });
const hlD = intersection(jarD, rounded_rectangle([0.09, 0.42], 0.04, [0.14, -0.33]));

// --- Cast shadows (all raking to the right) ----------------------------------
const shadows = union(
  ellipse(0.23, 0.035, [-0.22, -0.345]),
  ellipse(0.2, 0.032, [0.48, -0.365]),
  ellipse(0.25, 0.038, [0.04, -0.465]),
  ellipse(0.27, 0.036, [0.44, -0.485]),
);

// --- Layers: back to front ---------------------------------------------------
const layers = [
  { sdf: tabletop, color: TABLE },
  { sdf: tableFace, color: TABLE_EDGE },
  { sdf: shadows, color: SHADOW },

  { sdf: dilate(bottleA, 0.01), color: OUTLINE },
  { sdf: bottleA, color: C_TALL },
  { sdf: hlA, color: C_TALL_HL },

  { sdf: dilate(bottleC, 0.01), color: OUTLINE },
  { sdf: bottleC, color: C_OCHRE },
  { sdf: hlC, color: C_OCHRE_HL },

  { sdf: dilate(jarB, 0.011), color: OUTLINE },
  { sdf: jarB, color: C_BONE },
  { sdf: hlB, color: C_BONE_HL },

  { sdf: dilate(jarD, 0.011), color: OUTLINE },
  { sdf: jarD, color: C_ROSE },
  { sdf: hlD, color: C_ROSE_HL },
];

// —— painted 展示接线 (scene 26) ——
export const getSdfs = () => layers.map((l) => l.sdf);
