#!/usr/bin/env node
// Smoke test for buildAtomCatalogString — Sprint 18 Tier 3 A.1
import { buildAtomCatalogString, _resetCatalogCache } from '../src/present/atoms-2d/catalog.js';

let pass = 0;
let fail = 0;

function ok(label, cond) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + label);
  } else {
    fail++;
    console.log('  ✗ ' + label);
  }
}

console.log('=== atom-catalog smoke ===');

_resetCatalogCache();
const s = await buildAtomCatalogString();

ok('returns non-empty string', typeof s === 'string' && s.length > 1000);
ok('has header', s.includes('Atlas Atom Catalog'));
ok('has HARD RULE warning about exact keys', s.includes('HARD RULE'));

// Atoms previously emitted with WRONG args (the bug this fixes)
ok('fishbone entry present', s.includes('`fishbone`'));
ok(
  'fishbone has correct args (effect + branches)',
  /fishbone[\s\S]{0,200}effect[\s\S]{0,200}branches/.test(s),
);
ok('timeline entry present', s.includes('`timeline`'));
ok('timeline has correct args (events not milestones)', /timeline[\s\S]{0,200}events:/.test(s));

// Atoms emitted correctly should also be in catalog
ok('kpi-card present', s.includes('`kpi-card`'));
ok('icon-row present', s.includes('`icon-row`'));
ok('dashboard-multi-kpi-composite present', s.includes('`dashboard-multi-kpi-composite`'));
ok('cover present', s.includes('`cover`'));

// Categories should be present
ok('charts/data category present', s.includes('### charts/data'));
ok('icons category present', s.includes('### icons'));
ok('presentation category present', s.includes('### presentation'));

// Cache: 2nd call returns identical
const s2 = await buildAtomCatalogString();
ok('cached: second call returns same string', s === s2);

// Size sanity: < 50KB so it fits cache budget
ok('size < 50KB (' + s.length + ' chars)', s.length < 50000);

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
