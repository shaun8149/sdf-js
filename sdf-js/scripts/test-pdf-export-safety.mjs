// test-pdf-export-safety.mjs — PDF export must fail loud on bad rendered pages.
import { recordPdfRenderFailure, shouldRunPdfLint } from '../src/present/exporters/pdf.js';

let passed = 0;
let failed = 0;
function ok(cond, msg, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}${extra ? ` — ${extra}` : ''}`);
  }
}

ok(shouldRunPdfLint({}) === true, 'PDF page-lint defaults on');
ok(shouldRunPdfLint({ lint: true }) === true, 'explicit lint:true keeps lint on');
ok(shouldRunPdfLint({ lint: false }) === false, 'explicit lint:false is the only bypass');

{
  const pages = [];
  recordPdfRenderFailure(pages, { slotName: 'slot-a' }, new Error('boom'));
  ok(pages.length === 1, 'render failure adds a lint page');
  ok(pages[0].slotName === 'slot-a', 'render failure preserves slot name');
  ok(
    pages[0].issues.some((i) => i.startsWith('render-failed')),
    'render failure becomes a page-lint issue',
    JSON.stringify(pages),
  );
}

{
  const pages = [];
  recordPdfRenderFailure(pages, { slotIdx: 7 }, null);
  ok(pages[0].slotName === 'slot-7', 'render failure falls back to slot index');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
