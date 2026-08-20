import {
  circle,
  ellipse,
  rectangle,
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

// ─── Palette (Prussian-blue woodblock) ───────────────────────────────
const SKY_TOP = [228, 216, 190];
const SKY_BOT = [244, 237, 219];
const DEEP = [24, 46, 84]; // Prussian blue, dark
const MID = [52, 92, 142]; // mid indigo
const PALE = [138, 172, 198]; // pale streak
const FOAM = [247, 245, 237]; // paper white
const OUTLINE = [15, 26, 46];
const FUJI_ROCK = [84, 102, 116];
const HULL = [58, 50, 42];

// ─── Helper: tapered curling finger (smooth-union of shrinking discs) ─
function finger(pts, r0, r1, k = 0.022) {
  const n = pts.length;
  return union(...pts.map((p, i) => circle(r0 + (r1 - r0) * (i / (n - 1)), p)), { k });
}

// ─── Mt. Fuji, small and distant in the pocket of the wave ───────────
const fuji = triangle([0.0, -0.3], [0.66, -0.3], [0.33, 0.12]);
const snowMask = polygon([
  [0.08, -0.02],
  [0.17, -0.05],
  [0.25, -0.01],
  [0.33, -0.06],
  [0.41, -0.01],
  [0.5, -0.05],
  [0.6, 0.02],
  [0.6, 0.3],
  [0.08, 0.3],
]);
const fujiSnow = intersection(fuji, snowMask);

// ─── Sea plane: undulating dark mass across the bottom ───────────────
const sea = polygon([
  [-1.45, -1.45],
  [1.45, -1.45],
  [1.45, -0.34],
  [1.1, -0.28],
  [0.84, -0.42],
  [0.58, -0.31],
  [0.3, -0.41],
  [0.02, -0.28],
  [-0.28, -0.42],
  [-0.58, -0.33],
  [-0.96, -0.5],
  [-1.45, -0.44],
]);

// ─── Secondary swell on the right ────────────────────────────────────
const swell = polygon([
  [0.66, -0.42],
  [0.88, -0.26],
  [1.05, -0.04],
  [1.22, 0.14],
  [1.45, 0.06],
  [1.45, -0.3],
  [1.18, -0.48],
  [0.9, -0.58],
]);
const swellFoam = union(
  circle(0.075, [0.9, -0.24]),
  circle(0.085, [1.06, -0.03]),
  circle(0.08, [1.21, 0.13]),
  circle(0.06, [1.36, 0.12]),
  finger(
    [
      [1.05, -0.05],
      [0.98, -0.14],
      [0.9, -0.21],
      [0.83, -0.25],
    ],
    0.055,
    0.01,
  ),
  { k: 0.035 },
);

// ─── THE GREAT WAVE: one closed band, back edge up + curl hooking back ─
const wave = polygon([
  // rising back (outer) edge, bottom-left → crest
  [-1.45, -1.05],
  [-1.34, -0.34],
  [-1.16, 0.08],
  [-0.94, 0.42],
  [-0.68, 0.68],
  [-0.42, 0.86],
  [-0.1, 0.94],
  [0.22, 0.9],
  [0.48, 0.76],
  [0.66, 0.58],
  // the curl: over the top and hooking back to the left
  [0.73, 0.4],
  [0.68, 0.29],
  [0.56, 0.28],
  [0.44, 0.36],
  [0.28, 0.5],
  [0.1, 0.52],
  // concave inner face falling to the trough
  [-0.1, 0.42],
  [-0.3, 0.22],
  [-0.48, -0.05],
  [-0.62, -0.34],
  [-0.8, -0.58],
  [-1.02, -0.8],
]);

// Tonal banding: dark rim, mid core, pale combed streaks on the face
const waveCore = erode(wave, 0.11);
const streaks = intersection(
  union(
    finger(
      [
        [-1.1, -0.1],
        [-0.9, 0.14],
        [-0.68, 0.36],
        [-0.46, 0.52],
      ],
      0.016,
      0.008,
    ),
    finger(
      [
        [-0.96, -0.32],
        [-0.74, -0.06],
        [-0.52, 0.16],
        [-0.3, 0.3],
      ],
      0.014,
      0.007,
    ),
    finger(
      [
        [-0.34, 0.62],
        [-0.1, 0.72],
        [0.14, 0.7],
        [0.36, 0.6],
      ],
      0.014,
      0.007,
    ),
    finger(
      [
        [0.06, 0.4],
        [0.24, 0.42],
        [0.42, 0.34],
      ],
      0.012,
      0.006,
    ),
    { k: 0.02 },
  ),
  waveCore,
);

// ─── Foam: crest lobes + curling claw-fingers ────────────────────────
const crest = union(
  circle(0.085, [-0.58, 0.56]),
  circle(0.098, [-0.44, 0.72]),
  circle(0.11, [-0.24, 0.84]),
  circle(0.116, [-0.04, 0.89]),
  circle(0.11, [0.16, 0.85]),
  circle(0.104, [0.34, 0.75]),
  circle(0.096, [0.5, 0.63]),
  circle(0.082, [0.62, 0.49]),
  circle(0.068, [0.66, 0.36]),
  circle(0.052, [0.55, 0.31]),
  { k: 0.045 },
);

const claws = union(
  // long claw dropping over the boat
  finger(
    [
      [0.54, 0.33],
      [0.5, 0.21],
      [0.44, 0.11],
      [0.37, 0.04],
      [0.31, 0.0],
    ],
    0.072,
    0.011,
  ),
  finger(
    [
      [0.34, 0.45],
      [0.29, 0.33],
      [0.22, 0.23],
      [0.15, 0.16],
      [0.08, 0.12],
    ],
    0.066,
    0.01,
  ),
  finger(
    [
      [0.11, 0.52],
      [0.05, 0.41],
      [-0.02, 0.32],
      [-0.09, 0.26],
      [-0.16, 0.22],
    ],
    0.06,
    0.01,
  ),
  finger(
    [
      [-0.1, 0.44],
      [-0.16, 0.36],
      [-0.23, 0.29],
      [-0.3, 0.25],
    ],
    0.052,
    0.009,
  ),
  // outer claw curling down the far side of the crest
  finger(
    [
      [0.62, 0.47],
      [0.68, 0.38],
      [0.71, 0.28],
      [0.7, 0.19],
    ],
    0.048,
    0.009,
  ),
  // short splinter fingers
  finger(
    [
      [0.46, 0.2],
      [0.42, 0.12],
      [0.37, 0.07],
    ],
    0.03,
    0.008,
  ),
  finger(
    [
      [0.24, 0.26],
      [0.19, 0.19],
      [0.14, 0.15],
    ],
    0.026,
    0.007,
  ),
  finger(
    [
      [-0.02, 0.34],
      [-0.07, 0.28],
      [-0.12, 0.25],
    ],
    0.022,
    0.007,
  ),
  { k: 0.028 },
);

const foam = union(crest, claws, { k: 0.03 });

// ─── Boat riding the trough beneath the claws ────────────────────────
const hull = polygon([
  [-0.21, 0.01],
  [0.23, 0.01],
  [0.28, 0.048],
  [0.16, -0.04],
  [-0.15, -0.04],
])
  .rotate(-0.22)
  .translate([0.06, -0.2]);
const rowers = union(
  ...[-0.14, -0.07, 0.0, 0.07, 0.14].map((t, i) => circle(0.019, [t, 0.03 + (i % 2) * 0.006])),
  { k: 0.01 },
)
  .rotate(-0.22)
  .translate([0.06, -0.2]);
const boat = union(hull, rowers, { k: 0.012 });

// ─── Airborne spray ──────────────────────────────────────────────────
const spray = union(
  circle(0.022, [-0.02, 1.08]),
  circle(0.015, [0.2, 1.02]),
  circle(0.012, [-0.26, 1.0]),
  circle(0.018, [0.44, 0.92]),
  circle(0.01, [0.6, 0.8]),
  circle(0.013, [-0.5, 0.88]),
  circle(0.009, [0.34, 1.06]),
  circle(0.011, [-0.14, 0.62]),
  circle(0.008, [0.8, 0.58]),
  circle(0.01, [0.14, 0.06]),
  circle(0.008, [-0.2, 0.14]),
);

// ─── Layers (back → front) ───────────────────────────────────────────
const layers = [
  { sdf: dilate(fuji, 0.012), color: OUTLINE },
  { sdf: fuji, color: FUJI_ROCK },
  { sdf: fujiSnow, color: FOAM },

  { sdf: dilate(swell, 0.018), color: OUTLINE },
  { sdf: swell, color: MID },
  { sdf: dilate(swellFoam, 0.01), color: OUTLINE },
  { sdf: swellFoam, color: FOAM },

  { sdf: dilate(sea, 0.02), color: OUTLINE },
  { sdf: sea, color: DEEP },

  { sdf: dilate(wave, 0.03), color: OUTLINE },
  { sdf: wave, color: DEEP },
  { sdf: waveCore, color: MID },
  { sdf: streaks, color: PALE },

  { sdf: dilate(boat, 0.012), color: OUTLINE },
  { sdf: boat, color: HULL },

  { sdf: dilate(foam, 0.016), color: OUTLINE },
  { sdf: foam, color: FOAM },

  { sdf: spray, color: FOAM },
];

// ─── Render ──────────────────────────────────────────────────────────
// —— painted 展示接线 (scene 28) ——
export const getSdfs = () => layers.map((l) => l.sdf);
