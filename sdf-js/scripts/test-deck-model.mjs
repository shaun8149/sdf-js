// =============================================================================
// test-deck-model.mjs — L1 unit tests for Atlas Present Sprint 1 v4 deck model
// =============================================================================

import * as deck from '../src/present/deck-model.js';

// Mock localStorage
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

console.log('=== deck-model (Sprint 1 v4) smoke test ===\n');

// Constants
ok(deck.DECKS_STORAGE_KEY === 'atlas-decks', 'DECKS_STORAGE_KEY exported');
ok(deck.STORAGE_VERSION === 3, `STORAGE_VERSION = 3 (got ${deck.STORAGE_VERSION})`);

console.log('\nTest group 1: createDeck');

{
  const d = deck.createDeck('My Deck', { type: 'pdf', fileName: 'q1.pdf', pageCount: 5 });
  ok(typeof d.id === 'string' && d.id.length > 0, 'createDeck: id assigned');
  ok(d.title === 'My Deck', 'createDeck: title');
  ok(
    d.source.type === 'pdf' && d.source.fileName === 'q1.pdf' && d.source.pageCount === 5,
    'createDeck: source carried',
  );
  ok(d.layout.archetype === 'linear', 'createDeck: archetype = linear');
  ok(d.layout.spacing === 6, 'createDeck: spacing default = 6');
  ok(Array.isArray(d.sections) && d.sections.length === 0, 'createDeck: sections empty array');
}

{
  const d = deck.createDeck();
  ok(d.title === 'Untitled Deck', 'createDeck: no title defaults');
  ok(d.source.type === 'pdf', 'createDeck: source defaults to pdf');
}

console.log('\nTest group 2: addPendingSections');

{
  const d = deck.createDeck('test', { type: 'pdf', fileName: 'x.pdf', pageCount: 3 });
  const origUpdated = d.updatedAt;
  const before = Date.now();
  while (Date.now() === before) {}
  const added = deck.addPendingSections(d, [
    { slideData: { title: 'A' }, code2d: '// code A', prompt: 'A' },
    { slideData: { title: 'B' }, code2d: '// code B', prompt: 'B' },
    { slideData: { title: 'C' }, code2d: '// code C', prompt: 'C' },
  ]);
  ok(added.length === 3, 'addPendingSections: returns 3 added entries');
  ok(d.sections.length === 3, 'addPendingSections: deck has 3 sections');
  ok(
    d.sections.every((s) => s.status === 'pending'),
    'addPendingSections: all status = pending',
  );
  ok(
    d.sections[0].pageIndex === 0 && d.sections[2].pageIndex === 2,
    'addPendingSections: pageIndex assigned correctly',
  );
  ok(d.updatedAt > origUpdated, 'addPendingSections: updatedAt advanced');
  ok(
    d.sections.every((s) => typeof s.id === 'string' && s.id.length > 0),
    'addPendingSections: section ids assigned',
  );
}

// Subsequent addPendingSections continues pageIndex from where it left off
{
  const d = deck.createDeck('multi');
  deck.addPendingSections(d, [{ slideData: {}, code2d: '' }]);
  deck.addPendingSections(d, [
    { slideData: {}, code2d: '' },
    { slideData: {}, code2d: '' },
  ]);
  ok(d.sections.length === 3, 'addPendingSections: cumulative across calls');
  ok(d.sections[2].pageIndex === 2, 'addPendingSections: pageIndex continues from prior batch');
}

console.log('\nTest group 3: updateSectionStatus');

{
  const d = deck.createDeck('test');
  deck.addPendingSections(d, [{ slideData: {}, code2d: '' }]);
  const sId = d.sections[0].id;
  const origUpdated = d.updatedAt;
  const before = Date.now();
  while (Date.now() === before) {}

  const ok1 = deck.updateSectionStatus(d, sId, 'lifting');
  ok(ok1 === true, 'updateSectionStatus: returns true on success');
  ok(d.sections[0].status === 'lifting', 'updateSectionStatus: status updated');
  ok(d.updatedAt > origUpdated, 'updateSectionStatus: updatedAt advanced');

  const sceneData = {
    v: 1,
    subjects: [{ id: 'a', type: 'cube-3d', args: {}, transform: { translate: [0, 0, 0] } }],
  };
  deck.updateSectionStatus(d, sId, 'ready', {
    sceneData,
    region: {
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      halfWidth: 0.5,
      halfHeight: 0.5,
      halfDepth: 0.5,
      title: 'A',
    },
  });
  ok(d.sections[0].sceneData === sceneData, 'updateSectionStatus: payload merged (sceneData)');
  ok(d.sections[0].region.centerX === 0, 'updateSectionStatus: payload merged (region)');

  deck.updateSectionStatus(d, sId, 'error', { liftError: 'API timeout' });
  ok(d.sections[0].liftError === 'API timeout', 'updateSectionStatus: error payload merged');

  const ok2 = deck.updateSectionStatus(d, 'nonexistent-id', 'ready');
  ok(ok2 === false, 'updateSectionStatus: nonexistent id returns false');
}

console.log('\nTest group 4: sectionStatusCounts');

{
  const d = deck.createDeck('counts');
  deck.addPendingSections(d, [
    { slideData: {}, code2d: '' },
    { slideData: {}, code2d: '' },
    { slideData: {}, code2d: '' },
    { slideData: {}, code2d: '' },
  ]);
  let counts = deck.sectionStatusCounts(d);
  ok(counts.total === 4 && counts.pending === 4, 'sectionStatusCounts: 4 pending');

  deck.updateSectionStatus(d, d.sections[0].id, 'lifting');
  deck.updateSectionStatus(d, d.sections[1].id, 'ready');
  deck.updateSectionStatus(d, d.sections[2].id, 'error', { liftError: 'x' });

  counts = deck.sectionStatusCounts(d);
  ok(
    counts.pending === 1 && counts.lifting === 1 && counts.ready === 1 && counts.error === 1,
    `sectionStatusCounts: mixed (got ${JSON.stringify(counts)})`,
  );
}

console.log('\nTest group 5: localStorage v3 + v1/v2 silent drop');

resetStorage();

{
  const d = deck.createDeck('Roundtrip', { type: 'pdf', fileName: 'r.pdf', pageCount: 2 });
  deck.addPendingSections(d, [
    { slideData: { title: 'A' }, code2d: '// A' },
    { slideData: { title: 'B' }, code2d: '// B' },
  ]);
  deck.saveDeckToStorage(d);
  const loaded = deck.loadDeckFromStorage(d.id);
  ok(loaded !== null, 'roundtrip: load returns deck');
  ok(loaded.title === 'Roundtrip', 'roundtrip: title preserved');
  ok(loaded.sections.length === 2, 'roundtrip: sections preserved');
  ok(loaded.source.fileName === 'r.pdf', 'roundtrip: source preserved');
}

// v1 silent drop
{
  resetStorage();
  localStorage.setItem(
    'atlas-decks',
    JSON.stringify({ version: 1, decks: [{ id: 'v1-deck', slides: [] }] }),
  );
  const list = deck.listDecks();
  ok(list.length === 0, 'v1 silent drop: listDecks empty');
}

// v2 silent drop
{
  resetStorage();
  localStorage.setItem(
    'atlas-decks',
    JSON.stringify({ version: 2, decks: [{ id: 'v2-deck', canvas: {}, waypoints: [] }] }),
  );
  const list = deck.listDecks();
  ok(list.length === 0, 'v2 silent drop: listDecks empty');
}

console.log('\nTest group 6: listDecks sort + delete');

{
  resetStorage();
  const d1 = deck.createDeck('old');
  d1.updatedAt = 1000;
  deck.saveDeckToStorage(d1);
  const d2 = deck.createDeck('new');
  d2.updatedAt = 5000;
  deck.saveDeckToStorage(d2);
  const list = deck.listDecks();
  ok(list[0].title === 'new', 'listDecks: sorted by updatedAt desc');
}

{
  resetStorage();
  const d = deck.createDeck('delete-me');
  deck.saveDeckToStorage(d);
  ok(deck.deleteDeckFromStorage(d.id) === true, 'delete: returns true on success');
  ok(deck.listDecks().length === 0, 'delete: list empty');
  ok(deck.deleteDeckFromStorage('nonexistent') === false, 'delete: nonexistent false');
}

console.log('\nTest group 7: rename + duplicate (re-lift required)');

{
  resetStorage();
  const d = deck.createDeck('original');
  deck.saveDeckToStorage(d);
  const before = Date.now();
  while (Date.now() === before) {}
  deck.renameDeck(d.id, 'renamed');
  ok(deck.loadDeckFromStorage(d.id).title === 'renamed', 'rename: title updated');
}

{
  resetStorage();
  const d = deck.createDeck('source');
  deck.addPendingSections(d, [{ slideData: { title: 'A' }, code2d: '// A' }]);
  // Simulate lift completion
  deck.updateSectionStatus(d, d.sections[0].id, 'ready', {
    sceneData: { v: 1, subjects: [] },
    region: {
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      halfWidth: 0.5,
      halfHeight: 0.5,
      halfDepth: 0.5,
      title: 'A',
    },
  });
  deck.saveDeckToStorage(d);

  const dup = deck.duplicateDeck(d.id);
  ok(dup !== null, 'duplicate: returns new deck');
  ok(dup.title === 'source (copy)', 'duplicate: " (copy)" suffix');
  ok(dup.sections.length === 1, 'duplicate: sections count preserved');
  ok(dup.sections[0].id !== d.sections[0].id, 'duplicate: section ids reassigned');
  ok(dup.sections[0].status === 'pending', 'duplicate: status reset to pending (re-lift required)');
  ok(dup.sections[0].sceneData === undefined, 'duplicate: sceneData stripped (re-lift required)');
  ok(dup.sections[0].region === undefined, 'duplicate: region stripped (re-lift required)');
  ok(dup.sections[0].slideData?.title === 'A', 'duplicate: slideData carried (input preserved)');
  ok(dup.sections[0].code2d === '// A', 'duplicate: code2d carried (input preserved)');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
