import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  polygon,
  segment,
  ring,
  line,
  union,
  intersection,
  difference,
  dilate,
  render,
} from '../../src/index.js';

// ---------------------------------------------------------------- palette
const SKY_TOP = [203, 224, 227];
const SKY_BOT = [246, 233, 209];
const SUN_C = [247, 214, 150];
const GROUND_C = [176, 191, 157];
const ROADMARK = [235, 229, 209];
const OUTLINE = [32, 28, 26];
const FRAME_C = [205, 78, 54];
const RIM_C = [239, 217, 168];
const TIRE_C = [44, 40, 38];
const SPOKE_C = [72, 68, 64];
const LEATHER = [140, 88, 54];
const CHAIN_C = [98, 94, 88];

// ---------------------------------------------------------------- geometry anchors
const R = 0.32; // wheel radius
const RH = [-0.58, -0.42]; // rear hub
const FH = [0.6, -0.42]; // front hub
const BB = [-0.02, -0.46]; // bottom bracket
const ST = [-0.24, 0.12]; // seat-tube top
const HTT = [0.33, 0.1]; // head-tube top
const HTB = [0.38, -0.12]; // head-tube bottom
const GY = -0.76; // ground line

// ---------------------------------------------------------------- wheels (parametric builder)
function spokes(c, count) {
  return segment([0, 0.05], [0, R - 0.06], 0.006)
    .circular_array(count)
    .translate(c);
}
const allSpokes = union(spokes(RH, 14), spokes(FH, 14));
const rims = union(ring(R - 0.055, 0.02, RH), ring(R - 0.055, 0.02, FH));
const tires = union(ring(R, 0.036, RH), ring(R, 0.036, FH));
const hubs = union(circle(0.036, RH), circle(0.036, FH));
const hubCaps = union(circle(0.016, RH), circle(0.016, FH));

// ---------------------------------------------------------------- drivetrain
const chainring = ring(0.085, 0.014, BB);
const sprocket = ring(0.045, 0.012, RH);
const chain = union(
  segment([BB[0], BB[1] + 0.085], [RH[0], RH[1] + 0.045], 0.008), // taut top run
  segment([BB[0], BB[1] - 0.085], [RH[0], RH[1] - 0.045], 0.007), // slack bottom run
);
const farCrank = segment(BB, [-0.13, -0.32], 0.011); // hidden-side crank
const crank = segment(BB, [0.09, -0.6], 0.013);
const pedal = rounded_rectangle([0.12, 0.034], 0.015, [0.115, -0.615]);
const drive = union(crank, pedal);

// ---------------------------------------------------------------- diamond frame + fork
const frame = union(
  segment(BB, ST, 0.016), // seat tube
  segment(ST, HTT, 0.015), // top tube
  segment(BB, HTB, 0.017), // down tube
  segment(HTB, HTT, 0.022), // head tube
  segment(BB, RH, 0.012), // chain stay
  segment(ST, RH, 0.011), // seat stay
  segment(HTB, FH, 0.013), // fork blade
  { k: 0.012 },
);

// ---------------------------------------------------------------- saddle & post
const seatPost = segment(ST, [-0.275, 0.205], 0.012);
const saddle = polygon([
  [-0.1, 0.202],
  [-0.28, 0.238],
  [-0.4, 0.244],
  [-0.415, 0.206],
  [-0.28, 0.188],
  [-0.13, 0.184],
]);
const perch = union(seatPost, saddle, { k: 0.01 });

// ---------------------------------------------------------------- stem + drop bar
const barC = [0.4, 0.1];
const dropC = intersection(ring(0.085, 0.014), line([-1, 0], [0, 0])).translate(barC);
const stem = segment(HTT, [0.4, 0.185], 0.014);
const bars = union(stem, dropC, { k: 0.008 });
const grip = circle(0.023, [0.4, 0.022]);

// ---------------------------------------------------------------- environment
const sun = circle(0.2, [-0.66, 0.62]);
const ground = rectangle([3.0, 0.7], [0, GY - 0.35]);
const marks = union(
  rectangle([0.2, 0.016], [-0.72, -0.94]),
  rectangle([0.2, 0.016], [-0.1, -0.94]),
  rectangle([0.2, 0.016], [0.52, -0.94]),
);

// ---------------------------------------------------------------- layers (bottom → top)
const layers = [
  { sdf: sun, color: SUN_C },
  { sdf: dilate(ground, 0.012), color: OUTLINE },
  { sdf: ground, color: GROUND_C },
  { sdf: marks, color: ROADMARK },

  { sdf: allSpokes, color: SPOKE_C },
  { sdf: dilate(rims, 0.01), color: OUTLINE },
  { sdf: rims, color: RIM_C },
  { sdf: tires, color: TIRE_C },

  { sdf: farCrank, color: CHAIN_C },
  { sdf: chain, color: CHAIN_C },
  { sdf: chainring, color: CHAIN_C },
  { sdf: sprocket, color: CHAIN_C },

  { sdf: dilate(frame, 0.026), color: OUTLINE },
  { sdf: frame, color: FRAME_C },

  { sdf: dilate(drive, 0.014), color: OUTLINE },
  { sdf: drive, color: TIRE_C },

  { sdf: hubs, color: OUTLINE },
  { sdf: hubCaps, color: RIM_C },

  { sdf: dilate(perch, 0.018), color: OUTLINE },
  { sdf: perch, color: LEATHER },

  { sdf: dilate(bars, 0.016), color: OUTLINE },
  { sdf: bars, color: FRAME_C },
  { sdf: dilate(grip, 0.012), color: OUTLINE },
  { sdf: grip, color: LEATHER },
];

// ---------------------------------------------------------------- render
// —— painted 展示接线 (scene 19) ——
export const getSdfs = () => layers.map((l) => l.sdf);
