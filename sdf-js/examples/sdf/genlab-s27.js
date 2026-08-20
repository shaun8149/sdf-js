import {
  circle,
  ellipse,
  rectangle,
  polygon,
  arc,
  ring,
  moon,
  union,
  intersection,
  dilate,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const SKY_TOP = [18, 30, 86];
const SKY_BOT = [34, 70, 132];
const SWIRL_DEEP = [13, 25, 72];
const SWIRL_MID = [46, 92, 158];
const SWIRL_LT = [112, 168, 210];
const SWIRL_PALE = [208, 228, 238];
const GLOW = [190, 152, 58];
const STAR_C = [252, 238, 158];
const MOON_C = [250, 220, 118];
const HILL = [26, 50, 94];
const GROUND = [15, 28, 60];
const WALL = [24, 40, 76];
const ROOF = [46, 66, 104];
const WINDOW = [244, 198, 92];
const OUTLINE = [7, 13, 34];
const CYPRESS = [16, 33, 29];
const CYP_HI = [40, 64, 50];

// ------------------------------------------------------- parametric tools

// A spiral: chain of arc segments whose radius grows and whose phase advances.
function spiral(center, r0, growth, segs, thickness, phase = 0, dir = 1) {
  const step = 1.85;
  const parts = [];
  for (let i = 0; i < segs; i++) {
    const r = r0 + growth * i;
    const t = Math.max(thickness * (1 - 0.05 * i), 0.006);
    parts.push(
      arc(r, step / 2 + 0.14, t, [0, 0])
        .rotate(phase + dir * step * i)
        .translate(center),
    );
  }
  return union(...parts, { k: 0.025 });
}

// A single sweeping brush-band across the sky.
function band(center, r, halfAp, t, rot) {
  return arc(r, halfAp, t, [0, 0]).rotate(rot).translate(center);
}

const HB = -0.44; // village baseline
function house(cx, w, h, roofH) {
  const hw = w / 2;
  return union(
    rectangle([w, h], [cx, HB + h / 2]),
    polygon([
      [cx - hw * 1.24, HB + h],
      [cx + hw * 1.24, HB + h],
      [cx, HB + h + roofH],
    ]),
  );
}

// --------------------------------------------------------------- the sky

// Darker cloud mass sitting over the gradient — gives the sky depth.
const deepMass = union(
  ellipse(0.58, 0.26, [-0.55, 0.3]),
  ellipse(0.52, 0.25, [0.15, 0.54]),
  ellipse(0.46, 0.22, [0.72, 0.18]),
  ellipse(0.62, 0.2, [-0.1, -0.05]),
  ellipse(0.4, 0.18, [0.88, 0.64]),
  { k: 0.25 },
);

const midBands = union(
  band([-0.45, -0.75], 1.25, 0.62, 0.036, -0.15),
  band([0.75, -0.85], 1.3, 0.55, 0.032, 0.35),
  band([-1.1, 0.05], 1.05, 0.75, 0.03, -1.15),
  band([0.1, 1.75], 1.05, 0.65, 0.034, Math.PI),
  band([1.15, 0.55], 0.75, 0.85, 0.026, 1.9),
  band([-0.2, -0.45], 0.85, 0.5, 0.028, -0.5),
  { k: 0.04 },
);

const spiralA = spiral([-0.08, 0.44], 0.075, 0.056, 7, 0.036, 0.4, 1);
const spiralB = spiral([0.46, 0.26], 0.06, 0.048, 6, 0.03, 1.6, -1);
const spiralC = spiral([-0.7, 0.14], 0.048, 0.038, 5, 0.024, 2.4, 1);
const midSwirl = union(midBands, spiralA, spiralB, spiralC, { k: 0.03 });

const lightBands = union(
  band([-0.45, -0.75], 1.17, 0.58, 0.018, -0.13),
  band([0.75, -0.85], 1.22, 0.5, 0.016, 0.37),
  band([-1.1, 0.05], 0.97, 0.7, 0.015, -1.15),
  band([0.1, 1.75], 1.13, 0.6, 0.016, Math.PI),
  band([1.15, 0.55], 0.67, 0.8, 0.014, 1.9),
  { k: 0.03 },
);

const paleSwirl = union(
  spiral([-0.08, 0.44], 0.075, 0.056, 7, 0.014, 0.5, 1),
  spiral([0.46, 0.26], 0.06, 0.048, 6, 0.012, 1.7, -1),
  spiral([-0.7, 0.14], 0.048, 0.038, 5, 0.01, 2.5, 1),
  { k: 0.02 },
);

// ------------------------------------------------------------- the stars
const STARS = [
  [-0.92, 0.62, 0.032],
  [-0.62, 0.9, 0.042],
  [-0.34, 0.55, 0.028],
  [-0.02, 0.98, 0.036],
  [0.24, 0.7, 0.026],
  [0.34, 1.04, 0.03],
  [0.8, 0.5, 0.038],
  [0.98, 0.2, 0.03],
  [-0.16, 0.18, 0.022],
];

const starHalo = union(
  ...STARS.map(([x, y, r]) =>
    union(ring(r * 2.1, r * 0.42, [x, y]), ring(r * 3.3, r * 0.26, [x, y])),
  ),
);
const starCore = union(...STARS.map(([x, y, r]) => circle(r, [x, y])));

// -------------------------------------------------------------- the moon
const moonC = [0.86, 0.8];
const crescent = moon(0.11, 0.3).rotate(3.35).translate(moonC);
const moonHalo = union(ring(0.44, 0.055, moonC), ring(0.58, 0.032, moonC), ring(0.71, 0.02, moonC));

// ------------------------------------------------- hills, ground, village
const hills = union(
  ellipse(0.85, 0.24, [-0.8, -0.44]),
  ellipse(0.7, 0.17, [-0.05, -0.5]),
  ellipse(0.92, 0.22, [0.85, -0.46]),
  rectangle([3.0, 1.0], [0, -1.0]),
  { k: 0.1 },
);

const ground = rectangle([3.0, 1.6], [0, -1.2]);

const houses = union(
  house(-0.74, 0.16, 0.1, 0.06),
  house(-0.5, 0.2, 0.14, 0.08),
  house(-0.29, 0.16, 0.11, 0.07),
  house(-0.11, 0.22, 0.16, 0.09),
  house(0.22, 0.18, 0.12, 0.075),
  house(0.42, 0.24, 0.15, 0.09),
  house(0.64, 0.18, 0.11, 0.07),
  house(0.85, 0.22, 0.13, 0.08),
);

// Church: nave + steep roof + tower + tall spire piercing the swirl.
const church = union(
  rectangle([0.22, 0.2], [0.03, -0.34]),
  polygon([
    [-0.09, -0.24],
    [0.15, -0.24],
    [0.03, -0.13],
  ]),
  rectangle([0.095, 0.34], [0.03, -0.12]),
  polygon([
    [-0.02, 0.05],
    [0.08, 0.05],
    [0.03, 0.36],
  ]),
);

const village = union(houses, church);

const windows = union(
  rectangle([0.032, 0.03], [-0.74, -0.4]),
  rectangle([0.036, 0.034], [-0.52, -0.385]),
  rectangle([0.032, 0.03], [-0.29, -0.395]),
  rectangle([0.038, 0.036], [-0.15, -0.375]),
  rectangle([0.038, 0.036], [-0.06, -0.375]),
  rectangle([0.034, 0.032], [0.22, -0.39]),
  rectangle([0.038, 0.036], [0.38, -0.38]),
  rectangle([0.038, 0.036], [0.47, -0.38]),
  rectangle([0.032, 0.03], [0.64, -0.395]),
  rectangle([0.036, 0.034], [0.85, -0.385]),
);

const roofs = intersection(
  village,
  union(rectangle([3.0, 0.16], [0, -0.235]), rectangle([0.3, 0.5], [0.03, 0.1])),
);

// ------------------------------------------------------------ the cypress
const cypress = union(
  rectangle([0.3, 0.62], [-0.8, -0.76]),
  ellipse(0.22, 0.34, [-0.8, -0.3]),
  ellipse(0.2, 0.3, [-0.74, 0.05]),
  ellipse(0.155, 0.28, [-0.85, 0.34]),
  ellipse(0.115, 0.22, [-0.76, 0.58]),
  ellipse(0.075, 0.16, [-0.84, 0.76]),
  ellipse(0.038, 0.11, [-0.79, 0.9]),
  { k: 0.09 },
);

const cypressSmall = union(
  rectangle([0.16, 0.4], [-1.06, -0.8]),
  ellipse(0.11, 0.2, [-1.06, -0.42]),
  ellipse(0.085, 0.17, [-1.02, -0.12]),
  ellipse(0.055, 0.13, [-1.08, 0.1]),
  ellipse(0.026, 0.08, [-1.04, 0.25]),
  { k: 0.07 },
);

// Flame-licks inside the cypress: arcs clipped to the silhouette (idiom #3).
const cypressStrokes = intersection(
  union(
    arc(0.55, 0.5, 0.016, [-0.32, -0.42]).rotate(1.48),
    arc(0.52, 0.52, 0.015, [-0.3, -0.06]).rotate(1.52),
    arc(0.46, 0.58, 0.014, [-0.38, 0.32]).rotate(1.6),
    arc(0.38, 0.6, 0.012, [-0.44, 0.62]).rotate(1.56),
    arc(0.6, 0.4, 0.014, [-1.32, -0.2]).rotate(-1.5),
  ),
  cypress,
);

// -------------------------------------------------------------- layering
const layers = [
  { sdf: deepMass, color: SWIRL_DEEP },
  { sdf: midSwirl, color: SWIRL_MID },
  { sdf: lightBands, color: SWIRL_LT },
  { sdf: paleSwirl, color: SWIRL_PALE },

  { sdf: starHalo, color: GLOW },
  { sdf: moonHalo, color: GLOW },
  { sdf: starCore, color: STAR_C },
  { sdf: crescent, color: MOON_C },

  { sdf: hills, color: HILL },
  { sdf: ground, color: GROUND },

  { sdf: dilate(village, 0.014), color: OUTLINE },
  { sdf: village, color: WALL },
  { sdf: roofs, color: ROOF },
  { sdf: windows, color: WINDOW },

  { sdf: dilate(cypressSmall, 0.01), color: OUTLINE },
  { sdf: cypressSmall, color: CYPRESS },
  { sdf: dilate(cypress, 0.016), color: OUTLINE },
  { sdf: cypress, color: CYPRESS },
  { sdf: cypressStrokes, color: CYP_HI },
];

// ---------------------------------------------------------------- render
// —— painted 展示接线 (scene 27) ——
export const getSdfs = () => layers.map((l) => l.sdf);
