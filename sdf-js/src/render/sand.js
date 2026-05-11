// =============================================================================
// sand —— 沙画风格累积式渲染
// -----------------------------------------------------------------------------
// 每次调用 sandFrame() 画 N 个随机点。调用方在 raf 循环里反复调，点会持续堆积，
// 形状从噪声里"渗"出来。不清屏 —— 清屏由调用方控制（一次 fillRect 即可）。
//
// 三色规则：
//   d < -band 在某 SDF 内部 → 该图层 inside 色（last-inside-wins）
//   |d| < band 任意 SDF 边界附近 → boundary 色
//   d > +band 全部在外 → outside 色
// =============================================================================

/**
 * 在 ctx 上画一帧（N 个随机采样点）。不清屏。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{sdf, color: string}>} layers - color 是 CSS color string（用 fillStyle）
 * @param {object} [options]
 * @param {number} [options.view=1]        - 世界半宽
 * @param {number} [options.samples=1000]  - 本帧采样点数
 * @param {string} [options.outsideColor='#f80']   - 全部外部时的"沙"色
 * @param {string} [options.boundaryColor='#f5f5f5'] - 任意边界附近的高亮色
 * @param {number} [options.band=0.01]     - 边界带宽（世界单位）
 * @param {number} [options.dotRadius=0.5] - 像素半径
 * @param {boolean} [options.flipY=false] - 默认 false（与 BOB 原版 scenes 的 y-down 约定对齐）。
 *                                          注意：silhouette / bands 默认 true（+Y up）。
 *                                          约定差异是历史遗留，由 lib 默认 + caller 显式覆盖共同决定。
 */
export function sandFrame(ctx, layers, options = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const view          = options.view ?? 1;
  const samples       = options.samples ?? 1000;
  const outsideColor  = options.outsideColor ?? '#f80';
  const boundaryColor = options.boundaryColor ?? '#f5f5f5';
  const band          = options.band ?? 0.01;
  const dotRadius     = options.dotRadius ?? 0.5;
  const flipY         = options.flipY ?? false;

  // 重置任何 caller 在 ctx 上预设的 transform（典型是 p5 的 pixelDensity scale）。
  // 我们要按内部像素直接 fillRect，所以必须在 identity 变换下画。
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  for (let k = 0; k < samples; k++) {
    const wx = Math.random() * 2 * view - view;
    const wy = Math.random() * 2 * view - view;

    // 找最高 inside 图层，同时检测是否在任意边界附近
    let layerIdx = -1;
    let nearBoundary = false;
    for (let i = 0; i < layers.length; i++) {
      const d = layers[i].sdf([wx, wy]);
      if (d < -band) layerIdx = i;
      else if (d < band) nearBoundary = true;
    }

    let col;
    if (layerIdx >= 0) col = layers[layerIdx].color;
    else if (nearBoundary) col = boundaryColor;
    else col = outsideColor;

    // 世界 → 像素（[-view, +view] → [0, W]；y 翻转可选）
    const px = ((wx + view) / (2 * view)) * W;
    const py = flipY
      ? ((view - wy) / (2 * view)) * H
      : ((wy + view) / (2 * view)) * H;

    ctx.fillStyle = col;
    ctx.fillRect(px - dotRadius, py - dotRadius, dotRadius * 2, dotRadius * 2);
  }

  ctx.restore();
}
