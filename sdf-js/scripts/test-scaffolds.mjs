// =============================================================================
// test-scaffolds.mjs — Sprint 15E smoke test for scaffold registry + picker
// =============================================================================

import {
  SCAFFOLDS,
  getScaffold,
  listScaffolds,
  getThemeAffinity,
  scaffoldStats,
  totalSlots,
} from '../src/present/scaffolds/registry.js';
import { rankScaffolds, pickScaffold, distributeSources } from '../src/present/scaffolds/picker.js';
import { getTheme } from '../src/present/themes.js';

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

console.log('=== scaffolds registry smoke ===\n');

console.log('--- registry shape ---');
{
  ok(SCAFFOLDS.length === 10, `10 scaffolds shipped (got ${SCAFFOLDS.length})`);
  const ids = new Set(SCAFFOLDS.map((s) => s.id));
  ok(ids.size === SCAFFOLDS.length, 'all scaffold ids unique');

  for (const s of SCAFFOLDS) {
    ok(typeof s.id === 'string' && s.id.length > 0, `${s.id}: has id`);
    ok(Array.isArray(s.slots) && s.slots.length >= 3, `${s.id}: has ≥3 slots (${s.slots.length})`);
    ok(s.slots[0].name === 'cover', `${s.id}: first slot is 'cover'`);
    for (const slot of s.slots) {
      ok(
        Array.isArray(slot.recommended_atoms) && slot.recommended_atoms.length > 0,
        `${s.id}.${slot.name}: has recommended_atoms`,
      );
    }
    ok(
      Array.isArray(s.theme_affinity) && s.theme_affinity.length > 0,
      `${s.id}: has theme_affinity`,
    );
    for (const tid of s.theme_affinity) {
      ok(getTheme(tid) !== null, `${s.id}: theme '${tid}' exists in registry`);
    }
  }
}

console.log('\n--- helper functions ---');
{
  ok(getScaffold('pitch-deck-vc') !== null, 'getScaffold resolves known id');
  ok(getScaffold('nonsense-deck') === null, 'getScaffold returns null for unknown');
  ok(listScaffolds().length === 10, 'listScaffolds returns 10');
  ok(totalSlots() > 50, `totalSlots > 50 (got ${totalSlots()})`);
  const stats = scaffoldStats();
  ok(stats.scaffolds === 10, 'stats.scaffolds = 10');
  ok(stats.avgSlotsPerScaffold > 5, `stats.avgSlotsPerScaffold > 5 (${stats.avgSlotsPerScaffold})`);
  const themes = getThemeAffinity('pitch-deck-vc');
  ok(themes.length === 3, 'getThemeAffinity returns 3 themes for pitch-deck-vc');
  ok(themes[0].id === 'pitch-cobalt-orange', 'pitch-deck-vc top theme is cobalt-orange');
}

console.log('\n--- picker: rank + pick ---');
{
  // VC pitch input
  const vcInput = {
    title: 'Acme Series A Pitch',
    bodyTexts: [
      'We are raising Series A to scale our SaaS platform',
      'Problem statement about pain points',
      'Total addressable market is $10B',
      'Our solution differentiates via X',
      'Traction: $3M ARR growing 30% MoM',
      'Team: 3 ex-Google founders',
      'Ask: $15M for product and growth',
    ],
  };
  const vcRanked = rankScaffolds(vcInput);
  ok(vcRanked.length === 10, 'rankScaffolds returns all scaffolds');
  ok(
    vcRanked[0].id === 'pitch-deck-vc',
    `VC input → pitch-deck-vc top (got ${vcRanked[0].id} score=${vcRanked[0].score})`,
  );

  // QBR input
  const qbrInput = {
    title: 'Q3 Business Review',
    bodyTexts: [
      'Q3 review for the executive team',
      'KPI dashboard showing key metrics',
      'Quarterly wins and milestones',
      'Challenges we faced',
      'Outlook for next quarter',
    ],
  };
  const qbrRanked = rankScaffolds(qbrInput);
  ok(
    qbrRanked[0].id === 'qbr',
    `QBR input → qbr top (got ${qbrRanked[0].id} score=${qbrRanked[0].score})`,
  );

  // Training input
  const trainInput = {
    title: 'How to use Atlas — Onboarding Tutorial',
    bodyTexts: [
      'Welcome to onboarding',
      'Learning objectives',
      'Step by step guide',
      'Try it yourself',
    ],
  };
  const trainRanked = rankScaffolds(trainInput);
  ok(
    trainRanked[0].id === 'training',
    `Training input → training top (got ${trainRanked[0].id} score=${trainRanked[0].score})`,
  );

  // OKR input
  const okrInput = {
    title: 'Q4 OKR Plan',
    bodyTexts: ['North star objective', 'Key result 1', 'Key result 2'],
  };
  const okrRanked = rankScaffolds(okrInput);
  ok(
    okrRanked[0].id === 'okr-goal-setting',
    `OKR input → okr-goal-setting top (got ${okrRanked[0].id} score=${okrRanked[0].score})`,
  );

  // pickScaffold should return scaffold + theme + signals
  const picked = pickScaffold(vcInput);
  ok(picked.scaffold.id === 'pitch-deck-vc', 'pickScaffold returns scaffold');
  ok(picked.theme && picked.theme.id, 'pickScaffold returns theme');
  ok(Array.isArray(picked.signals) && picked.signals.length > 0, 'pickScaffold returns signals');
  ok(!picked.fallback, 'pickScaffold not fallback for good input');

  // Empty input falls back
  const emptyPick = pickScaffold({ title: '', bodyTexts: [] });
  ok(emptyPick.fallback === true, 'pickScaffold falls back on empty input');
  ok(emptyPick.scaffold.id === 'company-overview', 'fallback is company-overview');
}

console.log('\n--- picker: distributeSources ---');
{
  const scaffold = getScaffold('qbr'); // 7 slots
  const sources7 = Array.from({ length: 7 }, (_, i) => ({ title: `Source ${i}` }));
  const dist7 = distributeSources(scaffold, sources7);
  ok(dist7.length === 7, '7-source → 7 distribution');
  ok(dist7[0].slot.name === 'cover', 'first slot is cover');
  ok(dist7[0].source.title === 'Source 0', 'first source to first slot');

  const sources3 = Array.from({ length: 3 }, (_, i) => ({ title: `S${i}` }));
  const dist3 = distributeSources(scaffold, sources3);
  ok(dist3.length === 7, 'fewer sources → still 7 slots');
  ok(dist3.filter((d) => d.source !== null).length >= 3, 'at least 3 slots have sources');

  const sources15 = Array.from({ length: 15 }, (_, i) => ({ title: `S${i}` }));
  const dist15 = distributeSources(scaffold, sources15);
  ok(dist15.length === 7, 'more sources → 7 slots');
  ok(
    dist15.every((d) => d.source !== null),
    'all slots have sources when over-supplied',
  );

  const empty = distributeSources(scaffold, []);
  ok(empty.length === 7 && empty.every((d) => d.source === null), 'empty → all null sources');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
