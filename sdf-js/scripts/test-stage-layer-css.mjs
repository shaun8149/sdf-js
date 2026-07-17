// sdf-js/scripts/test-stage-layer-css.mjs — shared figure-core stage CSS invariants.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const presentDir = join(root, 'apps', 'present');

let pass = 0;
let fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ok ${n}`)) : (fail++, console.log(`  FAIL ${n}`)));

console.log('=== stage-layer CSS ===\n');

const core = readFileSync(join(presentDir, 'figure-core.js'), 'utf8');
ok(core.includes('side-right'), 'figure-core emits side-right stage bullets');

const htmlFiles = readdirSync(presentDir)
  .filter((name) => name.endsWith('.html'))
  .sort();
const stagePages = htmlFiles.filter((name) => {
  const html = readFileSync(join(presentDir, name), 'utf8');
  return html.includes('.stage-bullet {');
});

ok(stagePages.includes('figure.html'), 'figure page owns stage-bullet CSS');
ok(stagePages.includes('author.html'), 'author page owns stage-bullet CSS');

for (const name of stagePages) {
  const html = readFileSync(join(presentDir, name), 'utf8');
  ok(html.includes('.stage-bullet.side-right {'), `${name} defines the right narration column`);
  ok(html.includes('.stage-bullet.side-right.on {'), `${name} defines right-column reveal state`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
