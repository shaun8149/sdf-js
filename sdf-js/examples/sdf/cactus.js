// =============================================================================
// BOB scene 1 (cactus + moon + ground + gate) 用 sdf-js 链式 API 重写
// -----------------------------------------------------------------------------
// 与 BOB scenes/2d.js 的 sdf_cactus / sdf_moon / sdf_line / sdCrossGate 对照。
//
// 渲染策略：每像素求所有形状 SDF，按图层顺序 alpha 合成 (基于 smoothstep
// 抗锯齿)。比 BOB 的 cell-stipple 简单，但视觉上能表达同样的"具象+剪影"效果。
// =============================================================================

import {
  rounded_rectangle, rectangle, circle, line,
  union, difference,
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

// 暖纸天空：上偏粉、下偏桃，给整个场景一个温暖底色
const SKY_TOP = [219, 198, 175];
const SKY_BOT = [240, 198, 168];

const VIEW = 1.2;                                 // 世界半宽
const canvas = document.getElementById('c');
const W = canvas.width, H = canvas.height;
const ctx = canvas.getContext('2d');

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const t0 = performance.now();
const img = ctx.createImageData(W, H);
const data = img.data;
const aaWidth = 2 * VIEW / W;                     // 一个像素的世界宽度，做 1px 抗锯齿

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const wx = (x / W) * 2 * VIEW - VIEW;
    const wy = -((y / H) * 2 * VIEW - VIEW);      // 翻 Y → +Y 朝上

    // 起手：天空垂直渐变
    const skyT = (wy + VIEW) / (2 * VIEW);        // 0 (底) → 1 (顶)
    let col = lerp3(SKY_BOT, SKY_TOP, skyT);

    // 自底向上叠图层；smoothstep 在 0 边界做抗锯齿
    for (const { sdf, color } of layers) {
      const d = sdf([wx, wy]);
      const t = smoothstep(aaWidth, -aaWidth, d);  // d<0 → t=1, d>0 → t=0
      col = lerp3(col, color, t);
    }

    const i = (y * W + x) * 4;
    data[i]     = col[0];
    data[i + 1] = col[1];
    data[i + 2] = col[2];
    data[i + 3] = 255;
  }
}
ctx.putImageData(img, 0, 0);
document.getElementById('stats').textContent =
  `${W}×${H} · ${(performance.now() - t0).toFixed(0)} ms · ${layers.length} 层 SDF + 天空`;
