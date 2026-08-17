// WP1-GPU Phase A: 全库 AST→GLSL 可编译性审计
import { readdirSync, readFileSync } from 'node:fs';
import { SDF2_GLSL } from '../../src/sdf/sdf2.glsl.js';

const HAVE = new Set(
  [...SDF2_GLSL.matchAll(/float\s+sd(\w+)\s*\(/g)].map((m) => m[1].toLowerCase()),
);
for (const x of ['segment', 'ellipse', 'polygon', 'arc', 'ring']) HAVE.add(x); // Phase B 计划补的 5 支
// GLSL 原语名 → ast prim 名的对应 (ast 名带 2 后缀)
const havePrim = (n) => HAVE.has(n.replace(/2$/, '').replace(/_/g, ''));
// 发射器计划支持的 op 集 (min/max/平移/旋转/缩放/膨胀等皆一行 GLSL)
const OPS_OK = new Set([
  'union',
  'intersection',
  'difference',
  'translate',
  'rotate',
  'scale',
  'dilate',
  'erode',
  'shell',
  'negate',
  'round',
  'onion',
  'mirror_x',
  'mirror_y',
  'circular_array',
  'blend',
  'rep',
  'extrude_to',
]);

const walk = (sdf, acc) => {
  const a = sdf && sdf.ast;
  if (!a) {
    acc.noAst++;
    return;
  }
  if (a.kind === 'prim') {
    acc.prims[a.name] = (acc.prims[a.name] || 0) + 1;
    if (!havePrim(a.name)) acc.missing.add(a.name);
  } else if (a.kind === 'op') {
    acc.ops[a.name] = (acc.ops[a.name] || 0) + 1;
    if (!OPS_OK.has(a.name)) acc.badOps.add(a.name);
    for (const c of a.children) walk(c, acc);
  }
};

const files = readdirSync('../../examples/genlab/out/_audit').filter((f) => f.endsWith('.mjs'));
const global = { prims: {}, ops: {}, missing: new Set(), badOps: new Set() };
let full = 0,
  partial = 0,
  broken = 0,
  loadFail = 0;
const pieceMissing = {};
for (const f of files) {
  try {
    const mod = await import(`../../examples/genlab/out/_audit/${f}`);
    const acc = {
      prims: global.prims,
      ops: global.ops,
      missing: new Set(),
      badOps: new Set(),
      noAst: 0,
    };
    for (const L of mod.__layers) walk(L.sdf, acc);
    // 逐层口径: 该件有几层可编译 (流光只需主角层)
    let okLayers = 0;
    for (const L of mod.__layers) {
      const la = { prims: {}, ops: {}, missing: new Set(), badOps: new Set(), noAst: 0 };
      walk(L.sdf, la);
      if (la.missing.size + la.badOps.size + la.noAst === 0) okLayers++;
    }
    globalThis.__withActor = (globalThis.__withActor || 0) + (okLayers > 0 ? 1 : 0);
    globalThis.__layerTotals = (globalThis.__layerTotals || 0) + mod.__layers.length;
    globalThis.__layerOk = (globalThis.__layerOk || 0) + okLayers;
    for (const m of acc.missing) global.missing.add(m);
    for (const o of acc.badOps) global.badOps.add(o);
    const bad = acc.missing.size + acc.badOps.size + acc.noAst;
    if (bad === 0) full++;
    else if (acc.noAst > 0) {
      broken++;
    } else {
      partial++;
      pieceMissing[f.replace('.mjs', '')] = [...acc.missing, ...acc.badOps];
    }
  } catch (e) {
    loadFail++;
  }
}
console.log(`═══ 审计结果 (${files.length} 件) ═══`);
console.log(`✅ 全可编译: ${full} (${((full / files.length) * 100).toFixed(0)}%)`);
console.log(
  `🎯 ≥1 层可流光 (扩库后): ${globalThis.__withActor} (${((globalThis.__withActor / files.length) * 100).toFixed(0)}%) · 层级可编译率 ${((globalThis.__layerOk / globalThis.__layerTotals) * 100).toFixed(0)}%`,
);
console.log(`🟡 缺原语/op: ${partial}`);
console.log(`⚫ 层无 AST: ${broken}  |  载入失败: ${loadFail}`);
console.log(`\n缺失 GLSL 原语 (${global.missing.size}):`, [...global.missing].join(' '));
console.log(`计划外 op (${global.badOps.size}):`, [...global.badOps].join(' '));
const primsSorted = Object.entries(global.prims).sort((a, b) => b[1] - a[1]);
console.log(
  '\n原语使用频次 top15:',
  primsSorted
    .slice(0, 15)
    .map(([n, c]) => `${n}:${c}`)
    .join(' '),
);
console.log(
  'op 使用频次:',
  Object.entries(global.ops)
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `${n}:${c}`)
    .join(' '),
);
