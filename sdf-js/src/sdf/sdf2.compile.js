// =============================================================================
// sdf2.compile — 2D chainable SDF AST → GLSL (ES 1.00) emitter
// -----------------------------------------------------------------------------
// WP1-GPU Phase B (2026-08-17). Mirror of sdf3.compile.js for the 2D family,
// built for the genlab field-flow shader: compile one layer's SDF into a
// `float <fnName>(vec2 p)` so the flow effect can evaluate the field per-pixel
// on the GPU (tangential noise advection needs d and ∇d everywhere, not just
// on the zero isoline).
//
// Emission style is STATEMENT-BASED (numbered temps), not expression-nesting:
// rotate references the incoming point 4×, so nesting would grow code
// exponentially under chained transforms. Statements keep it linear and read
// like the CPU evaluation trace.
//
// ES 1.00 constraints honored: no arrays, no non-const loop indices — polygon
// vertices and circular_array copies are unrolled with literal floats (vertex
// counts live in ast.args, known at compile time).
//
// Parity contract: every emitter mirrors the CPU implementation in d2.js /
// dn.js verbatim (same corner indexing, same thickness/2, same rotMat(-angle)
// application, same smooth-K polynomial). Cross-check with test in
// scripts/genlab-audit/emit-glsl-all.mjs.
// =============================================================================

import { SDF2_GLSL } from './sdf3.glsl.js';

// Per-corner rounded rect is not in the sd2* family (sd2RoundBox is uniform
// radius only). Same body as d2.js rounded_rectangle / sdf2.glsl.js
// sdRoundedRectangle, sd2-prefixed to live alongside the sd2 library.
//   r0: x>0,y>0   r1: x>0,y<0   r2: x<0,y>0   r3: x<0,y<0
const SDF2_COMPILE_EXTRAS = /* glsl */ `
float sd2RoundBoxC(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  float rr = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + rr;
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - rr;
}
`;

// GLSL float literal. Rejects non-finite values (NaN from a bad scene would
// otherwise poison the shader silently).
function F(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    throw new CompileError(`non-finite numeric literal: ${x}`);
  }
  const s = String(x);
  return /[.e]/.test(s) ? s : `${s}.0`;
}

function V2(v) {
  return `vec2(${F(v[0])}, ${F(v[1])})`;
}

function asVec2(x) {
  return Array.isArray(x) ? x : [x, x];
}

class CompileError extends Error {}

// Statement-emitting context: collects lines, hands out unique var ids, and
// enforces a size cap (a pathological piece — 40 polygons × 20 vertices under
// a 12-way circular_array — should fall back to CPU, not emit a 100k-line
// shader).
class Ctx {
  constructor(maxLines) {
    this.lines = [];
    this.n = 0;
    this.maxLines = maxLines;
  }
  id(prefix) {
    this.n += 1;
    return `${prefix}${this.n}`;
  }
  push(line) {
    this.lines.push(`  ${line}`);
    if (this.lines.length > this.maxLines) {
      throw new CompileError(`emitted code exceeds ${this.maxLines} lines — CPU fallback`);
    }
  }
}

// Translate-by-center helper: most prims take an optional center; emit the
// subtraction only when it's non-zero to keep output readable.
function centered(ctx, p, c) {
  if (!c || (c[0] === 0 && c[1] === 0)) return p;
  const q = ctx.id('p');
  ctx.push(`vec2 ${q} = ${p} - ${V2(c)};`);
  return q;
}

// ---- primitive emitters ----------------------------------------------------
// Each returns the name of a float var holding the distance at point `p`.

const PRIMS = {
  circle2(ctx, p, [r, c]) {
    const d = ctx.id('d');
    ctx.push(`float ${d} = length(${centered(ctx, p, c)}) - ${F(r)};`);
    return d;
  },
  ellipse2(ctx, p, [rx, ry, c]) {
    const d = ctx.id('d');
    ctx.push(`float ${d} = sd2Ellipse(${centered(ctx, p, c)}, vec2(${F(rx)}, ${F(ry)}));`);
    return d;
  },
  segment2(ctx, p, [a, b, r]) {
    const d = ctx.id('d');
    ctx.push(`float ${d} = sd2Segment(${p}, ${V2(a)}, ${V2(b)}, ${F(r)});`);
    return d;
  },
  arc2(ctx, p, [radius, halfAperture, thickness, c]) {
    // CPU precomputes sc = (sin, cos)(halfAperture) and subtracts thickness/2;
    // sd2Arc's rb is the tube half-thickness — same convention.
    const d = ctx.id('d');
    const sc = `vec2(${F(Math.sin(halfAperture))}, ${F(Math.cos(halfAperture))})`;
    ctx.push(
      `float ${d} = sd2Arc(${centered(ctx, p, c)}, ${sc}, ${F(radius)}, ${F(thickness / 2)});`,
    );
    return d;
  },
  ring2(ctx, p, [radius, thickness, c]) {
    // sd2Ring does the thickness*0.5 internally — matches CPU thickness/2.
    const d = ctx.id('d');
    ctx.push(`float ${d} = sd2Ring(${centered(ctx, p, c)}, ${F(radius)}, ${F(thickness)});`);
    return d;
  },
  rectangle2(ctx, p, [s, c]) {
    // ast stores FULL size; sd2Box takes half-extents.
    const d = ctx.id('d');
    ctx.push(`float ${d} = sd2Box(${centered(ctx, p, c)}, ${V2([s[0] / 2, s[1] / 2])});`);
    return d;
  },
  rounded_rectangle2(ctx, p, [s, [r0, r1, r2, r3], c]) {
    const d = ctx.id('d');
    const q = centered(ctx, p, c);
    const b = V2([s[0] / 2, s[1] / 2]);
    if (r0 === r1 && r1 === r2 && r2 === r3) {
      ctx.push(`float ${d} = sd2RoundBox(${q}, ${b}, ${F(r0)});`);
    } else {
      ctx.push(
        `float ${d} = sd2RoundBoxC(${q}, ${b}, vec4(${F(r0)}, ${F(r1)}, ${F(r2)}, ${F(r3)}));`,
      );
    }
    return d;
  },
  polygon2(ctx, p, [pts]) {
    // Unrolled IQ polygon: per-edge squared distance + crossing-number sign.
    // ast carries the deduped vertex list (d2.js cleans it), all literals.
    const n = pts.length;
    if (n < 3) throw new CompileError(`polygon2 with ${n} vertices`);
    const dsq = ctx.id('dsq');
    const s = ctx.id('s');
    ctx.push(`vec2 ${dsq}w0 = ${p} - ${V2(pts[0])};`);
    ctx.push(`float ${dsq} = dot(${dsq}w0, ${dsq}w0);`);
    ctx.push(`float ${s} = 1.0;`);
    for (let i = 0; i < n; i++) {
      const j = (i + n - 1) % n;
      const vi = pts[i];
      const vj = pts[j];
      const ex = vj[0] - vi[0];
      const ey = vj[1] - vi[1];
      const len2 = ex * ex + ey * ey;
      if (len2 === 0) continue; // mirrors CPU belt-and-suspenders skip
      const w = `${dsq}w${i}a`;
      const t = `${dsq}t${i}`;
      const b = `${dsq}b${i}`;
      ctx.push(`vec2 ${w} = ${p} - ${V2(vi)};`);
      ctx.push(`float ${t} = clamp(dot(${w}, ${V2([ex, ey])}) / ${F(len2)}, 0.0, 1.0);`);
      ctx.push(`vec2 ${b} = ${w} - ${V2([ex, ey])} * ${t};`);
      ctx.push(`${dsq} = min(${dsq}, dot(${b}, ${b}));`);
      // crossing-number: (c1&&c2&&c3) || (!c1&&!c2&&!c3) flips sign.
      const c1 = `(${p}.y >= ${F(vi[1])})`;
      const c2 = `(${p}.y < ${F(vj[1])})`;
      const c3 = `(${F(ex)} * ${w}.y > ${F(ey)} * ${w}.x)`;
      ctx.push(`if ((${c1} && ${c2} && ${c3}) || (!${c1} && !${c2} && !${c3})) ${s} = -${s};`);
    }
    const d = ctx.id('d');
    ctx.push(`float ${d} = ${s} * sqrt(${dsq});`);
    return d;
  },
};

// ---- op emitters -----------------------------------------------------------
// Signature: (ctx, p, ast) → float var name. Children are live SDF2 instances
// (ast.children), recursed via walk(ctx, p, child).

// Smooth-boolean fold shared by union/intersection/difference. K === null →
// hard min/max. Exact CPU polynomial (dn.js) otherwise.
function foldBoolean(ctx, p, ast, kind) {
  const K = ast.opts && ast.opts.k != null ? ast.opts.k : null;
  let d1 = walk(ctx, p, ast.children[0]);
  const acc = ctx.id('d');
  ctx.push(`float ${acc} = ${d1};`);
  for (let i = 1; i < ast.children.length; i++) {
    const d2 = walk(ctx, p, ast.children[i]);
    if (K === null) {
      if (kind === 'union') ctx.push(`${acc} = min(${acc}, ${d2});`);
      else if (kind === 'intersection') ctx.push(`${acc} = max(${acc}, ${d2});`);
      else ctx.push(`${acc} = max(${acc}, -${d2});`);
    } else {
      const h = ctx.id('h');
      if (kind === 'union') {
        ctx.push(`float ${h} = clamp(0.5 + 0.5 * (${d2} - ${acc}) / ${F(K)}, 0.0, 1.0);`);
        ctx.push(`${acc} = ${d2} + (${acc} - ${d2}) * ${h} - ${F(K)} * ${h} * (1.0 - ${h});`);
      } else if (kind === 'intersection') {
        ctx.push(`float ${h} = clamp(0.5 - 0.5 * (${d2} - ${acc}) / ${F(K)}, 0.0, 1.0);`);
        ctx.push(`${acc} = ${d2} + (${acc} - ${d2}) * ${h} + ${F(K)} * ${h} * (1.0 - ${h});`);
      } else {
        ctx.push(`float ${h} = clamp(0.5 - 0.5 * (${d2} + ${acc}) / ${F(K)}, 0.0, 1.0);`);
        ctx.push(`${acc} = ${acc} + (-${d2} - ${acc}) * ${h} + ${F(K)} * ${h} * (1.0 - ${h});`);
      }
    }
  }
  return acc;
}

const OPS = {
  union: (ctx, p, ast) => foldBoolean(ctx, p, ast, 'union'),
  intersection: (ctx, p, ast) => foldBoolean(ctx, p, ast, 'intersection'),
  difference: (ctx, p, ast) => foldBoolean(ctx, p, ast, 'difference'),

  blend(ctx, p, ast) {
    // CPU: d = K*d2 + (1-K)*d1, K from scalar arg / opts.k, default 0.5.
    const K = ast.scalars.length
      ? ast.scalars[0]
      : (ast.opts && ast.opts.k) != null
        ? ast.opts.k
        : 0.5;
    let acc = walk(ctx, p, ast.children[0]);
    const d = ctx.id('d');
    ctx.push(`float ${d} = ${acc};`);
    for (let i = 1; i < ast.children.length; i++) {
      const d2 = walk(ctx, p, ast.children[i]);
      ctx.push(`${d} = ${F(K)} * ${d2} + ${F(1 - K)} * ${d};`);
    }
    return d;
  },

  negate(ctx, p, ast) {
    const c = walk(ctx, p, ast.children[0]);
    const d = ctx.id('d');
    ctx.push(`float ${d} = -${c};`);
    return d;
  },

  translate(ctx, p, ast) {
    const q = ctx.id('p');
    ctx.push(`vec2 ${q} = ${p} - ${V2(ast.scalars[0])};`);
    return walk(ctx, q, ast.children[0]);
  },

  rotate(ctx, p, ast) {
    // CPU applies rotMat(-angle) = [c, s; -s, c] to p.
    const a = ast.scalars[0];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const q = ctx.id('p');
    ctx.push(
      `vec2 ${q} = vec2(${F(ca)} * ${p}.x + ${F(sa)} * ${p}.y, ${F(-sa)} * ${p}.x + ${F(ca)} * ${p}.y);`,
    );
    return walk(ctx, q, ast.children[0]);
  },

  scale(ctx, p, ast) {
    const s = asVec2(ast.scalars[0]);
    const q = ctx.id('p');
    ctx.push(`vec2 ${q} = ${p} / ${V2(s)};`);
    const c = walk(ctx, q, ast.children[0]);
    const d = ctx.id('d');
    ctx.push(`float ${d} = ${c} * ${F(Math.min(s[0], s[1]))};`);
    return d;
  },

  dilate(ctx, p, ast) {
    const c = walk(ctx, p, ast.children[0]);
    const d = ctx.id('d');
    ctx.push(`float ${d} = ${c} - ${F(ast.scalars[0])};`);
    return d;
  },

  erode(ctx, p, ast) {
    const c = walk(ctx, p, ast.children[0]);
    const d = ctx.id('d');
    ctx.push(`float ${d} = ${c} + ${F(ast.scalars[0])};`);
    return d;
  },

  shell(ctx, p, ast) {
    const c = walk(ctx, p, ast.children[0]);
    const d = ctx.id('d');
    ctx.push(`float ${d} = abs(${c}) - ${F(ast.scalars[0] / 2)};`);
    return d;
  },

  circular_array(ctx, p, ast) {
    // CPU brute-forces min over `count` copies rotated by rotMat(-2πi/count).
    // count is a literal → unroll. i=0 is identity.
    const count = ast.scalars[0];
    if (!Number.isInteger(count) || count < 1 || count > 64) {
      throw new CompileError(`circular_array count ${count} out of range`);
    }
    const d = ctx.id('d');
    const first = walk(ctx, p, ast.children[0]);
    ctx.push(`float ${d} = ${first};`);
    for (let i = 1; i < count; i++) {
      const a = (2 * Math.PI * i) / count;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const q = ctx.id('p');
      ctx.push(
        `vec2 ${q} = vec2(${F(ca)} * ${p}.x + ${F(sa)} * ${p}.y, ${F(-sa)} * ${p}.x + ${F(ca)} * ${p}.y);`,
      );
      const di = walk(ctx, q, ast.children[0]);
      ctx.push(`${d} = min(${d}, ${di});`);
    }
    return d;
  },

  rep(ctx, p, ast) {
    // Only the plain periodic form (no count clamp, no padding) — those need
    // per-tile logic that isn't worth unrolling; such layers fall back to CPU.
    const opts = ast.opts || {};
    if (opts.count != null) throw new CompileError('rep with count clamp — CPU fallback');
    const padding = opts.padding ?? 0;
    const padIsZero = Array.isArray(padding) ? padding.every((x) => x === 0) : padding === 0;
    if (!padIsZero) throw new CompileError('rep with padding — CPU fallback');
    const per = ast.scalars[0];
    const px = Array.isArray(per) ? (per[0] ?? per) : per;
    const py = Array.isArray(per) ? (per[1] ?? per[0]) : per;
    // CPU: wp_i = p_i − P_i · round(p_i / P_i); axis period 0 → 1e6 (no repeat).
    // ES 1.00 has no round() → floor(x + 0.5).
    const P = [px === 0 ? 1e6 : px, py === 0 ? 1e6 : py];
    const q = ctx.id('p');
    ctx.push(`vec2 ${q} = ${p} - ${V2(P)} * floor(${p} / ${V2(P)} + 0.5);`);
    return walk(ctx, q, ast.children[0]);
  },

  mirrorAxis(ctx, p, ast) {
    const axis = ast.scalars[0];
    const q = ctx.id('p');
    if (axis === 0) ctx.push(`vec2 ${q} = vec2(abs(${p}.x), ${p}.y);`);
    else ctx.push(`vec2 ${q} = vec2(${p}.x, abs(${p}.y));`);
    return walk(ctx, q, ast.children[0]);
  },
};

function walk(ctx, p, sdf) {
  const ast = sdf && sdf.ast;
  if (!ast) throw new CompileError('layer has no AST (raw closure — CPU only)');
  if (ast.kind === 'prim') {
    const emit = PRIMS[ast.name];
    if (!emit) throw new CompileError(`unsupported primitive '${ast.name}'`);
    return emit(ctx, p, ast.args);
  }
  if (ast.kind === 'op') {
    const emit = OPS[ast.name];
    if (!emit) throw new CompileError(`unsupported op '${ast.name}'`);
    return emit(ctx, p, ast);
  }
  throw new CompileError(`unknown AST kind '${ast.kind}'`);
}

/**
 * Compile a 2D chainable SDF (with .ast) to a GLSL distance function.
 *
 * @param {object} sdf  SDF2 instance (must carry .ast)
 * @param {object} opts { fnName = 'sdScene2', includeLibrary = true, maxLines = 4000 }
 * @returns {{ glsl: string|null, error: string|null, fnName: string, lines: number }}
 */
export function compileSDF2ToGLSL(sdf, opts = {}) {
  const { fnName = 'sdScene2', includeLibrary = true, maxLines = 4000 } = opts;
  try {
    const ctx = new Ctx(maxLines);
    const result = walk(ctx, 'p', sdf);
    const body = `float ${fnName}(vec2 p) {\n${ctx.lines.join('\n')}\n  return ${result};\n}`;
    const library = includeLibrary ? `${SDF2_GLSL}\n${SDF2_COMPILE_EXTRAS}\n` : '';
    return { glsl: `${library}${body}`, error: null, fnName, lines: ctx.lines.length };
  } catch (e) {
    if (e instanceof CompileError) return { glsl: null, error: e.message, fnName, lines: 0 };
    throw e;
  }
}
