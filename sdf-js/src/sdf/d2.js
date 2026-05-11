// =============================================================================
// 2D primitives + 变换算子
// -----------------------------------------------------------------------------
// 镜像 Python sdf/d2.py。命名与 Python 对齐（hexagon、rounded_rectangle 等）。
// 额外补：triangle (3 点)、trapezoid —— BOB 场景 2 的船需要它们，Python 没有。
//
// 数学公式大多来自 IQ 的 2D SDF 文章：
//   https://iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
// =============================================================================

import { SDF2, defineOp2 } from './core.js';
import * as v from './vec2.js';

// ---- Primitives ------------------------------------------------------------

export const circle = (radius = 1, center = v.ORIGIN) =>
  SDF2((p) => v.length(v.sub(p, center)) - radius);

// 半平面：法线指向"外"。dot(point - p, normal) → 内为负、外为正
export const line = (normal = v.UP, point = v.ORIGIN) => {
  const n = v.normalize(normal);
  return SDF2((p) => v.dot(v.sub(point, p), n));
};

// 矩形：两种参数形式 —— size+center 或者两个对角 a/b
export const rectangle = (size = 1, center = v.ORIGIN, a = null, b = null) => {
  if (a !== null && b !== null) {
    const sz = v.sub(b, a);
    const ctr = v.add(a, v.div(sz, 2));
    return rectangle(sz, ctr);
  }
  const s = v.asVec2(size);
  const halfx = s[0] / 2, halfy = s[1] / 2;
  return SDF2((p) => {
    const qx = Math.abs(p[0] - center[0]) - halfx;
    const qy = Math.abs(p[1] - center[1]) - halfy;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    const outside = Math.sqrt(ox * ox + oy * oy);
    const inside = Math.min(Math.max(qx, qy), 0);
    return outside + inside;
  });
};

// 圆角矩形：radius 标量统一 / 数组按象限索引 [r0, r1, r2, r3]
// 索引规则与 BOB 的 sdRoundBox 一致（按 (sign(x), sign(y)) 选角）：
//   r0: dx>0, dy>0 (Y-up: 右上 / Y-down: 右下)
//   r1: dx>0, dy<0 (Y-up: 右下 / Y-down: 右上)
//   r2: dx<0, dy>0 (Y-up: 左上 / Y-down: 左下)
//   r3: dx<0, dy<0 (Y-up: 左下 / Y-down: 左上)
//   →  Y-down 渲染下顺序就是 BOB 的 [BR, TR, BL, TL]
export const rounded_rectangle = (size, radius = 0, center = v.ORIGIN) => {
  let r0, r1, r2, r3;
  if (typeof radius === 'number') {
    r0 = r1 = r2 = r3 = radius;
  } else if (Array.isArray(radius)) {
    [r0, r1, r2, r3] = radius;
  } else {
    throw new TypeError('rounded_rectangle: radius must be number or [r0, r1, r2, r3]');
  }
  const s = v.asVec2(size);
  const halfx = s[0] / 2, halfy = s[1] / 2;
  return SDF2((p) => {
    const dx = p[0] - center[0];
    const dy = p[1] - center[1];
    const r = dx > 0
      ? (dy > 0 ? r0 : r1)
      : (dy > 0 ? r2 : r3);
    const qx = Math.abs(dx) - halfx + r;
    const qy = Math.abs(dy) - halfy + r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ox * ox + oy * oy) - r;
  });
};

// 等边三角形（单位大小，朝上）；要更大时用 .scale(r)
export const equilateral_triangle = () =>
  SDF2((p) => {
    const k = Math.sqrt(3);
    let x = Math.abs(p[0]) - 1;
    let y = p[1] + 1 / k;
    if (x + k * y > 0) {
      const nx = (x - k * y) / 2;
      const ny = (-k * x - y) / 2;
      x = nx; y = ny;
    }
    x -= Math.max(-2, Math.min(0, x));
    return -Math.sqrt(x * x + y * y) * Math.sign(y);
  });

// 正六边形，r 是外接圆半径（与 Python 一致：内部把 r 折算成中心到边距离）
export const hexagon = (r = 1) => {
  const rs = r * Math.sqrt(3) / 2;
  return SDF2((p) => {
    const k0 = -Math.sqrt(3) / 2;
    const k1 = 0.5;
    const k2 = Math.tan(Math.PI / 6);
    let px = Math.abs(p[0]), py = Math.abs(p[1]);
    const m = 2 * Math.min(k0 * px + k1 * py, 0);
    px -= k0 * m;
    py -= k1 * m;
    px -= Math.max(-k2 * rs, Math.min(k2 * rs, px));
    py -= rs;
    return Math.sqrt(px * px + py * py) * Math.sign(py);
  });
};

// 任意多边形：points 为 [[x,y], ...] 顶点列表（首尾不闭合）。算法逐边求最近距离 + 叉积绕数判内外。
export const polygon = (points) => {
  const pts = points.map((p) => [p[0], p[1]]);
  const n = pts.length;
  return SDF2((p) => {
    let dx = p[0] - pts[0][0];
    let dy = p[1] - pts[0][1];
    let d = dx * dx + dy * dy;
    let s = 1;
    for (let i = 0; i < n; i++) {
      const j = (i + n - 1) % n;
      const vi = pts[i], vj = pts[j];
      const ex = vj[0] - vi[0], ey = vj[1] - vi[1];
      const wx = p[0] - vi[0], wy = p[1] - vi[1];
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
      const bx = wx - ex * t, by = wy - ey * t;
      d = Math.min(d, bx * bx + by * by);
      // Crossing-number test: p[1] 是否跨过这条边
      const c1 = p[1] >= vi[1];
      const c2 = p[1] < vj[1];
      const c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  });
};

// 任意三角形：3 个顶点。语义上是 polygon 的特化，但单独导出更直观
export const triangle = (p0, p1, p2) => polygon([p0, p1, p2]);

// 花朵：圆 + 极角余弦扰动半径，画出花瓣轮廓。BOB scene 2 的树冠用
//   amp 控制花瓣突起幅度；freq 控制花瓣数；offset 给径向相位扰动
export const flower = (amp = 0.12, freq = 10, offset = 20, baseR = 0.2) =>
  SDF2((p) => {
    const angle = Math.atan2(p[1], p[0]);
    const r = baseR + amp * Math.cos(angle * freq + offset * (1 - p[0]) + 1);
    return Math.sqrt(p[0] * p[0] + p[1] * p[1]) - r;
  });

// 梯形：a / b 是上下两个圆盘的圆心，ra / rb 对应半径。BOB 的船身。
// 算法：先把 p 投影到 ab 轴上的参数 t∈[0,1]，再算到锥侧/到端盖的最近距离
export const trapezoid = (a, b, ra, rb) =>
  SDF2((p) => {
    const py = -p[1];                                     // 与 BOB 一致：Y 轴翻转
    const ax = a[0], ay = a[1], bx = b[0], by = b[1];
    const rba = rb - ra;
    const baba = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
    const papa = (p[0] - ax) * (p[0] - ax) + (py - ay) * (py - ay);
    const paba = ((p[0] - ax) * (bx - ax) + (py - ay) * (by - ay)) / baba;
    const x = Math.sqrt(Math.max(0, papa - paba * paba * baba));
    const cax = Math.max(0, x - (paba < 0.5 ? ra : rb));
    const cay = Math.abs(paba - 0.5) - 0.5;
    const k = rba * rba + baba;
    const ft = Math.max(0, Math.min(1, (rba * (x - ra) + paba * baba) / k));
    const cbx = x - ra - ft * rba;
    const cby = paba - ft;
    const sgn = (cbx < 0 && cay < 0) ? -1 : 1;
    return sgn * Math.sqrt(Math.min(
      cax * cax + cay * cay * baba,
      cbx * cbx + cby * cby * baba,
    ));
  });

// ---- Transforms ------------------------------------------------------------

export const translate = defineOp2('translate', (other, offset) =>
  (p) => other.f(v.sub(p, offset)),
);

export const scale = defineOp2('scale', (other, factor) => {
  const s = v.asVec2(factor);
  const m = Math.min(s[0], s[1]);
  return (p) => other.f([p[0] / s[0], p[1] / s[1]]) * m;
});

export const rotate = defineOp2('rotate', (other, angle) => {
  const m = v.rotMat(-angle);
  return (p) => other.f([m[0] * p[0] + m[1] * p[1], m[2] * p[0] + m[3] * p[1]]);
});

// 圆周阵列：count 份 other，绕原点等角分布
export const circular_array = defineOp2('circular_array', (other, count) => {
  const ms = [];
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count;
    ms.push(v.rotMat(-a));
  }
  return (p) => {
    let best = Infinity;
    for (const m of ms) {
      const d = other.f([m[0] * p[0] + m[1] * p[1], m[2] * p[0] + m[3] * p[1]]);
      if (d < best) best = d;
    }
    return best;
  };
});
