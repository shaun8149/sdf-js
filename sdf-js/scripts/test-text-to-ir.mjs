// sdf-js/scripts/test-text-to-ir.mjs — the text → IR adapter's parse/validate
// path (the LLM call itself is BYOK browser-side; CI tests the contract).
import { parseIRResponse, TEXT_TO_IR_SYSTEM } from '../src/scene/text-to-ir.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { compile } from '../src/scene/index.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== text-to-ir (parse + validate + end-to-end) ===\n');

const GOOD = JSON.stringify({
  title: 'Q3',
  slides: [
    {
      structure: 'magnitude',
      nodes: ['EMEA', 'APAC', 'Americas'],
      magnitude: [340, 620, 890],
      emphasis: [2],
      title: 'Revenue',
    },
    {
      structure: 'sequence',
      nodes: ['Leads', 'Closed'],
      magnitude: [1200, 45],
      emphasis: [1],
      title: 'Funnel',
    },
  ],
});

// ---- happy path + fence/prose tolerance ---------------------------------------
ok(parseIRResponse(GOOD).slides.length === 2, 'clean JSON parses');
ok(parseIRResponse('```json\n' + GOOD + '\n```').slides.length === 2, 'fenced JSON parses');
ok(parseIRResponse('Here is your deck:\n' + GOOD).slides.length === 2, 'leading prose tolerated');

// ---- failure modes -------------------------------------------------------------
{
  let e = null;
  try {
    parseIRResponse('I cannot do that.');
  } catch (x) {
    e = x;
  }
  ok(e && /not JSON|must be/.test(e.message), 'non-JSON reply throws clearly');
}
{
  let e = null;
  try {
    parseIRResponse(
      JSON.stringify({
        title: 'bad',
        slides: [{ structure: 'hierarchy', nodes: ['a', 'b'], title: 'no relations' }],
      }),
    );
  } catch (x) {
    e = x;
  }
  ok(
    e && Array.isArray(e.validationErrors),
    'invalid IR throws with validationErrors (retry fuel)',
  );
  ok(e && /hierarchy/.test(e.message), 'error names the failing slide');
}

// ---- the whole loop: parsed deck → assembled world → compiles -------------------
{
  const deck = parseIRResponse(GOOD);
  const scene = assembleDeck(deck);
  ok(scene.subjects.length > 0 && scene.cameraSequence.shots.length > 5, 'deck assembles');
  try {
    compile(scene, {});
    ok(true, 'text → IR → deck → ONE compiled scene (thesis loop closes)');
  } catch (x) {
    ok(false, `compile failed: ${x.message}`);
  }
}

// ---- prompt hygiene (repo rule: prompts stay SHORT) ------------------------------
ok(
  TEXT_TO_IR_SYSTEM.length < 2200,
  `system prompt stays short (${TEXT_TO_IR_SYSTEM.length} chars)`,
);
ok(
  ['sequence', 'hierarchy', 'network', 'magnitude'].every((s) => TEXT_TO_IR_SYSTEM.includes(s)),
  'all four structures documented',
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
