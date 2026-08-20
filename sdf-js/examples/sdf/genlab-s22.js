import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  segment,
  arc,
  ring,
  triangle,
  quadratic_bezier,
  union,
  intersection,
  dilate,
  erode,
  render,
} from '../../src/index.js';

// ---------- palette ----------
const BG_TOP = [247, 238, 221];
const BG_BOTTOM = [236, 221, 199];
const FLOOR = [222, 203, 176];
const SHADOW = [203, 181, 154];
const WOOD = [206, 152, 96];
const WOOD_LIGHT = [228, 186, 138];
const WOOD_DARK = [158, 105, 62];
const CREAM = [247, 240, 224];
const LEATHER = [183, 71, 58];
const LEATHER_DK = [136, 46, 40];
const BRASS = [214, 168, 74];
const OUTLINE = [54, 35, 26];

// ---------- ground ----------
const floor = rectangle([3.0, 0.6], [0, -1.2]); // top edge at y = -0.90
const shadow = ellipse(0.82, 0.055, [0, -0.9]);

// ---------- rockers (bottom arc of a big circle -> convex down) ----------
const rockerNear = arc(1.6, 0.46, 0.055).rotate(Math.PI).translate([0.0, 0.7]);
const rockerFar = arc(1.6, 0.44, 0.05).rotate(Math.PI).translate([-0.07, 0.75]);
const strut = rounded_rectangle([1.02, 0.055], 0.025, [-0.01, -0.7]);

// ---------- legs (straight turned-wood legs, splayed) ----------
function leg(topX, topY, footX, footY, r) {
  return union(
    segment([topX, topY], [footX, footY], r),
    rounded_rectangle([0.13, 0.085], 0.025, [footX, footY + 0.01]),
    { k: 0.02 },
  );
}
const legsNear = union(leg(0.18, -0.02, 0.43, -0.79, 0.058), leg(-0.24, -0.02, -0.46, -0.79, 0.06));
const legsFar = union(leg(0.09, 0.0, 0.32, -0.76, 0.052), leg(-0.33, 0.0, -0.55, -0.76, 0.054));

// ---------- body / neck / head ----------
const barrel = ellipse(0.44, 0.27, [-0.04, 0.02]);
const chest = circle(0.2, [0.2, 0.02]);
const rump = circle(0.22, [-0.26, 0.03]);
const neck = segment([0.26, 0.06], [0.46, 0.42], 0.115);
const skull = segment([0.44, 0.44], [0.66, 0.34], 0.1);
const cheek = circle(0.105, [0.45, 0.39]);
const muzzle = circle(0.07, [0.685, 0.325]);

const earNear = triangle([0.44, 0.48], [0.505, 0.665], [0.555, 0.495]);
const earFar = triangle([0.35, 0.48], [0.41, 0.63], [0.47, 0.5]);

const bodyMass = union(barrel, chest, rump, { k: 0.07 });
const body = union(bodyMass, neck, skull, cheek, muzzle, { k: 0.06 });
const bodyFull = union(body, earNear, { k: 0.025 });

// dapple markings, clipped inside the barrel
const dapples = intersection(
  union(
    circle(0.045, [-0.2, 0.1]),
    circle(0.036, [-0.07, -0.01]),
    circle(0.04, [-0.31, -0.03]),
    circle(0.03, [0.07, 0.11]),
    circle(0.028, [-0.16, -0.1]),
  ),
  erode(bodyMass, 0.035),
);

// ---------- mane, forelock, tail ----------
const mane = union(
  segment([0.19, 0.1], [0.39, 0.48], 0.07),
  circle(0.07, [0.425, 0.52]),
  circle(0.06, [0.15, 0.095]),
  { k: 0.05 },
);
const tail = union(
  segment([-0.4, 0.18], [-0.56, -0.02], 0.075),
  segment([-0.56, -0.02], [-0.61, -0.3], 0.052),
  circle(0.048, [-0.615, -0.345]),
  { k: 0.05 },
);

// ---------- saddle & tack ----------
const seat = rounded_rectangle([0.34, 0.12], [0.07, 0.07, 0.03, 0.03], [-0.06, 0.285]);
const pommel = circle(0.052, [0.095, 0.31]);
const cantle = circle(0.058, [-0.22, 0.312]);
const saddle = union(seat, pommel, cantle, { k: 0.03 });

const girth = intersection(bodyMass, rectangle([0.085, 0.8], [-0.05, 0.0]));
const stirrup = segment([-0.05, 0.24], [-0.095, -0.06], 0.015);
const iron = ring(0.05, 0.018, [-0.1, -0.115]);

const bridle = union(
  segment([0.47, 0.5], [0.62, 0.32], 0.014), // cheek strap
  segment([0.612, 0.408], [0.688, 0.252], 0.013), // noseband
);
const reins = quadratic_bezier([0.715, 0.3], [0.42, 0.19], [0.1, 0.3], 0.014);

// ---------- face marks ----------
const eye = circle(0.03, [0.52, 0.42]);
const eyeSpark = circle(0.011, [0.512, 0.43]);
const nostril = circle(0.018, [0.665, 0.298]);
const mouth = segment([0.712, 0.282], [0.748, 0.292], 0.008);

// ---------- layers (bottom -> top) ----------
const layers = [
  { sdf: floor, color: FLOOR },
  { sdf: shadow, color: SHADOW },

  // far side of the toy, pushed back in value
  { sdf: rockerFar, color: WOOD_DARK },
  { sdf: legsFar, color: WOOD_DARK },
  { sdf: dilate(earFar, 0.018), color: OUTLINE },
  { sdf: earFar, color: WOOD_DARK },

  { sdf: dilate(tail, 0.02), color: OUTLINE },
  { sdf: tail, color: CREAM },

  { sdf: dilate(legsNear, 0.024), color: OUTLINE },
  { sdf: legsNear, color: WOOD },

  { sdf: dilate(strut, 0.016), color: OUTLINE },
  { sdf: strut, color: WOOD },

  { sdf: dilate(rockerNear, 0.028), color: OUTLINE },
  { sdf: rockerNear, color: WOOD },

  { sdf: dilate(bodyFull, 0.03), color: OUTLINE },
  { sdf: bodyFull, color: WOOD },
  { sdf: dapples, color: WOOD_LIGHT },

  { sdf: dilate(mane, 0.02), color: OUTLINE },
  { sdf: mane, color: CREAM },

  { sdf: girth, color: LEATHER_DK },
  { sdf: dilate(saddle, 0.02), color: OUTLINE },
  { sdf: saddle, color: LEATHER },
  { sdf: stirrup, color: LEATHER_DK },
  { sdf: iron, color: BRASS },

  { sdf: dilate(bridle, 0.009), color: OUTLINE },
  { sdf: bridle, color: LEATHER },
  { sdf: reins, color: LEATHER_DK },

  { sdf: eye, color: OUTLINE },
  { sdf: eyeSpark, color: CREAM },
  { sdf: nostril, color: OUTLINE },
  { sdf: mouth, color: OUTLINE },
];

// ---------- render ----------
// —— painted 展示接线 (scene 22) ——
export const getSdfs = () => layers.map((l) => l.sdf);
