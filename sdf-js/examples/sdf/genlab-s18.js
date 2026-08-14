import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  triangle,
  segment,
  arc,
  ring,
  quadratic_bezier,
  union,
  intersection,
  shell,
  dilate,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const SKY_TOP = [234, 240, 241];
const SKY_BOTTOM = [246, 236, 216];
const DISC = [158, 192, 193];
const WATER = [104, 148, 157];
const FOAM = [186, 214, 214];
const OUTLINE = [24, 30, 38];
const IRON = [40, 55, 82];
const SHEEN = [124, 148, 180];
const ROPE = [216, 166, 96];
const ROPE_DARK = [92, 60, 30];

// ---------------------------------------------------------------- backdrop
const disc = circle(0.92, [0, 0.05]);
const water = intersection(disc, rectangle([2.4, 0.46], [0, -0.64]));

const foam = intersection(
  disc,
  union(
    segment([-0.74, -0.56], [-0.44, -0.56], 0.013),
    segment([0.46, -0.63], [0.76, -0.63], 0.013),
    segment([-0.6, -0.73], [-0.34, -0.73], 0.013),
    segment([0.2, -0.79], [0.44, -0.79], 0.013),
  ),
);

// ---------------------------------------------------------------- anchor
// shackle ring at the head
const shackle = ring(0.105, 0.038, [0, 0.94]);

// shank: the long vertical spine, running down into the crown
const shank = rounded_rectangle([0.105, 1.6], 0.05, [0, 0.11]);

// stock: the crossbar, with rounded ball ends
const stock = union(
  rounded_rectangle([1.05, 0.085], 0.042, [0, 0.68]),
  circle(0.062, [-0.525, 0.68]),
  circle(0.062, [0.525, 0.68]),
);

// arms: one arc opening upward, forming the U from crown to both tips
const arms = arc(0.42, 1.05, 0.058).rotate(Math.PI).translate([0, -0.2]);
const crown = circle(0.092, [0, -0.6]);

// flukes: leaning spearhead palms welded to each arm tip
const flukeR = triangle([0.209, -0.377], [0.469, -0.527], [0.508, -0.157]);
const flukeL = triangle([-0.209, -0.377], [-0.469, -0.527], [-0.508, -0.157]);

const anchor = union(shank, arms, crown, flukeL, flukeR, stock, shackle, { k: 0.028 });

// decorative sheen — a cold highlight strip down the shank + along the stock
const sheen = union(
  intersection(anchor, rectangle([0.03, 1.3], [-0.03, 0.12])),
  intersection(anchor, rectangle([0.92, 0.02], [0, 0.706])),
  circle(0.024, [0, 0.68]),
  circle(0.024, [-0.3, 0.68]),
  circle(0.024, [0.3, 0.68]),
);

// ---------------------------------------------------------------- rope
const ropeLoop = shell(ellipse(0.28, 0.155), 0.024).rotate(-0.28).translate([0.02, 0.3]);

const ropeTailA = quadratic_bezier([0.28, 0.23], [0.66, 0.34], [0.8, 0.66], 0.023);
const ropeTailB = quadratic_bezier([-0.25, 0.38], [-0.62, 0.52], [-0.72, 0.14], 0.023);

const rope = union(ropeLoop, ropeTailA, ropeTailB, { k: 0.02 });

// ---------------------------------------------------------------- layers
const layers = [
  { sdf: disc, color: DISC },
  { sdf: water, color: WATER },
  { sdf: foam, color: FOAM },

  { sdf: dilate(anchor, 0.03), color: OUTLINE },
  { sdf: anchor, color: IRON },
  { sdf: sheen, color: SHEEN },

  { sdf: dilate(rope, 0.013), color: ROPE_DARK },
  { sdf: rope, color: ROPE },
];

// ---------------------------------------------------------------- render
// —— painted 展示接线 (scene 18) ——
export const getSdfs = () => layers.map((l) => l.sdf);
