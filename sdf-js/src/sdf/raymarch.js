// =============================================================================
// 3D 射线求交 / 球追踪 / 法向估算
// -----------------------------------------------------------------------------
// 与 BOB lib3d/sdf.js 对齐：让 sdf-js 也能做 3D 场景的光线追踪。
//
// 三个工具：
//   raymarch3(ro, rd, sdf)            sphere-tracing 通用 SDF
//   intersect_sphere(ro, rd, c, r)    球的解析求交（比 raymarch 快得多）
//   sdf3_normal(sdf, p)               中心差分估算法向量
//
// sdf 参数可以是 sdf-js 的 SDF3 实例（callable）或原始 (p)=>distance 函数。
// =============================================================================

import * as v from './vec.js';

/**
 * 球追踪：沿射线方向每步走"安全距离"（当前点的 SDF 值）。
 *
 * @param {[number,number,number]} ro - 射线起点
 * @param {[number,number,number]} rd - 射线方向（单位向量）
 * @param {(p:[number,number,number])=>number} sdf
 * @param {number} [maxSteps=80]
 * @param {number} [maxDist=100]
 * @param {number} [eps=0.001]
 * @returns {number} 命中点的 t 参数（负数 = 不命中）
 */
export const raymarch3 = (ro, rd, sdf, maxSteps = 80, maxDist = 100, eps = 0.001) => {
  let t = 0;
  for (let i = 0; i < maxSteps; i++) {
    const p = v.add(ro, v.mul(rd, t));
    const d = sdf(p);
    if (d < eps) return t;
    t += d;
    if (t > maxDist) return -1;
  }
  return -1;
};

/**
 * 球的解析求交：返回最近交点的 t 参数（负数 = 不命中）。
 * 比 raymarch3 快得多，但只对球有效。
 */
export const intersect_sphere = (ro, rd, center, radius) => {
  const oc = v.sub(ro, center);
  const b = v.dot(oc, rd);
  const c = v.dot(oc, oc) - radius * radius;
  const h = b * b - c;
  if (h < 0) return -1;
  return -b - Math.sqrt(h);
};

/**
 * 中心差分估算 SDF 在点 p 处的法向量（即梯度方向，归一化）。
 * raymarching 命中后用这个算光照。
 */
export const sdf3_normal = (sdf, p, eps = 0.001) => {
  return v.normalize([
    sdf([p[0] + eps, p[1], p[2]]) - sdf([p[0] - eps, p[1], p[2]]),
    sdf([p[0], p[1] + eps, p[2]]) - sdf([p[0], p[1] - eps, p[2]]),
    sdf([p[0], p[1], p[2] + eps]) - sdf([p[0], p[1], p[2] - eps]),
  ]);
};
