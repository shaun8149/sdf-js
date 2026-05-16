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

/**
 * 域重复（domain repetition / pMod）：把每个轴 fold 到 [-P/2, +P/2] 后再 evaluate a。
 * 效果是空间的"平铺"—— 一个 circle 通过 rep 立刻变成网格化的圆点阵。
 *
 * @param a       要重复的 SDF
 * @param period  标量（所有轴同周期）或数组（per-axis）
 * @param options { count, padding }
 *   - count: null = 无限重复（默认）；标量或数组 = clip tile index 到 [-count, +count]
 *           → 2*count+1 个 tiles per 轴（finite tiling）
 *   - padding: 0 = 无邻居查询（默认）；标量或数组 = 每轴 ±padding 邻居 tile 求 min
 *            → 消除主 SDF 形状跨越 tile 边界时的拼接 artifact
 *            （Python sdf/dn.py 的 repeat 同等行为）
 *
 * 例: rep(circle, 1)                        无限点阵
 *     rep(circle, 1, { count: 2 })           5x5 点阵
 *     rep(circle, 1, { padding: 1 })         邻居 union 平滑
 *     rep(circle, 1, { count: 2, padding: 1 }) 5x5 + 平滑邻
 */
export const rep = defineOpN('rep', (a, period, options = {}) => {
  const { count = null, padding = 0 } = options;
  // 0 = 该轴不重复（substitute 1e6 让 mod 退化为 identity；跟 GLSL rep3 一致）
  const getP   = (i) => {
    const val = Array.isArray(period) ? (period[i] ?? period[0]) : period;
    return val === 0 ? 1e6 : val;
  };
  const getCnt = (i) => {
    if (count === null) return null;
    return Array.isArray(count) ? (count[i] ?? count[0]) : count;
  };
  const getPad = (i) => Array.isArray(padding) ? (padding[i] ?? padding[0]) : padding;
  const padIsZero = (Array.isArray(padding) ? padding.every(v => v === 0) : padding === 0);

  return (p) => {
    const dim = p.length;
    // 算每轴 tile index（最近 tile）+ count clip
    const idx = new Array(dim);
    for (let i = 0; i < dim; i++) {
      const P = getP(i);
      let id = Math.round(p[i] / P);
      const c = getCnt(i);
      if (c !== null) id = Math.max(-c, Math.min(c, id));
      idx[i] = id;
    }

    // 快通道：无 padding，直接平移 evaluate
    if (padIsZero) {
      const wp = new Array(dim);
      for (let i = 0; i < dim; i++) wp[i] = p[i] - getP(i) * idx[i];
      return a.f(wp);
    }

    // padding 通路：邻居 (2*pad+1)^dim 个 tile 求 min
    let best = Infinity;
    if (dim === 2) {
      const pad0 = getPad(0), pad1 = getPad(1);
      const P0 = getP(0), P1 = getP(1);
      for (let n0 = -pad0; n0 <= pad0; n0++) {
        for (let n1 = -pad1; n1 <= pad1; n1++) {
          const d = a.f([p[0] - P0 * (idx[0] + n0), p[1] - P1 * (idx[1] + n1)]);
          if (d < best) best = d;
        }
      }
    } else if (dim === 3) {
      const pad0 = getPad(0), pad1 = getPad(1), pad2 = getPad(2);
      const P0 = getP(0), P1 = getP(1), P2 = getP(2);
      for (let n0 = -pad0; n0 <= pad0; n0++) {
        for (let n1 = -pad1; n1 <= pad1; n1++) {
          for (let n2 = -pad2; n2 <= pad2; n2++) {
            const d = a.f([
              p[0] - P0 * (idx[0] + n0),
              p[1] - P1 * (idx[1] + n1),
              p[2] - P2 * (idx[2] + n2),
            ]);
            if (d < best) best = d;
          }
        }
      }
    } else {
      // 通用 N 维 fallback
      const visit = (axis, cur) => {
        if (axis === dim) {
          const wp = new Array(dim);
          for (let i = 0; i < dim; i++) wp[i] = p[i] - getP(i) * cur[i];
          const d = a.f(wp);
          if (d < best) best = d;
          return;
        }
        const pad = getPad(axis);
        for (let n = -pad; n <= pad; n++) {
          cur[axis] = idx[axis] + n;
          visit(axis + 1, cur);
        }
      };
      visit(0, new Array(dim));
    }
    return best;
  };
});

/**
 * 沿轴拉长 SDF（保持端帽形状）。
 * 2D / 3D 自动派发：根据 SDF 维度处理。
 *   size 可标量 / [sx, sy] / [sx, sy, sz]，缺省的轴当 0
 *
 * 例：
 *   circle(0.1).elongate([0.3, 0])      → 水平 2D capsule
 *   sphere(0.1).elongate([0, 0.3, 0])   → 垂直 3D capsule
 *   box(0.2).elongate([0.2, 0, 0.2])    → 沿 X / Z 拉长的 brick
 */
export const elongate = defineOpN('elongate', (a, size) => (p) => {
  const dim = p.length;
  const s0 = Array.isArray(size) ? (size[0] ?? 0) : size;
  const s1 = Array.isArray(size) ? (size[1] ?? 0) : size;
  if (dim === 2) {
    const qx = Math.abs(p[0]) - s0;
    const qy = Math.abs(p[1]) - s1;
    const w = Math.min(Math.max(qx, qy), 0);
    return a.f([Math.max(qx, 0), Math.max(qy, 0)]) + w;
  } else {
    const s2 = Array.isArray(size) ? (size[2] ?? 0) : size;
    const qx = Math.abs(p[0]) - s0;
    const qy = Math.abs(p[1]) - s1;
    const qz = Math.abs(p[2]) - s2;
    const w = Math.min(Math.max(Math.max(qx, qy), qz), 0);
    return a.f([Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)]) + w;
  }
});

/**
 * SDF 线性插值：d = K * d_b + (1-K) * d_a
 * 跟 smooth union 不同语义 —— blend 是**距离值**的 lerp，可用于 morph / 变形过渡。
 *
 * 单个 b: blend(a, b, { k: 0.3 })  → 偏向 a 70%、b 30%
 * 多个 b: 顺序 lerp（chain）
 * 默认 k = 0.5（等比例融合）
 *
 * 例: blend(circle(0.5), rectangle(1), { k: 0.3 })  → 偏圆但带方角的 morph
 */
export const blend = defineOpN('blend', (a, ...rest) => {
  const [bs, opts] = splitOpts(rest);
  const defaultK = opts.k ?? 0.5;
  return (p) => {
    let d1 = a.f(p);
    for (const b of bs) {
      const d2 = b.f(p);
      const K = (opts.k != null) ? opts.k : (b._k != null ? b._k : defaultK);
      d1 = K * d2 + (1 - K) * d1;
    }
    return d1;
  };
});
