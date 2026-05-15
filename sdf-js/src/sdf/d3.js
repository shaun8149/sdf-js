// =============================================================================
// 3D primitives + 变换算子
// -----------------------------------------------------------------------------
// 镜像 Python sdf/d3.py。这一轮只实现"够 demo 布尔运算"的最小子集：
//   primitives: sphere / box / plane
//   transforms: translate / scale / rotate / orient
// 后续按 README 列表逐步补 cylinder / torus / capsule / cone / 多面体等。
// =============================================================================

import { SDF3, defineOp3 } from './core.js';
import * as v from './vec.js';

// ---- Primitives ------------------------------------------------------------

export const sphere = (radius = 1, center = v.ORIGIN) => {
  const inst = SDF3((p) => v.length(v.sub(p, center)) - radius);
  inst.ast = { kind: 'prim', name: 'sphere', args: [radius, center] };
  return inst;
};

// IQ 标准 box SDF：q = |p|-half; outside = |max(q,0)|; inside = min(max(q.xyz),0)
export const box = (size = 1, center = v.ORIGIN) => {
  const s = v.asVec3(size);
  const half = [s[0] / 2, s[1] / 2, s[2] / 2];
  const inst = SDF3((p) => {
    const qx = Math.abs(p[0] - center[0]) - half[0];
    const qy = Math.abs(p[1] - center[1]) - half[1];
    const qz = Math.abs(p[2] - center[2]) - half[2];
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    const outside = Math.sqrt(ox * ox + oy * oy + oz * oz);
    const inside = Math.min(Math.max(qx, qy, qz), 0);
    return outside + inside;
  });
  inst.ast = { kind: 'prim', name: 'box', args: [size, center] };
  return inst;
};

export const plane = (normal = v.UP, point = v.ORIGIN) => {
  const n = v.normalize(normal);
  const inst = SDF3((p) => v.dot(v.sub(point, p), n));
  inst.ast = { kind: 'prim', name: 'plane', args: [normal, point] };
  return inst;
};

// 胶囊体（capsule）SDF：圆柱 + 两端半球。a, b 是胶囊轴的两个端点（球心），r 是半径。
// 算法：把 p 投影到线段 a→b 上 clamp 到 [0,1]，距离最近投影点减去 r。
export const capsule = (a, b, r) => {
  const inst = SDF3((p) => {
    const pa = v.sub(p, a);
    const ba = v.sub(b, a);
    const t = Math.max(0, Math.min(1, v.dot(pa, ba) / v.dot(ba, ba)));
    const closest = v.add(a, v.mul(ba, t));
    return v.length(v.sub(p, closest)) - r;
  });
  inst.ast = { kind: 'prim', name: 'capsule', args: [a, b, r] };
  return inst;
};

// ---- Wave 1B: 基础 3D primitives (商业必备) -------------------------------

// torus（环形面包）：旋转轴 = Y。majorR = 中心圆环半径，minorR = 管半径。
// 等价于 circle(minorR).translate([majorR, 0]).revolve(0)，但 native 更直接。
export const torus = (majorR = 0.4, minorR = 0.1) => {
  const inst = SDF3((p) => {
    const radial = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - majorR;
    return Math.sqrt(radial * radial + p[1] * p[1]) - minorR;
  });
  inst.ast = { kind: 'prim', name: 'torus', args: [majorR, minorR] };
  return inst;
};

// cylinder（圆柱）：轴 = Y，有限高度。radius + height。
// 等价于 circle(r).extrude(h)，但 native 更直接。
export const cylinder = (radius = 0.3, height = 1.0) => {
  const inst = SDF3((p) => {
    const r = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - radius;
    const a = Math.abs(p[1]) - height / 2;
    const o0 = Math.max(r, 0), o1 = Math.max(a, 0);
    return Math.sqrt(o0 * o0 + o1 * o1) + Math.min(Math.max(r, a), 0);
  });
  inst.ast = { kind: 'prim', name: 'cylinder', args: [radius, height] };
  return inst;
};

// capped_cylinder：任意两点 a / b 之间的圆柱。管道 / 肢体 / 灯柱必备。
// IQ canonical formula（用 baba 归一化 避免 sqrt 提前）。
export const capped_cylinder = (a, b, radius = 0.1) => {
  const inst = SDF3((p) => {
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const pax = p[0] - a[0], pay = p[1] - a[1], paz = p[2] - a[2];
    const baba = bax * bax + bay * bay + baz * baz;
    const paba = pax * bax + pay * bay + paz * baz;
    const cx = pax * baba - bax * paba;
    const cy = pay * baba - bay * paba;
    const cz = paz * baba - baz * paba;
    const x = Math.sqrt(cx * cx + cy * cy + cz * cz) - radius * baba;
    const y = Math.abs(paba - baba * 0.5) - baba * 0.5;
    const x2 = x * x;
    const y2 = y * y * baba;
    let d;
    if (Math.max(x, y) < 0) d = -Math.min(x2, y2);
    else d = (x > 0 ? x2 : 0) + (y > 0 ? y2 : 0);
    return Math.sign(d) * Math.sqrt(Math.abs(d)) / baba;
  });
  inst.ast = { kind: 'prim', name: 'capped_cylinder', args: [a, b, radius] };
  return inst;
};

// ellipsoid：椭球，半轴 [rx, ry, rz]。
// 注意：非各向同性缩放的 SDF 不是精确距离（IQ 近似公式）。
export const ellipsoid = (radii = [0.4, 0.3, 0.4]) => {
  const [rx, ry, rz] = radii;
  const inst = SDF3((p) => {
    const px = p[0] / rx, py = p[1] / ry, pz = p[2] / rz;
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    if (k0 < 1e-9) return -Math.min(rx, ry, rz);  // 中心点
    const px2 = p[0] / (rx * rx), py2 = p[1] / (ry * ry), pz2 = p[2] / (rz * rz);
    const k1 = Math.sqrt(px2 * px2 + py2 * py2 + pz2 * pz2);
    return k0 * (k0 - 1) / k1;
  });
  inst.ast = { kind: 'prim', name: 'ellipsoid', args: [radii] };
  return inst;
};

// rounded_box：立方体加圆角边。size = 全尺寸（halved 内部）；radius = 圆角半径
export const rounded_box = (size = 0.6, radius = 0.05) => {
  const s = Array.isArray(size) ? size : [size, size, size];
  const halfx = s[0] / 2, halfy = s[1] / 2, halfz = s[2] / 2;
  const inst = SDF3((p) => {
    const qx = Math.abs(p[0]) - halfx + radius;
    const qy = Math.abs(p[1]) - halfy + radius;
    const qz = Math.abs(p[2]) - halfz + radius;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz)
         + Math.min(Math.max(qx, qy, qz), 0) - radius;
  });
  inst.ast = { kind: 'prim', name: 'rounded_box', args: [size, radius] };
  return inst;
};

// capped_cone：任意两点 a/b 之间的截锥（frustum）。ra = a 端半径，rb = b 端半径。
// IQ canonical formula（用 baba 归一化）。
export const capped_cone = (a, b, ra = 0.3, rb = 0.1) => {
  const inst = SDF3((p) => {
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const pax = p[0] - a[0], pay = p[1] - a[1], paz = p[2] - a[2];
    const baba = bax * bax + bay * bay + baz * baz;
    const papa = pax * pax + pay * pay + paz * paz;
    const paba = (pax * bax + pay * bay + paz * baz) / baba;
    const x = Math.sqrt(Math.max(0, papa - paba * paba * baba));
    const refR = paba < 0.5 ? ra : rb;
    const cax = Math.max(0, x - refR);
    const cay = Math.abs(paba - 0.5) - 0.5;
    const rba = rb - ra;
    const k = rba * rba + baba;
    const f = Math.max(0, Math.min(1, (rba * (x - ra) + paba * baba) / k));
    const cbx = x - ra - f * rba;
    const cby = paba - f;
    const s = (cbx < 0 && cay < 0) ? -1 : 1;
    return s * Math.sqrt(Math.min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
  });
  inst.ast = { kind: 'prim', name: 'capped_cone', args: [a, b, ra, rb] };
  return inst;
};

// cone：finite cone, base 在 y = -h/2 半径 baseRadius，tip 在 y = +h/2。
// 内部用 capped_cone（tip 用 0.001 微小半径避免数学退化）。
// AST override：cone 是独立 primitive，不要继承 capped_cone 的 AST。
export const cone = (height = 0.5, baseRadius = 0.3) => {
  const inst = capped_cone([0, -height / 2, 0], [0, height / 2, 0], baseRadius, 0.001);
  inst.ast = { kind: 'prim', name: 'cone', args: [height, baseRadius] };
  return inst;
};

// ---- Wave 2: Platonic solids + 装饰立体 + 3D 多轴 slab + wireframe -------

// tetrahedron：四面体（D4 骰子 / 钻石尖端）。r = 顶点距原点。
export const tetrahedron = (r = 0.4) => {
  const inst = SDF3((p) => (Math.max(
    Math.abs(p[0] + p[1]) - p[2],
    Math.abs(p[0] - p[1]) + p[2]
  ) - r) / Math.sqrt(3));
  inst.ast = { kind: 'prim', name: 'tetrahedron', args: [r] };
  return inst;
};

// octahedron：八面体（D8 骰子）。r = 顶点距原点。
export const octahedron = (r = 0.4) => {
  const inst = SDF3((p) => {
    const px = Math.abs(p[0]);
    const py = Math.abs(p[1]);
    const pz = Math.abs(p[2]);
    const m = px + py + pz - r;
    let qx, qy, qz;
    if (3 * px < m) { qx = px; qy = py; qz = pz; }
    else if (3 * py < m) { qx = py; qy = pz; qz = px; }
    else if (3 * pz < m) { qx = pz; qy = px; qz = py; }
    else return m * 0.57735027;
    const k = Math.max(0, Math.min(r, 0.5 * (qz - qy + r)));
    const dx = qx;
    const dy = qy - r + k;
    const dz = qz - k;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  });
  inst.ast = { kind: 'prim', name: 'octahedron', args: [r] };
  return inst;
};

// dodecahedron：十二面体（D12 骰子）。r = 顶点距原点。
export const dodecahedron = (r = 0.4) => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const len = Math.sqrt(1 + (1 + phi) * (1 + phi));
  const nx = 1 / len, ny = (1 + phi) / len;
  const inst = SDF3((p) => {
    const px = Math.abs(p[0]) / r;
    const py = Math.abs(p[1]) / r;
    const pz = Math.abs(p[2]) / r;
    const a = px * nx + py * ny;
    const b = py * nx + pz * ny;
    const c = px * ny + pz * nx;
    return (Math.max(Math.max(a, b), c) - nx) * r;
  });
  inst.ast = { kind: 'prim', name: 'dodecahedron', args: [r] };
  return inst;
};

// icosahedron：二十面体（D20 骰子）。r = 顶点距原点。
export const icosahedron = (r = 0.4) => {
  const R = r * 0.8506507174597755;
  const phi = (1 + Math.sqrt(5)) / 2;
  const len = Math.sqrt(1 + (1 + phi) * (1 + phi));
  const nx = 1 / len, ny = (1 + phi) / len;
  const w13 = 1 / Math.sqrt(3);
  const inst = SDF3((p) => {
    const px = Math.abs(p[0]) / R;
    const py = Math.abs(p[1]) / R;
    const pz = Math.abs(p[2]) / R;
    const a = px * nx + py * ny;
    const b = py * nx + pz * ny;
    const c = px * ny + pz * nx;
    const d = (px + py + pz) * w13;
    return (Math.max(Math.max(Math.max(a, b), c), d) - nx) * R;
  });
  inst.ast = { kind: 'prim', name: 'icosahedron', args: [r] };
  return inst;
};

// pyramid：方底锥（IQ canonical）。底 1×1 在 y=0，顶在 y=+h。
//   用 .translate([0, -h/2, 0]) 居中
export const pyramid = (h = 0.5) => {
  const m2 = h * h + 0.25;
  const inst = SDF3((p) => {
    let px = Math.abs(p[0]);
    let pz = Math.abs(p[2]);
    if (pz > px) { const t = px; px = pz; pz = t; }
    px -= 0.5; pz -= 0.5;
    const py = p[1];
    const qx = pz;
    const qy = h * py - 0.5 * px;
    const qz = h * px + 0.5 * py;
    const s = Math.max(-qx, 0);
    const t = Math.max(0, Math.min(1, (qy - 0.5 * pz) / (m2 + 0.25)));
    const a = m2 * (qx + s) * (qx + s) + qy * qy;
    const b = m2 * (qx + 0.5 * t) * (qx + 0.5 * t) + (qy - m2 * t) * (qy - m2 * t);
    const d2 = Math.min(qy, -qx * m2 - qy * 0.5) > 0 ? 0 : Math.min(a, b);
    return Math.sqrt((d2 + qz * qz) / m2) * Math.sign(Math.max(qz, -py));
  });
  inst.ast = { kind: 'prim', name: 'pyramid', args: [h] };
  return inst;
};

// slab3：3D 多轴半平面交集（box 的另一种参数化）。任一轴 null = 无约束。
//   slab3({ x0: -0.5, x1: 0.5, y0: -0.3 })  → x ∈ [-0.5, 0.5] 且 y ≥ -0.3 的半无限体
export const slab3 = (opts = {}) => {
  const { x0, x1, y0, y1, z0, z1 } = opts;
  return SDF3((p) => {
    let d = -Infinity;
    if (x0 != null) d = Math.max(d, x0 - p[0]);
    if (x1 != null) d = Math.max(d, p[0] - x1);
    if (y0 != null) d = Math.max(d, y0 - p[1]);
    if (y1 != null) d = Math.max(d, p[1] - y1);
    if (z0 != null) d = Math.max(d, z0 - p[2]);
    if (z1 != null) d = Math.max(d, p[2] - z1);
    return d === -Infinity ? -1 : d;
  });
};

// wireframe_box：立方体线框（只画 12 条边，box 内部空心）。
//   size = 全尺寸，thickness = 线粗细。IQ "bounding box" 公式。
export const wireframe_box = (size = 0.6, thickness = 0.04) => {
  const s = Array.isArray(size) ? size : [size, size, size];
  const bx = s[0] / 2, by = s[1] / 2, bz = s[2] / 2;
  const e = thickness;
  const dist3 = (a, b, c) => {
    const ox = Math.max(a, 0), oy = Math.max(b, 0), oz = Math.max(c, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz)
         + Math.min(Math.max(a, Math.max(b, c)), 0);
  };
  const inst = SDF3((p) => {
    const px = Math.abs(p[0]) - bx;
    const py = Math.abs(p[1]) - by;
    const pz = Math.abs(p[2]) - bz;
    const qx = Math.abs(px + e) - e;
    const qy = Math.abs(py + e) - e;
    const qz = Math.abs(pz + e) - e;
    return Math.min(Math.min(
      dist3(px, qy, qz),
      dist3(qx, py, qz)),
      dist3(qx, qy, pz));
  });
  inst.ast = { kind: 'prim', name: 'wireframe_box', args: [size, thickness] };
  return inst;
};

// ---- Wave 2C: 3D artistic ops -------------------------------------------

// twist：沿 Y 轴扭转 SDF（input-space rotation that varies with y）。
//   k = 弧度 / 单位 Y。k=1 时每升高 1 单位整体扭转 1 rad（约 57°）
//   生成 spiral / 螺旋 / 拧麻花视觉
export const twist = defineOp3('twist', (other, k) => (p) => {
  const c = Math.cos(k * p[1]);
  const s = Math.sin(k * p[1]);
  const x = c * p[0] - s * p[2];
  const z = s * p[0] + c * p[2];
  return other.f([x, p[1], z]);
});

// bend：沿 X 轴弯曲（XY 平面内的弧）。k = 曲率（rad / 单位 X）。
//   k=2 → 整体卷成 U 形；k=π → 闭合成圆
export const bend = defineOp3('bend', (other, k) => (p) => {
  const c = Math.cos(k * p[0]);
  const s = Math.sin(k * p[0]);
  const x = c * p[0] - s * p[1];
  const y = s * p[0] + c * p[1];
  return other.f([x, y, p[2]]);
});

// ---- Transforms ------------------------------------------------------------

export const translate = defineOp3('translate', (other, offset) =>
  (p) => other.f(v.sub(p, offset)),
);

export const scale = defineOp3('scale', (other, factor) => {
  const s = v.asVec3(factor);
  // 非均匀缩放不是精确 SDF；用最小分量补偿减小误差，与 Python 一致
  const m = Math.min(s[0], s[1], s[2]);
  return (p) => other.f([p[0] / s[0], p[1] / s[1], p[2] / s[2]]) * m;
});

// rotate(angle, axis)：把点逆向旋转到原始坐标系，等价于把形状正向旋转
export const rotate = defineOp3('rotate', (other, angle, axis = v.Z) => {
  const m = v.rotMat(-angle, axis);
  return (p) => other.f(v.matMul(m, p));
});

// orient(axis)：把"原本朝 +Z 的形状"重新朝向 axis 方向
// 这是 fogleman 经典 demo 'sphere & box - cyl.orient(X|Y|Z)' 的关键
export const orient = defineOp3('orient', (other, axis) => {
  const target = v.normalize(axis);
  const d = v.dot(v.Z, target);
  // 同向：不做旋转
  if (d > 1 - 1e-9) return (p) => other.f(p);
  // 反向：绕 X 旋 180°
  if (d < -1 + 1e-9) {
    const m = v.rotMat(Math.PI, v.X);
    return (p) => other.f(v.matMul(m, p));
  }
  // 一般情况：绕 Z×target 旋转 acos(Z·target)
  const rotAxis = v.normalize(v.cross(v.Z, target));
  const angle = Math.acos(d);
  const m = v.rotMat(-angle, rotAxis);
  return (p) => other.f(v.matMul(m, p));
});
