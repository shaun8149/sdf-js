#!/usr/bin/env node
// =============================================================================
// genlab-render — 在 node 里把 genlab 产物模块 (import '../../src/index.js' +
// render.silhouette(document.getElementById('c')...) 形态) 渲成 PNG。
// 用法: node sdf-js/scripts/genlab-render.mjs <module.js> <out.png> [size]
// 也可 import { renderModule } 复用。
// =============================================================================
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const TMP = join(ROOT, 'examples/genlab/.tmp');
mkdirSync(TMP, { recursive: true });
const SRC_URL = pathToFileURL(join(ROOT, 'src/index.js')).href;
const ALLOWED_IMPORT_RE = /^(?:\.\.\/)+src\/index\.js$/;
const FORBIDDEN_TOKEN_RE =
  /\b(?:require|process|global|globalThis|window|eval|Function|WebAssembly|fetch|XMLHttpRequest|Worker|MessageChannel|setTimeout|setInterval|queueMicrotask|crypto|Date|performance|Buffer|constructor|__proto__|prototype)\b/;

function maskStringsAndComments(source) {
  let out = '';
  for (let i = 0; i < source.length; ) {
    const c = source[i];
    const n = source[i + 1];
    if (c === '/' && n === '/') {
      out += '  ';
      i += 2;
      while (i < source.length && source[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && n === '*') {
      out += '  ';
      i += 2;
      while (i < source.length) {
        if (source[i] === '*' && source[i + 1] === '/') {
          out += '  ';
          i += 2;
          break;
        }
        out += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      out += ' ';
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          out += ' ';
          if (i + 1 < source.length) out += source[i + 1] === '\n' ? '\n' : ' ';
          i += 2;
          continue;
        }
        const end = source[i] === quote;
        out += source[i] === '\n' ? '\n' : ' ';
        i++;
        if (end) break;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function findStatementEnd(masked, start) {
  const semi = masked.indexOf(';', start);
  if (semi >= 0) return semi + 1;
  const nl = masked.indexOf('\n', start);
  return nl >= 0 ? nl : masked.length;
}

export function validateGenlabModuleSource(source, label = 'module') {
  if (source.includes('`')) throw new Error(`${label}: template literals are not allowed`);
  const masked = maskStringsAndComments(source);
  const imports = [];
  for (const m of masked.matchAll(/\bimport\b/g)) {
    const rest = masked.slice(m.index + m[0].length);
    if (/^\s*\(/.test(rest)) throw new Error(`${label}: dynamic import is not allowed`);
    const raw = source.slice(m.index, findStatementEnd(masked, m.index));
    const from = raw.match(/\bfrom\s*(['"])([^'"]+)\1/);
    const bare = raw.match(/^import\s*(['"])([^'"]+)\1\s*;?\s*$/);
    const spec = from?.[2] ?? bare?.[2];
    if (!spec || !ALLOWED_IMPORT_RE.test(spec))
      throw new Error(`${label}: forbidden import ${spec || raw.trim().slice(0, 80)}`);
    imports.push(spec);
  }
  if (imports.length !== 1)
    throw new Error(`${label}: expected exactly one import from ../../src/index.js`);
  const forbidden = masked.match(FORBIDDEN_TOKEN_RE);
  if (forbidden) throw new Error(`${label}: forbidden token ${forbidden[0]}`);
  if (/\bMath\s*\.\s*random\b/.test(masked))
    throw new Error(`${label}: Math.random is not allowed`);
  for (const m of masked.matchAll(/\bdocument\b/g)) {
    const rest = masked.slice(m.index + 'document'.length);
    if (!/^\s*\.\s*getElementById\s*\(/.test(rest))
      throw new Error(`${label}: only document.getElementById(...) is allowed`);
  }
}

export async function renderModule(srcPath, pngPath, size = 600) {
  const source = readFileSync(srcPath, 'utf8');
  validateGenlabModuleSource(source, basename(srcPath));
  const code = source.replace(
    /(['"])(?:\.\.\/)+src\/index\.js\1/,
    JSON.stringify(SRC_URL),
  );
  const canvas = createCanvas(size, size);
  const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document');
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  globalThis.document = { getElementById: () => canvas };
  globalThis.window = globalThis;
  const tmp = join(TMP, `${basename(srcPath, '.js')}-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tmp, code);
  try {
    await import(pathToFileURL(tmp).href);
  } finally {
    if (hadDocument) globalThis.document = oldDocument;
    else delete globalThis.document;
    if (hadWindow) globalThis.window = oldWindow;
    else delete globalThis.window;
    try {
      (await import('node:fs')).unlinkSync(tmp);
    } catch {}
  }
  const buf = canvas.toBuffer('image/png');
  if (pngPath) writeFileSync(pngPath, buf);
  return buf;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [src, png, size] = process.argv.slice(2);
  if (!src || !png) {
    console.error('用法: genlab-render.mjs <module.js> <out.png> [size]');
    process.exit(1);
  }
  await renderModule(src, png, size ? Number(size) : 600);
  console.log('wrote', png);
}
