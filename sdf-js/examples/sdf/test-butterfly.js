// LLM × SDF test #4 —— "画一只蝴蝶展翅"
// LLM 原始输出，无 bug。重点观察：
//   1. dilate(wings, 0.028) 做翅膀轮廓 —— 非提示词中的 idiom，是 LLM 自创
//   2. [235, 130, 50] 是帝王蝶颜色，spots 布局也是物种特征
//   3. 天线 rotate+translate 后的 tip 位置经过正确三角函数计算
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  union,
  dilate,
} from '../../src/index.js';

const leftUpperWing = circle(0.26).scale([1.15, 0.85]).rotate(0.45).translate([-0.4, 0.15]);
const rightUpperWing = circle(0.26).scale([1.15, 0.85]).rotate(-0.45).translate([0.4, 0.15]);
const leftLowerWing = circle(0.2).scale([1.0, 1.1]).rotate(-0.3).translate([-0.3, -0.3]);
const rightLowerWing = circle(0.2).scale([1.0, 1.1]).rotate(0.3).translate([0.3, -0.3]);

const wings = union(leftUpperWing, rightUpperWing, leftLowerWing, rightLowerWing);
const wingsBorder = dilate(wings, 0.028);

const leftUpperBand = circle(0.06).scale([1.9, 0.55]).rotate(0.45).translate([-0.55, 0.08]);
const rightUpperBand = circle(0.06).scale([1.9, 0.55]).rotate(-0.45).translate([0.55, 0.08]);
const leftLowerBand = circle(0.05).scale([1.6, 0.5]).rotate(-0.3).translate([-0.4, -0.42]);
const rightLowerBand = circle(0.05).scale([1.6, 0.5]).rotate(0.3).translate([0.4, -0.42]);
const bands = union(leftUpperBand, rightUpperBand, leftLowerBand, rightLowerBand);

const veinUpperL = rectangle([0.005, 0.32]).rotate(0.45).translate([-0.4, 0.18]);
const veinUpperR = rectangle([0.005, 0.32]).rotate(-0.45).translate([0.4, 0.18]);
const veinLowerL = rectangle([0.005, 0.22]).rotate(-0.3).translate([-0.3, -0.3]);
const veinLowerR = rectangle([0.005, 0.22]).rotate(0.3).translate([0.3, -0.3]);
const veins = union(veinUpperL, veinUpperR, veinLowerL, veinLowerR);

const spots = union(
  circle(0.024, [-0.58, 0.28]),
  circle(0.022, [-0.48, 0.13]),
  circle(0.022, [-0.42, 0.34]),
  circle(0.018, [-0.66, 0.16]),
  circle(0.024, [0.58, 0.28]),
  circle(0.022, [0.48, 0.13]),
  circle(0.022, [0.42, 0.34]),
  circle(0.018, [0.66, 0.16]),
  circle(0.02, [-0.4, -0.38]),
  circle(0.018, [-0.28, -0.44]),
  circle(0.02, [0.4, -0.38]),
  circle(0.018, [0.28, -0.44]),
);

const body = rounded_rectangle([0.055, 0.58], 0.027, [0, -0.04]);
const head = circle(0.058, [0, 0.3]);

const bodySegment1 = rectangle([0.058, 0.012], [0, 0.08]);
const bodySegment2 = rectangle([0.058, 0.012], [0, -0.02]);
const bodySegment3 = rectangle([0.058, 0.012], [0, -0.12]);
const bodySegment4 = rectangle([0.058, 0.012], [0, -0.22]);
const bodySegments = union(bodySegment1, bodySegment2, bodySegment3, bodySegment4);

const leftAntenna = rectangle([0.008, 0.22]).rotate(0.4).translate([-0.082, 0.45]);
const rightAntenna = rectangle([0.008, 0.22]).rotate(-0.4).translate([0.082, 0.45]);
const leftAntennaTip = circle(0.024, [-0.125, 0.555]);
const rightAntennaTip = circle(0.024, [0.125, 0.555]);
const antennae = union(leftAntenna, rightAntenna, leftAntennaTip, rightAntennaTip);

const eyeL = circle(0.012, [-0.025, 0.31]);
const eyeR = circle(0.012, [0.025, 0.31]);

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: wingsBorder, color: [25, 20, 30] },
      { sdf: wings, color: [235, 130, 50] },
      { sdf: bands, color: [25, 20, 30] },
      { sdf: veins, color: [60, 35, 25] },
      { sdf: spots, color: [250, 240, 220] },
      { sdf: body, color: [30, 25, 35] },
      { sdf: bodySegments, color: [70, 55, 60] },
      { sdf: head, color: [30, 25, 35] },
      { sdf: eyeL, color: [240, 230, 210] },
      { sdf: eyeR, color: [240, 230, 210] },
      { sdf: antennae, color: [30, 25, 35] },
    ],
    {
      view: 1.2,
      background: { top: [195, 225, 240], bottom: [250, 230, 215] },
    },
  );
}

const canvas = document.getElementById('c');
scene(canvas.getContext('2d'));
