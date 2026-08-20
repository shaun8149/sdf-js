import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  segment,
  ring,
  oriented_box,
  flower,
  union,
  intersection,
  difference,
  dilate,
  erode,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const BG_TOP = [88, 114, 120];
const BG_BOTTOM = [42, 62, 70];
const SHADOW = [32, 50, 58];

const OUTLINE = [28, 24, 22];
const BRASS = [214, 168, 74];
const BRASS_DARK = [172, 124, 50];
const BRASS_LIGHT = [242, 212, 140];

const DIAL = [244, 236, 216];
const DIAL_SHADE = [225, 212, 184];
const INK = [38, 34, 32];
const OXBLOOD = [168, 62, 48];
const GLINT = [253, 250, 242];

// ---------------------------------------------------------------- geometry
const CX = 0.18,
  CY = -0.2,
  R = 0.44; // watch case centre + radius

// --- chain: quadratic bezier draped up to the top-right corner -----------
function bez(t, p0, p1, p2) {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}
const CHAIN_N = 15;
const chainLinks = [];
for (let i = 0; i <= CHAIN_N; i++) {
  const p = bez(i / CHAIN_N, [0.21, 0.5], [0.64, 1.04], [1.14, 0.6]);
  chainLinks.push(ring(0.046, 0.016, p));
}
const chain = union(...chainLinks);

// --- case + crown + bow (one continuous piece of brass) -----------------
const caseBody = circle(R, [CX, CY]);
const crownStem = rounded_rectangle([0.095, 0.11], 0.02, [CX, CY + R + 0.035]);
const crownKnob = circle(0.063, [CX, CY + R + 0.118]);
const bow = ring(0.076, 0.027, [CX, CY + R + 0.245]);
const watchCase = union(caseBody, crownStem, crownKnob, bow, { k: 0.02 });

// --- lid, swung open to the left on its hinge ---------------------------
const lidCenter = [-0.44, 0.05];
const lidPlate = ellipse(0.19, 0.44).rotate(0.3).translate(lidCenter);
const lidInner = erode(lidPlate, 0.055);
const rosette = flower(0.03, 9, 0, 0.085).translate([-0.45, 0.06]);
const lidGlint = intersection(lidInner, oriented_box([-0.55, -0.18], [-0.6, 0.3], 0.03));

const hinge = union(
  oriented_box([-0.34, -0.33], [-0.12, -0.37], 0.048),
  circle(0.055, [-0.15, -0.36]),
  { k: 0.02 },
);

// --- dial ---------------------------------------------------------------
const dial = circle(0.375, [CX, CY]);
const dialShade = difference(dial, circle(0.4, [CX - 0.13, CY + 0.13]));

const bezelHi = intersection(ring(0.408, 0.052, [CX, CY]), circle(0.4, [CX - 0.23, CY + 0.23]));

const minuteTrack = ring(0.335, 0.007, [CX, CY]);
const ticks = rectangle([0.02, 0.055], [0, 0.298]).circular_array(12).translate([CX, CY]);
const cardinals = rectangle([0.036, 0.09], [0, 0.288]).circular_array(4).translate([CX, CY]);

// small seconds sub-dial at 6 o'clock
const subCenter = [CX, CY - 0.185];
const subRing = ring(0.088, 0.007, subCenter);
const subTicks = rectangle([0.01, 0.024], [0, 0.07]).circular_array(8).translate(subCenter);
const subHand = segment(subCenter, [CX + 0.052, CY - 0.115], 0.007);
const subPin = circle(0.013, subCenter);

// main hands, posed at 10:10
const hourHand = segment([CX, CY], [CX - 0.173, CY + 0.1], 0.02);
const minuteHand = segment([CX, CY], [CX + 0.242, CY + 0.14], 0.014);
const tail = segment([CX, CY], [CX + 0.055, CY - 0.05], 0.016);
const hands = union(hourHand, minuteHand, tail, { k: 0.012 });
const pinOuter = circle(0.03, [CX, CY]);
const pinInner = circle(0.013, [CX, CY]);

// crystal reflection: two diagonal slashes clipped to the dial
const glint = intersection(
  dial,
  union(
    oriented_box([CX - 0.3, CY + 0.08], [CX - 0.04, CY + 0.32], 0.048),
    oriented_box([CX - 0.15, CY - 0.02], [CX - 0.01, CY + 0.13], 0.022),
  ),
);

const groundShadow = ellipse(0.62, 0.085, [0.16, -0.76]);

// ---------------------------------------------------------------- layers
const layers = [
  { sdf: groundShadow, color: SHADOW },

  { sdf: dilate(chain, 0.013), color: OUTLINE },
  { sdf: chain, color: BRASS },

  { sdf: dilate(lidPlate, 0.026), color: OUTLINE },
  { sdf: lidPlate, color: BRASS_DARK },
  { sdf: lidInner, color: BRASS },
  { sdf: rosette, color: BRASS_LIGHT },
  { sdf: lidGlint, color: BRASS_LIGHT },

  { sdf: dilate(hinge, 0.02), color: OUTLINE },
  { sdf: hinge, color: BRASS_DARK },

  { sdf: dilate(watchCase, 0.03), color: OUTLINE },
  { sdf: watchCase, color: BRASS },
  { sdf: bezelHi, color: BRASS_LIGHT },

  { sdf: dilate(dial, 0.012), color: BRASS_DARK },
  { sdf: dial, color: DIAL },
  { sdf: dialShade, color: DIAL_SHADE },

  { sdf: minuteTrack, color: INK },
  { sdf: ticks, color: INK },
  { sdf: cardinals, color: INK },

  { sdf: subRing, color: INK },
  { sdf: subTicks, color: INK },
  { sdf: subHand, color: OXBLOOD },
  { sdf: subPin, color: INK },

  { sdf: hands, color: INK },
  { sdf: pinOuter, color: INK },
  { sdf: pinInner, color: BRASS_LIGHT },

  { sdf: glint, color: GLINT },
];

// ---------------------------------------------------------------- render
// —— painted 展示接线 (scene 25) ——
export const getSdfs = () => layers.map((l) => l.sdf);
