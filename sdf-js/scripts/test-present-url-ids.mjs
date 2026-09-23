#!/usr/bin/env node
// URL route ids are user-controlled; they must never escape scenes/.
import { irJsonPath, sceneFilePath, sceneJsonPath } from '../apps/present/scene-url.js';

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures++;
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
};
const rejects = (fn, msg) => {
  try {
    fn();
    ok(false, msg);
  } catch {
    ok(true, msg);
  }
};

console.log('=== Present URL id safety ===\n');

ok(
  sceneJsonPath('deck-studio-keynote') === '../../scenes/deck-studio-keynote.json',
  'deck slug path',
);
ok(irJsonPath('3dgs-paper') === '../../scenes/ir/3dgs-paper.json', 'IR slug path');
ok(
  sceneFilePath('deck-studio-keynote.json') === '../../scenes/deck-studio-keynote.json',
  'segment file path',
);

for (const bad of ['../package', '..%2fpackage', 'foo/bar', 'foo\\bar', 'foo.json', '', '.']) {
  rejects(() => sceneJsonPath(bad), `reject scene id ${JSON.stringify(bad)}`);
  rejects(() => irJsonPath(bad), `reject IR id ${JSON.stringify(bad)}`);
}

for (const bad of [
  '../package.json',
  'spikes/w0.json',
  'deck-studio-keynote',
  'foo..json',
  'foo.json/../bar',
]) {
  rejects(() => sceneFilePath(bad), `reject scene file ${JSON.stringify(bad)}`);
}

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nAll Present URL id safety tests passed');
