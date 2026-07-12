// test-deck-contract.mjs — Sprint 66: the contract's own CI invariants.
// 1. every valid/ golden fixture validates ok (warnings allowed)
// 2. every invalid/ fixture fails, and on a message matching its filename
// 3. the full ammo pack validates (15 real corpus decks)
// 4. deck-io serialize output validates; deserializeDeck rejects contract breaks
// 5. warning semantics: empty deck / unknown atom / duplicate slotIdx warn, not err
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDeck } from '../src/present/deck-spec.js';
import { serializeDeck, deserializeDeck } from '../src/present/deck-io.js';

// fileURLToPath, NOT URL.pathname: on Windows .pathname is '/C:/…', and
// join()-ing that yields 'C:\C:\…' (ENOENT everywhere outside POSIX).
const REPO = fileURLToPath(new URL('../..', import.meta.url));
const HANDOFF = join(REPO, 'sdf-js/examples/deck-handoff');

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
};

// ── 1. valid golden fixtures ──
for (const f of readdirSync(join(HANDOFF, 'valid'))) {
  const v = validateDeck(readFileSync(join(HANDOFF, 'valid', f), 'utf8'));
  ok(v.ok, `valid/${f} validates (errors: ${v.errors.join('; ') || 'none'})`);
}

// ── 2. invalid fixtures fail on the named violation ──
const EXPECT = {
  'wrong-format.json': /format must be/,
  'future-version.json': /newer than this validator/,
  'slots-not-array.json': /slots must be an array/,
  'slot-missing-scenedata.json': /sceneData must be an object/,
  'subject-missing-type.json': /type must be a string/,
  'bad-theme-rgb.json': /theme\.bg/,
  'bad-decor.json': /decor\.(family|seed)/,
  'subject-bad-geometry.json': /\.x must be a number/,
};
for (const [f, re] of Object.entries(EXPECT)) {
  const v = validateDeck(readFileSync(join(HANDOFF, 'invalid', f), 'utf8'));
  ok(
    !v.ok && v.errors.some((e) => re.test(e)),
    `invalid/${f} dies on its named violation (${v.errors[0] || 'no error?!'})`,
  );
}

// ── 3. ammo pack (real corpus decks) ──
{
  const files = readdirSync(join(HANDOFF, 'ammo')).filter((f) => f.endsWith('.json'));
  ok(files.length >= 15, `ammo pack has the full corpus (${files.length} decks)`);
  const bad = files.filter((f) => !validateDeck(readFileSync(join(HANDOFF, 'ammo', f), 'utf8')).ok);
  ok(bad.length === 0, `all ammo decks validate (${bad.join(', ') || 'none bad'})`);
}

// ── 4. deck-io round-trip through the validator ──
{
  const deck = {
    title: 'io',
    theme: { id: 'editorial-navy', bg: [248, 246, 240], accent: [38, 70, 130] },
    decor: { family: 'peg-wraps', seed: 1, personality: 'calm', hash: 'ff', v: 3 },
    scaffold: { id: 'qbr', label: 'QBR' },
    slots: [
      {
        slotIdx: 0,
        slotName: 'cover',
        sceneData: { subjects: [{ type: 'kpi-card', x: 0, y: 0, w: 100, h: 100, args: {} }] },
      },
    ],
    errors: [],
  };
  const ser = serializeDeck(deck);
  const v = validateDeck(ser);
  ok(v.ok, `serializeDeck output honors the contract (${v.errors.join('; ') || 'clean'})`);
  const back = deserializeDeck(JSON.stringify(ser));
  ok(back.slots.length === 1, 'deserializeDeck accepts its own output');
  let threw = null;
  try {
    deserializeDeck(JSON.stringify({ format: 'atlas-deck', version: 1, slots: [{ slotIdx: 0 }] }));
  } catch (e) {
    threw = e.message;
  }
  ok(
    /sceneData/.test(threw || ''),
    `deserializeDeck rejects contract breaks with the violation (${threw})`,
  );
}

// ── 5. warning semantics ──
{
  const w1 = validateDeck({ format: 'atlas-deck', version: 1, theme: 'x', slots: [] });
  ok(w1.ok && w1.warnings.some((w) => /zero slots/.test(w)), 'empty deck = warning, not error');
  const w2 = validateDeck(
    {
      format: 'atlas-deck',
      version: 1,
      theme: 'x',
      slots: [
        { slotIdx: 0, sceneData: { subjects: [{ type: 'mystery-atom', args: {} }] } },
        { slotIdx: 0, sceneData: { subjects: [{ type: 'kpi-card', args: {} }] } },
      ],
    },
    { knownAtomTypes: new Set(['kpi-card']) },
  );
  ok(
    w2.ok && w2.warnings.some((w) => /not in consumer registry/.test(w)),
    'unknown atom type = forward-compat warning',
  );
  ok(
    w2.warnings.some((w) => /duplicated/.test(w)),
    'duplicate slotIdx = warning',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
