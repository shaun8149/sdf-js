// =============================================================================
// tileGrid —— 网格扫描器，每格调一次 caller 的 tile 回调
// -----------------------------------------------------------------------------
// 跟 streamline / flowLines 不同，这是 raster / halftone 范式的渲染基础：
//   把画布切成规则网格 → 每格 caller 自己决定怎么画。
//
// caller 拿到 cell 的位置、索引、cols/rows、cellSize，结合 field 值就可以画。
// =============================================================================

/**
 * 在 bounds 内铺网格，对每个 cell 调用 tile(ctx, info)。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {{minX,maxX,minY,maxY}} opts.bounds
 * @param {number} opts.cellSize        - 期望的 cell 边长（实际会向 bounds 取整）
 * @param {number} [opts.border=0]      - bounds 内部留白（uniform inset）
 * @param {(ctx, info)=>void} opts.tile - 每格回调；info = { x, y, cx, cy, w, h, i, j, cols, rows }
 *                                        (x, y) = 左上角，(cx, cy) = 中心，(i, j) = 网格索引
 */
export function tileGrid(ctx, { bounds, cellSize, border = 0, tile }) {
  const minX = bounds.minX + border;
  const minY = bounds.minY + border;
  const totalW = (bounds.maxX - bounds.minX) - 2 * border;
  const totalH = (bounds.maxY - bounds.minY) - 2 * border;

  const cols = Math.max(1, Math.floor(totalW / cellSize));
  const rows = Math.max(1, Math.floor(totalH / cellSize));
  const w = totalW / cols;
  const h = totalH / rows;

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = minX + i * w;
      const y = minY + j * h;
      tile(ctx, {
        x, y, w, h,
        cx: x + w / 2, cy: y + h / 2,
        i, j, cols, rows,
      });
    }
  }
}
