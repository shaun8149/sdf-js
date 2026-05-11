// LLM × SDF test #2 —— "画一艘古代帆船"
// LLM 原始输出。注意：trapezoid 签名误用导致 hull 不渲染。
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  triangle,
  trapezoid,
  flower,
  union,
  difference,
} from '../../src/index.js';

const sea = rectangle([2.4, 0.7], [0, -0.65]);

const waves = flower(0.04, 18, 0, 0.05).translate([0, -0.3]).scale([6, 1]);

// FIX: trapezoid(a, b, ra, rb) expects a, b as 2D points (arrays).
// Also: trapezoid internally flips y (BOB y-down legacy), so a/b's y-values
// are the NEGATIVES of the world-y where we want them rendered.
// Model's intent: hull from world y=-0.32 (bottom, keel) to y=-0.05 (top, deck),
// with keel half-width 0.28 and deck half-width 0.6.
const hull = trapezoid([0, 0.32], [0, 0.05], 0.28, 0.6);
const deckLine = rectangle([1.05, 0.04], [0, -0.1]);
const hullTrim = rectangle([1.15, 0.02], [0, -0.07]);

const portholes = circle(0.025).circular_array(1)
  .translate([-0.3, -0.18])
  .union(
    circle(0.025).translate([-0.15, -0.18]),
    circle(0.025).translate([0.0, -0.18]),
    circle(0.025).translate([0.15, -0.18]),
    circle(0.025).translate([0.3, -0.18]),
  );

const hullSolid = difference(hull, portholes);

const mast = rectangle([0.025, 1.0], [0, 0.4]);

const yardTop = rectangle([0.55, 0.022], [0, 0.78]);
const yardMid = rectangle([0.75, 0.022], [0, 0.45]);
const yardLow = rectangle([0.75, 0.022], [0, 0.05]);
const yards = union(yardTop, yardMid, yardLow);

const topSail = rounded_rectangle([0.5, 0.28], 0.04, [0, 0.63]);
const mainSail = rounded_rectangle([0.7, 0.36], 0.05, [0, 0.25]);
const sails = union(topSail, mainSail);

const flagPole = rectangle([0.018, 0.18], [0, 0.93]);
const flag = triangle([0.009, 1.0], [0.18, 0.95], [0.009, 0.9]);

const sun = circle(0.18, [0.7, 0.7]);

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: sun, color: [255, 210, 140] },
      { sdf: sea, color: [60, 95, 130] },
      { sdf: waves, color: [90, 130, 165] },
      { sdf: hullSolid, color: [95, 60, 40] },
      { sdf: hullTrim, color: [200, 160, 80] },
      { sdf: deckLine, color: [60, 40, 25] },
      { sdf: mast, color: [70, 45, 30] },
      { sdf: sails, color: [240, 225, 195] },
      { sdf: yards, color: [70, 45, 30] },
      { sdf: flagPole, color: [70, 45, 30] },
      { sdf: flag, color: [180, 50, 50] },
    ],
    {
      view: 1.2,
      background: { top: [255, 200, 160], bottom: [255, 230, 200] },
    },
  );
}

const canvas = document.getElementById('c');
scene(canvas.getContext('2d'));
