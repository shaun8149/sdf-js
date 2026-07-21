// sdf-js/scripts/test-assemble-deck-golden.mjs — W0.1 golden snapshots.
// Freezes assembleDeck's FULL output (subjects/ids/shots/windows/hitstops/
// overlay) for the three shipped layouts on the Phase-1 corpus deck. Any
// assemble-deck refactor (spatialplan Wave 4) must be byte-equivalent here
// first — equivalence gates the blind A/B (debate synthesis, 落地 #10).
//
// Intentional churn (a renderer or assembler behavior change that SHOULD
// alter output): regenerate with
//   node sdf-js/scripts/test-assemble-deck-golden.mjs --update
// and justify the golden diff in the PR.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assembleDeck } from '../src/scene/assemble-deck.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(__dirname, '../fixtures/golden');
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));
// The 2015 production deck freezes on its SHIPPING layout only (theater) —
// it iterates faster than the 2013 corpus deck, so one golden keeps the
// regression net without four files of churn per content edit.
const DECK_2015 = JSON.parse(
  readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp-2015.json'), 'utf8'),
);
const RUNS = [
  ...['line', 'radial', 'grid', 'courtyard'].map((layout) => ({
    deck: DECK,
    layout,
    file: `assemble-deck-${layout}.json`,
    label: layout,
  })),
  {
    deck: DECK_2015,
    layout: 'theater',
    file: 'assemble-deck-2015-theater.json',
    label: '2015·theater',
  },
];
const UPDATE = process.argv.includes('--update');

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== assemble-deck golden snapshots (bytedance-bp × 4 layouts + 2015 × theater) ===\n');

if (UPDATE) mkdirSync(GOLDEN_DIR, { recursive: true });

for (const { deck, layout, file: fname, label: layoutLabel } of RUNS) {
  const layoutName = layoutLabel;
  const scene = assembleDeck(deck, { layout });
  const got = JSON.stringify(scene, null, 1);
  const file = resolve(GOLDEN_DIR, fname);
  if (UPDATE) {
    writeFileSync(file, got + '\n');
    console.log(
      `  ↻ wrote ${file} (${scene.subjects.length} subjects, ${scene.cameraSequence.shots.length} shots)`,
    );
    continue;
  }
  if (!existsSync(file)) {
    ok(false, `${layoutName}: golden file missing — run with --update once`);
    continue;
  }
  // Compare CONTENT, not formatting: the pre-commit prettier hook re-indents
  // fixture JSONs, so a raw string compare fails at char 1 on indentation
  // alone. Normalizing through parse→stringify keeps the check exact on every
  // value while ignoring whitespace style.
  const norm = (s) => JSON.stringify(JSON.parse(s));
  const want = norm(readFileSync(file, 'utf8'));
  if (norm(got) === want) {
    ok(
      true,
      `${layoutName}: output matches golden (${scene.subjects.length} subjects, ${scene.cameraSequence.shots.length} shots, ${scene.deckWindows.length} windows)`,
    );
  } else {
    const gotN = norm(got);
    let i = 0;
    while (i < Math.min(gotN.length, want.length) && gotN[i] === want[i]) i++;
    const ctx = (s) => s.slice(Math.max(0, i - 80), i + 80).replace(/\n/g, '⏎');
    ok(false, `${layoutName}: output diverges from golden at char ${i} (normalized)`);
    console.log(`    golden: …${ctx(want)}…`);
    console.log(`    got:    …${ctx(gotN)}…`);
    console.log(
      '    (intentional change? regenerate with --update and justify the diff in the PR)',
    );
  }
}

if (!UPDATE) {
  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail) process.exit(1);
} else {
  console.log('\ngoldens updated.');
}
