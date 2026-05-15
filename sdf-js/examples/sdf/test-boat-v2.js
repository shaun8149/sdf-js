// LLM × SDF round 2 #2 —— "画一艘古代帆船"
// 改良 SKILL.md prompt 跑出的输出。对比 test-boat.js (v1)：
// - v2 彻底避开 trapezoid（v1 在那 bug 过），改用 polygon 手画船身
// - v2 outline idiom 5 处全用，且厚度分级（hull 0.025 / sails 0.022 / mast 0.015 / yards+flag 0.010）
// - v2 用 intersection 把装饰带 clip 到船身轮廓内
// - v2 全部 palette 拆成命名常量 + 注释解释 geometry 意图
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  polygon,
  triangle,
  flower,
  union,
  intersection,
  dilate,
} from '../../src/index.js';

const sun = circle(0.16, [0.78, 0.78]);

const sea  = rectangle([3.0, 0.7], [0, -0.95]);
const foam = flower(0.03, 20, 0, 0.04).translate([0, -0.55]).scale([8, 1]);

const hullBody = polygon([
  [-0.58, -0.10],
  [ 0.58, -0.10],
  [ 0.46, -0.38],
  [-0.46, -0.38],
]);
const keel = circle(0.10).scale([3.8, 1.0]).translate([0, -0.40]);
const hull = union(hullBody, keel, { k: 0.04 });

const trimGold = intersection(hull, rectangle([2.0, 0.04], [0, -0.135]));
const trimDark = intersection(hull, rectangle([2.0, 0.025], [0, -0.215]));

const portholes = union(
  circle(0.022, [-0.32, -0.27]),
  circle(0.022, [-0.11, -0.27]),
  circle(0.022, [ 0.11, -0.27]),
  circle(0.022, [ 0.32, -0.27]),
);

const mast = rectangle([0.025, 1.05], [0, 0.38]);

const yardLow = rectangle([0.78, 0.025], [0, 0.05]);
const yardMid = rectangle([0.72, 0.025], [0, 0.45]);
const yardTop = rectangle([0.55, 0.022], [0, 0.75]);
const yards   = union(yardLow, yardMid, yardTop);

const mainSail = rounded_rectangle([0.66, 0.40], 0.04, [0, 0.25]);
const topSail  = rounded_rectangle([0.49, 0.30], 0.04, [0, 0.60]);
const sails    = union(mainSail, topSail);

const flag = triangle(
  [0.013, 0.96],
  [0.013, 0.88],
  [0.20,  0.92],
);

const SKY_TOP    = [255, 195, 155];
const SKY_BOTTOM = [255, 232, 198];
const SUN_C      = [255, 215, 145];
const SEA_C      = [55, 95, 130];
const FOAM_C     = [128, 170, 198];
const HULL_C     = [98, 60, 32];
const TRIM_C     = [205, 162, 90];
const TRIM_D     = [55, 38, 24];
const PORT_C     = [50, 32, 20];
const MAST_C     = [72, 46, 28];
const SAIL_C     = [242, 226, 196];
const FLAG_C     = [190, 50, 50];
const OUTLINE    = [30, 22, 18];

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: sun,  color: SUN_C },

      { sdf: sea,  color: SEA_C },
      { sdf: foam, color: FOAM_C },

      { sdf: dilate(hull, 0.025), color: OUTLINE },
      { sdf: hull,                color: HULL_C },
      { sdf: trimGold,            color: TRIM_C },
      { sdf: trimDark,            color: TRIM_D },
      { sdf: portholes,           color: PORT_C },

      { sdf: dilate(mast, 0.015), color: OUTLINE },
      { sdf: mast,                color: MAST_C },

      { sdf: dilate(sails, 0.022), color: OUTLINE },
      { sdf: sails,                color: SAIL_C },

      { sdf: dilate(yards, 0.010), color: OUTLINE },
      { sdf: yards,                color: MAST_C },

      { sdf: dilate(flag, 0.010), color: OUTLINE },
      { sdf: flag,                color: FLAG_C },
    ],
    {
      view: 1.2,
      background: { top: SKY_TOP, bottom: SKY_BOTTOM },
    },
  );
}

export function getSdfs() {
  return [sun, sea, foam, hull, trimGold, trimDark, portholes, mast, sails, yards, flag];
}

const _canvas = typeof document !== 'undefined' && document.getElementById('c');
if (_canvas) scene(_canvas.getContext('2d'));
