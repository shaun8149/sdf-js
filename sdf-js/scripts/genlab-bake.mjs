#!/usr/bin/env node
// =============================================================================
// genlab-bake — 把 genlab 产物模块 (out-v2/<id>.js) 烘成 DIMENSION 链上 bundle
// (objects2d/lib-objects.js / lib-landscapes.js / lib-themes.js)。
// -----------------------------------------------------------------------------
// 变换 (每件):
//   import { a, b, render } from '../../src/index.js'  →  const { a, b } = CHAIN;
//   const canvas = document.getElementById('c'); const ctx = canvas.getContext('2d');  → 删
//   render.silhouette(ctx, LAYERS, { view: V, background: B });  →  return __mk(LAYERS, V, B);
//   整体包成  __o["<id>"] = () => { ... };
// 键顺序 = 现有 bundle 的键顺序 (hash → 件 的映射靠 Object.keys 顺序, 一位不能动)。
// 输出经 terser 压缩 (安全选项, 不动数值与求值顺序), 并在 vm 里装配自检:
// 每个工厂可调用、layers 非空、每层 sdf 可求值、color 三元、view 数值、background 形态合法。
// 用法: node sdf-js/scripts/genlab-bake.mjs [--src out-v2] [--dim /path/to/DIMENSION] [--dry]
//       [--only objects,landscapes,themes]
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const SRC = join(ROOT, 'examples/genlab', opt('--src', 'out-v2'));
const DIM = opt('--dim', '/Users/hexiaoyang/Documents/sdf/DIMENSION');
const DRY = args.includes('--dry');
const ONLY = opt('--only', 'objects,landscapes,themes').split(',');
// terser 不在 sdf-main 依赖里: 先找 repo 的 node_modules, 再找 --terser-dir (默认 /tmp/genlab-min, `npm i terser` 即可)
const terser = (() => {
  for (const base of [
    join(ROOT, '..', 'package.json'),
    join(opt('--terser-dir', '/tmp/genlab-min'), 'package.json'),
  ]) {
    try {
      return createRequire(base)('terser');
    } catch {}
  }
  throw new Error('找不到 terser: npm i terser --prefix /tmp/genlab-min, 或 --terser-dir <dir>');
})();

const BUNDLES = { objects: 'LIB_OBJECTS', landscapes: 'LIB_LANDSCAPES', themes: 'LIB_THEMES' };

// ---- 现有 bundle 的键顺序 ----
const orderOf = (pool) => {
  const s = readFileSync(join(DIM, 'objects2d', `lib-${pool}.js`), 'utf8');
  return [...s.matchAll(/o(?:\.([a-z][a-z0-9]*)|\["([^"]+)"\])=\(\)=>/g)].map((m) => m[1] || m[2]);
};

// ---- 括号配平取一个表达式 (从 pos 起, 到顶层 , 或 } 为止) ----
const takeExpr = (s, pos) => {
  let depth = 0,
    i = pos;
  for (; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) {
      if (depth === 0) break;
      depth--;
    } else if (c === ',' && depth === 0) break;
  }
  return [s.slice(pos, i).trim(), i];
};

const transform = (id, src) => {
  // import
  const im = src.match(/^import\s*\{([\s\S]*?)\}\s*from\s*['"][^'"]*src\/index\.js['"];?\s*\n/m);
  if (!im) throw new Error(`${id}: 无 import 语句`);
  const names = im[1]
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((n) => n !== 'render');
  for (const n of names)
    if (!/^[A-Za-z_$][\w$]*$/.test(n)) throw new Error(`${id}: import 名不合法 ${n}`);
  let body = src.replace(im[0], '');
  // canvas / ctx
  body = body.replace(
    /^[ \t]*const\s+canvas\s*=\s*document\.getElementById\(['"]c['"]\);?[ \t]*\n/m,
    '',
  );
  body = body.replace(/^[ \t]*const\s+ctx\s*=\s*canvas\.getContext\(['"]2d['"]\);?[ \t]*\n/m, '');
  if (
    /document\.|window\.|Math\.random|Date\.now|performance\./.test(body.replace(/\/\/.*$/gm, ''))
  )
    throw new Error(`${id}: 残留 DOM / 随机 / 时间引用`);
  // render.silhouette(ctx, LAYERS, { ... });
  const rc = body.match(/render\.silhouette\(\s*ctx\s*,/);
  if (!rc) throw new Error(`${id}: 无 render.silhouette(ctx, ...) 调用`);
  let pos = rc.index + rc[0].length;
  const [layersExpr, p1] = takeExpr(body, pos);
  if (body[p1] !== ',') throw new Error(`${id}: render 调用缺 options`);
  const [optsExpr, p2] = takeExpr(body, p1 + 1);
  const close = body.indexOf(')', p2);
  const tail = body.slice(close + 1).replace(/^\s*;/, '');
  if (/\S/.test(tail.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')))
    throw new Error(`${id}: render 调用之后还有代码`);
  const o = optsExpr.trim();
  if (!o.startsWith('{') || !o.endsWith('}'))
    throw new Error(`${id}: options 不是对象字面量: ${o.slice(0, 40)}`);
  const inner = o.slice(1, -1);
  // 逐键解析 options 对象 (值用括号配平截取, 支持嵌套对象)
  const opts = {};
  let q = 0;
  while (q < inner.length) {
    const km = /\s*(?:\/\/[^\n]*\n\s*)*([a-zA-Z_$][\w$]*)\s*:/y;
    km.lastIndex = q;
    const m = km.exec(inner);
    if (!m) {
      if (/\S/.test(inner.slice(q).replace(/\/\/.*$/gm, '')))
        throw new Error(`${id}: options 解析失败: ${inner.slice(q, q + 40)}`);
      break;
    }
    const [val, end] = takeExpr(inner, km.lastIndex);
    opts[m[1]] = val;
    q = inner[end] === ',' ? end + 1 : end;
  }
  const unknown = Object.keys(opts).filter((k) => k !== 'view' && k !== 'background');
  if (unknown.length) throw new Error(`${id}: options 有未处理键: ${unknown.join(',')}`);
  const view = opts.view ?? '1.2';
  const background = opts.background ?? '[255, 255, 255]';
  const head = body.slice(0, rc.index);
  return `__o[${JSON.stringify(id)}]=()=>{const{${names.join(',')}}=CHAIN;\n${head}return __mk(${layersExpr}, ${view}, ${background});\n};\n`;
};

const chainCtx = () => {
  const ctx = { console, Math };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['lib2d/chain.js', 'lib2d/vec.js', 'lib2d/sdf.js'])
    vm.runInContext(readFileSync(join(DIM, f), 'utf8'), ctx, { filename: f });
  return ctx;
};

const validate = (pool, code, ids) => {
  const ctx = chainCtx();
  vm.runInContext(code, ctx, { filename: `lib-${pool}.js` });
  const name = BUNDLES[pool];
  const got = vm.runInContext(`Object.keys(${name})`, ctx);
  if (JSON.stringify(got) !== JSON.stringify(ids))
    throw new Error(`${pool}: 键顺序与旧 bundle 不一致`);
  const report = vm.runInContext(
    `(() => {
    const out = [];
    for (const id of Object.keys(${name})) {
      try {
        const p = ${name}[id]();
        if (!Array.isArray(p.layers) || p.layers.length === 0) throw new Error('layers 空');
        if (typeof p.view !== 'number' || !(p.view > 0)) throw new Error('view 非法 ' + p.view);
        const b = p.background;
        const okBg = (Array.isArray(b) && b.length === 3) || (b && Array.isArray(b.top) && Array.isArray(b.bottom)) || typeof b === 'function';
        if (!okBg) throw new Error('background 形态非法');
        let n = 0;
        for (const L of p.layers) {
          const f = L.sdf && (L.sdf.f ? L.sdf.f : L.sdf);
          if (typeof f !== 'function') throw new Error('layer ' + n + ' sdf 非函数');
          if (!Array.isArray(L.color) || L.color.length !== 3) throw new Error('layer ' + n + ' color 非法');
          for (let gy = -1.2; gy <= 1.2001; gy += 0.3) for (let gx = -1.2; gx <= 1.2001; gx += 0.3) { const d = f([gx, gy]); if (!Number.isFinite(d)) throw new Error('layer ' + n + ' sdf 非有限 ' + d + ' @' + gx.toFixed(1) + ',' + gy.toFixed(1)); }
          n++;
        }
        out.push({ id, ok: true, layers: n });
      } catch (e) { out.push({ id, ok: false, err: String(e.message).slice(0, 120) }); }
    }
    return out;
  })()`,
    ctx,
  );
  return report;
};

for (const pool of ONLY) {
  const ids = orderOf(pool);
  const parts = [];
  const missing = [];
  for (const id of ids) {
    const f = join(SRC, `${id}.js`);
    if (!existsSync(f)) {
      missing.push(id);
      continue;
    }
    parts.push(transform(id, readFileSync(f, 'utf8')));
  }
  if (missing.length) throw new Error(`${pool}: 缺 ${missing.length} 件新版: ${missing.join(',')}`);
  const raw = `const ${BUNDLES[pool]}=(()=>{const __o={},__mk=(l,v,b)=>({layers:l,view:v,background:b});\n${parts.join('')}return __o;})();\n`;
  const min = await terser.minify(raw, {
    ecma: 2020,
    module: false,
    toplevel: false,
    compress: { passes: 2, unsafe: false, unsafe_math: false, keep_infinity: true },
    mangle: true,
    format: { comments: false },
  });
  if (min.error) throw min.error;
  const code = min.code + '\n';
  const report = validate(pool, code, ids);
  const bad = report.filter((r) => !r.ok);
  const oldSize = readFileSync(join(DIM, 'objects2d', `lib-${pool}.js`)).length;
  console.log(
    `${pool}: ${ids.length} 件, 自检 ${report.length - bad.length}/${report.length} ok, 层数均值 ${(report.reduce((s, r) => s + (r.layers || 0), 0) / report.length).toFixed(1)}, 体积 ${(oldSize / 1024).toFixed(0)}KB → ${(code.length / 1024).toFixed(0)}KB (未压缩 ${(raw.length / 1024).toFixed(0)}KB)`,
  );
  for (const b of bad) console.log(`  ✗ ${b.id}: ${b.err}`);
  if (bad.length) throw new Error(`${pool}: ${bad.length} 件自检失败, 不写`);
  if (!DRY) {
    writeFileSync(join(DIM, 'objects2d', `lib-${pool}.js`), code);
    console.log(`  → 写入 objects2d/lib-${pool}.js`);
  }
}
