#!/usr/bin/env node
import assert from 'node:assert/strict';
import { transform } from './genlab-bake.mjs';

const header = "import { circle, render } from '../../src/index.js';\n";
const renderCall =
  "const canvas = document.getElementById('c');\n" +
  "const ctx = canvas.getContext('2d');\n" +
  "const layers = [{ sdf: circle(0.5), color: [10, 20, 30] }];\n" +
  'render.silhouette(ctx, layers, { view: 1.2, background: [240, 240, 240] });\n';

const ok = transform('safe-piece', header + renderCall);
assert.match(ok, /__o\["safe-piece"\]=\(\)=>/);
assert.match(ok, /return __mk\(layers, 1\.2, \[240, 240, 240\]\)/);

const rejects = [
  ['global constructor escape', "const leak = globalThis.constructor.constructor('return process')();"],
  ['math constructor escape', "const leak = Math['constructor']['constructor']('return process')();"],
  ['dynamic import', "const fs = import('node:fs');"],
  ['process access', "const pid = process.pid;"],
  ['timer side effect', 'setTimeout(() => {}, 1);'],
  ['template literal expression', 'const x = `${1 + 1}`;'],
];

for (const [name, payload] of rejects) {
  assert.throws(
    () => transform(name, header + payload + '\n' + renderCall),
    /禁止|残留/,
    `${name} should be rejected before vm validation`,
  );
}

console.log('test-genlab-bake-guard: ok');
