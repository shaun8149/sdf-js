// =============================================================================
// lineTile —— Cohen-Sutherland 线段裁剪 + 方块平行线填充
// -----------------------------------------------------------------------------
// 把一个方块用平行线填满 —— 角度 angle、间距 step。从中心线向两侧 expand，
// 每条线被方块边界裁剪（Cohen-Sutherland 算法），直到所有线都被裁掉为止。
//
// 这是 Alice / Harvey Rayner 那一脉 plotter 美学的核心 primitive。
// =============================================================================

// 端点编码：用 4 bit 标记该点在 clip rect 哪个方位
//   bit 0: 左外 (x < xmin)
//   bit 1: 右外 (x > xmax)
//   bit 2: 上外 (y < ymin)  ← canvas 坐标系 y 向下
//   bit 3: 下外 (y > ymax)
function encodeEndpoint(x, y, xmin, ymin, xmax, ymax) {
  let code = 0;
  if (x < xmin) code |= 1;
  else if (x > xmax) code |= 2;
  if (y < ymin) code |= 4;
  else if (y > ymax) code |= 8;
  return code;
}

/**
 * 把 (x0,y0)-(x1,y1) 线段裁剪到 clip rect 内。返回 [x0,y0,x1,y1,accept]。
 * accept=false 表示线段完全在外部，不应画。
 */
export function clipLine(x0, y0, x1, y1, clipX, clipY, clipW, clipH) {
  const xmin = clipX, ymin = clipY;
  const xmax = clipX + clipW, ymax = clipY + clipH;
  let e0 = encodeEndpoint(x0, y0, xmin, ymin, xmax, ymax);
  let e1 = encodeEndpoint(x1, y1, xmin, ymin, xmax, ymax);

  while (true) {
    if (e0 === 0 && e1 === 0) return [x0, y0, x1, y1, true];
    if ((e0 & e1) !== 0)       return [x0, y0, x1, y1, false];

    const code = e0 !== 0 ? e0 : e1;
    let nx, ny;
    if (code & 1) {                    // 左外
      nx = xmin;
      ny = ((y1 - y0) / (x1 - x0)) * (nx - x0) + y0;
    } else if (code & 2) {             // 右外
      nx = xmax;
      ny = ((y1 - y0) / (x1 - x0)) * (nx - x0) + y0;
    } else if (code & 8) {             // 下外
      ny = ymax;
      nx = ((x1 - x0) / (y1 - y0)) * (ny - y0) + x0;
    } else if (code & 4) {             // 上外
      ny = ymin;
      nx = ((x1 - x0) / (y1 - y0)) * (ny - y0) + x0;
    }
    if (code === e0) {
      x0 = nx; y0 = ny;
      e0 = encodeEndpoint(x0, y0, xmin, ymin, xmax, ymax);
    } else {
      x1 = nx; y1 = ny;
      e1 = encodeEndpoint(x1, y1, xmin, ymin, xmax, ymax);
    }
  }
}

/**
 * 用平行线填满一个方块。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x       方块左上角 x
 * @param {number} y       方块左上角 y
 * @param {number} w       方块边长（正方形）
 * @param {number} step    线间距（沿垂直于线的方向）
 * @param {number} angle   线的角度（弧度）
 *
 * caller 负责设置 strokeStyle / lineWidth；本函数不动 ctx 的 stroke 属性。
 */
export function drawLineSquare(ctx, x, y, w, step, angle) {
  const slope = Math.tan(angle);
  const cosA = Math.cos(angle);
  // 防止 cos 接近 0 导致 step/cos 爆炸（角度接近 π/2 时退化成竖线，要特殊处理）
  if (Math.abs(cosA) < 1e-6) {
    // 退化：所有线都是垂直线，间距 = step
    for (let xLine = x; xLine <= x + w; xLine += step) {
      ctx.beginPath();
      ctx.moveTo(xLine, y);
      ctx.lineTo(xLine, y + w);
      ctx.stroke();
    }
    return;
  }

  // 基准线方程：y = slope * x + c，过方块中心
  const cx = x + w / 2, cy = y + w / 2;
  const c = cy - slope * cx;
  // 线在 x 方向上的延伸（让端点足够远，确保能被裁剪算法处理）
  const xLeft = x - w / 2;
  const xRight = x + w + w / 2;

  let i = 0;
  let upOk = true, downOk = true;
  while (upOk || downOk) {
    const offset = i * step / cosA;

    // 中心线（i=0 时上下重合）只画一次
    if (upOk) {
      const x0 = xLeft, x1 = xRight;
      const y0 = slope * x0 + c + offset;
      const y1 = slope * x1 + c + offset;
      const [a, b, e, f, ok] = clipLine(x0, y0, x1, y1, x, y, w, w);
      if (ok) {
        ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke();
      }
      upOk = ok;
    }
    if (downOk && i > 0) {
      const x0 = xLeft, x1 = xRight;
      const y0 = slope * x0 + c - offset;
      const y1 = slope * x1 + c - offset;
      const [a, b, e, f, ok] = clipLine(x0, y0, x1, y1, x, y, w, w);
      if (ok) {
        ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke();
      }
      downOk = ok;
    }
    i++;
    if (i > 10000) break;  // safety
  }
}
