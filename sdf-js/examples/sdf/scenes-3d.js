// =============================================================================
// scenes-3d.js —— BOB 3D 场景（球 + 胶囊），用 painted 渲染器的 probe 通路
// -----------------------------------------------------------------------------
// **2026-05-15 refactor**：以前 createCamera / rayFor / Lambert / shadow 都
// inline 写在这里。现在全部 MOVE 到 `src/sdf/probe.js`，本文件只保留**场景特化**
// 部分——单球 SDF 和 4 个胶囊的联合 SDF，加上各自的 regionFn。
//
// 跟 2D 场景完全不同的工作方式：
//   - 不靠 SDF 阈值给 cell 分组着色
//   - 靠 probe(x, y) 对每个 cell 投射射线，得到 (intensity, region, hit, normal)
//   - painted 用 intensity 调节 layer 数量（密度模拟），用 region 给 cell 分配
//     3 种区域色（前景物体 / 地面 / 背景）
//
// 场景：
//   15: BOB 原 scene 7 —— 单 3D 球 + 平面
//   16: BOB 原 scene 8 —— 4 个垂直 3D 胶囊体 + 平面
// =============================================================================

import { capsule } from '../../src/index.js';
import { createCamera, makeProbe } from '../../src/sdf/probe.js';

// re-export 让旧调用方继续工作（painted-scenes.js 等 import createCamera）
export { createCamera };

// 默认相机：face-on，distance=3.5，focal=2 → 透视
const DEFAULT_CAMERA = createCamera({ focal: 2, distance: 3.5, yaw: 0, pitch: 0 });

// ----- Scene 15: 单球 -------------------------------------------------------
// 球 + 地面联合 SDF：地面 y=-1，球在 (-0.2, 0, 0) 半径 1
const sphere_pos = [-0.2, 0, 0];
const sphere_radius = 1;

const sceneSphereSdf = (p) => {
  const ground = p[1] + 1;
  // 解析球 SDF
  const dx = p[0] - sphere_pos[0];
  const dy = p[1] - sphere_pos[1];
  const dz = p[2] - sphere_pos[2];
  const ball = Math.sqrt(dx*dx + dy*dy + dz*dz) - sphere_radius;
  return Math.min(ground, ball);
};

// Region 分类：比较 hit 到地面 vs 球的距离
const regionForSphere = (hit) => {
  const groundD = Math.abs(hit[1] + 1);
  const dx = hit[0] - sphere_pos[0], dy = hit[1] - sphere_pos[1], dz = hit[2] - sphere_pos[2];
  const ballD = Math.abs(Math.sqrt(dx*dx + dy*dy + dz*dz) - sphere_radius);
  return groundD < ballD ? 'ground' : 'object';
};

const makeProbeSphere = (camera, lightPos) => makeProbe(sceneSphereSdf, {
  camera,
  lightPos,  // undefined → 用 probe.js 的 DEFAULT_LIGHT_POSITION
  regionFn: regionForSphere,
  shadows: true,
});

// ----- Scene 16: 4 个垂直胶囊体 ---------------------------------------------
const CAPSULES = [
  { x: -0.8, z: -0.3, h: 0.9, r: 0.32 },  // 前左：矮
  { x: -0.2, z:  0.5, h: 1.4, r: 0.36 },  // 后左：中高
  { x:  0.4, z:  0.4, h: 1.7, r: 0.40 },  // 后右：最高最粗
  { x:  0.5, z: -0.5, h: 1.1, r: 0.32 },  // 前右：中低
];

const capsuleEndpoints = (c) => [[c.x, -1, c.z], [c.x, -1 + c.h, c.z]];

// 联合 SDF：地面（y = -1 平面）∪ 所有胶囊
const sceneCapSdf = (p) => {
  let d = p[1] + 1;  // 地面
  for (const c of CAPSULES) {
    const [a, b] = capsuleEndpoints(c);
    d = Math.min(d, capsule(a, b, c.r)(p));
  }
  return d;
};

// Region 分类：比较 hit 到地面 vs 最近胶囊的距离
const regionForCapsules = (hit) => {
  const groundD = Math.abs(hit[1] + 1);
  let nearestCapD = Infinity;
  for (const c of CAPSULES) {
    const [a, b] = capsuleEndpoints(c);
    nearestCapD = Math.min(nearestCapD, Math.abs(capsule(a, b, c.r)(hit)));
  }
  return groundD < nearestCapD ? 'ground' : 'object';
};

const makeProbeCapsules = (camera, lightPos) => makeProbe(sceneCapSdf, {
  camera,
  lightPos,  // undefined → 用 probe.js 的 DEFAULT_LIGHT_POSITION
  regionFn: regionForCapsules,
  shadows: true,
});

// ---- 派发 -----------------------------------------------------------------
// makeProbe(scene, camera?, lightPos?) —— camera + lightPos 都可省略，省略 = 默认
export const makeProbe_scene = (scene, camera = DEFAULT_CAMERA, lightPos = undefined) => {
  if (scene === 15) return makeProbeSphere(camera, lightPos);
  if (scene === 16) return makeProbeCapsules(camera, lightPos);
  return null;
};

// 旧名字 alias —— 兼容 painted-scenes.js / test-pasma-capsules.js
export { makeProbe_scene as makeProbe };
