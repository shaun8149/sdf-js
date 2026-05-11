// =============================================================================
// 2D 向量与 2x2 矩阵工具
// -----------------------------------------------------------------------------
// 与 vec.js 同构，所有 vec2 都是 [x, y] 数组。
// 与 BOB 的 lib2d/vec.js 对齐（add2 / sub2 / trans2 等是这里的同名操作）。
// =============================================================================

export const ORIGIN = [0, 0];
export const X = [1, 0];
export const Y = [0, 1];
export const UP = Y;          // 2D 上方向是 +Y（与 BOB 一致）

export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
export const div = (a, s) => [a[0] / s, a[1] / s];
export const neg = (a) => [-a[0], -a[1]];

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
// 2D"叉积"：返回标量（即 z 分量），常用于判左右
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

export const length = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1]);
export const lengthSq = (a) => a[0] * a[0] + a[1] * a[1];

export const normalize = (a) => {
  const l = length(a);
  if (l === 0) throw new Error('cannot normalize zero vector');
  return [a[0] / l, a[1] / l];
};

// 标量自动展成 [s, s]
export const asVec2 = (v) =>
  typeof v === 'number' ? [v, v] : [v[0], v[1]];

// 2x2 矩阵以行主序展开为 [m00, m01, m10, m11]
export const matMul = (m, v) => [
  m[0] * v[0] + m[1] * v[1],
  m[2] * v[0] + m[3] * v[1],
];

// 2D 旋转矩阵：逆时针 angle 弧度
export const rotMat = (angle) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c, -s, s, c];
};
