// LLM × SDF round 2 #1 —— "画一棵简单的树"
// 用改良版 SKILL.md prompt 跑出的输出。对比 test-tree.js (v1)：
// - v2 系统性应用 dilate-as-outline idiom（v1 没用）
// - v2 crown 5 个圆（v1 4 个）
// - v2 ground 是厚带（v1 是薄长条）
// - v2 把 palette 拆成命名常量
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  union,
  dilate,
} from '../../src/index.js';

const trunk = rounded_rectangle([0.12, 0.55], 0.02, [0, -0.375]);

const crown = union(
  circle(0.28, [0,     0.20]),
  circle(0.22, [-0.22, 0.13]),
  circle(0.22, [ 0.22, 0.13]),
  circle(0.20, [-0.10, 0.38]),
  circle(0.20, [ 0.10, 0.40]),
  { k: 0.08 },
);

const ground = rectangle([3.0, 0.5], [0, -0.9]);

const SKY_TOP    = [196, 220, 232];
const SKY_BOTTOM = [232, 226, 208];
const GROUND_C   = [186, 158, 112];
const TRUNK_C    = [104, 70, 42];
const CROWN_C    = [92, 134, 74];
const OUTLINE    = [38, 28, 22];

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: dilate(ground, 0.022), color: OUTLINE },
      { sdf: ground,                color: GROUND_C },

      { sdf: dilate(trunk, 0.025), color: OUTLINE },
      { sdf: trunk,                color: TRUNK_C },

      { sdf: dilate(crown, 0.025), color: OUTLINE },
      { sdf: crown,                color: CROWN_C },
    ],
    {
      view: 1.2,
      background: { top: SKY_TOP, bottom: SKY_BOTTOM },
    },
  );
}

export function getSdfs() {
  return [ground, trunk, crown];
}

const _canvas = typeof document !== 'undefined' && document.getElementById('c');
if (_canvas) scene(_canvas.getContext('2d'));
