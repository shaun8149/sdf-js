import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  polygon,
  segment,
  ring,
  union,
  intersection,
  difference,
  dilate,
  erode,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const BG_TOP = [246, 240, 226];
const BG_BOTTOM = [228, 216, 194];
const DARK = [42, 30, 24];
const BINDING = [244, 236, 216];
const HONEY = [220, 158, 84];
const AMBER = [188, 112, 52];
const ROSEWOOD = [68, 46, 34];
const EBONY = [46, 32, 26];
const HOLE = [24, 18, 16];
const TERRACOTTA = [186, 74, 50];
const STRING = [250, 246, 236];
const PEARL = [238, 230, 212];
const TORTOISE = [124, 62, 40];

// ---------------------------------------------------------------- geometry
const BRIDGE_Y = -0.7;
const NUT_Y = 0.92;
const SCALE = NUT_Y - BRIDGE_Y; // 1.62 world units
const HOLE_C = [0, -0.34];

// Body: two overlapping bouts. The overlap cusps ARE the guitar waist.
const lowerBout = ellipse(0.46, 0.42, [0, -0.58]);
const upperBout = ellipse(0.36, 0.32, [0, 0.02]);
const body = union(lowerBout, upperBout, { k: 0.035 });

const bodyTop = erode(body, 0.02); // inside the binding
const sunburst = difference(bodyTop, erode(body, 0.135)); // darkened rim

// Pickguard — teardrop cut away from the sound hole, clipped to the top
const pickguardRaw = ellipse(0.155, 0.205).rotate(-0.38).translate([0.255, -0.5]);
const pickguard = intersection(difference(pickguardRaw, circle(0.168, HOLE_C)), erode(body, 0.045));

// Rosette + sound hole
const rosetteOuter = ring(0.15, 0.008, HOLE_C);
const rosetteMid = ring(0.13, 0.01, HOLE_C);
const rosetteInner = ring(0.113, 0.007, HOLE_C);
const soundHole = circle(0.106, HOLE_C);

// Bridge + saddle
const bridge = rounded_rectangle([0.38, 0.095], 0.028, [0, BRIDGE_Y]);
const wings = union(circle(0.03, [-0.205, BRIDGE_Y]), circle(0.03, [0.205, BRIDGE_Y]));
const bridgePlate = union(bridge, wings, { k: 0.02 });
const saddle = rectangle([0.26, 0.022], [0, BRIDGE_Y + 0.026]);
const pins = union(
  ...[-0.115, -0.069, -0.023, 0.023, 0.069, 0.115].map((x) => circle(0.014, [x, BRIDGE_Y - 0.02])),
);

// Neck (tapers slightly toward the nut) and fretboard
const neck = polygon([
  [-0.082, 0.24],
  [0.082, 0.24],
  [0.064, NUT_Y + 0.01],
  [-0.064, NUT_Y + 0.01],
]);
const fretboard = polygon([
  [-0.062, -0.16],
  [0.062, -0.16],
  [0.052, NUT_Y],
  [-0.052, NUT_Y],
]);

// Frets: equal-temperament spacing d = L * (1 - 2^(-n/12))
const fretY = (n) => NUT_Y - SCALE * (1 - Math.pow(2, -n / 12));
const fretBars = [];
for (let n = 1; n <= 18; n++) {
  fretBars.push(rectangle([0.14, 0.008], [0, fretY(n)]));
}
const frets = intersection(union(...fretBars), fretboard);

// Inlay dots (double at the 12th)
const dotAt = (n, dx = 0) => circle(0.013, [dx, (fretY(n - 1) + fretY(n)) / 2]);
const inlays = union(
  dotAt(3),
  dotAt(5),
  dotAt(7),
  dotAt(9),
  dotAt(12, -0.026),
  dotAt(12, 0.026),
  dotAt(15),
  dotAt(17),
);

// Headstock
const headstock = polygon([
  [-0.072, 0.88],
  [0.072, 0.88],
  [0.108, 0.99],
  [0.1, 1.14],
  [-0.1, 1.14],
  [-0.108, 0.99],
]);
const nut = rectangle([0.126, 0.024], [0, NUT_Y + 0.012]);

const pegY = [0.965, 1.035, 1.105];
const pegButtons = union(
  ...pegY.flatMap((y) => [ellipse(0.04, 0.024, [-0.145, y]), ellipse(0.04, 0.024, [0.145, y])]),
);
const pegShafts = union(
  ...pegY.flatMap((y) => [
    segment([-0.145, y], [-0.058, y], 0.008),
    segment([0.145, y], [0.058, y], 0.008),
  ]),
);
const pegPosts = union(
  ...pegY.flatMap((y) => [circle(0.02, [-0.058, y]), circle(0.02, [0.058, y])]),
);

// Strings: bridge fan (±0.115) converging to the nut (±0.042)
const stringBars = [];
for (let i = 0; i < 6; i++) {
  const t = i / 5 - 0.5; // -0.5 .. +0.5
  const x0 = t * 0.23; // at the bridge
  const x1 = t * 0.084; // at the nut
  const r = 0.0035 + i * 0.0008; // treble thin -> bass thick
  stringBars.push(segment([x0, BRIDGE_Y - 0.02], [x1, NUT_Y + 0.02], r));
}
const strings = union(...stringBars);

// ---------------------------------------------------------------- layers
const layers = [
  // body
  { sdf: dilate(body, 0.026), color: DARK },
  { sdf: body, color: BINDING },
  { sdf: bodyTop, color: HONEY },
  { sdf: sunburst, color: AMBER },

  // top furniture
  { sdf: dilate(pickguard, 0.01), color: DARK },
  { sdf: pickguard, color: TORTOISE },
  { sdf: rosetteOuter, color: DARK },
  { sdf: rosetteMid, color: TERRACOTTA },
  { sdf: rosetteInner, color: DARK },
  { sdf: dilate(soundHole, 0.012), color: DARK },
  { sdf: soundHole, color: HOLE },

  { sdf: dilate(bridgePlate, 0.016), color: DARK },
  { sdf: bridgePlate, color: ROSEWOOD },
  { sdf: saddle, color: PEARL },
  { sdf: pins, color: PEARL },

  // neck assembly
  { sdf: dilate(neck, 0.018), color: DARK },
  { sdf: neck, color: HONEY },
  { sdf: dilate(fretboard, 0.012), color: DARK },
  { sdf: fretboard, color: EBONY },
  { sdf: frets, color: PEARL },
  { sdf: inlays, color: PEARL },

  // headstock
  { sdf: dilate(headstock, 0.018), color: DARK },
  { sdf: headstock, color: ROSEWOOD },
  { sdf: pegShafts, color: DARK },
  { sdf: dilate(pegButtons, 0.01), color: DARK },
  { sdf: pegButtons, color: PEARL },
  { sdf: pegPosts, color: PEARL },
  { sdf: nut, color: BINDING },

  // strings last — they cross everything
  { sdf: strings, color: STRING },
];

// ---------------------------------------------------------------- render
// —— painted 展示接线 (scene 17) ——
export const getSdfs = () => layers.map((l) => l.sdf);
