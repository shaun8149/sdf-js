// LLM × SDF test #7 —— "画 Seurat《Les Poseuses》里中间那个女人体侧立的姿势"
// LLM 抓住了几个 specific historical signal：
//   - 背景墙上挂《La Grande Jatte》（Les Poseuses 真实构图细节）
//   - 中间模特特征：发髻 (hairBun)、面朝右侧立
//   - 30+ 部件 anatomical decomposition
// 没尝试 pointillism（sdf-js silhouette renderer 不支持，未承认限制）。
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  triangle,
  union,
} from '../../src/index.js';

const floor = rectangle([2.5, 0.4], [0, -1.05]);

const paintingFrame = rounded_rectangle([0.48, 0.3], 0.01, [-0.65, 0.55]);
const paintingInner = rounded_rectangle([0.44, 0.26], 0.005, [-0.65, 0.55]);
const paintingTopGrass = rectangle([0.44, 0.05], [-0.65, 0.62]);
const paintingDot1 = circle(0.025, [-0.78, 0.5]);
const paintingDot2 = circle(0.022, [-0.58, 0.5]);
const paintingDot3 = circle(0.018, [-0.68, 0.46]);

const cranium = circle(0.1, [0, 0.62]);
const noseProfile = triangle([0.06, 0.62], [0.16, 0.58], [0.06, 0.54]);
const lipBump = circle(0.018, [0.07, 0.51]);
const chinBump = circle(0.03, [0.04, 0.49]);

const head = union(cranium, noseProfile, lipBump, chinBump, { k: 0.018 });

const hairMass = circle(0.105, [-0.025, 0.64]);
const hairBun = circle(0.075, [-0.08, 0.76]);
const hairBack = circle(0.045, [-0.08, 0.55]);
const hair = union(hairMass, hairBun, hairBack, { k: 0.025 });

const neck = rectangle([0.07, 0.1], [-0.005, 0.42]);

const shoulderLine = rounded_rectangle([0.22, 0.06], 0.025, [-0.01, 0.36]);
const upperBack = circle(0.07, [-0.09, 0.33]);
const breast = circle(0.07, [0.09, 0.28]);
const upperTorso = rounded_rectangle([0.17, 0.3], 0.07, [0.0, 0.22]);

const ribcage = circle(0.09, [0.04, 0.14]);

const waist = rounded_rectangle([0.13, 0.18], 0.05, [-0.005, 0.02]);

const hipMass = rounded_rectangle([0.21, 0.22], 0.08, [-0.02, -0.2]);
const buttocks = circle(0.11, [-0.11, -0.18]);
const frontHip = circle(0.06, [0.08, -0.13]);
const pelvisBottom = circle(0.08, [-0.02, -0.3]);

const thigh = rounded_rectangle([0.15, 0.32], 0.07, [-0.01, -0.47]);
const thighBack = circle(0.07, [-0.06, -0.4]);

const knee = circle(0.07, [0, -0.66]);

const calf = rounded_rectangle([0.12, 0.22], 0.055, [0.01, -0.8]);
const calfBack = circle(0.05, [-0.04, -0.78]);

const ankle = circle(0.045, [0.015, -0.92]);
const foot = rounded_rectangle([0.16, 0.05], 0.025, [0.08, -0.96]);
const heel = circle(0.035, [-0.02, -0.95]);

const upperArm = rounded_rectangle([0.07, 0.22], 0.035, [0.085, 0.18]);
const elbow = circle(0.04, [0.105, 0.05]);
const forearm = rounded_rectangle([0.062, 0.22], 0.031, [0.115, -0.07]);
const wrist = circle(0.034, [0.12, -0.19]);
const hand = rounded_rectangle([0.07, 0.06], 0.025, [0.12, -0.235]);

const farShoulder = circle(0.07, [-0.04, 0.34]);
const farArmHint = rounded_rectangle([0.055, 0.18], 0.025, [-0.075, 0.2]);

const body = union(
  neck,
  shoulderLine, upperBack, breast, upperTorso, ribcage,
  waist,
  hipMass, buttocks, frontHip, pelvisBottom,
  thigh, thighBack,
  knee,
  calf, calfBack,
  ankle, foot, heel,
  upperArm, elbow, forearm, wrist, hand,
  farShoulder, farArmHint,
  head,
  { k: 0.022 },
);

const shadow = circle(0.22).scale([1.5, 0.13]).translate([0.05, -0.99]);

const wallStripe1 = rectangle([2.5, 0.005], [0, 0.85]);
const wallStripe2 = rectangle([2.5, 0.005], [0, 0.35]);
const wallStripes = union(wallStripe1, wallStripe2);

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: floor, color: [175, 140, 105] },
      { sdf: wallStripes, color: [165, 150, 130] },
      { sdf: paintingFrame, color: [120, 90, 65] },
      { sdf: paintingInner, color: [155, 175, 140] },
      { sdf: paintingTopGrass, color: [130, 155, 110] },
      { sdf: paintingDot1, color: [200, 175, 120] },
      { sdf: paintingDot2, color: [195, 170, 115] },
      { sdf: paintingDot3, color: [180, 155, 100] },
      { sdf: shadow, color: [125, 95, 75] },
      { sdf: body, color: [228, 195, 168] },
      { sdf: hair, color: [85, 55, 45] },
    ],
    {
      view: 1.2,
      background: { top: [200, 185, 165], bottom: [188, 170, 145] },
    },
  );
}

const canvas = document.getElementById('c');
scene(canvas.getContext('2d'));
