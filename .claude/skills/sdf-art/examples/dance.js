// LLM × SDF test #6 —— "Matisse 风格的舞者剪影，一群人手牵手围成圆圈跳舞"
// LLM 直接识别出 Matisse《La Danse》(1909) 并复刻色板 + 构图。
// 5-dancer 参数化 + arms chain via atan2 几何计算。无 bug。
// 微瑕：腿旋转支点是腿中心而非髋关节（被 smooth union 抹平）；dancer 上半身
// 直立不倾斜（La Danse 原作里是整体扭动的）。
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  union,
} from '../../src/index.js';

const earth = circle(1.5, [0, -1.4]);

const dancerPositions = [
  { x: 0.0, y: 0.05 },
  { x: -0.6, y: -0.05 },
  { x: -0.42, y: -0.5 },
  { x: 0.42, y: -0.5 },
  { x: 0.6, y: -0.05 },
];

const legAngles = [
  [0.2, -0.2],
  [0.4, -0.05],
  [-0.15, 0.35],
  [0.1, -0.35],
  [-0.4, 0.05],
];

function dancerBody(d, lAng, rAng) {
  const head = circle(0.075, [0, 0.36]);
  const neck = rectangle([0.05, 0.05], [0, 0.27]);
  const torso = rounded_rectangle([0.14, 0.36], 0.07, [0, 0.08]);
  const leftLeg = rounded_rectangle([0.08, 0.36], 0.035)
    .rotate(lAng)
    .translate([-0.04, -0.24]);
  const rightLeg = rounded_rectangle([0.08, 0.36], 0.035)
    .rotate(rAng)
    .translate([0.04, -0.24]);
  return union(head, neck, torso, leftLeg, rightLeg, { k: 0.05 })
    .translate([d.x, d.y]);
}

function armChain(d1, d2) {
  const p1 = [d1.x, d1.y + 0.22];
  const p2 = [d2.x, d2.y + 0.22];
  const cx = (p1[0] + p2[0]) / 2;
  const cy = (p1[1] + p2[1]) / 2;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  return rounded_rectangle([len, 0.08], 0.04).rotate(angle).translate([cx, cy]);
}

const dancers = union(
  dancerBody(dancerPositions[0], legAngles[0][0], legAngles[0][1]),
  dancerBody(dancerPositions[1], legAngles[1][0], legAngles[1][1]),
  dancerBody(dancerPositions[2], legAngles[2][0], legAngles[2][1]),
  dancerBody(dancerPositions[3], legAngles[3][0], legAngles[3][1]),
  dancerBody(dancerPositions[4], legAngles[4][0], legAngles[4][1]),
);

const arms = union(
  armChain(dancerPositions[0], dancerPositions[1]),
  armChain(dancerPositions[1], dancerPositions[2]),
  armChain(dancerPositions[2], dancerPositions[3]),
  armChain(dancerPositions[3], dancerPositions[4]),
  armChain(dancerPositions[4], dancerPositions[0]),
);

const figures = union(dancers, arms, { k: 0.06 });

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: earth, color: [95, 150, 80] },
      { sdf: figures, color: [205, 105, 75] },
    ],
    {
      view: 1.2,
      background: { top: [30, 60, 140], bottom: [55, 90, 165] },
    },
  );
}

const canvas = document.getElementById('c');
scene(canvas.getContext('2d'));
