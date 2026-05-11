// =============================================================================
// Tyler Hobbs / Fidenza palette
// -----------------------------------------------------------------------------
// 35 个命名的 HSB 三元组 + 15 套加权采样方案（fg / bg 各一对函数）。
// HSB 范围：H 0..360, S 0..100, B 0..100（与 p5 colorMode(HSB,360,100,100) 一致）。
//
// 用法：
//   import { SCHEMES } from 'sdf-js/palette/tyler';
//   const c = SCHEMES.luxe.fg();              // → [h, s, b]
//   const bg = SCHEMES.luxe.bg(VARIANT.V6);   // → [h, s, b]
//
// 不依赖 p5；想转 RGB / CSS 用本文件下面的 hsbToRgb / hsbToCss。
// =============================================================================

// ---- 颜色转换 -------------------------------------------------------------

// HSB → RGB（0-255）
export function hsbToRgb([h, s, b]) {
  s /= 100; b /= 100;
  const f = (n, k = (n + h / 60) % 6) => b * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

// HSB → CSS 字符串 'rgb(r,g,b)'
export function hsbToCss(hsb) {
  const [r, g, b] = hsbToRgb(hsb);
  return `rgb(${r},${g},${b})`;
}

// ---- 随机辅助 -------------------------------------------------------------

// 高斯采样（Box-Muller）—— Tyler 的 gssn
export function gaussian(mean = 0, std = 1, rng = Math.random) {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * std + mean;
}

// 加权选择：[item, weight, item, weight, ...] → item
// Tyler 的 wc()。权重不要求归一化，函数内累加。
export function wc(entries, rng = Math.random) {
  let total = 0;
  for (let i = 1; i < entries.length; i += 2) total += entries[i];
  let pick = rng() * total;
  let acc = 0;
  for (let i = 0; i < entries.length; i += 2) {
    acc += entries[i + 1];
    if (pick <= acc) return entries[i];
  }
  return entries[entries.length - 2];
}

// Bernoulli：随机布尔，概率 p
export const od = (p, rng = Math.random) => rng() < p;

// ---- 35 个命名颜色 [H, S, B] ----------------------------------------------

export const wht           = [40,  2,  98];
export const dRed          = [358, 64, 86];
export const red           = [358, 80, 82];
export const tan           = [25,  40, 88];
export const midTan        = [25,  40, 60];
export const orng          = [25,  78, 90];
export const pOrng         = [25,  68, 93];
export const pYllw         = [43,  60, 99];
export const yllw          = [43,  90, 99];
export const pnk           = [11,  35, 97];
export const pPnk          = [12,  18, 97];
export const xGrn          = [125, 55, 55];
export const grn           = [170, 75, 65];
export const pGrn          = [170, 35, 80];
export const ppGrn         = [160, 15, 85];
export const pppGrn        = [160, 10, 90];
export const ppYllwGrn     = [125, 12, 90];
export const ppBlue        = [200, 15, 90];
export const pBlue         = [200, 35, 75];
export const blue          = [210, 65, 55];
export const dBlue         = [220, 65, 35];
export const ddBlue        = [225, 65, 20];
export const bgrndDBlue    = [225, 60, 25];
export const paleIndigo    = [220, 35, 75];
export const lavender      = [260, 14, 88];
export const pBrwn         = [28,  42, 39];
export const brwn          = [25,  45, 33];
export const dBrwn         = [25,  45, 23];
export const ddBrwn        = [25,  45, 13];
export const nwsprnt       = [40,  12, 88];
export const bgrndNws      = [40,  8,  92];
export const blk           = [0,   0,  10];

// ---- 变体常量（Tyler 的 V1..V7）------------------------------------------

export const VARIANT = { V1: 1, V2: 2, V3: 3, V4: 4, V5: 5, V6: 6, V7: 7 };

// =============================================================================
// 调色方案 —— 每套提供 fg() / bg(variant) 两个函数
// 比例数字直接搬 Tyler 原文，权重和不要求等于 1
// =============================================================================

// Luxe —— Fidenza 默认主配色（出现概率 55%）
export const luxe = () => wc([
  dRed, .05, red, .03, nwsprnt, .12, orng, .02, pYllw, .06,
  yllw, .06, pnk, .03, grn, .04, ppGrn, .18, ddBlue, .02, dBlue, .05,
  blue, .05, pBlue, .03, brwn, .17, dBrwn, .09, ddBrwn, .03,
]);
export const luxeBg = (variant = VARIANT.V5) => {
  if (variant >= VARIANT.V6) return wc([ddBlue, .19, bgrndNws, .3, ppGrn, .15, pBlue, .05, pnk, .1, blue, .1, grn, .05, dRed, .05, pYllw, .01]);
  if (variant >= VARIANT.V4) return wc([bgrndNws, .6, pBlue, .15, pppGrn, .1, pPnk, .1, bgrndDBlue, .05]);
  return wc([bgrndNws, .9, bgrndDBlue, .07, pppGrn, .03]);
};

// Luxe Dominant —— 两个主色重压（pcLxD1/pcLxD2 + pcLx 混合）
const luxeD1 = () => wc([dRed, .1, pYllw, .08, pnk, .13, grn, .2, ppGrn, .16, dBlue, .01, blue, .24, pBlue, .1, brwn, .02]);
const luxeD2 = () => wc([dRed, .12, red, .1, nwsprnt, .04, orng, .05, pYllw, .1, yllw, .14, pnk, .11, grn, .13, ppGrn, .05, dBlue, .01, blue, .12, pBlue, .05]);
export const makeLuxeDominant = () => {
  // 抽两个不同的主色，做加权 picker
  const c1 = luxeD1();
  let c2 = luxeD2();
  while (c2 === c1) c2 = luxeD2();
  const weights = [.6, .12, .1, .05, .03, .01, .01, .01, .01, .01, .01, .01, .01, .01, .01];
  const entries = [c1, weights[0], c2, weights[1]];
  for (let i = 2; i < 15; i++) {
    entries.push(luxe(), weights[i]);
  }
  return () => wc(entries);
};

// Rad
export const rad = () => wc([
  wht, .6, dRed, .05, red, .02, nwsprnt, .05, orng, .05,
  pYllw, .05, yllw, .03, ppGrn, .01, blue, .01, pBlue, .04, brwn, .09,
]);
export const radBg = () => bgrndNws;

// Baked
export const baked = () => wc([
  wht, .2, pnk, .05, pPnk, .1, xGrn, .5, ppYllwGrn, .1, pBrwn, .05,
]);
export const bakedBg = () => bgrndNws;

// Cool
export const cool = () => wc([
  nwsprnt, .13, pYllw, .01, lavender, .03, grn, .1, pppGrn, .04,
  ppGrn, .04, ddBlue, .11, dBlue, .15, blue, .25, pBlue, .1,
  brwn, .01, dBrwn, .04, ddBrwn, .02,
]);
export const coolBg = (variant = VARIANT.V5) => {
  if (variant >= VARIANT.V6) return wc([bgrndNws, .5, bgrndDBlue, .3, pnk, .15, blue, .05]);
  return wc([bgrndNws, .8, bgrndDBlue, .12, blue, .06, pPnk, .02]);
};

// Black
export const black = () => wc([bgrndNws, .15, blk, .85]);
export const blackBg = () => bgrndNws;

// Politique
export const politique = () => wc([wht, .58, dRed, .02, pYllw, .2, pnk, .15, blue, .05]);
export const politiqueBg = (variant = VARIANT.V5) => {
  if (variant >= VARIANT.V6) return wc([bgrndNws, .5, ppBlue, .5]);
  return wc([bgrndNws, .8, ppBlue, .2]);
};

// Retro
export const retro = () => wc([dRed, .07, red, .03, pOrng, .05, pYllw, .02, yllw, .15, brwn, .1, dBrwn, .58]);
export const retroBg = () => wc([nwsprnt, .7, pBlue, .2, wht, .1]);

// White Mono
export const whtMono = () => wht;
export const whtMonoBg = () => wc([
  dRed, .1, red, .1, nwsprnt, .01, orng, .1, pYllw, .04, yllw, .05,
  pnk, .1, grn, .1, ddBlue, .1, dBlue, .1, blue, .1,
  dBrwn, .02, ddBrwn, .02, blk, .09,
]);

// AM
export const am = () => wc([
  [260, 20, 20], .77, [240, 30, 35], .03, [300, 10, 50], .05,
  [180, 20, 30], .06, [130, 20, 70], .05, [5, 10, 80], .02,
  [5, 40, 90], .01, [40, 25, 90], .01,
]);
export const amBg = () => [260, 30, 30];

// Dark Lifestyle
export const darkLifestyle = () => wc([
  [0, 0, 13], .2, [0, 0, 16], .48, [0, 0, 19], .2,
  [0, 0, 22], .1, [0, 0, 25], .02,
]);
export const darkLifestyleBg = () => [0, 0, 10];

// Party Girl
export const partyGirl = () => [350, gaussian(65, 4), gaussian(85, 4)];
export const partyGirlBg = () => [225, 70, 20];

// White on Cream
export const whtOnCrm = () => wht;
export const whtOnCrmBg = () => bgrndNws;

// Golf Socks
export const golfSocks = () => wc([
  bgrndNws, .41, [210, 72, 45], .15, [210, 72, 30], .05,
  [0, 40, 95], .07, [6, 20, 95], .05, [130, 50, 30], .2,
  [32, 30, 99], .04, [32, 30, 30], .03,
]);
export const golfSocksBg = () => [130, 20, 50];

// Rose
export const rose = () => wc([
  [150, 8, 40], .5, [160, 12, 25], .05, [350, 60, 90], .05,
  [350, 45, 80], .05, [350, 80, 70], .05, [6, 16, 100], .2, [15, 26, 97], .1,
]);
export const roseBg = () => [150, 8, 30];

// =============================================================================
// 综合 SCHEMES 映射 + Fidenza 原版的权重抽签
// =============================================================================

export const SCHEMES = {
  luxe:           { fg: luxe,           bg: luxeBg },
  cool:           { fg: cool,           bg: coolBg },
  baked:          { fg: baked,          bg: bakedBg },
  rad:            { fg: rad,            bg: radBg },
  politique:      { fg: politique,      bg: politiqueBg },
  retro:          { fg: retro,          bg: retroBg },
  black:          { fg: black,          bg: blackBg },
  whtMono:        { fg: whtMono,        bg: whtMonoBg },
  am:             { fg: am,             bg: amBg },
  darkLifestyle:  { fg: darkLifestyle,  bg: darkLifestyleBg },
  partyGirl:      { fg: partyGirl,      bg: partyGirlBg },
  whtOnCrm:       { fg: whtOnCrm,       bg: whtOnCrmBg },
  golfSocks:      { fg: golfSocks,      bg: golfSocksBg },
  rose:           { fg: rose,           bg: roseBg },
};

// Fidenza 原版的方案抽签（55% luxe，其他各几个百分点）
export function pickScheme(rng = Math.random) {
  const name = wc([
    'luxe',      .55,
    'golfSocks', .10,
    'rad',       .09,
    'baked',     .05,
    'politique', .05,
    'whtMono',   .04,
    'am',        .03,
    'rose',      .02,
    'black',     .02,
    'cool',      .01,
    'whtOnCrm',  .01,
    'partyGirl', .01,
    'darkLifestyle', .01,
    'luxe',      .01,  // luxeDominant 在原版独立处理；这里保 luxe 兜底
  ], rng);
  return SCHEMES[name];
}
