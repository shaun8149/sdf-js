// =============================================================================
// silhouette —— 多层 SDF 剪影渲染（pixel scan + smoothstep AA）
// -----------------------------------------------------------------------------
// 每像素：从 background 起，按图层顺序 alpha 合成；smoothstep 在 d=0 边界做
// 1px 级抗锯齿。一次性扫整张画布，适合静态成图。
// =============================================================================

// background 可以是：
//   - [r, g, b]                              纯色
//   - { top: [r,g,b], bottom: [r,g,b] }      垂直渐变（+Y 朝上为 top）
//   - (wx, wy) => [r, g, b]                  任意函数
function makeBgFn(bg, view) {
  if (typeof bg === 'function') return bg;
  if (Array.isArray(bg)) return () => bg;
  if (bg && bg.top && bg.bottom) {
    const { top, bottom } = bg;
    return (_wx, wy) => {
      const t = (wy + view) / (2 * view);   // 0(底) → 1(顶)
      return [
        bottom[0] + (top[0] - bottom[0]) * t,
        bottom[1] + (top[1] - bottom[1]) * t,
        bottom[2] + (top[2] - bottom[2]) * t,
      ];
    };
  }
  return () => [255, 255, 255];
}

const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * 渲染多层 SDF 剪影到 ctx。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{sdf, color: [r,g,b]}>} layers - 数组顺序 = 从底到顶（后画的覆盖前画的）
 * @param {object} [options]
 * @param {number} [options.view=1.2]   - 世界半宽，画布映射到 [-view, +view]²
 * @param {[number,number,number] | {top,bottom} | Function} [options.background] - 背景：色 / 渐变 / 函数
 * @param {number} [options.antialias]  - AA 宽度（世界单位）。默认 = 单像素世界宽
 * @param {boolean} [options.flipY=true] - +Y 朝上
 */
export function silhouette(ctx, layers, options = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const view = options.view ?? 1.2;
  const flipY = options.flipY ?? true;
  const aa = options.antialias ?? (2 * view / W);
  const bgFn = makeBgFn(options.background ?? [255, 255, 255], view);

  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wx = (x / W) * 2 * view - view;
      const wy = flipY ? -((y / H) * 2 * view - view) : (y / H) * 2 * view - view;

      let col = bgFn(wx, wy);
      for (const { sdf, color } of layers) {
        const d = sdf([wx, wy]);
        const t = smoothstep(aa, -aa, d);    // d<0 → t=1（实色覆盖），d>0 → t=0（透明）
        col = [
          col[0] + (color[0] - col[0]) * t,
          col[1] + (color[1] - col[1]) * t,
          col[2] + (color[2] - col[2]) * t,
        ];
      }

      const i = (y * W + x) * 4;
      data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
