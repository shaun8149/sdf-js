// =============================================================================
// Alice —— BOB scene 用新 sdf-js 模块重写
// -----------------------------------------------------------------------------
// 原版（p5code/Alice）的全部行为现在分散到：
//   field.protoOpacity      —— proto 场（球极投影 + N 重对称 + 振荡调制）
//   render.tileGrid         —— 网格扫描
//   render.drawLineSquare   —— 单格 Cohen-Sutherland 平行线填充
//   palette.generative      —— ColorGenerator 类 + nColor 生成器
//   math.easing.pickRandom  —— 随机抽 easing 函数控制线密度
//
// 这个 demo 现在只剩"参数随机 + tile 决策逻辑"。
// =============================================================================

import { field, render, palette, math } from '../../src/index.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---- 参数（每次刷新随机一组）---------------------------------------------

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const params = {
  borderRatio: 0.12,
  scl:         pick([8, 12, 16]),       // tile 网格密度 = canvas / scl
  freq:        pick([4, 6, 8]),
  phase:       1,
  domains:     5,
  range:       pick([1, 2]),
  scale:       pick([8, 10, 16, 20]),
  minStep:     pick([0.1, 0.15, 0.2]),
  maxStep:     pick([0.7, 0.8]),
  colorOffset: Math.random() * 100,
  unit:        150,    // proto 球极半径
};

// ---- 颜色 -----------------------------------------------------------------

const colorGen = new palette.generative.ColorGenerator();
colorGen.create(params.scale, params.range, params.colorOffset, Math.random);

const colorGen2 = palette.generative.nColor(
  (params.colorOffset + 50) % 100,
  10 + params.colorOffset,
);

const WHITE = () => palette.generative.definingWhite();
const BLACK = () => palette.generative.definingBlack();

// 把 [r,g,b] 转成 CSS string
const css = ([r, g, b]) => `rgb(${r|0},${g|0},${b|0})`;

// ---- proto 场（解析的、整张图一个 field 实例）-----------------------------

const protoField = field.protoOpacity({
  r:       params.unit,
  freq:    params.freq,
  phase:   params.phase,
  domains: params.domains,
});

// 1D 域 fold（用于 back-pass 的周期 banding）
const wrap1d = (v, P) => v - P * Math.floor((v + P / 2) / P);

// 缓动函数（每次刷新随机抽一个，控制 stepAttribute → 线间距）
const easingFn = math.easing.pickRandom();

// ---- 主绘制 ---------------------------------------------------------------

function render_alice() {
  ctx.fillStyle = '#cfc7b9';
  ctx.fillRect(0, 0, W, H);

  const border = W * params.borderRatio;
  const offset = W - border;
  const count = Math.floor(offset / params.scl);
  const cell = offset / count;
  const direction = Math.random();    // 决定 normalizedX/Y 朝向（4 种）

  render.tileGrid(ctx, {
    bounds: { minX: border / 2, maxX: border / 2 + offset,
              minY: border / 2, maxY: border / 2 + offset },
    cellSize: cell,
    tile: (ctx, info) => {
      const { x, y, w, i, j } = info;

      // —— proto 场采样（中心化坐标，[-count/2, +count/2] × cell）——
      const px = cell * (i - count / 2);
      const py = cell * (j - count / 2);
      const protoVal = protoField(px, py);
      // Alice 原版有个"二次调制"——把 proto 输出当 angle 再 cos/freq 一次
      const opac = (Math.cos(protoVal * params.freq) + 1) / 2;

      // —— 位置归一化（用于 back pass 的 stepAttribute）——
      const nY = y / H;
      const nXcentered = x / W - 0.5;
      const normalized =
        direction > 0.75 ? 1 - nY :
        direction > 0.5  ? nY :
        direction > 0.25 ? 1 - (x / W) :
                           (x / W);
      const zeroToOne = wrap1d(nXcentered, 0.1) - 0.02;

      // —— 两遍叠加：原版顺序 front 先画，back 后画（覆盖在上面）——
      drawTile(ctx, x, y, w, opac,       normalized,            [0.33,  0.5],  'front');
      drawTile(ctx, x, y, w, zeroToOne, Math.sqrt(normalized), [-0.01, 0.67], 'back');
    },
  });
}

// back pass 的 fall-through 状态（原版隐式依赖"前一格留下的 stroke"）
let lastStrokeStyle = '#000';

function drawTile(ctx, x, y, w, colorAttr, stepAttr, [T1, T2], type) {
  let strokeStyle;

  if (type === 'front') {
    // 原版 setColor(index) 里 pal 数组 eager 求值，**不管选哪一支都会调一次
    // colorGen.getColor()**。这里复刻这个推进行为 —— 让 colorGen 序列每格都
    // 前进一次（而不是只在"真的用 color"时前进），渐变循环速率才对得上。
    const cgColor = colorGen.getColor();
    if      (colorAttr < T1) strokeStyle = css(WHITE());   // 原版 pal[2] = WHITE
    else if (colorAttr < T2) strokeStyle = 'rgb(150,150,150)';
    else                     strokeStyle = css(cgColor);
  } else {
    // back pass —— 三个分支都画线，> T2 时沿用上一格的 stroke（原版隐式行为）
    if      (colorAttr < T1) strokeStyle = css(WHITE());
    else if (colorAttr < T2) strokeStyle = css(colorGen2.next().value);
    else                     strokeStyle = lastStrokeStyle;
    lastStrokeStyle = strokeStyle;
  }

  // —— 线密度（stepAttr 经过 easing 映射）——
  const eased = Math.max(0, Math.min(1, easingFn(stepAttr)));
  const step = params.minStep * w + (1 - eased) * (params.maxStep - params.minStep) * w;

  // —— 线方向：随机 ——
  const angle = Math.random() * Math.PI * 2;

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';   // 匹配 p5 strokeCap(ROUND) 默认
  render.drawLineSquare(ctx, x, y, w, step, angle);
}

// ---- 控件 ----------------------------------------------------------------

document.getElementById('regen').addEventListener('click', () => location.reload());
document.getElementById('save').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `alice-${Date.now()}.png`;
  a.click();
});

document.getElementById('params').textContent =
  `scl ${params.scl} · freq ${params.freq} · domains ${params.domains} · ` +
  `easing ${easingFn.name || 'random'}`;

render_alice();
