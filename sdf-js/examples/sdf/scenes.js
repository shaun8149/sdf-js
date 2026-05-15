// =============================================================================
// BOB 6 个 2D 场景的 SDF 库（painted 渲染和 debug 渲染共用）
// -----------------------------------------------------------------------------
// 单文件出口：
//   - r()                    BOB 风格随机助手
//   - makePa(sceneOverride)  构造一组 pa 参数（随机/带 override）
//   - makesdf(pa, {invertBuildings}) 返回该场景的 SDF2 数组（按图层叠加顺序）
// 渲染器在另外的文件里：painted-scenes.js / scenes-debug.js
// =============================================================================

import {
  circle, rectangle, rounded_rectangle, line,
  equilateral_triangle, polygon, triangle, trapezoid, flower,
  union,
  SDF2,
} from '../../src/index.js';

// ---- v2 (LLM × SDF round 2) 场景 SDF 入口 ---------------------------------
// 每个 v2 文件 export 一个 getSdfs() 返回该场景的 base SDF 列表（不含 dilate 描边）
import { getSdfs as treeV2Sdfs }      from './test-tree-v2.js';
import { getSdfs as boatV2Sdfs }      from './test-boat-v2.js';
import { getSdfs as cathedralV2Sdfs } from './test-cathedral-v2.js';
import { getSdfs as butterflyV2Sdfs } from './test-butterfly-v2.js';
import { getSdfs as hatmanV2Sdfs }    from './test-hatman-v2.js';
import { getDanceSdfs as danceSdfs }  from './llm-round1.js';
import { getSdfs as seuratV2Sdfs }    from './test-seurat-v2.js';

// ---- BOB-style random helper (r() / r([arr]) / r(lo, hi)) ------------------
export const r = (...args) => {
  if (args.length === 0) return Math.random();
  if (args.length === 1) return args[0][Math.floor(Math.random() * args[0].length)];
  return args[0] + Math.random() * (args[1] - args[0]);
};

// ---- 场景元数据：每个 scene 自报 view + y-convention -----------------------
// 渲染器消费这些值（不查 scene 范围）。加新场景就在表里加一行，渲染器永不动。
//   yConvention: 'down' = canvas 约定（y+ 朝下，BOB 原版）
//                'up'   = math 约定（y+ 朝上，LLM v2 输出习惯）
//   view:        半边长（世界坐标 ±view）
const SCENE_META = {
  1:  { yConvention: 'down', view: 1.0 },     // BOB cactus
  2:  { yConvention: 'down', view: 1.0 },     // BOB tree + boat
  3:  { yConvention: 'down', view: 1.0 },     // BOB bridge
  4:  { yConvention: 'down', view: 1.0 },     // BOB buildings (far)
  5:  { yConvention: 'down', view: 1.0 },     // BOB buildings (near)
  6:  { yConvention: 'down', view: 1.0 },     // BOB brick wall
  7:  { yConvention: 'down', view: 1.0 },     // BOB folded-plane bird
  8:  { yConvention: 'up',   view: 1.2 },     // LLM v2 tree
  9:  { yConvention: 'up',   view: 1.2 },     // LLM v2 boat
  10: { yConvention: 'up',   view: 1.2 },     // LLM v2 cathedral
  11: { yConvention: 'up',   view: 1.2 },     // LLM v2 butterfly
  12: { yConvention: 'up',   view: 1.2 },     // LLM v2 hatman
  13: { yConvention: 'up',   view: 1.2 },     // LLM (v1) Matisse dance
  14: { yConvention: 'up',   view: 1.2 },     // LLM v2 seurat
  // ---- 3D 场景：probe-based painted 渲染（其它 renderer 暂不支持）-----------
  // 2026-05-15: probe.rayFor 统一到 math-y-up 后，3D 场景 yConvention 必须 'up'
  // 才让 painted.pxToWorld(flipY=true) → 传 math-y-up → 跟 probe 一致
  15: { yConvention: 'up', view: 1.0, kind: '3d' },     // BOB 原 7：单球+平面
  16: { yConvention: 'up', view: 1.0, kind: '3d' },     // BOB 原 8：4 胶囊+平面
};

// pa 参数集合（每次加载或调用产生一组）。
//   1..7   BOB 场景
//   8..14  LLM × SDF round 2 的 v2 场景（昨天用改良 SKILL.md prompt 跑出的输出）
// 随机池只取 1..6（不含鸟和 v2），其它场景需要 URL hash 显式指定。
export const makePa = (sceneOverride) => {
  const _scene = (sceneOverride >= 1 && sceneOverride <= 16)
    ? sceneOverride
    : r([1, 2, 3, 4, 5, 6]);
  const meta = SCENE_META[_scene] || { yConvention: 'down', view: 1.0 };
  return {
    scene:              _scene,
    view:               meta.view,
    yConvention:        meta.yConvention,
    kind:               meta.kind || '2d',     // '2d' (default) | '3d'
    // 场景几何参数（与 BOB sketch.js 的 setPa 对齐）
    cy:                 0.4,
    cy2:                -0.75,
    moonlocalation1:    r() * 2 - 1,
    moonlocalation2:    r() * 1.2 - 0.6,
    bridgelocation:     r() * 0.5 - 0.25,
    gatelocation:       r(0.75, 0.99),
    MOON:               r() > 0.5,
    wallRotate:         r([0, 1, 2, 3]),
    wallFract:          r([3, 4, 5, 6]),
    wallSize:           r([1, 1.2, 1.5, 1.8, 2, 2.2, 2]),
    // 渲染相关参数（painted 用）
    middleScaleSize:    6,
    smallScaleSize:     2,
    middleRotate:       r(-0.0025, 0.0025),
    smallscalevariance: r(0.1, 0.2),
    layers:             r([3, 4, 5, 6, 7]),
    smallOffset:        r([1, 2, 3, 4, 5, 6, 7, 8]),
    smallSegs:          r([4, 5, 6, 7]),
    noiseScale:         r(0.02, 0.06),
    rH:                 r() < 0.7 ? r(0.1, 1.2) : 0,
    rV:                 r() < 0.3 ? r(0.1, 1.2) : 0,
    brushSpeed:         r([1, 2, 3, 4]),
    bg:                 '#fdf9f6',
  };
};

// ---- 周期折叠 / GLSL 风格 step --------------------------------------------
const sdfRep = (x, p) => {
  const v = x / p;
  return (v - Math.floor(v) - 0.5) * p;
};
const step1 = (edge, x) => (x >= edge ? 1 : 0);

// ---- 共享形状构造（与 BOB scenes/2d.js 同名函数对照）---------------------

// BOB sdf_moon: 2x scale 的"大圆 - 小圆 = 月牙"。注意 BOB 没用上 cy 参数
const makeMoon = (cx) => {
  const big = circle(0.5).translate([0.3, 0.1]);
  const small = circle(0.55).translate([-0.15, -0.45]);
  return SDF2(([x, y]) => {
    const px = (x - cx) * 2;
    const py = (y - (-0.8)) * 2;
    return Math.max(big.f([px, py]), -small.f([px, py])) / 2;
  });
};
const makeSunset = (cx, cy) => circle(0.25).translate([cx, cy]);

const tiltedLine = (cy, k = 0) =>
  SDF2(([x, y]) => -(y - cy - k * x));
const sineLine = (cy, k = 0) =>
  SDF2(([x, y]) => -(y - cy - 0.05 * Math.sin(k * x * Math.PI * 10)));

// Scene 1 - 仙人掌 + 十字门
const makeCactus = () =>
  union(
    rounded_rectangle([0.30, 1.60], [0, 0.15, 0, 0.15]),
    rounded_rectangle([0.20, 0.80], [0, 0.10, 0, 0.10]).translate([ 0.30,  0.10]),
    rounded_rectangle([0.20, 0.80], [0, 0.10, 0, 0.10]).translate([-0.30, -0.10]),
    rounded_rectangle([0.20, 0.20], 0.05).translate([ 0.20, 0.40]),
    rounded_rectangle([0.20, 0.20], 0.05).translate([-0.20, 0.20]),
  ).scale(1 / 1.5).translate([0, 0.2]);

const makeCrossGate = (cx) =>
  rectangle([0.20, 0.20])
    .difference(rectangle([0.16, 0.16]))
    .rotate(Math.PI / 4)
    .scale([0.5, 1])
    .translate([cx, 0.25]);

// Scene 2 - 花树 + 帆船
const makeTree = () => {
  const flowerSDF = flower(0.12, 10, 20);
  return SDF2(([x, y]) => {
    const flowerD = flowerSDF.f([x, y]);
    const angle = Math.PI / 25;
    const c = Math.cos(angle), s = Math.sin(angle);
    const px = c * x - s * y;
    const py = s * x + c * y;
    let linsin = Math.abs(px) - 0.04 - 0.01 * Math.sin(py * 3.14 * 8);
    const sdf3 = -y;
    const sdf4 = -y + 0.9;
    const sdf34 = Math.max(sdf3, -sdf4);
    linsin += Math.exp((-20 * (y + 1)) / 2);
    return Math.min(flowerD, Math.max(sdf34, linsin));
  });
};

const makeBoat = (cy) => {
  const body = trapezoid([0, 0], [0, 0.25], 0.5, 0.3);
  // BOB 的 sdTrapezoid 内部有 p[1] = -p[1] 翻转，sdTriangle 没有 →
  // BOB 原版船帆尖端朝下（船 + 水中倒影 / 或者 BOB 写错了）。
  // 这里把帆的顶点 y 取反，让尖端朝上（正常船的视觉）。
  const sail1 = triangle([0, 0],     [0, 0.8],  [0.35, 0]);
  const sail2 = triangle([0, 0.05],  [0, 0.7],  [-0.35, 0.05]);
  return SDF2(([x, y]) => {
    const px = (x - 0.8) * 4;
    const py = (-y - (-cy + 0.05)) * 4;
    const p = [px, py];
    return Math.min(body.f(p), sail1.f(p), sail2.f(p)) / 4;
  });
};

// Scene 3 - 拱桥
const makeBridge = (cx, cy, leftLeaning) => {
  const c1 = circle(0.8).translate(leftLeaning ? [ 0.2, 0] : [-0.2, 0]);
  const c2 = circle(0.8).translate(leftLeaning ? [-0.3, 0] : [ 0.3, 0]);
  return SDF2(([wx, wy]) => {
    const x = wx + cx;
    const y = wy;
    const p = [x, y - cy];
    const moon = Math.max(c1.f(p), -c2.f(p));
    const above = Math.max(moon, y - cy);
    let under = Math.max(moon, -y - cy);
    let minLine = Infinity;
    for (let i = 0; i < 7; i++) {
      const lin = Math.abs((-y + cy) + 0.1 * i) - 0.025;
      if (lin < minLine) minLine = lin;
    }
    under = Math.max(minLine, under);
    return Math.min(under, above);
  });
};

// Scene 4/5 - 建筑群（id-参数化的 1D 周期）
//   options.invertBuildings: BOB 原版 true → 天空被染色、建筑保留纸底
//                            false       → 标准 SDF（建筑是 negative-inside 形状）
//
// 修正：BOB 的 xRepeated 把 x 量化到唯一 id 槽，每个槽只查一个建筑。但对大建筑
// （scene 5 高 |id|），lx 范围 [-0.165, 0.165] 乘以 scaleN 后 bx 不够覆盖整栋墙
// （墙在 |bx|∈[0.5,0.6]）→ 大建筑的左右竖墙完全画不出来。
// 这里改成对附近多个 id 都求一次 SDF 取 min，让大建筑的墙能"溢出"到邻居槽里。
const makeBuildings = (scene, { invert = true } = {}) => {
  // BOB sdf_box 把 [w,h] 当"全尺寸"（内部 *0.5 → 半边长）。
  // 我的 rectangle(size) 也是收全尺寸，内部 /2 → 半边长。所以这里直接用 BOB 原值。
  const outer = rectangle([0.6, 1.6]);                      // 半边 [0.3, 0.8]
  const inner = rectangle([0.5, 1.5]);                      // 半边 [0.25, 0.75]
  const win   = rectangle([0.2, 0.2]);                      // 半边 [0.1, 0.1]

  // BOB sdEtriangle(q, r) 行内复刻：内部 p[1] = -p[1] 让三角尖朝 Y-down 的上方
  const sdEtriangle = (qx, qy, r) => {
    const k = Math.sqrt(3);
    let p0 = qx, p1 = -qy;
    p0 = Math.abs(p0) - r / 2;
    p1 = p1 + r / k / 2;
    if (k * p1 + p0 > 0) {
      const np0 = (p0 - k * p1) / 2;
      const np1 = (-k * p0 - p1) / 2;
      p0 = np0; p1 = np1;
    }
    p0 -= Math.max(-r, Math.min(0, p0));
    return -Math.sqrt(p0 * p0 + p1 * p1) * Math.sign(p1);
  };

  // 单个 id 的建筑 SDF（标准形式：negative-inside）
  const buildingForId = (x, y, id) => {
    const offsetY = scene === 4 ? 0.22 + id * 0.05 : 0.22 - id * 0.05;
    const scaleN  = scene === 4 ? 4 + id * 0.75   : 4 - id * 0.75;
    if (scaleN <= 0.1) return Infinity;

    const lx = x - 0.33 * id;
    const bx = lx * scaleN;
    const by = (y - offsetY) * scaleN;

    const roof = sdEtriangle(bx, by + 1, 0.6);
    const building0 = Math.max(outer.f([bx, by]), -inner.f([bx, by]));

    let wx = bx, wy = by;
    if (Math.abs(bx) < 0.1) wx = sdfRep(bx, 0.25);
    if (Math.abs(by) < 0.8) wy = sdfRep(by, 0.4);
    const window = win.f([wx, wy]);

    return Math.min(building0, window, roof) / scaleN;
  };

  return SDF2(([x, y]) => {
    if (invert) {
      // BOB 原版行为：每个 x 只属于最近的 id 槽，不和邻居 union。
      // 这样反转后"天空"才有大片连续区域可以被染色（painted 风格依赖这点）。
      // 副作用：scene 5 高 |id| 大建筑的左右竖墙在槽外画不出来 —— 这是 BOB 本身就有的限制。
      const id = Math.round(x / 0.33);
      return -buildingForId(x, y, id);
    } else {
      // 非反转模式（debug / sand 风格）：union 邻居 id，让大建筑的墙不被槽边界裁掉
      let m = Infinity;
      for (let id = -4; id <= 4; id++) {
        const d = buildingForId(x, y, id);
        if (d < m) m = d;
      }
      return m;
    }
  });
};

// Scene 6 - 砖墙
const brickPattern = (pa) =>
  SDF2(([x, y]) => {
    let px = x, py = y;
    if (py > -0.5) {
      px *= pa.wallFract;
      py *= pa.wallFract;
    }
    px += step1(1, py % 2) * 0.5;
    px = px - Math.floor(px);
    py = py - Math.floor(py);
    px -= 0.5;
    py -= 0.5;
    const offset = Math.random() * 0.1 - 0.05;
    // BOB sdf_box 收"全尺寸"，这里 *0.5 转半尺寸
    const half = (0.45 + offset) * pa.wallSize * 0.5;
    const qx = Math.abs(px - 0.05) - half;
    const qy = Math.abs(py - 0.05) - half;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ox * ox + oy * oy);
  });

// Scene 7 - 折面鸟（14 个三角形 union）
// -----------------------------------------------------------------------------
// 来源：用户提供的代码。每个 lin* 是一条直线 (y - slope*x + offset)；
// 每 3 条 lin 通过 max 取交集组成一个三角形，14 个三角形 min 并起来 = 鸟
// -----------------------------------------------------------------------------
const makeBird = () =>
  SDF2(([x, y]) => {
    const lin11 = y + 0.72 * x - 0.56;
    const lin12 = y - 6.19 * x - 1.17;
    const lin13 = y + 4.62 * x + 1.8;
    const lin1 = Math.max(Math.max(lin11, -lin12), -lin13);

    const lin21 = y - 0.61;
    const lin22 = y - 2.26 * x - 0.06;
    const lin23 = y - 6.11 * x - 1.05;
    const lin2 = Math.max(Math.max(-lin22, lin23), lin21);

    const lin31 = y + 6.71 * x - 2.38;
    const lin32 = y - 0.14 * x + 0.5;
    const lin33 = y - 2.24 * x - 0.02;
    const lin3 = Math.max(Math.max(-lin32, lin33), lin31);

    const lin41 = y - 1.26 * x + 0.97;
    const lin42 = y + 3.72 * x - 1.63;
    const lin43 = y + 6.53 * x - 2.42;
    const lin4 = Math.max(Math.max(lin42, -lin43), -lin41);

    const lin51 = y - 4.22 * x + 2.21;
    const lin52 = y - 0.13 * x + 0.52;
    const lin53 = y + 0.35 * x + 0.63;
    const lin5 = Math.max(Math.max(lin52, -lin53), -lin51);

    const lin61 = y - 0.39 * x + 0.89;
    const lin62 = y + 0.67 * x + 0.72;
    const lin63 = y + 0.35 * x + 0.64;
    const lin6 = Math.max(Math.max(-lin62, lin63), -lin61);

    const lin71 = y - 0.30 * x + 1.00;
    const lin72 = y - 3.69 * x + 2.08;
    const lin73 = y + 0.26 * x + 0.67;
    const lin7 = Math.max(Math.max(lin72, lin73), -lin71);

    const lin81 = y + 2.53 * x + 0.15;
    const lin82 = y - 0.43 * x + 1.03;
    const lin83 = y - 1.19 * x + 1.11;
    const lin8 = Math.max(Math.max(lin81, -lin82), lin83);

    const lin91 = y - 3.67 * x + 2.02;
    const lin92 = y + 2.62 * x + 0.08;
    const lin93 = y - 0.40 * x + 0.91;
    const lin9 = Math.max(Math.max(lin93, -lin92), -lin91);

    const lin101 = y - 1.12 * x + 1.09;
    const lin102 = y + 0.47 * x + 0.95;
    const lin103 = y - 0.43 * x + 0.92;
    const lin10 = Math.max(Math.max(lin103, -lin102), -lin101);

    const lin111 = y - 0.46 * x + 0.90;
    const lin112 = y + 1.17 * x + 0.99;
    const lin113 = y + 0.02 * x + 0.84;
    const lin11f = Math.max(Math.max(lin113, -lin112), -lin111);

    const lin121 = y + 1.90 * x + 1.05;
    const lin122 = y + 0.38 * x + 0.78;
    const lin123 = y + 0.68 * x + 0.74;
    const lin12f = Math.max(Math.max(lin123, -lin122), -lin121);

    const lin131 = y - 1.14 * x + 1.26;
    const lin132 = y + 0.999;
    const lin133 = y - 0.39 * x + 1.04;
    const lin13f = Math.max(Math.max(lin133, -lin132), -lin131);

    const lin141 = y + 0.05 * x + 0.83;
    const lin142 = y + 2.57 * x + 1.17;
    const lin143 = y + 0.37 * x + 0.79;
    const lin14f = Math.max(Math.max(lin143, -lin142), -lin141);

    return Math.min(
      lin1, lin2, lin3, lin4, lin5, lin6, lin7,
      lin8, lin9, lin10, lin11f, lin12f, lin13f, lin14f,
    );
  });

const makeWall = (pa) => {
  const bricks = brickPattern(pa);
  return SDF2(([x, y]) => {
    let px = x - (-0.5), py = y;
    const ang = pa.wallRotate * Math.PI / 2;
    const c = Math.cos(ang), s = Math.sin(ang);
    [px, py] = [c * px + s * py, -s * px + c * py];     // BOB 的 rot2+trans2 ≈ 旋转 -ang
    px *= 2;                                              // 列主序 [2,0,0,1] → px *= 2
    const shx = (1 - px) * 0.5;
    const shy = -py;
    const sh = shx * shy;
    py = sh * px + py;                                    // 列主序 [1,sh,0,1] → py = sh*px+py
    return bricks.f([px, py]);
  });
};

// ============================================================================
// 派发器：根据 pa.scene 装配 SDF 数组（顺序 = 图层叠加顺序）
// ============================================================================
export const makesdf = (pa, options = {}) => {
  const sdfs = [];

  // 场景 1/2/3 共享：月（或落日）+ 地平线
  if ([1, 2, 3].includes(pa.scene)) {
    sdfs.push(pa.MOON
      ? makeMoon(pa.moonlocalation1)
      : makeSunset(pa.moonlocalation1, pa.cy2));
    sdfs.push(tiltedLine(pa.cy));
  }

  if (pa.scene === 1) {
    sdfs.push(makeCactus());
    sdfs.push(makeCrossGate(pa.gatelocation));
  }

  if (pa.scene === 2) {
    sdfs.push(makeTree());
    sdfs.push(makeBoat(pa.cy));
  }

  if (pa.scene === 3) {
    const left = r() > 0.5;
    sdfs.push(makeBridge(pa.bridgelocation, pa.cy, left));
  }

  if (pa.scene === 4 || pa.scene === 5) {
    sdfs.push(makeBuildings(pa.scene, options));
    sdfs.push(makeMoon(pa.moonlocalation2));
    const k = pa.scene === 4 ? 0.1 : -0.1;
    sdfs.push(r() > 0.33 ? tiltedLine(pa.cy, k) : sineLine(pa.cy, k));
  }

  if (pa.scene === 6) {
    if (r() > 0.5) sdfs.push(tiltedLine(pa.cy));
    sdfs.push(makeWall(pa));
  }

  if (pa.scene === 7) {
    sdfs.push(makeBird());
  }

  // ---- 8..14: LLM v2 场景 ----
  if (pa.scene === 8)  sdfs.push(...treeV2Sdfs());
  if (pa.scene === 9)  sdfs.push(...boatV2Sdfs());
  if (pa.scene === 10) sdfs.push(...cathedralV2Sdfs());
  if (pa.scene === 11) sdfs.push(...butterflyV2Sdfs());
  if (pa.scene === 12) sdfs.push(...hatmanV2Sdfs());
  if (pa.scene === 13) sdfs.push(...danceSdfs());
  if (pa.scene === 14) sdfs.push(...seuratV2Sdfs());

  return sdfs;
};
