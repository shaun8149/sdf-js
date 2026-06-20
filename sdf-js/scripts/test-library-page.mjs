// =============================================================================
// test-library-page.mjs — L1 unit tests for Atlas Present library page helpers
// =============================================================================

import { canViewDeck } from '../src/present/library-page.js';
import { addPendingSections, createDeck, updateSectionStatus } from '../src/present/deck-model.js';

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
}

function deckWithStatuses(statuses) {
  const deck = createDeck('view gate');
  addPendingSections(
    deck,
    statuses.map((status, i) => ({
      slideData: { index: i, title: `Slide ${i + 1}` },
      code2d: `// slide ${i + 1}`,
      prompt: `Slide ${i + 1}`,
    })),
  );
  statuses.forEach((status, i) => {
    if (status !== 'pending') updateSectionStatus(deck, deck.sections[i].id, status);
  });
  return deck;
}

console.log('=== library-page helper tests ===\n');

ok(canViewDeck(deckWithStatuses(['ready', 'ready'])) === true, 'all-ready deck can be viewed');
ok(
  canViewDeck(deckWithStatuses(['ready', 'error', 'ready'])) === true,
  'completed deck with some lift errors can be viewed',
);
ok(
  canViewDeck(deckWithStatuses(['ready', 'pending'])) === false,
  'still-pending deck stays gated',
);
ok(
  canViewDeck(deckWithStatuses(['ready', 'lifting'])) === false,
  'actively lifting deck stays gated',
);
ok(canViewDeck(deckWithStatuses(['error'])) === false, 'deck with no ready sections stays gated');

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
