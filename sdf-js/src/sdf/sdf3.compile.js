// =============================================================================
// SDF3 → GLSL compiler
// -----------------------------------------------------------------------------
// 把 sphere(0.5).translate([0,1,0]).blend(box(0.3), {k:0.1}) 这样的 JS SDF
// 表达式编译成 GLSL fragment shader 的 `float scene(vec3 p)` 函数。
//
// 工作机制（"Option A" — 跟 user 在 abstraction layer 确认过）：
//   1. d3.js 每个 primitive 构造时在返回的 SDF3 实例上挂 `.ast = {kind:'prim',...}`
//   2. core.js 的 `_attach` / `defineOp{2,3,N,23}` 自动给 op 输出挂 `.ast = {kind:'op',...}`
//   3. 本文件 walk AST → emit GLSL float expression
//
// CPU 闭包路径完全不受影响 —— `.f(p)` 跟以前一样跑 JS 数学。AST 是 additive。
//
// 不支持时的行为：unknown primitive / unknown op / 没有 .ast 字段（如 CA / motif
// 生成的 SDF）→ 抛错 → caller catch → fall back 到 CPU raymarch。
//
// 支持范围（v0）：见底部 _SUPPORTED_PRIMS / _SUPPORTED_OPS。extrude / revolve
// 在 v1（需要 nested SDF2 compile）；rep / elongate / orient 在 v0.5。
// =============================================================================

import { SDF3_GLSL, SDF2_GLSL } from './sdf3.glsl.js';
import { NOISE_GLSL } from './noise.glsl.js';
import { VORONOI_GLSL } from './voronoi.glsl.js';
import { SDF2, SDF3 } from './core.js';
import { isTimeExpr, mulT } from './time.js';

// ---- format helpers --------------------------------------------------------

// JS number → GLSL float literal。保证带小数点；scientific notation 转 fixed。
const fltLit = (n) => {
  if (typeof n !== 'number') throw new Error(`fltLit: expected number, got ${typeof n}`);
  if (!Number.isFinite(n)) throw new Error(`fltLit: non-finite value ${n}`);
  let s = n.toFixed(7);
  if (s.includes('.')) {
    s = s.replace(/0+$/, '');
    if (s.endsWith('.')) s += '0';
  }
  return s;
};

// time-expr → GLSL 表达式（引用 caller 的 uniform float u_time）
// 嵌套 sum 直接 inline。AST 紧凑表达：amp · sin(freq · t + phase) 等
function emitTimeExpr(e) {
  if (e.form === 'linear') return `(${fltLit(e.coef)} * u_time)`;
  if (e.form === 'sin')    return `(${fltLit(e.amp)} * sin(${fltLit(e.freq)} * u_time + ${fltLit(e.phase)}))`;
  if (e.form === 'cos')    return `(${fltLit(e.amp)} * cos(${fltLit(e.freq)} * u_time + ${fltLit(e.phase)}))`;
  if (e.form === 'sum')    return `(${e.terms.map(fltOrTime).join(' + ')})`;
  // Sprint 4: uniform reference — emit raw GLSL string (caller must declare
  // the uniform externally). Used for subject motion offsets driven from JS
  // per frame (u_subjectOffset[slot].y for rocket lift-off etc).
  if (e.form === 'uniform') return `(${e.ref})`;
  throw new Error(`emitTimeExpr: unknown form '${e.form}'`);
}

// 统一 dispatch：number → literal；time-expr → GLSL expr
function fltOrTime(x) {
  if (typeof x === 'number') return fltLit(x);
  if (isTimeExpr(x)) return emitTimeExpr(x);
  throw new Error(`flt: expected number or time-expr, got ${typeof x} (${JSON.stringify(x)})`);
}

// 保持旧名 `flt` 让现有 emitter 不用改；语义升级为多态
const flt = fltOrTime;

const vec2 = (arr) => `vec2(${flt(arr[0])}, ${flt(arr[1])})`;
const vec3 = (arr) => `vec3(${flt(arr[0])}, ${flt(arr[1])}, ${flt(arr[2])})`;

// 标量或数组 → 3-元数组
const asArr3 = (a) => {
  if (Array.isArray(a)) {
    return [a[0], a[1] ?? a[0], a[2] ?? a[0]];
  }
  return [a, a, a];
};

const length3 = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const normalize3 = (a) => {
  const L = length3(a);
  if (L < 1e-12) return [0, 0, 1];
  return [a[0] / L, a[1] / L, a[2] / L];
};
const eq3 = (a, b, eps = 1e-6) =>
  Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps && Math.abs(a[2] - b[2]) < eps;

// Rodrigues：给 axis-angle 算 3×3 旋转矩阵。返回 column-major 9 元数组（GLSL mat3 顺序）
function rotAxisAngleMat(angle, axis) {
  const [x, y, z] = normalize3(axis);
  const c = Math.cos(angle), s = Math.sin(angle), C = 1 - c;
  // Standard rotation matrix in row-major:
  //   [ c+x²C    xyC-zs  xzC+ys ]
  //   [ xyC+zs   c+y²C   yzC-xs ]
  //   [ xzC-ys   yzC+xs  c+z²C  ]
  // Column-major: cols = [col0, col1, col2]
  return [
    c + x * x * C,        x * y * C + z * s,    x * z * C - y * s,   // col 0
    x * y * C - z * s,    c + y * y * C,        y * z * C + x * s,   // col 1
    x * z * C + y * s,    y * z * C - x * s,    c + z * z * C,        // col 2
  ];
}

// ---- per-compile context ---------------------------------------------------
// Some emitters (notably `polygon2`) need to inject a helper function per
// unique shape into the GLSL prelude. We track them in a per-compile Map
// (key = canonical hash of points → value = GLSL function source). Set by
// compileSDF3ToGLSL on entry, reset on exit. Walk emitters push into it via
// _registerHelperFn. Caller stitches the helper code into the final prelude.
let _compileExtras = null;

function _registerHelperFn(key, body) {
  if (_compileExtras && !_compileExtras.has(key)) {
    _compileExtras.set(key, body);
  }
}

// Stable short hash for polygon vertex arrays — used as both dedup key and
// function-name suffix. 32-bit FNV-1a over the rounded float strings.
function _hashPoints(points) {
  let h = 0x811c9dc5;
  for (const [x, y] of points) {
    const s = `${x.toFixed(6)},${y.toFixed(6)};`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

// ---- entry point -----------------------------------------------------------

/**
 * 把 SDF3 表达式编译成 GLSL float scene(vec3 p) { ... }
 *
 * @param {SDF3} sdf  - 来自 d3.js / dn.js，必须有 .ast 字段（自动挂上）
 * @param {object} opts
 *   @param {boolean} [opts.includeLibrary=true]   prepend SDF3_GLSL 库
 *   @param {string}  [opts.sceneFnName='scene']   emit 出来的函数名
 *   @param {boolean} [opts.emitObjectIndex=false] true → 用 imin / ismoothUnion
 *     side-effect 模式 emit；scene 函数变成多语句，跟 Autoscope 一样维护
 *     `objectIndex` / `minIndex` globals → BOB GPU 上色用。需要 caller 自己 prelude
 *     IMIN_GLSL 字符串（提供 globals + imin / ismoothUnion）。
 * @returns {{ glsl: string|null, error: string|null }}
 */
export function compileSDF3ToGLSL(sdf, opts = {}) {
  const {
    includeLibrary = true,
    sceneFnName = 'scene',
    emitObjectIndex = false,
  } = opts;

  if (!(sdf instanceof SDF3)) {
    return { glsl: null, error: 'not an SDF3 instance' };
  }
  if (!sdf.ast) {
    return { glsl: null, error: 'SDF has no AST (probably CA / motif / streamline source, CPU-only)' };
  }

  _compileExtras = new Map();
  try {
    let body, leafMaterials = null, leafPatterns = null;
    if (emitObjectIndex) {
      const result = compileWithObjectIndex(sdf, sceneFnName);
      body = result.body;
      leafMaterials = result.leafMaterials;
      leafPatterns  = result.leafPatterns;
    } else {
      const expr = walk(sdf, 'p');
      body = `float ${sceneFnName}(vec3 p) {\n  return ${expr};\n}`;
    }
    // Noise + Voronoi libs prepended first — SDF library functions (and
    // future domain-warped primitives) can call into them. Renderer shading
    // code uses them for surface texture (fbm) and patterns (voronoi/brick/hex).
    // SDF2_GLSL provides 2D helpers used by revolve/extrude ops.
    const extrasCode = Array.from(_compileExtras.values()).join('\n\n');
    const prelude = includeLibrary
      ? `${NOISE_GLSL}\n${VORONOI_GLSL}\n${SDF3_GLSL}\n${SDF2_GLSL}\n${emitObjectIndex ? IMIN_GLSL : ''}\n${extrasCode}\n\n`
      : `${extrasCode}\n\n`;
    return { glsl: prelude + body, error: null, leafMaterials, leafPatterns };
  } catch (e) {
    return { glsl: null, error: e.message, leafMaterials: null, leafPatterns: null };
  } finally {
    _compileExtras = null;
  }
}

// ---- emit-object-index mode -----------------------------------------------
// 顶层 union 被 **递归** flatten 成一序列 `d = imin(d, leaf);` statement。每个
// imin 调用增加 objectIndex 全局并更新 minIndex（哪个 leaf 离 p 最近）。Autoscope
// 用 minIndex 喂 spaceCol() 让每个 object 走不同色块相位。
//
// 递归处理嵌套 union（如 union(a, union(b, c, {k:0.1}))）：所有 leaf 拍平到顶层，
// 每个 leaf 记自己来源 union 的 k（child._k 优先于 union opts.k）。
// 副作用：跨 union 边界的相邻 leaf 会经过 smooth-blend（accumulator-vs-leaf 用
// 内层 k），略微改变 boundary 几何，但 BOB GPU 视觉 register 不在乎几何精度，
// 收益是 per-leaf 完整 objNum 跟踪 → 完整色块分离。

const MAX_DIST_INIT = 1e6;

// 递归 flatten union → [{leaf: SDF, k: number|null, material: obj|null, pattern: obj|null}, ...]
//
// Material + pattern propagation: a parent SDF can carry `_subjectMaterial` /
// `_subjectPattern` (attached by scene/compile.js at SceneData → SDF time).
// When we descend into a union, we pass both down to children. A child's own
// tags override the parent's. Final leaves carry the closest-ancestor tags;
// renderer indexes per-leaf LUTs by minIndex from IMIN_GLSL.
function flattenUnion(sdf, parentK = null, parentMaterial = null, parentPattern = null) {
  // Child tags override parent (top-level subject wins over any outer union it
  // gets merged into).
  const material = sdf._subjectMaterial !== undefined ? sdf._subjectMaterial : parentMaterial;
  const pattern  = sdf._subjectPattern  !== undefined ? sdf._subjectPattern  : parentPattern;

  const ast = sdf.ast;
  if (ast?.kind === 'op' && ast.name === 'union') {
    const unionK = ast.opts.k ?? parentK;
    const result = [];
    for (const child of ast.children) {
      // child._k 覆盖 union.opts.k（跟 dn.js 行为一致）
      const childK = child._k != null ? child._k : unionK;
      result.push(...flattenUnion(child, childK, material, pattern));
    }
    return result;
  }
  // Leaf (非 union op，或 primitive)
  return [{ leaf: sdf, k: parentK, material, pattern }];
}

function compileWithObjectIndex(sdf, sceneFnName) {
  const leaves = flattenUnion(sdf);

  let body = `float ${sceneFnName}(vec3 p) {\n`;
  body += `  objectIndex = 0.0;\n`;
  body += `  minIndex = 0.0;\n`;
  body += `  float d = ${flt(MAX_DIST_INIT)};\n`;
  const leafMaterials = [];
  const leafPatterns  = [];
  for (const { leaf, k, material, pattern } of leaves) {
    const expr = walk(leaf, 'p');
    if (k != null) {
      body += `  d = ismoothUnion(d, ${expr}, ${flt(k)});\n`;
    } else {
      body += `  d = imin(d, ${expr});\n`;
    }
    leafMaterials.push(material ?? null);
    leafPatterns.push(pattern ?? null);
  }
  body += `  return d;\n`;
  body += `}\n`;
  return { body, leafMaterials, leafPatterns };
}

// emit-object-index 模式的 GLSL prelude：globals + imin + ismoothUnion
export const IMIN_GLSL = /* glsl */ `
// ---- Object index tracking (Autoscope idiom) ----
// scene() 每次调用前 reset objectIndex/minIndex 为 0；之后每个 imin / ismoothUnion
// 调用 objectIndex+=1，最接近的那个 leaf 的 index 写入 minIndex。raymarch 命中后
// minIndex = 命中物体编号，喂 spaceCol() 区分着色。
float objectIndex;
float minIndex;

float imin(float a, float b) {
  objectIndex += 1.0;
  if (b < a) minIndex = objectIndex;
  return min(a, b);
}

float ismoothUnion(float a, float b, float k) {
  objectIndex += 1.0;
  // 用 raw-closeness 判索引（先看 a/b 谁更近），再用 smooth blend 算 final d
  if (b < a) minIndex = objectIndex;
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
`;

// ---- walk ------------------------------------------------------------------
// 注意：walk 接收的是 SDF3 实例（不是 .ast 节点本身），这样 op 处理时能访问
// child._k （smooth-coefficient hint）。

function walk(sdf, p) {
  const ast = sdf.ast;
  if (!ast) throw new Error('missing .ast on SDF node (CPU-only source?)');
  if (ast.kind === 'prim') {
    const emit = PRIMS[ast.name];
    if (!emit) throw new Error(`unsupported primitive '${ast.name}'`);
    return emit(ast.args, p);
  }
  if (ast.kind === 'op') {
    const emit = OPS[ast.name];
    if (!emit) throw new Error(`unsupported op '${ast.name}'`);
    return emit(sdf, p);
  }
  throw new Error(`unknown AST kind '${ast.kind}'`);
}

// ---- primitive emitters ----------------------------------------------------

// 所有 /2 用 mulT(_, 0.5) 实现 → 既处理 number 又处理 time-expr（mulT 把代数 distribute 进去）
const half = (x) => mulT(x, 0.5);
const halfNeg = (x) => mulT(x, -0.5);

const PRIMS = {
  sphere: ([radius, center], p) =>
    `sdSphere(${p} - ${vec3(center)}, ${flt(radius)})`,

  box: ([size, center], p) => {
    const s = asArr3(size);
    return `sdBox(${p} - ${vec3(center)}, ${vec3([half(s[0]), half(s[1]), half(s[2])])})`;
  },

  // d3.plane: dot(point - p, normalize(normal))。normal 假设静态（非 time-expr）
  plane: ([normal, point], p) => {
    const n = normalize3(normal);
    return `dot(${vec3(point)} - ${p}, ${vec3(n)})`;
  },

  capsule: ([a, b, r], p) =>
    `sdCapsule(${p}, ${vec3(a)}, ${vec3(b)}, ${flt(r)})`,

  torus: ([majorR, minorR], p) =>
    `sdTorus(${p}, ${vec2([majorR, minorR])})`,

  // d3.cylinder(radius, height) → IQ sdCylinder(p, vec2(radius, height/2))
  cylinder: ([radius, height], p) =>
    `sdCylinder(${p}, ${vec2([radius, half(height)])})`,

  // d3.capped_cylinder(a, b, radius) → IQ sdCylinder(p, a, b, r)（不同重载）
  capped_cylinder: ([a, b, radius], p) =>
    `sdCylinder(${p}, ${vec3(a)}, ${vec3(b)}, ${flt(radius)})`,

  ellipsoid: ([radii], p) =>
    `sdEllipsoid(${p}, ${vec3(radii)})`,

  rounded_box: ([size, radius], p) => {
    const s = asArr3(size);
    return `sdRoundedBox(${p}, ${vec3([half(s[0]), half(s[1]), half(s[2])])}, ${flt(radius)})`;
  },

  // d3.capped_cone(a, b, ra, rb) → IQ sdCappedCone(p, a, b, ra, rb)
  capped_cone: ([a, b, ra, rb], p) =>
    `sdCappedCone(${p}, ${vec3(a)}, ${vec3(b)}, ${flt(ra)}, ${flt(rb)})`,

  // d3.cone(height, baseRadius) → 用 capped_cone 形式 emit，tip 用 0.001 半径
  cone: ([height, baseRadius], p) => {
    const a = [0, halfNeg(height), 0], b = [0, half(height), 0];
    return `sdCappedCone(${p}, ${vec3(a)}, ${vec3(b)}, ${flt(baseRadius)}, ${flt(0.001)})`;
  },

  // solid-angle(halfAperture, radius) → sdSolidAngle(p, vec2(sin(α), cos(α)), ra)
  // GLSL helper already in SDF3_GLSL — see sdf3.glsl.js:213. The vec2 c expects
  // (sin, cos) of the half-aperture; we precompute them on the JS side and emit
  // them as float literals.
  'solid-angle': ([halfAperture, radius], p) => {
    const sinA = Math.sin(halfAperture);
    const cosA = Math.cos(halfAperture);
    return `sdSolidAngle(${p}, ${vec2([sinA, cosA])}, ${flt(radius)})`;
  },

  // link(halfLength, majorR, minorR) → sdLink(p, le, r1, r2)
  // GLSL helper added to SDF3_GLSL alongside sdSolidAngle. A chain-link /
  // oblong torus: torus elongated along +Y by 2*halfLength.
  link: ([halfLength, majorR, minorR], p) =>
    `sdLink(${p}, ${flt(halfLength)}, ${flt(majorR)}, ${flt(minorR)})`,

  // ---- Batch port 2026-05-18: 7 IQ-canonical primitives that already had GLSL
  // helpers in SDF3_GLSL but were missing JS-side bindings + emit dispatch.
  //   capped-torus(capAngle, majorR, minorR) → sdCappedTorus(p, vec2(sin,cos), ra, rb)
  //   hex-prism, octagon-prism, round-cone, rhombus, horseshoe, u-shape

  'capped-torus': ([capAngle, majorR, minorR], p) => {
    const s = Math.sin(capAngle), c = Math.cos(capAngle);
    return `sdCappedTorus(${p}, ${vec2([s, c])}, ${flt(majorR)}, ${flt(minorR)})`;
  },
  'hex-prism': ([apothem, halfHeight], p) =>
    `sdHexPrism(${p}, ${vec2([apothem, halfHeight])})`,
  'octagon-prism': ([apothem, halfHeight], p) =>
    `sdOctogonPrism(${p}, ${flt(apothem)}, ${flt(halfHeight)})`,
  'round-cone': ([baseRadius, topRadius, height], p) =>
    `sdRoundCone(${p}, ${flt(baseRadius)}, ${flt(topRadius)}, ${flt(height)})`,
  rhombus: ([la, lb, h, cornerR], p) =>
    `sdRhombus(${p}, ${flt(la)}, ${flt(lb)}, ${flt(h)}, ${flt(cornerR)})`,
  horseshoe: ([openAngle, radius, length, halfWidth, halfDepth], p) => {
    const c = Math.cos(openAngle), s = Math.sin(openAngle);
    return `sdHorseshoe(${p}, ${vec2([c, s])}, ${flt(radius)}, ${flt(length)}, ${vec2([halfWidth, halfDepth])})`;
  },
  'u-shape': ([radius, legLength, halfWidth, halfDepth], p) =>
    `sdU(${p}, ${flt(radius)}, ${flt(legLength)}, ${vec2([halfWidth, halfDepth])})`,

  tetrahedron:  ([r], p) => `sdTetrahedron(${p}, ${flt(r)})`,
  octahedron:   ([r], p) => `sdOctahedron(${p}, ${flt(r)})`,
  dodecahedron: ([r], p) => `sdDodecahedron(${p}, ${flt(r)})`,
  icosahedron:  ([r], p) => `sdIcosahedron(${p}, ${flt(r)})`,
  pyramid:      ([h], p) => `sdPyramid(${p}, ${flt(h)})`,

  // tri_prism(halfWidth, halfLength) → IQ sdTriPrism(p, vec2(hw, hl))
  tri_prism: ([halfWidth, halfLength], p) =>
    `sdTriPrism(${p}, ${vec2([halfWidth, halfLength])})`,

  wireframe_box: ([size, thickness], p) => {
    const s = asArr3(size);
    return `sdBoxFrame(${p}, ${vec3([half(s[0]), half(s[1]), half(s[2])])}, ${flt(thickness)})`;
  },

  // Autoscope 海浪地面（time-aware；caller shader 必须 declare uniform float u_time）
  waves: ([freq, amp, angle, speed], p) =>
    `sdWaves(${p}, ${flt(freq)}, ${flt(amp)}, ${flt(angle)}, ${flt(speed)})`,

  // afl_ext-inspired open-ocean heightfield (time-aware; sea shading is
  // routed via material.kind === 'sea' which the renderer matches on a
  // dedicated branch — see flyLambert.js for the fresnel + atmosphere path).
  'sea-surface': ([depth, scale], p) =>
    `sdSeaSurface(${p}, ${flt(depth)}, ${flt(scale)})`,

  // Canal building — box shell with procedural window grid carved into all
  // 4 facades. Args: [width, height, winX, winY].
  'canal-building': ([width, height, winX, winY], p) =>
    `sdCanalBuilding(${p}, ${flt(width)}, ${flt(height)}, ${flt(winX)}, ${flt(winY)})`,

  // Canal windows — thin glow planes inside canal-building window recesses.
  // Composes in same position as a canal-building with matching args.
  // Args: [width, height, winX, winY, density, seed].
  'canal-windows': ([width, height, winX, winY, density, seed], p) =>
    `sdCanalWindows(${p}, ${flt(width)}, ${flt(height)}, ${flt(winX)}, ${flt(winY)}, ${flt(density)}, ${flt(seed)})`,

  // Canal bridge — stone arch spanning canal. Args: [span, archR, thickness].
  'canal-bridge': ([span, archR, thickness], p) =>
    `sdCanalBridge(${p}, ${flt(span)}, ${flt(archR)}, ${flt(thickness)})`,

  // Canal lamp bulb head (3 spheres). Pole = pair with separate cylinder.
  // Args: [bulbY, bulbR].
  'canal-lamp-bulb': ([bulbY, bulbR], p) =>
    `sdCanalLampBulb(${p}, ${flt(bulbY)}, ${flt(bulbR)})`,

  // IQ Elevated-style mountain terrain (heightfield with gradient-decay fbm).
  // Args: [maxHeight, hwRatio]. material.kind='mountain' routes shading via
  // snow-line + 3-light + slope-AO + height-fog branch in flyLambert.
  'terrain-heightmap': ([maxHeight, hwRatio], p) =>
    `sdTerrainHeightmap(${p}, ${flt(maxHeight)}, ${flt(hwRatio)})`,

  // Kolaczynski-style elevated terrain (sharp alpine peaks). Adds ridge
  // sharpening + mountain-mask blending on top of derivative-damped fbm.
  // Args: [maxHeight, scale, ridgePower, mountainness].
  'terrain-elevated': ([maxHeight, scale, ridgePower, mountainness], p) =>
    `sdTerrainElevated(${p}, ${flt(maxHeight)}, ${flt(scale)}, ${flt(ridgePower)}, ${flt(mountainness)})`,

  // Forest sprint: 4 atoms. See sdf3.glsl.js for full helper descriptions.
  // stylized-tree(trunkLen, trunkRad, leafSize, windK) — 4-layer composition.
  'stylized-tree': ([trunkLen, trunkRad, leafSize, windK], p) =>
    `sdStylizedTree(${p}, ${flt(trunkLen)}, ${flt(trunkRad)}, ${flt(leafSize)}, ${flt(windK)})`,
  // maple-leaf(scale, rand) — single 3D leaf (compose with rep for fallen-leaf scatter).
  'maple-leaf': ([scale, rand], p) =>
    `sdMapleLeaf3D(${p}, ${flt(scale)}, ${flt(rand)})`,
  // forest-flower(stemH, bloomR) — 5-petal flower (compose with rep for fields).
  'forest-flower': ([stemH, bloomR], p) =>
    `sdForestFlower(${p}, ${flt(stemH)}, ${flt(bloomR)})`,
  // meteor-streak(origin, velocity, trailLen, period, activeFrac, phase) — animated
  // emissive capsule. origin + velocity are vec3 arrays. Auto-attaches emissive
  // material.kind unless author overrides.
  'meteor-streak': ([origin, velocity, trailLen, period, activeFrac, phase], p) =>
    `sdMeteorStreak(${p}, ${vec3(origin)}, ${vec3(velocity)}, ${flt(trailLen)}, ${flt(period)}, ${flt(activeFrac)}, ${flt(phase)})`,
  // grass-field(bladeHeight, density) — pMod2 cellular grass blades, wind sway.
  // Infinite in xz; caller wraps in rep + count to clip if a finite patch desired.
  'grass-field': ([bladeHeight, density], p) =>
    `sdGrassField(${p}, ${flt(bladeHeight)}, ${flt(density)})`,

  // -- 2026-05-23 IQ P2 batch (8 new primitives) -----------------------------
  // sdCutSphere(p, r, h) — sphere of radius r cut at horizontal plane height h.
  'cut-sphere': ([r, h], p) =>
    `sdCutSphere(${p}, ${flt(r)}, ${flt(h)})`,
  // sdCutHollowSphere(p, r, h, t) — cut sphere with shell thickness t.
  'cut-hollow-sphere': ([r, h, t], p) =>
    `sdCutHollowSphere(${p}, ${flt(r)}, ${flt(h)}, ${flt(t)})`,
  // sdDeathStar(p, ra, rb, d) — sphere ra carved by sphere rb at distance d.
  'death-star': ([ra, rb, d], p) =>
    `sdDeathStar(${p}, ${flt(ra)}, ${flt(rb)}, ${flt(d)})`,
  // sdRoundedCylinder(p, ra, rb, h) — cylinder with rolled-rounded rim.
  'rounded-cylinder': ([ra, rb, h], p) =>
    `sdRoundedCylinder(${p}, ${flt(ra)}, ${flt(rb)}, ${flt(h)})`,
  // sdRoundConeAB(p, a, b, r1, r2) — round cone between arbitrary endpoints.
  'round-cone-ab': ([a, b, r1, r2], p) =>
    `sdRoundConeAB(${p}, ${vec3(a)}, ${vec3(b)}, ${flt(r1)}, ${flt(r2)})`,
  // sdVesicaSegment(p, a, b, w) — lens/eye shape along segment.
  'vesica-segment': ([a, b, w], p) =>
    `sdVesicaSegment(${p}, ${vec3(a)}, ${vec3(b)}, ${flt(w)})`,
  // sdCylinderInf(p, c) — infinite cylinder. c.xy = axis XZ offset, c.z = radius.
  'cylinder-inf': ([axisXZ, radius], p) => {
    const cx = Array.isArray(axisXZ) ? axisXZ[0] : 0;
    const cy = Array.isArray(axisXZ) ? axisXZ[1] : 0;
    return `sdCylinderInf(${p}, ${vec3([cx, cy, radius])})`;
  },
  // sdConeInf(p, c) — infinite cone, c = sin/cos of half-aperture. Tip at origin.
  'cone-inf': ([halfAperture], p) => {
    const s = Math.sin(halfAperture), c = Math.cos(halfAperture);
    return `sdConeInf(${p}, ${vec2([s, c])})`;
  },
};

// ---- op emitters -----------------------------------------------------------
// ast = { kind:'op', name, children:[SDF, ...], scalars:[...], opts:{} }
// children[0] 永远是 chain self；其余是显式传入的 SDF 参数

// 通用 helper：左折叠 boolean op，逐 child 应用 hard / smooth
function emitBoolean(hardFn, smoothFn) {
  return (sdf, p) => {
    const { children, opts } = sdf.ast;
    const ds = children.map((c) => walk(c, p));
    let acc = ds[0];
    for (let i = 1; i < ds.length; i++) {
      // smooth 系数解析顺序：opts.k > child._k > null（→ hard）
      let k = null;
      if (opts.k != null) k = opts.k;
      else if (children[i]._k != null) k = children[i]._k;

      if (k === null) acc = `${hardFn}(${acc}, ${ds[i]})`;
      else acc = `${smoothFn}(${acc}, ${ds[i]}, ${flt(k)})`;
    }
    return acc;
  };
}

// hg_sdf-style variant: same left-fold but with a fixed param tuple per node
// (e.g. chamfer/round take r; columns/stairs take r+n). All children join via
// the same opFn — for multi-mode joins, nest the operations.
function emitBooleanVariant(opFn, argKeys, defaults = {}) {
  return (sdf, p) => {
    const { children, opts } = sdf.ast;
    const ds = children.map((c) => walk(c, p));
    const argStr = argKeys.map(k => flt(opts[k] ?? defaults[k] ?? 0.05)).join(', ');
    let acc = ds[0];
    for (let i = 1; i < ds.length; i++) {
      acc = `${opFn}(${acc}, ${ds[i]}, ${argStr})`;
    }
    return acc;
  };
}

// Surface-modification pairs (pipe / engrave / groove / tongue). Exactly two
// children: host surface + modifier curve. Not commutative; not foldable.
function emitPair(opFn, argKeys, defaults = {}) {
  return (sdf, p) => {
    const { children, opts } = sdf.ast;
    if (children.length !== 2) {
      throw new Error(`${sdf.ast.name}: requires exactly 2 children (host + modifier), got ${children.length}`);
    }
    const a = walk(children[0], p);
    const b = walk(children[1], p);
    const argStr = argKeys.map(k => flt(opts[k] ?? defaults[k] ?? 0.05)).join(', ');
    return `${opFn}(${a}, ${b}, ${argStr})`;
  };
}

const OPS = {
  // ---- transforms ----------------------------------------------------------
  translate: (sdf, p) => {
    const offset = asArr3(sdf.ast.scalars[0]);
    return walk(sdf.ast.children[0], `(${p} - ${vec3(offset)})`);
  },

  scale: (sdf, p) => {
    const factor = sdf.ast.scalars[0];
    const s = asArr3(factor);
    const inner = walk(sdf.ast.children[0], `(${p} / ${vec3(s)})`);
    // Distance compensation: multiply by min(scale_factors)。如果都是 number 走
    // JS Math.min；如果含 time-expr 则 emit GLSL min() 让 GPU 算
    const allNum = s.every(x => typeof x === 'number');
    if (allNum) return `(${inner}) * ${fltLit(Math.min(s[0], s[1], s[2]))}`;
    return `(${inner}) * min(${flt(s[0])}, min(${flt(s[1])}, ${flt(s[2])}))`;
  },

  // d3.rotate(angle, axis = Z)：把点逆向旋转。axis 默认 Z
  // axis 必须静态（numbers only）；angle 可 time-expr（任意轴时 angle 也必须静态）
  rotate: (sdf, p) => {
    const [angle, axis = [0, 0, 1]] = sdf.ast.scalars;
    if (!Array.isArray(axis) || !axis.every(x => typeof x === 'number')) {
      throw new Error(`rotate: axis must be static numbers, time-modulated axis not supported`);
    }
    const ax = normalize3(axis);
    if (eq3(ax, [1, 0, 0]))  return walk(sdf.ast.children[0], `(rotX_inv(${flt(angle)}) * ${p})`);
    if (eq3(ax, [0, 1, 0]))  return walk(sdf.ast.children[0], `(rotY_inv(${flt(angle)}) * ${p})`);
    if (eq3(ax, [0, 0, 1]))  return walk(sdf.ast.children[0], `(rotZ_inv(${flt(angle)}) * ${p})`);
    // 任意 axis：Rodrigues mat3 在 JS 预算，需要 static angle
    if (isTimeExpr(angle)) {
      throw new Error(`rotate: time-modulated angle requires axis-aligned rotation (X/Y/Z), not arbitrary axis`);
    }
    const m = rotAxisAngleMat(-angle, ax);
    const mat = `mat3(${m.map(fltLit).join(', ')})`;
    return walk(sdf.ast.children[0], `(${mat} * ${p})`);
  },

  // ---- artistic ops -------------------------------------------------------
  twist: (sdf, p) => walk(sdf.ast.children[0], `opTwist(${p}, ${flt(sdf.ast.scalars[0])})`),
  bend:  (sdf, p) => walk(sdf.ast.children[0], `opBend(${p}, ${flt(sdf.ast.scalars[0])})`),
  // curve(amp, freq, driverAxisIdx) — sinusoidal x-offset driven by another axis.
  // Generalisation of the Venice canal idiom (x += amp * sin(z * freq)).
  curve: (sdf, p) => walk(sdf.ast.children[0],
    `opCurve(${p}, ${flt(sdf.ast.scalars[0])}, ${flt(sdf.ast.scalars[1])}, ${Math.trunc(sdf.ast.scalars[2])})`),

  // hg_sdf-style polar repetition. Emits one of polarModX/Y/Z based on axis.
  modPolar: (sdf, p) => {
    const { opts, children } = sdf.ast;
    const axis = opts.axis ?? 'y';
    const n = opts.repetitions ?? 6;
    const fn = axis === 'x' ? 'polarModX' : axis === 'z' ? 'polarModZ' : 'polarModY';
    return walk(children[0], `${fn}(${p}, ${flt(n)})`);
  },

  // hg_sdf-style 8-fold mirror in a chosen plane. Emits one of
  // mirrorOctantXZ/XY/YZ based on the plane option.
  mirrorOctant: (sdf, p) => {
    const { opts, children } = sdf.ast;
    const plane = opts.plane ?? 'xz';
    const dist = Array.isArray(opts.dist) ? opts.dist : [0, 0];
    const fn = plane === 'xy' ? 'mirrorOctantXY' : plane === 'yz' ? 'mirrorOctantYZ' : 'mirrorOctantXZ';
    return walk(children[0], `${fn}(${p}, ${vec2(dist)})`);
  },

  // ---- boolean ops --------------------------------------------------------
  union:        emitBoolean('opUnion',     'opSmoothUnion'),
  intersection: emitBoolean('opIntersect', 'opSmoothIntersect'),
  difference:   emitBoolean('opDifference','opSmoothDifference'),

  // hg_sdf-style boolean variants (Mercury "Hg" library). Each variant is a
  // left-fold using a different GLSL helper at the join.
  unionChamfer:        emitBooleanVariant('opChamferUnion',      ['r']),
  intersectionChamfer: emitBooleanVariant('opChamferIntersect',  ['r']),
  differenceChamfer:   emitBooleanVariant('opChamferDifference', ['r']),
  unionRound:          emitBooleanVariant('opRoundUnion',        ['r']),
  intersectionRound:   emitBooleanVariant('opRoundIntersect',    ['r']),
  differenceRound:     emitBooleanVariant('opRoundDifference',   ['r']),
  // Soft = cubic smooth-min (alternative to opSmoothUnion). r controls reach.
  unionSoft:           emitBooleanVariant('opSoftUnion',         ['r'], { r: 0.1 }),
  // Stairs/Columns take (r, n). n = number of stair steps / columnar bumps.
  unionStairs:         emitBooleanVariant('opStairsUnion',       ['r', 'n'], { r: 0.1, n: 3 }),
  intersectionStairs:  emitBooleanVariant('opStairsIntersect',   ['r', 'n'], { r: 0.1, n: 3 }),
  differenceStairs:    emitBooleanVariant('opStairsDifference',  ['r', 'n'], { r: 0.1, n: 3 }),
  unionColumns:        emitBooleanVariant('opColumnsUnion',      ['r', 'n'], { r: 0.1, n: 3 }),
  intersectionColumns: emitBooleanVariant('opColumnsIntersect',  ['r', 'n'], { r: 0.1, n: 3 }),
  differenceColumns:   emitBooleanVariant('opColumnsDifference', ['r', 'n'], { r: 0.1, n: 3 }),

  // Surface modifications: 2-children (host + modifier), not commutative.
  pipe:    emitPair('opPipe',    ['r'],        { r: 0.05 }),
  engrave: emitPair('opEngrave', ['r'],        { r: 0.05 }),
  groove:  emitPair('opGroove',  ['ra', 'rb'], { ra: 0.05, rb: 0.02 }),
  tongue:  emitPair('opTongue',  ['ra', 'rb'], { ra: 0.05, rb: 0.02 }),

  // ---- decoration ---------------------------------------------------------
  negate: (sdf, p) => `(-${walk(sdf.ast.children[0], p)})`,
  dilate: (sdf, p) => `(${walk(sdf.ast.children[0], p)} - ${flt(sdf.ast.scalars[0])})`,
  erode:  (sdf, p) => `(${walk(sdf.ast.children[0], p)} + ${flt(sdf.ast.scalars[0])})`,
  shell:  (sdf, p) => `(abs(${walk(sdf.ast.children[0], p)}) - ${flt(mulT(sdf.ast.scalars[0], 0.5))})`,

  // ---- distance lerp ------------------------------------------------------
  // blend 跟 smooth-union 不同：是距离值的 lerp（mix(d1, d2, K)）
  blend: (sdf, p) => {
    const { children, opts } = sdf.ast;
    const defaultK = opts.k ?? 0.5;
    const ds = children.map((c) => walk(c, p));
    let acc = ds[0];
    for (let i = 1; i < ds.length; i++) {
      const k = opts.k != null ? opts.k : (children[i]._k ?? defaultK);
      acc = `mix(${acc}, ${ds[i]}, ${flt(k)})`;
    }
    return acc;
  },

  // ---- Domain repetition (Autoscope idiom: 重复柱廊 / 拱门 / 鸟群 / cutouts) -
  // period: scalar 或 [px, py, pz] —— 0 = 该轴不重复
  // opts.count: null/undefined = 无限；scalar 或 [cx, cy, cz] = 每轴 tile 数限制
  // opts.padding: CPU 用（邻居平滑），GPU 不支持（性能差） → warn 但不报错
  rep: (sdf, p) => {
    const { scalars, opts, children } = sdf.ast;
    if (opts.padding != null && opts.padding !== 0) {
      console.warn('[compile] rep: opts.padding ignored on GPU path (CPU-only feature)');
    }
    const period = asArr3(scalars[0]);
    if (opts.count == null) {
      return walk(children[0], `rep3(${p}, ${vec3(period)})`);
    }
    const count = asArr3(opts.count);
    return walk(children[0], `repL3(${p}, ${vec3(period)}, ${vec3(count)})`);
  },

  // ---- 2D → 3D pseudo-primitive ops --------------------------------------
  // Wired 2026-05-23. Both take a single SDF2 child. revolve sweeps it around
  // the Y-axis (profile is in 2D XY plane; 2D-x maps to radial r = length(p.xz);
  // 2D-y maps to 3D-y). extrude sweeps it along Z with half-height h.

  // revolve(sdf2, offset=0)
  // JS-side: p[0] -> radial r = sqrt(x²+z²) - offset; p[1] -> y. Profile must
  // live in x_2d >= 0 half-plane (otherwise it mirrors across the axis).
  revolve: (sdf, p) => {
    const offset = sdf.ast.scalars[0] ?? 0;
    const sdf2 = sdf.ast.children[0];
    if (!(sdf2 instanceof SDF2)) {
      throw new Error(`revolve: source must be SDF2, got ${typeof sdf2}`);
    }
    // Build the 2D probe point as a fresh GLSL temp via a let-like sub-expr.
    // GLSL doesn't have IIFE, so we substitute the vec2 expression directly.
    // Most SDF2 emitters wrap their input in length()/abs() once; direct
    // substitution is fine (no double-eval concerns for the common cases).
    const q = `vec2(length((${p}).xz) - ${flt(offset)}, (${p}).y)`;
    return walk2(sdf2, q);
  },

  // extrude(sdf2, h)
  // JS-side: 2D profile in XY plane, extruded along Z with full height h.
  // (JS impl uses h/2 as half-height — same here.)
  extrude: (sdf, p) => {
    const h = sdf.ast.scalars[0] ?? 1;
    const sdf2 = sdf.ast.children[0];
    if (!(sdf2 instanceof SDF2)) {
      throw new Error(`extrude: source must be SDF2, got ${typeof sdf2}`);
    }
    const halfH = mulT(h, 0.5);
    const dExpr = walk2(sdf2, `(${p}).xy`);
    return `opExtrusion(${dExpr}, (${p}).z, ${flt(halfH)})`;
  },

  // ---- 2026-05-23 IQ P3 batch ----------------------------------------------
  // elongate(h) — stretch host primitive by h along each axis. Uses correct
  // form (max(q,0) clamp inside emit) for exterior accuracy. Maps to
  // opElongate3 helper which returns the elongated coordinate.
  elongate: (sdf, p) => {
    const h = asArr3(sdf.ast.scalars[0]);
    return walk(sdf.ast.children[0], `opElongate3(${p}, ${vec3(h)})`);
  },

  // displace(otherSdf) — additive perturbation. Caller is responsible for
  // keeping the perturbation small (else raymarch step cap shrinks).
  displace: (sdf, p) => {
    const ds = sdf.ast.children.map((c) => walk(c, p));
    if (ds.length !== 2) throw new Error(`displace: requires exactly 2 children, got ${ds.length}`);
    return `opDisplace(${ds[0]}, ${ds[1]})`;
  },

  // xor(b) — symmetric-difference of two SDFs. Bound (interior over-estimates).
  xor: emitBoolean('opXor', 'opXor'),  // no smooth variant; reuse op for both

  // ---- 2026-05-23 IQ P4 batch (smin variants) ------------------------------
  // Each is a smooth-union with a different blending profile. r controls
  // the join radius. Children may pass per-instance _k overriding opts.r.
  unionExp:      emitBooleanVariant('opSminExp',      ['r'], { r: 0.1 }),
  unionRoot:     emitBooleanVariant('opSminRoot',     ['r'], { r: 0.1 }),
  unionCubic:    emitBooleanVariant('opSminCubic',    ['r'], { r: 0.1 }),
  unionQuartic:  emitBooleanVariant('opSminQuartic',  ['r'], { r: 0.1 }),
  unionCircular: emitBooleanVariant('opSminCircular', ['r'], { r: 0.1 }),
  unionCircGeo:  emitBooleanVariant('opSminCircGeo',  ['r'], { r: 0.1 }),
};

// =============================================================================
// SDF2 emit — walk + PRIMS2 + OPS2
// -----------------------------------------------------------------------------
// Called by 3D ops `revolve` and `extrude` which take a single SDF2 child.
// Mirrors the 3D walker but emits 2D distance functions (vec2 input, float
// output) using sd2* helpers from SDF2_GLSL. 2D booleans / decorations reuse
// the same op names as 3D (union / intersection / difference / dilate / erode
// / shell / translate / rotate / scale) — they get routed to OPS2 here.
// =============================================================================

function walk2(sdf, q) {
  const ast = sdf.ast;
  if (!ast) throw new Error('missing .ast on SDF2 node (CPU-only source?)');
  if (ast.kind === 'prim') {
    const emit = PRIMS2[ast.name];
    if (!emit) throw new Error(`unsupported 2D primitive '${ast.name}'`);
    return emit(ast.args, q);
  }
  if (ast.kind === 'op') {
    const emit = OPS2[ast.name];
    if (!emit) throw new Error(`unsupported 2D op '${ast.name}'`);
    return emit(sdf, q);
  }
  throw new Error(`unknown 2D AST kind '${ast.kind}'`);
}

const PRIMS2 = {
  circle2: ([radius, center], q) =>
    `(length(${q} - ${vec2(center)}) - ${flt(radius)})`,

  ellipse2: ([rx, ry, center], q) =>
    `sd2Ellipse(${q} - ${vec2(center)}, ${vec2([rx, ry])})`,

  rectangle2: ([size, center], q) => {
    const s = [half(size[0]), half(size[1])];
    return `sd2Box(${q} - ${vec2(center)}, ${vec2(s)})`;
  },

  // rounded_rectangle2 with uniform corner: use sd2RoundBox.
  // If per-corner radii differ, we collapse to the average (GLSL helper
  // doesn't support 4-corner radii without a custom emit; uniform covers 99%
  // of revolve/extrude use cases).
  rounded_rectangle2: ([size, radii, center], q) => {
    const s = [half(size[0]), half(size[1])];
    const r = (radii[0] + radii[1] + radii[2] + radii[3]) / 4;
    return `sd2RoundBox(${q} - ${vec2(center)}, ${vec2(s)}, ${flt(r)})`;
  },

  segment2: ([a, b, r], q) =>
    `sd2Segment(${q}, ${vec2(a)}, ${vec2(b)}, ${flt(r)})`,

  ring2: ([radius, thickness, center], q) =>
    `sd2Ring(${q} - ${vec2(center)}, ${flt(radius)}, ${flt(thickness)})`,

  // Polygon: emit a unique helper function per shape (variable-vertex-count
  // can't be a generic library function in GLSL ES 1.00). Dedup via FNV-1a
  // hash so the same polygon shared by two subjects compiles to one helper.
  //
  // Implementation: FULLY UNROLLED edge accumulation. We avoid GLSL ES 1.00's
  // "dynamic indexing into local array" trap (Mac/Apple Metal-via-ANGLE
  // backends reject `v[j]` where j is computed). Each edge becomes a small
  // inline block — bloats the shader but compiles on every WebGL impl.
  polygon2: ([pts], q) => {
    const hash = _hashPoints(pts);
    const fnName = `sd2Polygon_${hash}`;
    if (_compileExtras && !_compileExtras.has(hash)) {
      const N = pts.length;
      let body = `float ${fnName}(vec2 p) {\n`;
      // Pre-declare each vertex as a const vec2 — clearer codegen, lets the
      // compiler constant-fold all arithmetic. No `vec2 v[N]` array at all.
      for (let i = 0; i < N; i++) {
        body += `  vec2 v${i} = vec2(${flt(pts[i][0])}, ${flt(pts[i][1])});\n`;
      }
      // Init d from first vertex distance.
      body += `  vec2 _w0 = p - v0;\n  float d = dot(_w0, _w0);\n  float s = 1.0;\n`;
      // Unroll: for each edge (vi -> v_prev), emit min-distance + winding flip.
      // j = (i + N - 1) % N is the PREVIOUS vertex (per IQ's reference impl).
      for (let i = 0; i < N; i++) {
        const j = (i + N - 1) % N;
        body += `\n  // edge ${i}: v${j} -> v${i}\n`;
        body += `  {\n`;
        body += `    vec2 e = v${j} - v${i};\n`;
        body += `    vec2 w = p - v${i};\n`;
        body += `    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);\n`;
        body += `    d = min(d, dot(b, b));\n`;
        body += `    bvec3 c = bvec3(p.y >= v${i}.y, p.y < v${j}.y, e.x * w.y > e.y * w.x);\n`;
        body += `    if (all(c) || all(not(c))) s = -s;\n`;
        body += `  }\n`;
      }
      body += `  return sqrt(d) * s;\n}\n`;
      _registerHelperFn(hash, body);
    }
    return `${fnName}(${q})`;
  },
};

// 2D booleans reuse the same op names as 3D. They emit via 2D walker.
// Variants (chamfer/round/etc) NOT mirrored — typical revolve/extrude only
// needs hard booleans. Add later if a use case appears.
function emitBoolean2(hardFn, smoothFn) {
  return (sdf, q) => {
    const { children, opts } = sdf.ast;
    const ds = children.map((c) => walk2(c, q));
    let acc = ds[0];
    for (let i = 1; i < ds.length; i++) {
      let k = null;
      if (opts.k != null) k = opts.k;
      else if (children[i]._k != null) k = children[i]._k;
      if (k === null) acc = `${hardFn}(${acc}, ${ds[i]})`;
      else acc = `${smoothFn}(${acc}, ${ds[i]}, ${flt(k)})`;
    }
    return acc;
  };
}

const OPS2 = {
  union:        emitBoolean2('opUnion',     'opSmoothUnion'),
  intersection: emitBoolean2('opIntersect', 'opSmoothIntersect'),
  difference:   emitBoolean2('opDifference','opSmoothDifference'),

  // 2D transforms — mirror 3D translate/rotate/scale onto vec2 input.
  translate: (sdf, q) => {
    // d2.translate scalars[0] is a vec2 offset
    const off = sdf.ast.scalars[0];
    return walk2(sdf.ast.children[0], `(${q} - ${vec2(off)})`);
  },

  scale: (sdf, q) => {
    const factor = sdf.ast.scalars[0];
    if (typeof factor === 'number') {
      const inner = walk2(sdf.ast.children[0], `(${q} / ${flt(factor)})`);
      return `(${inner}) * ${flt(factor)}`;
    }
    // vec2 factor: distance compensation uses min(sx, sy)
    const inner = walk2(sdf.ast.children[0], `(${q} / ${vec2(factor)})`);
    return `(${inner}) * ${flt(Math.min(factor[0], factor[1]))}`;
  },

  rotate: (sdf, q) => {
    const angle = sdf.ast.scalars[0];
    if (isTimeExpr(angle)) {
      // emit GLSL rotation matrix using runtime u_time
      return walk2(sdf.ast.children[0],
        `(mat2(cos(${flt(angle)}), sin(${flt(angle)}), -sin(${flt(angle)}), cos(${flt(angle)})) * ${q})`);
    }
    const c = Math.cos(-angle), s = Math.sin(-angle);
    return walk2(sdf.ast.children[0],
      `(mat2(${flt(c)}, ${flt(s)}, ${flt(-s)}, ${flt(c)}) * ${q})`);
  },

  // 2D decorations — d/r dilate-erode etc.
  negate: (sdf, q) => `(-${walk2(sdf.ast.children[0], q)})`,
  dilate: (sdf, q) => `(${walk2(sdf.ast.children[0], q)} - ${flt(sdf.ast.scalars[0])})`,
  erode:  (sdf, q) => `(${walk2(sdf.ast.children[0], q)} + ${flt(sdf.ast.scalars[0])})`,
  shell:  (sdf, q) => `(abs(${walk2(sdf.ast.children[0], q)}) - ${flt(mulT(sdf.ast.scalars[0], 0.5))})`,
};

// ---- introspection ---------------------------------------------------------
// 对外暴露当前支持的 primitive / op 名字，T5 scene browser 可以用来：
//   - LLM prompt 提示词里列可用的 primitive
//   - 提前 dry-run check 一个 SDF 能不能 compile（不用真编译 shader）

export const _SUPPORTED_PRIMS = Object.keys(PRIMS);
export const _SUPPORTED_OPS = Object.keys(OPS);

/**
 * Dry-run: 不真正生成 GLSL string，只 walk AST 检查每个节点是否都有 emitter
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function canCompileSDF3(sdf) {
  if (!(sdf instanceof SDF3)) return { ok: false, error: 'not an SDF3' };
  if (!sdf.ast) return { ok: false, error: 'no AST' };
  const visit3 = (node) => {
    const a = node.ast;
    if (!a) throw new Error('missing .ast');
    if (a.kind === 'prim') {
      if (!PRIMS[a.name]) throw new Error(`unsupported primitive '${a.name}'`);
      return;
    }
    if (a.kind === 'op') {
      if (!OPS[a.name]) throw new Error(`unsupported op '${a.name}'`);
      // revolve / extrude take SDF2 children → recurse via visit2
      for (const child of a.children) {
        if (child instanceof SDF2) visit2(child);
        else visit3(child);
      }
      return;
    }
    throw new Error(`unknown AST kind '${a.kind}'`);
  };
  const visit2 = (node) => {
    const a = node.ast;
    if (!a) throw new Error('missing .ast on 2D node');
    if (a.kind === 'prim') {
      if (!PRIMS2[a.name]) throw new Error(`unsupported 2D primitive '${a.name}'`);
      return;
    }
    if (a.kind === 'op') {
      if (!OPS2[a.name]) throw new Error(`unsupported 2D op '${a.name}'`);
      for (const child of a.children) visit2(child);
      return;
    }
    throw new Error(`unknown 2D AST kind '${a.kind}'`);
  };
  try {
    visit3(sdf);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
