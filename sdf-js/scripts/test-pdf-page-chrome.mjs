#!/usr/bin/env node
// =============================================================================
// test-pdf-page-chrome.mjs — verify page-chrome filter strips header/footer
// -----------------------------------------------------------------------------
// 2026-06-21 fix: PDFs from blog exports (e.g. aetherlabs.ai) carry article
// title in top margin + URL + page indicator in bottom margin. Without filter
// these merge into body text.
//
// Run: node sdf-js/scripts/test-pdf-page-chrome.mjs
// =============================================================================

import { filterPageChrome } from '../src/parser/pdf.js';

let pass = 0,
  fail = 0;
function assert(c, m) {
  if (c) {
    pass++;
    console.log(`  ✓ ${m}`);
  } else {
    fail++;
    console.log(`  ✗ ${m}`);
  }
}

const PAGE_HEIGHT = 1056; // typical PDF page height in pt

console.log('--- URL footer in bottom margin ---');
{
  const lines = [
    { text: 'Body paragraph one', x: 50, y: 200, w: 100, h: 14, fontSize: 14, fontFamily: 'Arial' },
    { text: 'Body paragraph two', x: 50, y: 220, w: 100, h: 14, fontSize: 14, fontFamily: 'Arial' },
    {
      text: 'https://aetherlabs.ai/articles/causality 2/13',
      x: 50,
      y: 1030,
      w: 200,
      h: 8,
      fontSize: 8,
      fontFamily: 'Arial',
    },
  ];
  const filtered = filterPageChrome(lines, PAGE_HEIGHT);
  assert(filtered.length === 2, `URL footer dropped (3 → ${filtered.length})`);
  assert(!filtered.some((l) => l.text.includes('https')), 'no URL in remaining lines');
}

console.log('\n--- Timestamp header in top margin ---');
{
  const lines = [
    {
      text: '2026/6/18 09:43',
      x: 50,
      y: 30,
      w: 100,
      h: 8,
      fontSize: 8,
      fontFamily: 'Arial',
    },
    {
      text: 'Causality and the Next AI Paradigm — Aether AI',
      x: 250,
      y: 30,
      w: 300,
      h: 8,
      fontSize: 8,
      fontFamily: 'Arial',
    },
    {
      text: 'This is real body content',
      x: 50,
      y: 200,
      w: 200,
      h: 14,
      fontSize: 14,
      fontFamily: 'Arial',
    },
  ];
  const filtered = filterPageChrome(lines, PAGE_HEIGHT);
  // The "Causality..." top header line will NOT be filtered by current regex
  // (not URL / not page number / not date). This is acceptable for v1; user
  // can layer multi-page dedup later if needed.
  assert(!filtered.some((l) => l.text === '2026/6/18 09:43'), 'timestamp top header dropped');
  assert(
    filtered.some((l) => l.text === 'This is real body content'),
    'body content kept',
  );
}

console.log('\n--- Page number alone in bottom margin ---');
{
  const lines = [
    { text: '13', x: 480, y: 1020, w: 14, h: 8, fontSize: 8, fontFamily: 'Arial' },
    { text: 'Body line', x: 50, y: 400, w: 100, h: 14, fontSize: 14, fontFamily: 'Arial' },
    { text: '13 / 42', x: 480, y: 1040, w: 28, h: 8, fontSize: 8, fontFamily: 'Arial' },
    { text: 'Page 7', x: 50, y: 1030, w: 40, h: 8, fontSize: 8, fontFamily: 'Arial' },
  ];
  const filtered = filterPageChrome(lines, PAGE_HEIGHT);
  // "13" alone is currently NOT filtered (no regex matches a bare digit string).
  // Filtered: "13 / 42" (page indicator), "Page 7" (page word).
  // Kept: "Body line" + bare "13".
  assert(
    filtered.some((l) => l.text === 'Body line'),
    'body line kept',
  );
  assert(!filtered.some((l) => l.text === '13 / 42'), 'page indicator dropped');
  assert(!filtered.some((l) => l.text === 'Page 7'), 'Page N pattern dropped');
}

console.log('\n--- URL in body (citation) — must NOT be filtered ---');
{
  const lines = [
    {
      text: 'See reference at https://example.com/paper for details',
      x: 50,
      y: 500,
      w: 400,
      h: 14,
      fontSize: 14,
      fontFamily: 'Arial',
    },
  ];
  const filtered = filterPageChrome(lines, PAGE_HEIGHT);
  assert(filtered.length === 1, 'body-zone URL kept (not chrome)');
}

console.log('\n--- Edge case: empty input ---');
{
  const filtered = filterPageChrome([], PAGE_HEIGHT);
  assert(filtered.length === 0, 'empty input → empty output');
}

console.log('\n--- Edge case: all chrome ---');
{
  const lines = [
    { text: 'https://example.com 1/5', x: 50, y: 1020, w: 200, h: 8, fontSize: 8, fontFamily: 'A' },
    { text: '2026/6/18 09:43', x: 50, y: 30, w: 100, h: 8, fontSize: 8, fontFamily: 'A' },
  ];
  const filtered = filterPageChrome(lines, PAGE_HEIGHT);
  assert(filtered.length === 0, 'all-chrome → all dropped');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
