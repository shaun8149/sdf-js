// sdf-js/scripts/test-landing-bfcache.mjs — landing bfcache recovery contract.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, '../apps/present/landing/landing.js'), 'utf8');

let pass = 0;
let fail = 0;
const ok = (condition, name) => {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
};

console.log('=== landing bfcache recovery ===\n');

ok(/window\.addEventListener\('pageshow'/.test(source), 'landing listens for pageshow restores');
ok(/event\.persisted/.test(source), 'handler gates on bfcache persisted restores');
ok(/state\s*=\s*'room'/.test(source), 'recovery resets the one-way entrance state');
ok(/enterProg\s*=\s*0/.test(source), 'recovery clears the fly-in progress');
ok(
  /document\.body\.classList\.remove\('entering'\)/.test(source),
  'recovery reveals the landing UI again',
);
ok(/logoEl\.classList\.remove\('on'\)/.test(source), 'recovery hides the intro logo');
ok(/fadeEl\.classList\.remove\('on'\)/.test(source), 'recovery clears the intro fade overlay');
ok(
  /resetLandingRoomState\(\);\s*window\.location\.reload\(\)/.test(source),
  'landing reloads after resetting stale bfcache/WebGL state',
);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
