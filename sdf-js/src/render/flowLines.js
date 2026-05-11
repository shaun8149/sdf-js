// =============================================================================
// flowLines —— 把 streamline 数组渲染成细线
// -----------------------------------------------------------------------------
// 最朴素的 streamline 渲染器：每条 centerline 画成一条 polyline。
//
// 与 ribbon（粗细 + 色块）的区别：
//   flowLines 把 streamline 当成单纯的 1D 曲线。没有半径，没有色块。
//   适合 "follow a noise flow field" 那种经典 flow field 视觉。
// =============================================================================

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{centerline}>} streamlines
 * @param {object} [opts]
 * @param {string} [opts.stroke='#1a1a1a']   - 单色描边
 * @param {(streamline, i)=>string} [opts.strokeFn]  - 每条线独立选色（覆盖 stroke）
 * @param {number} [opts.lineWidth=1]
 * @param {string|null} [opts.background=null]  - 不为 null 则先填整张画布
 * @param {boolean} [opts.resetTransform=false] - 重置 ctx transform 后再画
 *                                                 （p5 pixelDensity 场景用）
 */
export function flowLines(ctx, streamlines, opts = {}) {
  const {
    stroke = '#1a1a1a',
    strokeFn = null,
    lineWidth = 1,
    background = null,
    resetTransform = false,
  } = opts;

  if (resetTransform) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  if (background !== null) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < streamlines.length; i++) {
    const sl = streamlines[i];
    if (!sl.centerline || sl.centerline.length < 2) continue;

    ctx.strokeStyle = strokeFn ? strokeFn(sl, i) : stroke;

    ctx.beginPath();
    ctx.moveTo(sl.centerline[0][0], sl.centerline[0][1]);
    for (let k = 1; k < sl.centerline.length; k++) {
      ctx.lineTo(sl.centerline[k][0], sl.centerline[k][1]);
    }
    ctx.stroke();
  }

  if (resetTransform) ctx.restore();
}
