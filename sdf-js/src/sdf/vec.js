// =============================================================================
// 向量与 3x3 矩阵工具（替代 Python 端的 numpy）
// -----------------------------------------------------------------------------
// 所有 vec3 都是普通 [x, y, z] 数组。SDF 求值是热路径，函数尽量内联、少分配。
// 矩阵以行主序展开为长度 9 的数组：[r00, r01, r02, r10, r11, r12, r20, r21, r22]
// =============================================================================

export const ORIGIN = [0, 0, 0];
export const X = [1, 0, 0];
export const Y = [0, 1, 0];
export const Z = [0, 0, 1];
export const UP = Z;

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const div = (a, s) => [a[0] / s, a[1] / s, a[2] / s];
export const neg = (a) => [-a[0], -a[1], -a[2]];

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const length = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
export const lengthSq = (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];

export const normalize = (a) => {
  const l = length(a);
  if (l === 0) throw new Error('cannot normalize zero vector');
  return [a[0] / l, a[1] / l, a[2] / l];
};

// 标准化为数组形式：标量 → [s, s, s]
export const asVec3 = (v) =>
  typeof v === 'number' ? [v, v, v] : [v[0], v[1], v[2]];

// 3x3 矩阵 × 3x1 向量
export const matMul = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

// Rodrigues 公式：绕单位轴旋转 angle 弧度
export const rotMat = (angle, axis) => {
  const [x, y, z] = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    t * x * x + c,     t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c,     t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
};
