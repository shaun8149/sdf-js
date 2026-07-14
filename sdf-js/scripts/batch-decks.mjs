// =============================================================================
// batch-decks.mjs — 批量出 deck 的正式管线 (Sprint 100, 收编临场脚本).
//
// 2026-07-14 黑洞页事故的结构性修复: 此前每批 PDF 都靠 /tmp 下手写脚本
// 复刻导出管线, 抽查脚本与批量脚本还是两份代码 — 抽查过了, 批量全军
// 覆没。本脚本是唯一的批量入口:
//   - playwright 驱动 examples/batch-export.html, 走与 in-app 下载完全
//     相同的 buildDeckPdf 产品代码 (含 page-lint 出厂检, 黑洞页拦截)
//   - 选池全池随机 (user 裁定: 随机搭配才有意思, 不偏爱新件)
//   - 落盘 ~/Downloads/atlas-<name>-batchN/ 单独文件夹 (user 裁定),
//     每份 PDF 旁存同名 .deck.json 溯源契约 (§3.5.1 配对约定)
//
// Usage:
//   node sdf-js/scripts/batch-decks.mjs \
//     --deck sdf-js/examples/scaffold-pipeline/tether-bp \
//     --count 10 [--name tetherbp] [--title "ANTFUN × Tether"] [--mounts id1,id2]
// =============================================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { chromium } from 'playwright-core';
import { serializeDeck } from '../src/present/deck-io.js';
import { validateDeck } from '../src/present/deck-spec.js';
import { mountProvenance } from '../src/present/art-mount.js';

const SDF_ROOT = resolve(new URL('..', import.meta.url).pathname);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const arg = (name, fb = null) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : fb;
};
const DECK_DIR = arg('--deck');
const COUNT = Number(arg('--count', 10));
if (!DECK_DIR || !existsSync(join(DECK_DIR, 'deck.json'))) {
  console.error('usage: batch-decks.mjs --deck <dir with deck.json> --count N [--name slug]');
  process.exit(2);
}
const NAME = arg('--name', basename(resolve(DECK_DIR)).replace(/[^\w-]+/g, ''));
const TITLE = arg('--title', null);

// ── 输出文件夹: ~/Downloads/atlas-<name>-batchN (自动递增, 每批独立) ──
let batchN = 1;
let OUT;
do {
  OUT = join(homedir(), 'Downloads', `atlas-${NAME}-batch${batchN}`);
  batchN++;
} while (existsSync(OUT));
mkdirSync(OUT, { recursive: true });

// ── 选池: 全池随机 (不偏爱新件, 不查 used 清单) ──
const manifest = JSON.parse(
  readFileSync(join(SDF_ROOT, 'examples/original-mints/cache/manifest.json'), 'utf8'),
);
const okPool = manifest.filter((e) => e.status === 'ok');
let picks;
if (arg('--mounts')) {
  const ids = arg('--mounts').split(',');
  picks = ids.map((id) => okPool.find((e) => e.id === id)).filter(Boolean);
} else {
  const pool = [...okPool];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  picks = pool.slice(0, Math.min(COUNT, pool.length));
}
console.log(`批量出 deck: ${NAME} × ${picks.length} → ${OUT}`);
picks.forEach((e) => console.log(`  · ${e.id} — ${e.name} (${e.artist || '?'})`));

// ── 静态服务器 (repo root = sdf-js/, 不依赖 dev-server.py 在跑) ──
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(SDF_ROOT, path);
  if (!file.startsWith(SDF_ROOT) || !existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// deckDir 相对 repo root 的 URL 路径
const deckDirUrl =
  '/' +
  resolve(DECK_DIR)
    .slice(SDF_ROOT.length + 1)
    .replaceAll('\\', '/');

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.error('  [page]', String(e).slice(0, 120)));
await page.goto(`http://127.0.0.1:${PORT}/examples/batch-export.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__harnessReady === true, null, { timeout: 15000 });

// deck 元数据 (契约用) — node 侧读一次
const deckMan = JSON.parse(readFileSync(join(DECK_DIR, 'deck.json'), 'utf8'));
const contractSlots = deckMan.slots
  .filter((s) => s.liftFile)
  .map((s) => {
    const j = JSON.parse(readFileSync(join(DECK_DIR, s.liftFile), 'utf8'));
    return {
      slotIdx: s.slotIdx,
      slotName: s.slotName,
      slotTitle: s.slotTitle,
      sceneData: j.sceneData ?? j,
    };
  });

let done = 0;
let lintFailures = 0;
for (const entry of picks) {
  const label = `atlas-${NAME}-${entry.id}`;
  process.stdout.write(`[${done + 1}/${picks.length}] ${entry.id} ${entry.name} … `);
  const res = await page.evaluate((cfg) => window.__atlasBatchExport(cfg), {
    deckDir: deckDirUrl,
    mountId: entry.id,
    title: TITLE,
  });
  if (!res || !res.ok) {
    if (res?.error === 'page-lint') {
      lintFailures++;
      console.log(`✗ 出厂检不合格 — ${JSON.stringify(res.lint.pages)}`);
    } else {
      console.log(`✗ ${res?.error || 'unknown error'}`);
    }
    continue;
  }
  writeFileSync(join(OUT, `${label}.pdf`), Buffer.from(res.pdfB64, 'base64'));
  const contract = serializeDeck({
    title: TITLE || deckMan.title || 'Atlas Deck',
    theme: deckMan.theme,
    scaffold: deckMan.scaffold || { id: NAME, label: NAME },
    decor: deckMan.decor,
    artMount: mountProvenance(entry),
    slots: contractSlots,
  });
  const v = validateDeck(contract);
  if (!v.ok) {
    console.log(`✗ 契约校验失败: ${v.errors[0]}`);
    continue;
  }
  writeFileSync(join(OUT, `${label}.deck.json`), JSON.stringify(contract, null, 1));
  console.log(`✓ ${res.pageCount} 页`);
  done++;
}

await browser.close();
server.close();
console.log(
  `\n完成 ${done}/${picks.length} → ${OUT}` +
    (lintFailures ? `  (⚠ ${lintFailures} 份被出厂检拦下)` : ''),
);
process.exit(done === picks.length ? 0 : 1);
