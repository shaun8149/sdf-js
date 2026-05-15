// LLM × SDF round 2 #4 —— "画一只蝴蝶展翅"
// v2 是 disciplined refinement 不是大跳跃 —— v1 (95 分) 已经强了。
// v2 改动主要是规范 idiom 应用：
// - bands / veins / bodySegments 全部 intersection-clip 到 parent silhouette
// - bodyAndHead = union(body, head) 后做一条连续 outline（消除接缝）
// - outline 厚度分级：wings 0.028 / body+head 0.020 / antennae 0.006
// - 10 个 palette 命名常量
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  union,
  intersection,
  dilate,
} from '../../src/index.js';

const leftUpperWing  = circle(0.26).scale([1.15, 0.85]).rotate( 0.45).translate([-0.40,  0.15]);
const rightUpperWing = circle(0.26).scale([1.15, 0.85]).rotate(-0.45).translate([ 0.40,  0.15]);
const leftLowerWing  = circle(0.20).scale([1.00, 1.10]).rotate(-0.30).translate([-0.30, -0.30]);
const rightLowerWing = circle(0.20).scale([1.00, 1.10]).rotate( 0.30).translate([ 0.30, -0.30]);
const wings = union(leftUpperWing, rightUpperWing, leftLowerWing, rightLowerWing);

const bandShapes = union(
  circle(0.06).scale([1.9, 0.55]).rotate( 0.45).translate([-0.55,  0.08]),
  circle(0.06).scale([1.9, 0.55]).rotate(-0.45).translate([ 0.55,  0.08]),
  circle(0.05).scale([1.6, 0.50]).rotate(-0.30).translate([-0.40, -0.42]),
  circle(0.05).scale([1.6, 0.50]).rotate( 0.30).translate([ 0.40, -0.42]),
);
const bands = intersection(bandShapes, wings);

const veinShapes = union(
  rectangle([0.005, 0.32]).rotate( 0.45).translate([-0.40,  0.18]),
  rectangle([0.005, 0.32]).rotate(-0.45).translate([ 0.40,  0.18]),
  rectangle([0.005, 0.22]).rotate(-0.30).translate([-0.30, -0.30]),
  rectangle([0.005, 0.22]).rotate( 0.30).translate([ 0.30, -0.30]),
);
const veins = intersection(veinShapes, wings);

const spots = union(
  circle(0.024, [-0.58,  0.28]),
  circle(0.022, [-0.48,  0.13]),
  circle(0.022, [-0.42,  0.34]),
  circle(0.018, [-0.66,  0.16]),
  circle(0.024, [ 0.58,  0.28]),
  circle(0.022, [ 0.48,  0.13]),
  circle(0.022, [ 0.42,  0.34]),
  circle(0.018, [ 0.66,  0.16]),
  circle(0.020, [-0.40, -0.38]),
  circle(0.018, [-0.28, -0.44]),
  circle(0.020, [ 0.40, -0.38]),
  circle(0.018, [ 0.28, -0.44]),
);

const body = rounded_rectangle([0.055, 0.58], 0.027, [0, -0.04]);
const head = circle(0.058, [0, 0.30]);
const bodyAndHead = union(body, head);

const bodySegments = intersection(
  body,
  union(
    rectangle([0.10, 0.012], [0,  0.08]),
    rectangle([0.10, 0.012], [0, -0.02]),
    rectangle([0.10, 0.012], [0, -0.12]),
    rectangle([0.10, 0.012], [0, -0.22]),
  ),
);

const antennae = union(
  rectangle([0.008, 0.22]).rotate( 0.40).translate([-0.082, 0.45]),
  rectangle([0.008, 0.22]).rotate(-0.40).translate([ 0.082, 0.45]),
  circle(0.024, [-0.125, 0.555]),
  circle(0.024, [ 0.125, 0.555]),
);

const eyes = union(
  circle(0.012, [-0.025, 0.31]),
  circle(0.012, [ 0.025, 0.31]),
);

const SKY_TOP    = [195, 225, 240];
const SKY_BOTTOM = [250, 230, 215];
const WING_C     = [235, 130, 50];
const BAND_C     = [22,  18,  20];
const VEIN_C     = [60,  35,  25];
const SPOT_C     = [250, 240, 220];
const BODY_C     = [30,  25,  35];
const SEG_C      = [80,  62,  72];
const EYE_C      = [240, 230, 210];
const OUTLINE    = [22,  18,  20];

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: dilate(wings, 0.028), color: OUTLINE },
      { sdf: wings,                color: WING_C },

      { sdf: bands, color: BAND_C },
      { sdf: veins, color: VEIN_C },

      { sdf: spots, color: SPOT_C },

      { sdf: dilate(bodyAndHead, 0.020), color: OUTLINE },
      { sdf: body,                       color: BODY_C },
      { sdf: bodySegments,               color: SEG_C },
      { sdf: head,                       color: BODY_C },

      { sdf: eyes, color: EYE_C },

      { sdf: dilate(antennae, 0.006), color: OUTLINE },
      { sdf: antennae,                color: BODY_C },
    ],
    {
      view: 1.2,
      background: { top: SKY_TOP, bottom: SKY_BOTTOM },
    },
  );
}

export function getSdfs() {
  return [wings, bands, veins, spots, body, bodySegments, head, eyes, antennae];
}

const _canvas = typeof document !== 'undefined' && document.getElementById('c');
if (_canvas) scene(_canvas.getContext('2d'));
