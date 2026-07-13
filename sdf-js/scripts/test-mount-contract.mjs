// test-mount-contract.mjs — Sprint 97: 批量产品化回归测试.
// 钉住: deck.json 契约 artMount 溯源 (validator + 序列化双向) / 转场页
// 走 artMountOpts 中枢 (导出与临场脚本同律)。
import { validateDeck, DECK_FORMAT, DECK_FORMAT_VERSION } from '../src/present/deck-spec.js';
import { serializeDeck, deserializeDeck } from '../src/present/deck-io.js';
import { mountProvenance, artMountOpts, insertTransitions } from '../src/present/art-mount.js';

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

const baseDeck = () => ({
  format: DECK_FORMAT,
  version: DECK_FORMAT_VERSION,
  title: 'T',
  theme: { id: 'x', bg: [246, 244, 238], accent: [200, 80, 40] },
  slots: [{ slotIdx: 0, slotName: 'cover', sceneData: { subjects: [] } }],
});

// ── 1. validator: artMount 溯源 ──
{
  const good = {
    ...baseDeck(),
    artMount: {
      id: '0xa7d8d9-41',
      name: 'Fidenza',
      artist: 'Tyler Hobbs',
      license: 'nc',
      hash: '0xabc',
      palette: { accent: [10, 120, 200], colors: [[10, 120, 200]] },
    },
  };
  ok(validateDeck(good).ok, '完整溯源块通过校验');
  ok(validateDeck(baseDeck()).ok, '无 artMount 仍通过 (可选字段)');
  ok(!validateDeck({ ...baseDeck(), artMount: 'Fidenza' }).ok, '字符串 artMount 被拒');
  ok(!validateDeck({ ...baseDeck(), artMount: {} }).ok, '缺 id 被拒');
  ok(
    !validateDeck({ ...baseDeck(), artMount: { id: 'x', palette: { accent: [999, 0, 0] } } }).ok,
    '越界 palette.accent 被拒',
  );
}

// ── 2. deck-io 双向 ──
{
  const deck = {
    title: 'T',
    theme: { id: 'x' },
    scaffold: { id: 's' },
    decor: undefined,
    artMount: { id: '0xtest-1', name: 'P', artist: 'A', license: 'nc' },
    slots: [{ slotIdx: 0, slotName: 'cover', sceneData: { subjects: [] } }],
  };
  const json = serializeDeck(deck);
  ok(json.artMount?.id === '0xtest-1', 'serializeDeck 带出溯源');
  ok(json.format === DECK_FORMAT && validateDeck(json).ok, '序列化产物过校验');
  const back = deserializeDeck(JSON.stringify(json));
  ok(back.artMount?.id === '0xtest-1' && back.artMount.name === 'P', 'deserializeDeck 复原溯源');
  const bare = deserializeDeck(JSON.stringify(serializeDeck({ ...deck, artMount: undefined })));
  ok(bare.artMount === undefined, '无溯源 deck round-trip 不长出字段');
}

// ── 3. mountProvenance ──
{
  const entry = {
    id: 'L38',
    name: 'Ringers',
    artist: 'Dmitri Cherniak',
    license: 'nd',
    hash: '0xdead',
    palette: { accent: [1, 2, 3] },
    files: { large: 'x.png' },
    status: 'ok',
  };
  const p = mountProvenance(entry);
  ok(p.id === 'L38' && p.artist === 'Dmitri Cherniak' && p.hash === '0xdead', '取最小溯源字段');
  ok(!('files' in p) && !('status' in p), '图像/状态等资产字段不进契约');
  ok(mountProvenance(null) === undefined, 'null entry → undefined');
}

// ── 4. 转场页走 artMountOpts 中枢 ──
{
  const mount = {
    id: 'x',
    name: 'X',
    cover: { width: 10, height: 10 },
    strip: [],
    variants: [
      { width: 1, height: 1 },
      { width: 2, height: 2 },
    ],
  };
  const slots = [
    { slotIdx: 0, slotName: 'cover', sceneData: { subjects: [] } },
    {
      slotIdx: 1,
      slotName: 'agenda',
      sceneData: {
        subjects: [{ type: 'agenda-list', args: { items: [{ label: '节A' }, { label: '节B' }] } }],
      },
    },
    { slotIdx: 3, slotName: 'theme-1-lead', sceneData: { subjects: [] } },
    { slotIdx: 5, slotName: 'theme-2-lead', sceneData: { subjects: [] } },
  ];
  const out = insertTransitions(slots, mount);
  const trans = out.filter((s) => s._transition);
  ok(trans.length === 2, '转场页按节边界合成');
  const o0 = artMountOpts(mount, trans[0], 'content');
  ok(o0.decorRole === 'cover', '转场 slot 经 artMountOpts → 封面角色');
  ok(o0.decorArt === mount.variants[0], '转场 art = 对应变体');
  ok(o0.decorUnder === undefined && o0.decorArtStrip === undefined, '转场页无 underlay 无胶片条');
  const o1 = artMountOpts(mount, trans[1], 'content');
  ok(o1.decorArt === mount.variants[1], '第二转场轮换第二变体');
  const normal = artMountOpts(mount, slots[2], 'content');
  ok(normal.decorRole === 'section' && normal.decorUnder === true, '普通内页规则不受影响');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
