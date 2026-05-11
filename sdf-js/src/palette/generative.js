// =============================================================================
// generative —— (i, j) 坐标系颜色生成器
// -----------------------------------------------------------------------------
// 用一个 2D 坐标 (i, j) 在 0..Xmax × 0..Ymax 范围内反查颜色。
//   i 控制色相（沿色相轴）
//   j 控制亮度（沿亮度轴）
//
// 核心 trick：
//   1. 先以纯饱和色取 HSV → RGB
//   2. 与"反相亮度灰"做平均（HSV 不同色相的固有亮度不同 —— 黄亮、蓝暗 ——
//      这步是个手工感知均匀化）
//   3. RGB → HSL，按 i 位置做 saturation 局部缩放（黄绿区 / 蓝紫区降饱和、
//      绿/红紫区补饱和，补偿 HSL 色相不均匀）
//   4. 按 j 位置做 lightness 重映射（j=50 是基准，向 0/100 双向拉到极值）
//   5. HSL → RGB 输出
//
// 不依赖 p5。
// =============================================================================

// ---- 颜色空间转换 ---------------------------------------------------------

// HSV(h:0-360, s:0-1, v:0-1) → RGB(0-1)
export function hsvToRgb(h, s, v) {
  const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  return [f(5), f(3), f(1)];
}

// RGB(0-255) → HSL(h:0-360, s:0-100, l:0-100)
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h, s;
  if (max === min) {
    h = 0; s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

// HSL(h:0-360, s:0-100, l:0-100) → RGB(0-255)
export function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h)       * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

// RGB → CSS 字符串
export const rgbToCss = ([r, g, b]) => `rgb(${r|0},${g|0},${b|0})`;

// ---- 核心：从 (i, j) 坐标生成颜色 -----------------------------------------

/**
 * @param {number} i  - 色相位置（0..Xmax）
 * @param {number} j  - 亮度位置（0..Ymax）
 * @param {number} Xmax  - i 的最大值，默认 100
 * @param {number} Ymax  - j 的最大值，默认 100
 * @returns {[number, number, number]}  RGB（0-255）
 */
export function generateColor(i, j, Xmax = 100, Ymax = 100) {
  // 1. 纯饱和 HSV 取 RGB
  const theHue = (i / Xmax) * 360;
  let [r, g, b] = hsvToRgb(theHue, 1, 1);
  r *= 255; g *= 255; b *= 255;

  // 2. 与反相亮度灰平均（感知均匀化）
  const bright = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const gray = 255 - bright;
  r = (r + gray) / 2;
  g = (g + gray) / 2;
  b = (b + gray) / 2;

  // 3. RGB → HSL
  let [hh, ss, ll] = rgbToHsl(r, g, b);

  // 4. 按色相位置（x）做局部饱和缩放
  const x = i * 100 / Xmax;
  if (x >= 20 && x < 35) ss *= 1 - (x - 20) / 15;
  if (x >= 35 && x <= 50) ss *= (x - 35) / 15;
  if (x >= 60 && x < 80) ss *= 1 - 0.5 * (x - 60) / 20;
  if (x >= 80 && x <= 100) ss *= 0.5 + 0.5 * (x - 80) / 20;

  // 5. 按亮度位置（jp）做 lightness 重映射
  //    jp <= 50：从 0 拉到 ll 原值（暗端往下推到 0）
  //    jp > 50：从 ll 原值拉到 100（亮端往上推到 100）
  const jp = j * 100 / Ymax;
  if (jp <= 50) {
    const limit = ll;
    ll = (jp / 50) * limit;
  } else if (jp > 50 && jp < 100) {
    const limit = 100 - ll;
    ll = ll + (jp - 50) / 50 * limit;
  }

  // 6. 角落补偿：x∈[12,18]∪[18,24] × j∈[60,80] 额外饱和度微调
  if (x >= 12 && x <= 18 && jp >= 60 && jp <= 80) {
    ss *= 1 - 0.25 * (x - 12) / 6;
  }
  if (x > 18 && x <= 24 && jp >= 60 && jp <= 80) {
    ss *= 0.85 + 0.15 * (x - 18) / 6;
  }

  // 7. HSL → RGB
  return hslToRgb(hh, ss, ll);
}

// ---- 色域采样窗口（在 (i, j) 平面上抽样不同区域）-------------------------

const R = (a, b, rng = Math.random) => a + (b - a) * rng();
const Ri = (a, b, rng = Math.random) => Math.floor(R(a, b + 1, rng));

// 中间饱和色：y∈[40,86]，x 限制在分散区
export function definingColor(rng = Math.random) {
  const y = Math.floor(R(40, 86, rng));
  let x;
  if (y >= 80) x = Ri(10, 36, rng);
  else if (y >= 50) x = Ri(0, 61, rng);
  else if (rng() > 0.33) x = Ri(40, 61, rng);
  else if (rng() > 0.5) x = Ri(0, 6, rng);
  else x = Ri(95, 101, rng);
  return generateColor(x, y, 100, 100);
}

// 最饱和：y=50 固定，x 自由
export function definingPerfect(rng = Math.random) {
  return generateColor(R(1, 41, rng), 50, 100, 100);
}

// 浅色背景
export function definingWhiteBackground(rng = Math.random) {
  return generateColor(Ri(0, 61, rng), Ri(80, 90, rng), 100, 100);
}

// 深色背景
export function definingBlackBackground(rng = Math.random) {
  return generateColor(Ri(0, 61, rng), Ri(15, 25, rng), 100, 100);
}

// 高亮（更白）
export function definingWhite(rng = Math.random) {
  return generateColor(Ri(0, 61, rng), Ri(95, 99, rng), 100, 100);
}

// 低亮（更黑）
export function definingBlack(rng = Math.random) {
  return generateColor(Ri(0, 61, rng), Ri(5, 10, rng), 100, 100);
}

// 中间区背景（亮度 15-60 的"日常"区）
export function definingBackground(rng = Math.random) {
  const y = Ri(15, 61, rng);
  let x;
  if (y >= 15 && y < 20) x = Ri(10, 36, rng);
  else if (y >= 20 && y < 50) x = Ri(0, 61, rng);
  else if (rng() > 0.33) x = Ri(40, 61, rng);
  else if (rng() > 0.5) x = Ri(0, 6, rng);
  else x = Ri(95, 101, rng);
  return generateColor(x, y, 100, 100);
}

// 红：y=40，x∈[94,95]
export function definingRed(rng = Math.random) {
  return generateColor(Ri(94, 95, rng), 40, 100, 100);
}

// ---- palette 构建器 -------------------------------------------------------

// 沿 y=50 等距采样 num 个色相，再 + 几个对比色
export function definingPerfectGroup(num = 10) {
  const cs = [];
  const step = 64 / num;
  for (let x = 0; x < 64; x += step) {
    cs.push(generateColor(x, 50, 100, 100));
  }
  cs.push(definingBlackBackground());
  cs.push(definingBlackBackground());
  cs.push(definingWhiteBackground());
  cs.push(definingWhiteBackground());
  cs.push(definingWhiteBackground());
  return cs;
}

// 中间饱和色 N 个 + 1 黑 + 6 白
export function definingColorGroup(num = 10, rng = Math.random) {
  const cs = [];
  for (let i = 0; i < num; i++) cs.push(definingColor(rng));
  cs.push(definingBlackBackground(rng));
  for (let i = 0; i < 6; i++) cs.push(definingWhiteBackground(rng));
  return cs;
}

// 浅色背景 N 个 + 5 中间饱和色
export function definingWhiteBackGroup(num = 10, rng = Math.random) {
  const cs = [];
  for (let i = 0; i < num; i++) cs.push(definingWhiteBackground(rng));
  for (let i = 0; i < 5; i++) cs.push(definingColor(rng));
  return cs;
}

// 白色 N 个 + 5 中间饱和色
export function definingWhiteGroup(num = 10, rng = Math.random) {
  const cs = [];
  for (let i = 0; i < num; i++) cs.push(definingWhite(rng));
  for (let i = 0; i < 5; i++) cs.push(definingColor(rng));
  return cs;
}

// 黑色 N 个 + 2 浅色背景 + 2 中间色
export function definingBlackGroup(num = 10, rng = Math.random) {
  const cs = [];
  for (let i = 0; i < num; i++) cs.push(definingBlack(rng));
  for (let i = 0; i < 2; i++) cs.push(definingWhiteBackground(rng));
  for (let i = 0; i < 2; i++) cs.push(definingColor(rng));
  return cs;
}

// 红色族 N 个
export function definingRedGroup(num = 5, rng = Math.random) {
  const cs = [];
  for (let i = 0; i < num; i++) cs.push(definingRed(rng));
  return cs;
}

// ---- 已 generator：固定色相 i，亮度从 0% 到 100% 的 n 个色 ----------------

/**
 * 无限 generator：按固定 hue (i)、亮度从 100/n 到 100 的 n 个色循环 yield。
 * 用 `next().value` 拿下一个色。配合 Alice / Harvey Rayner 风格的笔触色循环。
 */
export function* nColor(i, n) {
  while (true) {
    for (let k = 0; k < n; k++) {
      yield generateColor(i, (k + 1) * 100 / n, 100, 100);
    }
  }
}

// ---- ColorGenerator class —— Alice 风格的"色板序列器" ---------------------

/**
 * 预生成一组色板，按 colorBase 顺序读取（getColor / getBLACK / getWHITE 各自一个游标）。
 *
 * 跟 Tyler 的"每次随机抽"和 generative 的"窗口随机"都不同 —— 这里是确定性的、
 * 可循环的色彩序列，配合 Alice 那种"线性扫描 tile 网格、每格用下一色"很自然。
 *
 * 参数解释（沿用 Alice 原版）：
 *   scale  (N): 色相平面上的覆盖密度倍数，影响序列长度（更大 = 更多过渡色）
 *   range  (M): 色相扫过多少跨度（M=2 ≈ 20% 色相、M=5 ≈ 50%）
 *   offset:    起始色相位置（0..100）
 *   rng:       随机源；只用于决定"左转还是右转"（左转色域更广 [90·N]，右转更紧 [60·N]）
 */
export class ColorGenerator {
  constructor() {
    this.colorSet = [];
    this.BLACK = [];
    this.WHITE = [];
    this.colorIdx = 0;
    this.blackIdx = 0;
    this.whiteIdx = 0;
  }

  /**
   * 构造调色板。需要先调一次再 getColor。
   * @param {number} [scale=1]  N，色相平面覆盖密度
   * @param {number} [range=2]  M，色相扫描跨度
   * @param {number} [offset=0] 起始色相
   * @param {()=>number} [rng=Math.random]
   */
  create(scale = 1, range = 2, offset = 0, rng = Math.random) {
    const N = scale, M = range;
    const buildHues = (count) =>
      Array.from({ length: count }, (_, idx) => {
        const hue = (offset + (idx / count) * 10 * M) % 100;
        return generateColor(hue, 50, 100, 100);
      });

    if (rng() < 0.33) {
      // "右转"：60·N 色，BLACK/WHITE 用对应色相区
      this.colorSet = buildHues(60 * N);
      const baseHue = 0;
      this.BLACK = Array.from({ length: 20 }, (_, idx) => {
        const lightness = 17 + (idx / 20) * (3 - 17);
        return generateColor(baseHue, lightness, 100, 100);
      });
      this.WHITE = Array.from({ length: 20 }, (_, idx) => {
        const lightness = 83 + (idx / 20) * (97 - 83);
        return generateColor(baseHue, lightness, 100, 100);
      });
    } else {
      // "左转"：90·N 色（更宽序列），BLACK/WHITE 用反向色相区
      this.colorSet = buildHues(90 * N);
      const baseHue = 10 * M;
      this.BLACK = Array.from({ length: 20 }, (_, idx) => {
        const lightness = 25 + (idx / 20) * (10 - 25);
        return generateColor(baseHue, lightness, 100, 100);
      });
      this.WHITE = Array.from({ length: 20 }, (_, idx) => {
        const lightness = 85 + (idx / 20) * (90 - 85);
        return generateColor(baseHue, lightness, 100, 100);
      });
    }
    this.colorIdx = this.blackIdx = this.whiteIdx = 0;
    return this;
  }

  getColor()  { return this.colorSet[this.colorIdx++ % this.colorSet.length]; }
  getBlack()  { return this.BLACK[this.blackIdx++   % this.BLACK.length]; }
  getWhite()  { return this.WHITE[this.whiteIdx++   % this.WHITE.length]; }
}
