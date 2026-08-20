import {
  circle,
  ellipse,
  rectangle,
  polygon,
  segment,
  union,
  intersection,
  dilate,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
// Monochrome silver-gelatin values, sampled off Adams' 1941 print.
const SKY_TOP = [6, 7, 11];
const SKY_BOTTOM = [40, 42, 50];
const MOON_HALO = [26, 28, 38];
const MOON = [250, 248, 238];
const CLOUD_GLOW = [92, 95, 98];
const CLOUD_CORE = [216, 214, 202];
const RIDGE_FAR = [46, 48, 56];
const RIDGE_NEAR = [13, 14, 18];
const ADOBE_LIT = [196, 192, 176];
const ADOBE_DARK = [20, 20, 24];
const FIELD_1 = [54, 54, 56];
const FIELD_2 = [33, 33, 35];
const FIELD_3 = [14, 14, 16];
const STONE = [246, 244, 232];
const STONE_CAST = [96, 95, 90];

// ---------------------------------------------------------------- builders
// Latin grave cross: base sits at (cx, cy), total height 0.46 * s.
function graveCross(cx, cy, s) {
  return union(
    rectangle([0.085 * s, 0.46 * s], [cx, cy + 0.23 * s]),
    rectangle([0.3 * s, 0.08 * s], [cx, cy + 0.355 * s]),
  );
}

function crossCast(cx, cy, s) {
  return ellipse(0.13 * s, 0.02 * s, [cx + 0.07 * s, cy + 0.005]);
}

// Flat ground band: wavy top profile, closed off at bottomY.
function groundBand(topPts, bottomY) {
  return polygon([...topPts, [1.6, bottomY], [-1.6, bottomY]]);
}

// Small adobe block.
function adobe(cx, baseY, w, h) {
  return rectangle([w, h], [cx, baseY + h / 2]);
}

// Cottonwood: trunk + smooth crown.
function cottonwood(cx, baseY, s) {
  return union(
    segment([cx, baseY], [cx, baseY + 0.1 * s], 0.008 * s),
    circle(0.055 * s, [cx, baseY + 0.135 * s]),
    circle(0.04 * s, [cx - 0.045 * s, baseY + 0.105 * s]),
    circle(0.04 * s, [cx + 0.045 * s, baseY + 0.11 * s]),
    { k: 0.03 },
  );
}

// ---------------------------------------------------------------- sky
const moon = circle(0.07, [0.3, 0.66]);
const moonHalo = dilate(moon, 0.075);

// The thin luminous cloud band — the only bright thing in the upper 2/3.
const cloudMass = union(
  ellipse(0.62, 0.055, [-0.68, 0.095]),
  ellipse(0.46, 0.048, [-0.02, 0.115]),
  ellipse(0.55, 0.052, [0.74, 0.085]),
  { k: 0.06 },
);
const cloudGlow = intersection(cloudMass, rectangle([3.2, 0.2], [0, 0.095]));
const cloudCore = intersection(cloudMass, rectangle([3.2, 0.052], [0, 0.062]));

// ---------------------------------------------------------------- mountains
// Sangre de Cristo range: hazed far crest, then the black near ridge.
const ridgeFar = polygon([
  [-1.6, -0.3],
  [-1.6, 0.04],
  [-1.28, 0.13],
  [-1.02, 0.06],
  [-0.74, 0.17],
  [-0.46, 0.08],
  [-0.18, 0.2],
  [0.1, 0.1],
  [0.38, 0.21],
  [0.66, 0.11],
  [0.96, 0.18],
  [1.26, 0.07],
  [1.6, 0.14],
  [1.6, -0.3],
]);

const ridgeNear = polygon([
  [-1.6, -0.32],
  [-1.6, -0.06],
  [-1.34, 0.01],
  [-1.06, -0.05],
  [-0.8, 0.03],
  [-0.56, -0.04],
  [-0.3, 0.05],
  [-0.04, -0.03],
  [0.22, 0.06],
  [0.5, -0.02],
  [0.78, 0.04],
  [1.06, -0.05],
  [1.34, 0.02],
  [1.6, -0.04],
  [1.6, -0.32],
]);

// ---------------------------------------------------------------- village
const VB = -0.265; // village baseline

const villageDark = union(
  cottonwood(-0.86, VB, 0.85),
  cottonwood(-0.55, VB, 0.7),
  cottonwood(0.44, VB, 0.78),
  cottonwood(0.83, VB, 0.62),
  adobe(-0.72, VB, 0.075, 0.045),
  adobe(0.16, VB, 0.06, 0.04),
  adobe(0.66, VB, 0.07, 0.038),
);

const villageLit = union(
  adobe(-0.42, VB, 0.105, 0.055),
  adobe(-0.3, VB, 0.07, 0.042),
  adobe(0.0, VB, 0.09, 0.05),
  adobe(0.28, VB, 0.115, 0.048),
  adobe(0.55, VB, 0.065, 0.036),
  // the little mission church
  adobe(-0.14, VB, 0.15, 0.082),
  adobe(-0.205, VB, 0.048, 0.14),
  graveCross(-0.205, VB + 0.14, 0.085),
);

// ---------------------------------------------------------------- foreground
const field1 = groundBand(
  [
    [-1.6, -0.255],
    [-1.1, -0.268],
    [-0.62, -0.252],
    [-0.14, -0.266],
    [0.34, -0.25],
    [0.86, -0.264],
    [1.6, -0.252],
  ],
  -1.4,
);

const field2 = groundBand(
  [
    [-1.6, -0.545],
    [-1.05, -0.575],
    [-0.5, -0.54],
    [0.06, -0.572],
    [0.62, -0.538],
    [1.14, -0.568],
    [1.6, -0.546],
  ],
  -1.4,
);

const field3 = groundBand(
  [
    [-1.6, -0.905],
    [-1.0, -0.945],
    [-0.4, -0.9],
    [0.22, -0.94],
    [0.82, -0.898],
    [1.6, -0.935],
  ],
  -1.4,
);

// ---------------------------------------------------------------- graveyard
// Three receding rows: further = smaller + higher on the picture plane.
const CROSSES = [
  [-0.92, -0.435, 0.24],
  [-0.66, -0.448, 0.26],
  [-0.4, -0.43, 0.23],
  [-0.13, -0.452, 0.26],
  [0.14, -0.436, 0.24],
  [0.42, -0.45, 0.27],
  [0.7, -0.432, 0.23],
  [0.96, -0.446, 0.25],

  [-1.02, -0.615, 0.39],
  [-0.68, -0.635, 0.41],
  [-0.32, -0.605, 0.37],
  [0.04, -0.63, 0.4],
  [0.4, -0.612, 0.38],
  [0.76, -0.638, 0.42],
  [1.08, -0.608, 0.37],

  [-0.82, -0.87, 0.58],
  [-0.32, -0.895, 0.61],
  [0.2, -0.865, 0.57],
  [0.72, -0.9, 0.6],
  [1.16, -0.872, 0.55],
];

const crosses = union(...CROSSES.map(([x, y, s]) => graveCross(x, y, s)));
const crossShadows = union(...CROSSES.map(([x, y, s]) => crossCast(x, y, s)));

// ---------------------------------------------------------------- layers
const layers = [
  { sdf: moonHalo, color: MOON_HALO },
  { sdf: moon, color: MOON },

  { sdf: cloudGlow, color: CLOUD_GLOW },
  { sdf: cloudCore, color: CLOUD_CORE },

  { sdf: ridgeFar, color: RIDGE_FAR },
  { sdf: ridgeNear, color: RIDGE_NEAR },

  { sdf: villageDark, color: ADOBE_DARK },
  { sdf: villageLit, color: ADOBE_LIT },

  { sdf: field1, color: FIELD_1 },
  { sdf: field2, color: FIELD_2 },
  { sdf: field3, color: FIELD_3 },

  { sdf: crossShadows, color: STONE_CAST },
  { sdf: crosses, color: STONE },
];

// ---------------------------------------------------------------- render
// —— painted 展示接线 (scene 32) ——
export const getSdfs = () => layers.map((l) => l.sdf);
