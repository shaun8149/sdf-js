// =============================================================================
// 2D primitives + 变换算子
// -----------------------------------------------------------------------------
// 镜像 Python sdf/d2.py。命名与 Python 对齐（hexagon、rounded_rectangle 等）。
// 额外补：triangle (3 点)、trapezoid —— BOB 场景 2 的船需要它们，Python 没有。
//
// 数学公式大多来自 IQ 的 2D SDF 文章：
//   https://iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
// =============================================================================

import { SDF2, defineOp2, defineOp23 } from './core.js';
import * as v from './vec2.js';

// ---- Primitives ------------------------------------------------------------

export const circle = (radius = 1, center = v.ORIGIN) =>
  SDF2((p) => v.length(v.sub(p, center)) - radius);

// 椭圆：半轴 rx / ry（不是全宽全高）。算法来自 IQ:
//   https://iquilezles.org/articles/ellipsedist/
// 当 rx === ry 时退化为 circle，直接走 circle 快通道避免 l=0 的除零。
export const ellipse = (rx = 1, ry = 1, center = v.ORIGIN) => {
  if (rx === ry) return circle(rx, center);
  return SDF2((p) => {
    let px = Math.abs(p[0] - center[0]);
    let py = Math.abs(p[1] - center[1]);
    let ax = rx, ay = ry;
    // IQ formula assumes p.y >= p.x in the canonical orientation; swap if needed
    if (px > py) {
      const t = px; px = py; py = t;
      const u = ax; ax = ay; ay = u;
    }
    const l = ay * ay - ax * ax;
    const m = ax * px / l;
    const n = ay * py / l;
    const m2 = m * m, n2 = n * n;
    const c = (m2 + n2 - 1) / 3;
    const c3 = c * c * c;
    const q = c3 + m2 * n2 * 2;
    const d = c3 + m2 * n2;
    const g = m + m * n2;
    let co;
    if (d < 0) {
      const h = Math.acos(q / c3) / 3;
      const s = Math.cos(h);
      const t = Math.sin(h) * Math.sqrt(3);
      const rxv = Math.sqrt(-c * (s + t + 2) + m2);
      const ryv = Math.sqrt(-c * (s - t + 2) + m2);
      co = (ryv + Math.sign(l) * rxv + Math.abs(g) / (rxv * ryv) - m) / 2;
    } else {
      const h = 2 * m * n * Math.sqrt(d);
      const s = Math.sign(q + h) * Math.pow(Math.abs(q + h), 1 / 3);
      const u = Math.sign(q - h) * Math.pow(Math.abs(q - h), 1 / 3);
      const rxv = -s - u - c * 4 + 2 * m2;
      const ryv = (s - u) * Math.sqrt(3);
      const rm = Math.sqrt(rxv * rxv + ryv * ryv);
      co = (ryv / Math.sqrt(rm - rxv) + 2 * g / rm - m) / 2;
    }
    const sinCo = Math.sqrt(Math.max(0, 1 - co * co));
    const rxFinal = ax * co;
    const ryFinal = ay * sinCo;
    const dx = rxFinal - px;
    const dy = ryFinal - py;
    return Math.sqrt(dx * dx + dy * dy) * Math.sign(py - ryFinal);
  });
};

// 半平面：法线指向"外"。dot(point - p, normal) → 内为负、外为正
export const line = (normal = v.UP, point = v.ORIGIN) => {
  const n = v.normalize(normal);
  return SDF2((p) => v.dot(v.sub(point, p), n));
};

// 2D 线段（capsule）：从 a 到 b 的线段，半径 r（圆端帽）。
//   线条、笔画、钟表指针、肢体、植物茎秆都可以用它。
export const segment = (a, b, r = 0.05) =>
  SDF2((p) => {
    const pax = p[0] - a[0], pay = p[1] - a[1];
    const bax = b[0] - a[0], bay = b[1] - a[1];
    const baba = bax * bax + bay * bay;
    if (baba === 0) return Math.sqrt(pax * pax + pay * pay) - r;
    const t = Math.max(0, Math.min(1, (pax * bax + pay * bay) / baba));
    const dx = pax - bax * t;
    const dy = pay - bay * t;
    return Math.sqrt(dx * dx + dy * dy) - r;
  });

// 圆弧：以 center 为中心、radius 为半径、有 thickness 厚度的部分圆环。
//   halfAperture 是从 +Y 轴量起的半角（弧度）：
//     0       → 单点（顶部）
//     π/2     → 上半圆
//     π       → 完整圆环（= ring）
//   开口默认在 -Y 方向。需要别的朝向用 .rotate(angle)。
//   IQ formula: https://iquilezles.org/articles/distfunctions2d/
export const arc = (radius = 1, halfAperture = Math.PI / 2, thickness = 0.05, center = v.ORIGIN) => {
  const scx = Math.sin(halfAperture);
  const scy = Math.cos(halfAperture);
  const half = thickness / 2;
  return SDF2((p) => {
    const px = Math.abs(p[0] - center[0]);
    const py = p[1] - center[1];
    let d;
    if (scy * px > scx * py) {
      const dx = px - scx * radius;
      const dy = py - scy * radius;
      d = Math.sqrt(dx * dx + dy * dy);
    } else {
      d = Math.abs(Math.sqrt(px * px + py * py) - radius);
    }
    return d - half;
  });
};

// 圆环（hollow circle）：等价于 shell(circle(r), thickness) 但更直接。
//   钟表面、轮子、虹膜、垫圈、瞄准镜
export const ring = (radius = 1, thickness = 0.05, center = v.ORIGIN) =>
  SDF2((p) => {
    const dx = p[0] - center[0];
    const dy = p[1] - center[1];
    return Math.abs(Math.sqrt(dx * dx + dy * dy) - radius) - thickness / 2;
  });

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

// 花朵 / wavy radial petal shape：圆 + 极角余弦扰动半径，画出辐射状花瓣轮廓。
//   amp   控制花瓣突起幅度
//   freq  控制花瓣数（6 = rose / 8 = daisy / 4 = simple flower）
//   offset 给径向相位扰动（用于多层花叠加时错开瓣位）
//   baseR 基础半径
// 用途广：花朵（玫瑰 / 雏菊 / 向日葵）、太阳光晕、雪花、齿轮、装饰花结、
// 树冠（BOB scene 2 的原始用例）、放射性 logo 等任何辐射状外形。
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

// ---- Tier 2: Editorial 高频 + IQ 装饰 primitives -------------------------
// 来源: IQ "2D distance functions" article. 之前 LLM 都能 compose 但形态不准。
// 现在直接提供，code 更干净 / 形态更精确 / preset 一致性更好。

// 心形（IQ heart）。scale 控制大小；底尖在原点附近（y=0），顶部 lobe 在 y≈+1*scale。
// 用前可 `.translate([0, -scale*0.4])` 把心居中。
export const heart = (scale = 0.4) => SDF2((p) => {
  const x = Math.abs(p[0]) / scale;
  const y = p[1] / scale;
  if (y + x > 1) {
    const dx = x - 0.25, dy = y - 0.75;
    return (Math.sqrt(dx * dx + dy * dy) - Math.SQRT2 / 4) * scale;
  }
  const dx0 = x, dy0 = y - 1;
  const t = Math.max(x + y, 0) * 0.5;
  const dx1 = x - t, dy1 = y - t;
  const d0 = dx0 * dx0 + dy0 * dy0;
  const d1 = dx1 * dx1 + dy1 * dy1;
  return Math.sqrt(Math.min(d0, d1)) * Math.sign(x - y) * scale;
});

// n 角星：用 2n 个 vertex（外/内半径交替）做 polygon。
// innerR 默认 = outerR * (n==5 ? 0.382 : 0.5)（5 角星黄金比）
export const star = (points = 5, outerR = 0.5, innerR = null) => {
  const n = Math.max(3, points | 0);
  const ir = innerR ?? outerR * (n === 5 ? 0.382 : 0.5);
  const verts = [];
  for (let i = 0; i < 2 * n; i++) {
    const angle = (i * Math.PI / n) - Math.PI / 2; // 起点朝上
    const r = (i % 2 === 0) ? outerR : ir;
    verts.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return polygon(verts);
};

// 月牙（IQ moon crescent）。thickness=月牙最宽处厚度，size=主圆半径。
//   开口默认朝右（凹向 +X）；rotate 改朝向。
export const moon = (thickness = 0.12, size = 0.4) => {
  const ra = size;
  const rb = Math.max(0.01, size - thickness);
  const d = thickness * 1.6;
  const a = (ra * ra - rb * rb + d * d) / (2 * d);
  const b = Math.sqrt(Math.max(ra * ra - a * a, 0));
  return SDF2((p) => {
    const px = p[0];
    const py = Math.abs(p[1]);
    if (d * (px * b - py * a) > d * d * Math.max(b - py, 0)) {
      const dx = px - a, dy = py - b;
      return Math.sqrt(dx * dx + dy * dy);
    }
    const dpx = px - d;
    const d1 = Math.sqrt(px * px + py * py) - ra;
    const d2 = Math.sqrt(dpx * dpx + py * py) - rb;
    return Math.max(d1, -d2);
  });
};

// 十字 / + 号（IQ cross）。armLength = 单臂长度；halfThickness = 半厚度；
// cornerRadius > 0 让 4 个内角圆滑（rounded_cross）。
export const cross = (armLength = 0.4, halfThickness = 0.1, cornerRadius = 0) =>
  SDF2((p) => {
    let px = Math.abs(p[0]);
    let py = Math.abs(p[1]);
    if (py > px) { const t = px; px = py; py = t; }
    const qx = px - armLength;
    const qy = py - halfThickness;
    const k = Math.max(qy, qx);
    const wx = (k > 0) ? qx : (halfThickness - px);
    const wy = (k > 0) ? qy : -k;
    const ox = Math.max(wx, 0), oy = Math.max(wy, 0);
    return Math.sign(k) * Math.sqrt(ox * ox + oy * oy) + cornerRadius;
  });

// rounded_cross 是 cross 加默认 cornerRadius 的便捷别名
export const rounded_cross = (armLength = 0.4, halfThickness = 0.1, cornerRadius = 0.025) =>
  cross(armLength, halfThickness, cornerRadius);

// 饼图扇形（IQ pie）。halfAperture = 半张角（弧度），radius = 半径。
// 默认开口朝上（顶点 +Y 方向），rotate 改朝向。
export const pie = (halfAperture = Math.PI / 4, radius = 0.5) => {
  const cx = Math.sin(halfAperture);
  const cy = Math.cos(halfAperture);
  return SDF2((p) => {
    const px = Math.abs(p[0]);
    const py = p[1];
    const l = Math.sqrt(px * px + py * py) - radius;
    const dot = px * cx + py * cy;
    const cl = Math.max(0, Math.min(radius, dot));
    const dx = px - cx * cl, dy = py - cy * cl;
    const m = Math.sqrt(dx * dx + dy * dy);
    return Math.max(l, m * Math.sign(cy * px - cx * py));
  });
};
// pie_slice 是别名
export const pie_slice = pie;

// 马蹄 / 字母 U（IQ horseshoe）。
//   openAngle = 开口半角（0 = 闭合圆环 / π/2 = 半开）
//   radius = 圆环中线半径；thickness = 圆环厚度
export const horseshoe = (openAngle = Math.PI / 3, radius = 0.4, thickness = 0.08) => {
  const cax = Math.cos(openAngle);
  const cay = Math.sin(openAngle);
  const wHalf = thickness * 0.5;
  return SDF2((p) => {
    let px = Math.abs(p[0]);
    let py = p[1];
    const l = Math.sqrt(px * px + py * py);
    const rx = -cax * px + cay * py;
    const ry = cay * px + cax * py;
    px = (ry > 0 || rx > 0) ? rx : l * Math.sign(-cax);
    py = (rx > 0) ? ry : l;
    px = px - wHalf;
    py = Math.abs(py - radius) - wHalf;
    const ox = Math.max(px, 0), oy = Math.max(py, 0);
    return Math.sqrt(ox * ox + oy * oy) + Math.min(0, Math.max(px, py));
  });
};

// 蛋形（IQ egg）。ra = 外半径，rb = 顶部尖端曲率（小=尖头，大=圆头）。
//   底部圆，顶部尖。
export const egg = (ra = 0.4, rb = 0.15) => {
  const k = Math.sqrt(3);
  const r = ra - rb;
  return SDF2((p) => {
    const px = Math.abs(p[0]);
    const py = p[1];
    let d;
    if (py < 0) {
      d = Math.sqrt(px * px + py * py) - r;
    } else if (k * (px + r) < py) {
      const dy = py - k * r;
      d = Math.sqrt(px * px + dy * dy);
    } else {
      const dx = px + r;
      d = Math.sqrt(dx * dx + py * py) - 2 * r;
    }
    return d - rb;
  });
};

// ---- Tier 3: 几何精度场景 -------------------------------------------------

// 任意倾斜的盒子（IQ oriented box）。a, b 是 centerline 的两端点，thickness = 宽度。
// 替代 rotate(angle).rectangle 的心智负担——直接给两端点画一个长方形。
export const oriented_box = (a, b, thickness = 0.1) => {
  const ax = a[0], ay = a[1], bx = b[0], by = b[1];
  const dx = bx - ax, dy = by - ay;
  const l = Math.sqrt(dx * dx + dy * dy) || 1e-9;
  const dirX = dx / l, dirY = dy / l;
  const midX = (ax + bx) / 2, midY = (ay + by) / 2;
  const halfL = l / 2;
  const halfT = thickness / 2;
  return SDF2((p) => {
    const qx0 = p[0] - midX, qy0 = p[1] - midY;
    const qx = dirX * qx0 + dirY * qy0;
    const qy = -dirY * qx0 + dirX * qy0;
    const ax_ = Math.abs(qx) - halfL;
    const ay_ = Math.abs(qy) - halfT;
    const ox = Math.max(ax_, 0), oy = Math.max(ay_, 0);
    return Math.sqrt(ox * ox + oy * oy) + Math.min(0, Math.max(ax_, ay_));
  });
};

// 等腰梯形（IQ isosceles trapezoid）。
//   r1 = 上边半宽，r2 = 下边半宽，h = 半高
// 注意：这跟现有的 `trapezoid(a, b, ra, rb)`（capsule-style，圆端帽）不同 ——
// isosceles_trapezoid 是 IQ 标准的等腰梯形，顶底是水平直边。
export const isosceles_trapezoid = (r1 = 0.2, r2 = 0.4, h = 0.3) => {
  const k1x = r2, k1y = h;
  const k2x = r2 - r1, k2y = 2 * h;
  const k2DotK2 = k2x * k2x + k2y * k2y;
  return SDF2((p) => {
    const px = Math.abs(p[0]);
    const py = p[1];
    const r = py < 0 ? r1 : r2;
    const cax = px - Math.min(px, r);
    const cay = Math.abs(py) - h;
    const cbDot = (k1x - px) * k2x + (k1y - py) * k2y;
    const tt = Math.max(0, Math.min(1, cbDot / k2DotK2));
    const cbx = px - k1x + k2x * tt;
    const cby = py - k1y + k2y * tt;
    const s = (cbx < 0 && cay < 0) ? -1 : 1;
    const da = cax * cax + cay * cay;
    const db = cbx * cbx + cby * cby;
    return s * Math.sqrt(Math.min(da, db));
  });
};

// 平行四边形（IQ parallelogram）。
//   halfWidth = 半宽（顶底等长），halfHeight = 半高，skew = 顶边相对底边的水平偏移
export const parallelogram = (halfWidth = 0.3, halfHeight = 0.2, skew = 0.1) => {
  const wi = halfWidth, he = halfHeight;
  const ex = skew, ey = he;
  const eDotE = ex * ex + ey * ey;
  return SDF2((p) => {
    let px = p[0], py = p[1];
    if (py < 0) { px = -px; py = -py; }
    let wx = px - ex, wy = py - ey;
    wx -= Math.max(-wi, Math.min(wi, wx));
    let dx = wx * wx + wy * wy;
    let dy = -wy;
    const s = px * ey - py * ex;
    if (s < 0) { px = -px; py = -py; }
    let vx = px - wi, vy = py;
    const vDotE = vx * ex + vy * ey;
    const tt = Math.max(-1, Math.min(1, vDotE / eDotE));
    vx -= ex * tt; vy -= ey * tt;
    const dx2 = vx * vx + vy * vy;
    const dy2 = wi * he - Math.abs(s);
    if (dx2 < dx) { dx = dx2; dy = dy2; }
    return Math.sqrt(dx) * Math.sign(-dy);
  });
};

// 菱形 / 钻石形（IQ rhombus）。halfWidth / halfHeight 是横/纵半轴。
export const rhombus = (halfWidth = 0.3, halfHeight = 0.2) => {
  const bx = halfWidth, by = halfHeight;
  const bDotB = bx * bx + by * by;
  return SDF2((p) => {
    const px = Math.abs(p[0]);
    const py = Math.abs(p[1]);
    const ndot = px * bx - py * by;
    let h = (-2 * ndot + bDotB) / bDotB;
    h = Math.max(-1, Math.min(1, h));
    const dx = px - 0.5 * bx * (1 - h);
    const dy = py - 0.5 * by * (1 + h);
    const d = Math.sqrt(dx * dx + dy * dy);
    return d * Math.sign(px * by + py * bx - bx * by);
  });
};

// 二次贝塞尔曲线（IQ quadratic bezier）。A/B/C 是 3 个控制点，thickness 半厚度。
// 算法：求点到 Bezier 的最近距离，需解三次方程。
export const quadratic_bezier = (A, B, C, thickness = 0.02) => {
  const ax0 = A[0], ay0 = A[1];
  const bx0 = B[0], by0 = B[1];
  const cx0 = C[0], cy0 = C[1];
  return SDF2((p) => {
    const aax = bx0 - ax0, aay = by0 - ay0;
    const bbx = ax0 - 2 * bx0 + cx0, bby = ay0 - 2 * by0 + cy0;
    const ccx = aax * 2, ccy = aay * 2;
    const dx = ax0 - p[0], dy = ay0 - p[1];
    const denom = bbx * bbx + bby * bby;
    if (denom < 1e-12) {
      // 退化为线段
      const lx = cx0 - ax0, ly = cy0 - ay0;
      const ll = lx * lx + ly * ly;
      const tt = ll < 1e-12 ? 0 : Math.max(0, Math.min(1, -(dx * lx + dy * ly) / ll));
      const qx = dx + lx * tt, qy = dy + ly * tt;
      return Math.sqrt(qx * qx + qy * qy) - thickness;
    }
    const kk = 1 / denom;
    const kx = kk * (aax * bbx + aay * bby);
    const ky = kk * (2 * (aax * aax + aay * aay) + (dx * bbx + dy * bby)) / 3;
    const kz = kk * (dx * aax + dy * aay);
    const p_ = ky - kx * kx;
    const p3 = p_ * p_ * p_;
    const q = kx * (2 * kx * kx - 3 * ky) + kz;
    const h = q * q + 4 * p3;
    let res;
    if (h >= 0) {
      const sh = Math.sqrt(h);
      const x1 = (-q - sh) / 2, x2 = (-q + sh) / 2;
      const u = Math.sign(x1) * Math.pow(Math.abs(x1), 1 / 3);
      const v_ = Math.sign(x2) * Math.pow(Math.abs(x2), 1 / 3);
      const t = Math.max(0, Math.min(1, u + v_ - kx));
      const qx = dx + (ccx + bbx * t) * t;
      const qy = dy + (ccy + bby * t) * t;
      res = qx * qx + qy * qy;
    } else {
      const z = Math.sqrt(-p_);
      const v_ = Math.acos(q / (p_ * z * 2)) / 3;
      const m = Math.cos(v_), n = Math.sin(v_) * Math.sqrt(3);
      const t1 = Math.max(0, Math.min(1, (m + m) * z - kx));
      const t2 = Math.max(0, Math.min(1, (-n - m) * z - kx));
      const qx1 = dx + (ccx + bbx * t1) * t1;
      const qy1 = dy + (ccy + bby * t1) * t1;
      const qx2 = dx + (ccx + bbx * t2) * t2;
      const qy2 = dy + (ccy + bby * t2) * t2;
      res = Math.min(qx1 * qx1 + qy1 * qy1, qx2 * qx2 + qy2 * qy2);
    }
    return Math.sqrt(res) - thickness;
  });
};

// ---- Tier 4: 剩余 legacy-python primitives ------------------------------------

// slab: 多轴半平面交集（box 的另一种参数化）。axis-aligned constraints。
//   slab({ x0: -0.5, x1: 0.5, y0: -0.3 })  → x ∈ [-0.5, 0.5] 且 y ≥ -0.3
//   缺省的轴 = 该方向无约束
export const slab = (opts = {}) => {
  const { x0, x1, y0, y1 } = opts;
  return SDF2((p) => {
    let d = -Infinity;
    if (x0 != null) d = Math.max(d, x0 - p[0]);
    if (x1 != null) d = Math.max(d, p[0] - x1);
    if (y0 != null) d = Math.max(d, y0 - p[1]);
    if (y1 != null) d = Math.max(d, p[1] - y1);
    return d === -Infinity ? -1 : d;
  });
};

// rounded_x: 圆角 X / 十字形（IQ rounded x）。w = X 臂的全长，r = 圆角半径
export const rounded_x = (w = 0.4, r = 0.05) => SDF2((p) => {
  const px = Math.abs(p[0]);
  const py = Math.abs(p[1]);
  const q = Math.min(px + py, w) * 0.5;
  const dx = px - q, dy = py - q;
  return Math.sqrt(dx * dx + dy * dy) - r;
});

// vesica: 双圆交集的透镜形（眼睛 / 鱼 / 叶子 / 月牙 editorial 高频）。
//   r = 两个圆的半径，d = 圆心到中线的距离（必须 d < r）
//   d 越小 vesica 越饱满，d 接近 r 时 vesica 变窄如柳叶
export const vesica = (r = 0.4, d = 0.2) => {
  const b = Math.sqrt(Math.max(0, r * r - d * d));
  return SDF2((p) => {
    const px = Math.abs(p[0]);
    const py = Math.abs(p[1]);
    if ((py - b) * d > px * b) {
      const dx = px, dy = py - b;
      return Math.sqrt(dx * dx + dy * dy);
    }
    const dx = px + d, dy = py;
    return Math.sqrt(dx * dx + dy * dy) - r;
  });
};

// ---- Transforms ------------------------------------------------------------
// 注：elongate 已搬到 dn.js（unified 2D/3D，按 SDF 维度自动派发）

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

// ---- 2D → 3D 升维算子 ------------------------------------------------------

// extrude：把 2D 形状沿 Z 轴拉成 prism，厚度 h（z ∈ [-h/2, +h/2]）。
// 数学：xy 用 2D SDF，z 用 slab，IQ box-style 合成 outside/inside 距离。
//   circle(0.3).extrude(0.5)             圆柱
//   rectangle([0.4, 0.2]).extrude(0.1)   长方体
//   polygon([...]).extrude(0.2)          多边形 prism（heart 立体吊坠 / 立体字母）
export const extrude = defineOp23('extrude', (sdf2d, h) => (p) => {
  const d  = sdf2d.f([p[0], p[1]]);
  const w1 = Math.abs(p[2]) - h / 2;
  const o0 = Math.max(d, 0), o1 = Math.max(w1, 0);
  return Math.sqrt(o0 * o0 + o1 * o1) + Math.min(Math.max(d, w1), 0);
});

// extrude_to: morph extrude —— 底面 2D shape a，顶面 2D shape b，沿 Z 平滑过渡。
//   h = 厚度（z ∈ [-h/2, +h/2]）
//   easing = (t: 0..1) => t 的过渡函数，默认 linear
// 例：circle(0.5).extrude_to(rectangle([0.2, 0.2]), 0.4)  → 圆 → 方过渡的截锥
// 用于花瓶颈 / 杯子斜壁 / 锥形 logo / 立体字渐变。
export const extrude_to = defineOp23('extrude_to', (sdfA, sdfB, h, easing = (t) => t) => (p) => {
  const dA = sdfA([p[0], p[1]]);
  const dB = sdfB([p[0], p[1]]);
  const tRaw = Math.max(-0.5, Math.min(0.5, p[2] / h)) + 0.5;
  const t = easing(tRaw);
  const d = dA + (dB - dA) * t;
  const w1 = Math.abs(p[2]) - h / 2;
  const o0 = Math.max(d, 0), o1 = Math.max(w1, 0);
  return Math.sqrt(o0 * o0 + o1 * o1) + Math.min(Math.max(d, w1), 0);
});

// revolve：2D profile 绕 Y 轴旋转一圈成 3D 体。
//   - 2D 的 x_2d → 径向距离 r = sqrt(x²+z²) - offset
//   - 2D 的 y_2d → 高度（沿 Y 轴）
//   - offset > 0 让 profile 绕远离 Y 轴的圆环旋转 → torus / 戒指 / 轮胎
//   注意：profile 应该位于 x_2d ≥ 0 半平面，否则两侧 mirror 会重叠。
//   circle(0.3).translate([0.6, 0]).revolve(0)   torus
//   rectangle([0.05, 0.6]).translate([0.5, 0]).revolve(0)   薄壁圆筒（杯子）
export const revolve = defineOp23('revolve', (sdf2d, offset = 0) => (p) => {
  const r = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - offset;
  return sdf2d.f([r, p[1]]);
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
