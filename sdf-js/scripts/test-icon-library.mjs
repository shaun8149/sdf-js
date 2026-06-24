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
  getBrandColor,
  getFlagSvg,
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

it('getIconPath2D returns placeholder Path2D for unknown icon', () => {
  if (typeof Path2D === 'undefined') {
    globalThis.Path2D = class MockPath2D {
      constructor(d) {
        this.d = d;
      }
    };
  }
  // resolveIcon now returns a placeholder on miss, so getIconPath2D returns its path
  const p = getIconPath2D('does-not-exist');
  assert.ok(p !== null, 'placeholder path is non-null');
  assert.ok(p instanceof Path2D, 'placeholder path is a Path2D');
});

it('getAllCategories returns 14 category names (Sprint 18 expansion)', () => {
  const cats = getAllCategories();
  assert.equal(cats.length, 14);
  assert.deepEqual(cats.slice().sort(), CATEGORY_NAMES.slice().sort());
});

it('getIconCategory returns non-empty list for each of 14 categories', () => {
  for (const cat of CATEGORY_NAMES) {
    const names = getIconCategory(cat);
    assert.ok(Array.isArray(names), `${cat} not array`);
    assert.ok(names.length >= 5, `${cat} should have ≥5 icons (got ${names.length})`);
    for (const n of names) {
      assert.equal(typeof n, 'string', `${cat} has non-string entry`);
    }
  }
});

it('getIconCategory returns [] for unknown category', () => {
  assert.deepEqual(getIconCategory('not-a-category'), []);
});

it('every name returned by getIconCategory has a bakeable path or flag SVG', () => {
  // Phosphor + brand cats: getIconPath must return non-null
  // Flag cat: getFlagSvg must return non-null (flags store SVG body, not d path)
  const FLAG_CATEGORY = 'flags';
  for (const cat of CATEGORY_NAMES) {
    for (const name of getIconCategory(cat)) {
      if (cat === FLAG_CATEGORY) {
        const svg = getFlagSvg(name);
        assert.ok(
          svg !== null && svg.length > 0,
          `flags/${name} missing from flag-icons bake — fix categories.js or rerun bake-icon-library-v2.mjs`,
        );
      } else {
        const d = getIconPath(name);
        assert.ok(
          d !== null,
          `${cat}/${name} missing from bake — fix categories.js or rerun bake-icon-library-v2.mjs`,
        );
      }
    }
  }
});

it('total unique icons ≥ 700 (sanity floor)', () => {
  const allCats = getAllCategories();
  const unique = new Set();
  for (const c of allCats) {
    for (const n of getIconCategory(c)) unique.add(n);
  }
  // Sprint 18: 3 sources → 699 Phosphor + 125 brand + 50 flags curated = 874+
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

// -------- Integration: icon-badge atom expanded universe --------

import {
  ICON_BADGE_NAMES,
  ICON_BADGE_HARDCODED_NAMES,
  getIconBadgeNames,
} from '../src/present/atoms-2d/icons/icon-badge.js';

it('icon-badge ICON_BADGE_HARDCODED_NAMES is 24', () => {
  assert.equal(ICON_BADGE_HARDCODED_NAMES.length, 24);
});

it('icon-badge ICON_BADGE_NAMES includes all 24 hardcoded + Phosphor', () => {
  for (const n of ICON_BADGE_HARDCODED_NAMES) {
    assert.ok(ICON_BADGE_NAMES.includes(n), `hardcoded ${n} missing from full list`);
  }
  // Should be much larger than 24 (24 + ~772 Phosphor = ~796)
  assert.ok(ICON_BADGE_NAMES.length >= 700, `Expected ≥700 total, got ${ICON_BADGE_NAMES.length}`);
});

it('getIconBadgeNames() returns sorted union (deterministic)', () => {
  const a = getIconBadgeNames();
  const b = getIconBadgeNames();
  assert.deepEqual(a, b);
  // sorted ascending
  for (let i = 1; i < a.length; i++) {
    assert.ok(a[i] >= a[i - 1], `not sorted at index ${i}: ${a[i - 1]} > ${a[i]}`);
  }
});

console.log(`  ${passed} assertions passed`);
if (process.exitCode) process.exit(process.exitCode);
