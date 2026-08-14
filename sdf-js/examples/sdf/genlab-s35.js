import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  segment,
  polygon,
  union,
  intersection,
  difference,
  dilate,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const SKY_TOP = [168, 188, 204]; // cool alpine zenith
const SKY_BOT = [238, 227, 205]; // warm luminous haze at horizon
const FAR_PEAK = [188, 197, 206]; // barely-there distant range
const MID_PEAK = [146, 154, 162]; // nearer ridge, still atmospheric
const FOG = [227, 224, 214]; // the sea of fog itself
const FOG_HI = [242, 240, 233]; // drifting wisps, catching light
const CRAG = [104, 99, 90]; // rock islands emerging from the fog
const CRAG_DARK = [64, 60, 54];
const ROCK = [58, 52, 45]; // foreground summit
const ROCK_HI = [92, 83, 70]; // lit facet
const ROCK_EDGE = [24, 21, 18];
const COAT = [40, 47, 43]; // dark green frock coat
const COAT_HI = [62, 71, 64];
const HAIR = [104, 66, 42]; // Friedrich's reddish windblown hair
const CANE = [74, 58, 42];
const FIG_EDGE = [18, 17, 16];

// ------------------------------------------------------- distant ranges
const farPeaks = union(
  polygon([
    [-1.3, 0.1],
    [-0.82, 0.41],
    [-0.38, 0.1],
  ]),
  polygon([
    [-0.56, 0.1],
    [-0.24, 0.29],
    [0.06, 0.1],
  ]),
  polygon([
    [0.22, 0.1],
    [0.62, 0.45],
    [1.02, 0.1],
  ]),
  polygon([
    [0.84, 0.1],
    [1.16, 0.31],
    [1.3, 0.1],
  ]),
);

const midPeaks = union(
  polygon([
    [-0.98, 0.05],
    [-0.63, 0.27],
    [-0.28, 0.05],
  ]),
  polygon([
    [0.08, 0.05],
    [0.44, 0.29],
    [0.82, 0.05],
  ]),
  polygon([
    [0.62, 0.05],
    [0.96, 0.2],
    [1.28, 0.05],
  ]),
);

// ------------------------------------------------------- the sea of fog
const fogBody = rectangle([3.2, 1.3], [0, -0.5]); // y ∈ [-1.15, +0.15]
const fogSwell = union(
  ellipse(0.46, 0.055, [-0.95, 0.135]),
  ellipse(0.33, 0.045, [-0.42, 0.15]),
  ellipse(0.5, 0.062, [0.26, 0.14]),
  ellipse(0.37, 0.048, [0.93, 0.152]),
);
const fogSea = union(fogBody, fogSwell, { k: 0.05 });

// rock islands breaking the fog surface
const cragL = polygon([
  [-1.1, -0.3],
  [-1.06, -0.02],
  [-0.88, 0.07],
  [-0.72, -0.05],
  [-0.64, -0.3],
]);
const cragR = polygon([
  [0.56, -0.34],
  [0.62, -0.06],
  [0.78, 0.05],
  [0.96, -0.1],
  [1.04, -0.34],
]);
const crags = union(cragL, cragR);

// wisps drifting in FRONT of the crags — depth without shading
const wisps = union(
  ellipse(0.34, 0.03, [-0.8, -0.055]),
  ellipse(0.3, 0.026, [0.36, 0.02]),
  ellipse(0.44, 0.034, [0.82, -0.105]),
  ellipse(0.58, 0.04, [-0.1, -0.3]),
  ellipse(0.4, 0.03, [0.55, -0.4]),
);

// ------------------------------------------------------ foreground summit
const summit = polygon([
  [-1.35, -1.35],
  [-1.35, -0.75],
  [-0.86, -0.68],
  [-0.62, -0.5],
  [-0.44, -0.56],
  [-0.28, -0.32],
  [-0.16, -0.2],
  [-0.06, -0.115],
  [0.07, -0.105],
  [0.2, -0.145],
  [0.29, -0.28],
  [0.41, -0.24],
  [0.53, -0.45],
  [0.71, -0.4],
  [0.89, -0.62],
  [1.35, -0.7],
  [1.35, -1.35],
]);

// lit facet + fissures, both clipped to the summit silhouette
const summitLit = intersection(
  summit,
  polygon([
    [-0.3, -0.3],
    [0.1, -0.1],
    [0.26, -0.3],
    [0.02, -0.8],
    [-0.44, -0.62],
  ]),
);
const fissures = intersection(
  summit,
  union(
    segment([-0.1, -0.14], [-0.34, -0.9], 0.01),
    segment([0.16, -0.17], [0.46, -0.85], 0.008),
    segment([-0.62, -0.52], [-0.78, -1.0], 0.008),
  ),
);

// -------------------------------------------------------- the Rückenfigur
const coat = polygon([
  [-0.118, 0.05],
  [-0.11, 0.17],
  [-0.086, 0.29],
  [-0.072, 0.352],
  [-0.038, 0.392],
  [0.038, 0.392],
  [0.078, 0.352],
  [0.094, 0.29],
  [0.116, 0.17],
  [0.128, 0.05],
]);
const rightArm = circle(0.036, [0.1, 0.235]);
const neck = rectangle([0.048, 0.06], [0, 0.398]);
const head = circle(0.052, [0, 0.443]);
const legL = segment([-0.042, 0.1], [-0.054, -0.092], 0.03);
const legR = segment([0.044, 0.1], [0.06, -0.092], 0.03);
const bootL = rounded_rectangle([0.078, 0.036], 0.012, [-0.058, -0.098]);
const bootR = rounded_rectangle([0.078, 0.036], 0.012, [0.064, -0.098]);

const figure = union(coat, rightArm, neck, head, legL, legR, bootL, bootR, { k: 0.018 });

const hair = union(
  circle(0.055, [0, 0.456]),
  circle(0.022, [-0.052, 0.47]), // windblown tuft
  { k: 0.02 },
);
const hairMass = difference(hair, rectangle([0.26, 0.1], [0, 0.4]));

const coatLight = intersection(coat, ellipse(0.048, 0.15, [-0.062, 0.235]));

const cane = segment([0.132, 0.15], [0.216, -0.138], 0.009);
const hand = circle(0.02, [0.128, 0.148]);

// ---------------------------------------------------------------- layers
const layers = [
  { sdf: farPeaks, color: FAR_PEAK },
  { sdf: midPeaks, color: MID_PEAK },

  { sdf: fogSea, color: FOG },

  { sdf: dilate(crags, 0.01), color: CRAG_DARK },
  { sdf: crags, color: CRAG },

  { sdf: wisps, color: FOG_HI },

  { sdf: dilate(summit, 0.024), color: ROCK_EDGE },
  { sdf: summit, color: ROCK },
  { sdf: summitLit, color: ROCK_HI },
  { sdf: fissures, color: ROCK_EDGE },

  { sdf: dilate(cane, 0.008), color: FIG_EDGE },
  { sdf: cane, color: CANE },

  { sdf: dilate(figure, 0.013), color: FIG_EDGE },
  { sdf: figure, color: COAT },
  { sdf: coatLight, color: COAT_HI },
  { sdf: hand, color: FIG_EDGE },
  { sdf: hairMass, color: HAIR },
];

// ---------------------------------------------------------------- render
// —— painted 展示接线 (scene 35) ——
export const getSdfs = () => layers.map((l) => l.sdf);
