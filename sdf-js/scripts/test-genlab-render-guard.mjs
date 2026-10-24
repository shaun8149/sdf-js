import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderModule, validateGenlabModuleSource } from './genlab-render.mjs';

let passed = 0;
let failed = 0;

function ok(cond, msg, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}${extra ? ` — ${extra}` : ''}`);
  }
}

function mustThrow(fn, needle, msg) {
  try {
    fn();
    ok(false, msg, 'did not throw');
  } catch (e) {
    ok(String(e.message).includes(needle), msg, String(e.message));
  }
}

const goodModule = `
import { circle, render } from '../../src/index.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const layers = [
  { sdf: circle(0.45), color: [20, 40, 60] },
];
render.silhouette(ctx, layers, { view: 1.2, background: [250, 248, 242] });
`;

console.log('=== genlab-render guard ===\n');

validateGenlabModuleSource(goodModule, 'good.js');
ok(true, 'valid genlab module passes static guard');

validateGenlabModuleSource(
  `${goodModule}\nconst label = "process import('node:fs') require"; // fetch process\n`,
  'strings.js',
);
ok(true, 'comments and strings do not trip forbidden-token guard');

mustThrow(
  () =>
    validateGenlabModuleSource(
      `${goodModule}\nimport { writeFileSync } from 'node:fs';\n`,
      'extra-import.js',
    ),
  'forbidden import',
  'extra static import is rejected before execution',
);

mustThrow(
  () => validateGenlabModuleSource(`${goodModule}\nawait import('node:fs');\n`, 'dynamic.js'),
  'dynamic import',
  'dynamic import is rejected before execution',
);

mustThrow(
  () => validateGenlabModuleSource(`${goodModule}\nconsole.log(process.env);\n`, 'process.js'),
  'forbidden token process',
  'process access is rejected before execution',
);

mustThrow(
  () => validateGenlabModuleSource(`${goodModule}\nconst jitter = Math.random();\n`, 'random.js'),
  'Math.random',
  'Math.random is rejected before execution',
);

mustThrow(
  () => validateGenlabModuleSource(`${goodModule}\ndocument.body;\n`, 'dom.js'),
  'document.getElementById',
  'unexpected document access is rejected before execution',
);

const dir = mkdtempSync(join(tmpdir(), 'genlab-render-'));
try {
  const src = join(dir, 'good.js');
  const png = join(dir, 'good.png');
  writeFileSync(src, goodModule);
  const beforeDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document');
  const beforeWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const buf = await renderModule(src, png, 64);
  ok(Buffer.isBuffer(buf) && buf.length > 0, 'valid module renders to a PNG buffer');
  ok(existsSync(png), 'valid module writes requested PNG');
  ok(
    Object.prototype.hasOwnProperty.call(globalThis, 'document') === beforeDocument &&
      Object.prototype.hasOwnProperty.call(globalThis, 'window') === beforeWindow,
    'renderModule restores document/window globals',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
