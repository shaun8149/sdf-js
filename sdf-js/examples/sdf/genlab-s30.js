import {
  circle,
  ellipse,
  polygon,
  triangle,
  segment,
  line,
  slab,
  union,
  intersection,
  difference,
  dilate,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const STORM_DARK = [62, 76, 96];
const STORM_MID = [102, 122, 144];
const SHORE = [60, 78, 100];
const MIST = [204, 206, 198];
const WATER = [40, 62, 98];
const WATER_DEEP = [26, 42, 74];
const WAVE = [116, 146, 180];
const WOOD = [196, 154, 100];
const WOOD_DARK = [136, 96, 58];
const OUTLINE = [24, 24, 30];
const FIGURE = [36, 42, 56];
const UMB_STRAW = [216, 188, 132];
const UMB_BLUE = [168, 188, 206];
const RAIN_DARK = [28, 36, 50];
const RAIN_PALE = [216, 222, 226];

// deterministic pseudo-random
const h = (i) => {
  const s = Math.sin(i * 12.9898 + 1.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------- bridge axis parametrics
const BA = [-1.35, -0.4];
const BB = [1.35, 0.19];
const bd = [BB[0] - BA[0], BB[1] - BA[1]];
const bl = Math.hypot(bd[0], bd[1]);
const bu = [bd[0] / bl, bd[1] / bl];
const bn = [-bu[1], bu[0]]; // left-normal of the bridge

// point at fraction t along the bridge, offset `off` perpendicular
const bpt = (t, off) => [BA[0] + bd[0] * t + bn[0] * off, BA[1] + bd[1] * t + bn[1] * off];

// a band running the full length of the bridge between two offsets
const bband = (o0, o1) => polygon([bpt(-0.02, o0), bpt(1.02, o0), bpt(1.02, o1), bpt(-0.02, o1)]);

// ------------------------------------------------------------ sky & shore
const stormTop = slab({ y0: 1.0 });
const stormMid = slab({ y0: 0.86, y1: 1.01 });

const shoreBand = slab({ y0: 0.32, y1: 0.445 });
const roof = (cx, w, hh) => triangle([cx - w, 0.44], [cx + w, 0.44], [cx, 0.44 + hh]);
const roofs = union(
  roof(-0.98, 0.11, 0.045),
  roof(-0.62, 0.09, 0.036),
  roof(-0.24, 0.12, 0.052),
  roof(0.14, 0.07, 0.088), // pagoda
  roof(0.46, 0.1, 0.04),
  roof(0.82, 0.13, 0.055),
  roof(1.12, 0.09, 0.034),
);
const farShore = union(shoreBand, roofs);

const mistBand = slab({ y0: 0.27, y1: 0.335 });

// ------------------------------------------------------------------ river
const water = slab({ y1: 0.295 });
const waterDeep = slab({ y1: -0.82 });

// ----------------------------------------------------------- bridge parts
const underBeam = bband(-0.215, -0.145);

const piles = union(
  ...[0.13, 0.29, 0.45, 0.61, 0.77, 0.92].map((t) => {
    const p = bpt(t, -0.19);
    return segment(p, [p[0], p[1] - 0.22], 0.02);
  }),
);

const deck = bband(-0.075, 0.075);

const nearRailBar = bband(-0.145, -0.12);
const farRailBar = bband(0.12, 0.145);
const railPosts = [];
for (let i = 0; i <= 21; i++) {
  const t = 0.02 + i * 0.0455;
  railPosts.push(segment(bpt(t, 0.075), bpt(t, 0.148), 0.008));
  railPosts.push(segment(bpt(t, -0.075), bpt(t, -0.148), 0.008));
}
const rails = union(nearRailBar, farRailBar, ...railPosts);

const bridge = union(underBeam, piles, deck, rails);
const bridgeMass = bband(-0.26, 0.19);

// ------------------------------------------------------ waves (clipped)
const waveStrokes = [];
for (let i = 0; i < 20; i++) {
  const y = -1.12 + i * 0.088;
  const x = -1.15 + h(i * 3) * 2.2;
  const w = 0.1 + h(i * 3 + 1) * 0.16;
  waveStrokes.push(segment([x - w, y], [x + w, y + 0.014], 0.0065));
}
const waves = intersection(union(...waveStrokes), difference(water, bridgeMass));

// ----------------------------------------------------- figure + umbrella
function personBody() {
  const body = polygon([
    [-0.019, 0.0],
    [-0.033, 0.086],
    [-0.026, 0.124],
    [0.026, 0.124],
    [0.033, 0.086],
    [0.019, 0.0],
  ]);
  const head = circle(0.02, [0, 0.143]);
  return union(body, head, { k: 0.012 });
}

function umbrellaShape(r, tilt) {
  const dome = intersection(ellipse(r, r * 0.5), line([0, -1], [0, 0]));
  const finial = segment([0, 0], [0, r * 0.24], 0.006);
  const shaft = segment([0, 0.01], [0, -0.1], 0.0055);
  return union(dome, finial, shaft).rotate(tilt).translate([0, 0.196]);
}

const WALKERS = [
  { t: 0.08, s: 0.96, tilt: -0.1, r: 0.092, u: 0 },
  { t: 0.19, s: 0.87, tilt: 0.15, r: 0.076, u: 1 },
  { t: 0.3, s: 1.0, tilt: -0.06, r: 0.096, u: 0 },
  { t: 0.41, s: 0.85, tilt: 0.19, r: 0.074, u: 1 },
  { t: 0.53, s: 0.94, tilt: -0.15, r: 0.088, u: 0 },
  { t: 0.64, s: 0.9, tilt: 0.08, r: 0.082, u: 1 },
  { t: 0.76, s: 0.99, tilt: -0.04, r: 0.094, u: 0 },
  { t: 0.88, s: 0.83, tilt: 0.17, r: 0.072, u: 1 },
];

const bodies = [];
const umbA = [];
const umbB = [];
for (const w of WALKERS) {
  const foot = bpt(w.t, -0.03);
  bodies.push(personBody().scale(w.s).translate(foot));
  const u = umbrellaShape(w.r, w.tilt).scale(w.s).translate(foot);
  (w.u === 0 ? umbA : umbB).push(u);
}
const walkerBodies = union(...bodies);
const umbrellasA = union(...umbA);
const umbrellasB = union(...umbB);
const crowd = union(walkerBodies, umbrellasA, umbrellasB);

// ------------------------------------------------------------ log raft
const raft = polygon([
  [-0.46, -0.855],
  [0.14, -0.79],
  [0.16, -0.842],
  [-0.44, -0.907],
]);
const raftLogs = intersection(
  union(
    segment([-0.46, -0.872], [0.16, -0.808], 0.0045),
    segment([-0.46, -0.89], [0.16, -0.826], 0.0045),
  ),
  raft,
);
const poler = personBody().scale(0.62).translate([0.02, -0.8]);
const pole = segment([0.02, -0.72], [0.34, -0.985], 0.008);
const raftGroup = union(raft, poler, pole);

// ------------------------------------------------------------------ rain
const rainA = [];
for (let i = 0; i < 66; i++) {
  const x0 = -1.55 + h(i) * 3.15;
  const y0 = -0.95 + h(i + 100) * 2.45;
  const ln = 0.38 + h(i + 200) * 0.78;
  rainA.push(segment([x0, y0], [x0 - 0.28 * ln, y0 - ln], 0.0038));
}
const rainDark = union(...rainA);

const rainB = [];
for (let i = 0; i < 52; i++) {
  const x0 = -1.2 + h(i + 400) * 3.05;
  const y0 = -1.05 + h(i + 500) * 2.5;
  const ln = 0.34 + h(i + 600) * 0.7;
  rainB.push(segment([x0, y0], [x0 - 0.62 * ln, y0 - ln], 0.003));
}
const rainPale = union(...rainB);

// ----------------------------------------------------------------- layers
const layers = [
  { sdf: stormMid, color: STORM_MID },
  { sdf: stormTop, color: STORM_DARK },

  { sdf: farShore, color: SHORE },
  { sdf: mistBand, color: MIST },

  { sdf: water, color: WATER },
  { sdf: waterDeep, color: WATER_DEEP },
  { sdf: waves, color: WAVE },

  { sdf: dilate(raftGroup, 0.011), color: OUTLINE },
  { sdf: raft, color: WOOD_DARK },
  { sdf: raftLogs, color: OUTLINE },
  { sdf: poler, color: FIGURE },
  { sdf: pole, color: WOOD },

  { sdf: dilate(bridge, 0.028), color: OUTLINE },
  { sdf: underBeam, color: WOOD_DARK },
  { sdf: piles, color: WOOD_DARK },
  { sdf: deck, color: WOOD },
  { sdf: rails, color: WOOD_DARK },

  { sdf: dilate(crowd, 0.013), color: OUTLINE },
  { sdf: walkerBodies, color: FIGURE },
  { sdf: umbrellasA, color: UMB_STRAW },
  { sdf: umbrellasB, color: UMB_BLUE },

  { sdf: rainDark, color: RAIN_DARK },
  { sdf: rainPale, color: RAIN_PALE },
];

// ----------------------------------------------------------------- render
// —— painted 展示接线 (scene 30) ——
export const getSdfs = () => layers.map((l) => l.sdf);
