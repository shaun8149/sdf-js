#!/usr/bin/env node
// test-eval-harness.mjs — Sprint 24 P2 smoke test for the eval scorer.
//
// Builds a synthetic 2-slot baked deck (one clean slot, one slot with a
// deliberate LLM-hallucinated atom type + an undeclared arg key) under a tmp
// dir, scores it with scoreDeckQuality(), and asserts every metric by hand.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scoreDeckQuality, collectTextChars, NON_TEXT_ARG_KEYS } from './eval-deck-quality.mjs';

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
function approxEqual(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

console.log('=== eval-deck-quality smoke test ===\n');

// ── build synthetic deck ──
const dir = mkdtempSync(join(tmpdir(), 'atlas-eval-harness-'));
mkdirSync(join(dir, 'slots'), { recursive: true });

const theme = {
  id: 'test-theme',
  bg: [255, 255, 255],
  accent: [38, 70, 130],
  colors: [
    [38, 70, 130],
    [165, 130, 90],
  ],
};

const slot0Scene = {
  name: 'test/cover',
  layout: 'cover',
  subjects: [
    { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: 'Test Deck', style: 'gradient' } },
  ],
};
const slot1Scene = {
  name: 'test/clean-and-dirty',
  layout: 'row',
  subjects: [
    { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: 'Body', style: 'gradient' } },
    {
      type: 'kpi-card',
      x: 40,
      y: 160,
      w: 300,
      h: 200,
      args: { value: '$3.4M', label: 'Q3 Revenue', style: 'dark' },
    },
    {
      // deliberate arg violation: 'footnote' is not in kpi-card's spec.args
      type: 'kpi-card',
      x: 400,
      y: 160,
      w: 300,
      h: 200,
      args: { value: '$1.2M', label: 'Q4 Revenue', footnote: 'unexpected extra key' },
    },
    {
      // deliberate LLM hallucination: not a registered atom type
      type: 'mystery-atom-x',
      x: 800,
      y: 160,
      w: 300,
      h: 200,
      args: { label: 'Should not exist' },
    },
  ],
};

writeFileSync(
  join(dir, 'slots', 'slot-00-cover.json'),
  JSON.stringify({ slotIdx: 0, slotName: 'cover', sceneData: slot0Scene }, null, 2),
);
writeFileSync(
  join(dir, 'slots', 'slot-01-clean-and-dirty.json'),
  JSON.stringify({ slotIdx: 1, slotName: 'clean-and-dirty', sceneData: slot1Scene }, null, 2),
);

const deckManifest = {
  deckName: 'eval-harness-synthetic',
  scaffold: { id: 'test-scaffold', pickerMethod: 'llm' },
  theme,
  slots: [
    {
      slotIdx: 0,
      slotName: 'cover',
      liftFile: 'slots/slot-00-cover.json',
      mappingEmpty: false,
      error: null,
    },
    {
      slotIdx: 1,
      slotName: 'clean-and-dirty',
      liftFile: 'slots/slot-01-clean-and-dirty.json',
      mappingEmpty: false,
      error: null,
    },
  ],
  totals: { slotsBaked: 2, slotsEmpty: 0, slotsErrored: 0 },
};
writeFileSync(join(dir, 'deck.json'), JSON.stringify(deckManifest, null, 2));

// ── score it ──
const result = await scoreDeckQuality(dir);

// STRUCTURE
ok(result.structure.slots_total === 2, 'slots_total === 2');
ok(result.structure.slots_baked === 2, 'slots_baked === 2');
ok(approxEqual(result.structure.fill_rate, 1.0), 'fill_rate === 1.0');
ok(result.structure.pick_method === 'llm', 'pick_method === llm');

// ATOM QUALITY (non-cover subjects: kpi-card clean, kpi-card dirty, mystery-atom-x = 3)
ok(result.atomQuality.atom_instances === 3, 'atom_instances === 3 (cover excluded)');
ok(
  result.atomQuality.atom_types_distinct === 2,
  'atom_types_distinct === 2 (kpi-card, mystery-atom-x)',
);
ok(result.atomQuality.unknown_atom_count === 1, 'unknown_atom_count === 1');
ok(
  result.atomQuality.unknown_atom_types.includes('mystery-atom-x'),
  'unknown_atom_types includes mystery-atom-x',
);
ok(result.atomQuality.arg_violations === 1, 'arg_violations === 1 (footnote)');
ok(
  result.atomQuality.arg_violations_top_offenders[0]?.key === 'footnote',
  'top offender key === footnote',
);
ok(
  result.atomQuality.arg_violations_top_offenders[0]?.type === 'kpi-card',
  'top offender type === kpi-card',
);

// 3D READINESS (5 subjects total: cover, cover, kpi-card, kpi-card, mystery-atom-x — 4 twinned)
ok(approxEqual(result.threeDReadiness.twin_coverage, 0.8), 'twin_coverage === 0.8');
ok(
  result.threeDReadiness.untwinned_types.includes('mystery-atom-x'),
  'untwinned_types includes mystery-atom-x',
);
ok(result.threeDReadiness.lift_success === 2, 'lift_success === 2 (neither slot throws)');
ok(approxEqual(result.threeDReadiness.lifted_subject_rate, 0.8), 'lifted_subject_rate === 0.8');

// TEXT BUDGET
ok(
  approxEqual(result.textBudget.chars_per_slot, 39.5),
  `chars_per_slot === 39.5 (got ${result.textBudget.chars_per_slot})`,
);

// SCORE
ok(approxEqual(result.score.total, 81), `score.total === 81 (got ${result.score.total})`);

// helper unit tests
ok(typeof scoreDeckQuality === 'function', 'scoreDeckQuality is exported as a function');
ok(typeof collectTextChars === 'function', 'collectTextChars is exported as a function');
ok(NON_TEXT_ARG_KEYS.has('style'), 'NON_TEXT_ARG_KEYS includes style');
ok(
  collectTextChars({ style: 'dark', label: 'Hi' }) === 2,
  'collectTextChars skips enum keys, counts prose keys',
);

// ── Sprint 24 iter2 (contract A): droppedSlots[] count toward planned total ──
// A deck that delivered 2 slots and dropped 2 has fill_rate 0.5 — same metric
// meaning as the pre-iter2 mappingEmpty representation.
deckManifest.droppedSlots = [
  { slotIdx: 2, slotName: 'exercise', reason: 'no-source-content' },
  { slotIdx: 3, slotName: 'summary', reason: 'no-source-content' },
];
writeFileSync(join(dir, 'deck.json'), JSON.stringify(deckManifest, null, 2));
const result2 = await scoreDeckQuality(dir);
ok(result2.structure.slots_total === 4, 'iter2: slots_total counts dropped (2+2=4)');
ok(result2.structure.slots_baked === 2, 'iter2: slots_baked === 2');
ok(
  approxEqual(result2.structure.fill_rate, 0.5),
  'iter2: fill_rate === 0.5 (2 delivered / 4 planned)',
);
ok(result2.structure.slots_empty === 2, 'iter2: slots_empty === droppedSlots.length');

rmSync(dir, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
