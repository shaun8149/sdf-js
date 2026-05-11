// =============================================================================
// bands —— IQ 风格距离场可视化
// -----------------------------------------------------------------------------
// 单个 SDF。每像素：按距离值上色 —— 内蓝外红、距离绝对值越大越饱和、周期色带、
// 边界处暗一下作 isoline。一次性 pixel scan。常用于调试 SDF 形状。
// =============================================================================

/**
 * 渲染单个 SDF 的距离场可视化到 ctx。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} sdf - SDF 实例（callable，p => distance）
 * @param {object} [options]
 * @param {number} [options.view=1.6]            - 世界半宽
 * @param {[number,number,number]} [options.insideColor=[77,115,166]]   - 内部主色
 * @param {[number,number,number]} [options.outsideColor=[166,115,77]]  - 外部主色
 * @param {number} [options.bandFreq=10]         - 色带频率（每 0.2 距离单位一对带）
 * @param {number} [options.isolineSharpness=200] - 边界黑线锐度
 * @param {boolean} [options.flipY=true]
 */
export function bands(ctx, sdf, options = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const view             = options.view ?? 1.6;
  const flipY            = options.flipY ?? true;
  const bandFreq         = options.bandFreq ?? 10;
  const isolineSharpness = options.isolineSharpness ?? 200;
  // 默认色：BOB 蓝/红组合
  const ic = options.insideColor  ?? [77, 115, 166];
  const oc = options.outsideColor ?? [166, 115, 77];

  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wx = (x / W) * 2 * view - view;
      const wy = flipY ? -((y / H) * 2 * view - view) : (y / H) * 2 * view - view;
      const d = sdf([wx, wy]);

      const insideMix = 1 - Math.exp(-Math.abs(d) * 4);    // 离边界越远越饱和
      const band = 0.7 + 0.3 * Math.cos(d * Math.PI * bandFreq);
      const base = d < 0 ? ic : oc;
      let r = base[0] / 255 + 0.25 * insideMix * band;
      let g = base[1] / 255 + 0.25 * insideMix * band;
      let b = base[2] / 255 + 0.25 * insideMix * band;

      // 边界黑线（距离接近 0 → 暗）
      const edge = 1 - Math.exp(-Math.abs(d) * isolineSharpness);
      r *= edge; g *= edge; b *= edge;

      const i = (y * W + x) * 4;
      data[i]     = Math.min(255, Math.max(0, r * 255));
      data[i + 1] = Math.min(255, Math.max(0, g * 255));
      data[i + 2] = Math.min(255, Math.max(0, b * 255));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
