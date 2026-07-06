#!/usr/bin/env node
// =============================================================================
// news-to-deck.mjs — Sprint 30: raw news article → 10-20 page baked deck
// -----------------------------------------------------------------------------
// The one-command front door the user asked for: "任意的500字新闻 → 稳定的
// 10-20 页 PPT". Chains:
//
//   expand-news (LLM, 12-18 slide outline, deterministic floor/ceiling)
//     → bake-scaffold-pipeline --scaffold news-briefing --min-pages 10
//     → eval-deck-quality (score + fidelity)
//
// and asserts the delivered page count lands in [10, 20], exiting non-zero
// when it doesn't — so the stability harness can bake N runs and count.
//
// Usage:
//   node sdf-js/scripts/news-to-deck.mjs --text article.txt --deck-name my-news \
//     [--key-file key.txt] [--min-pages 10] [--max-pages 20]
// =============================================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { expandNews } from './expand-news.mjs';

const REPO = new URL('../..', import.meta.url).pathname;
const args = process.argv.slice(2);
const arg = (name, fb = null) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : fb;
};

const TEXT_PATH = arg('--text');
const DECK_NAME = arg('--deck-name');
const KEY_FILE = arg('--key-file', null);
const MIN_PAGES = Number(arg('--min-pages', 10));
const MAX_PAGES = Number(arg('--max-pages', 20));
if (!TEXT_PATH || !DECK_NAME) {
  console.error('usage: news-to-deck.mjs --text article.txt --deck-name NAME [--key-file key.txt]');
  process.exit(2);
}

let apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey && KEY_FILE && existsSync(KEY_FILE)) {
  const raw = readFileSync(KEY_FILE, 'utf8').trim();
  apiKey = raw.startsWith('ANTHROPIC_API_KEY=') ? raw.slice('ANTHROPIC_API_KEY='.length) : raw;
}
if (!apiKey) {
  console.error('ERROR: set ANTHROPIC_API_KEY or pass --key-file PATH');
  process.exit(2);
}

const text = readFileSync(TEXT_PATH, 'utf8');
console.log(`\n══ news-to-deck: ${DECK_NAME} ══\nInput: ${TEXT_PATH} (${text.length} chars)\n`);

// ── Stage -1: expand ──
console.log('── Stage -1: expand news → slide outline ──');
// Outline floor = page floor + slack: the mapper may still fold 2-3 slides
// into shared slots; expansion overshoot is what the page floor redistributes.
const slides = await expandNews(text, { apiKey, min: Math.max(12, MIN_PAGES + 2), max: MAX_PAGES });
console.log(
  `  ${slides.length} slides: ${slides
    .map((s) => s.title)
    .join(' | ')
    .slice(0, 160)}…`,
);

const slidedataPath = `${REPO}sdf-js/examples/scaffold-pipeline/${DECK_NAME}-slidedata.json`;
mkdirSync(`${REPO}sdf-js/examples/scaffold-pipeline`, { recursive: true });
writeFileSync(slidedataPath, JSON.stringify(slides, null, 2));

// ── Stages 0-2: bake (news-briefing pinned, page floor on) ──
const bakeArgs = [
  `${REPO}sdf-js/scripts/bake-scaffold-pipeline.mjs`,
  '--slidedata',
  slidedataPath,
  '--deck-name',
  DECK_NAME,
  '--scaffold',
  'news-briefing',
  '--mapper',
  'llm',
  '--min-pages',
  String(MIN_PAGES),
  '--force',
];
if (KEY_FILE) bakeArgs.push('--key-file', KEY_FILE);
const bake = spawnSync('node', bakeArgs, { stdio: 'inherit', env: process.env });
if (bake.status !== 0) process.exit(bake.status || 1);

// ── page-count assertion + eval ──
const deckDir = `${REPO}sdf-js/examples/scaffold-pipeline/${DECK_NAME}`;
const manifest = JSON.parse(readFileSync(`${deckDir}/deck.json`, 'utf8'));
const pages = manifest.slots.filter((s) => !s.error).length;

const ev = spawnSync('node', [`${REPO}sdf-js/scripts/eval-deck-quality.mjs`, deckDir], {
  stdio: 'inherit',
  env: process.env,
});
if (ev.status !== 0) process.exit(ev.status || 1);

const inBand = pages >= MIN_PAGES && pages <= MAX_PAGES;
console.log(
  `\n══ news-to-deck result ══\n  pages: ${pages}  (target ${MIN_PAGES}-${MAX_PAGES})  ${inBand ? '✓ IN BAND' : '✗ OUT OF BAND'}\n`,
);
process.exit(inBand ? 0 : 1);
