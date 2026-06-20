// =============================================================================
// test-deck-model.mjs — L1 unit tests for Atlas Present Sprint 2 deck-model v5
// =============================================================================

import {
  STORAGE_VERSION,
  VARIANT_COUNT,
  ACTIVE_EFFECTS,
  DEFAULT_EFFECT,
  DEFAULT_BRANDING,
  deriveStatus,
  createDeck,
  setDocument,
  addVisual,
  removeVisual,
  updateVisualVariantStatus,
  selectVisualVariant,
  getSelectedVisualVariant,
  setActiveEffect,
  setActiveBranding,
  migrateDecksStorage,
  saveDeckToStorage,
  loadDeckFromStorage,
  listDecks,
  deleteDeckFromStorage,
  renameDeck,
  duplicateDeck,
  DECKS_STORAGE_KEY,
} from '../src/present/deck-model.js';

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

console.log('=== deck-model v5 (Sprint 2) smoke test ===\n');

console.log('Constants');
ok(STORAGE_VERSION === 5, `STORAGE_VERSION = 5 (got ${STORAGE_VERSION})`);
ok(VARIANT_COUNT === 6, `VARIANT_COUNT = 6 (got ${VARIANT_COUNT})`);
ok(Array.isArray(ACTIVE_EFFECTS) && ACTIVE_EFFECTS.length === 4, `ACTIVE_EFFECTS has 4 entries`);
ok(
  ACTIVE_EFFECTS.includes('silhouette') &&
    ACTIVE_EFFECTS.includes('lines') &&
    ACTIVE_EFFECTS.includes('crayon') &&
    ACTIVE_EFFECTS.includes('topo'),
  `ACTIVE_EFFECTS = [silhouette, lines, crayon, topo]`,
);
ok(DEFAULT_EFFECT === 'silhouette', `DEFAULT_EFFECT = silhouette`);
ok(
  typeof DEFAULT_BRANDING === 'string' && DEFAULT_BRANDING.length > 0,
  `DEFAULT_BRANDING exported`,
);

console.log('\nTest group 1: createDeck (empty deck, no document, no visuals)');
{
  const d = createDeck('My Deck', { type: 'pdf', fileName: 'x.pdf', pageCount: 3 });
  ok(typeof d.id === 'string' && d.id.length > 0, 'createDeck: id assigned');
  ok(d.title === 'My Deck', 'createDeck: title');
  ok(d.source.fileName === 'x.pdf', 'createDeck: source carried');
  ok(d.document === null, 'createDeck: document = null initially');
  ok(Array.isArray(d.visuals) && d.visuals.length === 0, 'createDeck: visuals = []');
}

console.log('\nTest group 2: setDocument');
{
  const d = createDeck('test');
  const origUpdated = d.updatedAt;
  while (Date.now() === origUpdated) {}
  const doc = {
    flowingText: 'Hello world',
    pages: [{ startOffset: 0, endOffset: 11, pageNumber: 1 }],
    headings: [],
  };
  setDocument(d, doc);
  ok(d.document === doc, 'setDocument: document stored');
  ok(d.updatedAt > origUpdated, 'setDocument: updatedAt advanced');
}

console.log('\nTest group 3: addVisual');
{
  const d = createDeck('test');
  setDocument(d, {
    flowingText: 'hello world',
    pages: [{ startOffset: 0, endOffset: 11, pageNumber: 1 }],
    headings: [],
  });
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  ok(typeof v.id === 'string' && v.id.length > 0, 'addVisual: id assigned');
  ok(v.textAnchor.text === 'hello', 'addVisual: textAnchor.text stored');
  ok(
    v.textAnchor.startOffset === 0 && v.textAnchor.endOffset === 5,
    'addVisual: textAnchor offsets stored',
  );
  ok(
    Array.isArray(v.variants) && v.variants.length === VARIANT_COUNT,
    `addVisual: ${VARIANT_COUNT} variants`,
  );
  ok(
    v.variants.every((vt) => vt.status === 'pending'),
    'addVisual: all variants pending',
  );
  ok(v.selectedVariantIndex === 0, 'addVisual: selectedVariantIndex = 0');
  ok(v.activeEffect === DEFAULT_EFFECT, `addVisual: activeEffect = ${DEFAULT_EFFECT}`);
  ok(v.activeBranding === DEFAULT_BRANDING, `addVisual: activeBranding = ${DEFAULT_BRANDING}`);
  ok(v.status === 'pending', 'addVisual: visual.status = pending');
  ok(d.visuals.length === 1, 'addVisual: deck.visuals has 1 entry');
}

console.log('\nTest group 4: removeVisual');
{
  const d = createDeck('test');
  const v1 = addVisual(d, { startOffset: 0, endOffset: 1, text: 'a' });
  const v2 = addVisual(d, { startOffset: 1, endOffset: 2, text: 'b' });
  ok(d.visuals.length === 2, 'removeVisual: setup 2 visuals');
  const removed = removeVisual(d, v1.id);
  ok(removed === true, 'removeVisual: returns true on success');
  ok(d.visuals.length === 1, 'removeVisual: deck has 1 visual now');
  ok(d.visuals[0].id === v2.id, 'removeVisual: correct visual removed');
  const removedAgain = removeVisual(d, v1.id);
  ok(removedAgain === false, 'removeVisual: returns false if not found');
}

console.log('\nTest group 5: deriveStatus');
{
  ok(
    deriveStatus([{ status: 'pending' }, { status: 'pending' }]) === 'pending',
    'all pending → pending',
  );
  ok(
    deriveStatus([{ status: 'lifting' }, { status: 'pending' }]) === 'lifting',
    'any lifting → lifting',
  );
  ok(
    deriveStatus([{ status: 'ready' }, { status: 'pending' }]) === 'ready',
    'any ready (none lifting) → ready',
  );
  ok(
    deriveStatus([{ status: 'ready' }, { status: 'lifting' }]) === 'lifting',
    'lifting trumps ready',
  );
  ok(deriveStatus([{ status: 'error' }, { status: 'error' }]) === 'error', 'all error → error');
  ok(
    deriveStatus([{ status: 'error' }, { status: 'ready' }]) === 'ready',
    'some error + some ready → ready',
  );
}

console.log('\nTest group 6: updateVisualVariantStatus');
{
  const d = createDeck('test');
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  const r1 = updateVisualVariantStatus(d, v.id, 0, 'lifting');
  ok(r1 === true, 'updateVisualVariantStatus: returns true');
  ok(v.variants[0].status === 'lifting', 'variant 0 status = lifting');
  ok(v.status === 'lifting', 'visual status derived = lifting');

  updateVisualVariantStatus(d, v.id, 0, 'ready', {
    sceneData: { v: 1, name: 'sequence: hello', subjects: [] },
    archetype: 'sequence',
  });
  ok(v.variants[0].sceneData !== undefined, 'payload sceneData merged');
  ok(v.variants[0].archetype === 'sequence', 'payload archetype merged');
  ok(v.status === 'ready', 'visual status derived to ready (1 of 6 ready)');

  updateVisualVariantStatus(d, v.id, 1, 'error', { liftError: 'mock error' });
  ok(v.variants[1].liftError === 'mock error', 'payload liftError merged');

  const r2 = updateVisualVariantStatus(d, v.id, 99, 'ready');
  ok(r2 === false, 'invalid variantIndex returns false');
  const r3 = updateVisualVariantStatus(d, 'nonexistent', 0, 'ready');
  ok(r3 === false, 'invalid visualId returns false');
}

console.log('\nTest group 7: selectVisualVariant + getSelectedVisualVariant');
{
  const d = createDeck('test');
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  const sel0 = getSelectedVisualVariant(v);
  ok(sel0 === v.variants[0], 'getSelectedVisualVariant: default returns variants[0]');

  const r = selectVisualVariant(d, v.id, 3);
  ok(r === true, 'selectVisualVariant returns true');
  ok(v.selectedVariantIndex === 3, 'selectedVariantIndex = 3');
  const sel3 = getSelectedVisualVariant(v);
  ok(sel3 === v.variants[3], 'getSelectedVisualVariant: now returns variants[3]');

  const rBad = selectVisualVariant(d, v.id, 99);
  ok(rBad === false, 'selectVisualVariant out-of-range returns false');
  ok(v.selectedVariantIndex === 3, 'selectedVariantIndex unchanged after rejected select');

  const corrupt = getSelectedVisualVariant({});
  ok(corrupt === null, 'getSelectedVisualVariant: corrupt input returns null');
}

console.log('\nTest group 8: setActiveEffect');
{
  const d = createDeck('test');
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  ok(setActiveEffect(d, v.id, 'lines') === true, 'setActiveEffect lines OK');
  ok(v.activeEffect === 'lines', 'activeEffect = lines');
  ok(setActiveEffect(d, v.id, 'crayon') === true, 'setActiveEffect crayon OK');
  ok(
    setActiveEffect(d, v.id, 'invalid-renderer') === false,
    'setActiveEffect invalid renderer returns false',
  );
  ok(v.activeEffect === 'crayon', 'activeEffect still crayon after rejected set');
  ok(
    setActiveEffect(d, 'nonexistent-visual', 'lines') === false,
    'setActiveEffect bad visualId returns false',
  );
}

console.log('\nTest group 9: setActiveBranding');
{
  const d = createDeck('test');
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  ok(setActiveBranding(d, v.id, 'mono-dark') === true, 'setActiveBranding accepts any string id');
  ok(v.activeBranding === 'mono-dark', 'activeBranding updated');
  ok(
    setActiveBranding(d, 'nonexistent-visual', 'mono-dark') === false,
    'setActiveBranding bad visualId returns false',
  );
}

console.log('\nTest group 10: localStorage v5 roundtrip + silent drops');

resetStorage();
{
  const d = createDeck('Roundtrip', { type: 'pdf', fileName: 'r.pdf', pageCount: 1 });
  setDocument(d, {
    flowingText: 'sample text here',
    pages: [{ startOffset: 0, endOffset: 16, pageNumber: 1 }],
    headings: [],
  });
  const v = addVisual(d, { startOffset: 0, endOffset: 6, text: 'sample' });
  updateVisualVariantStatus(d, v.id, 0, 'ready', {
    sceneData: { v: 1, name: 'list: sample', subjects: [] },
    archetype: 'list',
  });
  saveDeckToStorage(d);
  const loaded = loadDeckFromStorage(d.id);
  ok(loaded !== null, 'roundtrip: load returns deck');
  ok(loaded.title === 'Roundtrip', 'roundtrip: title preserved');
  ok(
    loaded.document.flowingText === 'sample text here',
    'roundtrip: document.flowingText preserved',
  );
  ok(loaded.visuals.length === 1, 'roundtrip: 1 visual preserved');
  ok(loaded.visuals[0].variants[0].archetype === 'list', 'roundtrip: variant archetype preserved');
}

// v1/v2/v3/v4 all silent dropped
for (const oldVersion of [1, 2, 3, 4]) {
  resetStorage();
  localStorage.setItem(
    'atlas-decks',
    JSON.stringify({ version: oldVersion, decks: [{ id: 'old', title: `v${oldVersion} deck` }] }),
  );
  const list = listDecks();
  ok(list.length === 0, `v${oldVersion} silent drop: listDecks empty`);
}

console.log('\nTest group 11: listDecks sort + delete + rename + duplicate');

{
  resetStorage();
  const d1 = createDeck('old');
  d1.updatedAt = 1000;
  saveDeckToStorage(d1);
  const d2 = createDeck('new');
  d2.updatedAt = 5000;
  saveDeckToStorage(d2);
  const list = listDecks();
  ok(list[0].title === 'new', 'listDecks: sorted by updatedAt desc');
}

{
  resetStorage();
  const d = createDeck('delete-me');
  saveDeckToStorage(d);
  ok(deleteDeckFromStorage(d.id) === true, 'delete: returns true');
  ok(listDecks().length === 0, 'delete: list empty');
  ok(deleteDeckFromStorage('nonexistent') === false, 'delete: nonexistent returns false');
}

{
  resetStorage();
  const d = createDeck('original');
  saveDeckToStorage(d);
  renameDeck(d.id, 'renamed');
  ok(loadDeckFromStorage(d.id).title === 'renamed', 'rename: title updated');
}

{
  resetStorage();
  const d = createDeck('source');
  setDocument(d, {
    flowingText: 'shared text',
    pages: [{ startOffset: 0, endOffset: 11, pageNumber: 1 }],
    headings: [],
  });
  const v = addVisual(d, { startOffset: 0, endOffset: 6, text: 'shared' });
  updateVisualVariantStatus(d, v.id, 0, 'ready', {
    sceneData: { v: 1, subjects: [] },
    archetype: 'list',
  });
  saveDeckToStorage(d);

  const dup = duplicateDeck(d.id);
  ok(dup !== null, 'duplicate: returns new deck');
  ok(dup.title === 'source (copy)', 'duplicate: " (copy)" suffix');
  ok(
    dup.document !== null && dup.document.flowingText === 'shared text',
    'duplicate: document preserved',
  );
  ok(dup.visuals.length === 0, 'duplicate: visuals dropped (user re-generates)');
  ok(dup.id !== d.id, 'duplicate: new id');
}

console.log(
  '\nTest group 12: p5-sketch subject in addVisual + updateVisualVariantStatus (Sprint 3)',
);

{
  resetStorage();
  const d = createDeck('p5-deck', { type: 'pdf', fileName: 'p.pdf', pageCount: 1 });
  setDocument(d, {
    flowingText: 'sample',
    pages: [{ startOffset: 0, endOffset: 6, pageNumber: 1 }],
    headings: [],
  });
  const v = addVisual(d, { startOffset: 0, endOffset: 6, text: 'sample' });

  // updateVisualVariantStatus accepts SceneData with p5-sketch subject
  const p5SceneData = {
    v: 1,
    name: 'text-card: Sample',
    subjects: [
      {
        id: 'sk-0',
        type: 'p5-sketch',
        args: {
          code: 'function setup(){createCanvas(600,360);}function draw(){background(255);}',
        },
      },
    ],
  };
  const r = updateVisualVariantStatus(d, v.id, 0, 'ready', {
    sceneData: p5SceneData,
    archetype: 'text-card',
  });
  ok(r === true, 'updateVisualVariantStatus accepts p5-sketch sceneData');
  ok(v.variants[0].sceneData.subjects[0].type === 'p5-sketch', 'p5-sketch subject stored');
  ok(typeof v.variants[0].sceneData.subjects[0].args.code === 'string', 'args.code preserved');

  // saveDeckToStorage + loadDeckFromStorage roundtrip preserves p5-sketch
  saveDeckToStorage(d);
  const loaded = loadDeckFromStorage(d.id);
  ok(
    loaded.visuals[0].variants[0].sceneData.subjects[0].type === 'p5-sketch',
    'p5-sketch survives storage roundtrip',
  );
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
