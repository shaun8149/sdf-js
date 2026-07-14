// sdf-js/scripts/test-mount-palette.mjs — §9.6 配合点 #1 的契约测试。
// 不变量:palette 优先级(URL 显式覆盖 > artMount 预烘焙 > 默认;?palette=0
// 显式关)、装裱色过 ensureContrast 暗场地板、溯源 attribution 提取、
// atlasDeckToIR 透传 artMount、palette 喂 assembleDeck 后 accent 真的换族。
import { resolveDeckPalette } from '../src/scene/mount-palette.js';
import { atlasDeckToIR } from '../src/scene/scaffold-to-ir.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { rgbToHsv } from '../src/scene/assemble-deck.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== mount palette (§9.6 配合点 #1) ===\n');

const THEME = {
  accent: [241, 70, 22],
  colors: [
    [241, 70, 22],
    [43, 154, 233],
  ],
};
const themeOf = () => THEME;
const MOUNT = {
  id: '0xa7d8d9-41',
  name: 'Fidenza',
  artist: 'Tyler Hobbs',
  license: 'nc',
  palette: {
    accent: [10, 120, 200],
    colors: [
      [10, 120, 200],
      [200, 60, 40],
      [20, 22, 26],
    ],
  },
};

// ---- 优先级 -----------------------------------------------------------------------
{
  const off = resolveDeckPalette({ artMount: MOUNT, paletteParam: '0', themeOf });
  ok(off.palette === null && off.source === 'off', '?palette=0 → explicit off beats the mount');
  const url = resolveDeckPalette({ artMount: MOUNT, paletteParam: 'pitch-spectrum', themeOf });
  ok(
    url.source === 'url' && url.palette.anchor === THEME.accent,
    '?palette=<id> → explicit theme beats the mount',
  );
  const mounted = resolveDeckPalette({ artMount: MOUNT, paletteParam: null, themeOf });
  ok(mounted.source === 'artMount', 'no URL param → the mount palette wins');
  const plain = resolveDeckPalette({ artMount: null, paletteParam: null, themeOf });
  ok(
    plain.source === 'default' && plain.palette.anchor === THEME.accent,
    'no mount, no param → default theme',
  );
  const broken = resolveDeckPalette({
    artMount: { ...MOUNT, palette: { accent: [1, 2], colors: [] } },
    paletteParam: null,
    themeOf,
  });
  ok(broken.source === 'default', 'malformed mount palette falls back to default (no crash)');
}

// ---- ensureContrast 暗场地板 + 溯源 -------------------------------------------------
{
  const r = resolveDeckPalette({ artMount: MOUNT, paletteParam: null, themeOf });
  // 装裱色里的近黑 [20,22,26] 对暗场 [30,32,36] 无对比 → 地板必须提亮它
  const dark = r.palette.colors[2];
  ok(
    dark[0] + dark[1] + dark[2] > 20 + 22 + 26 + 30,
    `contrast floor lifts near-bg colors (${dark.map((v) => v | 0).join(',')})`,
  );
  ok(
    r.attribution.name === 'Fidenza' &&
      r.attribution.artist === 'Tyler Hobbs' &&
      r.attribution.license === 'nc',
    'attribution extracted for the overlay badge',
  );
  const anon = resolveDeckPalette({
    artMount: { id: 'x', palette: MOUNT.palette },
    paletteParam: null,
    themeOf,
  });
  ok(anon.attribution === null, 'no name/artist → no badge (never render an empty credit)');
}

// ---- atlasDeckToIR 透传 + 端到端换装 -------------------------------------------------
{
  // 契约 fixtures 里找一份 valid deck,给它穿上装裱走 handoff
  const H = resolve(__dirname, '../examples/deck-handoff/valid');
  const file = readdirSync(H).find((f) => f.endsWith('.json'));
  const raw = JSON.parse(readFileSync(`${H}/${file}`, 'utf8'));
  const irDeck = atlasDeckToIR({ ...raw, artMount: MOUNT });
  ok(
    irDeck.artMount && irDeck.artMount.id === MOUNT.id,
    `atlasDeckToIR carries artMount through (${file})`,
  );
  // 换装断言用合成 content deck(accent 程序只染 content 站,fixture 可能全 hold)
  const mag = (t) => ({
    structure: 'magnitude',
    title: t,
    nodes: ['A', 'B', 'C'],
    magnitude: [3, 2, 1],
  });
  const synth = { title: 'revoice', slides: [mag('one'), mag('two')], artMount: MOUNT };
  const { palette } = resolveDeckPalette({ artMount: synth.artMount, paletteParam: null, themeOf });
  const dressed = assembleDeck(synth, { layout: 'radial', palette });
  const plain = assembleDeck(synth, { layout: 'radial' });
  ok(
    JSON.stringify(dressed.materials) !== JSON.stringify(plain.materials),
    'mounted palette actually re-voices the deck materials',
  );
  const anchorHsv = rgbToHsv(MOUNT.palette.accent);
  ok(Number.isFinite(anchorHsv.h), 'mount accent survives the rgb→hsv accent program');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
