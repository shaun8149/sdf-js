// =============================================================================
// test-pdf-parser.mjs — smoke test for M0.3 PDF parser
// -----------------------------------------------------------------------------
// Structural validation (file-agnostic): generates a minimal synthetic PDF
// via pdfjs's reverse path? No — pdfjs is read-only. Instead use a tiny
// fixture-free approach:
//
//   1. Test SlideData factory + validator (no real PDF needed)
//   2. Test heuristic layout classifier (synthetic SlideData)
//   3. If sdf-js/fixtures/test-deck.pdf exists, parse it end-to-end
//
// User saves their PresentationLoad PDF to fixtures/ → end-to-end coverage.
// Without fixture, only API contract tested. Both states are valid CI.
//
// Run:  node sdf-js/scripts/test-pdf-parser.mjs
// =============================================================================

import {
  parseDeck,
  parsePDF,
  emptySlideData,
  validateSlideData,
  classifyLayout,
} from '../src/parser/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

console.log('=== PDF parser smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: emptySlideData factory
// -----------------------------------------------------------------------------
console.log('Test group 1: emptySlideData factory');
const empty = emptySlideData(3, 'pdf');
ok(empty.index === 3, 'index passed through');
ok(empty.sourceFormat === 'pdf', 'sourceFormat passed through');
ok(empty.title === null, 'title null');
ok(Array.isArray(empty.body) && empty.body.length === 0, 'body empty array');
ok(empty.theme.primaryColor === '#000000', 'theme.primaryColor default');
ok(validateSlideData(empty).length === 0, 'empty SlideData passes validation');

// -----------------------------------------------------------------------------
// Test group 2: validateSlideData catches bad data
// -----------------------------------------------------------------------------
console.log('\nTest group 2: validateSlideData catches bad data');
ok(validateSlideData({ ...empty, index: 'not a number' }).length > 0, 'rejects non-number index');
ok(validateSlideData({ ...empty, sourceFormat: 'xls' }).length > 0, 'rejects bad sourceFormat');
ok(validateSlideData({ ...empty, body: 'not array' }).length > 0, 'rejects non-array body');
ok(validateSlideData({ ...empty, theme: null }).length > 0, 'rejects null theme');

// -----------------------------------------------------------------------------
// Test group 3: classifyLayout heuristic
// -----------------------------------------------------------------------------
console.log('\nTest group 3: classifyLayout heuristic');
const pageSize = { width: 1280, height: 720 };
const mkText = (x, y, kind = 'paragraph') => ({
  kind,
  text: 'hello',
  level: 0,
  bbox: { x, y, w: 100, h: 20 },
  fontSize: 14,
  fontFamily: null,
});

ok(
  classifyLayout({ title: null, body: [], visuals: [], pageSize }) === 'title-only',
  'empty page → title-only',
);
ok(
  classifyLayout({
    title: 'X',
    body: [
      mkText(100, 100, 'bullet'),
      mkText(100, 130, 'bullet'),
      mkText(100, 160, 'bullet'),
      mkText(100, 190, 'bullet'),
      mkText(100, 220, 'bullet'),
      mkText(100, 250, 'bullet'),
    ],
    visuals: [],
    pageSize,
  }) === 'list-heavy',
  '6 bullets → list-heavy',
);
ok(
  classifyLayout({
    title: 'X',
    body: [mkText(100, 100), mkText(100, 200), mkText(800, 100), mkText(800, 200)],
    visuals: [],
    pageSize,
  }) === 'two-column',
  '2 left + 2 right → two-column',
);

// -----------------------------------------------------------------------------
// Test group 4: parseDeck unsupported format
// -----------------------------------------------------------------------------
console.log('\nTest group 4: parseDeck error handling');
try {
  await parseDeck('/tmp/nonexistent.xlsx');
  ok(false, 'should reject .xlsx');
} catch (e) {
  ok(/Unsupported/.test(e.message), `rejects .xlsx with helpful error: ${e.message}`);
}

try {
  await parseDeck('/tmp/file.pptx');
  ok(false, 'should reject .pptx (not yet implemented)');
} catch (e) {
  ok(/not yet implemented/.test(e.message), 'rejects .pptx with "not yet implemented"');
}

// -----------------------------------------------------------------------------
// Test group 5: End-to-end on fixture (if exists)
// -----------------------------------------------------------------------------
console.log('\nTest group 5: End-to-end fixture parsing');
const fixturePath = path.resolve('sdf-js/fixtures/test-deck.pdf');
let fixtureExists = false;
try {
  await fs.access(fixturePath);
  fixtureExists = true;
} catch {
  // fixture not present — skip
}

if (!fixtureExists) {
  console.log(`  ⊘ Skipped (no fixture at ${fixturePath})`);
  console.log(`    To enable: save a .pdf deck to sdf-js/fixtures/test-deck.pdf`);
} else {
  const t0 = Date.now();
  const slides = await parsePDF(fixturePath);
  const ms = Date.now() - t0;
  ok(slides.length > 0, `parsed ${slides.length} slides in ${ms}ms`);
  ok(
    slides.every((s) => validateSlideData(s).length === 0),
    'all slides pass validateSlideData',
  );
  ok(
    slides.every((s) => s.sourceFormat === 'pdf'),
    'all slides have sourceFormat=pdf',
  );
  ok(
    slides.every((s) => s.pageSize.width > 0 && s.pageSize.height > 0),
    'all slides have valid pageSize',
  );
  const withTitle = slides.filter((s) => s.title !== null).length;
  ok(withTitle / slides.length >= 0.5, `≥50% slides have title (${withTitle}/${slides.length})`);
  console.log(`    First slide: title="${slides[0].title}", body=${slides[0].body.length}`);
}

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
