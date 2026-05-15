// =============================================================================
// probe —— 统一 screen-space SDF inspector（orthographic + perspective）
// -----------------------------------------------------------------------------
// **背景**：sdf-js 多个 renderer (hatch / bobStipple / silhouette / raymarched)
// 之前各自 inline 实现 SDF3 probe，签名不一致（{hit,normal} vs {intensity}
// vs ...），导致 BOB painted.js 原本 4-value contract 在 polymorphic 迁移过程
// 中被各自简化丢失。这个模块把 examples/sdf/scenes-3d.js 已经稳定使用的
// 4-value contract MOVE 到 first-class src/，所有 consumer import 同一份。
//
// **4-value probe contract**（严格遵守，不要再砍）：
//   probe(x, y) → {
//     intensity: number,      // [0, 1] Lambert + 距离衰减 (+ 可选 shadow)
//     region:    string,      // 'object' / 'ground' / 'background' / 任意 key
//     hit:       vec3 | null, // 命中 3D 点
//     normal:    vec3 | null, // 表面法向
//   }
//
// **复用原则**：createCamera / rayFor / Lambert 公式都从 scenes-3d.js MOVE 过来
// 不重新发明。scenes-3d.js 重构后从这里 import。
// =============================================================================

import * as v from './vec.js';
import { raymarch3, sdf3_normal } from './raymarch.js';

export const DEFAULT_LIGHT_POSITION = [-2, 3, -4];

// ----------------------------------------------------------------------------
// Camera factory（MOVE from scenes-3d.js + EXTEND 加 orthographic 模式）
// ----------------------------------------------------------------------------
// 用球坐标参数化（yaw 水平 / pitch 俯仰 / distance 半径），自动算 5/6-tuple。
// `focal === 0` → orthographic；`focal > 0` → perspective。
// target 总是世界原点。

/**
 * @param {object} [opts]
 * @param {number} [opts.yaw=0.5]       - 水平绕 Y 轴 (rad)
 * @param {number} [opts.pitch=0.35]    - 俯仰 (rad，+ 朝下看)
 * @param {number} [opts.distance=4]    - 相机到 target 距离
 * @param {number} [opts.focal=0]       - 0 = ortho；>0 = perspective focal length
 * @param {[number,number,number]} [opts.target=[0,0,0]]
 *        - 相机的 look-at target。默认原点。改 target 让 camera "对准" subject 而不是世界中心
 *        - 跟 scene engine convention #5 一致
 * @returns {{type, cam, fwd, right, up, focal, target}}
 */
export function createCamera({
  yaw = 0.5,
  pitch = 0.35,
  distance = 4,
  focal = 0,
  target = [0, 0, 0],
} = {}) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);
  // 相机位置 = target + offset by (yaw, pitch, distance)
  const cam = [
    target[0] + distance * sy * cp,
    target[1] + distance * sp,
    target[2] - distance * cy * cp,
  ];
  // forward: 从 cam 看向 target
  const fwd = v.normalize(v.sub(target, cam));
  // right: world-up × forward
  let right = v.cross([0, 1, 0], fwd);
  if (v.length(right) < 1e-6) right = [1, 0, 0];   // 极点退化
  right = v.normalize(right);
  // 相机 up = forward × right
  const up = v.normalize(v.cross(fwd, right));
  const type = focal > 0 ? 'perspective' : 'orthographic';
  return { type, cam, fwd, right, up, focal, target };
}

/**
 * Free-fly camera：直接给 position + 朝向（yaw, pitch），没有 target 概念。
 * 跟 Blender camera fly mode / Source noclip / UE editor camera 同 paradigm。
 *
 * yaw=0, pitch=0 → 看 +Z 方向（跟 orbit camera 默认 yaw=0 pitch=0 距离 3.5 同向）
 * +pitch = 向下看（跟 orbit convention 一致）
 *
 * 输出跟 createCamera 同 shape：{type, cam, fwd, right, up, focal} 可直接喂 rayFor。
 *
 * @param {object} [opts]
 * @param {[number,number,number]} [opts.position=[0,0,-3.5]] - camera 在世界中的位置
 * @param {number} [opts.yaw=0]   - 水平绕 Y 轴 (rad)
 * @param {number} [opts.pitch=0] - 俯仰 (rad, + = 向下看)
 * @param {number} [opts.focal=0] - 0=ortho / >0=perspective
 */
export function createFlyCamera({
  position = [0, 0, -3.5],
  yaw = 0,
  pitch = 0,
  focal = 0,
} = {}) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);
  // fwd 公式：yaw=0,pitch=0 → [0,0,1]（看 +Z）；+pitch → -Y 分量（看下）
  const fwd = [sy * cp, -sp, cy * cp];
  // right = world_up × fwd
  let right = v.cross([0, 1, 0], fwd);
  if (v.length(right) < 1e-6) right = [1, 0, 0];
  right = v.normalize(right);
  // up = fwd × right
  const up = v.normalize(v.cross(fwd, right));
  const type = focal > 0 ? 'perspective' : 'orthographic';
  return { type, cam: position, fwd, right, up, focal, yaw, pitch, position };
}

/**
 * 把 light 的球坐标转 Cartesian (跟 scene engine convention #4 一致)。
 *   azimuth ∈ [-π, π]   水平绕 Y 轴
 *   altitude ∈ [-π/2, π/2]  高度角，>0 = 上方光、<0 = 下方逆光
 *   distance ∈ [1, 10]  到场景中心距离
 *
 * 默认 azim=-0.46, alt=0.59, dist=5.39 → 等效 [-2, 3, -4] (DEFAULT_LIGHT_POSITION)。
 */
export function lightFromSpherical(azimuth, altitude, distance) {
  const cp = Math.cos(altitude), sp = Math.sin(altitude);
  const cy = Math.cos(azimuth),  sy = Math.sin(azimuth);
  return [
    distance * sy * cp,
    distance * sp,
    -distance * cy * cp,
  ];
}

// ----------------------------------------------------------------------------
// Ray construction（MOVE from scenes-3d.js + EXTEND ortho 分支）
// ----------------------------------------------------------------------------
/**
 * 根据 camera 把 image-plane (x, y) 转成射线 {ro, rd}。
 *
 * **坐标约定（2026-05-15 统一）**：`(x, y)` 是 **math-y-up**（+y 朝上），跟
 * raymarched.js / fly3d / GLSL `gl_FragCoord.y` 主流一致。caller 自己 flip 屏幕
 * 像素的 y 到 math y-up 再传过来（参考 bobStipple/painted 的 pxToWorld：flipY=true）。
 *
 * - **Orthographic**: (x, y) 是 world image-plane coords（right/up 平面上的偏移）。
 *   ro = cam + right·x + up·y, rd = camera.fwd
 * - **Perspective**: (x, y) 是 normalized image-plane coords (∈ [-1, 1])，
 *   focal 把 image plane 推到 camera 前方 focal 单位处。
 *   rd = normalize(right·x + up·y + fwd·focal), ro = cam
 *
 * 旧版本（2026-05 前）这里写 `up·(-y)` 是 image-y-down 约定，但 MVP 跟现代 shader
 * 都已经迁到 math-y-up；2026-05-15 修齐。
 */
export function rayFor(camera, x, y) {
  if (camera.type === 'orthographic') {
    const ro = v.add(
      camera.cam,
      v.add(v.mul(camera.right, x), v.mul(camera.up, y)),
    );
    return { ro, rd: camera.fwd };
  }
  // perspective
  const dir = v.add(
    v.add(v.mul(camera.right, x), v.mul(camera.up, y)),
    v.mul(camera.fwd, camera.focal),
  );
  return { ro: camera.cam, rd: v.normalize(dir) };
}

// ----------------------------------------------------------------------------
// Probe factory（EXTRACT from scenes-3d.js makeProbeCapsules body）
// ----------------------------------------------------------------------------
/**
 * 给任意 SDF3 + camera + 可选 regionFn → 4-value probe 函数。
 *
 * 算法跟 scenes-3d.js makeProbeCapsules 完全一致：
 *   1. rayFor(camera, x, y) → {ro, rd}
 *   2. raymarch3 找 hit
 *   3. sdf3_normal 算 normal
 *   4. Lambert + 距离平方衰减 + sqrt 提亮（BOB scenes 7/8 视觉签名公式）
 *   5. 可选 shadow cast：从 hit 沿 normal 偏移 + 朝光的二次 raymarch
 *
 * 未命中时返回 {intensity:0, region:'background', hit:null, normal:null}（contract）。
 *
 * @param {Function} sdf3 - callable SDF3 (point) => distance
 * @param {object} [opts]
 * @param {object} [opts.camera=createCamera()]
 * @param {[number,number,number]} [opts.lightPos=DEFAULT_LIGHT_POSITION]
 * @param {(hit:vec3)=>string} [opts.regionFn] - 命中时调用；默认返回 'object'
 * @param {boolean} [opts.shadows=false] - 是否做 shadow cast (慢)
 * @param {number} [opts.maxSteps=80]
 * @param {number} [opts.maxDist=10]
 * @param {number} [opts.eps=0.001]
 * @returns {(x:number, y:number) => {intensity, region, hit, normal}}
 */
export function makeProbe(sdf3, opts = {}) {
  const {
    camera = createCamera(),
    lightPos = DEFAULT_LIGHT_POSITION,
    regionFn = null,
    shadows = false,
    maxSteps = 80,
    maxDist = 10,
    eps = 0.001,
  } = opts;

  return (x, y) => {
    const { ro, rd } = rayFor(camera, x, y);
    const t = raymarch3(ro, rd, sdf3, maxSteps, maxDist, eps);
    if (t < 0) {
      return { intensity: 0, region: 'background', hit: null, normal: null };
    }

    const hit = v.add(ro, v.mul(rd, t));
    const region = regionFn ? regionFn(hit) : 'object';
    const normal = sdf3_normal(sdf3, hit);

    // Lambert + 距离平方衰减（BOB painted.js scenes 7/8 公式，不要改）
    let vec_to_light = v.sub(hit, lightPos);
    const light_dist_sqr = v.dot(vec_to_light, vec_to_light);
    vec_to_light = v.mul(vec_to_light, -1 / Math.sqrt(light_dist_sqr));
    let light = v.dot(normal, vec_to_light) * 30 / light_dist_sqr;

    if (shadows) {
      // 沿法向偏移避免自命中，朝光发射一条 ray，命中比光距离近 → 阴影
      const shadowOrigin = v.add(hit, v.mul(normal, eps * 10));
      const shadowT = raymarch3(shadowOrigin, vec_to_light, sdf3, maxSteps, maxDist, eps);
      const lightDist = Math.sqrt(light_dist_sqr);
      if (shadowT > 0 && shadowT < lightDist) {
        light = 0;
      }
    }

    return {
      intensity: Math.sqrt(Math.min(1, Math.max(0, light))),
      region,
      hit,
      normal,
    };
  };
}
