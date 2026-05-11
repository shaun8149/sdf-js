// =============================================================================
// BOB scene 1 (cactus + moon + ground + gate) 用 sdf-js 链式 API 重写
// -----------------------------------------------------------------------------
// 与 BOB scenes/2d.js 的 sdf_cactus / sdf_moon / sdf_line / sdCrossGate 对照。
//
// 渲染走 src/render/silhouette —— 多层 SDF + 天空渐变 + smoothstep AA。
// 这个 demo 现在只剩"场景定义 + 一行 render 调用"，渲染逻辑全部沉到 lib 里。
// =============================================================================

import {
  rounded_rectangle, rectangle, circle, line,
  union, difference,
  render,
} from '../../src/index.js';

// ---- 场景定义 --------------------------------------------------------------

// 仙人掌：5 个圆角矩形 union；最后整体 .scale(1/1.5).translate([0, 0.2])
// 与 BOB sdf_cactus 等价 —— BOB 是 trans2(n=1.5, sub2(p, [0, 0.2]))
const cactus = union(
  rounded_rectangle([0.30, 1.60], [0.15, 0, 0.15, 0]),                   // 主干
  rounded_rectangle([0.20, 0.80], [0.10, 0, 0.10, 0]).translate([ 0.30,  0.10]),  // 右臂
  rounded_rectangle([0.20, 0.80], [0.10, 0, 0.10, 0]).translate([-0.30, -0.10]),  // 左臂
  rounded_rectangle([0.20, 0.20], 0.05).translate([ 0.20, 0.40]),        // 右肘连接
  rounded_rectangle([0.20, 0.20], 0.05).translate([-0.20, 0.20]),        // 左肘连接
).scale(1 / 1.5).translate([0, 0.2]);

// 月牙：两个圆做差。半径稍大的那个偏移挖空，留下右侧的月牙
const moon =
  circle(0.16)
    .difference(circle(0.18).translate([-0.06, 0.04]))
    .translate([-0.65, 0.55]);

// 地平线：法线朝下的半平面（"地"在下半部分）
const ground = line([0, -1], [0, -0.45]);

// 十字门：方框减小方框 → 框线，绕原点 45° 旋转 → 菱形门框
// BOB 还做了 (n=2,1) 横向压扁，在我们 API 里就是 .scale([0.5, 1])
const gate =
  rectangle([0.20, 0.20])
    .difference(rectangle([0.16, 0.16]))
    .rotate(Math.PI / 4)
    .scale([0.5, 1])
    .translate([0.85, -0.15]);

// 图层顺序：从底到顶
const layers = [
  { sdf: ground, color: [196, 138, 92] },     // 地（暖棕）
  { sdf: moon,   color: [248, 232, 195] },    // 月（米白）
  { sdf: cactus, color: [76,  118, 88]  },    // 仙人掌（沙绿）
  { sdf: gate,   color: [54,  36,  28]  },    // 门（深咖啡）
];

// ---- 渲染 ------------------------------------------------------------------

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const t0 = performance.now();
render.silhouette(ctx, layers, {
  view: 1.2,
  background: { top: [219, 198, 175], bottom: [240, 198, 168] },  // 暖纸天空：上偏粉、下偏桃
});

document.getElementById('stats').textContent =
  `${canvas.width}×${canvas.height} · ${(performance.now() - t0).toFixed(0)} ms · ${layers.length} 层 SDF + 天空`;
