// =============================================================================
// field/ —— 标量/向量场代数（(x, y) → number）
// -----------------------------------------------------------------------------
// 设计原则：field 就是一个 `(x, y) => number` 的纯函数。
// 所有的"组合算子"都是高阶函数：吃 field 返回 field。
//
// 当前支持的 field：
//   - noise:     Perlin noise → angle
//   - constant:  恒定角度
//   - radial:    径向 / 切向 / 螺旋 / 射线
//
// 组合算子：
//   - add:       角度叠加
//   - blend:     线性混合
//   - scale:     field 输出乘常数
//   - perturb:   高斯衰减的局部扰动（Tyler adjFlw）
//   - warp:      domain warping（IQ 风格）
//   - quantize:  角度量化
// =============================================================================

export { createPerlin, noiseField } from './noise.js';
export { calculateAlpha, protoOpacity, protoAlpha } from './proto.js';

// ---- field 构造器 ---------------------------------------------------------

/** 恒定角度场 */
export const constant = (theta) => () => theta;

/**
 * 径向场：以 (cx, cy) 为中心。
 * mode:
 *   'normal'   —— 朝外辐射（射线方向）
 *   'tangent'  —— 切向（绕中心旋转）
 *   'spiral'   —— 螺旋（射线 + 45° 偏置）
 *   'cos'      —— tangent + cos(angle) 调制
 *   'sin'      —— tangent + sin(angle) 调制
 */
export function radial({ cx = 0, cy = 0, mode = 'tangent' } = {}) {
  return (x, y) => {
    const a = Math.atan2(y - cy, x - cx);
    if (mode === 'normal')   return a;
    if (mode === 'tangent')  return a + Math.PI / 2;
    if (mode === 'spiral')   return a + Math.PI / 4;
    if (mode === 'cos')      return a + Math.PI / 2 + Math.cos(a);
    if (mode === 'sin')      return a + Math.PI / 2 + Math.sin(a);
    return a;
  };
}

// ---- 组合算子 -------------------------------------------------------------

/** 角度叠加：f1(x,y) + f2(x,y) + ... */
export const add = (...fields) => (x, y) =>
  fields.reduce((s, f) => s + f(x, y), 0);

/** 线性混合：weight 在 [0,1]，0 = 全 a、1 = 全 b */
export const blend = (a, b, weight) => (x, y) =>
  a(x, y) * (1 - weight) + b(x, y) * weight;

/** 输出乘常数（配合 add 做加权叠加） */
export const scale = (field, k) => (x, y) => field(x, y) * k;

/**
 * 局部扰动（Tyler 的 adjFlw 等价）：在 (cx, cy) 半径 radius 内向 base 加一个
 * 高斯衰减的角度偏移，距离中心 0 时偏移 = amount，距离 = radius 时偏移 = 0。
 */
export function perturb(base, { cx, cy, radius, amount }) {
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= radius) return base(x, y);
    const t = 1 - d / radius;
    return base(x, y) + amount * t;
  };
}

/**
 * Domain warping：在 evaluate base 前先 warp 坐标。
 * warpFn: (x, y) => [u, v]
 */
export const warp = (base, warpFn) => (x, y) => {
  const [u, v] = warpFn(x, y);
  return base(u, v);
};

/** 角度量化：把输出 snap 到 step 的整数倍 */
export const quantize = (base, step) => (x, y) =>
  Math.round(base(x, y) / step) * step;

/**
 * 域重复：把 (x, y) fold 到一个周期格里再 evaluate base。
 * period 标量 = 两个轴同周期；[Px, Py] = 各自周期。
 */
export const rep = (base, period) => {
  const wrap = (v, P) => v - P * Math.floor((v + P / 2) / P);
  const Px = Array.isArray(period) ? period[0] : period;
  const Py = Array.isArray(period) ? (period[1] ?? period[0]) : period;
  return (x, y) => base(wrap(x, Px), wrap(y, Py));
};
