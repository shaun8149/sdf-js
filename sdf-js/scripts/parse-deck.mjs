#!/usr/bin/env node
// =============================================================================
// parse-deck.mjs — CLI: parse a .pdf/.pptx deck → SlideData[] JSON
// -----------------------------------------------------------------------------
// Usage:
//   node parse-deck.mjs <file>                 # print SlideData JSON to stdout
//   node parse-deck.mjs <file> --out path.json # write to file
//   node parse-deck.mjs <file> --summary       # print human summary, no JSON
// =============================================================================

import { parseDeck } from '../src/parser/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.error('Usage: node parse-deck.mjs <file.pdf> [--out slides.json] [--summary]');
  process.exit(args.includes('--help') ? 0 : 1);
}
const filePath = path.resolve(args[0]);
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
const summaryOnly = args.includes('--summary');

try {
  await fs.access(filePath);
} catch {
  console.error(`✗ File not found: ${filePath}`);
  process.exit(2);
}

console.error(`Parsing ${path.basename(filePath)}…`);
const t0 = Date.now();
const slides = await parseDeck(filePath);
const ms = Date.now() - t0;
console.error(`✓ Parsed ${slides.length} slides in ${ms}ms`);

if (summaryOnly || !outPath) {
  console.error('');
  console.error('Slide summary:');
  for (const s of slides) {
    const titlePrev = s.title
      ? `"${s.title.slice(0, 60)}${s.title.length > 60 ? '…' : ''}"`
      : '(no title)';
    const bullets = s.body.filter((b) => b.kind === 'bullet').length;
    const paragraphs = s.body.filter((b) => b.kind === 'paragraph').length;
    console.error(
      `  [${String(s.index).padStart(2)}] ${s.layout.padEnd(15)} ${titlePrev.padEnd(40)} ` +
        `body: ${paragraphs}p+${bullets}b  vis: ${s.visuals.length}`,
    );
  }
}

if (outPath) {
  await fs.writeFile(outPath, JSON.stringify(slides, null, 2));
  console.error(`\n✓ Wrote SlideData[] to ${outPath} (${slides.length} slides)`);
} else if (!summaryOnly) {
  process.stdout.write(JSON.stringify(slides, null, 2));
}
