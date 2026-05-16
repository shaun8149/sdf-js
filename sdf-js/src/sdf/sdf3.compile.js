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

import { SDF3_GLSL } from './sdf3.glsl.js';
import { SDF3 } from './core.js';
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

  try {
    let body;
    if (emitObjectIndex) {
      body = compileWithObjectIndex(sdf, sceneFnName);
    } else {
      const expr = walk(sdf, 'p');
      body = `float ${sceneFnName}(vec3 p) {\n  return ${expr};\n}`;
    }
    const prelude = includeLibrary ? `${SDF3_GLSL}\n${emitObjectIndex ? IMIN_GLSL : ''}\n\n` : '';
    return { glsl: prelude + body, error: null };
  } catch (e) {
    return { glsl: null, error: e.message };
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

// 递归 flatten union → [{leaf: SDF, k: number|null}, ...]
function flattenUnion(sdf, parentK = null) {
  const ast = sdf.ast;
  if (ast?.kind === 'op' && ast.name === 'union') {
    const unionK = ast.opts.k ?? parentK;
    const result = [];
    for (const child of ast.children) {
      // child._k 覆盖 union.opts.k（跟 dn.js 行为一致）
      const childK = child._k != null ? child._k : unionK;
      result.push(...flattenUnion(child, childK));
    }
    return result;
  }
  // Leaf (非 union op，或 primitive)
  return [{ leaf: sdf, k: parentK }];
}

function compileWithObjectIndex(sdf, sceneFnName) {
  const leaves = flattenUnion(sdf);

  let body = `float ${sceneFnName}(vec3 p) {\n`;
  body += `  objectIndex = 0.0;\n`;
  body += `  minIndex = 0.0;\n`;
  body += `  float d = ${flt(MAX_DIST_INIT)};\n`;
  for (const { leaf, k } of leaves) {
    const expr = walk(leaf, 'p');
    if (k != null) {
      body += `  d = ismoothUnion(d, ${expr}, ${flt(k)});\n`;
    } else {
      body += `  d = imin(d, ${expr});\n`;
    }
  }
  body += `  return d;\n`;
  body += `}\n`;
  return body;
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

  // ---- boolean ops --------------------------------------------------------
  union:        emitBoolean('opUnion',     'opSmoothUnion'),
  intersection: emitBoolean('opIntersect', 'opSmoothIntersect'),
  difference:   emitBoolean('opDifference','opSmoothDifference'),

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
  const visit = (node) => {
    const a = node.ast;
    if (!a) throw new Error('missing .ast');
    if (a.kind === 'prim') {
      if (!PRIMS[a.name]) throw new Error(`unsupported primitive '${a.name}'`);
      return;
    }
    if (a.kind === 'op') {
      if (!OPS[a.name]) throw new Error(`unsupported op '${a.name}'`);
      for (const child of a.children) visit(child);
      return;
    }
    throw new Error(`unknown AST kind '${a.kind}'`);
  };
  try {
    visit(sdf);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
