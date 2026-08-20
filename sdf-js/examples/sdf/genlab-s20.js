import {
  circle,
  ring,
  rectangle,
  segment,
  shell,
  union,
  intersection,
  difference,
  dilate,
  render,
} from '../../src/index.js';

// ---------- palette ----------
const WALL_TOP = [234, 224, 208];
const WALL_BOT = [211, 195, 176];
const SHADOW = [188, 172, 154];
const OUTLINE = [30, 26, 24];
const CASE = [40, 68, 80]; // deep teal enamel case
const BRASS = [205, 160, 76];
const FACE = [247, 241, 227];
const TICK = [44, 42, 40];
const HAND = [30, 30, 32];
const RED = [188, 62, 48];

// ---------- geometry helpers ----------
const A = (deg) => (deg * Math.PI) / 180;
const dir = (deg) => [Math.sin(A(deg)), Math.cos(A(deg))]; // 0deg = 12 o'clock, clockwise
const at = (deg, r) => {
  const d = dir(deg);
  return [d[0] * r, d[1] * r];
};

// 10:10  ->  hour = (10 + 10/60) * 30 = 305deg, minute = 10 * 6 = 60deg
const HOUR_ANG = 305;
const MIN_ANG = 60;

// ---------- clock body ----------
const hanger = difference(ring(0.075, 0.024, [0, 0.845]), rectangle([0.3, 0.2], [0, 0.72]));

const caseR = 0.78;
const clockCase = circle(caseR);
const bezel = ring(0.705, 0.02); // brass fillet between case and dial
const face = circle(0.665);

// ---------- dial markings ----------
const minorTicks = intersection(rectangle([0.009, 0.038], [0, 0.628]).circular_array(60), face);
const majorTicks = rectangle([0.026, 0.088], [0, 0.585]).circular_array(12);
const cardinals = rectangle([0.042, 0.115], [0, 0.57]).circular_array(4);

const subdial = ring(0.135, 0.011, [0, -0.3]);
const subTicks = rectangle([0.008, 0.03], [0, 0.115]).circular_array(12).translate([0, -0.3]);

const makerMark = circle(0.026, [0, 0.3]);

// ---------- hands ----------
const hourHand = segment(at(HOUR_ANG, -0.09), at(HOUR_ANG, 0.375), 0.024);
const minuteHand = segment(at(MIN_ANG, -0.1), at(MIN_ANG, 0.555), 0.016);
const secondHand = union(
  segment([0, 0.155], [0, -0.545], 0.0075),
  circle(0.042, [0, 0.135]), // counterweight
);

const hub = circle(0.042);
const hubPin = circle(0.016);

// ---------- layers ----------
const layers = [
  // cast shadow on the wall
  { sdf: circle(caseR + 0.01, [0.055, -0.055]), color: SHADOW },

  // hanger behind the case
  { sdf: dilate(hanger, 0.016), color: OUTLINE },
  { sdf: hanger, color: BRASS },

  // case
  { sdf: dilate(clockCase, 0.03), color: OUTLINE },
  { sdf: clockCase, color: CASE },
  { sdf: bezel, color: BRASS },

  // dial
  { sdf: dilate(face, 0.013), color: OUTLINE },
  { sdf: face, color: FACE },

  // markings
  { sdf: minorTicks, color: TICK },
  { sdf: majorTicks, color: TICK },
  { sdf: cardinals, color: TICK },
  { sdf: subdial, color: TICK },
  { sdf: subTicks, color: TICK },
  { sdf: makerMark, color: RED },

  // hands (each with its own graded outline)
  { sdf: dilate(hourHand, 0.014), color: OUTLINE },
  { sdf: hourHand, color: HAND },
  { sdf: dilate(minuteHand, 0.013), color: OUTLINE },
  { sdf: minuteHand, color: HAND },
  { sdf: dilate(secondHand, 0.009), color: OUTLINE },
  { sdf: secondHand, color: RED },

  // hub last, pinning everything down
  { sdf: dilate(hub, 0.012), color: OUTLINE },
  { sdf: hub, color: HAND },
  { sdf: hubPin, color: BRASS },
];

// ---------- render ----------
// —— painted 展示接线 (scene 20) ——
export const getSdfs = () => layers.map((l) => l.sdf);
