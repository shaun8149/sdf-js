// LLM × SDF test #1 —— "画一棵简单的树"
// 由独立的 Claude 窗口在 sdf-js system prompt 下生成。原样保留。
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  union,
} from '../../src/index.js';

const trunk = rounded_rectangle([0.12, 0.5], 0.03, [0, -0.25]);

const crownMain = circle(0.32, [0, 0.25]);
const crownLeft = circle(0.22, [-0.25, 0.15]);
const crownRight = circle(0.22, [0.25, 0.15]);
const crownTop = circle(0.2, [0, 0.45]);

const crown = union(crownMain, crownLeft, crownRight, crownTop, { k: 0.08 });

const ground = rectangle([2.4, 0.1], [0, -0.55]);

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: ground, color: [110, 85, 60] },
      { sdf: trunk, color: [90, 60, 40] },
      { sdf: crown, color: [70, 130, 70] },
    ],
    {
      view: 1.2,
      background: { top: [200, 225, 240], bottom: [240, 230, 200] },
    },
  );
}

// --- 自调用（我加的，让文件能直接跑）---
const canvas = document.getElementById('c');
scene(canvas.getContext('2d'));
