import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = new URL('../..', import.meta.url).pathname;
const GENLAB = join(REPO, 'sdf-js/examples/genlab');

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

mkdirSync(join(GENLAB, '.tmp'), { recursive: true });
const tmp = mkdtempSync(join(GENLAB, '.tmp', 'bake-atomic-'));
const dim = mkdtempSync(join(tmpdir(), 'genlab-bake-dim-'));

const writeBundle = (pool, id, marker) => {
  writeFileSync(
    join(dim, 'objects2d', `lib-${pool}.js`),
    `const LIB_${pool.toUpperCase()}=(()=>{const o={};o[${JSON.stringify(id)}]=()=>({layers:[{sdf:{f:()=>1},color:[0,0,0]}],view:1,background:[0,0,0],marker:${JSON.stringify(marker)}});return o;})();\n`,
  );
};

const writeSource = (id) => {
  writeFileSync(
    join(tmp, 'src', `${id}.js`),
    `import { render } from '../../src/index.js';
const layers = [{ sdf: { f: () => 1 }, color: [1, 2, 3] }];
render.silhouette(ctx, layers, { view: 1, background: [255, 255, 255] });
`,
  );
};

try {
  mkdirSync(join(tmp, 'src'), { recursive: true });
  mkdirSync(join(tmp, 'terser', 'node_modules', 'terser'), { recursive: true });
  writeFileSync(join(tmp, 'terser', 'package.json'), '{"name":"fake-terser-root"}\n');
  writeFileSync(
    join(tmp, 'terser', 'node_modules', 'terser', 'index.js'),
    'module.exports = { minify: async (code) => ({ code }) };\n',
  );

  mkdirSync(join(dim, 'objects2d'), { recursive: true });
  mkdirSync(join(dim, 'lib2d'), { recursive: true });
  writeFileSync(join(dim, 'lib2d', 'chain.js'), 'globalThis.CHAIN = {};\n');
  writeFileSync(join(dim, 'lib2d', 'vec.js'), '');
  writeFileSync(join(dim, 'lib2d', 'sdf.js'), '');
  writeBundle('objects', 'object-a', 'old-object');
  writeBundle('landscapes', 'land-a', 'old-land');
  writeBundle('themes', 'theme-a', 'old-theme');

  writeSource('object-a');
  const originalObjects = readFileSync(join(dim, 'objects2d', 'lib-objects.js'), 'utf8');
  const relSrc = `.tmp/${basename(tmp)}/src`;
  const bakeArgs = [
    'sdf-js/scripts/genlab-bake.mjs',
    '--src',
    relSrc,
    '--dim',
    dim,
    '--terser-dir',
    join(tmp, 'terser'),
  ];

  const failedBake = spawnSync(process.execPath, bakeArgs, { cwd: REPO, encoding: 'utf8' });
  ok(failedBake.status !== 0, 'bake fails when a later pool is missing sources');
  ok(
    readFileSync(join(dim, 'objects2d', 'lib-objects.js'), 'utf8') === originalObjects,
    'failed multi-pool bake leaves earlier validated bundles untouched',
    failedBake.stdout + failedBake.stderr,
  );

  writeSource('land-a');
  writeSource('theme-a');
  const successfulBake = spawnSync(process.execPath, bakeArgs, { cwd: REPO, encoding: 'utf8' });
  ok(successfulBake.status === 0, 'bake succeeds once every pool validates', successfulBake.stderr);
  ok(
    readFileSync(join(dim, 'objects2d', 'lib-objects.js'), 'utf8') !== originalObjects,
    'successful bake writes validated bundle output',
  );
  ok(
    existsSync(join(dim, 'objects2d', 'lib-themes.js')),
    'successful bake preserves all bundle files',
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(dim, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
