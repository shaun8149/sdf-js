// sdf-js/scripts/test-asset-collection.mjs — Infinigen 研读第三课产物的契约测试。
// make_asset_collection 的移植不变量:确定性加权抽种、权重分布成立、
// 混林天际线的 analytic 安全 + 预算语义不变 + 默认路径零改动(golden 由
// test-assemble-deck-golden 双保险)。
import { makeAssetCollection } from '../src/scene/asset-collection.js';
import { makeBoulderFactory } from '../src/scene/boulder-factory.js';
import { boulderHorizon } from '../src/scene/environments.js';
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== asset collection + boulder horizon (Infinigen lesson 03) ===\n');

const species = [
  makeBoulderFactory('mix-a'),
  makeBoulderFactory('mix-b'),
  makeBoulderFactory('mix-c'),
];

// ---- 确定性加权抽种 ---------------------------------------------------------------
{
  const a = makeAssetCollection(species, { weights: [0.6, 0.25, 0.15], seed: 's1' });
  const b = makeAssetCollection(species, { weights: [0.6, 0.25, 0.15], seed: 's1' });
  const picksA = Array.from({ length: 40 }, (_, i) => a.pick(i)).join('');
  ok(
    picksA === Array.from({ length: 40 }, (_, i) => b.pick(i)).join(''),
    'same seed → same species sequence',
  );
  const c = makeAssetCollection(species, { weights: [0.6, 0.25, 0.15], seed: 's2' });
  ok(
    picksA !== Array.from({ length: 40 }, (_, i) => c.pick(i)).join(''),
    'different seed → different forest',
  );
  // 权重分布:0.6 的物种在 200 抽里应是多数
  const counts = [0, 0, 0];
  const big = makeAssetCollection(species, { weights: [0.6, 0.25, 0.15], seed: 'census' });
  for (let i = 0; i < 200; i++) counts[big.pick(i)]++;
  ok(
    counts[0] > counts[1] && counts[1] > counts[2] && counts[0] > 90,
    `weights hold over 200 draws (${counts.join('/')})`,
  );
}

// ---- 混林天际线:analytic 安全 + 环位 + 剪影暗度 ------------------------------------
{
  const ring = boulderHorizon([0, 0], 135, 'test-sky');
  ok(ring.length === 14, 'skyline keeps the 14-position ring');
  ok(
    ring.every((s) => s.type === 'rounded_box'),
    'boulders stand as placeholders (analytic-safe)',
  );
  ok(
    ring.every((s) => s.transform.rotate[0] === 0 && s.transform.rotate[2] === 0),
    'yaw-only (analytic tier contract)',
  );
  ok(
    ring.every((s) => s.material.value <= 0.14 + 1e-9),
    'silhouette-dark (black-rock motif keeps the haze)',
  );
  ok(
    // slabs 同款环位数学:r ∈ [0.52, 1.12] × ringRadius
    ring.every((s) => Math.hypot(s.transform.translate[0], s.transform.translate[2]) > 135 * 0.5),
    'ring stays out at horizon radius',
  );
  ok(
    JSON.stringify(boulderHorizon([0, 0], 135, 'test-sky')) === JSON.stringify(ring),
    'same seed → byte-identical skyline',
  );
}

// ---- deck 接线:opt-in,预算语义不变 ------------------------------------------------
{
  const withB = assembleDeck(DECK, { layout: 'radial', horizon: 'boulders' });
  const plain = assembleDeck(DECK, { layout: 'radial' });
  const horizonOf = (s) => s.subjects.filter((x) => x.collection === 'horizon');
  ok(
    horizonOf(withB).every((s) => s.type === 'rounded_box') &&
      horizonOf(plain).every((s) => s.type === 'box'),
    'opts.horizon swaps the skyline family; default untouched',
  );
  ok(
    horizonOf(withB).length === horizonOf(plain).length,
    'same skyline population (leaf budget unchanged)',
  );
  const win = withB.deckWindows.find((w) => w.kind === 'station');
  const kept = sliceDeckWindow(withB, win).subjects.filter((x) => x.collection === 'horizon');
  ok(kept.length <= 7, `nearest-cull budget still applies (${kept.length} kept)`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
