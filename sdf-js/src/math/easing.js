// =============================================================================
// easing —— 缓动函数库（纯 JS，无 p5 / Genify 依赖）
// -----------------------------------------------------------------------------
// 所有函数都是 (t: [0,1]) → [0,1]，少数 arch / bellCurve 输出会 ≤ 1（峰在中间）。
// =============================================================================

const PI = Math.PI;
const c4 = (2 * PI) / 3;
const c5 = (2 * PI) / 4.5;

// ---- 基本 ----------------------------------------------------------------

export const linear = (t) => t;
export const flip   = (t) => 1 - t;

// ---- smoothStart / smoothStop（加速 / 减速） ------------------------------

export const smoothStart2 = (t) => t * t;
export const smoothStart3 = (t) => t * t * t;
export const smoothStart4 = (t) => t * t * t * t;
export const smoothStart5 = (t) => t * t * t * t * t;
export const smoothStart6 = (t) => t * t * t * t * t * t;

export const smoothStop2 = (t) => 1 - (1 - t) ** 2;
export const smoothStop3 = (t) => 1 - (1 - t) ** 3;
export const smoothStop4 = (t) => 1 - (1 - t) ** 4;
export const smoothStop5 = (t) => 1 - (1 - t) ** 5;
export const smoothStop6 = (t) => 1 - (1 - t) ** 6;

// ---- 混合 / smoothStep ---------------------------------------------------

export const mix = (fn, gn, weightB, t) => fn(t) * weightB + gn(t) * (1 - weightB);
export const crossfade = (fn, gn, t) => mix(fn, gn, t, t);

export const smoothStep2 = (t) => crossfade(smoothStart2, smoothStop2, t);
export const smoothStep3 = (t) => crossfade(smoothStart3, smoothStop3, t);
export const smoothStep4 = (t) => crossfade(smoothStart4, smoothStop4, t);
export const smoothStep5 = (t) => crossfade(smoothStart5, smoothStop5, t);
export const smoothStep6 = (t) => crossfade(smoothStart6, smoothStop6, t);

// ---- Arch / Bell（峰在中间）---------------------------------------------

export const arch2            = (t) => t * (1 - t);
export const smoothStartArch3 = (t) => t * t * (1 - t);
export const smoothStopArch3  = (t) => t * (1 - t) * (1 - t);
export const smoothStepArch4  = (t) => t * t * (1 - t) * (1 - t);
export const smoothStartArch4 = (t) => t * t * t * (1 - t);
export const smoothStopArch4  = (t) => t * (1 - t) * (1 - t) * (1 - t);
export const bellCurve6       = (t) => smoothStartArch3(t) * smoothStopArch3(t);

// ---- Bezier ---------------------------------------------------------------

export const normalizeBezier = (B, C, t) => {
  const s = 1 - t;
  return 3 * s * s * t * B + 3 * s * t * t * C + t * t * t;
};
export const createNormalizeBezier = (B, C) => (t) => normalizeBezier(B, C, t);

/**
 * 7-阶 normalized Bezier。控制点 B..G 是中间 5 个 anchor 值；起点固定为 0,
 * 终点固定为 1。值可以超过 [0,1]，用于 overshoot 效果。
 */
export const normalizedBezier7 = (B, C, D, E, F, G, t) => {
  const s = 1 - t;
  const t2 = t * t,   s2 = s * s;
  const t3 = t2 * t,  s3 = s2 * s;
  const t4 = t2 * t2, s4 = s2 * s2;
  const t5 = t3 * t2, s5 = s3 * s2;
  const t6 = t3 * t3, s6 = s3 * s3;
  const t7 = t3 * t2 * t2;
  return 7 * B * s6 * t + 21 * C * s5 * t2 + 35 * D * s4 * t3
       + 35 * E * s3 * t4 + 21 * F * s2 * t5 + 7 * G * s * t6 + t7;
};
export const partialBezier7 = (B, C, D, E, F, G) =>
  (t) => normalizedBezier7(B, C, D, E, F, G, t);

// ---- Bounce ---------------------------------------------------------------

export const smoothStopBounce = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1)   return n1 * x * x;
  if (x < 2 / d1) { x -= 1.5 / d1;   return n1 * x * x + 0.75; }
  if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
                    x -= 2.625 / d1;  return n1 * x * x + 0.984375;
};
export const smoothStartBounce = (x) => 1 - smoothStopBounce(1 - x);
export const smoothStepBounce  = (x) =>
  x < 0.5
    ? (1 - smoothStopBounce(1 - 2 * x)) / 2
    : (1 + smoothStopBounce(2 * x - 1)) / 2;

// ---- Elastic --------------------------------------------------------------

export const smoothStartElastic = (x) =>
  x === 0 ? 0 : x === 1 ? 1
    : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4);
export const smoothStopElastic = (x) =>
  x === 0 ? 0 : x === 1 ? 1
    : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
export const smoothStepElastic = (x) =>
  x === 0 ? 0 : x === 1 ? 1
    : x < 0.5
      ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
      :  (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;

// ---- 工具 -----------------------------------------------------------------

// 所有 0→0、1→1 的"全程"缓动函数集合（不含 arch / bellCurve）
export const ALL = {
  linear,
  smoothStart2, smoothStart3, smoothStart4, smoothStart5, smoothStart6,
  smoothStop2,  smoothStop3,  smoothStop4,  smoothStop5,  smoothStop6,
  smoothStep2,  smoothStep3,  smoothStep4,  smoothStep5,  smoothStep6,
  smoothStartBounce, smoothStopBounce, smoothStepBounce,
  smoothStartElastic, smoothStopElastic, smoothStepElastic,
};

// 随机抽一个 easing 函数
export function pickRandom(rng = Math.random) {
  const keys = Object.keys(ALL);
  return ALL[keys[Math.floor(rng() * keys.length)]];
}
