import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  polygon,
  triangle,
  segment,
  quadratic_bezier,
  union,
  intersection,
  difference,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const SKY_TOP = [68, 74, 116]; // deep dusk violet
const SKY_LOW = [250, 198, 156]; // warm horizon peach
const SUN_HALO = [250, 208, 166];
const SUN_DISC = [255, 234, 194];

const PEAK_FAR = [178, 174, 198]; // haze lavender
const PEAK_MID = [136, 140, 174];
const PEAK_NEAR = [74, 84, 118];

const WATER = [200, 176, 178]; // dusty rose river
const REFLECT = [148, 140, 158];
const RIPPLE = [228, 206, 200];
const GLITTER = [250, 220, 180];
const WAKE = [166, 150, 160];

const BIRD = [92, 94, 130];
const INK = [24, 26, 38]; // raft / figure / cormorants
const LAMP_GLOW = [244, 198, 140];
const LAMP_CORE = [255, 236, 176];

const HORIZON = -0.28;
const BASE = -0.31;

// ------------------------------------------------- karst tower builder
// Steep near-vertical flanks + small rounded dome = the Guilin "thumb".
// dir = +1 rises above baseY, dir = -1 hangs below (for reflections).
function karst(cx, baseY, w, h, lean = 0, dir = 1) {
  const hw = w / 2;
  const capR = hw * 0.88;
  const shoulderY = baseY + dir * Math.max(h - capR, capR * 0.25);
  const pts = [
    [cx - hw, baseY],
    [cx - capR + lean, shoulderY],
    [cx + capR + lean, shoulderY],
    [cx + hw, baseY],
  ];
  const body = polygon(dir > 0 ? pts : pts.slice().reverse());
  const cap = circle(capR, [cx + lean, shoulderY]);
  return union(body, cap, { k: hw * 0.35 });
}

// ------------------------------------------------------------ sun
const SUN = [0.5, -0.13];
const sunHalo = circle(0.3, SUN);
const sunDisc = circle(0.145, SUN);

// ------------------------------------------------------ peak bands
const farPeaks = union(
  karst(-1.08, BASE, 0.34, 0.36),
  karst(-0.8, BASE, 0.26, 0.3, 0.02),
  karst(-0.5, BASE, 0.3, 0.44),
  karst(-0.18, BASE, 0.24, 0.32, -0.02),
  karst(0.08, BASE, 0.3, 0.4),
  karst(0.74, BASE, 0.26, 0.34),
  karst(0.98, BASE, 0.32, 0.46, 0.02),
  karst(1.2, BASE, 0.26, 0.3),
);

const midPeaks = union(
  karst(-1.14, BASE, 0.4, 0.52),
  karst(-0.62, BASE, 0.34, 0.62, 0.03),
  karst(-0.3, BASE, 0.26, 0.4),
  karst(0.14, BASE, 0.3, 0.56, -0.02),
  karst(0.86, BASE, 0.38, 0.66, -0.03),
  karst(1.22, BASE, 0.3, 0.44),
);

const NEAR = [
  [-1.22, 0.46, 0.86, 0.0],
  [-0.88, 0.34, 0.58, 0.02],
  [-0.42, 0.22, 0.36, 0.0],
  [0.78, 0.3, 0.52, 0.0],
  [1.16, 0.48, 0.92, -0.04],
];
const nearPeaks = union(...NEAR.map(([cx, w, h, l]) => karst(cx, BASE, w, h, l)));

// --------------------------------------------------- sky cormorants
function bird(cx, cy, s) {
  return union(
    segment([cx - s, cy], [cx, cy + s * 0.45], 0.006),
    segment([cx, cy + s * 0.45], [cx + s, cy], 0.006),
  );
}
const skyBirds = union(bird(-0.55, 0.6, 0.052), bird(-0.4, 0.7, 0.038), bird(-0.68, 0.75, 0.032));

// ---------------------------------------------------------- water
const waterRegion = rectangle([3.2, 1.5], [0, HORIZON - 0.75]);

// mirrored near peaks, foreshortened, then cut by ripple gaps
const reflRaw = union(...NEAR.map(([cx, w, h, l]) => karst(cx, HORIZON, w, h * 0.46, -l, -1)));
const rippleGaps = union(
  ...[0.045, 0.1, 0.155, 0.215, 0.28, 0.35].map((d) => rectangle([3.2, 0.013], [0, HORIZON - d])),
);
const reflections = difference(intersection(reflRaw, waterRegion), rippleGaps);

// sun glitter column widening as it comes forward
const glitter = union(
  ...[
    [-0.335, 0.035],
    [-0.395, 0.055],
    [-0.465, 0.045],
    [-0.545, 0.075],
    [-0.64, 0.06],
    [-0.745, 0.095],
    [-0.86, 0.07],
  ].map(([y, w]) => segment([SUN[0] - w, y], [SUN[0] + w, y], 0.007)),
);

const ripples = union(
  segment([-1.05, -0.42], [-0.62, -0.42], 0.006),
  segment([-0.86, -0.53], [-0.34, -0.53], 0.006),
  segment([0.62, -0.47], [1.1, -0.47], 0.006),
  segment([-1.15, -0.78], [-0.55, -0.78], 0.007),
  segment([0.7, -0.86], [1.18, -0.86], 0.007),
  segment([-0.3, -0.98], [0.34, -0.98], 0.007),
);

// wake under the raft
const wake = union(
  segment([-0.24, -0.665], [0.34, -0.665], 0.008),
  segment([-0.1, -0.72], [0.26, -0.72], 0.007),
);

// ------------------------------------------------- bamboo raft + crew
const raftTop = quadratic_bezier([-0.28, -0.583], [0.05, -0.626], [0.4, -0.572], 0.013);
const raftBot = quadratic_bezier([-0.26, -0.606], [0.05, -0.646], [0.38, -0.596], 0.009);
const raft = union(raftTop, raftBot);

// fisherman (distant figure — head r ≈ 0.023, torso half-width ≈ 0.038)
const legs = union(
  segment([0.02, -0.6], [0.046, -0.478], 0.011),
  segment([0.098, -0.6], [0.074, -0.478], 0.011),
);
const torso = rounded_rectangle([0.076, 0.118], 0.022, [0.06, -0.42]);
const head = circle(0.023, [0.062, -0.344]);
const hat = triangle([0.062, -0.292], [-0.006, -0.344], [0.13, -0.344]);
const arms = union(
  segment([0.03, -0.385], [-0.143, -0.415], 0.011),
  segment([0.042, -0.432], [-0.175, -0.458], 0.01),
);
const pole = segment([-0.34, -0.72], [-0.02, -0.2], 0.007);
const fisherman = union(legs, torso, head, hat, arms, { k: 0.014 });

// cormorants perched on the stern
function cormorant(cx, cy, s = 1, flip = 1) {
  const body = ellipse(0.05 * s, 0.027 * s, [cx, cy]);
  const tail = triangle(
    [cx - flip * 0.035 * s, cy + 0.008 * s],
    [cx - flip * 0.115 * s, cy - 0.014 * s],
    [cx - flip * 0.035 * s, cy - 0.016 * s],
  );
  const neck = quadratic_bezier(
    [cx + flip * 0.022 * s, cy + 0.016 * s],
    [cx + flip * 0.062 * s, cy + 0.048 * s],
    [cx + flip * 0.044 * s, cy + 0.076 * s],
    0.009 * s,
  );
  const head = circle(0.014 * s, [cx + flip * 0.044 * s, cy + 0.082 * s]);
  const beak = triangle(
    [cx + flip * 0.05 * s, cy + 0.09 * s],
    [cx + flip * 0.108 * s, cy + 0.1 * s],
    [cx + flip * 0.052 * s, cy + 0.074 * s],
  );
  const feet = segment([cx, cy - 0.024 * s], [cx, cy - 0.042 * s], 0.006 * s);
  return union(body, tail, neck, head, beak, feet, { k: 0.008 });
}
const crew = union(cormorant(0.215, -0.542, 1.0, 1), cormorant(0.335, -0.536, 0.9, 1));

// bow lamp
const lampPost = segment([-0.24, -0.586], [-0.24, -0.5], 0.006);
const lampBody = circle(0.019, [-0.24, -0.486]);
const lampGlow = circle(0.078, [-0.24, -0.486]);
const lampCore = circle(0.01, [-0.24, -0.486]);

const silhouette = union(raft, pole, fisherman, crew, lampPost, lampBody);

// ---------------------------------------------------------- layers
const layers = [
  { sdf: sunHalo, color: SUN_HALO },
  { sdf: sunDisc, color: SUN_DISC },

  { sdf: farPeaks, color: PEAK_FAR },
  { sdf: midPeaks, color: PEAK_MID },
  { sdf: nearPeaks, color: PEAK_NEAR },
  { sdf: skyBirds, color: BIRD },

  { sdf: waterRegion, color: WATER },
  { sdf: reflections, color: REFLECT },
  { sdf: glitter, color: GLITTER },
  { sdf: ripples, color: RIPPLE },
  { sdf: wake, color: WAKE },

  { sdf: lampGlow, color: LAMP_GLOW },
  { sdf: silhouette, color: INK },
  { sdf: lampCore, color: LAMP_CORE },
];

// ---------------------------------------------------------- render
// —— painted 展示接线 (scene 31) ——
export const getSdfs = () => layers.map((l) => l.sdf);
