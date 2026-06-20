// =============================================================================
// test-floating-toolbar.mjs — L1 tests for document selection text anchors
// =============================================================================

import { computeTextAnchorForRange } from '../src/present/floating-toolbar.js';

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

function makeText(text) {
  return {
    nodeType: 3,
    textContent: text,
    parentNode: null,
    parentElement: null,
  };
}

function makeElement({ offset = null, children = [] } = {}) {
  const el = {
    nodeType: 1,
    dataset: offset === null ? {} : { offset: String(offset) },
    childNodes: [],
    parentNode: null,
    parentElement: null,
  };
  Object.defineProperty(el, 'textContent', {
    get() {
      return el.childNodes.map((child) => child.textContent || '').join('');
    },
  });
  el.childNodes = children;
  for (const child of children) {
    child.parentNode = el;
    child.parentElement = el;
  }
  return el;
}

function makeRoot(lines) {
  const root = makeElement({ children: lines });
  Object.defineProperty(root, 'textContent', {
    get() {
      return root.childNodes.map((child) => child.textContent || '').join('');
    },
  });
  root.querySelectorAll = (selector) => {
    if (selector !== '[data-offset]') return [];
    return lines;
  };
  return root;
}

function makeRange(startContainer, startOffset, endContainer, endOffset) {
  return { startContainer, startOffset, endContainer, endOffset };
}

console.log('=== floating-toolbar text anchor tests ===\n');

console.log('Test group 1: line data-offset maps DOM text back to flowingText offsets');
{
  const titleText = makeText('Title');
  const bodyText = makeText('Body text');
  const titleLine = makeElement({ offset: 0, children: [titleText] });
  const bodyLine = makeElement({ offset: 6, children: [bodyText] }); // "Title\nBody text"
  const root = makeRoot([titleLine, bodyLine]);

  const anchor = computeTextAnchorForRange(root, makeRange(bodyText, 0, bodyText, 4));

  ok(anchor?.startOffset === 6, `second line startOffset = 6 (got ${anchor?.startOffset})`);
  ok(anchor?.endOffset === 10, `second line endOffset = 10 (got ${anchor?.endOffset})`);
  ok(anchor?.text === 'Body', `second line text = Body (got ${anchor?.text})`);
}

console.log('\nTest group 2: cross-line selections preserve newline gaps');
{
  const titleText = makeText('Title');
  const bodyText = makeText('Body text');
  const titleLine = makeElement({ offset: 0, children: [titleText] });
  const bodyLine = makeElement({ offset: 6, children: [bodyText] });
  const root = makeRoot([titleLine, bodyLine]);

  const anchor = computeTextAnchorForRange(root, makeRange(titleText, 2, bodyText, 4));

  ok(anchor?.startOffset === 2, `cross-line startOffset = 2 (got ${anchor?.startOffset})`);
  ok(anchor?.endOffset === 10, `cross-line endOffset = 10 (got ${anchor?.endOffset})`);
  ok(anchor?.text === 'tle\nBody', `cross-line text includes newline (got ${JSON.stringify(anchor?.text)})`);
}

console.log('\nTest group 3: trimmed selection adjusts offsets with the text');
{
  const text = makeText('  Hello  ');
  const line = makeElement({ offset: 20, children: [text] });
  const root = makeRoot([line]);

  const anchor = computeTextAnchorForRange(root, makeRange(text, 0, text, 9));

  ok(anchor?.startOffset === 22, `trimmed startOffset = 22 (got ${anchor?.startOffset})`);
  ok(anchor?.endOffset === 27, `trimmed endOffset = 27 (got ${anchor?.endOffset})`);
  ok(anchor?.text === 'Hello', `trimmed text = Hello (got ${anchor?.text})`);
}

console.log('\nTest group 4: fallback without data-offset keeps container.textContent semantics');
{
  const hello = makeText('Hello ');
  const world = makeText('world');
  const childA = makeElement({ children: [hello] });
  const childB = makeElement({ children: [world] });
  const root = makeRoot([]);
  root.childNodes = [childA, childB];
  childA.parentNode = root;
  childA.parentElement = root;
  childB.parentNode = root;
  childB.parentElement = root;

  const anchor = computeTextAnchorForRange(root, makeRange(world, 0, world, 5));

  ok(anchor?.startOffset === 6, `fallback startOffset = 6 (got ${anchor?.startOffset})`);
  ok(anchor?.endOffset === 11, `fallback endOffset = 11 (got ${anchor?.endOffset})`);
  ok(anchor?.text === 'world', `fallback text = world (got ${anchor?.text})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
