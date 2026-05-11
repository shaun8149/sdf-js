// =============================================================================
// 装配动画 demo —— scatter → assemble，重复循环
// 流程：
//   1. caGrid() 跑 CA 生成
//   2. caRects() 折成矩形列表
//   3. caShuffle() 在每个 rect 上累积一个移位 path
//   4. 每帧倒着播 path → 看到从打散状态聚拢成最终形状
//   5. 播完后回到 step 1 重新生成
// =============================================================================

import * as sdf from '../../src/index.js';
import { caGrid, caRects, caShuffle, caDrawRectsAt, fromSdf2 } from '../../src/ca/index.js';
import { ROBOT } from './robot-shapes.js';

const SHAPES = {
  ring:        () => sdf.circle(0.7).difference(sdf.circle(0.3)),
  circle:      () => sdf.circle(0.7),
  ellipse:     () => sdf.circle(0.9).scale([1, 0.6]),
  hexagon:     () => sdf.hexagon(0.7),
  figure_eight:() => sdf.circle(0.45).translate([-0.35, 0])
                       .union(sdf.circle(0.45).translate([0.35, 0])),
  cross:       () => sdf.rectangle([1.5, 0.5]).union(sdf.rectangle([0.5, 1.5])),
  rounded:     () => sdf.rounded_rectangle([1.4, 1.4], 0.25),
  // 机器人：定义在 robot-shapes.js（共享给 ca.js）。在那里改唯一一处即可
  robot:       () => ROBOT,
};

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const BG = '#eee8e2';
const HOLD_FRAMES = 25;

const $ = (id) => document.getElementById(id);
const els = {
  shape: $('shape'),
  frames: $('frames'),     fv: $('fv'),
  movement: $('movement'), mv: $('mv'),
  symmetric: $('symmetric'),
  gridDim: $('gridDim'),   gv: $('gv'),
  roundness: $('roundness'), rv: $('rv'),
  rebuild: $('rebuild'),   pause: $('pause'),
  stats: $('stats'),
};

// ---- 状态 ------------------------------------------------------------------
let rects = [];
let totalFrames = 200;
let tick = 0;
let cellSize = 16;
let offsetX = 0, offsetY = 0;
let paused = false;
let rafId = 0;

function regenerate() {
  const gridDim = parseInt(els.gridDim.value, 10);
  totalFrames = parseInt(els.frames.value, 10);
  const sdf2 = SHAPES[els.shape.value]();
  const isInside = fromSdf2(sdf2, gridDim);

  // 与 ca.html 默认机器人配置完全一致
  const grid = caGrid(isInside, gridDim, {
    initiateChance:  0.85,
    extensionChance: 0.75,
    solidness:       0.56,
    verticalChance:  0.50,
    roundness:       parseFloat(els.roundness.value),
    colorMode:       'group',
    groupSize:       0.82,
    hSymmetric:      true,
    vSymmetric:      false,
  });

  rects = caRects(grid);
  caShuffle(rects, {
    frames: totalFrames,
    holdFrames: HOLD_FRAMES,
    movementLength: parseFloat(els.movement.value),
    symmetric: els.symmetric.checked,
  });

  // 居中：以原始位置（grid 中心）为基准计算 offset
  cellSize = Math.floor(Math.min(W, H) / (gridDim + 8));    // 留点边
  const total = cellSize * (gridDim + 1);
  // 必须取整，否则 fillRect 在小数坐标抗锯齿，相邻矩形边界 50% 覆盖叠加→看到背景色"白网格"
  offsetX = Math.floor((W - total) / 2);
  offsetY = Math.floor((H - total) / 2);

  tick = 0;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

function frame() {
  if (paused) return;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // 倒着播 path：tick=0 看 path[末尾](最散) → tick=末尾 看 path[0](原位)
  const pathIdx = totalFrames - tick - 1;
  caDrawRectsAt(ctx, rects, pathIdx, cellSize, {
    offsetX, offsetY,
    stroke: false,
  });

  if (tick >= totalFrames - 1) {
    // 装配完成 —— 停在最终帧，等用户点"重新生成"
    els.stats.textContent = `${rects.length} rects · 完成`;
    return;
  }

  els.stats.textContent =
    `${rects.length} rects · frame ${tick}/${totalFrames} · ${(tick / totalFrames * 100).toFixed(0)}%`;

  tick++;
  rafId = requestAnimationFrame(frame);
}

// ---- Slider 同步 + 重新构建 ------------------------------------------------
const updateAndRebuild = () => {
  els.fv.textContent = els.frames.value;
  els.mv.textContent = parseFloat(els.movement.value).toFixed(2);
  els.gv.textContent = els.gridDim.value;
  els.rv.textContent = parseFloat(els.roundness.value).toFixed(2);
  regenerate();
};

['frames', 'movement', 'gridDim', 'roundness'].forEach(k => {
  els[k].addEventListener('input', updateAndRebuild);
});
['shape', 'symmetric'].forEach(k => {
  els[k].addEventListener('change', regenerate);
});
els.rebuild.addEventListener('click', regenerate);

els.pause.addEventListener('click', () => {
  paused = !paused;
  els.pause.textContent = paused ? '继续' : '暂停';
  if (!paused) rafId = requestAnimationFrame(frame);
});

// ---- 启动 ------------------------------------------------------------------
regenerate();
