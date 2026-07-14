// sdf-js/scripts/test-nature-dressing.mjs — nature 装饰语汇(Infinigen 八课的
// deck 消费端)契约测试。不变量:OPT-IN(默认 stelae 逐字节不动)、analytic
// 契约(类型/子项平移/yaw-only)、leaf 预算按棵记账(树=3)、decor 纪律
// (亮度帽/降饱和)、背风树(hero 视线不被冠层挡)、路由(collection)不变、
// 确定性。
import {
  makeDeckDecor,
  STATION_DECOR_MAX,
  SEGMENT_DECOR_MAX,
  DECOR_VALUE_CAP,
} from '../src/scene/deck-decor.js';
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { validate } from '../src/scene/spec.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== nature dressing (Infinigen chain → deck Layer C) ===\n');

const ANALYTIC = new Set(['box', 'rounded_box', 'sphere', 'capsule', 'ellipsoid', 'cylinder']);
const leafCount = (s) => (s.type === 'union' ? s.children.length : 1);
const leavesOf = (arr) => arr.reduce((a, s) => a + leafCount(s), 0);

// ---- OPT-IN:默认路径逐字节不动 ------------------------------------------------------
{
  const plain = makeDeckDecor('hash-A');
  const explicit = makeDeckDecor('hash-A', { style: 'stelae' });
  ok(
    JSON.stringify(plain.station(3, [10, 0, 5])) ===
      JSON.stringify(explicit.station(3, [10, 0, 5])),
    'default stelae unchanged (byte-identical with/without style opt)',
  );
}

// ---- nature station:analytic 契约 + leaf 预算 + 纪律 + 背风树 ------------------------
{
  const d = makeDeckDecor('hash-A', { style: 'nature' });
  const st = d.station(3, [12, 0, -4]);
  ok(st.length > 0, `nature station emits (${st.length} subjects)`);
  const flat = st.flatMap((s) => (s.type === 'union' ? s.children : [s]));
  ok(
    flat.every((s) => ANALYTIC.has(s.type)),
    'every leaf stays inside the analytic SUPPORTED set',
  );
  ok(
    st.every((s) => {
      const r = s.transform.rotate || [0, 0, 0];
      return r[0] === 0 && r[2] === 0;
    }) && st.every((s) => s.type !== 'union' || s.children.every((c) => !c.transform.rotate)),
    'yaw-only outers, translate-only union children (analytic contract)',
  );
  ok(
    leavesOf(st) <= STATION_DECOR_MAX,
    `leaf budget: ${leavesOf(st)} ≤ ${STATION_DECOR_MAX} (a tree costs 3)`,
  );
  ok(
    flat.every((s) => (s.material?.value ?? 0) <= DECOR_VALUE_CAP + 1e-9),
    'brightness cap holds (decor never outshines data)',
  );
  const trees = st.filter((s) => s.id.includes('-tree-'));
  ok(
    trees.every((t) => {
      const th = Math.atan2(t.transform.translate[0] - 12, t.transform.translate[2] - -4);
      return Math.abs(th) > Math.PI * 0.5 - 1e-9;
    }),
    `trees stay leeward of the hero camera (${trees.length} trees)`,
  );
  ok(
    JSON.stringify(st) ===
      JSON.stringify(makeDeckDecor('hash-A', { style: 'nature' }).station(3, [12, 0, -4])),
    'same seed → same grove (mint-hash covenant)',
  );
}

// ---- nature segment:小石阵在侧翼,预算内 --------------------------------------------
{
  const d = makeDeckDecor('hash-A', { style: 'nature' });
  const seg = d.segment(2, [0, 0, 0], [16, 0, 4]);
  ok(
    seg.length > 0 && leavesOf(seg) <= SEGMENT_DECOR_MAX / 2,
    `segment rocks within half-window budget (${leavesOf(seg)})`,
  );
  ok(
    seg.every((s) => s.id.startsWith('path-2-decor-')),
    'segment ids keep the decor naming convention',
  );
}

// ---- deck 级:路由不变 + validate + 默认 deck 逐字节不动 -----------------------------
{
  const nature = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A', dressing: 'nature' });
  const v = validate(nature);
  ok(v.ok, `nature-dressed deck validates (${v.errors[0] || 'no errors'})`);
  const win = nature.deckWindows.find((w) => w.kind === 'station' && w.stations[0] === 3);
  const sliced = sliceDeckWindow(nature, win);
  const decorIn = sliced.subjects.filter((x) => /-decor-/.test(x.id));
  ok(
    decorIn.every((x) => x.collection === 'station-3-decor' || x.collection === 'path-3-decor'),
    'window routing unchanged (collections carry the nature decor)',
  );
  const plainA = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A' });
  const plainB = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A', dressing: undefined });
  ok(
    JSON.stringify(plainA) === JSON.stringify(plainB),
    'default deck byte-identical (goldens safe)',
  );
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
