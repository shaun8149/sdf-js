// =============================================================================
// test-pdf-text-extractor.mjs — L1 unit tests for Atlas Present Sprint 2
//                                pdf-text-extractor.js
// =============================================================================

import { extractDocumentData } from '../src/present/pdf-text-extractor.js';

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

console.log('=== pdf-text-extractor smoke test ===\n');

// Baseline: empty input
{
  const doc = extractDocumentData([]);
  ok(typeof doc === 'object' && doc !== null, 'empty input returns object');
  ok(doc.flowingText === '', 'empty input: flowingText = ""');
  ok(Array.isArray(doc.pages) && doc.pages.length === 0, 'empty input: pages = []');
  ok(Array.isArray(doc.headings) && doc.headings.length === 0, 'empty input: headings = []');
}

// Single page — flowing text + page boundary
{
  const slides = [
    {
      index: 0,
      sourceFormat: 'pdf',
      title: 'Introduction',
      body: [
        {
          kind: 'paragraph',
          text: 'The agent explores the environment.',
          level: 0,
          bbox: { x: 0, y: 0, w: 0, h: 0 },
          fontSize: 12,
          fontFamily: null,
        },
        {
          kind: 'paragraph',
          text: 'A predictive model may entangle features.',
          level: 0,
          bbox: { x: 0, y: 0, w: 0, h: 0 },
          fontSize: 12,
          fontFamily: null,
        },
      ],
      visuals: [],
      layout: 'title-content',
      theme: {},
      notes: null,
      pageSize: { width: 612, height: 792 },
      screenshot: null,
      classified: null,
    },
  ];
  const doc = extractDocumentData(slides);
  ok(doc.flowingText.includes('Introduction'), 'single page: flowingText includes title');
  ok(
    doc.flowingText.includes('The agent explores the environment.'),
    'single page: includes body[0]',
  );
  ok(
    doc.flowingText.includes('A predictive model may entangle features.'),
    'single page: includes body[1]',
  );

  ok(doc.pages.length === 1, 'single page: pages.length = 1');
  ok(doc.pages[0].pageNumber === 1, 'single page: pageNumber = 1 (1-based)');
  ok(doc.pages[0].startOffset === 0, 'single page: startOffset = 0');
  ok(
    doc.pages[0].endOffset === doc.flowingText.length,
    `single page: endOffset = full text length (got ${doc.pages[0].endOffset}, text len ${doc.flowingText.length})`,
  );
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
