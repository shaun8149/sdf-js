import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  polygon,
  segment,
  star,
  moon,
  union,
  intersection,
  dilate,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const SKY_TOP = [12, 17, 46];
const SKY_BOTTOM = [84, 66, 100];
const STAR_C = [246, 241, 214];
const MOON_C = [248, 238, 198];
const HILL_FAR = [42, 48, 82];
const TREE_C = [26, 32, 60];
const HILL_NEAR = [17, 19, 40];
const BRASS = [201, 148, 60];
const BRASS_LT = [238, 200, 114];
const BRASS_DK = [143, 98, 38];
const WOOD = [140, 93, 52];
const WOOD_DK = [94, 58, 32];
const OUTLINE = [14, 13, 26];

// ------------------------------------------------------- telescope frame
// Everything on the tube is addressed in (t = along axis, s = perpendicular).
const A = 0.6; // ~34 degrees of altitude
const ca = Math.cos(A),
  sa = Math.sin(A);
const PIVOT = [-0.06, 0.06]; // altitude bearing on the tripod head
const at = (t, s) => [PIVOT[0] + ca * t - sa * s, PIVOT[1] + sa * t + ca * s];

// ------------------------------------------------------------ starry sky
function starField(n, seed) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const dots = [];
  for (let i = 0; i < n; i++) {
    const x = rnd() * 2.7 - 1.35;
    const y = rnd() * 1.35 - 0.08;
    dots.push(circle(0.005 + rnd() * 0.011, [x, y]));
  }
  return union(...dots);
}

const stars = starField(58, 20250211);

const sparkles = union(
  star(4, 0.062, 0.009).rotate(0.15).translate([0.72, 0.86]),
  star(4, 0.048, 0.007).rotate(-0.2).translate([-0.4, 0.98]),
  star(4, 0.04, 0.006).rotate(0.5).translate([0.2, 0.42]),
);

const crescent = moon(0.085, 0.15).rotate(-0.45).translate([-0.8, 0.78]);

// ------------------------------------------------------------- landscape
const hillFar = circle(2.2, [-0.9, -2.86]);
const hillNear = circle(6.0, [0.15, -6.82]);

function conifer(cx, baseY, w, h) {
  return union(
    polygon([
      [cx - w / 2, baseY],
      [cx + w / 2, baseY],
      [cx, baseY + h],
    ]),
    rectangle([w * 0.16, h * 0.22], [cx, baseY - h * 0.06]),
  );
}
const trees = union(
  conifer(-0.98, -0.68, 0.115, 0.19),
  conifer(-0.62, -0.7, 0.09, 0.15),
  conifer(0.92, -0.9, 0.1, 0.17),
);

// ---------------------------------------------------------------- tripod
function legShape(x0, y0, x1, y1, wTop, wBot) {
  const dx = x1 - x0,
    dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  const nx = -dy / L,
    ny = dx / L;
  return polygon([
    [x0 + nx * wTop, y0 + ny * wTop],
    [x1 + nx * wBot, y1 + ny * wBot],
    [x1 - nx * wBot, y1 - ny * wBot],
    [x0 - nx * wTop, y0 - ny * wTop],
  ]);
}

const legL = legShape(-0.1, -0.06, -0.56, -0.9, 0.031, 0.017);
const legR = legShape(0.06, -0.06, 0.46, -0.9, 0.031, 0.017);
const legB = legShape(-0.02, -0.06, -0.1, -0.88, 0.026, 0.015);
const head = polygon([
  [-0.14, 0.03],
  [0.12, 0.03],
  [0.09, -0.12],
  [-0.11, -0.12],
]);
const braceL = segment([-0.399, -0.58], [-0.073, -0.555], 0.013);
const braceR = segment([-0.073, -0.555], [0.32, -0.58], 0.013);

const tripod = union(legL, legB, legR, head, braceL, braceR);

// brass collar fittings on the wooden legs
const collars = intersection(
  union(legL, legB, legR),
  union(segment([-0.6, -0.44], [0.5, -0.44], 0.02), segment([-0.6, -0.16], [0.5, -0.16], 0.017)),
);

// ------------------------------------------------------------- telescope
const tube = rounded_rectangle([1.02, 0.135], 0.048).rotate(A).translate(at(0.14, 0));
const dewCap = rounded_rectangle([0.2, 0.176], 0.045).rotate(A).translate(at(0.6, 0));
const saddle = rounded_rectangle([0.21, 0.125], 0.032).rotate(A).translate(at(0.0, -0.1));
const focuser = rounded_rectangle([0.22, 0.1], 0.03).rotate(A).translate(at(-0.46, 0));
const eyepiece = rounded_rectangle([0.11, 0.132], 0.03).rotate(A).translate(at(-0.63, 0));
const knob = circle(0.046, at(-0.42, -0.098));
const finder = rounded_rectangle([0.34, 0.062], 0.026).rotate(A).translate(at(0.22, 0.125));
const posts = union(
  segment(at(0.09, 0.045), at(0.09, 0.125), 0.014),
  segment(at(0.35, 0.045), at(0.35, 0.125), 0.014),
);
const bearing = circle(0.075, PIVOT);

const scope = union(tube, dewCap, saddle, focuser, eyepiece, knob, finder, posts, bearing);

// tube shading + trim, all clipped to the barrel
const bodyMass = union(tube, dewCap);
const highlight = intersection(
  bodyMass,
  rounded_rectangle([1.05, 0.036], 0.018).rotate(A).translate(at(0.18, 0.04)),
);
const underside = intersection(
  bodyMass,
  rounded_rectangle([1.05, 0.042], 0.02).rotate(A).translate(at(0.18, -0.046)),
);
const bands = union(
  rounded_rectangle([0.048, 0.164], 0.016).rotate(A).translate(at(0.32, 0)),
  rounded_rectangle([0.048, 0.164], 0.016).rotate(A).translate(at(-0.06, 0)),
);
const objective = ellipse(0.028, 0.07, [0, 0]).rotate(A).translate(at(0.665, 0));

// ---------------------------------------------------------------- layers
const layers = [
  { sdf: stars, color: STAR_C },
  { sdf: sparkles, color: STAR_C },
  { sdf: crescent, color: MOON_C },

  { sdf: hillFar, color: HILL_FAR },
  { sdf: trees, color: TREE_C },
  { sdf: hillNear, color: HILL_NEAR },

  { sdf: dilate(tripod, 0.02), color: OUTLINE },
  { sdf: tripod, color: WOOD },
  { sdf: legB, color: WOOD_DK },
  { sdf: collars, color: BRASS_DK },

  { sdf: dilate(scope, 0.027), color: OUTLINE },
  { sdf: scope, color: BRASS },
  { sdf: underside, color: BRASS_DK },
  { sdf: highlight, color: BRASS_LT },
  { sdf: dilate(bands, 0.006), color: OUTLINE },
  { sdf: bands, color: BRASS_DK },
  { sdf: dilate(union(focuser, eyepiece, knob, finder), 0.014), color: OUTLINE },
  { sdf: union(focuser, eyepiece, knob), color: BRASS_DK },
  { sdf: finder, color: BRASS_DK },
  { sdf: objective, color: [96, 132, 150] },
];

// ---------------------------------------------------------------- render
// —— painted 展示接线 (scene 23) ——
export const getSdfs = () => layers.map((l) => l.sdf);
