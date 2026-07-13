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
  if (
    rest.length &&
    typeof rest[rest.length - 1] === 'object' &&
    !(rest[rest.length - 1] instanceof SDF2) &&
    !(rest[rest.length - 1] instanceof SDF3)
  ) {
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
        const h = clamp01(0.5 + (0.5 * (d2 - d1)) / K);
        d1 = d2 + (d1 - d2) * h - K * h * (1 - h);
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
        const h = clamp01(0.5 - (0.5 * (d2 + d1)) / K);
        d1 = d1 + (-d2 - d1) * h + K * h * (1 - h);
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
        const h = clamp01(0.5 - (0.5 * (d2 - d1)) / K);
        d1 = d2 + (d1 - d2) * h + K * h * (1 - h);
      }
    }
    return d1;
  };
});

// =============================================================================
// hg_sdf-style boolean variants — chamfered / round join geometry
// -----------------------------------------------------------------------------
// Each variant is a LEFT-FOLD over children: unionChamfer(a, b, c, {r:0.1})
// = opChamferUnion(opChamferUnion(a, b, 0.1), c, 0.1). Single r per node,
// applied to every pairwise join inside it. Mirror of the GLSL emitters in
// sdf3.compile.js so CPU raymarchers (silhouette / stipple etc.) and GPU
// raymarchers produce visually identical results.
//
// For multi-mode scenes (different join modes at different nesting levels),
// nest the operations: unionChamfer(a, unionRound(b, c, {r: 0.02}), {r: 0.1}).
// =============================================================================

const SQRT_HALF = Math.SQRT1_2; // 0.70710678 — chamfer diagonal scaling

// chamfer = 45° flat between two surfaces
const _opChamferUnion = (a, b, r) => Math.min(Math.min(a, b), (a + b - r) * SQRT_HALF);
const _opChamferIntersect = (a, b, r) => Math.max(Math.max(a, b), (a + b + r) * SQRT_HALF);
const _opChamferDifference = (a, b, r) => _opChamferIntersect(a, -b, r);

// round = quarter-circle bevel
const _opRoundUnion = (a, b, r) => {
  const ux = Math.max(r - a, 0),
    uy = Math.max(r - b, 0);
  return Math.max(r, Math.min(a, b)) - Math.hypot(ux, uy);
};
const _opRoundIntersect = (a, b, r) => {
  const ux = Math.max(r + a, 0),
    uy = Math.max(r + b, 0);
  return Math.min(-r, Math.max(a, b)) + Math.hypot(ux, uy);
};
const _opRoundDifference = (a, b, r) => _opRoundIntersect(a, -b, r);

// Generic left-fold builder. opFn = (acc, d, ...args) → newAcc
const _makeVariant =
  (opFn, defaults) =>
  (a, ...rest) => {
    const [bs, opts] = splitOpts(rest);
    const r = opts.r ?? defaults.r ?? 0.05;
    return (p) => {
      let d1 = a.f(p);
      for (const b of bs) {
        d1 = opFn(d1, b.f(p), r);
      }
      return d1;
    };
  };

export const unionChamfer = defineOpN('unionChamfer', _makeVariant(_opChamferUnion, { r: 0.05 }));
export const intersectionChamfer = defineOpN(
  'intersectionChamfer',
  _makeVariant(_opChamferIntersect, { r: 0.05 }),
);
export const differenceChamfer = defineOpN(
  'differenceChamfer',
  _makeVariant(_opChamferDifference, { r: 0.05 }),
);
export const unionRound = defineOpN('unionRound', _makeVariant(_opRoundUnion, { r: 0.05 }));
export const intersectionRound = defineOpN(
  'intersectionRound',
  _makeVariant(_opRoundIntersect, { r: 0.05 }),
);
export const differenceRound = defineOpN(
  'differenceRound',
  _makeVariant(_opRoundDifference, { r: 0.05 }),
);

// Soft = cubic-polynomial smooth join (different formula than opSmoothUnion)
const _opSoftUnion = (a, b, r) => {
  const e = Math.max(r - Math.abs(a - b), 0);
  return Math.min(a, b) - (e * e * 0.25) / r;
};

// Stairs — N stair steps at join boundary. Takes (r, n).
const _modPositive = (x, m) => ((x % m) + m) % m;
const _opStairsUnion = (a, b, r, n) => {
  const s = r / n;
  const u = b - r;
  return Math.min(Math.min(a, b), 0.5 * (u + a + Math.abs(_modPositive(u - a + s, 2 * s) - s)));
};
const _opStairsIntersect = (a, b, r, n) => -_opStairsUnion(-a, -b, r, n);
const _opStairsDifference = (a, b, r, n) => -_opStairsUnion(-a, b, r, n);

// Columns — N columnar bumps at join boundary. Takes (r, n).
const _pR45 = (x, y) => [(x + y) * Math.SQRT1_2, (y - x) * Math.SQRT1_2];
const _opColumnsUnion = (a, b, r, n) => {
  if (a < r && b < r) {
    let [px, py] = _pR45(a, b);
    const cr = (r * Math.SQRT2) / ((n - 1) * 2 + Math.SQRT2);
    px -= Math.SQRT1_2 * r;
    px += cr * Math.SQRT2;
    if (n % 2 === 1) py += cr;
    py = _modPositive(py + cr, 2 * cr) - cr;
    let result = Math.hypot(px, py) - cr;
    result = Math.min(result, px);
    result = Math.min(result, a);
    return Math.min(result, b);
  }
  return Math.min(a, b);
};
const _opColumnsDifference = (a0, b, r, n) => {
  const aa = -a0;
  const m = Math.min(aa, b);
  if (aa < r && b < r) {
    let [px, py] = _pR45(aa, b);
    const cr = ((r * Math.SQRT2) / n) * 0.5;
    px -= Math.SQRT1_2 * r;
    px += cr * Math.SQRT2;
    if (n % 2 === 1) py += cr;
    py = _modPositive(py + cr, 2 * cr) - cr;
    let result = -(Math.hypot(px, py) - cr);
    result = Math.max(result, px);
    result = Math.min(result, aa);
    result = Math.min(result, b);
    return -result;
  }
  return -m;
};
const _opColumnsIntersect = (a, b, r, n) => _opColumnsDifference(a, -b, r, n);

// Two-arg variant builder (r + n). Soft uses r only but n is harmless extra.
const _makeVariant2 =
  (opFn, defaults) =>
  (a, ...rest) => {
    const [bs, opts] = splitOpts(rest);
    const r = opts.r ?? defaults.r ?? 0.1;
    const n = opts.n ?? defaults.n ?? 3;
    return (p) => {
      let d1 = a.f(p);
      for (const b of bs) {
        d1 = opFn(d1, b.f(p), r, n);
      }
      return d1;
    };
  };

export const unionSoft = defineOpN('unionSoft', _makeVariant(_opSoftUnion, { r: 0.1 }));
export const unionStairs = defineOpN(
  'unionStairs',
  _makeVariant2(_opStairsUnion, { r: 0.1, n: 3 }),
);
export const intersectionStairs = defineOpN(
  'intersectionStairs',
  _makeVariant2(_opStairsIntersect, { r: 0.1, n: 3 }),
);
export const differenceStairs = defineOpN(
  'differenceStairs',
  _makeVariant2(_opStairsDifference, { r: 0.1, n: 3 }),
);
export const unionColumns = defineOpN(
  'unionColumns',
  _makeVariant2(_opColumnsUnion, { r: 0.1, n: 3 }),
);
export const intersectionColumns = defineOpN(
  'intersectionColumns',
  _makeVariant2(_opColumnsIntersect, { r: 0.1, n: 3 }),
);
export const differenceColumns = defineOpN(
  'differenceColumns',
  _makeVariant2(_opColumnsDifference, { r: 0.1, n: 3 }),
);

// =============================================================================
// hg_sdf surface modifications — asymmetric (host A, modifier B) pairs
// -----------------------------------------------------------------------------
// pipe / engrave / groove / tongue. Take exactly 2 children: the host surface
// and the modifier curve/line. Not commutative — order matters.
// =============================================================================

const _opPipe = (a, b, r) => Math.hypot(a, b) - r;
const _opEngrave = (a, b, r) => Math.max(a, (a + r - Math.abs(b)) * Math.SQRT1_2);
const _opGroove = (a, b, ra, rb) => Math.max(a, Math.min(a + ra, rb - Math.abs(b)));
const _opTongue = (a, b, ra, rb) => Math.min(a, Math.max(a - ra, Math.abs(b) - rb));

// Build a 2-child op (host, modifier) that takes either {r} or {ra, rb}.
// argKeys lists what to pull from opts (e.g. ['r'] or ['ra', 'rb']).
const _makePair =
  (opFn, argKeys, defaults) =>
  (a, ...rest) => {
    const [bs, opts] = splitOpts(rest);
    if (bs.length !== 1) {
      throw new Error(`expected exactly 2 SDFs (host + modifier), got ${1 + bs.length}`);
    }
    const args = argKeys.map((k) => opts[k] ?? defaults[k]);
    const b = bs[0];
    return (p) => opFn(a.f(p), b.f(p), ...args);
  };

export const pipe = defineOpN('pipe', _makePair(_opPipe, ['r'], { r: 0.05 }));
export const engrave = defineOpN('engrave', _makePair(_opEngrave, ['r'], { r: 0.05 }));
export const groove = defineOpN(
  'groove',
  _makePair(_opGroove, ['ra', 'rb'], { ra: 0.05, rb: 0.02 }),
);
export const tongue = defineOpN(
  'tongue',
  _makePair(_opTongue, ['ra', 'rb'], { ra: 0.05, rb: 0.02 }),
);

export const negate = defineOpN('negate', (a) => (p) => -a.f(p));

export const dilate = defineOpN('dilate', (a, r) => (p) => a.f(p) - r);
export const erode = defineOpN('erode', (a, r) => (p) => a.f(p) + r);
export const shell = defineOpN('shell', (a, thickness) => (p) => Math.abs(a.f(p)) - thickness / 2);

/**
 * 轴镜像(|axis| fold):两侧都显示 child 的 +axis 半边。child 必须活在
 * 正半轴,否则两边都看不到它。Wave C 补齐:scene 层 'mirror' 域操作此前
 * 只有 CPU lambda(无 .ast),GPU 编译直接炸 — 这个 op 让它上 GPU。
 * @param axisIdx 0=x, 1=y, 2=z
 */
export const mirrorAxis = defineOpN('mirrorAxis', (a, axisIdx) => (p) => {
  const q = [...p];
  q[axisIdx] = Math.abs(q[axisIdx]);
  return a.f(q);
});

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
  const getP = (i) => {
    const val = Array.isArray(period) ? (period[i] ?? period[0]) : period;
    return val === 0 ? 1e6 : val;
  };
  const getCnt = (i) => {
    if (count === null) return null;
    return Array.isArray(count) ? (count[i] ?? count[0]) : count;
  };
  const getPad = (i) => (Array.isArray(padding) ? (padding[i] ?? padding[0]) : padding);
  const padIsZero = Array.isArray(padding) ? padding.every((v) => v === 0) : padding === 0;

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
      const pad0 = getPad(0),
        pad1 = getPad(1);
      const P0 = getP(0),
        P1 = getP(1);
      for (let n0 = -pad0; n0 <= pad0; n0++) {
        for (let n1 = -pad1; n1 <= pad1; n1++) {
          const d = a.f([p[0] - P0 * (idx[0] + n0), p[1] - P1 * (idx[1] + n1)]);
          if (d < best) best = d;
        }
      }
    } else if (dim === 3) {
      const pad0 = getPad(0),
        pad1 = getPad(1),
        pad2 = getPad(2);
      const P0 = getP(0),
        P1 = getP(1),
        P2 = getP(2);
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
      const K = opts.k != null ? opts.k : b._k != null ? b._k : defaultK;
      d1 = K * d2 + (1 - K) * d1;
    }
    return d1;
  };
});

// =============================================================================
// 2026-05-23 IQ P3 batch — XOR + displace
// Source: https://iquilezles.org/articles/distfunctions/
// =============================================================================

/**
 * XOR: in either A or B but not both. Bound (interior over-estimates).
 *   sphere(0.4).xor(box(0.5))   → the symmetric difference region
 */
export const xor = defineOpN('xor', (a, ...rest) => {
  const [bs] = splitOpts(rest);
  return (p) => {
    let acc = a.f(p);
    for (const b of bs) {
      const bd = b.f(p);
      acc = Math.max(Math.min(acc, bd), -Math.max(acc, bd));
    }
    return acc;
  };
});

/**
 * Displacement: additive perturbation. d1 = host distance, d2 = perturbation SDF.
 * Caller is responsible for keeping perturbation small (else raymarch step cap shrinks).
 *   surface.displace(noisePattern)
 */
export const displace = defineOpN('displace', (a, b) => (p) => a.f(p) + b.f(p));

// =============================================================================
// 2026-05-23 IQ P4 batch — smin variants
// Source: https://iquilezles.org/articles/smin/
// Each is a smooth-union with a different join profile. r is blend radius.
// =============================================================================

// Helper for left-fold smooth-union with a custom smin function.
const _makeSminVariant =
  (sminFn, defaultR) =>
  (a, ...rest) => {
    const [bs, opts] = splitOpts(rest);
    const r0 = opts.r ?? defaultR;
    return (p) => {
      let acc = a.f(p);
      for (const b of bs) {
        const r = b._k != null ? b._k : r0;
        acc = sminFn(acc, b.f(p), r);
      }
      return acc;
    };
  };

// Exponential smin — non-rigid, generalizes to N values.
export const unionExp = defineOpN(
  'unionExp',
  _makeSminVariant((a, b, k) => {
    k *= 1.0;
    return -k * Math.log2(Math.pow(2, -a / k) + Math.pow(2, -b / k));
  }, 0.1),
);

// Root smin — DD family, asymptotic, non-rigid.
export const unionRoot = defineOpN(
  'unionRoot',
  _makeSminVariant((a, b, k) => {
    k *= 2.0;
    const x = b - a;
    return 0.5 * (a + b - Math.sqrt(x * x + k * k));
  }, 0.1),
);

// Cubic polynomial smin — C2 smoothness, locally supported, rigid.
export const unionCubic = defineOpN(
  'unionCubic',
  _makeSminVariant((a, b, k) => {
    k *= 6.0;
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * h * k * (1 / 6);
  }, 0.1),
);

// Quartic polynomial smin — higher-order continuity.
export const unionQuartic = defineOpN(
  'unionQuartic',
  _makeSminVariant((a, b, k) => {
    k *= 16 / 3;
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * h * (4 - h) * k * (1 / 16);
  }, 0.1),
);

// Circular smin — exact-circular fillet profile.
export const unionCircular = defineOpN(
  'unionCircular',
  _makeSminVariant((a, b, k) => {
    k *= 1 / (1 - Math.sqrt(0.5));
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - k * 0.5 * (1 + h - Math.sqrt(1 - h * (h - 2)));
  }, 0.1),
);

// Circular geometrical smin — locally supported, rigid, slight over-estimate.
export const unionCircGeo = defineOpN(
  'unionCircGeo',
  _makeSminVariant((a, b, k) => {
    k *= 1 / (1 - Math.sqrt(0.5));
    const dx = Math.max(k - a, 0),
      dy = Math.max(k - b, 0);
    return Math.max(k, Math.min(a, b)) - Math.sqrt(dx * dx + dy * dy);
  }, 0.1),
);
