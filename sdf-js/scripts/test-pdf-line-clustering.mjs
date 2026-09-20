#!/usr/bin/env node
// =============================================================================
// test-pdf-line-clustering.mjs — verify CJK vertical-character bug is fixed
// -----------------------------------------------------------------------------
// 2026-06-21 fix: PDF.js gives each text run as its own item. For Chinese
// PDFs that's typically 1 character per item. Without clustering,
// pdf-text-extractor renders 1 div per character = vertical character stack.
// clusterItemsIntoLines groups items by y-band into visual lines.
//
// Run: node sdf-js/scripts/test-pdf-line-clustering.mjs
// =============================================================================

import { clusterItemsIntoLines } from '../src/parser/pdf.js';

let pass = 0,
  fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ ${msg}`);
  }
}

console.log('--- CJK characters on same line (the bug case) ---');
{
  // Simulate Chinese text "高瓴创投" — PDF.js returns each char as separate item
  // at same y, sequential x positions, char width ≈ fontSize × 1.0
  const items = [
    { text: '高', x: 0, y: 100, w: 14, h: 14, fontSize: 14, fontFamily: 'SimSun' },
    { text: '瓴', x: 14, y: 100, w: 14, h: 14, fontSize: 14, fontFamily: 'SimSun' },
    { text: '创', x: 28, y: 100, w: 14, h: 14, fontSize: 14, fontFamily: 'SimSun' },
    { text: '投', x: 42, y: 100, w: 14, h: 14, fontSize: 14, fontFamily: 'SimSun' },
  ];
  const lines = clusterItemsIntoLines(items);
  assert(lines.length === 1, `4 same-y CJK chars → 1 line (got ${lines.length})`);
  assert(lines[0].text === '高瓴创投', `text concat without spaces: "${lines[0].text}"`);
  assert(lines[0].x === 0 && lines[0].y === 100, 'merged bbox starts at first item');
  assert(lines[0].w === 56, `merged width = 56 (got ${lines[0].w})`);
}

console.log('\n--- English words on same line (must preserve spaces) ---');
{
  // English: "Hello World" — PDF.js returns 2 items at same y with a visible
  // gap. Our clustering must preserve the space.
  const items = [
    { text: 'Hello', x: 0, y: 100, w: 40, h: 12, fontSize: 12, fontFamily: 'Arial' },
    { text: 'World', x: 50, y: 100, w: 40, h: 12, fontSize: 12, fontFamily: 'Arial' },
  ];
  const lines = clusterItemsIntoLines(items);
  assert(lines.length === 1, '2 English words same y → 1 line');
  assert(lines[0].text === 'Hello World', `space preserved: "${lines[0].text}"`);
}

console.log('\n--- Two columns at the same y stay separate ---');
{
  // Presentation PDFs often place comparison columns at identical y positions.
  // They must not be concatenated into one sentence before LLM extraction.
  const items = [
    {
      text: 'Left Column Title',
      x: 50,
      y: 100,
      w: 150,
      h: 14,
      fontSize: 14,
      fontFamily: 'Arial',
    },
    {
      text: 'Right Column Title',
      x: 350,
      y: 100,
      w: 150,
      h: 14,
      fontSize: 14,
      fontFamily: 'Arial',
    },
  ];
  const lines = clusterItemsIntoLines(items);
  assert(lines.length === 2, `same-y two-column text → 2 lines (got ${lines.length})`);
  assert(lines[0].text === 'Left Column Title', `left column preserved: "${lines[0]?.text}"`);
  assert(lines[1].text === 'Right Column Title', `right column preserved: "${lines[1]?.text}"`);
}

console.log('\n--- Two lines (different y) ---');
{
  const items = [
    { text: '第一行', x: 0, y: 100, w: 42, h: 14, fontSize: 14, fontFamily: 'SimSun' },
    { text: '第二行', x: 0, y: 130, w: 42, h: 14, fontSize: 14, fontFamily: 'SimSun' },
  ];
  const lines = clusterItemsIntoLines(items);
  assert(lines.length === 2, `2 different-y lines (got ${lines.length})`);
  assert(lines[0].text === '第一行', 'first line text');
  assert(lines[1].text === '第二行', 'second line text');
}

console.log('\n--- Mixed CJK + English on same line ---');
{
  // "2026年6月17日"
  const items = [
    { text: '2026', x: 0, y: 100, w: 28, h: 14, fontSize: 14, fontFamily: 'Arial' },
    { text: '年', x: 28, y: 100, w: 14, h: 14, fontSize: 14, fontFamily: 'SimSun' },
    { text: '6', x: 42, y: 100, w: 7, h: 14, fontSize: 14, fontFamily: 'Arial' },
    { text: '月', x: 49, y: 100, w: 14, h: 14, fontSize: 14, fontFamily: 'SimSun' },
    { text: '17', x: 63, y: 100, w: 14, h: 14, fontSize: 14, fontFamily: 'Arial' },
    { text: '日', x: 77, y: 100, w: 14, h: 14, fontSize: 14, fontFamily: 'SimSun' },
  ];
  const lines = clusterItemsIntoLines(items);
  assert(lines.length === 1, `mixed CJK+EN same y → 1 line (got ${lines.length})`);
  assert(lines[0].text === '2026年6月17日', `concat without spaces: "${lines[0].text}"`);
}

console.log('\n--- Slight y jitter still treated as same line ---');
{
  // Real PDFs often have sub-pixel y differences within the same line
  // due to font metrics. Tolerance is 0.5 × fontSize.
  const items = [
    { text: 'A', x: 0, y: 100, w: 7, h: 14, fontSize: 14, fontFamily: 'Arial' },
    { text: 'B', x: 7, y: 100.5, w: 7, h: 14, fontSize: 14, fontFamily: 'Arial' },
    { text: 'C', x: 14, y: 101, w: 7, h: 14, fontSize: 14, fontFamily: 'Arial' },
  ];
  const lines = clusterItemsIntoLines(items);
  assert(lines.length === 1, 'sub-pixel y jitter → same line');
  assert(lines[0].text === 'ABC', `text: "${lines[0].text}"`);
}

console.log('\n--- Empty input ---');
{
  const lines = clusterItemsIntoLines([]);
  assert(lines.length === 0, 'empty → empty');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
