import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const REPO = new URL('../..', import.meta.url).pathname;
const GENLAB = join(REPO, 'sdf-js/examples/genlab');

let passed = 0;
let failed = 0;
function ok(cond, msg, extra = '') {
  if (cond) {
    passed++;
    console.log(`  PASS ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL ${msg}${extra ? ` -- ${extra}` : ''}`);
  }
}

function setupTemp() {
  mkdirSync(join(GENLAB, '.tmp'), { recursive: true });
  const tmp = mkdtempSync(join(GENLAB, '.tmp', 'bake-order-'));
  const dim = mkdtempSync(join(tmpdir(), 'genlab-bake-order-dim-'));
  mkdirSync(join(tmp, 'src'), { recursive: true });
  mkdirSync(join(tmp, 'terser', 'node_modules', 'terser'), { recursive: true });
  mkdirSync(join(dim, 'objects2d'), { recursive: true });
  mkdirSync(join(dim, 'lib2d'), { recursive: true });
  writeFileSync(join(tmp, 'terser', 'package.json'), '{"name":"fake-terser-root"}\n');
  writeFileSync(
    join(tmp, 'terser', 'node_modules', 'terser', 'index.js'),
    'module.exports = { minify: async (code) => ({ code }) };\n',
  );
  writeFileSync(join(dim, 'lib2d', 'chain.js'), 'globalThis.CHAIN = {};\n');
  writeFileSync(join(dim, 'lib2d', 'vec.js'), '');
  writeFileSync(join(dim, 'lib2d', 'sdf.js'), '');
  return { tmp, dim };
}

function writeSource(dir, id) {
  writeFileSync(
    join(dir, 'src', `${id}.js`),
    `import { render } from '../../src/index.js';
const layers = [{ sdf: { f: () => 1 }, color: [1, 2, 3] }];
render.silhouette(ctx, layers, { view: 1, background: [255, 255, 255] });
`,
  );
}

function runBake(tmp, dim) {
  return spawnSync(
    process.execPath,
    [
      'sdf-js/scripts/genlab-bake.mjs',
      '--src',
      `.tmp/${basename(tmp)}/src`,
      '--dim',
      dim,
      '--terser-dir',
      join(tmp, 'terser'),
      '--only',
      'objects',
    ],
    { cwd: REPO, encoding: 'utf8' },
  );
}

function bundleKeys(dim) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(dim, 'objects2d', 'lib-objects.js'), 'utf8'), ctx);
  return vm.runInContext('Object.keys(LIB_OBJECTS)', ctx);
}

{
  const { tmp, dim } = setupTemp();
  try {
    writeFileSync(
      join(dim, 'objects2d', 'lib-objects.js'),
      'const LIB_OBJECTS=(()=>{const e={};return e["object-a"]=()=>({layers:[{sdf:{f:()=>1},color:[0,0,0]}],view:1,background:[0,0,0]}),e})();\n',
    );
    writeSource(tmp, 'object-a');
    const bake = runBake(tmp, dim);
    ok(bake.status === 0, 'rebake accepts minified bundles with mangled object names', bake.stderr);
    ok(
      JSON.stringify(bundleKeys(dim)) === JSON.stringify(['object-a']),
      'rebake preserves the existing bundle key order',
      bake.stdout + bake.stderr,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(dim, { recursive: true, force: true });
  }
}

{
  const { tmp, dim } = setupTemp();
  try {
    const original = 'const LIB_OBJECTS=(()=>{const e={};return e})();\n';
    writeFileSync(join(dim, 'objects2d', 'lib-objects.js'), original);
    const bake = runBake(tmp, dim);
    ok(bake.status !== 0, 'bake rejects an empty existing bundle key order');
    ok(
      readFileSync(join(dim, 'objects2d', 'lib-objects.js'), 'utf8') === original,
      'empty key-order rejection does not overwrite the existing bundle',
      bake.stdout + bake.stderr,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(dim, { recursive: true, force: true });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
