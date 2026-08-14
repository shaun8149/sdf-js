import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  polygon,
  triangle,
  segment,
  union,
  intersection,
  difference,
  dilate,
  erode,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette ---
const SKY_TOP = [30, 40, 60];
const SKY_BOTTOM = [92, 110, 124];
const CLOUD = [22, 30, 46];
const CLOUD_LIGHT = [56, 68, 88];
const RAIN = [126, 142, 158];
const BEAM = [86, 90, 86];
const GLOW_FAR = [62, 68, 76];
const GLOW_MID = [96, 94, 82];
const GLOW_NEAR = [146, 130, 90];
const SEA_DARK = [20, 38, 56];
const SEA_MID = [40, 66, 88];
const ROCK = [38, 42, 50];
const ROCK_LIGHT = [64, 70, 78];
const STONE = [228, 218, 200];
const STONE_SHADE = [180, 168, 150];
const BAND_RED = [174, 60, 50];
const LAMP_GLASS = [252, 214, 120];
const LAMP_CORE = [255, 250, 226];
const FOAM = [214, 228, 236];
const FOAM_WHITE = [255, 255, 255];
const FOAM_SHADE = [156, 182, 200];
const OUTLINE = [14, 18, 26];

const TX = 0.18; // lighthouse centre x
const LY = 0.475; // lamp centre y

// ----------------------------------------------------------------- storm ----
const clouds = union(
  rectangle([3.0, 0.5], [0, 1.3]),
  ellipse(0.58, 0.24, [-0.85, 0.96]),
  ellipse(0.44, 0.19, [-0.2, 1.04]),
  ellipse(0.62, 0.26, [0.52, 0.96]),
  ellipse(0.4, 0.17, [1.05, 1.06]),
  { k: 0.14 },
);
const cloudLight = union(ellipse(0.3, 0.11, [-0.72, 0.9]), ellipse(0.24, 0.09, [0.46, 0.88]), {
  k: 0.1,
});

const rain = union(
  ...Array.from({ length: 28 }, (_, i) => {
    const x = -1.3 + i * 0.093 + ((i * 7) % 3) * 0.028;
    const y = 1.16 - ((i * 13) % 9) * 0.195;
    return segment([x, y], [x - 0.1, y - 0.26], 0.005);
  }),
);

// ------------------------------------------------------------------- sea ----
const seaBody = union(
  rectangle([3.2, 1.5], [0, -1.2]),
  circle(0.22, [-1.05, -0.5]),
  circle(0.18, [-0.7, -0.46]),
  circle(0.2, [-0.32, -0.52]),
  circle(0.17, [0.2, -0.47]),
  circle(0.21, [0.66, -0.53]),
  circle(0.18, [1.08, -0.46]),
  { k: 0.12 },
);
const seaFoamLines = intersection(
  seaBody,
  union(
    ellipse(0.52, 0.02, [-0.72, -0.62]),
    ellipse(0.4, 0.017, [0.52, -0.68]),
    ellipse(0.34, 0.015, [-0.2, -0.86]),
    ellipse(0.46, 0.018, [0.72, -0.94]),
  ),
);

// --------------------------------------------------- lamp beams and glow ----
const beams = union(
  triangle([TX, LY], [-1.35, 0.98], [-1.35, 0.16]),
  triangle([TX, LY], [1.35, 0.96], [1.35, 0.18]),
);
const glowFar = circle(0.44, [TX, LY]);
const glowMid = circle(0.28, [TX, LY]);
const glowNear = circle(0.17, [TX, LY]);

// ------------------------------------------------------------ lighthouse ----
const tower = polygon([
  [TX - 0.215, -0.62],
  [TX + 0.215, -0.62],
  [TX + 0.11, 0.345],
  [TX - 0.11, 0.345],
]);
const towerShade = intersection(tower, rectangle([0.16, 1.4], [TX + 0.145, -0.1]));
const bandHigh = intersection(tower, rectangle([0.6, 0.13], [TX, 0.115]));
const bandLow = intersection(tower, rectangle([0.6, 0.15], [TX, -0.23]));
const door = rounded_rectangle([0.095, 0.15], [0.048, 0.048, 0, 0], [TX, -0.455]);
const windows = union(
  rounded_rectangle([0.055, 0.075], 0.026, [TX, -0.055]),
  rounded_rectangle([0.048, 0.065], 0.023, [TX, 0.23]),
);

const gallery = rectangle([0.345, 0.055], [TX, 0.372]);
const railing = union(
  rectangle([0.335, 0.014], [TX, 0.425]),
  ...[-0.15, -0.075, 0, 0.075, 0.15].map((dx) => rectangle([0.016, 0.052], [TX + dx, 0.4245])),
);

const lantern = rectangle([0.195, 0.15], [TX, LY]);
const mullions = intersection(
  lantern,
  union(rectangle([0.014, 0.18], [TX - 0.055, LY]), rectangle([0.014, 0.18], [TX + 0.055, LY])),
);
const lampCore = circle(0.052, [TX, LY]);

const roof = triangle([TX - 0.145, 0.552], [TX + 0.145, 0.552], [TX, 0.712]);
const finial = union(segment([TX, 0.7], [TX, 0.775], 0.01), circle(0.026, [TX, 0.792]));

// ------------------------------------------------------------------ rock ----
const rock = polygon([
  [-0.62, -0.34],
  [-0.34, -0.44],
  [-0.1, -0.36],
  [0.14, -0.47],
  [0.42, -0.35],
  [0.66, -0.46],
  [0.86, -0.3],
  [0.94, -1.1],
  [-0.72, -1.1],
]);
const rockLight = intersection(
  rock,
  union(
    polygon([
      [-0.3, -0.42],
      [-0.06, -0.35],
      [-0.12, -0.6],
      [-0.36, -0.66],
    ]),
    polygon([
      [0.44, -0.36],
      [0.66, -0.45],
      [0.72, -0.7],
      [0.48, -0.66],
    ]),
  ),
);

// ------------------------------------------------------- the exploding wave -
const waveLeft = union(
  circle(0.4, [-0.94, -0.52]),
  circle(0.38, [-0.68, -0.34]),
  circle(0.34, [-0.48, -0.13]),
  circle(0.29, [-0.35, 0.09]),
  circle(0.235, [-0.25, 0.29]),
  circle(0.175, [-0.13, 0.43]),
  circle(0.125, [-0.01, 0.45]),
  circle(0.085, [0.07, 0.37]),
  { k: 0.11 },
);
const waveRight = union(
  circle(0.28, [0.58, -0.36]),
  circle(0.25, [0.76, -0.18]),
  circle(0.195, [0.9, 0.03]),
  circle(0.14, [1.02, 0.2]),
  { k: 0.1 },
);
const waveBase = union(
  circle(0.27, [0.06, -0.58]),
  circle(0.24, [0.34, -0.52]),
  circle(0.22, [-0.18, -0.5]),
  { k: 0.12 },
);
const waveBody = union(waveLeft, waveRight, waveBase, { k: 0.07 });

const spray = union(
  ...[
    [-0.62, 0.62, 0.052],
    [-0.4, 0.74, 0.04],
    [-0.18, 0.8, 0.032],
    [-0.02, 0.68, 0.026],
    [0.1, 0.58, 0.02],
    [-0.78, 0.44, 0.044],
    [-0.95, 0.28, 0.034],
    [-1.08, 0.08, 0.026],
    [0.72, 0.34, 0.038],
    [0.92, 0.44, 0.028],
    [1.1, 0.36, 0.022],
    [0.5, 0.18, 0.024],
    [-0.52, 0.92, 0.022],
    [0.34, 0.62, 0.018],
    [1.05, 0.62, 0.016],
    [-1.14, 0.46, 0.018],
  ].map(([x, y, r]) => circle(r, [x, y])),
);
const waveAll = union(waveBody, spray);
const waveInner = erode(waveBody, 0.075);
const waveShade = intersection(
  waveBody,
  union(circle(0.32, [-1.0, -0.66]), circle(0.26, [-0.62, -0.54]), circle(0.22, [0.68, -0.42]), {
    k: 0.08,
  }),
);

// ---------------------------------------------------------------- layers ----
const layers = [
  { sdf: clouds, color: CLOUD },
  { sdf: cloudLight, color: CLOUD_LIGHT },
  { sdf: rain, color: RAIN },

  { sdf: seaBody, color: SEA_DARK },
  { sdf: seaFoamLines, color: SEA_MID },

  { sdf: beams, color: BEAM },
  { sdf: glowFar, color: GLOW_FAR },
  { sdf: glowMid, color: GLOW_MID },
  { sdf: glowNear, color: GLOW_NEAR },

  { sdf: dilate(tower, 0.028), color: OUTLINE },
  { sdf: tower, color: STONE },
  { sdf: towerShade, color: STONE_SHADE },
  { sdf: bandHigh, color: BAND_RED },
  { sdf: bandLow, color: BAND_RED },
  { sdf: door, color: OUTLINE },
  { sdf: dilate(windows, 0.012), color: OUTLINE },
  { sdf: windows, color: LAMP_GLASS },

  { sdf: dilate(gallery, 0.022), color: OUTLINE },
  { sdf: gallery, color: STONE_SHADE },
  { sdf: railing, color: OUTLINE },

  { sdf: dilate(lantern, 0.022), color: OUTLINE },
  { sdf: lantern, color: LAMP_GLASS },
  { sdf: lampCore, color: LAMP_CORE },
  { sdf: mullions, color: OUTLINE },

  { sdf: dilate(roof, 0.022), color: OUTLINE },
  { sdf: roof, color: BAND_RED },
  { sdf: finial, color: OUTLINE },

  { sdf: dilate(rock, 0.026), color: OUTLINE },
  { sdf: rock, color: ROCK },
  { sdf: rockLight, color: ROCK_LIGHT },

  { sdf: dilate(waveAll, 0.02), color: FOAM_SHADE },
  { sdf: waveAll, color: FOAM },
  { sdf: waveInner, color: FOAM_WHITE },
  { sdf: waveShade, color: FOAM_SHADE },
];

// ---------------------------------------------------------------- render ----
// —— painted 展示接线 (scene 34) ——
export const getSdfs = () => layers.map((l) => l.sdf);
