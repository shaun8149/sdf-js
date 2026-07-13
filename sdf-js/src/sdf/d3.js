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
import { numLit, vecLit } from './time.js';

// ---- Primitives ------------------------------------------------------------

export const sphere = (radius = 1, center = v.ORIGIN) => {
  const r0 = numLit(radius),
    c0 = vecLit(center);
  const inst = SDF3((p) => v.length(v.sub(p, c0)) - r0);
  inst.ast = { kind: 'prim', name: 'sphere', args: [radius, center] };
  return inst;
};

// IQ 标准 box SDF：q = |p|-half; outside = |max(q,0)|; inside = min(max(q.xyz),0)
export const box = (size = 1, center = v.ORIGIN) => {
  const s = vecLit(v.asVec3(size));
  const c0 = vecLit(center);
  const half = [s[0] / 2, s[1] / 2, s[2] / 2];
  const inst = SDF3((p) => {
    const qx = Math.abs(p[0] - c0[0]) - half[0];
    const qy = Math.abs(p[1] - c0[1]) - half[1];
    const qz = Math.abs(p[2] - c0[2]) - half[2];
    const ox = Math.max(qx, 0),
      oy = Math.max(qy, 0),
      oz = Math.max(qz, 0);
    const outside = Math.sqrt(ox * ox + oy * oy + oz * oz);
    const inside = Math.min(Math.max(qx, qy, qz), 0);
    return outside + inside;
  });
  inst.ast = { kind: 'prim', name: 'box', args: [size, center] };
  return inst;
};

export const plane = (normal = v.UP, point = v.ORIGIN) => {
  const n = v.normalize(vecLit(normal));
  const pt = vecLit(point);
  const inst = SDF3((p) => v.dot(v.sub(pt, p), n));
  inst.ast = { kind: 'prim', name: 'plane', args: [normal, point] };
  return inst;
};

// 胶囊体（capsule）SDF：圆柱 + 两端半球。a, b 是胶囊轴的两个端点（球心），r 是半径。
// 算法：把 p 投影到线段 a→b 上 clamp 到 [0,1]，距离最近投影点减去 r。
export const capsule = (a, b, r) => {
  const a0 = vecLit(a),
    b0 = vecLit(b),
    r0 = numLit(r);
  const inst = SDF3((p) => {
    const pa = v.sub(p, a0);
    const ba = v.sub(b0, a0);
    const t = Math.max(0, Math.min(1, v.dot(pa, ba) / v.dot(ba, ba)));
    const closest = v.add(a0, v.mul(ba, t));
    return v.length(v.sub(p, closest)) - r0;
  });
  inst.ast = { kind: 'prim', name: 'capsule', args: [a, b, r] };
  return inst;
};

// ---- Wave 1B: 基础 3D primitives (商业必备) -------------------------------

// torus（环形面包）：旋转轴 = Y。majorR = 中心圆环半径，minorR = 管半径。
// 等价于 circle(minorR).translate([majorR, 0]).revolve(0)，但 native 更直接。
export const torus = (majorR = 0.4, minorR = 0.1) => {
  const R0 = numLit(majorR),
    r0 = numLit(minorR);
  const inst = SDF3((p) => {
    const radial = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - R0;
    return Math.sqrt(radial * radial + p[1] * p[1]) - r0;
  });
  inst.ast = { kind: 'prim', name: 'torus', args: [majorR, minorR] };
  return inst;
};

// cylinder（圆柱）：轴 = Y，有限高度。radius + height。
// 等价于 circle(r).extrude(h)，但 native 更直接。
export const cylinder = (radius = 0.3, height = 1.0) => {
  const r0 = numLit(radius),
    h0 = numLit(height);
  const inst = SDF3((p) => {
    const r = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - r0;
    const a = Math.abs(p[1]) - h0 / 2;
    const o0 = Math.max(r, 0),
      o1 = Math.max(a, 0);
    return Math.sqrt(o0 * o0 + o1 * o1) + Math.min(Math.max(r, a), 0);
  });
  inst.ast = { kind: 'prim', name: 'cylinder', args: [radius, height] };
  return inst;
};

// capped_cylinder：任意两点 a / b 之间的圆柱。管道 / 肢体 / 灯柱必备。
// IQ canonical formula（用 baba 归一化 避免 sqrt 提前）。
export const capped_cylinder = (a, b, radius = 0.1) => {
  const a0 = vecLit(a),
    b0 = vecLit(b),
    r0 = numLit(radius);
  const inst = SDF3((p) => {
    const bax = b0[0] - a0[0],
      bay = b0[1] - a0[1],
      baz = b0[2] - a0[2];
    const pax = p[0] - a0[0],
      pay = p[1] - a0[1],
      paz = p[2] - a0[2];
    const baba = bax * bax + bay * bay + baz * baz;
    const paba = pax * bax + pay * bay + paz * baz;
    const cx = pax * baba - bax * paba;
    const cy = pay * baba - bay * paba;
    const cz = paz * baba - baz * paba;
    const x = Math.sqrt(cx * cx + cy * cy + cz * cz) - r0 * baba;
    const y = Math.abs(paba - baba * 0.5) - baba * 0.5;
    const x2 = x * x;
    const y2 = y * y * baba;
    let d;
    if (Math.max(x, y) < 0) d = -Math.min(x2, y2);
    else d = (x > 0 ? x2 : 0) + (y > 0 ? y2 : 0);
    return (Math.sign(d) * Math.sqrt(Math.abs(d))) / baba;
  });
  inst.ast = { kind: 'prim', name: 'capped_cylinder', args: [a, b, radius] };
  return inst;
};

// ellipsoid：椭球，半轴 [rx, ry, rz]。
// 注意：非各向同性缩放的 SDF 不是精确距离（IQ 近似公式）。
// ---- noise-field(Infinigen 研读第二课)---------------------------------------
// 不是形状,是"位移场":f(p) 返回微扰值,喂给 displace(host, field) 做表面细节。
// kind 'vfbm' = 3 octave 值噪声(geo_extension 径向鼓胀的 SDF 近似,低频不对称);
// kind 'voronoi' = 3D cellular F1(boulder.py 双层 VORONOI DISPLACE 的对应物,节理)。
// hash 用与 GLSL 同一条 sin-fract 公式 —— 统计特性一致,逐位不保证(文档级契约,
// 同 Phacelle 地形:噪声细节允许 CPU/GPU 有亚像素差异)。
// 调用方负责 amp 足够小(位移破坏 Lipschitz-1;GPU 发射器注释同款警告)。
const nfHash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const nfValue = (px, py, pz) => {
  const ix = Math.floor(px),
    iy = Math.floor(py),
    iz = Math.floor(pz);
  const fx = px - ix,
    fy = py - iy,
    fz = pz - iz;
  const u = fx * fx * (3 - 2 * fx),
    v2 = fy * fy * (3 - 2 * fy),
    w = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => nfHash(ix + dx, iy + dy, iz + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v2),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v2),
    w,
  );
};
const nfVfbm = (px, py, pz) => {
  let a = 0.5,
    s = 0;
  for (let o = 0; o < 3; o++) {
    s += a * nfValue(px, py, pz);
    px = px * 2.03 + 11.5;
    py = py * 2.03 + 27.1;
    pz = pz * 2.03 + 5.7;
    a *= 0.5;
  }
  return s / 0.875; // 归一回 ~[0,1]
};
// ridged crease:abs(2v-1),v 的等值面变成"折痕"= 岩石节理读感。单 octave、
// 零循环 —— 最初实现是 3D cellular F1(Infinigen 原方 Voronoi),27-cell 三重
// 循环 + 后来的双 octave 都把 D3D pipeline 编译推到分钟级(GLSL 端注释详述)。
const nfRidge = (px, py, pz) => Math.abs(2 * nfValue(px, py, pz) - 1);
// sinfold:IQ 经典 sin 位移的 ridged 变体,每次求值只有 3 个 sin(值噪声要
// 8 角 hash ≈ 8 个 sin + 插值)。studio 档的完整 shader 在 D3D 上把 sceneSDF
// 内联进十几个调用点,fxc 成本 ∝ 场的 ALU × 调用点 —— 这是 decor 能负担的档。
const nfSinfold = (px, py, pz) =>
  Math.abs(Math.sin(px) * Math.sin(py * 1.13) * Math.sin(pz * 0.87));

export const noiseField = (kind = 'vfbm', freq = 1, amp = 0.05, offset = [0, 0, 0]) => {
  const f0 = numLit(freq),
    a0 = numLit(amp);
  const o0 = vecLit(offset);
  const kindIdx = kind === 'sinfold' ? 2 : kind === 'ridge' ? 1 : 0;
  const inst = SDF3((p) => {
    const qx = (p[0] + o0[0]) * f0,
      qy = (p[1] + o0[1]) * f0,
      qz = (p[2] + o0[2]) * f0;
    const v2 =
      kindIdx === 2
        ? nfSinfold(qx, qy, qz) - 0.5
        : kindIdx === 1
          ? nfRidge(qx, qy, qz) - 0.5
          : (nfVfbm(qx, qy, qz) - 0.5) * 2;
    return a0 * v2;
  });
  inst.ast = { kind: 'prim', name: 'noise-field', args: [kindIdx, freq, amp, offset] };
  return inst;
};

export const ellipsoid = (radii = [0.4, 0.3, 0.4]) => {
  const [rx, ry, rz] = vecLit(radii);
  const inst = SDF3((p) => {
    const px = p[0] / rx,
      py = p[1] / ry,
      pz = p[2] / rz;
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    if (k0 < 1e-9) return -Math.min(rx, ry, rz); // 中心点
    const px2 = p[0] / (rx * rx),
      py2 = p[1] / (ry * ry),
      pz2 = p[2] / (rz * rz);
    const k1 = Math.sqrt(px2 * px2 + py2 * py2 + pz2 * pz2);
    return (k0 * (k0 - 1)) / k1;
  });
  inst.ast = { kind: 'prim', name: 'ellipsoid', args: [radii] };
  return inst;
};

// rounded_box：立方体加圆角边。size = 全尺寸（halved 内部）；radius = 圆角半径
export const rounded_box = (size = 0.6, radius = 0.05) => {
  const sRaw = Array.isArray(size) ? size : [size, size, size];
  const s = vecLit(sRaw);
  const r0 = numLit(radius);
  const halfx = s[0] / 2,
    halfy = s[1] / 2,
    halfz = s[2] / 2;
  const inst = SDF3((p) => {
    const qx = Math.abs(p[0]) - halfx + r0;
    const qy = Math.abs(p[1]) - halfy + r0;
    const qz = Math.abs(p[2]) - halfz + r0;
    const ox = Math.max(qx, 0),
      oy = Math.max(qy, 0),
      oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r0;
  });
  inst.ast = { kind: 'prim', name: 'rounded_box', args: [size, radius] };
  return inst;
};

// capped_cone：任意两点 a/b 之间的截锥（frustum）。ra = a 端半径，rb = b 端半径。
// IQ canonical formula（用 baba 归一化）。
export const capped_cone = (a, b, ra = 0.3, rb = 0.1) => {
  const a0 = vecLit(a),
    b0 = vecLit(b),
    ra0 = numLit(ra),
    rb0 = numLit(rb);
  const inst = SDF3((p) => {
    const bax = b0[0] - a0[0],
      bay = b0[1] - a0[1],
      baz = b0[2] - a0[2];
    const pax = p[0] - a0[0],
      pay = p[1] - a0[1],
      paz = p[2] - a0[2];
    const baba = bax * bax + bay * bay + baz * baz;
    const papa = pax * pax + pay * pay + paz * paz;
    const paba = (pax * bax + pay * bay + paz * baz) / baba;
    const x = Math.sqrt(Math.max(0, papa - paba * paba * baba));
    const refR = paba < 0.5 ? ra0 : rb0;
    const cax = Math.max(0, x - refR);
    const cay = Math.abs(paba - 0.5) - 0.5;
    const rba = rb0 - ra0;
    const k = rba * rba + baba;
    const f = Math.max(0, Math.min(1, (rba * (x - ra0) + paba * baba) / k));
    const cbx = x - ra0 - f * rba;
    const cby = paba - f;
    const s = cbx < 0 && cay < 0 ? -1 : 1;
    return s * Math.sqrt(Math.min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
  });
  inst.ast = { kind: 'prim', name: 'capped_cone', args: [a, b, ra, rb] };
  return inst;
};

// cone：finite cone, base 在 y = -h/2 半径 baseRadius，tip 在 y = +h/2。
// 内部用 capped_cone（tip 用 0.001 微小半径避免数学退化）。
// AST override：cone 是独立 primitive，不要继承 capped_cone 的 AST。
export const cone = (height = 0.5, baseRadius = 0.3) => {
  const h0 = numLit(height),
    r0 = numLit(baseRadius);
  const inst = capped_cone([0, -h0 / 2, 0], [0, h0 / 2, 0], r0, 0.001);
  inst.ast = { kind: 'prim', name: 'cone', args: [height, baseRadius] };
  return inst;
};

// ---- Wave 2: Platonic solids + 装饰立体 + 3D 多轴 slab + wireframe -------

// tetrahedron：四面体（D4 骰子 / 钻石尖端）。r = 顶点距原点。
export const tetrahedron = (r = 0.4) => {
  const r0 = numLit(r);
  const inst = SDF3(
    (p) =>
      (Math.max(Math.abs(p[0] + p[1]) - p[2], Math.abs(p[0] - p[1]) + p[2]) - r0) / Math.sqrt(3),
  );
  inst.ast = { kind: 'prim', name: 'tetrahedron', args: [r] };
  return inst;
};

// octahedron：八面体（D8 骰子）。r = 顶点距原点。
export const octahedron = (r = 0.4) => {
  const r0 = numLit(r);
  const inst = SDF3((p) => {
    const px = Math.abs(p[0]);
    const py = Math.abs(p[1]);
    const pz = Math.abs(p[2]);
    const m = px + py + pz - r0;
    let qx, qy, qz;
    if (3 * px < m) {
      qx = px;
      qy = py;
      qz = pz;
    } else if (3 * py < m) {
      qx = py;
      qy = pz;
      qz = px;
    } else if (3 * pz < m) {
      qx = pz;
      qy = px;
      qz = py;
    } else return m * 0.57735027;
    const k = Math.max(0, Math.min(r0, 0.5 * (qz - qy + r0)));
    const dx = qx;
    const dy = qy - r0 + k;
    const dz = qz - k;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  });
  inst.ast = { kind: 'prim', name: 'octahedron', args: [r] };
  return inst;
};

// dodecahedron：十二面体（D12 骰子）。r = 顶点距原点。
export const dodecahedron = (r = 0.4) => {
  const r0 = numLit(r);
  const phi = (1 + Math.sqrt(5)) / 2;
  const len = Math.sqrt(1 + (1 + phi) * (1 + phi));
  const nx = 1 / len,
    ny = (1 + phi) / len;
  const inst = SDF3((p) => {
    const px = Math.abs(p[0]) / r0;
    const py = Math.abs(p[1]) / r0;
    const pz = Math.abs(p[2]) / r0;
    const a = px * nx + py * ny;
    const b = py * nx + pz * ny;
    const c = px * ny + pz * nx;
    return (Math.max(Math.max(a, b), c) - nx) * r0;
  });
  inst.ast = { kind: 'prim', name: 'dodecahedron', args: [r] };
  return inst;
};

// icosahedron：二十面体（D20 骰子）。r = 顶点距原点。
export const icosahedron = (r = 0.4) => {
  const r0 = numLit(r);
  const R = r0 * 0.8506507174597755;
  const phi = (1 + Math.sqrt(5)) / 2;
  const len = Math.sqrt(1 + (1 + phi) * (1 + phi));
  const nx = 1 / len,
    ny = (1 + phi) / len;
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
  const h0 = numLit(h);
  const m2 = h0 * h0 + 0.25;
  const inst = SDF3((p) => {
    let px = Math.abs(p[0]);
    let pz = Math.abs(p[2]);
    if (pz > px) {
      const t = px;
      px = pz;
      pz = t;
    }
    px -= 0.5;
    pz -= 0.5;
    const py = p[1];
    const qx = pz;
    const qy = h0 * py - 0.5 * px;
    const qz = h0 * px + 0.5 * py;
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
  const sRaw = Array.isArray(size) ? size : [size, size, size];
  const s = vecLit(sRaw);
  const bx = s[0] / 2,
    by = s[1] / 2,
    bz = s[2] / 2;
  const e = numLit(thickness);
  const dist3 = (a, b, c) => {
    const ox = Math.max(a, 0),
      oy = Math.max(b, 0),
      oz = Math.max(c, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(a, Math.max(b, c)), 0);
  };
  const inst = SDF3((p) => {
    const px = Math.abs(p[0]) - bx;
    const py = Math.abs(p[1]) - by;
    const pz = Math.abs(p[2]) - bz;
    const qx = Math.abs(px + e) - e;
    const qy = Math.abs(py + e) - e;
    const qz = Math.abs(pz + e) - e;
    return Math.min(Math.min(dist3(px, qy, qz), dist3(qx, py, qz)), dist3(qx, qy, pz));
  });
  inst.ast = { kind: 'prim', name: 'wireframe_box', args: [size, thickness] };
  return inst;
};

// tri_prism：三棱柱（截面三角形，轴沿 Z）。Autoscope houseS 三角屋顶用。
//   halfWidth = 三角形底半宽（X 方向），halfLength = 棱柱半长（Z 方向）
//   GLSL 端用 IQ sdTriPrism（已在 sdf3.glsl.js）
export const tri_prism = (halfWidth = 0.3, halfLength = 0.1) => {
  const hw = numLit(halfWidth),
    hl = numLit(halfLength);
  const k = Math.sqrt(3);
  const hxScaled = hw * 0.5 * k;
  const inst = SDF3((p) => {
    let px = p[0] / hxScaled;
    let py = p[1] / hxScaled;
    px = Math.abs(px) - 1.0;
    py = py + 1.0 / k;
    if (px + k * py > 0.0) {
      const npx = (px - k * py) / 2.0;
      const npy = (-k * px - py) / 2.0;
      px = npx;
      py = npy;
    }
    px -= Math.max(-2.0, Math.min(0.0, px));
    const d1 = Math.sqrt(px * px + py * py) * Math.sign(-py) * hxScaled;
    const d2 = Math.abs(p[2]) - hl;
    const a = Math.max(d1, 0),
      b = Math.max(d2, 0);
    return Math.sqrt(a * a + b * b) + Math.min(0, Math.max(d1, d2));
  });
  inst.ast = { kind: 'prim', name: 'tri_prism', args: [halfWidth, halfLength] };
  return inst;
};

// ============================================================================
// IQ canonical 3D primitives — P2 batch (2026-05-23)
// Source: https://iquilezles.org/articles/distfunctions/
// JS implementations translated from IQ's reference GLSL. GLSL helpers live
// in src/sdf/sdf3.glsl.js (sdCutSphere / sdCutHollowSphere / sdDeathStar /
// sdRoundedCylinder / sdRoundConeAB / sdVesicaSegment / sdCylinderInf /
// sdConeInf). Compile dispatch in src/sdf/sdf3.compile.js PRIMS.
// ============================================================================

// Sphere of radius r cut by horizontal plane at height h.
export const cutSphere = (r = 0.5, h = 0.0) => {
  const w = Math.sqrt(Math.max(r * r - h * h, 0));
  const inst = SDF3((p) => {
    const qx = Math.sqrt(p[0] * p[0] + p[2] * p[2]);
    const qy = p[1];
    const s = Math.max((h - r) * qx * qx + w * w * (h + r - 2 * qy), h * qx - w * qy);
    if (s < 0) return Math.sqrt(qx * qx + qy * qy) - r;
    if (qx < w) return h - qy;
    const dx = qx - w,
      dy = qy - h;
    return Math.sqrt(dx * dx + dy * dy);
  });
  inst.ast = { kind: 'prim', name: 'cut-sphere', args: [r, h] };
  return inst;
};

// Hollow cut sphere: sphere cap with shell thickness t.
export const cutHollowSphere = (r = 0.5, h = 0.0, t = 0.02) => {
  const w = Math.sqrt(Math.max(r * r - h * h, 0));
  const inst = SDF3((p) => {
    const qx = Math.sqrt(p[0] * p[0] + p[2] * p[2]);
    const qy = p[1];
    const d =
      h * qx < w * qy
        ? Math.sqrt((qx - w) ** 2 + (qy - h) ** 2)
        : Math.abs(Math.sqrt(qx * qx + qy * qy) - r);
    return d - t;
  });
  inst.ast = { kind: 'prim', name: 'cut-hollow-sphere', args: [r, h, t] };
  return inst;
};

// Death Star: sphere ra with sphere rb of distance d carved out.
export const deathStar = (ra = 0.5, rb = 0.35, d = 0.5) => {
  const a = (ra * ra - rb * rb + d * d) / (2 * d);
  const b = Math.sqrt(Math.max(ra * ra - a * a, 0));
  const inst = SDF3((p) => {
    const px = p[0];
    const py = Math.sqrt(p[1] * p[1] + p[2] * p[2]);
    if (px * b - py * a > d * Math.max(b - py, 0)) {
      const dx = px - a,
        dy = py - b;
      return Math.sqrt(dx * dx + dy * dy);
    }
    const inner = Math.sqrt(px * px + py * py) - ra;
    const carve = -(Math.sqrt((px - d) * (px - d) + py * py) - rb);
    return Math.max(inner, carve);
  });
  inst.ast = { kind: 'prim', name: 'death-star', args: [ra, rb, d] };
  return inst;
};

// Rounded cylinder: ra = body radius, rb = corner-roll radius, h = half-height.
export const roundedCylinder = (ra = 0.3, rb = 0.05, h = 0.5) => {
  const inst = SDF3((p) => {
    const dx = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - 2 * ra + rb;
    const dy = Math.abs(p[1]) - h;
    const ox = Math.max(dx, 0),
      oy = Math.max(dy, 0);
    return Math.min(Math.max(dx, dy), 0) + Math.sqrt(ox * ox + oy * oy) - rb;
  });
  inst.ast = { kind: 'prim', name: 'rounded-cylinder', args: [ra, rb, h] };
  return inst;
};

// Round cone between arbitrary endpoints a,b with end radii r1,r2.
export const roundConeAB = (a = [0, 0, 0], b = [0, 1, 0], r1 = 0.2, r2 = 0.1) => {
  const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / Math.max(l2, 1e-12);
  const inst = SDF3((p) => {
    const pa = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const y = pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2];
    const z = y - l2;
    const xv = [pa[0] * l2 - ba[0] * y, pa[1] * l2 - ba[1] * y, pa[2] * l2 - ba[2] * y];
    const x2 = xv[0] * xv[0] + xv[1] * xv[1] + xv[2] * xv[2];
    const y2 = y * y * l2;
    const z2 = z * z * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
  });
  inst.ast = { kind: 'prim', name: 'round-cone-ab', args: [a, b, r1, r2] };
  return inst;
};

// Vesica segment: lens/eye shape between points a,b with half-width w.
export const vesicaSegment = (a = [0, 0, 0], b = [0, 1, 0], w = 0.2) => {
  const c = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
  const l = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2);
  const v0 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l];
  const inst = SDF3((p) => {
    const dx = p[0] - c[0],
      dy = p[1] - c[1],
      dz = p[2] - c[2];
    const y = dx * v0[0] + dy * v0[1] + dz * v0[2];
    const ax = dx - y * v0[0],
      ay = dy - y * v0[1],
      az = dz - y * v0[2];
    const qx = Math.sqrt(ax * ax + ay * ay + az * az);
    const qy = Math.abs(y);
    const r = 0.5 * l;
    const d0 = (0.5 * (r * r - w * w)) / w;
    const h = r * qx < d0 * (qy - r) ? [0, r, 0] : [-d0, 0, d0 + w];
    const ddx = qx - h[0],
      ddy = qy - h[1];
    return Math.sqrt(ddx * ddx + ddy * ddy) - h[2];
  });
  inst.ast = { kind: 'prim', name: 'vesica-segment', args: [a, b, w] };
  return inst;
};

// Infinite cylinder: axisXZ = [cx, cz] axis offset in XZ plane; radius.
export const cylinderInf = (axisXZ = [0, 0], radius = 0.3) => {
  const cx = axisXZ[0],
    cz = axisXZ[1];
  const inst = SDF3((p) => {
    const dx = p[0] - cx,
      dz = p[2] - cz;
    return Math.sqrt(dx * dx + dz * dz) - radius;
  });
  inst.ast = { kind: 'prim', name: 'cylinder-inf', args: [axisXZ, radius] };
  return inst;
};

// Infinite cone: tip at origin, half-aperture angle. Cone opens upward.
export const coneInf = (halfAperture = Math.PI / 6) => {
  const sa = Math.sin(halfAperture),
    ca = Math.cos(halfAperture);
  const inst = SDF3((p) => {
    const qx = Math.sqrt(p[0] * p[0] + p[2] * p[2]);
    const qy = -p[1];
    const dotQC = Math.max(qx * sa + qy * ca, 0);
    const dx = qx - sa * dotQC,
      dy = qy - ca * dotQC;
    const d = Math.sqrt(dx * dx + dy * dy);
    return d * (qx * ca - qy * sa < 0 ? -1 : 1);
  });
  inst.ast = { kind: 'prim', name: 'cone-inf', args: [halfAperture] };
  return inst;
};

// ============================================================================
// waves —— Autoscope 海浪地面（time-aware primitive）
// ----------------------------------------------------------------------------
// 等高面：y = sin(speed*u_time + p_rotated.z / freq) * amp - amp
// CPU eval freeze t=0 → 静态波。GPU 端 compile.js emits sdWaves 含 u_time。
// freq=波长，amp=振幅，angle=绕 Y 旋转（让波纹斜向），speed=时间标度（0 = 静止）
// ============================================================================
export const waves = (freq = 2, amp = 0.5, angle = 0, speed = 0) => {
  const f0 = numLit(freq),
    a0 = numLit(amp),
    ang0 = numLit(angle);
  // speed 是 shader-side time scale，CPU 端 freeze u_time=0 → speed*0=0，所以不用 speed
  const c = Math.cos(ang0),
    s = Math.sin(ang0);
  const inst = SDF3((p) => {
    const pz = -s * p[0] + c * p[2]; // rotateY(p, angle).z
    return p[1] + Math.sin(pz / f0) * a0 - a0;
  });
  inst.ast = { kind: 'prim', name: 'waves', args: [freq, amp, angle, speed] };
  return inst;
};

// ---- Wave 2C: 3D artistic ops -------------------------------------------

// twist：沿 Y 轴扭转 SDF（input-space rotation that varies with y）。
//   k = 弧度 / 单位 Y。k=1 时每升高 1 单位整体扭转 1 rad（约 57°）
//   生成 spiral / 螺旋 / 拧麻花视觉
export const twist = defineOp3('twist', (other, k) => {
  const k0 = numLit(k);
  return (p) => {
    const c = Math.cos(k0 * p[1]);
    const s = Math.sin(k0 * p[1]);
    const x = c * p[0] - s * p[2];
    const z = s * p[0] + c * p[2];
    return other.f([x, p[1], z]);
  };
});

// bend：沿 X 轴弯曲（XY 平面内的弧）。k = 曲率（rad / 单位 X）。
//   k=2 → 整体卷成 U 形；k=π → 闭合成圆
export const bend = defineOp3('bend', (other, k) => {
  const k0 = numLit(k);
  return (p) => {
    const c = Math.cos(k0 * p[0]);
    const s = Math.sin(k0 * p[0]);
    const x = c * p[0] - s * p[1];
    const y = s * p[0] + c * p[1];
    return other.f([x, y, p[2]]);
  };
});

// curve：sinusoidal X-offset driven by another axis. The Venice canal idiom
// (x += 20*sin(z*0.02)) generalised — any axis can drive the sin, and the
// X offset deforms the whole child SDF. Composes for highways, river banks,
// mountain passes, long galleries, anything that snakes along a path.
//
//   amp:      sine amplitude (in world units)
//   freq:     sine frequency (rad / unit of driver axis)
//   axisIdx:  0=x, 1=y, 2=z (default 2 = z). Caller converts 'z' string.
export const curve = defineOp3('curve', (other, amp, freq, axisIdx = 2) => {
  const a = numLit(amp);
  const f = numLit(freq);
  const ax = axisIdx | 0;
  return (p) => {
    const off = a * Math.sin(p[ax] * f);
    return other.f([p[0] - off, p[1], p[2]]);
  };
});

// modPolar (hg_sdf pModPolar)：把垂直于某轴的平面分成 N 等分扇形，源 SDF 在
// 折叠后的扇形内 evaluate → 围绕轴重复 N 次。用例：clock dial / gear teeth /
// rose-window 花瓣 / dome 肋 / fan 叶片 / mandala。
// opts.axis: 'x' | 'y' | 'z' (默认 'y'：垂直轴，最常见的环状重复)
// opts.repetitions: number >= 2 (默认 6)
const _polarFold = (x, y, n) => {
  const angle = (2 * Math.PI) / n;
  let a = Math.atan2(y, x) + angle * 0.5;
  const r = Math.hypot(x, y);
  a = (((a % angle) + angle) % angle) - angle * 0.5;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

export const modPolar = defineOp3('modPolar', (other, opts = {}) => {
  const axis = opts.axis ?? 'y';
  const n = opts.repetitions ?? 6;
  if (axis === 'x') {
    return (p) => {
      const [y, z] = _polarFold(p[1], p[2], n);
      return other.f([p[0], y, z]);
    };
  } else if (axis === 'z') {
    return (p) => {
      const [x, y] = _polarFold(p[0], p[1], n);
      return other.f([x, y, p[2]]);
    };
  } else {
    return (p) => {
      const [x, z] = _polarFold(p[0], p[2], n);
      return other.f([x, p[1], z]);
    };
  }
});

// mirrorOctant (hg_sdf pMirrorOctant)：在某个平面内同时对两个坐标轴做镜像 +
// 对角线交换，产生 8 向对称。用例：snowflake / mandala 基底 / 对称装饰板 /
// 哥特玫瑰窗排列。
// opts.plane: 'xz' | 'xy' | 'yz' (默认 'xz'：地面对称，最常用)
// opts.dist:  [d1, d2] (默认 [0, 0])，把镜像线从原点偏出
const _mirrorOctant2D = (x, y, d1, d2) => {
  let qx = Math.abs(x) - d1;
  let qy = Math.abs(y) - d2;
  if (qy > qx) {
    const t = qx;
    qx = qy;
    qy = t;
  }
  return [qx, qy];
};

export const mirrorOctant = defineOp3('mirrorOctant', (other, opts = {}) => {
  const plane = opts.plane ?? 'xz';
  const [d1, d2] = Array.isArray(opts.dist) ? opts.dist : [0, 0];
  if (plane === 'xy') {
    return (p) => {
      const [x, y] = _mirrorOctant2D(p[0], p[1], d1, d2);
      return other.f([x, y, p[2]]);
    };
  } else if (plane === 'yz') {
    return (p) => {
      const [y, z] = _mirrorOctant2D(p[1], p[2], d1, d2);
      return other.f([p[0], y, z]);
    };
  } else {
    return (p) => {
      const [x, z] = _mirrorOctant2D(p[0], p[2], d1, d2);
      return other.f([x, p[1], z]);
    };
  }
});

// ---- Transforms ------------------------------------------------------------

export const translate = defineOp3('translate', (other, offset) => {
  const o = vecLit(offset);
  return (p) => other.f(v.sub(p, o));
});

export const scale = defineOp3('scale', (other, factor) => {
  const s = vecLit(v.asVec3(factor));
  // 非均匀缩放不是精确 SDF；用最小分量补偿减小误差，与 Python 一致
  const m = Math.min(s[0], s[1], s[2]);
  return (p) => other.f([p[0] / s[0], p[1] / s[1], p[2] / s[2]]) * m;
});

// rotate(angle, axis)：把点逆向旋转到原始坐标系，等价于把形状正向旋转
export const rotate = defineOp3('rotate', (other, angle, axis = v.Z) => {
  const a0 = numLit(angle);
  const axis0 = vecLit(axis);
  const m = v.rotMat(-a0, axis0);
  return (p) => other.f(v.matMul(m, p));
});

// orient(axis)：把"原本朝 +Z 的形状"重新朝向 axis 方向
// 这是 fogleman 经典 demo 'sphere & box - cyl.orient(X|Y|Z)' 的关键
export const orient = defineOp3('orient', (other, axis) => {
  const target = v.normalize(vecLit(axis));
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

// ----------------------------------------------------------------------------
// rotateXYZ([rx, ry, rz]) —— Three.js / Blender 风格 Euler 旋转
// ----------------------------------------------------------------------------
// 内部 decompose 成 .rotate(rx, X).rotate(ry, Y).rotate(rz, Z) 链。AST 自然
// 是嵌套 rotate ops，compiler 直接支持（不需新 emit 规则）。
// XYZ intrinsic 顺序 = ZYX extrinsic（标准 graphics 约定）。
export function rotateXYZ(sdf, euler) {
  if (!Array.isArray(euler) || euler.length !== 3) {
    throw new Error(`rotateXYZ: expected [rx, ry, rz] euler array`);
  }
  let result = sdf;
  if (euler[0]) result = result.rotate(euler[0], [1, 0, 0]);
  if (euler[1]) result = result.rotate(euler[1], [0, 1, 0]);
  if (euler[2]) result = result.rotate(euler[2], [0, 0, 1]);
  return result;
}

// 给 SDF3 prototype 加 chain 版
SDF3.prototype.rotateXYZ = function (euler) {
  return rotateXYZ(this, euler);
};

// Patch SDF3.prototype.rotate：检测 LLM 常用的 Euler array 第一参数 → 自动
// dispatch 到 rotateXYZ。原签名 .rotate(angle, axis) 不变；新增 .rotate([rx,ry,rz])。
// 解析规则：第一参数是 length===3 array 且第二参数 undefined → Euler form
const _originalRotateProto = SDF3.prototype.rotate;
SDF3.prototype.rotate = function (angleOrEuler, axis) {
  if (Array.isArray(angleOrEuler) && angleOrEuler.length === 3 && axis === undefined) {
    return this.rotateXYZ(angleOrEuler);
  }
  return _originalRotateProto.call(this, angleOrEuler, axis);
};
