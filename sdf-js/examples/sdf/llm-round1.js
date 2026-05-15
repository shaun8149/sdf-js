// =============================================================================
// llm-round1.js —— LLM × SDF 实验 round 1（minimal-context prompt）的 7 个场景
// -----------------------------------------------------------------------------
// 7 个独立的 Claude 窗口在 sdf-js system prompt（未带 SKILL.md）下生成的输出，
// 原样保留作为 essay 的 "before SKILL.md" 对照。每个 scene 是一个 build* 函数，
// 返回 { layers, options }，由底部 dispatcher 通过 URL hash 选择渲染。
//
// 同时各自 export getSdfs* 给 scenes.js 当 scene 13 (dance) 的 SDF 源用。
//
// 已知 bugs（保留不修，给 essay §5 用）：
//   - boat: trapezoid 签名误用 → hull 不渲染
//   - cathedral: roseRing 死代码（应该是 difference，未用）
//   - hatman: trapezoid 签名 + 半宽 0.6 让躯干像山
//   - seurat: 没尝试 pointillism（renderer 不支持，未承认限制）
// =============================================================================

import {
  render,
  circle,
  rectangle,
  rounded_rectangle,
  triangle,
  trapezoid,
  flower,
  union,
  difference,
  dilate,
} from '../../src/index.js';

// =============================================================================
// #1 tree —— "画一棵简单的树"
// =============================================================================
function buildTree() {
  const trunk = rounded_rectangle([0.12, 0.5], 0.03, [0, -0.25]);
  const crown = union(
    circle(0.32, [0, 0.25]),
    circle(0.22, [-0.25, 0.15]),
    circle(0.22, [0.25, 0.15]),
    circle(0.2, [0, 0.45]),
    { k: 0.08 },
  );
  const ground = rectangle([2.4, 0.1], [0, -0.55]);
  return {
    layers: [
      { sdf: ground, color: [110, 85, 60] },
      { sdf: trunk,  color: [90, 60, 40] },
      { sdf: crown,  color: [70, 130, 70] },
    ],
    options: {
      view: 1.2,
      background: { top: [200, 225, 240], bottom: [240, 230, 200] },
    },
    sdfs: [ground, trunk, crown],
  };
}

// =============================================================================
// #2 boat —— "画一艘古代帆船"
// BUG: trapezoid 签名误用 → hull 不渲染。原样保留。
// =============================================================================
function buildBoat() {
  const sea = rectangle([2.4, 0.7], [0, -0.65]);
  const waves = flower(0.04, 18, 0, 0.05).translate([0, -0.3]).scale([6, 1]);
  const hull = trapezoid([0, 0.32], [0, 0.05], 0.28, 0.6);
  const deckLine = rectangle([1.05, 0.04], [0, -0.1]);
  const hullTrim = rectangle([1.15, 0.02], [0, -0.07]);

  const portholes = circle(0.025).circular_array(1)
    .translate([-0.3, -0.18])
    .union(
      circle(0.025).translate([-0.15, -0.18]),
      circle(0.025).translate([0.0, -0.18]),
      circle(0.025).translate([0.15, -0.18]),
      circle(0.025).translate([0.3, -0.18]),
    );
  const hullSolid = difference(hull, portholes);

  const mast = rectangle([0.025, 1.0], [0, 0.4]);
  const yards = union(
    rectangle([0.55, 0.022], [0, 0.78]),
    rectangle([0.75, 0.022], [0, 0.45]),
    rectangle([0.75, 0.022], [0, 0.05]),
  );
  const sails = union(
    rounded_rectangle([0.5, 0.28], 0.04, [0, 0.63]),
    rounded_rectangle([0.7, 0.36], 0.05, [0, 0.25]),
  );
  const flagPole = rectangle([0.018, 0.18], [0, 0.93]);
  const flag = triangle([0.009, 1.0], [0.18, 0.95], [0.009, 0.9]);
  const sun = circle(0.18, [0.7, 0.7]);

  return {
    layers: [
      { sdf: sun,       color: [255, 210, 140] },
      { sdf: sea,       color: [60, 95, 130] },
      { sdf: waves,     color: [90, 130, 165] },
      { sdf: hullSolid, color: [95, 60, 40] },
      { sdf: hullTrim,  color: [200, 160, 80] },
      { sdf: deckLine,  color: [60, 40, 25] },
      { sdf: mast,      color: [70, 45, 30] },
      { sdf: sails,     color: [240, 225, 195] },
      { sdf: yards,     color: [70, 45, 30] },
      { sdf: flagPole,  color: [70, 45, 30] },
      { sdf: flag,      color: [180, 50, 50] },
    ],
    options: {
      view: 1.2,
      background: { top: [255, 200, 160], bottom: [255, 230, 200] },
    },
    sdfs: [sun, sea, waves, hullSolid, hullTrim, deckLine, mast, sails, yards, flagPole, flag],
  };
}

// =============================================================================
// #3 cathedral —— "画一座哥特式教堂的正立面"
// BUGs: roseRing 死代码 (define-and-forget)；portalArchInner 也未引用。
// =============================================================================
function buildCathedral() {
  const ground = rectangle([2.4, 0.3], [0, -1.1]);
  const structure = union(
    rectangle([0.9, 1.4], [0, -0.25]),                        // centralBody
    rectangle([0.36, 1.6], [-0.55, -0.15]),                   // leftTower
    rectangle([0.36, 1.6], [0.55, -0.15]),                    // rightTower
    triangle([-0.74, 0.65], [-0.36, 0.65], [-0.55, 1.0]),     // leftSpire
    triangle([0.36, 0.65], [0.74, 0.65], [0.55, 1.0]),        // rightSpire
    triangle([-0.45, 0.45], [0.45, 0.45], [0, 0.78]),         // centralGable
  );
  const stringCourse = rectangle([1.8, 0.025], [0, -0.55]);
  const upperCourse  = rectangle([1.8, 0.02],  [0,  0.4]);

  const roseWindow = circle(0.17, [0, 0.12]);
  const portal = union(
    rectangle([0.26, 0.55], [0, -0.575]),
    triangle([-0.13, -0.3], [0.13, -0.3], [0, -0.12]),
  );
  const leftTowerWindow  = union(rectangle([0.14, 0.34], [-0.55, 0.02]), triangle([-0.62, 0.19], [-0.48, 0.19], [-0.55, 0.32]));
  const rightTowerWindow = union(rectangle([0.14, 0.34], [ 0.55, 0.02]), triangle([ 0.48, 0.19], [ 0.62, 0.19], [ 0.55, 0.32]));
  const leftLancet  = union(rectangle([0.08, 0.28], [-0.3, -0.2]), triangle([-0.34, -0.06], [-0.26, -0.06], [-0.3, 0.02]));
  const rightLancet = union(rectangle([0.08, 0.28], [ 0.3, -0.2]), triangle([ 0.26, -0.06], [ 0.34, -0.06], [ 0.3, 0.02]));
  const leftTowerSmall  = union(rectangle([0.08, 0.16], [-0.55, -0.55]), triangle([-0.59, -0.47], [-0.51, -0.47], [-0.55, -0.4]));
  const rightTowerSmall = union(rectangle([0.08, 0.16], [ 0.55, -0.55]), triangle([ 0.59, -0.47], [ 0.51, -0.47], [ 0.55, -0.4]));

  const allWindows = union(
    roseWindow, portal,
    leftTowerWindow, rightTowerWindow,
    leftLancet, rightLancet,
    leftTowerSmall, rightTowerSmall,
  );

  const roseTracery = union(
    circle(0.035, [0, 0.12]),                                                     // center
    rectangle([0.34, 0.014], [0, 0.12]),                                          // spoke H
    rectangle([0.014, 0.34], [0, 0.12]),                                          // spoke V
    rectangle([0.34, 0.014]).rotate(Math.PI / 4).translate([0, 0.12]),
    rectangle([0.34, 0.014]).rotate(-Math.PI / 4).translate([0, 0.12]),
  );
  const portalMullion = rectangle([0.016, 0.7], [0, -0.5]);
  const leftCross  = union(rectangle([0.018, 0.13], [-0.55, 1.07]), rectangle([0.06, 0.018], [-0.55, 1.06]));
  const rightCross = union(rectangle([0.018, 0.13], [ 0.55, 1.07]), rectangle([0.06, 0.018], [ 0.55, 1.06]));
  const moon = circle(0.12, [-0.85, 0.85]);

  return {
    layers: [
      { sdf: moon,          color: [245, 230, 200] },
      { sdf: ground,        color: [55, 50, 60] },
      { sdf: structure,     color: [215, 200, 175] },
      { sdf: stringCourse,  color: [175, 160, 135] },
      { sdf: upperCourse,   color: [175, 160, 135] },
      { sdf: allWindows,    color: [35, 30, 55] },
      { sdf: roseTracery,   color: [215, 200, 175] },
      { sdf: portalMullion, color: [215, 200, 175] },
      { sdf: leftCross,     color: [80, 70, 60] },
      { sdf: rightCross,    color: [80, 70, 60] },
    ],
    options: {
      view: 1.2,
      background: { top: [50, 40, 80], bottom: [220, 150, 130] },
    },
    sdfs: [moon, ground, structure, stringCourse, upperCourse, allWindows, roseTracery, portalMullion, leftCross, rightCross],
  };
}

// =============================================================================
// #4 butterfly —— "画一只蝴蝶展翅"
// 无 bug。LLM 自创 dilate-as-outline idiom，三角函数算 antenna tip。
// =============================================================================
function buildButterfly() {
  const wings = union(
    circle(0.26).scale([1.15, 0.85]).rotate( 0.45).translate([-0.4,  0.15]),
    circle(0.26).scale([1.15, 0.85]).rotate(-0.45).translate([ 0.4,  0.15]),
    circle(0.2 ).scale([1.0,  1.1 ]).rotate(-0.3 ).translate([-0.3, -0.3]),
    circle(0.2 ).scale([1.0,  1.1 ]).rotate( 0.3 ).translate([ 0.3, -0.3]),
  );
  const wingsBorder = dilate(wings, 0.028);

  const bands = union(
    circle(0.06).scale([1.9, 0.55]).rotate( 0.45).translate([-0.55,  0.08]),
    circle(0.06).scale([1.9, 0.55]).rotate(-0.45).translate([ 0.55,  0.08]),
    circle(0.05).scale([1.6, 0.5 ]).rotate(-0.3 ).translate([-0.4,  -0.42]),
    circle(0.05).scale([1.6, 0.5 ]).rotate( 0.3 ).translate([ 0.4,  -0.42]),
  );
  const veins = union(
    rectangle([0.005, 0.32]).rotate( 0.45).translate([-0.4,   0.18]),
    rectangle([0.005, 0.32]).rotate(-0.45).translate([ 0.4,   0.18]),
    rectangle([0.005, 0.22]).rotate(-0.3 ).translate([-0.3,  -0.3]),
    rectangle([0.005, 0.22]).rotate( 0.3 ).translate([ 0.3,  -0.3]),
  );
  const spots = union(
    circle(0.024, [-0.58,  0.28]), circle(0.022, [-0.48,  0.13]),
    circle(0.022, [-0.42,  0.34]), circle(0.018, [-0.66,  0.16]),
    circle(0.024, [ 0.58,  0.28]), circle(0.022, [ 0.48,  0.13]),
    circle(0.022, [ 0.42,  0.34]), circle(0.018, [ 0.66,  0.16]),
    circle(0.02,  [-0.4,  -0.38]), circle(0.018, [-0.28, -0.44]),
    circle(0.02,  [ 0.4,  -0.38]), circle(0.018, [ 0.28, -0.44]),
  );

  const body = rounded_rectangle([0.055, 0.58], 0.027, [0, -0.04]);
  const head = circle(0.058, [0, 0.3]);
  const bodySegments = union(
    rectangle([0.058, 0.012], [0,  0.08]),
    rectangle([0.058, 0.012], [0, -0.02]),
    rectangle([0.058, 0.012], [0, -0.12]),
    rectangle([0.058, 0.012], [0, -0.22]),
  );
  const antennae = union(
    rectangle([0.008, 0.22]).rotate( 0.4).translate([-0.082, 0.45]),
    rectangle([0.008, 0.22]).rotate(-0.4).translate([ 0.082, 0.45]),
    circle(0.024, [-0.125, 0.555]),
    circle(0.024, [ 0.125, 0.555]),
  );
  const eyeL = circle(0.012, [-0.025, 0.31]);
  const eyeR = circle(0.012, [ 0.025, 0.31]);

  return {
    layers: [
      { sdf: wingsBorder,  color: [25, 20, 30] },
      { sdf: wings,        color: [235, 130, 50] },
      { sdf: bands,        color: [25, 20, 30] },
      { sdf: veins,        color: [60, 35, 25] },
      { sdf: spots,        color: [250, 240, 220] },
      { sdf: body,         color: [30, 25, 35] },
      { sdf: bodySegments, color: [70, 55, 60] },
      { sdf: head,         color: [30, 25, 35] },
      { sdf: eyeL,         color: [240, 230, 210] },
      { sdf: eyeR,         color: [240, 230, 210] },
      { sdf: antennae,     color: [30, 25, 35] },
    ],
    options: {
      view: 1.2,
      background: { top: [195, 225, 240], bottom: [250, 230, 215] },
    },
    sdfs: [wings, bands, veins, spots, body, bodySegments, head, eyeL, eyeR, antennae],
  };
}

// =============================================================================
// #5 hatman —— "画一个戴礼帽的男人侧影"
// BUG: trapezoid 签名 + 半宽 0.6 → 躯干像山。本次合并保持原 broken state（archival）。
// =============================================================================
function buildHatman() {
  const sunGlow = circle(0.32, [0.55, 0.0]);
  const sun = circle(0.17, [0.55, 0.0]);

  const farHillL = circle(0.4).scale([2.4, 0.55]).translate([-0.5, -0.7]);
  const farHillR = circle(0.4).scale([2.6, 0.5 ]).translate([ 0.6, -0.75]);
  const farHills = union(farHillL, farHillR, { k: 0.08 });
  const midHill = circle(0.35).scale([3.0, 0.7]).translate([-0.1, -0.95]);
  const ground = rectangle([2.6, 0.4], [0, -1.1]);
  const foreground = union(midHill, ground, { k: 0.05 });

  const cranium = circle(0.17, [-0.02, 0.2]);
  const nose    = triangle([0.1, 0.16], [0.27, 0.1], [0.1, 0.04]);
  const lipBump = circle(0.025, [0.12, -0.01]);
  const chin    = circle(0.065, [0.07, -0.08]);
  const head = union(cranium, nose, lipBump, chin, { k: 0.025 });

  const neck = rectangle([0.13, 0.2], [-0.01, -0.24]);
  // FIX: trapezoid 仍然 broken；保留 LLM 原意但实际只画出一个奇怪形状
  const torso = trapezoid([0, 1.0], [0, 0.3], 0.6, 0.3);

  const collarL = circle(0.06, [-0.18, -0.34]);
  const collarR = circle(0.06, [ 0.16, -0.34]);
  const collar = union(collarL, collarR);

  const body = union(head, neck, torso, { k: 0.03 });

  const hatBrim  = rectangle([0.46, 0.035], [-0.02, 0.33]);
  const hatCrown = rectangle([0.27, 0.34 ], [-0.02, 0.52]);
  const hatBand  = rectangle([0.27, 0.045], [-0.02, 0.365]);
  const hat = union(hatBrim, hatCrown);

  const birds = union(
    circle(0.008, [-0.5,  0.6]),
    circle(0.008, [-0.35, 0.7]),
    circle(0.008, [-0.65, 0.55]),
  );

  return {
    layers: [
      { sdf: sunGlow,    color: [255, 200, 140] },
      { sdf: sun,        color: [255, 235, 190] },
      { sdf: farHills,   color: [110, 70, 100] },
      { sdf: foreground, color: [40, 25, 50] },
      { sdf: birds,      color: [30, 20, 40] },
      { sdf: body,       color: [12, 10, 22] },
      { sdf: collar,     color: [12, 10, 22] },
      { sdf: hat,        color: [8, 6, 16] },
      { sdf: hatBand,    color: [70, 45, 55] },
    ],
    options: {
      view: 1.2,
      background: { top: [45, 35, 90], bottom: [245, 165, 110] },
    },
    sdfs: [sunGlow, sun, farHills, foreground, birds, body, collar, hat, hatBand],
  };
}

// =============================================================================
// #6 dance —— "Matisse 风格的舞者剪影"
// 无 bug。LLM 识别出《La Danse》(1909) 并复刻色板 + 5-dancer 参数化构图。
// SDFs 同时被 scenes.js scene 13 import（getSdfsDance）。
// =============================================================================
function buildDance() {
  const earth = circle(1.5, [0, -1.4]);

  const dancerPositions = [
    { x: 0.0,   y:  0.05 },
    { x: -0.6,  y: -0.05 },
    { x: -0.42, y: -0.5 },
    { x: 0.42,  y: -0.5 },
    { x: 0.6,   y: -0.05 },
  ];
  const legAngles = [
    [0.2, -0.2],
    [0.4, -0.05],
    [-0.15, 0.35],
    [0.1, -0.35],
    [-0.4, 0.05],
  ];

  function dancerBody(d, lAng, rAng) {
    const head    = circle(0.075, [0, 0.36]);
    const neck    = rectangle([0.05, 0.05], [0, 0.27]);
    const torso   = rounded_rectangle([0.14, 0.36], 0.07, [0, 0.08]);
    const leftLeg  = rounded_rectangle([0.08, 0.36], 0.035).rotate(lAng).translate([-0.04, -0.24]);
    const rightLeg = rounded_rectangle([0.08, 0.36], 0.035).rotate(rAng).translate([ 0.04, -0.24]);
    return union(head, neck, torso, leftLeg, rightLeg, { k: 0.05 }).translate([d.x, d.y]);
  }
  function armChain(d1, d2) {
    const p1 = [d1.x, d1.y + 0.22];
    const p2 = [d2.x, d2.y + 0.22];
    const cx = (p1[0] + p2[0]) / 2;
    const cy = (p1[1] + p2[1]) / 2;
    const len = Math.sqrt((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2);
    const angle = Math.atan2(p2[1]-p1[1], p2[0]-p1[0]);
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

  return {
    layers: [
      { sdf: earth,   color: [95, 150, 80] },
      { sdf: figures, color: [205, 105, 75] },
    ],
    options: {
      view: 1.2,
      background: { top: [30, 60, 140], bottom: [55, 90, 165] },
    },
    sdfs: [earth, figures],
  };
}

// =============================================================================
// #7 seurat —— "画 Seurat《Les Poseuses》里中间那个女人体侧立的姿势"
// 没尝试 pointillism（silhouette renderer 不支持，未承认限制）。
// 30+ anatomical decomposition。挂《La Grande Jatte》在墙上是 Les Poseuses 的真实细节。
// =============================================================================
function buildSeurat() {
  const floor = rectangle([2.5, 0.4], [0, -1.05]);
  const paintingFrame    = rounded_rectangle([0.48, 0.3], 0.01, [-0.65, 0.55]);
  const paintingInner    = rounded_rectangle([0.44, 0.26], 0.005, [-0.65, 0.55]);
  const paintingTopGrass = rectangle([0.44, 0.05], [-0.65, 0.62]);
  const paintingDot1 = circle(0.025, [-0.78, 0.5]);
  const paintingDot2 = circle(0.022, [-0.58, 0.5]);
  const paintingDot3 = circle(0.018, [-0.68, 0.46]);

  const cranium = circle(0.1, [0, 0.62]);
  const noseProfile = triangle([0.06, 0.62], [0.16, 0.58], [0.06, 0.54]);
  const lipBump = circle(0.018, [0.07, 0.51]);
  const chinBump = circle(0.03, [0.04, 0.49]);
  const head = union(cranium, noseProfile, lipBump, chinBump, { k: 0.018 });

  const hair = union(
    circle(0.105, [-0.025, 0.64]),
    circle(0.075, [-0.08, 0.76]),
    circle(0.045, [-0.08, 0.55]),
    { k: 0.025 },
  );

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
    neck, shoulderLine, upperBack, breast, upperTorso, ribcage, waist,
    hipMass, buttocks, frontHip, pelvisBottom,
    thigh, thighBack, knee, calf, calfBack, ankle, foot, heel,
    upperArm, elbow, forearm, wrist, hand,
    farShoulder, farArmHint, head,
    { k: 0.022 },
  );

  const shadow = circle(0.22).scale([1.5, 0.13]).translate([0.05, -0.99]);
  const wallStripes = union(
    rectangle([2.5, 0.005], [0, 0.85]),
    rectangle([2.5, 0.005], [0, 0.35]),
  );

  return {
    layers: [
      { sdf: floor,            color: [175, 140, 105] },
      { sdf: wallStripes,      color: [165, 150, 130] },
      { sdf: paintingFrame,    color: [120, 90, 65] },
      { sdf: paintingInner,    color: [155, 175, 140] },
      { sdf: paintingTopGrass, color: [130, 155, 110] },
      { sdf: paintingDot1,     color: [200, 175, 120] },
      { sdf: paintingDot2,     color: [195, 170, 115] },
      { sdf: paintingDot3,     color: [180, 155, 100] },
      { sdf: shadow,           color: [125, 95, 75] },
      { sdf: body,             color: [228, 195, 168] },
      { sdf: hair,             color: [85, 55, 45] },
    ],
    options: {
      view: 1.2,
      background: { top: [200, 185, 165], bottom: [188, 170, 145] },
    },
    sdfs: [floor, wallStripes, paintingFrame, paintingInner, paintingTopGrass,
           paintingDot1, paintingDot2, paintingDot3, shadow, body, hair],
  };
}

// =============================================================================
// Dispatcher
// =============================================================================
const BUILDERS = {
  tree: buildTree, boat: buildBoat, cathedral: buildCathedral,
  butterfly: buildButterfly, hatman: buildHatman, dance: buildDance, seurat: buildSeurat,
};

// scenes.js 用这个 import dance scene 的 SDFs（scene 13 的源）
export function getDanceSdfs() {
  return buildDance().sdfs;
}

// 浏览器端：URL hash 选 scene，渲染到 #c canvas
const _canvas = typeof document !== 'undefined' && document.getElementById('c');
if (_canvas) {
  const name = (location.hash.slice(1) || 'tree').toLowerCase();
  const builder = BUILDERS[name] || buildTree;
  const cfg = builder();
  render.silhouette(_canvas.getContext('2d'), cfg.layers, cfg.options);

  const stats = document.getElementById('stats');
  if (stats) stats.textContent = `round 1 · ${name} · ${cfg.layers.length} layers`;

  document.querySelectorAll('[data-scene-name]').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = btn.dataset.sceneName;
      location.reload();
    });
  });
}
