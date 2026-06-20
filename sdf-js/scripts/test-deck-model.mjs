// =============================================================================
// test-deck-model.mjs — L1 unit tests for Atlas Present Sprint 1.5 v4 deck model
//   (variants[VARIANT_COUNT] + selectedVariantIndex + archetype divergence)
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

console.log('=== deck-model (Sprint 1.5 v4 variants) smoke test ===\n');

// Constants
ok(deck.DECKS_STORAGE_KEY === 'atlas-decks', 'DECKS_STORAGE_KEY exported');
ok(deck.STORAGE_VERSION === 4, `STORAGE_VERSION = 4 (got ${deck.STORAGE_VERSION})`);
ok(deck.VARIANT_COUNT === 3, `VARIANT_COUNT = 3 (got ${deck.VARIANT_COUNT})`);

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

console.log('\nTest group 2: addPendingSections + variants shape');

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
    'addPendingSections: all section status = pending',
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

  // v4 variant shape
  const s0 = d.sections[0];
  ok(Array.isArray(s0.variants), 'addPendingSections: section.variants is an array');
  ok(
    s0.variants.length === deck.VARIANT_COUNT,
    `addPendingSections: section has VARIANT_COUNT(${deck.VARIANT_COUNT}) variants`,
  );
  ok(
    s0.variants.every((v) => v.status === 'pending'),
    'addPendingSections: all variants start pending',
  );
  ok(
    s0.variants.every((v) => v.archetype === undefined),
    'addPendingSections: variants start with no archetype (populated by pipeline after lift)',
  );
  ok(
    s0.variants.every(
      (v) => v.sceneData === undefined && v.region === undefined && v.liftError === undefined,
    ),
    'addPendingSections: variants start with no payload fields',
  );
  ok(s0.selectedVariantIndex === 0, 'addPendingSections: selectedVariantIndex defaults to 0');
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

console.log('\nTest group 3: deriveStatus (Sprint 1.5)');

{
  const variants = [{ status: 'pending' }, { status: 'pending' }, { status: 'pending' }];
  ok(deck.deriveStatus(variants) === 'pending', 'deriveStatus: all pending → pending');
}
{
  const variants = [{ status: 'lifting' }, { status: 'pending' }, { status: 'pending' }];
  ok(deck.deriveStatus(variants) === 'lifting', 'deriveStatus: any lifting → lifting');
}
{
  const variants = [{ status: 'ready' }, { status: 'pending' }, { status: 'pending' }];
  ok(deck.deriveStatus(variants) === 'ready', 'deriveStatus: any ready (none lifting) → ready');
}
{
  const variants = [{ status: 'ready' }, { status: 'lifting' }, { status: 'error' }];
  ok(deck.deriveStatus(variants) === 'lifting', 'deriveStatus: lifting trumps ready');
}
{
  const variants = [{ status: 'error' }, { status: 'error' }, { status: 'error' }];
  ok(deck.deriveStatus(variants) === 'error', 'deriveStatus: all error → error');
}
{
  const variants = [{ status: 'error' }, { status: 'error' }, { status: 'ready' }];
  ok(deck.deriveStatus(variants) === 'ready', 'deriveStatus: some error + some ready → ready');
}
{
  const variants = [{ status: 'pending' }, { status: 'error' }, { status: 'error' }];
  ok(
    deck.deriveStatus(variants) === 'pending',
    'deriveStatus: pending+error mix → pending (not all error)',
  );
}

console.log('\nTest group 4: updateVariantStatus (Sprint 1.5)');

{
  const d = deck.createDeck('test');
  deck.addPendingSections(d, [{ slideData: {}, code2d: '' }]);
  const sId = d.sections[0].id;
  const origUpdated = d.updatedAt;
  const before = Date.now();
  while (Date.now() === before) {}

  const r1 = deck.updateVariantStatus(d, sId, 0, 'lifting');
  ok(r1 === true, 'updateVariantStatus: returns true on success');
  ok(
    d.sections[0].variants[0].status === 'lifting',
    'updateVariantStatus: variant 0 status = lifting',
  );
  ok(d.sections[0].status === 'lifting', 'updateVariantStatus: section status derived = lifting');
  ok(d.updatedAt > origUpdated, 'updateVariantStatus: updatedAt advanced');

  const sceneData = {
    v: 1,
    name: 'sequence: Test Slide',
    subjects: [{ id: 'a', type: 'cube-3d', args: {}, transform: { translate: [0, 0, 0] } }],
  };
  deck.updateVariantStatus(d, sId, 0, 'ready', {
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
    archetype: 'sequence',
  });
  ok(
    d.sections[0].variants[0].sceneData === sceneData,
    'updateVariantStatus: sceneData merged into variant',
  );
  ok(
    d.sections[0].variants[0].region.centerX === 0,
    'updateVariantStatus: region merged into variant',
  );
  ok(
    d.sections[0].variants[0].archetype === 'sequence',
    'updateVariantStatus: archetype merged into variant',
  );
  ok(d.sections[0].status === 'ready', 'updateVariantStatus: section status = ready (derived)');

  deck.updateVariantStatus(d, sId, 1, 'error', { liftError: 'API timeout' });
  ok(
    d.sections[0].variants[1].liftError === 'API timeout',
    'updateVariantStatus: liftError merged into variant 1',
  );
  ok(
    d.sections[0].status === 'ready',
    'updateVariantStatus: section still ready (variant 0 ready)',
  );

  const bad1 = deck.updateVariantStatus(d, sId, 99, 'ready');
  ok(bad1 === false, 'updateVariantStatus: out-of-range variantIndex returns false');

  const bad2 = deck.updateVariantStatus(d, sId, -1, 'ready');
  ok(bad2 === false, 'updateVariantStatus: negative variantIndex returns false');

  const bad3 = deck.updateVariantStatus(d, 'nonexistent-id', 0, 'ready');
  ok(bad3 === false, 'updateVariantStatus: nonexistent sectionId returns false');
}

console.log('\nTest group 5: selectVariant (Sprint 1.5)');

{
  const d = deck.createDeck('test');
  deck.addPendingSections(d, [{ slideData: {}, code2d: '' }]);
  const sId = d.sections[0].id;

  const r1 = deck.selectVariant(d, sId, 2);
  ok(r1 === true, 'selectVariant: returns true on success');
  ok(d.sections[0].selectedVariantIndex === 2, 'selectVariant: selectedVariantIndex updated to 2');

  const bad1 = deck.selectVariant(d, sId, 99);
  ok(bad1 === false, 'selectVariant: out-of-range index rejected');
  ok(
    d.sections[0].selectedVariantIndex === 2,
    'selectVariant: index unchanged after rejected select',
  );

  const bad2 = deck.selectVariant(d, sId, -1);
  ok(bad2 === false, 'selectVariant: negative index rejected');

  const bad3 = deck.selectVariant(d, 'nonexistent-id', 0);
  ok(bad3 === false, 'selectVariant: nonexistent sectionId returns false');
}

console.log('\nTest group 6: getSelectedVariant (Sprint 1.5)');

{
  const d = deck.createDeck('test');
  deck.addPendingSections(d, [{ slideData: {}, code2d: '' }]);
  const section = d.sections[0];

  const v = deck.getSelectedVariant(section);
  ok(v !== null, 'getSelectedVariant: returns non-null');
  ok(v === section.variants[0], 'getSelectedVariant: default returns variant at index 0');
  ok(v.status === 'pending', 'getSelectedVariant: default variant status pending');

  deck.selectVariant(d, section.id, 2);
  const v2 = deck.getSelectedVariant(section);
  ok(
    v2 === section.variants[2],
    'getSelectedVariant: after select, tracks selectedVariantIndex by reference',
  );

  ok(deck.getSelectedVariant(null) === null, 'getSelectedVariant: null section returns null');
  ok(
    deck.getSelectedVariant({}) === null,
    'getSelectedVariant: corrupt section (no variants) returns null',
  );
  ok(
    deck.getSelectedVariant({ variants: [] }) === null,
    'getSelectedVariant: empty variants array returns null',
  );
}

console.log('\nTest group 7: deprecated updateSectionStatus wrapper');

{
  const d = deck.createDeck('test');
  deck.addPendingSections(d, [{ slideData: {}, code2d: '' }]);
  const sId = d.sections[0].id;

  const r = deck.updateSectionStatus(d, sId, 'lifting');
  ok(r === true, 'updateSectionStatus (deprecated): returns true');
  ok(d.sections[0].variants[0].status === 'lifting', 'updateSectionStatus: updates variants[0]');
  ok(d.sections[0].status === 'lifting', 'updateSectionStatus: section status derived');

  deck.updateSectionStatus(d, sId, 'ready', {
    sceneData: { v: 1, name: 'kpi-hero: 42', subjects: [] },
    region: { centerX: 0, centerY: 0, centerZ: 0, halfWidth: 0.5, halfHeight: 0.5, halfDepth: 0.5 },
  });
  ok(
    d.sections[0].variants[0].sceneData?.name === 'kpi-hero: 42',
    'updateSectionStatus: payload merged to variants[0]',
  );

  ok(
    deck.updateSectionStatus(d, 'nonexistent', 'ready') === false,
    'updateSectionStatus: nonexistent id false',
  );
}

console.log('\nTest group 8: sectionStatusCounts');

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

  // Drive section status via derived rules: lifting any variant → section lifting
  deck.updateVariantStatus(d, d.sections[0].id, 0, 'lifting');
  // Section ready: all 3 variants ready (or at least one ready, none lifting)
  deck.updateVariantStatus(d, d.sections[1].id, 0, 'ready', {
    sceneData: { v: 1, subjects: [] },
  });
  // Section error: all 3 variants error
  deck.updateVariantStatus(d, d.sections[2].id, 0, 'error', { liftError: 'x' });
  deck.updateVariantStatus(d, d.sections[2].id, 1, 'error', { liftError: 'x' });
  deck.updateVariantStatus(d, d.sections[2].id, 2, 'error', { liftError: 'x' });

  counts = deck.sectionStatusCounts(d);
  ok(
    counts.pending === 1 && counts.lifting === 1 && counts.ready === 1 && counts.error === 1,
    `sectionStatusCounts: mixed (got ${JSON.stringify(counts)})`,
  );
}

console.log('\nTest group 9: localStorage v4 + v1/v2/v3 silent drop');

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
  ok(
    Array.isArray(loaded.sections[0].variants) &&
      loaded.sections[0].variants.length === deck.VARIANT_COUNT,
    'roundtrip: variants preserved',
  );
  ok(loaded.sections[0].selectedVariantIndex === 0, 'roundtrip: selectedVariantIndex preserved');
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
    JSON.stringify({ version: 2, decks: [{ id: 'v2-deck', canvas: {} }] }),
  );
  const list = deck.listDecks();
  ok(list.length === 0, 'v2 silent drop: listDecks empty');
}

// v3 silent drop (Sprint 1.5 schema bump — Sprint 1 v4 flat shape dropped)
{
  resetStorage();
  localStorage.setItem(
    'atlas-decks',
    JSON.stringify({
      version: 3,
      decks: [{ id: 'v3-deck', title: 'old', sections: [{ id: 's1', status: 'ready' }] }],
    }),
  );
  const list = deck.listDecks();
  ok(list.length === 0, 'v3 silent drop: listDecks empty (Sprint 1.5 spec lock)');

  const migrated = deck.migrateDecksStorage({ version: 3, decks: [{ id: 'old' }] });
  ok(migrated.version === 4, 'v3 raw → version 4');
  ok(migrated.decks.length === 0, 'v3 decks dropped');
}

console.log('\nTest group 10: listDecks sort + delete');

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

console.log('\nTest group 11: rename + duplicate (re-lift required)');

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
  // Simulate lift completion on variant 0
  deck.updateVariantStatus(d, d.sections[0].id, 0, 'ready', {
    sceneData: { v: 1, name: 'sequence: A', subjects: [] },
    region: {
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      halfWidth: 0.5,
      halfHeight: 0.5,
      halfDepth: 0.5,
      title: 'A',
    },
    archetype: 'sequence',
  });
  deck.saveDeckToStorage(d);

  const dup = deck.duplicateDeck(d.id);
  ok(dup !== null, 'duplicate: returns new deck');
  ok(dup.title === 'source (copy)', 'duplicate: " (copy)" suffix');
  ok(dup.sections.length === 1, 'duplicate: sections count preserved');
  ok(dup.sections[0].id !== d.sections[0].id, 'duplicate: section ids reassigned');
  ok(dup.sections[0].status === 'pending', 'duplicate: section status reset to pending');
  ok(
    Array.isArray(dup.sections[0].variants) &&
      dup.sections[0].variants.length === deck.VARIANT_COUNT,
    'duplicate: fresh variants array',
  );
  ok(
    dup.sections[0].variants.every((v) => v.status === 'pending'),
    'duplicate: all variants reset to pending',
  );
  ok(
    dup.sections[0].variants.every(
      (v) => v.sceneData === undefined && v.region === undefined && v.archetype === undefined,
    ),
    'duplicate: variant payload stripped (re-lift required)',
  );
  ok(dup.sections[0].selectedVariantIndex === 0, 'duplicate: selectedVariantIndex reset to 0');
  ok(dup.sections[0].slideData?.title === 'A', 'duplicate: slideData carried (input preserved)');
  ok(dup.sections[0].code2d === '// A', 'duplicate: code2d carried (input preserved)');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
