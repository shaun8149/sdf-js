// =============================================================================
// bobStipple —— BOB-style 点彩渲染（canvas 2D，无 p5，单 shot）
// -----------------------------------------------------------------------------
// 跟 painted.js 的关系：painted.js 是 p5 + generator 的渐进式动画版本，
// 用 BOB 的两套 palette 交替着色。bobStipple 是它的 canvas 2D 静态版本，
// 保留 BOB 的核心点彩 mechanism（嵌套网格 + Perlin bend + 多层叠绘笔触），
// 但**颜色用 LLM 在 layers 里指定的 RGB**（不是 BOB 的两套调色板交替）。
//
// 接口与 silhouette 完全一致：bobStipple(ctx, layers, options)
//
// Mechanism:
//   1. 把画布切成 bigDIM × bigDIM 大块，每块再切 cellcount² 小 cell
//   2. 每个 cell 位置用 Perlin noise 做 bend（手绘化网格）
//   3. 对每个 cell 找到命中的 top-most layer，用其颜色画 N 个叠绘笔触
//   4. 每个笔触 = 不规则 n 边形（n=2 退化为椭圆），用 Catmull-Rom 闭合曲线
//
// 性能：典型 640×640 + cellSize 4-8px → 数十万 brush 调用，~1-3 秒（同步）
// =============================================================================

import { createPerlin } from '../field/noise.js';
import { SDF3 } from '../sdf/core.js';
import { makeProbe, createCamera } from '../sdf/probe.js';

// ---- helpers ---------------------------------------------------------------

const rgbStr = (c) =>
  `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// ---- HSL helpers (for color spread) ----------------------------------------

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpColor = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

// 从 base 色生成 5 色 palette。spread=0 → 全部 base（mono）；spread=1 → 完全展开。
// complementWeight 单独控制互补色（震颤感的关键）。
function expandColorPalette(base, spread, complementWeight) {
  if (spread === 0) {
    const s = rgbStr(base);
    return [{ rgb: base, style: s }, { rgb: base, style: s }, { rgb: base, style: s }, { rgb: base, style: s }, { rgb: base, style: s }];
  }
  const [h, s, l] = rgbToHsl(base[0], base[1], base[2]);
  const variations = [
    base,                                                       // 0: base
    hslToRgb((h + 1 / 24) % 1, s, l),                           // 1: +15° hue (analogous +)
    hslToRgb((h - 1 / 24 + 1) % 1, s, l),                       // 2: -15° hue (analogous -)
    hslToRgb((h + 0.5) % 1, s * 0.3, l),                        // 3: complement, low sat
    hslToRgb(h, s, Math.max(0, l - 0.15)),                      // 4: darkened
  ];
  // Lerp base→variation by spread；3 号 (complement) 单独乘 complementWeight
  const finalColors = variations.map((v, i) => {
    const t = (i === 3) ? spread * complementWeight : spread;
    return i === 0 ? base : lerpColor(base, v, t);
  });
  return finalColors.map(rgb => ({ rgb, style: rgbStr(rgb) }));
}

function makeBgFn(bg, view) {
  if (typeof bg === 'function') return bg;
  if (Array.isArray(bg)) return () => bg;
  if (bg && bg.top && bg.bottom) {
    const { top, bottom } = bg;
    return (_wx, wy) => {
      const t = (wy + view) / (2 * view); // 0(底) → 1(顶)
      return [
        bottom[0] + (top[0] - bottom[0]) * t,
        bottom[1] + (top[1] - bottom[1]) * t,
        bottom[2] + (top[2] - bottom[2]) * t,
      ];
    };
  }
  return () => [255, 255, 255];
}

// Mulberry32 PRNG (与 noise.js 同算法但用 closure 状态)
function makeRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller Gaussian
function makeGaussian(rng) {
  return (mean = 0, std = 1) => {
    const u1 = rng() || 1e-9;
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  };
}

// Catmull-Rom (tension 0.5) 闭合曲线 → canvas Bezier 近似
// 等价于 p5 的 curveVertex 前后补 control 的闭合 trick
function fillCatmullRomClosed(ctx, verts) {
  const n = verts.length;
  if (n < 3) return;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = verts[(i - 1 + n) % n];
    const p1 = verts[i];
    const p2 = verts[(i + 1) % n];
    const p3 = verts[(i + 2) % n];
    // Catmull-Rom → Bezier，tension 0.5 → divisor 6
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    if (i === 0) ctx.moveTo(p1[0], p1[1]);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
  }
  ctx.closePath();
  ctx.fill();
}

// 单个笔触：n=2 椭圆 / n≥3 不规则圆形
function drawBrush(ctx, cx, cy, r, n, rng, gaussian) {
  if (n === 2) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const verts = [];
  const randomStart = rng() * Math.PI;
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n + randomStart;
    verts.push([
      cx + Math.cos(angle) * r * gaussian(1, 0.1),
      cy + Math.sin(angle) * r * gaussian(1, 0.1),
    ]);
  }
  fillCatmullRomClosed(ctx, verts);
}

// ---- main ------------------------------------------------------------------

/**
 * BOB-style 点彩渲染。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{sdf, color: [r,g,b]}>} layers - 数组顺序 = 从底到顶
 * @param {object} [options]
 * @param {number}  [options.view=1.2]
 * @param {*}       [options.background]   - 同 silhouette
 * @param {boolean} [options.flipY=true]
 * @param {number}  [options.seed=42]      - Perlin + RNG seed
 * @param {number}  [options.maxSize=2048] - BOB 缩放基准
 * @param {number}  [options.middleScaleSize=6] - log2 大块尺寸（6 → 64px）
 * @param {number}  [options.smallScaleSize=3]  - log2 cell 尺寸（3 → 8px）
 * @param {number}  [options.middleRotate=0.0015]
 * @param {number}  [options.brushLayers=5]     - 每 cell 叠绘笔触数
 * @param {number}  [options.smallOffset=4]     - 笔触位置抖动（像素）
 * @param {number}  [options.smallSegs=5]       - 笔触多边形顶点（2=椭圆）
 * @param {number}  [options.noiseScale=0.04]
 * @param {number}  [options.rH=0.6]            - 层间横向偏移
 * @param {number}  [options.rV=0]              - 层间纵向偏移
 * @param {number}  [options.gap=0.75]          - 笔触半径 / cellSize
 * @param {number}  [options.sdfThreshold=-0.001]
 * @param {boolean} [options.stippleBackground=true] - 背景也参与点彩（BOB
 *   原版行为：每个 cell 都画笔触，未命中 SDF 时用 bg 颜色采样。关掉
 *   就是 "subject 上点彩 + 背景平涂"的混合模式。
 * @param {number}  [options.colorSpread=0]  - 0=单色 mono / 1=完全 HSL 展开
 *   (BOB-like 震颤优化色)。每个 LLM 色派生 5 色 palette（+/-15° hue / 互补 /
 *   暗化），按 brushLayer 循环取。**只在 colorPalette=null 时生效**。
 * @param {number}  [options.complementWeight=0.5] - 互补色独立权重（0=无 / 1=最强）
 * @param {[number,number,number][]} [options.colorPalette=null] - 显式调色板（RGB 数组）。
 *   非 null 时**完全覆盖 LLM 颜色**，按 BOB 原版 `(colorBase + layerIdx) % len` 取色。
 *   每个 SDF 层 N 自动得到 colorBase = (N+1)*3+1，背景 colorBase = 0。
 * @param {[number,number,number][]} [options.colorPalette2=null] - 第二调色板。
 *   设置后 brush 奇数层用 palette2（BOB 两套交替）。null = 单 palette。
 */
export function bobStipple(ctx, layers, options = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  // Defaults 跟 painted.js 原版对齐（2026-05-15 还原）：
  //   - view 1.0（之前我误改 1.2 让 subject 在画布里变小）
  //   - smallScaleSize 2（cellSize=4px）而非 3（cellSize=8px）→ BOB 油画密度感的核心
  const view = options.view ?? 1.0;
  const flipY = options.flipY ?? true;
  const seed = options.seed ?? 42;
  const maxSize = options.maxSize ?? 2048;
  const middleScaleSize = options.middleScaleSize ?? 6;
  const smallScaleSize = options.smallScaleSize ?? 2;
  const middleRotate = options.middleRotate ?? 0.0015;
  const brushLayers = options.brushLayers ?? 5;
  const smallOffset = options.smallOffset ?? 4;
  const smallSegs = options.smallSegs ?? 5;
  const noiseScale = options.noiseScale ?? 0.04;
  const rH = options.rH ?? 0.6;
  const rV = options.rV ?? 0;
  const gap = options.gap ?? 0.75;
  const sdfThreshold = options.sdfThreshold ?? -0.001;
  const stippleBackground = options.stippleBackground ?? true;
  // LLM 模式专用（colorPalette=null 时启用 HSL spread）。原 painted.js 没有，
  // 但 user 决策 5 保留这个 slider 给 LLM 模式用，palette 模式完全 bypass
  const colorSpread = options.colorSpread ?? 0;
  const complementWeight = options.complementWeight ?? 0.5;
  const colorPalette = options.colorPalette ?? null;
  const colorPalette2 = options.colorPalette2 ?? null;
  // regionOffset: BOB scenes 7/8 idiom，3D probe 命中 region → palette 索引偏移
  // 默认值跟 painted.js 一致
  const regionOffset = options.regionOffset ?? { background: 1, ground: 2, object: 3 };
  // 预转 palette 为 fillStyle 字符串，避免循环里重复 rgbStr
  const paletteStr  = colorPalette  ? colorPalette.map(rgbStr)  : null;
  const palette2Str = colorPalette2 ? colorPalette2.map(rgbStr) : null;
  const paletteMode = !!paletteStr;

  const bgFn = makeBgFn(options.background ?? [255, 255, 255], view);

  // ---- SDF3 probe pre-bake（统一用 src/sdf/probe.js 的 makeProbe）----
  // 4-value contract: { intensity, region, hit, normal }。bobStipple 用 intensity
  // 调密度（painted.js scenes 7/8 公式）+ region 调 colorBase（painted.js regionOffset 表）。
  // hit/normal 暂不用但 contract 留着——未来扩展（如点彩 normal-driven brush 方向）兼容。
  const probeCamera = createCamera({
    yaw: options.yaw ?? 0.5,
    pitch: options.pitch ?? 0.35,
    distance: options.cameraDist ?? 4,
  });
  const preparedLayers = layers.map(({ sdf, color }) => {
    if (sdf instanceof SDF3) {
      const probe = makeProbe((p) => sdf(p), { camera: probeCamera });
      return { color, is3D: true, probe };
    }
    return { color, is3D: false, sdf };
  });
  const perlin = createPerlin(seed);
  // p5 noise 在 [0, 1]；createPerlin 在 [-1, 1]
  const noise = (x, y) => (perlin(x, y) + 1) / 2;
  const rng = makeRng(seed);
  const gaussian = makeGaussian(rng);

  // ---- 1. background ----
  // background === null → 跳过填底，stipple 直接叠在已有 canvas 像素上（pattern 等已画好）
  // 纯色 → 快通道 fillRect；渐变/函数 → per-pixel ImageData
  if (options.background === null) {
    // no-op：保留底层
  } else if (Array.isArray(options.background)) {
    ctx.fillStyle = rgbStr(options.background);
    ctx.fillRect(0, 0, W, H);
  } else {
    const img = ctx.createImageData(W, H);
    const data = img.data;
    for (let y = 0; y < H; y++) {
      const wy = flipY ? -((y / H) * 2 * view - view) : (y / H) * 2 * view - view;
      for (let x = 0; x < W; x++) {
        const wx = (x / W) * 2 * view - view;
        const col = bgFn(wx, wy);
        const i = (y * W + x) * 4;
        data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- 2. build grid + bend ----
  const csize = W;
  const scaleSize = Math.pow(2, middleScaleSize) * (csize / maxSize);
  const cellSize = Math.pow(2, smallScaleSize);
  const bigDIM = Math.floor(csize / scaleSize);
  const scaleModifier = 2;
  const modifiedScaleSize = scaleSize * scaleModifier;
  const cellcount = Math.floor(modifiedScaleSize / cellSize);

  const bend = (x, y) => {
    const x1 = noise(x * noiseScale, y * noiseScale) * 4 - 2;
    const y1 = noise(x * noiseScale + 1000, y * noiseScale + 1000) * 4 - 2;
    return [x1, y1];
  };

  const pxToWorld = (px, py) => {
    const wx = (px / csize) * 2 * view - view;
    const wy = flipY
      ? -((py / csize) * 2 * view - view)
      : (py / csize) * 2 * view - view;
    return [wx, wy];
  };

  // ---- 3. render: for each cell find top-hit layer, draw brushLayers brushes ----
  const brushR = cellSize * gap / 2;
  // Palette cache：相同 base 色（reference 相等）的 expand 结果只算一次
  const paletteCache = new Map();
  const getPalette = (base) => {
    let p = paletteCache.get(base);
    if (!p) {
      p = expandColorPalette(base, colorSpread, complementWeight);
      paletteCache.set(base, p);
    }
    return p;
  };

  for (let blockIdx = 0; blockIdx < bigDIM * bigDIM; blockIdx++) {
    const l = Math.floor(blockIdx / bigDIM);
    const k = blockIdx % bigDIM;
    for (let cellIdx = 0; cellIdx < cellcount * cellcount; cellIdx++) {
      const j = Math.floor(cellIdx / cellcount);
      const i = cellIdx % cellcount;
      let x = l * scaleSize + cellSize * i;
      let y = k * scaleSize + cellSize * j;
      // 整网微旋转（BOB 原版 bug：第二行用了已改过的 x，保留为风味）
      x = x * Math.cos(middleRotate) - y * Math.sin(middleRotate);
      y = x * Math.sin(middleRotate) + y * Math.cos(middleRotate);
      const [dx, dy] = bend(x, y);
      x += dx; y += dy;

      const [wx, wy] = pxToWorld(x, y);

      // Top-most hit wins（layers 从底到顶，反向遍历）
      // 2D layer: sdf([wx,wy]) < threshold；3D layer: probe(wx,wy) 4-value contract
      let hitColor = null;
      let hitLayerIdx = -1;
      let hitIntensity = 1;     // SDF3 才用；SDF2 默认 1（不调密度）
      let hitRegion = 'object'; // SDF3 才有；默认 'object'
      for (let li = preparedLayers.length - 1; li >= 0; li--) {
        const layer = preparedLayers[li];
        if (layer.is3D) {
          const r = layer.probe(wx, wy);
          if (r.hit) {
            hitColor = layer.color;
            hitLayerIdx = li;
            hitIntensity = r.intensity;
            hitRegion = r.region;
            break;
          }
        } else if (layer.sdf([wx, wy]) < sdfThreshold) {
          hitColor = layer.color;
          hitLayerIdx = li;
          break;
        }
      }
      // 未命中：背景路径（BOB 原版行为，bg 颜色 + region='background'）
      if (hitLayerIdx === -1) {
        if (!stippleBackground) continue;
        hitColor = bgFn(wx, wy);
        hitRegion = 'background';
      }

      // 3D Lambert 密度调制（painted.js scenes 7/8 公式，1:1 还原）：
      //   density = 1 - 0.92·I²  → bright(I=1) 残余 0.08、dark(I=0) 全 1.0
      //   layerCount = floor(d·N) + (rng() < frac ? 1 : 0)  随机舍入
      // 2D layer 跳过，保留原 brushLayers
      let effBrushLayers = brushLayers;
      if (hitLayerIdx >= 0 && preparedLayers[hitLayerIdx].is3D) {
        const density = 1 - 0.92 * hitIntensity * hitIntensity;
        const dl = density * brushLayers;
        const base = Math.floor(dl);
        effBrushLayers = base + (rng() < dl - base ? 1 : 0);
        if (effBrushLayers === 0) continue;
      }

      // ColorBase（painted.js 1:1 还原）：
      // - 2D path: 每 SDF 层占 3 色窗口 + (i, j) 奇偶 offset → BOB 色块震颤 signature
      //   formula: index*3 + colorOffset + 1，colorOffset 由 (i, j) parity 决定
      // - 3D path: regionOffset[region] → background/ground/object 三色分区
      //   （这是 painted.js scenes 7/8 那种 sky/ground/object 多色调的核心）
      // - LLM 模式（colorPalette=null）: colorBase 不用，走 expandColorPalette HSL 路径
      const llmPalette = paletteMode ? null : getPalette(hitColor);
      let colorBase = 0;
      if (paletteMode) {
        if (hitLayerIdx === -1) {
          // 背景：用 regionOffset['background']（也可以是 0 留给独立背景色窗口）
          colorBase = regionOffset.background ?? 0;
        } else if (preparedLayers[hitLayerIdx].is3D) {
          // 3D path: regionOffset 表分区
          colorBase = regionOffset[hitRegion] ?? 1;
        } else {
          // 2D path: painted.js parity-based 公式（每 SDF 占 3 色窗口）
          const colorOffset =
            hitLayerIdx === 0 ? 0 :
            hitLayerIdx === 1 ? (i % 2 !== 0 ? 0 : 1) :
                                (i % 2 !== 0 ? 0 : (j % 2 === 0 ? 1 : 2));
          colorBase = hitLayerIdx * 3 + colorOffset + 1;
        }
      }

      for (let layerIdx = 0; layerIdx < effBrushLayers; layerIdx++) {
        if (paletteMode) {
          // 双 palette 时奇数 brush 层用 palette2（BOB 原版交替）
          const useP2 = palette2Str && (layerIdx % 2 !== 0);
          const palStr = useP2 ? palette2Str : paletteStr;
          ctx.fillStyle = palStr[(colorBase + layerIdx) % palStr.length];
        } else {
          ctx.fillStyle = llmPalette[layerIdx % llmPalette.length].style;
        }
        // 用 layerIdx 偏移 noise sample 位置避免每层位置一致
        const xoffset = (noise(x * noiseScale + layerIdx * 13.7, y * noiseScale) - 0.5) * smallOffset;
        const yoffset = (noise(x * noiseScale + 1000 + layerIdx * 13.7, y * noiseScale + 1000) - 0.5) * smallOffset;
        const layerOffset = layerIdx + 0.5 - brushLayers / 2;
        drawBrush(
          ctx,
          x + xoffset + layerOffset * rH,
          y + yoffset + layerOffset * rV,
          brushR,
          smallSegs,
          rng,
          gaussian,
        );
      }
    }
  }
}
