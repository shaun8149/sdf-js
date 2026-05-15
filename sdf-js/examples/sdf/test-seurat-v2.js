// LLM × SDF round 2 #7 —— "画 Seurat《Les Poseuses》里中间那个女人体侧立的姿势"
// v2 跟 hatman 完全不同的策略：保留 v1 的 26 部件 smooth-union body
// （nude 需要曲线精度，不能换 polygon），但加了 v2 idiom：
// - figureSilhouette = union(body, hair) 共享连续 outline（同 butterfly 思路）
// - OUTLINE 用 [88, 58, 44] 暖棕色而非近黑 → 像 Seurat 实际炭笔素描的轮廓边缘
// - 11 个 palette 命名常量
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  triangle,
  union,
  dilate,
} from '../../src/index.js';

const floor = rectangle([2.5, 0.4], [0, -1.05]);

const paintingFrame    = rounded_rectangle([0.48, 0.30], 0.010, [-0.65, 0.55]);
const paintingInner    = rounded_rectangle([0.44, 0.26], 0.005, [-0.65, 0.55]);
const paintingTopGrass = rectangle([0.44, 0.05], [-0.65, 0.62]);
const paintingDot1 = circle(0.025, [-0.78, 0.50]);
const paintingDot2 = circle(0.022, [-0.58, 0.50]);
const paintingDot3 = circle(0.018, [-0.68, 0.46]);

const wallStripes = union(
  rectangle([2.5, 0.005], [0, 0.85]),
  rectangle([2.5, 0.005], [0, 0.35]),
);

const cranium     = circle(0.10, [0, 0.62]);
const noseProfile = triangle([0.06, 0.62], [0.16, 0.58], [0.06, 0.54]);
const lipBump     = circle(0.018, [0.07, 0.51]);
const chinBump    = circle(0.030, [0.04, 0.49]);
const head = union(cranium, noseProfile, lipBump, chinBump, { k: 0.018 });

const hair = union(
  circle(0.105, [-0.025, 0.64]),
  circle(0.075, [-0.080, 0.76]),
  circle(0.045, [-0.080, 0.55]),
  { k: 0.025 },
);

const neck = rectangle([0.07, 0.10], [-0.005, 0.42]);

const shoulder   = rounded_rectangle([0.22, 0.06], 0.025, [-0.01, 0.36]);
const upperBack  = circle(0.07, [-0.09, 0.33]);
const breast     = circle(0.075, [ 0.12, 0.27]);
const upperTorso = rounded_rectangle([0.17, 0.30], 0.07, [0, 0.22]);
const waist      = rounded_rectangle([0.13, 0.18], 0.05, [-0.005, 0.02]);

// 髋部拆两段：上窄（腰窝 lumbar 内凹）+ 下宽（盆骨外凸）
// smooth-union 会自动把两段连成女性侧面标志性的 S 曲线
const lumbarRegion = rounded_rectangle([0.14, 0.18], 0.05, [-0.005, -0.09]);
const pelvicShelf  = rounded_rectangle([0.18, 0.20], 0.08, [-0.02, -0.22]);
const buttocks     = circle(0.10, [-0.14, -0.20]);
const pelvisBase   = circle(0.08, [-0.02, -0.30]);

const thigh      = rounded_rectangle([0.15, 0.32], 0.07,  [-0.01, -0.47]);
const knee       = circle(0.07,  [0,     -0.66]);
const calf       = rounded_rectangle([0.12, 0.22], 0.055, [0.01, -0.80]);
const calfBack   = circle(0.05,  [-0.04, -0.78]);
const ankle      = circle(0.045, [0.015, -0.92]);
const foot       = rounded_rectangle([0.16, 0.05], 0.025, [0.08, -0.96]);
const heel       = circle(0.035, [-0.02, -0.95]);

// === 近臂举过头顶：肩→肘外凸→腕→手在发顶之上 ===
const upperArm   = rounded_rectangle([0.07,  0.24], 0.035, [0.09,  0.48]);
const elbow      = circle(0.04,  [0.095, 0.60]);
const forearm    = rounded_rectangle([0.062, 0.22], 0.031, [0.085, 0.72]);
const wrist      = circle(0.034, [0.07,  0.82]);
const hand       = rounded_rectangle([0.06, 0.07], 0.025, [0.05,  0.86]);

// 远臂：肩 + 朝上的细长 hint，大部分被头发遮住，只露出耳下短短一段
const farShoulder = circle(0.07, [-0.04, 0.34]);
const farArm      = rounded_rectangle([0.055, 0.32], 0.025, [-0.03, 0.52]);

const body = union(
  head, neck,
  shoulder, upperBack, breast, upperTorso, waist,
  lumbarRegion, pelvicShelf, buttocks, pelvisBase,
  thigh, knee, calf, calfBack,
  ankle, foot, heel,
  upperArm, elbow, forearm, wrist, hand,
  farShoulder, farArm,
  { k: 0.030 },
);

const figureSilhouette = union(body, hair);

const shadow = circle(0.22).scale([1.5, 0.13]).translate([0.05, -0.99]);

const WALL_TOP    = [202, 188, 168];
const WALL_BOTTOM = [188, 170, 145];
const FLOOR_C     = [175, 140, 105];
const WALL_LINE_C = [165, 150, 130];
const FRAME_C     = [120,  90,  65];
const PAINT_BG    = [155, 175, 140];
const PAINT_GRASS = [130, 155, 110];
const SHADOW_C    = [125,  95,  75];
const SKIN_C      = [228, 195, 168];
const HAIR_C      = [85,   55,  45];
const OUTLINE     = [88,   58,  44];  // 暖棕，不是近黑 —— 像炭笔素描线

export function scene(ctx) {
  render.silhouette(
    ctx,
    [
      { sdf: floor,            color: FLOOR_C },
      { sdf: wallStripes,      color: WALL_LINE_C },

      { sdf: paintingFrame,    color: FRAME_C },
      { sdf: paintingInner,    color: PAINT_BG },
      { sdf: paintingTopGrass, color: PAINT_GRASS },
      { sdf: paintingDot1,     color: [200, 175, 120] },
      { sdf: paintingDot2,     color: [195, 170, 115] },
      { sdf: paintingDot3,     color: [180, 155, 100] },

      { sdf: shadow,           color: SHADOW_C },

      { sdf: dilate(figureSilhouette, 0.014), color: OUTLINE },
      { sdf: body,                            color: SKIN_C },
      { sdf: hair,                            color: HAIR_C },
    ],
    {
      view: 1.2,
      background: { top: WALL_TOP, bottom: WALL_BOTTOM },
    },
  );
}

export function getSdfs() {
  return [
    floor, wallStripes,
    paintingFrame, paintingInner, paintingTopGrass,
    paintingDot1, paintingDot2, paintingDot3,
    shadow, body, hair,
  ];
}

const _canvas = typeof document !== 'undefined' && document.getElementById('c');
if (_canvas) scene(_canvas.getContext('2d'));
