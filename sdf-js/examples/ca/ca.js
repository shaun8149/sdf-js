// =============================================================================
// SDF + CA 静态 demo —— 用任意 sdf-js 形状跑 ApparatusGenerator
// =============================================================================

import * as sdf from '../../src/index.js';
import { caGrid, fromSdf2, caDraw } from '../../src/ca/index.js';
import { ROBOT, ROBOT_CODE } from './robot-shapes.js';

// 形状预设：返回 SDF2 实例 + 展示用代码字符串
const SHAPES = {
  ring:        { sdf: () => sdf.circle(0.7).difference(sdf.circle(0.3)),
                 code: 'circle(0.7).difference(circle(0.3))' },
  circle:      { sdf: () => sdf.circle(0.7),
                 code: 'circle(0.7)' },
  square:      { sdf: () => sdf.rectangle([1.4, 1.4]),
                 code: 'rectangle([1.4, 1.4])' },
  rounded:     { sdf: () => sdf.rounded_rectangle([1.4, 1.4], 0.25),
                 code: 'rounded_rectangle([1.4, 1.4], 0.25)' },
  ellipse:     { sdf: () => sdf.circle(0.9).scale([1, 0.6]),
                 code: 'circle(0.9).scale([1, 0.6])' },
  hexagon:     { sdf: () => sdf.hexagon(0.7),
                 code: 'hexagon(0.7)' },
  triangle:    { sdf: () => sdf.equilateral_triangle().scale(0.7),
                 code: 'equilateral_triangle().scale(0.7)' },
  figure_eight:{ sdf: () => sdf.circle(0.45).translate([-0.35, 0])
                              .union(sdf.circle(0.45).translate([0.35, 0])),
                 code: 'circle(0.45).translate([-0.35,0])\n  .union(circle(0.45).translate([0.35,0]))' },
  cross:       { sdf: () => sdf.rectangle([1.5, 0.5])
                              .union(sdf.rectangle([0.5, 1.5])),
                 code: 'rectangle([1.5,0.5])\n  .union(rectangle([0.5,1.5]))' },
  tall:        { sdf: () => sdf.rectangle([0.6, 1.6]),
                 code: 'rectangle([0.6, 1.6])' },
  // 机器人：定义在 robot-shapes.js（共享给 ca-animate）。在那里改唯一一处即可
  robot: { sdf: () => ROBOT, code: ROBOT_CODE },
};

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const BG = '#eee8e2';

const $ = (id) => document.getElementById(id);
const els = {
  shape: $('shape'), shapeCode: $('shape-code'),
  initiate: $('initiate'), iv: $('iv'),
  extend: $('extend'),     xv: $('xv'),
  solid: $('solid'),       sv: $('sv'),
  vertical: $('vertical'), vv: $('vv'),
  roundness: $('roundness'), rv: $('rv'),
  gridDim: $('gridDim'),   gv: $('gv'),
  colorMode: $('colorMode'),
  groupSize: $('groupSize'), gsv: $('gsv'),
  hSym: $('hSym'), vSym: $('vSym'),
  rebuild: $('rebuild'),   save: $('save'),
};

function rebuild() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const key = els.shape.value;
  const shape = SHAPES[key];
  els.shapeCode.textContent = shape.code;

  const gridDim = parseInt(els.gridDim.value, 10);
  const sdf2 = shape.sdf();
  const isInside = fromSdf2(sdf2, gridDim);

  const grid = caGrid(isInside, gridDim, {
    initiateChance:  parseFloat(els.initiate.value),
    extensionChance: parseFloat(els.extend.value),
    solidness:       parseFloat(els.solid.value),
    verticalChance:  parseFloat(els.vertical.value),
    roundness:       parseFloat(els.roundness.value),
    colorMode:       els.colorMode.value,
    groupSize:       parseFloat(els.groupSize.value),
    hSymmetric:      els.hSym.checked,
    vSymmetric:      els.vSym.checked,
  });

  // 网格居中铺画布
  const cellSize = Math.floor(Math.min(W, H) / (gridDim + 1));
  const total = cellSize * (gridDim + 1);
  caDraw(ctx, grid, cellSize, {
    offsetX: (W - total) / 2,
    offsetY: (H - total) / 2,
    lineWidth: Math.max(1, cellSize * 0.18),
  });
}

// ---- Slider 同步显示 + 重渲 -----------------------------------------------
function bindSlider(input, valEl, fmt = (n) => parseFloat(n).toFixed(2)) {
  input.addEventListener('input', () => {
    valEl.textContent = fmt(input.value);
    rebuild();
  });
}
bindSlider(els.initiate, els.iv);
bindSlider(els.extend, els.xv);
bindSlider(els.solid, els.sv);
bindSlider(els.vertical, els.vv);
bindSlider(els.roundness, els.rv);
bindSlider(els.gridDim, els.gv, (n) => n);
bindSlider(els.groupSize, els.gsv);

els.shape.addEventListener('change', rebuild);
els.colorMode.addEventListener('change', rebuild);
els.hSym.addEventListener('change', rebuild);
els.vSym.addEventListener('change', rebuild);
els.rebuild.addEventListener('click', rebuild);

els.save.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `ca-${els.shape.value}-${Date.now()}.png`;
  a.click();
});

rebuild();
