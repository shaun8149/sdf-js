import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  polygon,
  segment,
  union,
  intersection,
  difference,
  dilate,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const BG_TOP = [243, 231, 209];
const BG_BOT = [226, 206, 178];
const HALO = [250, 241, 222];
const SHADOW = [211, 190, 162];
const OUTLINE = [38, 28, 24];
const WALNUT = [126, 76, 45];
const WALNUT_D = [94, 55, 32];
const WALNUT_L = [154, 98, 60];
const BRASS = [216, 164, 76];
const BRASS_D = [166, 112, 44];
const BRASS_L = [239, 207, 142];
const STEEL = [112, 108, 110];
const STEEL_L = [156, 152, 152];
const VINYL = [42, 38, 40];
const LABEL = [188, 74, 56];

// ------------------------------------------------------- horn axis params
// throat T -> bell centre B ; n = unit perpendicular to that axis
const RIM_ANG = 0.609; // rim orientation, radians (~34.9 deg)
const B = [-0.28, 0.58]; // bell centre

// exponential-ish flare traced by hand: throat -> rim (side A), rim chord,
// rim -> throat (side B)
const flare = polygon([
  [0.139, -0.109],
  [-0.001, 0.039],
  [-0.173, 0.164],
  [-0.387, 0.261],
  [-0.625, 0.34], // outer rim, lower-left
  [0.065, 0.82], // outer rim, upper-right
  [0.057, 0.569],
  [0.073, 0.336],
  [0.131, 0.131],
  [0.221, -0.051],
]);

const bellMouth = ellipse(0.42, 0.125).rotate(RIM_ANG).translate(B);
const horn = union(flare, bellMouth, { k: 0.02 });

// inside of the bell + a reflected-light crescent on the far wall
const bellInner = ellipse(0.345, 0.095).rotate(RIM_ANG).translate(B);
const bellGlint = intersection(bellInner, circle(0.46, [-0.46, 0.73]));

// two turned reinforcement ribs, clipped to the flare (idiom #3)
const ribBar = (cx, cy) =>
  intersection(flare, rectangle([1.6, 0.02]).rotate(RIM_ANG).translate([cx, cy]));
const ribs = union(ribBar(-0.073, 0.283), ribBar(-0.188, 0.448));

// -------------------------------------------------------------- tone arm
const post = segment([0.235, -0.235], [0.2, -0.1], 0.032);
const elbow = circle(0.052, [0.185, -0.088]);
const arm1 = segment([0.185, -0.088], [0.06, -0.152], 0.028);
const soundbox = circle(0.058, [0.02, -0.17]);
const needle = segment([0.02, -0.17], [-0.052, -0.198], 0.013);
const toneArm = union(elbow, arm1, soundbox, needle, { k: 0.015 });

// ---------------------------------------------------------------- cabinet
const cabinet = rounded_rectangle([0.64, 0.28], 0.035, [0, -0.36]);
const cabBand = intersection(cabinet, rectangle([1.0, 0.038], [0, -0.445]));
const cabTopLip = intersection(cabinet, rectangle([1.0, 0.03], [0, -0.243]));

// platter + record
const platter = ellipse(0.25, 0.06, [-0.02, -0.2]);
const record = ellipse(0.215, 0.05, [-0.02, -0.196]);
const groove = difference(
  ellipse(0.168, 0.039, [-0.02, -0.196]),
  ellipse(0.152, 0.035, [-0.02, -0.196]),
);
const label = ellipse(0.056, 0.014, [-0.02, -0.194]);

// ------------------------------------------------------------------ crank
const crankShaft = segment([0.31, -0.36], [0.43, -0.36], 0.019);
const crankArm = segment([0.43, -0.36], [0.43, -0.47], 0.017);
const crankBoss = circle(0.038, [0.316, -0.36]);
const crankMetal = union(crankShaft, crankArm, crankBoss, { k: 0.012 });
const crankGrip = segment([0.43, -0.468], [0.43, -0.548], 0.031);

// ------------------------------------------------------------------ table
const tabletop = rounded_rectangle([1.18, 0.075], 0.02, [0, -0.55]);
const apron = rectangle([1.02, 0.062], [0, -0.617]);
const legL = polygon([
  [-0.47, -0.6],
  [-0.36, -0.6],
  [-0.39, -1.02],
  [-0.45, -1.02],
]);
const legR = polygon([
  [0.36, -0.6],
  [0.47, -0.6],
  [0.45, -1.02],
  [0.39, -1.02],
]);
const stretch = union(rectangle([0.8, 0.04], [0, -0.88]), circle(0.046, [0, -0.88]));
const feet = union(
  rounded_rectangle([0.105, 0.046], 0.016, [-0.42, -1.02]),
  rounded_rectangle([0.105, 0.046], 0.016, [0.42, -1.02]),
);
const table = union(tabletop, legL, legR, stretch, feet);

// leaning record against the left leg
const leanDisc = circle(0.17, [-0.62, -0.85]);
const leanLabel = circle(0.052, [-0.62, -0.85]);

// ------------------------------------------------------- ambient elements
const halo = circle(0.8, [-0.1, 0.22]);
const floorCast = ellipse(0.72, 0.05, [-0.05, -1.02]);

// ----------------------------------------------------------------- layers
const layers = [
  { sdf: halo, color: HALO },
  { sdf: floorCast, color: SHADOW },

  // table
  { sdf: dilate(table, 0.022), color: OUTLINE },
  { sdf: table, color: WALNUT },
  { sdf: dilate(apron, 0.018), color: OUTLINE },
  { sdf: apron, color: WALNUT_D },

  // leaning record
  { sdf: dilate(leanDisc, 0.016), color: OUTLINE },
  { sdf: leanDisc, color: VINYL },
  { sdf: leanLabel, color: LABEL },

  // cabinet
  { sdf: dilate(cabinet, 0.024), color: OUTLINE },
  { sdf: cabinet, color: WALNUT },
  { sdf: cabBand, color: WALNUT_D },
  { sdf: cabTopLip, color: WALNUT_L },

  // crank
  { sdf: dilate(crankMetal, 0.011), color: OUTLINE },
  { sdf: crankMetal, color: STEEL },
  { sdf: dilate(crankGrip, 0.012), color: OUTLINE },
  { sdf: crankGrip, color: WALNUT_D },

  // platter + record
  { sdf: dilate(platter, 0.014), color: OUTLINE },
  { sdf: platter, color: STEEL_L },
  { sdf: record, color: VINYL },
  { sdf: groove, color: [72, 66, 68] },
  { sdf: label, color: LABEL },

  // horn support post (behind the horn)
  { sdf: dilate(post, 0.012), color: OUTLINE },
  { sdf: post, color: STEEL },

  // the horn — hero element, heaviest outline
  { sdf: dilate(horn, 0.028), color: OUTLINE },
  { sdf: horn, color: BRASS },
  { sdf: ribs, color: BRASS_D },
  { sdf: dilate(bellInner, 0.014), color: OUTLINE },
  { sdf: bellInner, color: BRASS_D },
  { sdf: bellGlint, color: BRASS_L },

  // tone arm rides over the record
  { sdf: dilate(toneArm, 0.012), color: OUTLINE },
  { sdf: toneArm, color: STEEL },
];

// ----------------------------------------------------------------- render
// —— painted 展示接线 (scene 24) ——
export const getSdfs = () => layers.map((l) => l.sdf);
