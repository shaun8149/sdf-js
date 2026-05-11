// =============================================================================
// BOB pigments —— 仙人掌场景里那两套 hex 调色板
// -----------------------------------------------------------------------------
// 来源：BOB 原版 sketch.js 的 pigments 数组（两组高对比交错色），painted 风格
// 渲染按 layer 索引交替使用：偶数层用 PIGMENTS，奇数层用 PIGMENTS_2。
//
// 用法：
//   import * as bob from 'sdf-js/palette/bob';
//   const pal = bob.shuffled(bob.PIGMENTS);
//   const c = pal[(colorBase + layer) % pal.length];
//
// 颜色直接是 CSS hex 字符串，不依赖任何 colorMode。
// =============================================================================

// 12 色，偏暖且分散（红 / 粉紫 / 青 / 黄 / 绿 / 紫 / 深绿 / 亮绿 / 深绿 / 黄绿 / 浅蓝 / 米白）
export const PIGMENTS = [
  '#e44d36', '#d999cb', '#12a29b', '#f7d923', '#159014', '#713c97',
  '#0e5f4a', '#229d38', '#103731', '#b6d611', '#78b9c8', '#ede0df',
];

// 11 色，偏冷且更高对比（绿 / 深蓝 / 蓝 / 红 / 亮黄 / 深绿 / 橙 / 金黄 / 紫红 / 玫红 / 翠绿）
export const PIGMENTS_2 = [
  '#09931e', '#002baa', '#1c77c3', '#ff2702', '#feec00', '#236846',
  '#ff6900', '#fcd300', '#a3023b', '#f20256', '#0aa922',
];

// 两套合并，方便统一抽样
export const ALL = [...PIGMENTS, ...PIGMENTS_2];

// ---- 工具函数 -------------------------------------------------------------

// Fisher-Yates 洗牌（原地）
export function shuf(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 返回打乱副本（不改原数组）
export function shuffled(arr, rng = Math.random) {
  return shuf([...arr], rng);
}

// 随机抽一个
export function pick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

// 按 colorBase + offset 索引（painted 风格典型用法）
export const indexAt = (arr, colorBase, offset = 0) =>
  arr[((colorBase + offset) % arr.length + arr.length) % arr.length];
