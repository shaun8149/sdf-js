// =============================================================================
// hatch —— 多层 SDF → contour-following hatching
// -----------------------------------------------------------------------------
// 2D 等价于 Piter Pasma 的 surface-flat rayhatching：
//   每个 SDF 内部用 evenly-spaced 流线填充，
//   field 默认沿 gradient 垂直方向（"等距离线"）→ 线贴着形状边界走。
//
// 跟 silhouette 同抽象等级：
//   silhouette: layers → pixel-filled regions
//   hatch:      layers → contour-line strokes
// 都接 `[{ sdf, color, ... }]`，都以 world coords 为输入，都自动处理 view+背景。
// 区别只在 visual register：一个 fill，一个 line。
// =============================================================================

import { hatch as packHatch, gradientPerpField, projectedTangentField } from '../streamline/index.js';
import { SDF3 } from '../sdf/core.js';
import { makeProbe, createCamera } from '../sdf/probe.js';
import { smoothStart3 } from '../math/easing.js';

// SDF3 streamline 默认走"BOB scenes 7/8 intensity 调密度" idiom：
//   probe.intensity → dsepFn → 暗处 dsep 缩 (DSEP_DARK) / 亮处 dsep 大 (DSEP_LIGHT)
//   probe.region → extraValid 只在 object / ground 区域采样（pass over 'background'）
// 跟 examples/sdf/test-pasma-capsules.js 同一套 mechanism (移植于此，让 MVP 也获益)。
// 跟 painted.js 3D 通路 density = 1 - 0.92·I² 的视觉签名对齐。
// caller 可以 override：layer.intensityDsep = false 退化为均匀 dsep。
const DEFAULTS_3D = {
  dsepDark:     0.003,  // 暗处线最密
  dsepLight:    0.020,  // 亮处线最稀 (= 默认 layer.dsep)
  intensityMin: 0.40,   // intensity remap 下界（< 这值 → ir=0 → 最密）
  intensityMax: 1.00,   // remap 上界
};
const clamp01 = v => Math.max(0, Math.min(1, v));

// ---- 3D rayhatching helpers ------------------------------------------------
// 这是 Piter Pasma "Universal Rayhatcher" 的核心：raymarch 找 hit，取表面切向，
// 投影到屏幕，让流线沿 3D 曲面的等距离环走（缠绕 / 绕皮的视觉签名）。
//
// 2026-05-15: probe 实现统一迁移到 src/sdf/probe.js（4-value contract）。本
// 文件不再 inline 写 probe，只 import makeProbe。`projectedTangentField` 共享
// 同一个 camera 对象 → 跟 probe 的视空间一致。

// ---- Core: compute streamlines per layer (consumer-agnostic) ----------------
// 把"算流线"和"画/导出"解耦。canvas 渲染和 SVG 导出共享这一步——hatch 输出本来
// 就是 polyline 矢量，SVG path 是它的天然 sink，不需要 marching-squares 重采样。

/**
 * @returns {Array<{streamlines: Array<{centerline: Array<[number, number]>}>, color: string, lineWidth: number}>}
 *   per-layer 结构，centerline 在 **world coords** (未投到像素)，由 caller 自己决定怎么映射
 */
export function computeHatchLayers(layers, opts = {}) {
  const { view = 1.0 } = opts;
  const out = [];
  for (const layer of layers) {
    const {
      sdf,
      color,
      dsep = 0.020,
      stepSize = 0.005,
      lineWidth = 0.6,
      seedCount = 4000,
      maxStreamlines = 3000,
      minLength = 8,
    } = layer;

    let sdfForPack = sdf;
    let fieldForPack = layer.field;
    let packExtra = {};  // 额外塞给 packHatch 的 opts (dsep 函数 + dsepMax + extraValid)
    if (sdf instanceof SDF3) {
      // Pasma rayhatching：ortho camera (yaw=0.5, pitch=0.35, distance=4)。makeProbe
      // 返回 4-value probe {intensity, region, hit, normal}。projectedTangentField
      // 共享同一个 camera 保持视空间一致。
      const camera = createCamera({ yaw: 0.5, pitch: 0.35, distance: 4 });
      const probe = makeProbe((p) => sdf(p), { camera });
      fieldForPack = projectedTangentField(probe, { camera });

      // SDF3 默认走 intensity-modulated dsep + region mask (BOB scenes 7/8 signature)
      // 移植于 test-pasma-capsules.js 的 dsepFn / inScene 逻辑，统一进 render.hatch
      // → MVP / streamline-scenes / 任何 hatch caller 都自动获得密度调制 + 区域 mask
      const intensityDsep = layer.intensityDsep !== false;  // 默认开

      if (intensityDsep) {
        const dsepDark = layer.dsepDark ?? DEFAULTS_3D.dsepDark;
        const dsepLight = layer.dsepLight ?? layer.dsep ?? DEFAULTS_3D.dsepLight;
        const iMin = layer.intensityMin ?? DEFAULTS_3D.intensityMin;
        const iMax = layer.intensityMax ?? DEFAULTS_3D.intensityMax;

        // sdf wrapper: 'object' 和 'ground' 都算 inside (background → outside)
        // 跟 test-pasma-capsules 的 inScene 同语义
        sdfForPack = (p) => {
          const r = probe(p[0], p[1]);
          if (!r.hit || r.region === 'background') return 0.01;
          return -0.01;
        };

        // dsep 函数：intensity → easing → [dsepDark, dsepLight]
        // 暗处 intensity ≈ 0 → ir=0 → 最密 (dsepDark)；亮处 intensity ≈ 1 → 最稀
        const dsepFn = (x, y) => {
          const r = probe(x, y);
          if (!r.hit || r.region === 'background') return dsepLight;
          const i = clamp01(r.intensity);
          const ir = clamp01((i - iMin) / (iMax - iMin));
          const t = smoothStart3(ir);
          return dsepDark + (dsepLight - dsepDark) * t;
        };

        packExtra = { dsep: dsepFn, dsepMax: dsepLight };
      } else {
        // intensityDsep=false 退化为简单 hit-test + uniform dsep
        sdfForPack = (p) => probe(p[0], p[1]).hit ? -0.01 : 0.01;
      }
    } else if (!fieldForPack) {
      fieldForPack = gradientPerpField(sdf);
    }

    const streamlines = packHatch(sdfForPack, fieldForPack, {
      view, dsep, stepSize, seedCount, maxStreamlines, minLength,
      seedStrategy: 'grid',
      ...packExtra,  // SDF3 时覆盖 dsep / dsepMax
    });

    out.push({ streamlines, color, lineWidth });
  }
  return out;
}

/**
 * 把每个 layer 的 SDF 内部填上 contour-following streamlines。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{
 *   sdf: (p:[number,number]) => number,
 *   color: string,
 *   field?: (x:number, y:number) => number,    // 默认 gradientPerpField(sdf)
 *   dsep?: number,
 *   stepSize?: number,
 *   lineWidth?: number,
 *   seedCount?: number,
 *   maxStreamlines?: number,
 *   minLength?: number,
 * }>} layers
 * @param {object} [opts]
 * @param {number}  [opts.view=1.0]
 * @param {string}  [opts.background='#fdf9f6']
 * @param {boolean} [opts.flipY=false]   - true: math y-up; false: BOB y-down
 * @returns {number[]}  每层实际画出的流线数（debug 用）
 */
export function hatch(ctx, layers, opts = {}) {
  const {
    view = 1.0,
    background = '#fdf9f6',
    flipY = false,
  } = opts;

  const canvas = ctx.canvas;
  const W = canvas.width, H = canvas.height;

  if (background !== null) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);
  }

  const wxToPx = wx => (wx + view) / (2 * view) * W;
  const wyToPx = flipY
    ? wy => (view - wy) / (2 * view) * H
    : wy => (wy + view) / (2 * view) * H;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const computed = computeHatchLayers(layers, { view });
  const counts = [];

  for (const { streamlines, color, lineWidth } of computed) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    for (const sl of streamlines) {
      const pts = sl.centerline;
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(wxToPx(pts[0][0]), wyToPx(pts[0][1]));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(wxToPx(pts[i][0]), wyToPx(pts[i][1]));
      }
      ctx.stroke();
    }
    counts.push(streamlines.length);
  }

  return counts;
}

// ---- SVG export -------------------------------------------------------------
// Lines renderer 的输出本来就是 polyline vector，SVG 是 lossless sink。
// 用途：Pasma plotter (axidraw 等) / Illustrator / Figma / 印刷流程。
// 一份 SDF → 一份 SVG → 任何 plotter / vector editor 都可吃。

/**
 * 导出 hatch 结果为 SVG 字符串。
 *
 * @param {Array} layers - 同 hatch()
 * @param {object} [opts]
 * @param {number}  [opts.view=1.0]
 * @param {number}  [opts.width=640]
 * @param {number}  [opts.height=640]
 * @param {string|null} [opts.background='#fdf9f6']  - null = 透明（no rect）
 * @param {boolean} [opts.flipY=false]
 * @param {number}  [opts.precision=2]  - 坐标小数位（少 = 文件小 + 精度低）
 * @returns {string} SVG 文档字符串
 */
export function hatchSvg(layers, opts = {}) {
  const {
    view = 1.0,
    width = 640,
    height = 640,
    background = '#fdf9f6',
    flipY = false,
    precision = 2,
  } = opts;

  const wxToPx = wx => (wx + view) / (2 * view) * width;
  const wyToPx = flipY
    ? wy => (view - wy) / (2 * view) * height
    : wy => (wy + view) / (2 * view) * height;
  const fmt = (n) => n.toFixed(precision);

  const computed = computeHatchLayers(layers, { view });

  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];
  if (background !== null) {
    parts.push(`<rect width="${width}" height="${height}" fill="${escapeXml(background)}"/>`);
  }
  for (const { streamlines, color, lineWidth } of computed) {
    parts.push(`<g stroke="${escapeXml(color)}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none">`);
    for (const sl of streamlines) {
      const pts = sl.centerline;
      if (pts.length < 2) continue;
      let d = `M${fmt(wxToPx(pts[0][0]))} ${fmt(wyToPx(pts[0][1]))}`;
      for (let i = 1; i < pts.length; i++) {
        d += `L${fmt(wxToPx(pts[i][0]))} ${fmt(wyToPx(pts[i][1]))}`;
      }
      parts.push(`<path d="${d}"/>`);
    }
    parts.push(`</g>`);
  }
  parts.push(`</svg>`);
  return parts.join('\n');
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' }[c]));
}
