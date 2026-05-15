// =============================================================================
// motifs/ —— hand-drawn shape data library (first-class 路径，跟 sdf/ field/ 平行)
// -----------------------------------------------------------------------------
// Why this layer exists (2026-05-14 architectural insight from Reinder Nijhoff):
//   Pasma 那种 organic feel 来自 **curated shape data + 简单 placement**，不是
//   procedural noise 算法。"Generative ≠ procedural"——好的 mapping 可以建立在
//   hand-crafted data 之上。
//
//   sdf/         primitives + boolean ops (procedural)
//   field/       noise / scalar fields (procedural)
//   streamline/  curve tracing (procedural)
//   motifs/      ★ hand-crafted shape data library  ← THIS LAYER
//   render/      output consumers
//
// 当前 default library: Reinder Nijhoff 20-motif set（从 Turtletoy share 而来）。
// 后续可加 SVG import / SDF 自动 marching / 用户 hand-trace 等扩展 motif source。
// =============================================================================

export { Path, pathToPolyline } from './path.js';
export { DEFAULT_MOTIFS, DEFAULT_ORDER, MOTIF_BBOX_HALF } from './defaults.js';

import { Path } from './path.js';
import { DEFAULT_MOTIFS, MOTIF_BBOX_HALF } from './defaults.js';

// 把单个 motif (array of SVG path strings) 解析为 array of polylines。
// 同时归一化到 [-1, 1] bbox。可选 samplesPerPath 控制每条 path 的采样密度。
export function motifToPolylines(motifPaths, samplesPerPath = 40, bboxHalf = MOTIF_BBOX_HALF) {
  const polylines = [];
  for (const svgString of motifPaths) {
    const path = new Path(svgString);
    if (path.length() === 0) continue;
    // 采样，然后归一化坐标到 [-1, 1]（原 bbox 半宽 bboxHalf → ±1）
    const pts = path.sample(samplesPerPath).map(([x, y]) => [x / bboxHalf, y / bboxHalf]);
    polylines.push(pts);
  }
  return polylines;
}

// 把整个 motif library 预编译为 polylines（renderer 启动时调一次，省 per-cell parse）
export function compileMotifLibrary(motifs = DEFAULT_MOTIFS, samplesPerPath = 40, bboxHalf = MOTIF_BBOX_HALF) {
  return motifs.map(m => motifToPolylines(m, samplesPerPath, bboxHalf));
}
