// =============================================================================
// render/ —— SDF → pixels 渲染层
// -----------------------------------------------------------------------------
// 与 sdf/ 的关系：单向消费。和 ca/ 同层平铺 —— ca/ 把 SDF 变成离散结构，
// render/ 把 SDF 变成像素。两层都通过 SDF 的 callable / `.f()` 接口接入，
// 互相不感知。
//
// 当前 3 个渲染器，覆盖 3 种本质不同的 pattern：
//
//   silhouette  —— 一次性 + 多层 + 背景 + smoothstep AA（一张静态成图）
//   bands       —— 一次性 + 单 SDF + 距离色带（IQ 风格调试可视化）
//   sandFrame   —— 累积式 + 多层 + 随机采样三色（在 raf 循环里反复调）
//
// 未来：painted（笔触/网格化）、shader（GLSL 包装）、raymarch（3D）平铺加入。
// =============================================================================

export { silhouette } from './silhouette.js';
export { bands } from './bands.js';
export { sandFrame } from './sand.js';
export { painted } from './painted.js';
export { bobStipple } from './bobStipple.js';
export { raymarched } from './raymarched.js';
export { flowLines } from './flowLines.js';
export { hatch, hatchSvg, computeHatchLayers } from './hatch.js';
// Background patterns (Truchet / space-filling curves) —— polyline-output 底纹家族
export { truchet, computeTruchetPolylines } from './truchet.js';
export { hilbert, gosper, computeHilbertPolylines, computeGosperPolylines } from './spaceCurve.js';
// Motif library renderer (Nijhoff-style hand-drawn motif × multi-band grid sweep)
export { motifGrid, computeMotifGridPolylines } from './motifGrid.js';
export { drawLineSquare, clipLine } from './lineTile.js';
export { tileGrid } from './tileGrid.js';
