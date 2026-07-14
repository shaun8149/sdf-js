// sdf-js/scripts/test-tone.mjs — ?tone=white 后处理契约。
// 不变量:黑石家族全体变白(白塑料参数)、accent 色不动、发光体不动、
// 明度次序保留(深的仍略深)、嵌套 children 一并处理、默认(不调用)零影响。
import { applyWhiteTone } from '../src/scene/tone.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { resolveMaterialRefs } from '../src/scene/spec.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== tone (?tone=white 黑石→白石试验) ===\n');

const rock = { hue: 0.62, sat: 0.25, value: 0.1, kind: 'normal', roughness: 0.48 };
const stela = { hue: 0.6, sat: 0.2, value: 0.42, kind: 'normal', roughness: 0.8 };
const red = { hue: 0.995, sat: 0.85, value: 0.78, glow: 0.12, kind: 'normal' };
const blue = { hue: 0.57, sat: 0.55, value: 0.72, kind: 'normal' };
const lamp = { hue: 0.6, sat: 0.1, value: 0.3, glow: 0.5, kind: 'normal' };

const scene = {
  subjects: [
    { id: 'a', material: { ...rock } },
    { id: 'b', material: { ...stela } },
    { id: 'c', material: { ...red } },
    { id: 'd', material: { ...blue } },
    { id: 'e', material: { ...lamp } },
    { id: 'tree', children: [{ material: { ...rock } }, { material: { ...red } }] },
  ],
};
applyWhiteTone(scene);
const m = (id) => scene.subjects.find((s) => s.id === id).material;

ok(m('a').value >= 0.8 && m('a').sat < 0.05, 'near-black rock → white');
ok(m('b').value >= 0.8, 'dark stela → white');
ok(m('a').value < m('b').value, 'tonal order preserved (darker rock stays the darker white)');
ok(m('a').clearcoat >= 0.45 && m('a').roughness < 0.4, 'white reads as coated plastic/stone');
ok(JSON.stringify(m('c')) === JSON.stringify(red), 'red accent untouched');
ok(JSON.stringify(m('d')) === JSON.stringify(blue), 'blue accent untouched');
ok(JSON.stringify(m('e')) === JSON.stringify(lamp), 'emissive untouched (glow is lighting)');
const tree = scene.subjects.find((s) => s.id === 'tree');
ok(tree.children[0].material.value >= 0.8, 'nested children whiten too');
ok(
  JSON.stringify(tree.children[1].material) === JSON.stringify(red),
  'nested accent still untouched',
);

// 整 deck 冒烟:装配后材质在 registry(string ref)—— 白化必须打在注册表上
{
  const DECK = JSON.parse(
    readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'),
  );
  const s = assembleDeck(DECK, { layout: 'theater', decorSeed: 'hash-A' });
  applyWhiteTone(s);
  const inflated = resolveMaterialRefs(s);
  const darkNeutral = inflated.subjects.filter(
    (x) =>
      x.material &&
      typeof x.material === 'object' &&
      (x.material.glow || 0) <= 0.05 &&
      (x.material.sat ?? 0) <= 0.35 &&
      (x.material.value ?? 1) <= 0.55,
  );
  ok(
    darkNeutral.length === 0,
    `assembled deck has zero dark-neutral leftovers (registry rethemed)`,
  );
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
