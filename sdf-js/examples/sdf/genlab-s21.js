import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  segment,
  ring,
  union,
  intersection,
  dilate,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const BG_TOP = [246, 238, 222];
const BG_BOT = [228, 211, 188];
const SHADOW = [212, 193, 170];
const TIN = [212, 208, 196]; // pale nickel head
const RED = [198, 76, 58]; // litho red torso
const STEEL = [92, 122, 138]; // blue-grey limbs & key
const CREAM = [238, 231, 212]; // chest panel, grille plate
const GOLD = [235, 178, 62]; // buttons, antenna bulb, rivets
const CYAN = [96, 178, 184]; // lens eyes
const DARK = [40, 33, 30]; // outline / ink

// ---------------------------------------------------------------- ground
const shadow = ellipse(0.44, 0.055, [0.02, -0.95]);

// ---------------------------------------------------------------- windup key (behind body)
const keyShaft = segment([0.28, 0.1], [0.56, 0.1], 0.03);
const keyLoop = ring(0.09, 0.032, [0.645, 0.1]);
const keyBar = rectangle([0.055, 0.155], [0.645, 0.1]);
const key = union(keyShaft, keyLoop, keyBar);

// ---------------------------------------------------------------- arms
const shoulderL = circle(0.095, [-0.355, 0.135]);
const shoulderR = circle(0.095, [0.355, 0.135]);
const upperL = rounded_rectangle([0.155, 0.42], 0.06, [-0.395, -0.045]);
const upperR = rounded_rectangle([0.155, 0.42], 0.06, [0.395, -0.045]);
const handL = rounded_rectangle([0.175, 0.135], 0.055, [-0.395, -0.305]);
const handR = rounded_rectangle([0.175, 0.135], 0.055, [0.395, -0.305]);
const arms = union(shoulderL, shoulderR, upperL, upperR, handL, handR, { k: 0.03 });

// accordion bands, clipped to the arm silhouette
const armBands = intersection(
  union(upperL, upperR),
  union(
    rectangle([1.4, 0.026], [0, 0.055]),
    rectangle([1.4, 0.026], [0, -0.045]),
    rectangle([1.4, 0.026], [0, -0.145]),
  ),
);

// ---------------------------------------------------------------- legs & feet
const legL = rounded_rectangle([0.17, 0.31], 0.05, [-0.145, -0.635]);
const legR = rounded_rectangle([0.17, 0.31], 0.05, [0.145, -0.635]);
const legs = union(legL, legR);
const legBands = intersection(
  legs,
  union(rectangle([1.0, 0.026], [0, -0.575]), rectangle([1.0, 0.026], [0, -0.665])),
);

const footL = rounded_rectangle([0.26, 0.135], [0.03, 0.03, 0.06, 0.06], [-0.165, -0.855]);
const footR = rounded_rectangle([0.26, 0.135], [0.03, 0.03, 0.06, 0.06], [0.165, -0.855]);
const feet = union(footL, footR);

// ---------------------------------------------------------------- torso
const neck = rectangle([0.17, 0.1], [0, 0.28]);
const torso = rounded_rectangle([0.66, 0.62], 0.07, [0, -0.05]);
const hips = rounded_rectangle([0.47, 0.15], 0.05, [0, -0.425]);
const body = union(torso, hips, { k: 0.02 });

// chest panel + instruments
const panel = rounded_rectangle([0.4, 0.32], 0.045, [0, 0.0]);
const dialRim = ring(0.075, 0.026, [-0.095, 0.02]);
const dialHand = segment([-0.095, 0.02], [-0.048, 0.062], 0.014);
const dial = union(dialRim, dialHand);
const buttons = union(
  circle(0.03, [0.1, 0.085]),
  circle(0.03, [0.1, 0.005]),
  circle(0.03, [0.1, -0.075]),
);

// louvered vents on the lower torso
const vents = intersection(
  torso,
  union(rectangle([0.26, 0.024], [0, -0.235]), rectangle([0.26, 0.024], [0, -0.29])),
);

// ---------------------------------------------------------------- head
const skull = rounded_rectangle([0.47, 0.39], 0.1, [0, 0.505]);
const earL = circle(0.058, [-0.265, 0.505]);
const earR = circle(0.058, [0.265, 0.505]);
const head = union(skull, earL, earR, { k: 0.015 });

const antenna = segment([0.02, 0.66], [0.075, 0.905], 0.019);
const antennaTip = circle(0.058, [0.075, 0.955]);

const eyeL = circle(0.078, [-0.108, 0.555]);
const eyeR = circle(0.078, [0.108, 0.555]);
const eyes = union(eyeL, eyeR);
const pupils = union(circle(0.033, [-0.108, 0.555]), circle(0.033, [0.108, 0.555]));
const glints = union(circle(0.016, [-0.132, 0.582]), circle(0.016, [0.084, 0.582]));

const grille = rounded_rectangle([0.27, 0.115], 0.035, [0, 0.375]);
const slots = intersection(
  grille,
  union(
    rectangle([0.026, 0.2], [-0.078, 0.375]),
    rectangle([0.026, 0.2], [0.0, 0.375]),
    rectangle([0.026, 0.2], [0.078, 0.375]),
  ),
);

// ---------------------------------------------------------------- rivets
const rivet = (x, y) => circle(0.019, [x, y]);
const rivets = union(
  rivet(-0.272, 0.185),
  rivet(0.272, 0.185),
  rivet(-0.272, -0.29),
  rivet(0.272, -0.29),
  rivet(-0.18, 0.64),
  rivet(0.18, 0.64),
);

// ---------------------------------------------------------------- layers
const layers = [
  { sdf: shadow, color: SHADOW },

  // windup key sits behind the torso, reading as "coming out of the back"
  { sdf: dilate(key, 0.018), color: DARK },
  { sdf: key, color: STEEL },

  // limbs behind the body plate
  { sdf: dilate(arms, 0.021), color: DARK },
  { sdf: arms, color: STEEL },
  { sdf: armBands, color: DARK },

  { sdf: dilate(legs, 0.021), color: DARK },
  { sdf: legs, color: STEEL },
  { sdf: legBands, color: DARK },
  { sdf: dilate(feet, 0.021), color: DARK },
  { sdf: feet, color: TIN },

  { sdf: dilate(neck, 0.02), color: DARK },
  { sdf: neck, color: STEEL },

  // torso
  { sdf: dilate(body, 0.027), color: DARK },
  { sdf: body, color: RED },
  { sdf: vents, color: DARK },
  { sdf: dilate(panel, 0.018), color: DARK },
  { sdf: panel, color: CREAM },
  { sdf: dial, color: DARK },
  { sdf: dilate(buttons, 0.012), color: DARK },
  { sdf: buttons, color: GOLD },

  // head
  { sdf: dilate(head, 0.027), color: DARK },
  { sdf: head, color: TIN },
  { sdf: dilate(antenna, 0.014), color: DARK },
  { sdf: antenna, color: STEEL },
  { sdf: dilate(antennaTip, 0.016), color: DARK },
  { sdf: antennaTip, color: GOLD },
  { sdf: dilate(eyes, 0.016), color: DARK },
  { sdf: eyes, color: CYAN },
  { sdf: pupils, color: DARK },
  { sdf: glints, color: CREAM },
  { sdf: dilate(grille, 0.016), color: DARK },
  { sdf: grille, color: CREAM },
  { sdf: slots, color: DARK },

  { sdf: rivets, color: GOLD },
];

// ---------------------------------------------------------------- render
// —— painted 展示接线 (scene 21) ——
export const getSdfs = () => layers.map((l) => l.sdf);
