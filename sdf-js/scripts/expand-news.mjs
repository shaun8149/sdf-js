#!/usr/bin/env node
// =============================================================================
// expand-news.mjs — CLI wrapper around src/present/news/expand-core.js
// (Sprint 32: core shared with the browser's author-2d full-deck mode).
//
// Usage:
//   node sdf-js/scripts/expand-news.mjs --text article.txt --out slides.json \
//     [--key-file key.txt] [--min 12] [--max 18]
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
export {
  expandNews,
  splitToFloor,
  mergeToCeiling,
  repairJsonQuotes,
} from '../src/present/news/expand-core.js';
import { expandNews } from '../src/present/news/expand-core.js';

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const args = process.argv.slice(2);
  const arg = (name, fb = null) => {
    const i = args.indexOf(name);
    return i > -1 ? args[i + 1] : fb;
  };
  const textPath = arg('--text');
  const outPath = arg('--out');
  if (!textPath || !outPath) {
    console.error(
      'usage: expand-news.mjs --text article.txt --out slides.json [--key-file key.txt]',
    );
    process.exit(2);
  }
  let apiKey = process.env.ANTHROPIC_API_KEY;
  const keyFile = arg('--key-file');
  if (!apiKey && keyFile && existsSync(keyFile)) {
    const raw = readFileSync(keyFile, 'utf8').trim();
    apiKey = raw.startsWith('ANTHROPIC_API_KEY=') ? raw.slice('ANTHROPIC_API_KEY='.length) : raw;
  }
  const text = readFileSync(textPath, 'utf8');
  const slides = await expandNews(text, {
    apiKey,
    min: Number(arg('--min', 12)),
    max: Number(arg('--max', 18)),
  });
  writeFileSync(outPath, JSON.stringify(slides, null, 2));
  console.log(`expand-news: ${text.length} chars → ${slides.length} slides → ${outPath}`);
}
