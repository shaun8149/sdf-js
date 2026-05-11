// LLM × SDF test #5 —— "画一个戴礼帽的男人侧影，正在看远方"
// LLM 原始输出 + 一行 trapezoid fix（与 boat 同款 bug）
// =============================================================================

import {
  render,
  circle,
  rectangle,
  triangle,
  trapezoid,
  union,
} from '../../src/index.js';

const sunGlow = circle(0.32, [0.55, 0.0]);
const sun = circle(0.17, [0.55, 0.0]);

const farHillL = circle(0.4).scale([2.4, 0.55]).translate([-0.5, -0.7]);
const farHillR = circle(0.4).scale([2.6, 0.5]).translate([0.6, -0.75]);
const farHills = union(farHillL, farHillR, { k: 0.08 });

const midHill = circle(0.35).scale([3.0, 0.7]).translate([-0.1, -0.95]);
const ground = rectangle([2.6, 0.4], [0, -1.1]);
const foreground = union(midHill, ground, { k: 0.05 });

const cranium = circle(0.17, [-0.02, 0.2]);
const nose = triangle([0.1, 0.16], [0.27, 0.1], [0.1, 0.04]);
const lipBump = circle(0.025, [0.12, -0.01]);
const chin = circle(0.065, [0.07, -0.08]);
const head = union(cranium, nose, lipBump, chin, { k: 0.025 });

const neck = rectangle([0.13, 0.2], [-0.01, -0.24]);

// FIX: same trapezoid signature bug as boat test. Original was
//   trapezoid(-1.0, -0.3, 0.6, 0.3)
// trapezoid needs 2D points; also has internal y-flip → invert y signs.
// Intent: torso from world y=-1.0 (bottom, wide) to y=-0.3 (top, narrow).
const torso = trapezoid([0, 1.0], [0, 0.3], 0.6, 0.3);

const collarL = circle(0.06, [-0.18, -0.34]);
const collarR = circle(0.06, [0.16, -0.34]);
const collar = union(collarL, collarR);

const body = union(head, neck, torso, { k: 0.03 });

const hatBrim = rectangle([0.46, 0.035], [-0.02, 0.33]);
const hatCrown = rectangle([0.27, 0.34], [-0.02, 0.52]);
const hatBand = rectangle([0.27, 0.045], [-0.02, 0.365]);

const hat = union(hatBrim, hatCrown);

const bird1 = circle(0.008, [-0.5, 0.6]);
const bird2 = circle(0.008, [-0.35, 0.7]);
const bird3 = circle(0.008, [-0.65, 0.55]);
const birds = union(bird1, bird2, bird3);

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: sunGlow, color: [255, 200, 140] },
      { sdf: sun, color: [255, 235, 190] },
      { sdf: farHills, color: [110, 70, 100] },
      { sdf: foreground, color: [40, 25, 50] },
      { sdf: birds, color: [30, 20, 40] },
      { sdf: body, color: [12, 10, 22] },
      { sdf: collar, color: [12, 10, 22] },
      { sdf: hat, color: [8, 6, 16] },
      { sdf: hatBand, color: [70, 45, 55] },
    ],
    {
      view: 1.2,
      background: { top: [45, 35, 90], bottom: [245, 165, 110] },
    },
  );
}

const canvas = document.getElementById('c');
scene(canvas.getContext('2d'));
