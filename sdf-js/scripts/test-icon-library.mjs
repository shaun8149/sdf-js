#!/usr/bin/env node
// =============================================================================
// sdf-js/scripts/test-icon-library.mjs — L1 tests for src/icons/index.js
// =============================================================================

import { strict as assert } from 'node:assert';
import {
  getIconPath,
  getIconPath2D,
  getIconCategory,
  getAllCategories,
  hasIcon,
} from '../src/icons/index.js';
import { CATEGORY_NAMES } from '../src/icons/categories.js';

let passed = 0;
function it(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL ${name}:`, e.message);
    process.exitCode = 1;
  }
}

console.log('test-icon-library:');

it('getIconPath returns d string for known icon', () => {
  const d = getIconPath('briefcase');
  assert.equal(typeof d, 'string');
  assert.ok(d.length > 0);
  assert.ok(!d.includes('<svg'), 'should be raw d attr, not full svg');
  assert.ok(!d.includes('<path'), 'should be raw d attr, not path tag');
});

it('getIconPath returns null for unknown icon', () => {
  assert.equal(getIconPath('does-not-exist'), null);
});

it('hasIcon true for known, false for unknown', () => {
  assert.equal(hasIcon('briefcase'), true);
  assert.equal(hasIcon('does-not-exist'), false);
});

it('getIconPath2D returns Path2D for known icon', () => {
  // Path2D is a browser API, but Node 22+ exposes it via canvas package.
  // We don't depend on canvas, so test the fallback (returns null in Node) OR
  // mock global. Simpler: test the path string is constructable when Path2D exists.
  if (typeof Path2D === 'undefined') {
    globalThis.Path2D = class MockPath2D {
      constructor(d) {
        this.d = d;
      }
    };
  }
  const p = getIconPath2D('briefcase');
  assert.ok(p !== null);
  assert.ok(p instanceof Path2D);
});

it('getIconPath2D returns null for unknown icon', () => {
  if (typeof Path2D === 'undefined') {
    globalThis.Path2D = class MockPath2D {
      constructor(d) {
        this.d = d;
      }
    };
  }
  assert.equal(getIconPath2D('does-not-exist'), null);
});

it('getAllCategories returns 8 category names', () => {
  const cats = getAllCategories();
  assert.equal(cats.length, 8);
  assert.deepEqual(cats.slice().sort(), CATEGORY_NAMES.slice().sort());
});

it('getIconCategory returns non-empty list for each of 8 categories', () => {
  for (const cat of CATEGORY_NAMES) {
    const names = getIconCategory(cat);
    assert.ok(Array.isArray(names), `${cat} not array`);
    assert.ok(names.length >= 5, `${cat} should have ≥5 icons (got ${names.length})`);
    for (const n of names) {
      // Most names should be bakeable; if some missing, getIconPath returns null
      // for those — but we expect the curation to be 0-missing per Phase 3 Step 3.
      assert.equal(typeof n, 'string', `${cat} has non-string entry`);
    }
  }
});

it('getIconCategory returns [] for unknown category', () => {
  assert.deepEqual(getIconCategory('not-a-category'), []);
});

it('every name returned by getIconCategory has a bakeable path', () => {
  for (const cat of CATEGORY_NAMES) {
    for (const name of getIconCategory(cat)) {
      const d = getIconPath(name);
      assert.ok(
        d !== null,
        `${cat}/${name} missing from bake — fix categories.js or rerun build:icons`,
      );
    }
  }
});

it('total unique icons ≥ 700 (sanity floor)', () => {
  const allCats = getAllCategories();
  const unique = new Set();
  for (const c of allCats) {
    for (const n of getIconCategory(c)) unique.add(n);
  }
  assert.ok(unique.size >= 700, `Expected ≥700 unique icons, got ${unique.size}`);
});

it('Path2D paths render without throwing (smoke)', () => {
  if (typeof Path2D === 'undefined') {
    globalThis.Path2D = class MockPath2D {
      constructor(d) {
        this.d = d;
      }
    };
  }
  // Pick 5 random known names; constructing Path2D should not throw.
  const sample = ['briefcase', 'chart-line', 'cpu', 'heart', 'calendar'];
  for (const n of sample) {
    assert.doesNotThrow(() => getIconPath2D(n));
  }
});

console.log(`  ${passed} assertions passed`);
if (process.exitCode) process.exit(process.exitCode);
