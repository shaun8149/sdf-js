// LLM × SDF test #3 —— "画一座哥特式教堂的正立面"
// LLM 原始输出。bugs：roseRing 应该是 difference 而非 union（已 dead），
// portalArchInner 定义但未在 layers 里引用。保留原样观察。
// =============================================================================

import {
  render,
  circle,
  rectangle,
  triangle,
  union,
} from '../../src/index.js';

const ground = rectangle([2.4, 0.3], [0, -1.1]);

const centralBody = rectangle([0.9, 1.4], [0, -0.25]);
const leftTower = rectangle([0.36, 1.6], [-0.55, -0.15]);
const rightTower = rectangle([0.36, 1.6], [0.55, -0.15]);

const leftSpire = triangle([-0.74, 0.65], [-0.36, 0.65], [-0.55, 1.0]);
const rightSpire = triangle([0.36, 0.65], [0.74, 0.65], [0.55, 1.0]);
const centralGable = triangle([-0.45, 0.45], [0.45, 0.45], [0, 0.78]);

const structure = union(
  centralBody, leftTower, rightTower,
  leftSpire, rightSpire, centralGable,
);

const stringCourse = rectangle([1.8, 0.025], [0, -0.55]);
const upperCourse = rectangle([1.8, 0.02], [0, 0.4]);

const roseWindow = circle(0.17, [0, 0.12]);

const portal = union(
  rectangle([0.26, 0.55], [0, -0.575]),
  triangle([-0.13, -0.3], [0.13, -0.3], [0, -0.12]),
);

const leftTowerWindow = union(
  rectangle([0.14, 0.34], [-0.55, 0.02]),
  triangle([-0.62, 0.19], [-0.48, 0.19], [-0.55, 0.32]),
);
const rightTowerWindow = union(
  rectangle([0.14, 0.34], [0.55, 0.02]),
  triangle([0.48, 0.19], [0.62, 0.19], [0.55, 0.32]),
);

const leftLancet = union(
  rectangle([0.08, 0.28], [-0.3, -0.2]),
  triangle([-0.34, -0.06], [-0.26, -0.06], [-0.3, 0.02]),
);
const rightLancet = union(
  rectangle([0.08, 0.28], [0.3, -0.2]),
  triangle([0.26, -0.06], [0.34, -0.06], [0.3, 0.02]),
);

const leftTowerSmall = union(
  rectangle([0.08, 0.16], [-0.55, -0.55]),
  triangle([-0.59, -0.47], [-0.51, -0.47], [-0.55, -0.4]),
);
const rightTowerSmall = union(
  rectangle([0.08, 0.16], [0.55, -0.55]),
  triangle([0.59, -0.47], [0.51, -0.47], [0.55, -0.4]),
);

const allWindows = union(
  roseWindow, portal,
  leftTowerWindow, rightTowerWindow,
  leftLancet, rightLancet,
  leftTowerSmall, rightTowerSmall,
);

const roseCenter = circle(0.035, [0, 0.12]);
const roseSpoke1 = rectangle([0.34, 0.014], [0, 0.12]);
const roseSpoke2 = rectangle([0.014, 0.34], [0, 0.12]);
const roseSpoke3 = rectangle([0.34, 0.014]).rotate(Math.PI / 4).translate([0, 0.12]);
const roseSpoke4 = rectangle([0.34, 0.014]).rotate(-Math.PI / 4).translate([0, 0.12]);
const roseInnerRing = circle(0.11, [0, 0.12]);
const roseInnerRing2 = circle(0.095, [0, 0.12]);
const roseRing = union(roseInnerRing, roseInnerRing2);
const roseTracery = union(roseCenter, roseSpoke1, roseSpoke2, roseSpoke3, roseSpoke4);

const portalMullion = rectangle([0.016, 0.7], [0, -0.5]);
const portalArchInner = circle(0.06, [0, -0.18]);

const leftCross = union(
  rectangle([0.018, 0.13], [-0.55, 1.07]),
  rectangle([0.06, 0.018], [-0.55, 1.06]),
);
const rightCross = union(
  rectangle([0.018, 0.13], [0.55, 1.07]),
  rectangle([0.06, 0.018], [0.55, 1.06]),
);

const moon = circle(0.12, [-0.85, 0.85]);

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: moon, color: [245, 230, 200] },
      { sdf: ground, color: [55, 50, 60] },
      { sdf: structure, color: [215, 200, 175] },
      { sdf: stringCourse, color: [175, 160, 135] },
      { sdf: upperCourse, color: [175, 160, 135] },
      { sdf: allWindows, color: [35, 30, 55] },
      { sdf: roseTracery, color: [215, 200, 175] },
      { sdf: portalMullion, color: [215, 200, 175] },
      { sdf: leftCross, color: [80, 70, 60] },
      { sdf: rightCross, color: [80, 70, 60] },
    ],
    {
      view: 1.2,
      background: { top: [50, 40, 80], bottom: [220, 150, 130] },
    },
  );
}

const canvas = document.getElementById('c');
scene(canvas.getContext('2d'));
