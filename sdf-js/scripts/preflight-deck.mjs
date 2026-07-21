#!/usr/bin/env node
// =============================================================================
// preflight-deck.mjs — concierge intake triage, run the moment a PDF arrives.
// Answers ONE question same-day: "runs tonight" or "please re-export".
//
// The pipeline throws on encrypted PDFs and returns empty text on scanned
// (image-only) decks — no OCR by design. This 30-second check turns a
// morning apology email into a same-day honest reply.
//
// Usage: node sdf-js/scripts/preflight-deck.mjs --pdf <path>
// Exit 0 = runnable, 1 = needs re-export / unsupported.
// =============================================================================
import { resolve } from 'node:path';

const arg = (f, d = null) => {
  const i = process.argv.indexOf(f);
  return i > 0 ? process.argv[i + 1] : d;
};
const PDF = arg('--pdf');
if (!PDF) {
  console.error('✗ required: --pdf <path>');
  process.exit(1);
}

let slides;
try {
  const { parseDeck } = await import('../src/parser/index.js');
  slides = await parseDeck(resolve(process.cwd(), PDF));
} catch (e) {
  const msg = String(e && (e.message || e));
  if (/password|encrypt/i.test(msg)) {
    console.log('VERDICT: ENCRYPTED — ask for an unlocked export');
  } else {
    console.log(`VERDICT: PARSE FAILED — ${msg.slice(0, 140)}`);
  }
  process.exit(1);
}

const total = slides.length;
const withText = slides.filter(
  (s) => (s.body || []).some((b) => (b.text || '').trim().length > 2) || (s.title || '').trim(),
).length;
const coverage = total ? withText / total : 0;
console.log(
  `pages: ${total} | pages with a text layer: ${withText} (${Math.round(coverage * 100)}%)`,
);

if (total === 0) {
  console.log('VERDICT: EMPTY — no pages parsed');
  process.exit(1);
}
if (coverage < 0.5) {
  console.log(
    'VERDICT: SCANNED/IMAGE-ONLY — text layer missing on most pages (no OCR); ask for a re-export from the source file',
  );
  process.exit(1);
}
if (coverage < 0.9)
  console.log('note: some pages are image-only — they will ride as picture stations');
console.log('VERDICT: RUNS TONIGHT — gen-deck-ir with --vision, name it concierge-<slug>');
