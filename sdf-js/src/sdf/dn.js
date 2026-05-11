// =============================================================================
// 维度无关的布尔运算（hard + smooth 版本）
// -----------------------------------------------------------------------------
// 与 Python 的 dn.py 等价。Smooth 公式来自 Inigo Quilez 的 polynomial blend。
//
// 用法：
//   union(a, b)                  → 硬并 min(d_a, d_b)
//   union(a, b.k(0.25))          → 软并 (k=0.25 来自 b 自己的 _k)
//   union(a, b, { k: 0.25 })     → 软并 (显式传 k 优先级最高)
//   a.union(b)                   → 链式版本，等价
// =============================================================================

import { SDF2, SDF3, defineOpN } from './core.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// 把"最后一个参数若是 {k}"切出来；剩下的都视为 SDF2/SDF3
const splitOpts = (rest) => {
  if (rest.length && typeof rest[rest.length - 1] === 'object' &&
      !(rest[rest.length - 1] instanceof SDF2) &&
      !(rest[rest.length - 1] instanceof SDF3)) {
    return [rest.slice(0, -1), rest[rest.length - 1]];
  }
  return [rest, {}];
};

// 取 smooth 系数：显式 > b._k > null（→ 走 hard 分支）
const resolveK = (opts, b) => {
  if (opts.k != null) return opts.k;
  if (b._k != null) return b._k;
  return null;
};

export const union = defineOpN('union', (a, ...rest) => {
  const [bs, opts] = splitOpts(rest);
  return (p) => {
    let d1 = a.f(p);
    for (const b of bs) {
      const d2 = b.f(p);
      const K = resolveK(opts, b);
      if (K === null) {
        d1 = Math.min(d1, d2);
      } else {
        const h = clamp01(0.5 + 0.5 * (d2 - d1) / K);
        d1 = (d2 + (d1 - d2) * h) - K * h * (1 - h);
      }
    }
    return d1;
  };
});

export const difference = defineOpN('difference', (a, ...rest) => {
  const [bs, opts] = splitOpts(rest);
  return (p) => {
    let d1 = a.f(p);
    for (const b of bs) {
      const d2 = b.f(p);
      const K = resolveK(opts, b);
      if (K === null) {
        d1 = Math.max(d1, -d2);
      } else {
        const h = clamp01(0.5 - 0.5 * (d2 + d1) / K);
        d1 = (d1 + (-d2 - d1) * h) + K * h * (1 - h);
      }
    }
    return d1;
  };
});

export const intersection = defineOpN('intersection', (a, ...rest) => {
  const [bs, opts] = splitOpts(rest);
  return (p) => {
    let d1 = a.f(p);
    for (const b of bs) {
      const d2 = b.f(p);
      const K = resolveK(opts, b);
      if (K === null) {
        d1 = Math.max(d1, d2);
      } else {
        const h = clamp01(0.5 - 0.5 * (d2 - d1) / K);
        d1 = (d2 + (d1 - d2) * h) + K * h * (1 - h);
      }
    }
    return d1;
  };
});

export const negate = defineOpN('negate', (a) => (p) => -a.f(p));

export const dilate = defineOpN('dilate', (a, r) => (p) => a.f(p) - r);
export const erode = defineOpN('erode', (a, r) => (p) => a.f(p) + r);
export const shell = defineOpN('shell', (a, thickness) =>
  (p) => Math.abs(a.f(p)) - thickness / 2,
);
