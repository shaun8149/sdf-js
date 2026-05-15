// LLM × SDF round 2 #3 —— "画一座哥特式教堂的正立面"
// 改良 SKILL.md prompt 跑出的输出。对比 test-cathedral.js (v1) 巨大跃迁：
// - v2 抽出 lancet() 参数化函数，9 个 portal/window 共享同一个 builder
// - v2 rose tracery 用 .circular_array(8) 生成 8 重 lobes（v1 只有 4 spokes）
// - v2 stringcourses 用 intersection 切到 stone 内（v1 用裸 rectangle）
// - v2 outline 7 处全用 + 厚度分级
// - v2 增加 "belfry" 专业词汇
// =============================================================================

import {
  render,
  circle,
  rectangle,
  polygon,
  union,
  intersection,
  dilate,
} from '../../src/index.js';

function lancet(cx, baseY, w, h, pointiness = 0.45) {
  const hw = w / 2;
  const rectH = h * (1 - pointiness);
  const triH  = h * pointiness;
  return union(
    rectangle([w, rectH], [cx, baseY + rectH / 2]),
    polygon([
      [cx - hw, baseY + rectH],
      [cx + hw, baseY + rectH],
      [cx,      baseY + rectH + triH],
    ]),
  );
}

const leftTower  = rectangle([0.55, 1.55], [-0.70, 0.025]);
const rightTower = rectangle([0.55, 1.55], [ 0.70, 0.025]);
const centerWall = rectangle([0.85, 1.10], [0, -0.20]);

const centerGable = polygon([
  [-0.425, 0.35],
  [ 0.425, 0.35],
  [ 0,     0.68],
]);

const leftSpire  = polygon([[-0.975, 0.80], [-0.425, 0.80], [-0.70, 1.12]]);
const rightSpire = polygon([[ 0.425, 0.80], [ 0.975, 0.80], [ 0.70, 1.12]]);

const stone = union(
  leftTower, rightTower, centerWall, centerGable, leftSpire, rightSpire,
);

const stringcourses = intersection(
  union(
    rectangle([2.5, 0.025], [0, -0.22]),
    rectangle([2.5, 0.025], [0,  0.32]),
  ),
  stone,
);

const portals = union(
  lancet(    0, -0.75, 0.28, 0.52),
  lancet(-0.70, -0.75, 0.20, 0.38),
  lancet( 0.70, -0.75, 0.20, 0.38),
);

const roseR      = 0.20;
const roseCenter = [0, 0.07];
const roseOuter  = circle(roseR, roseCenter);

const traceLobes = circle(0.038, [0.11, 0]).circular_array(8).translate(roseCenter);
const traceHub   = circle(0.040, roseCenter);

const towerWinLow = union(
  lancet(-0.70, -0.10, 0.22, 0.36),
  lancet( 0.70, -0.10, 0.22, 0.36),
);
const towerWinUp = union(
  lancet(-0.80, 0.40, 0.11, 0.28),
  lancet(-0.60, 0.40, 0.11, 0.28),
  lancet( 0.60, 0.40, 0.11, 0.28),
  lancet( 0.80, 0.40, 0.11, 0.28),
);
const allWindows = union(towerWinLow, towerWinUp);

const leftCross = union(
  rectangle([0.022, 0.10], [-0.70, 1.17]),
  rectangle([0.06,  0.020], [-0.70, 1.18]),
);
const rightCross = union(
  rectangle([0.022, 0.10], [0.70, 1.17]),
  rectangle([0.06,  0.020], [0.70, 1.18]),
);
const crosses = union(leftCross, rightCross);

const moon = circle(0.10, [0.32, 0.95]);

const ground = rectangle([3.0, 0.4], [0, -0.95]);

const SKY_TOP    = [36,  42,  82];
const SKY_BOTTOM = [200, 148, 132];
const MOON_C     = [248, 232, 198];
const STONE_C    = [220, 206, 178];
const STONE_DK   = [152, 134, 108];
const WINDOW_C   = [38,  46,  82];
const ROSE_HUB_C = [180, 75,  55];
const DOOR_C     = [55,  35,  22];
const CROSS_C    = [62,  46,  32];
const GROUND_C   = [78,  68,  82];
const OUTLINE    = [28,  22,  20];

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: moon, color: MOON_C },

      { sdf: dilate(ground, 0.022), color: OUTLINE },
      { sdf: ground,                color: GROUND_C },

      { sdf: dilate(stone, 0.028), color: OUTLINE },
      { sdf: stone,                color: STONE_C },

      { sdf: stringcourses, color: STONE_DK },

      { sdf: dilate(allWindows, 0.014), color: OUTLINE },
      { sdf: allWindows,                color: WINDOW_C },

      { sdf: dilate(roseOuter, 0.022), color: OUTLINE },
      { sdf: roseOuter,                color: WINDOW_C },
      { sdf: traceLobes,               color: STONE_C },
      { sdf: traceHub,                 color: ROSE_HUB_C },

      { sdf: dilate(portals, 0.020), color: OUTLINE },
      { sdf: portals,                color: DOOR_C },

      { sdf: dilate(crosses, 0.010), color: OUTLINE },
      { sdf: crosses,                color: CROSS_C },
    ],
    {
      view: 1.2,
      background: { top: SKY_TOP, bottom: SKY_BOTTOM },
    },
  );
}

export function getSdfs() {
  return [moon, ground, stone, stringcourses, allWindows, roseOuter, traceLobes, traceHub, portals, crosses];
}

const _canvas = typeof document !== 'undefined' && document.getElementById('c');
if (_canvas) scene(_canvas.getContext('2d'));
