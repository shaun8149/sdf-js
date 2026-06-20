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

// More tests added in Tasks 2.2-2.4

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
