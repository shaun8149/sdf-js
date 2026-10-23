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

export async function renderModule(srcPath, pngPath, size = 600) {
  const code = readFileSync(srcPath, 'utf8').replace(
    /(['"])(?:\.\.\/)+src\/index\.js\1/,
    JSON.stringify(SRC_URL),
  );
  const canvas = createCanvas(size, size);
  globalThis.document = { getElementById: () => canvas };
  globalThis.window = globalThis;
  const tmp = join(TMP, `${basename(srcPath, '.js')}-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tmp, code);
  try {
    await import(pathToFileURL(tmp).href);
  } finally {
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
