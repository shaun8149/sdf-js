import {
  circle,
  ellipse,
  rectangle,
  polygon,
  triangle,
  union,
  intersection,
  difference,
  dilate,
  shell,
  render,
} from '../../src/index.js';

// ---------- palette ----------
const SKY_TOP = [158, 192, 212];
const SKY_BOT = [246, 228, 192];
const HALO = [249, 238, 206];
const SUN = [253, 243, 199];
const FAR_A = [199, 201, 187]; // farthest, palest haze
const FAR_B = [172, 177, 149]; // nearer distant ridge
const HILL = [227, 185, 97]; // golden wheat hill
const CONTOUR = [198, 151, 67]; // plough lines
const SHOULDER = [184, 135, 57]; // foreground ochre mound
const ROAD = [248, 245, 236]; // white gravel
const HOUSE = [233, 216, 184]; // warm stucco
const ROOF = [176, 90, 58]; // terracotta
const WINDOW = [70, 58, 50];
const CYPRESS = [54, 80, 60];
const OUTLINE = [44, 35, 29];

// ---------- sky ----------
const halo = circle(0.27, [-0.6, 0.7]);
const sun = circle(0.115, [-0.6, 0.7]);

// ---------- distant ridges ----------
const farA = union(ellipse(1.3, 0.4, [-0.55, 0.0]), ellipse(1.0, 0.3, [0.75, 0.02]), { k: 0.12 });

const farB = union(
  ellipse(1.15, 0.35, [-0.95, -0.05]),
  ellipse(0.95, 0.3, [0.45, -0.06]),
  ellipse(0.7, 0.24, [1.15, -0.04]),
  { k: 0.12 },
);

// ---------- the golden wave ----------
const hillA = ellipse(1.55, 1.15, [0.05, -0.8]); // main crest, top y = 0.35
const hillB = ellipse(0.9, 0.75, [-0.85, -0.55]); // secondary swell, breaks symmetry
const midHill = union(hillA, hillB, { k: 0.18 });

// ---------- winding gravel road (tapered ribbon, wide at the bottom) ----------
const road = polygon([
  // left kerb, bottom -> top
  [-0.5, -1.2],
  [-0.36, -0.9],
  [-0.545, -0.62],
  [-0.615, -0.36],
  [-0.422, -0.14],
  [-0.155, -0.02],
  [0.078, 0.06],
  [0.17, 0.18],
  [0.11, 0.3],
  // right kerb, top -> bottom
  [0.15, 0.3],
  [0.23, 0.18],
  [0.162, 0.06],
  [-0.045, -0.02],
  [-0.278, -0.14],
  [-0.425, -0.36],
  [-0.295, -0.62],
  [-0.04, -0.9],
  [-0.1, -1.2],
]);

// ---------- contour ploughing: shells concentric with the crest, clipped to the hill ----------
function contourLine(rx, ry, t) {
  return difference(
    intersection(midHill, shell(ellipse(rx, ry, [0.05, -0.8]), t)),
    dilate(road, 0.024),
  );
}
const contours = union(
  contourLine(1.38, 1.0, 0.01),
  contourLine(1.18, 0.85, 0.01),
  contourLine(0.98, 0.7, 0.009),
  contourLine(0.76, 0.55, 0.008),
);

// ---------- farmhouse on the crest ----------
const body = rectangle([0.26, 0.15], [0.06, 0.405]);
const annex = rectangle([0.13, 0.105], [0.255, 0.383]);
const roofMain = polygon([
  [-0.1, 0.47],
  [0.22, 0.47],
  [0.175, 0.548],
  [-0.055, 0.548],
]);
const roofAnnex = polygon([
  [0.175, 0.428],
  [0.335, 0.428],
  [0.305, 0.478],
  [0.205, 0.478],
]);
const chimney = rectangle([0.032, 0.078], [0.155, 0.576]);

const houseMass = union(body, annex, roofMain, roofAnnex, chimney);
const houseWalls = union(body, annex);
const houseRoofs = union(roofMain, roofAnnex, chimney);
const openings = union(
  rectangle([0.026, 0.036], [-0.015, 0.418]),
  rectangle([0.026, 0.036], [0.075, 0.418]),
  rectangle([0.03, 0.056], [0.148, 0.358]), // door at the road head
  rectangle([0.022, 0.03], [0.255, 0.388]),
);

// ---------- cypress builder ----------
function cypress(x, baseY, h, w) {
  const lower = ellipse(w, h * 0.42, [0, h * 0.42]);
  const upper = triangle([-w * 0.92, h * 0.3], [w * 0.92, h * 0.3], [0, h]);
  return union(lower, upper, { k: 0.03 }).translate([x, baseY]);
}

const crownRow = union(
  cypress(-0.36, 0.295, 0.26, 0.046),
  cypress(-0.19, 0.31, 0.34, 0.054),
  cypress(0.37, 0.305, 0.4, 0.057),
  cypress(0.5, 0.285, 0.33, 0.05),
  cypress(0.62, 0.252, 0.27, 0.045),
  cypress(0.75, 0.208, 0.21, 0.039),
  cypress(0.87, 0.158, 0.16, 0.033),
);

const roadside = union(
  cypress(-0.7, 0.05, 0.2, 0.04),
  cypress(-0.79, -0.22, 0.16, 0.034),
  cypress(-0.3, -0.52, 0.14, 0.03),
);

const trees = union(crownRow, roadside);

// ---------- foreground shoulders (occlude the road's start) ----------
const foreShoulders = union(ellipse(0.85, 0.55, [-1.25, -1.2]), ellipse(0.95, 0.5, [1.3, -1.15]), {
  k: 0.1,
});

// ---------- layers, back to front ----------
const layers = [
  { sdf: halo, color: HALO },
  { sdf: sun, color: SUN },

  { sdf: farA, color: FAR_A },
  { sdf: farB, color: FAR_B },

  { sdf: dilate(midHill, 0.022), color: OUTLINE },
  { sdf: midHill, color: HILL },
  { sdf: contours, color: CONTOUR },

  { sdf: dilate(road, 0.012), color: OUTLINE },
  { sdf: road, color: ROAD },

  { sdf: dilate(houseMass, 0.018), color: OUTLINE },
  { sdf: houseWalls, color: HOUSE },
  { sdf: houseRoofs, color: ROOF },
  { sdf: openings, color: WINDOW },

  { sdf: dilate(trees, 0.014), color: OUTLINE },
  { sdf: trees, color: CYPRESS },

  { sdf: dilate(foreShoulders, 0.026), color: OUTLINE },
  { sdf: foreShoulders, color: SHOULDER },
];

// ---------- render ----------
// —— painted 展示接线 (scene 33) ——
export const getSdfs = () => layers.map((l) => l.sdf);
