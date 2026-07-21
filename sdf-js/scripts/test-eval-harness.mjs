#!/usr/bin/env node
// test-eval-harness.mjs — Sprint 24 P2 smoke test for the eval scorer.
//
// Builds a synthetic 2-slot baked deck (one clean slot, one slot with a
// deliberate LLM-hallucinated atom type + an undeclared arg key) under a tmp
// dir, scores it with scoreDeckQuality(), and asserts every metric by hand.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scoreDeckQuality,
  collectTextChars,
  NON_TEXT_ARG_KEYS,
  verifiedDerivedTokens,
  deckNumberTokens,
  numberGrounded,
} from './eval-deck-quality.mjs';

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

// ── Sprint 29: number token matching + Chinese entity extraction ──
{
  const { deckNumberTokens, numberPreserved, extractKeyEntities } =
    await import('./eval-deck-quality.mjs');

  // Payload numbers inside JSON arrays split correctly (comma = separator,
  // not thousands) and stand in for their "%" source forms.
  const tokens = deckNumberTokens('{"values":[5,1.1,5.4],"label":"IMF 3.3%","big":"12,450"}');
  ok(numberPreserved('1.1%', tokens), 'payload 1.1 preserves source "1.1%"');
  ok(numberPreserved('5.4%', tokens), 'payload 5.4 preserves source "5.4%"');
  ok(numberPreserved('3.3%', tokens), 'literal "3.3%" still matches');
  ok(numberPreserved('12,450', tokens), 'thousands-separator token matches');
  ok(
    !numberPreserved('5%', deckNumberTokens('{"v":"2.5%"}')),
    'no substring free-ride: "5%" not preserved by "2.5%"',
  );
  ok(
    !numberPreserved('$3.4M', deckNumberTokens('{"v":3.4}')),
    'bare 3.4 does NOT stand in for "$3.4M"',
  );

  // Chinese org extraction: suffix runs, known list, connector splitting.
  const ents = extractKeyEntities([
    {
      title: 'x',
      body: [
        '国际货币基金组织最新《世界经济展望》',
        '美联储、英国央行与欧洲央行均有降息空间',
        '该报告由世界银行发布',
      ],
    },
  ]);
  ok(ents.includes('国际货币基金组织'), 'CJK suffix run: 国际货币基金组织');
  ok(
    ents.includes('英国央行') && ents.includes('欧洲央行'),
    'connector 与 splits two 央行 entities',
  );
  ok(!ents.includes('英国央行与欧洲央行'), 'no greedy compound across 与');
  ok(ents.includes('世界银行'), 'lead function words stripped: 世界银行');
  ok(ents.includes('美联储'), 'known-org list: 美联储');

  // Heading filter: all-generic title-case runs are section headings, not
  // entities; one non-generic word rescues the run.
  const ents2 = extractKeyEntities([
    {
      title: 'x',
      body: [
        'Company Overview and our Team Heritage',
        'per Gartner Magic Quadrant, beats Google Slides',
        'won Best Product Award on Product Hunt',
      ],
    },
  ]);
  ok(!ents2.includes('Company Overview'), 'generic heading filtered: Company Overview');
  ok(!ents2.includes('Team Heritage'), 'generic heading filtered: Team Heritage');
  ok(!ents2.includes('Best Product Award'), 'generic heading filtered: Best Product Award');
  ok(ents2.includes('Gartner Magic Quadrant'), 'non-generic word rescues: Gartner Magic Quadrant');
  ok(ents2.includes('Google Slides'), 'non-generic word rescues: Google Slides');
  ok(ents2.includes('Product Hunt'), 'non-generic word rescues: Product Hunt');
}

// ── Sprint 33: adversarial number precision ──
{
  const { extractDeckPayloadNumbers, numberGrounded, deckNumberTokens } =
    await import('./eval-deck-quality.mjs');
  const slots = [
    {
      sceneData: {
        subjects: [
          {
            type: 'bar',
            x: 40,
            y: 160,
            w: 1200,
            h: 480,
            args: { title: 'Growth', values: [93, 2.5], labels: ['A 93%', 'B 2.5%'] },
          },
          {
            type: 'kpi-card',
            x: 40,
            y: 20,
            w: 300,
            h: 100,
            args: { value: '$4.5M', label: 'ARR' },
          },
          { type: 'number-list', x: 0, y: 0, w: 100, h: 100, args: { items: ['01', '02', '03'] } },
        ],
      },
    },
  ];
  const nums = extractDeckPayloadNumbers(slots);
  ok(!nums.includes('1200') && !nums.includes('480'), 'geometry x/y/w/h never counted');
  ok(!nums.includes('01') && !nums.includes('03'), 'list numbering ≤12 exempt');
  ok(nums.includes('$4.5M') && nums.includes('93%'), 'payload values counted');

  const srcTokens = deckNumberTokens('growth was 93% and ARR reached $4.5M in 2025');
  ok(numberGrounded('93', srcTokens), 'bare 93 grounded by source "93%"');
  ok(numberGrounded('$4.5M', srcTokens), 'literal $4.5M grounded');
  ok(numberGrounded('4.5M', srcTokens), 'suffix form 4.5M grounded by "$4.5M"');
  ok(!numberGrounded('$2.3B', srcTokens), 'invented $2.3B NOT grounded (hallucination)');

  // Sprint 33 value equivalence + scale-word folding
  const { numericValueOf, valueSetOf, extractKeyNumbers } = await import('./eval-deck-quality.mjs');
  ok(numericValueOf('$3.8B') === 3.8e9, 'numericValueOf $3.8B → 3.8e9');
  ok(numericValueOf('500,000') === 500000, 'numericValueOf strips thousands commas');
  ok(numericValueOf('93%') === 93, 'percent keeps face value');
  const scaled = extractKeyNumbers(
    'spent $3.8 billion on 46 trillion tokens and 500 thousand GPUs',
  );
  ok(
    scaled.includes('$3.8B') && scaled.includes('46T') && scaled.includes('500K'),
    'scale words fold to suffix form',
  );
  const srcVals = valueSetOf(deckNumberTokens('a $500K to $4.6 million range'));
  ok(numberGrounded('$500,000', new Set(), srcVals), '$500,000 grounded by value of "$500K"');
  ok(numberGrounded('4600000', new Set(), srcVals), 'bare 4600000 grounded by "$4.6 million"');
  ok(!numberGrounded('1600000', new Set(), srcVals), 'interpolated 1600000 stays hallucinated');

  // entity fixes: New York City survives; extraction over body lines
  const { extractKeyEntities: extractEnts } = await import('./eval-deck-quality.mjs');
  const geoEnts = extractEnts([
    { title: 'x', body: ['the city of New York City requested rain ponchos'] },
  ]);
  ok(geoEnts.includes('New York City'), '"New" not stripped before geo names');
}

// ── Sprint 35: adversarial entity precision ──
{
  const { extractDeckEntities, entityGrounded } = await import('./eval-deck-quality.mjs');
  const slots = [
    {
      sceneData: {
        subjects: [
          {
            type: 'numbered-grid',
            x: 0,
            y: 0,
            w: 1200,
            h: 600,
            args: {
              items: [
                { label: 'Nuclear Power Renaissance', sublabel: 'Tech giants restart reactors' },
                { label: 'Core Themes', sublabel: 'x' },
                { label: 'Gartner Magic Quadrant', sublabel: 'ranked leader' },
                { label: 'Very High', sublabel: 'axis label' },
              ],
            },
          },
        ],
      },
    },
  ];
  const ents = extractDeckEntities(slots);
  ok(ents.includes('Nuclear Power Renaissance'), 'deck entity extracted from args');
  ok(!ents.includes('Core Themes'), 'generic heading vocabulary filtered');
  ok(!ents.includes('Very High'), 'axis-label vocabulary filtered');

  const src = 'the analysis covers gartner magic quadrant rankings and gpu cloud costs';
  ok(entityGrounded('Gartner Magic Quadrant', src), 'source-named entity grounded');
  ok(
    !entityGrounded('Nuclear Power Renaissance', src),
    'world-knowledge topic NOT grounded (invented)',
  );
  ok(entityGrounded('Cloud Costs Overview', src), 'phrase built from source words self-grounds');
  ok(entityGrounded('IMF', '国际货币基金组织发布报告'), 'alias grounds cross-language');
}

// ── Sprint 65: Rule 24 derived-value citation verifier ──
{
  const src = new Set([
    '30.6',
    '4.5',
    '1,483.2',
    '1483.2',
    '1,146.8',
    '1146.8',
    '1,696,180',
    '1696180',
    '372.5',
  ]);
  const v = verifiedDerivedTokens(
    [
      '+580% (30.6 vs 4.5)', //     correct growth, parents grounded → verified
      '-64% (46.0 vs 16.5)', //     parents NOT in source → rejected
      '22.7% (1,483.2 vs 1,146.8)', // correct decline → verified
      '1.7M (1,696,180)', //        rounding citation → verified
      '+999% (30.6 vs 4.5)', //     wrong arithmetic → rejected
      '50% (372.5)', //             percent with single parent → rejected
    ],
    src,
    null,
  );
  ok(v.has('580%'), 'correct growth citation verifies');
  ok(v.has('22.7%'), 'correct decline citation verifies');
  ok(v.has('1.7M'), 'rounding citation verifies');
  ok(!v.has('64%'), 'ungrounded parents rejected');
  ok(!v.has('999%'), 'wrong arithmetic rejected');
  ok(!v.has('50%'), 'single-parent percent rejected');
  const v2 = verifiedDerivedTokens(
    ['-$336.4M (1,483.2 vs 1,146.8)', '319 (314 vs 324)', '$500M (1,483.2 vs 1,146.8)'],
    new Set(['1,483.2', '1483.2', '1,146.8', '1146.8', '314', '324']),
    null,
  );
  ok(v2.has('$336.4M'), 'absolute-difference citation verifies (unit-suffix tolerant)');
  ok(v2.has('319'), 'midpoint citation verifies');
  ok(!v2.has('$500M'), 'wrong absolute difference rejected');
}

// ── Sprint 71: CJK date alias — "2025 年 3 月" grounds deck-side "2025.3" ──
{
  const src = deckNumberTokens('发射台战争始于 2025 年 3 月, 高峰在 2026 年 11 月。');
  ok(numberGrounded('2025.3', src), 'YYYY.M form grounds against 年月 source');
  ok(numberGrounded('2026.11', src), 'two-digit month grounds too');
  ok(!numberGrounded('2025.7', src), 'a month the source never wrote stays ungrounded');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
