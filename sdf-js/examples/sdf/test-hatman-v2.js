// LLM × SDF round 2 #5 —— "画一个戴礼帽的男人侧影，正在看远方"
// v2 是 architectural shift，不是 idiom 微调：
// - v1 用 14 个 anatomical parts smooth-union，trapezoid bug + scale 失控
// - v2 用 ONE polygon (30 顶点) 直接画整个 silhouette，绕开 trapezoid
// - v2 鼻/唇/颌 x 顺序在 vertex 列表里精确编码
// - v2 身体延伸到 y=-1.30 off-canvas，回避 absolute proportion 问题
// - v2 帽顶用 per-corner radius (只顶部圆角)
// - v2 没给 figure 加 outline (正确判断 —— 纯 silhouette 不需要)
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  polygon,
  union,
} from '../../src/index.js';

const sun = circle(0.13, [0.62, -0.32]);

const horizon = rectangle([3.0, 0.7], [0, -0.85]);

const profile = polygon([
  [-0.08, 0.40],
  [-0.02, 0.38],
  [ 0.00, 0.34],
  [-0.01, 0.29],
  [ 0.08, 0.24],
  [ 0.01, 0.20],
  [ 0.04, 0.16],
  [ 0.00, 0.11],
  [ 0.06, 0.05],
  [ 0.02, 0.00],
  [ 0.01,-0.04],

  [ 0.18,-0.10],
  [ 0.42,-0.22],
  [ 0.55,-0.50],
  [ 0.60,-0.80],
  [ 0.60,-1.30],

  [-0.60,-1.30],

  [-0.60,-0.80],
  [-0.55,-0.50],
  [-0.42,-0.22],
  [-0.28,-0.05],
  [-0.25, 0.06],
  [-0.28, 0.14],
  [-0.31, 0.24],
  [-0.31, 0.32],
  [-0.26, 0.39],
  [-0.18, 0.41],
]);

const hatBrim  = rectangle([0.46, 0.035], [-0.10, 0.40]);
const hatCrown = rounded_rectangle([0.32, 0.32], [0.04, 0.04, 0, 0], [-0.10, 0.565]);
const hat = union(hatBrim, hatCrown);

const figure = union(profile, hat);

const SKY_TOP    = [50,  40,  78];
const SKY_BOTTOM = [255, 175, 130];
const SUN_C      = [255, 230, 168];
const HORIZON_C  = [38,  30,  55];
const FIGURE_C   = [20,  16,  24];

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: sun, color: SUN_C },
      { sdf: horizon, color: HORIZON_C },
      { sdf: figure, color: FIGURE_C },
    ],
    {
      view: 1.2,
      background: { top: SKY_TOP, bottom: SKY_BOTTOM },
    },
  );
}

export function getSdfs() {
  return [sun, horizon, figure];
}

const _canvas = typeof document !== 'undefined' && document.getElementById('c');
if (_canvas) scene(_canvas.getContext('2d'));
