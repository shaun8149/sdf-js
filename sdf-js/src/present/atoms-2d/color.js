// =============================================================================
// color.js — Sprint 96: 色彩语义化 (提色 v2).
//
// 两个问题, 一个模块:
//   1. 语义色角色 — 涨跌红绿 / 风险警示 / 中性灰是「含义」不是「装饰」,
//      不能被艺术提色覆盖。此前 7 个 atoms 各自硬编码 (红绿共三种写法),
//      现在统一走 semanticColor(palette, role): 主题可经 palette.semantic
//      定制, 装裱提色 (mountPaletteOverride) 永不触碰。
//   2. 感知均匀距离 — 图表相邻 series 色的可区分性以 OKLab ΔE 度量
//      (RGB 欧氏距离在暗区/绿区严重失真), 提色去重与 series 选色共用。
//
// API:
//   SEMANTIC                        — 统一默认角色色 (此前三种红绿的收敛)
//   semanticColor(palette, role)    — 'positive'|'negative'|'warning'|'neutral'
//   rgbToOklab(rgb) / okDist(a, b)  — 感知色距
//   pickDistinct(cands, k, minDist) — 贪心选 k 个两两可区分的颜色
//   ensureContrast(rgb, bg)         — 明度对比不足时向反方向推 L
// =============================================================================

/** 统一语义角色默认色 — 主题/调用方可经 palette.semantic 覆盖。 */
export const SEMANTIC = {
  positive: [40, 160, 100], // 涨 / 达成 / 对勾
  negative: [204, 70, 60], // 跌 / 风险 / 叉
  warning: [230, 150, 40], // 警示 / 高风险 (次于 critical)
  neutral: [145, 152, 160], // 持平 / 缺省 / 停用
};

/**
 * semanticColor(palette, role) → [r,g,b]。palette.semantic[role] 优先,
 * 否则统一默认。艺术提色 (mountPaletteOverride) 只换 accent/colors,
 * semantic 角色永不被覆盖 — 这是本模块的存在理由。
 */
export function semanticColor(palette, role) {
  const c = palette?.semantic?.[role];
  return Array.isArray(c) && c.length === 3 ? c : SEMANTIC[role] || SEMANTIC.neutral;
}

/** sRGB [0..255] → OKLab [L, a, b] (L∈[0,1])。Björn Ottosson 2020。 */
export function rgbToOklab(rgb) {
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** okDist(a, b) — 两个 sRGB 颜色的 OKLab 欧氏距离 (感知均匀 ΔE)。 */
export function okDist(a, b) {
  const [l1, a1, b1] = rgbToOklab(a);
  const [l2, a2, b2] = rgbToOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * pickDistinct(candidates, k, minDist) — 按给定顺序贪心挑选至多 k 个
 * 两两 OKLab 距离 ≥ minDist 的颜色 (输入序即优先级序)。
 * 0.09 ≈ 图表相邻色域的可区分下限 (经验值)。
 */
export function pickDistinct(candidates, k = 6, minDist = 0.09) {
  const picked = [];
  for (const c of candidates) {
    if (picked.length >= k) break;
    if (picked.every((p) => okDist(p, c) >= minDist)) picked.push(c);
  }
  return picked;
}

/**
 * ensureContrast(rgb, bg, minDL) — accent 等文字/数字承载色对底色的
 * OKLab 明度差不足 minDL 时, 向远离底色的方向推 L (暗底提亮/亮底压暗),
 * 色相不动。「给每个角色找对比度达标的槽位」的最小实现。
 */
export function ensureContrast(rgb, bg, minDL = 0.22) {
  const L = rgbToOklab(rgb)[0];
  const Lbg = rgbToOklab(bg)[0];
  if (Math.abs(L - Lbg) >= minDL) return rgb;
  const darken = Lbg >= 0.5; // 亮底 → 压暗; 暗底 → 提亮
  let out = rgb.slice();
  for (let i = 0; i < 24; i++) {
    out = darken
      ? out.map((v) => Math.max(0, v * 0.92))
      : out.map((v) => Math.min(255, v * 1.08 + 6));
    if (Math.abs(rgbToOklab(out)[0] - Lbg) >= minDL) break;
  }
  return out.map((v) => Math.round(v));
}
