// =============================================================================
// BOB scene 1，painted 笔触渲染版
// -----------------------------------------------------------------------------
// 用 src/render/painted —— 嵌套网格 + Perlin bend + 多层笔触叠绘。
// 这个 demo 现在只剩"场景定义 + 生成器调度 + UI 装配"，渲染逻辑全部沉到 lib 里。
// =============================================================================

import {
  rounded_rectangle, rectangle, circle, line, union,
  render,
} from '../../src/index.js';

// ---- 场景 SDFs（与 cactus.js 完全一致）-----------------------------------
const cactus = union(
  rounded_rectangle([0.30, 1.60], [0.15, 0, 0.15, 0]),
  rounded_rectangle([0.20, 0.80], [0.10, 0, 0.10, 0]).translate([ 0.30,  0.10]),
  rounded_rectangle([0.20, 0.80], [0.10, 0, 0.10, 0]).translate([-0.30, -0.10]),
  rounded_rectangle([0.20, 0.20], 0.05).translate([ 0.20, 0.40]),
  rounded_rectangle([0.20, 0.20], 0.05).translate([-0.20, 0.20]),
).scale(1 / 1.5).translate([0, 0.2]);

const moon =
  circle(0.16)
    .difference(circle(0.18).translate([-0.06, 0.04]))
    .translate([-0.65, 0.55]);

const ground = line([0, -1], [0, -0.45]);

const gate =
  rectangle([0.20, 0.20])
    .difference(rectangle([0.16, 0.16]))
    .rotate(Math.PI / 4)
    .scale([0.5, 1])
    .translate([0.85, -0.15]);

const sdfs = [moon, ground, cactus, gate];

// ---- p5 入口（global mode）-----------------------------------------------
const BG = '#fdf9f6';
let painter;

window.setup = () => {
  pixelDensity(2);
  const canvas = createCanvas(720, 720);
  canvas.parent('canvas-host');
  noStroke();
  background(BG);

  // 启动生成器。startIndex 给个随机偏移让每次刷新换配色组合。
  painter = render.painted(window, sdfs, {
    startIndex: Math.floor(Math.random() * 12),
    view: 1.0,
    layers: 5,
    middleScaleSize: 6,
    smallScaleSize: 2,
    smallSegs: 5,
    rH: 0.6,
    brushSpeed: 2,
  });

  document.getElementById('stats').textContent = 'painting…';
};

window.draw = () => {
  const r = painter.next();
  if (r.done) {
    document.getElementById('stats').textContent = 'done';
    noLoop();
  }
};
