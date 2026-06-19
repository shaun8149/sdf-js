// =============================================================================
// test-deck-model.mjs — L1 unit tests for Atlas Present deck model
// =============================================================================

import * as deck from '../src/present/deck-model.js';

// Mock localStorage (Node doesn't have it)
const localStorageMock = {};
globalThis.localStorage = {
  getItem: (k) => (k in localStorageMock ? localStorageMock[k] : null),
  setItem: (k, v) => {
    localStorageMock[k] = v;
  },
  removeItem: (k) => {
    delete localStorageMock[k];
  },
  clear: () => {
    for (const k of Object.keys(localStorageMock)) delete localStorageMock[k];
  },
};

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

function resetStorage() {
  localStorage.clear();
}

console.log('=== deck-model smoke test ===\n');

// constants exported
ok(deck.DECKS_STORAGE_KEY === 'atlas-decks', 'DECKS_STORAGE_KEY exported');
ok(deck.STORAGE_VERSION === 1, 'STORAGE_VERSION exported');

console.log('Test group 1: createDeck');

// Basic creation
{
  const d = deck.createDeck('My Deck');
  ok(typeof d.id === 'string' && d.id.length > 0, 'createDeck: assigns id');
  ok(d.title === 'My Deck', 'createDeck: sets title');
  ok(typeof d.createdAt === 'number' && d.createdAt > 0, 'createDeck: createdAt set');
  ok(d.updatedAt === d.createdAt, 'createDeck: updatedAt = createdAt initially');
  ok(d.theme && d.theme.renderer === 'studio', 'createDeck: default theme.renderer = studio');
  ok(d.defaults && d.defaults.transitionType === 'cut', 'createDeck: default transitionType = cut');
  ok(Array.isArray(d.slides) && d.slides.length === 0, 'createDeck: slides is empty array');
}

// Empty title defaults
{
  const d = deck.createDeck();
  ok(
    d.title === 'Untitled Deck',
    `createDeck: no title defaults to 'Untitled Deck' (got '${d.title}')`,
  );
}

console.log('\nTest group 2: addSlide / removeSlide');

// addSlide appends and updates updatedAt
{
  const d = deck.createDeck('test');
  const origUpdated = d.updatedAt;
  const slideSceneData = { v: 1, name: 'slide A', subjects: [] };
  const before = Date.now();
  while (Date.now() === before) {}
  const slide = deck.addSlide(d, { sceneData: slideSceneData, title: 'A' });
  ok(d.slides.length === 1, 'addSlide: deck has 1 slide');
  ok(d.slides[0].id === slide.id, 'addSlide: returned slide is in deck');
  ok(d.slides[0].title === 'A', 'addSlide: title passed through');
  ok(
    d.updatedAt > origUpdated,
    `addSlide: updatedAt advanced (orig ${origUpdated}, now ${d.updatedAt})`,
  );
  ok(
    typeof d.slides[0].id === 'string' && d.slides[0].id.length > 0,
    'addSlide: auto-assigns slide id if missing',
  );
}

// addSlide with explicit id is honored
{
  const d = deck.createDeck('test');
  const slide = deck.addSlide(d, { id: 'custom-id', sceneData: { v: 1 } });
  ok(slide.id === 'custom-id', 'addSlide: respects explicit id');
}

// removeSlide
{
  const d = deck.createDeck('test');
  deck.addSlide(d, { id: 'a', sceneData: { v: 1 } });
  deck.addSlide(d, { id: 'b', sceneData: { v: 1 } });
  deck.addSlide(d, { id: 'c', sceneData: { v: 1 } });
  const orig = d.updatedAt;
  const before = Date.now();
  while (Date.now() === before) {}
  deck.removeSlide(d, 'b');
  ok(d.slides.length === 2, 'removeSlide: 2 slides remain');
  ok(
    d.slides.map((s) => s.id).join(',') === 'a,c',
    `removeSlide: order preserved (got ${d.slides.map((s) => s.id).join(',')})`,
  );
  ok(d.updatedAt > orig, 'removeSlide: updatedAt advanced');
}

// removeSlide non-existent id is no-op
{
  const d = deck.createDeck('test');
  deck.addSlide(d, { id: 'x', sceneData: { v: 1 } });
  const orig = d.updatedAt;
  deck.removeSlide(d, 'nonexistent');
  ok(d.slides.length === 1, 'removeSlide: nonexistent id is no-op');
  ok(d.updatedAt === orig, 'removeSlide: no update on no-op');
}

console.log('\nTest group 3: moveSlide');

{
  const d = deck.createDeck('test');
  ['a', 'b', 'c', 'd'].forEach((id) => deck.addSlide(d, { id, sceneData: { v: 1 } }));
  deck.moveSlide(d, 0, 2);
  ok(
    d.slides.map((s) => s.id).join(',') === 'b,c,a,d',
    `moveSlide(0,2): got ${d.slides.map((s) => s.id).join(',')}`,
  );
}

{
  const d = deck.createDeck('test');
  ['a', 'b', 'c', 'd'].forEach((id) => deck.addSlide(d, { id, sceneData: { v: 1 } }));
  deck.moveSlide(d, 3, 0);
  ok(
    d.slides.map((s) => s.id).join(',') === 'd,a,b,c',
    `moveSlide(3,0): got ${d.slides.map((s) => s.id).join(',')}`,
  );
}

// Out-of-bounds is no-op
{
  const d = deck.createDeck('test');
  ['a', 'b'].forEach((id) => deck.addSlide(d, { id, sceneData: { v: 1 } }));
  deck.moveSlide(d, 5, 0);
  ok(d.slides.map((s) => s.id).join(',') === 'a,b', 'moveSlide: out-of-bounds fromIdx is no-op');
  deck.moveSlide(d, 0, 5);
  ok(d.slides.map((s) => s.id).join(',') === 'b,a', 'moveSlide: out-of-bounds toIdx clamps to end');
}

console.log('\nTest group 4: localStorage save/load');

resetStorage();

{
  const d = deck.createDeck('Roundtrip');
  deck.addSlide(d, { id: 'a', sceneData: { v: 1, name: 'A' } });
  deck.saveDeckToStorage(d);
  const loaded = deck.loadDeckFromStorage(d.id);
  ok(loaded !== null, 'loadDeckFromStorage: returns saved deck');
  ok(loaded.title === 'Roundtrip', `loadDeckFromStorage: title preserved (got '${loaded.title}')`);
  ok(
    loaded.slides.length === 1 && loaded.slides[0].id === 'a',
    'loadDeckFromStorage: slides preserved',
  );
}

{
  resetStorage();
  ok(
    deck.loadDeckFromStorage('nonexistent-id') === null,
    'loadDeckFromStorage: nonexistent returns null',
  );
}

{
  resetStorage();
  const d1 = deck.createDeck('old');
  d1.updatedAt = 1000;
  deck.saveDeckToStorage(d1);
  const d2 = deck.createDeck('new');
  d2.updatedAt = 5000;
  deck.saveDeckToStorage(d2);
  const list = deck.listDecks();
  ok(list.length === 2, `listDecks: count 2 (got ${list.length})`);
  ok(
    list[0].title === 'new',
    `listDecks: sorted by updatedAt desc, newest first (got '${list[0].title}')`,
  );
  ok(list[1].title === 'old', 'listDecks: oldest second');
}

{
  resetStorage();
  const d = deck.createDeck('delete-me');
  deck.saveDeckToStorage(d);
  ok(deck.listDecks().length === 1, 'pre-delete: 1 deck');
  const removed = deck.deleteDeckFromStorage(d.id);
  ok(removed === true, 'deleteDeckFromStorage: returns true on success');
  ok(deck.listDecks().length === 0, 'post-delete: 0 decks');
  ok(
    deck.deleteDeckFromStorage('nonexistent') === false,
    'deleteDeckFromStorage: returns false if not found',
  );
}

console.log('\nTest group 5: renameDeck + duplicateDeck');

resetStorage();

{
  const d = deck.createDeck('original');
  deck.saveDeckToStorage(d);
  const before = Date.now();
  while (Date.now() === before) {}
  deck.renameDeck(d.id, 'renamed');
  const loaded = deck.loadDeckFromStorage(d.id);
  ok(loaded.title === 'renamed', `renameDeck: title updated (got '${loaded.title}')`);
  ok(loaded.updatedAt > d.updatedAt, 'renameDeck: updatedAt advanced');
}

{
  resetStorage();
  const d = deck.createDeck('source');
  deck.addSlide(d, { id: 's1', sceneData: { v: 1, name: 'A' } });
  deck.addSlide(d, { id: 's2', sceneData: { v: 1, name: 'B' } });
  deck.saveDeckToStorage(d);
  const dup = deck.duplicateDeck(d.id);
  ok(dup !== null, 'duplicateDeck: returns new deck');
  ok(dup.id !== d.id, 'duplicateDeck: new id assigned');
  ok(
    dup.title === 'source (copy)',
    `duplicateDeck: title gets "(copy)" suffix (got '${dup.title}')`,
  );
  ok(dup.slides.length === 2, 'duplicateDeck: slides copied');
  ok(dup.slides[0].id !== d.slides[0].id, 'duplicateDeck: slide ids reassigned (deep copy)');
  ok(deck.listDecks().length === 2, 'duplicateDeck: storage now has 2 decks');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
