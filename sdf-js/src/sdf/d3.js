// =============================================================================
// 3D primitives + 变换算子
// -----------------------------------------------------------------------------
// 镜像 Python sdf/d3.py。这一轮只实现"够 demo 布尔运算"的最小子集：
//   primitives: sphere / box / plane
//   transforms: translate / scale / rotate / orient
// 后续按 README 列表逐步补 cylinder / torus / capsule / cone / 多面体等。
// =============================================================================

import { SDF3, defineOp3 } from './core.js';
import * as v from './vec.js';

// ---- Primitives ------------------------------------------------------------

export const sphere = (radius = 1, center = v.ORIGIN) =>
  SDF3((p) => v.length(v.sub(p, center)) - radius);

// IQ 标准 box SDF：q = |p|-half; outside = |max(q,0)|; inside = min(max(q.xyz),0)
export const box = (size = 1, center = v.ORIGIN) => {
  const s = v.asVec3(size);
  const half = [s[0] / 2, s[1] / 2, s[2] / 2];
  return SDF3((p) => {
    const qx = Math.abs(p[0] - center[0]) - half[0];
    const qy = Math.abs(p[1] - center[1]) - half[1];
    const qz = Math.abs(p[2] - center[2]) - half[2];
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    const outside = Math.sqrt(ox * ox + oy * oy + oz * oz);
    const inside = Math.min(Math.max(qx, qy, qz), 0);
    return outside + inside;
  });
};

export const plane = (normal = v.UP, point = v.ORIGIN) => {
  const n = v.normalize(normal);
  return SDF3((p) => v.dot(v.sub(point, p), n));
};

// ---- Transforms ------------------------------------------------------------

export const translate = defineOp3('translate', (other, offset) =>
  (p) => other.f(v.sub(p, offset)),
);

export const scale = defineOp3('scale', (other, factor) => {
  const s = v.asVec3(factor);
  // 非均匀缩放不是精确 SDF；用最小分量补偿减小误差，与 Python 一致
  const m = Math.min(s[0], s[1], s[2]);
  return (p) => other.f([p[0] / s[0], p[1] / s[1], p[2] / s[2]]) * m;
});

// rotate(angle, axis)：把点逆向旋转到原始坐标系，等价于把形状正向旋转
export const rotate = defineOp3('rotate', (other, angle, axis = v.Z) => {
  const m = v.rotMat(-angle, axis);
  return (p) => other.f(v.matMul(m, p));
});

// orient(axis)：把"原本朝 +Z 的形状"重新朝向 axis 方向
// 这是 fogleman 经典 demo 'sphere & box - cyl.orient(X|Y|Z)' 的关键
export const orient = defineOp3('orient', (other, axis) => {
  const target = v.normalize(axis);
  const d = v.dot(v.Z, target);
  // 同向：不做旋转
  if (d > 1 - 1e-9) return (p) => other.f(p);
  // 反向：绕 X 旋 180°
  if (d < -1 + 1e-9) {
    const m = v.rotMat(Math.PI, v.X);
    return (p) => other.f(v.matMul(m, p));
  }
  // 一般情况：绕 Z×target 旋转 acos(Z·target)
  const rotAxis = v.normalize(v.cross(v.Z, target));
  const angle = Math.acos(d);
  const m = v.rotMat(-angle, rotAxis);
  return (p) => other.f(v.matMul(m, p));
});
