import {
  circle,
  rectangle,
  rounded_rectangle,
  polygon,
  triangle,
  union,
  intersection,
  dilate,
  render,
} from '../../src/index.js';

// ─── Palette: Hokusai, "Gaifū Kaisei" (Red Fuji), Thirty-six Views ───────────
const SKY_TOP = [44, 76, 116]; // prussian blue (Hokusai's imported bero-ai)
const SKY_BOT = [234, 198, 158]; // dawn peach at the horizon
const GLOW_OUT = [236, 208, 168];
const GLOW_IN = [246, 202, 138];
const CLOUD = [249, 245, 236];
const CLOUD_S = [212, 200, 188];
const FUJI_HI = [208, 96, 62]; // sunlit summit flank
const FUJI_MID = [186, 76, 52];
const FUJI_LOW = [150, 64, 50];
const SNOW = [247, 243, 233];
const SNOW_LINE = [116, 50, 44];
const FOREST = [42, 62, 56];
const FOREST_HI = [76, 98, 72];
const INK = [28, 30, 44];

// ─── Builders ───────────────────────────────────────────────────────────────

// Flat-bottomed stylized cumulus row (woodblock cloud convention)
function cumulusRow(cx, cy, count, r, spacing) {
  let s = circle(r * 0.55, [cx, cy + r * 0.2]);
  for (let i = 0; i < count; i++) {
    const x = cx + (i - (count - 1) / 2) * spacing;
    const rr = r * (0.55 + 0.55 * Math.abs(Math.sin(i * 1.73 + 0.4)));
    s = union(s, circle(rr, [x, cy + rr * 0.55]), { k: 0.04 });
  }
  return intersection(s, rectangle([5.0, 1.2], [cx, cy + 0.6]));
}

// Tapering snow rivulet: wide at the ridge, pointed downslope
function streak(x0, y0, hw, x1, y1) {
  return triangle([x0 - hw, y0], [x0 + hw, y0], [x1, y1]);
}

// ─── Sky furniture ──────────────────────────────────────────────────────────
const glowOuter = circle(1.05, [0, 0.38]);
const glowInner = circle(0.7, [0, 0.42]);

const clouds = union(
  cumulusRow(0.72, 0.86, 7, 0.115, 0.155),
  cumulusRow(-0.78, 0.58, 5, 0.085, 0.12),
  cumulusRow(0.95, 0.38, 4, 0.07, 0.105),
  rounded_rectangle([0.95, 0.048], 0.024, [-0.48, 1.02]),
  rounded_rectangle([0.62, 0.04], 0.02, [0.6, 1.08]),
  rounded_rectangle([0.44, 0.036], 0.018, [-1.0, 0.86]),
);
const cloudShadow = clouds.translate([0.018, -0.026]);

// ─── The mountain ───────────────────────────────────────────────────────────
const mountain = polygon([
  [-1.7, -0.7],
  [-1.7, -0.21],
  [-1.22, -0.06],
  [-0.88, 0.08],
  [-0.6, 0.22],
  [-0.38, 0.36],
  [-0.2, 0.5],
  [-0.14, 0.55], // jagged crater rim
  [-0.09, 0.62],
  [-0.02, 0.57],
  [0.04, 0.63],
  [0.1, 0.56],
  [0.2, 0.49],
  [0.4, 0.35],
  [0.65, 0.21],
  [0.96, 0.07],
  [1.32, -0.07],
  [1.7, -0.21],
  [1.7, -0.7],
]);

// bokashi-style tonal bands (horizontal gradation, printed as flat plates)
const fujiMid = intersection(mountain, rectangle([4.0, 0.16], [0, 0.13]));
const fujiLow = intersection(mountain, rectangle([4.0, 0.32], [0, -0.11]));

// ─── Snow: jagged snowline + rivulets running down the flanks ───────────────
const snowField = polygon([
  [-0.75, 0.95],
  [0.75, 0.95],
  [0.5, 0.3],
  [0.42, 0.42],
  [0.33, 0.27],
  [0.24, 0.4],
  [0.14, 0.25],
  [0.05, 0.38],
  [-0.04, 0.24],
  [-0.13, 0.39],
  [-0.23, 0.26],
  [-0.33, 0.41],
  [-0.43, 0.28],
  [-0.52, 0.4],
  [-0.62, 0.31],
]);

const streaks = union(
  streak(-0.42, 0.32, 0.038, -0.58, 0.1),
  streak(-0.22, 0.3, 0.03, -0.3, 0.06),
  streak(-0.03, 0.28, 0.026, -0.02, -0.02),
  streak(0.18, 0.3, 0.032, 0.26, 0.02),
  streak(0.38, 0.32, 0.036, 0.52, 0.08),
);

const snow = intersection(union(snowField, streaks), mountain);
const snowEdge = intersection(dilate(snow, 0.008), mountain);

// ─── Forest band at the foot ────────────────────────────────────────────────
let forest = rectangle([4.0, 0.56], [0, -0.45]); // top edge at y = -0.17
for (let i = 0; i < 28; i++) {
  const x = -1.35 + i * 0.1;
  const h = 0.03 + 0.034 * Math.abs(Math.sin(i * 2.31 + 0.7));
  forest = union(forest, triangle([x - 0.055, -0.2], [x + 0.055, -0.2], [x + 0.01, -0.17 + h]));
}
const forestHi = intersection(forest, rectangle([4.0, 0.26], [0, -0.17]));

// ─── Layers (back to front) ─────────────────────────────────────────────────
const layers = [
  { sdf: glowOuter, color: GLOW_OUT },
  { sdf: glowInner, color: GLOW_IN },

  { sdf: cloudShadow, color: CLOUD_S },
  { sdf: clouds, color: CLOUD },

  { sdf: dilate(mountain, 0.013), color: INK },
  { sdf: mountain, color: FUJI_HI },
  { sdf: fujiMid, color: FUJI_MID },
  { sdf: fujiLow, color: FUJI_LOW },

  { sdf: snowEdge, color: SNOW_LINE },
  { sdf: snow, color: SNOW },

  { sdf: dilate(forest, 0.01), color: INK },
  { sdf: forest, color: FOREST },
  { sdf: forestHi, color: FOREST_HI },
];

// ─── Render ─────────────────────────────────────────────────────────────────
// —— painted 展示接线 (scene 29) ——
export const getSdfs = () => layers.map((l) => l.sdf);
