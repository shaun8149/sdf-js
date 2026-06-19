// =============================================================================
// test-deck-model.mjs — L1 unit tests for Atlas Present Canvas Mode deck model
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

console.log('=== deck-model (Canvas Mode) smoke test ===\n');

ok(deck.DECKS_STORAGE_KEY === 'atlas-decks', 'DECKS_STORAGE_KEY exported');
ok(deck.STORAGE_VERSION === 2, `STORAGE_VERSION = 2 (got ${deck.STORAGE_VERSION})`);

console.log('\nTest group 1: createDeck');

{
  const d = deck.createDeck('My Deck');
  ok(typeof d.id === 'string' && d.id.length > 0, 'createDeck: id assigned');
  ok(d.title === 'My Deck', 'createDeck: title');
  ok(d.theme && d.theme.renderer === 'studio', 'createDeck: default renderer = studio');
  ok(d.canvas && d.canvas.v === 1, 'createDeck: canvas SceneData v1');
  ok(
    Array.isArray(d.canvas.subjects) && d.canvas.subjects.length === 0,
    'createDeck: empty canvas.subjects',
  );
  ok(Array.isArray(d.waypoints) && d.waypoints.length === 0, 'createDeck: empty waypoints');
  ok(d.tween && d.tween.durationMs === 800, 'createDeck: default tween duration 800ms');
  ok(d.tween.easing === 'ease-in-out', 'createDeck: default easing ease-in-out');
}

{
  const d = deck.createDeck();
  ok(d.title === 'Untitled Deck', 'createDeck: no title defaults');
}

console.log('\nTest group 2: addSubjectToCanvas / removeSubjectFromCanvas');

{
  const d = deck.createDeck('test');
  const origUpdated = d.updatedAt;
  const before = Date.now();
  while (Date.now() === before) {}
  const subj = deck.addSubjectToCanvas(d, {
    type: 'cube-3d',
    args: { count: 4 },
    transform: { translate: [0, 0.5, 0] },
  });
  ok(d.canvas.subjects.length === 1, 'addSubject: canvas has 1 subject');
  ok(subj.type === 'cube-3d', 'addSubject: type carried');
  ok(subj.args.count === 4, 'addSubject: args carried');
  ok(d.updatedAt > origUpdated, 'addSubject: updatedAt advanced');
  ok(typeof subj.id === 'string' && subj.id.length > 0, 'addSubject: auto-assigns id');
}

{
  const d = deck.createDeck('test');
  deck.addSubjectToCanvas(d, { id: 'sub-a', type: 'cube-3d' });
  deck.addSubjectToCanvas(d, { id: 'sub-b', type: 'text-3d-pipe' });
  const removed = deck.removeSubjectFromCanvas(d, 'sub-a');
  ok(removed === true, 'removeSubject: returns true on success');
  ok(d.canvas.subjects.length === 1, 'removeSubject: 1 left');
  ok(d.canvas.subjects[0].id === 'sub-b', 'removeSubject: correct one removed');
  ok(
    deck.removeSubjectFromCanvas(d, 'nonexistent') === false,
    'removeSubject: nonexistent returns false',
  );
}

console.log('\nTest group 3: addWaypoint / removeWaypoint / moveWaypoint');

{
  const d = deck.createDeck('test');
  const cam = { yaw: 0.3, pitch: -0.15, distance: 8, targetX: 0, targetY: 0.5, targetZ: 0 };
  const wp = deck.addWaypoint(d, { title: 'Overview', camera: cam });
  ok(d.waypoints.length === 1, 'addWaypoint: 1 waypoint');
  ok(wp.title === 'Overview', 'addWaypoint: title carried');
  ok(wp.camera.yaw === 0.3, 'addWaypoint: camera carried');
}

{
  const d = deck.createDeck('test');
  ['a', 'b', 'c'].forEach((id) =>
    deck.addWaypoint(d, {
      id,
      camera: { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 },
    }),
  );
  deck.removeWaypoint(d, 'b');
  ok(d.waypoints.map((w) => w.id).join(',') === 'a,c', 'removeWaypoint: order preserved');
}

{
  const d = deck.createDeck('test');
  ['a', 'b', 'c', 'd'].forEach((id) =>
    deck.addWaypoint(d, {
      id,
      camera: { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 },
    }),
  );
  deck.moveWaypoint(d, 0, 2);
  ok(
    d.waypoints.map((w) => w.id).join(',') === 'b,c,a,d',
    `moveWaypoint(0,2): got ${d.waypoints.map((w) => w.id).join(',')}`,
  );
}

console.log('\nTest group 4: updateWaypointCamera');

{
  const d = deck.createDeck('test');
  const wp = deck.addWaypoint(d, {
    id: 'w1',
    camera: { yaw: 0.3, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 },
  });
  const orig = d.updatedAt;
  const before = Date.now();
  while (Date.now() === before) {}
  const newCam = { yaw: 1.5, pitch: -0.2, distance: 10, targetX: 5, targetY: 1, targetZ: -3 };
  const ok1 = deck.updateWaypointCamera(d, 'w1', newCam);
  ok(ok1 === true, 'updateWaypointCamera: returns true');
  ok(wp.camera.yaw === 1.5 && wp.camera.distance === 10, 'updateWaypointCamera: camera replaced');
  ok(d.updatedAt > orig, 'updateWaypointCamera: updatedAt advanced');
  ok(
    deck.updateWaypointCamera(d, 'nonexistent', newCam) === false,
    'updateWaypointCamera: nonexistent returns false',
  );
}

console.log('\nTest group 5: localStorage v2 + v1 silent drop');

resetStorage();

{
  const d = deck.createDeck('Roundtrip');
  deck.addSubjectToCanvas(d, { id: 'c1', type: 'cube-3d' });
  deck.addWaypoint(d, {
    id: 'w1',
    camera: { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 },
  });
  deck.saveDeckToStorage(d);
  const loaded = deck.loadDeckFromStorage(d.id);
  ok(loaded !== null, 'roundtrip: load returns deck');
  ok(loaded.canvas.subjects.length === 1, 'roundtrip: canvas subjects preserved');
  ok(loaded.waypoints.length === 1, 'roundtrip: waypoints preserved');
}

{
  resetStorage();
  // Write fake v1 PPT-mode storage
  localStorage.setItem(
    'atlas-decks',
    JSON.stringify({ version: 1, decks: [{ id: 'old-v1-deck', slides: [] }] }),
  );
  const list = deck.listDecks();
  ok(list.length === 0, `v1 silent drop: listDecks returns empty (got ${list.length})`);
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
  ok(list[0].title === 'new', 'listDecks: sorted by updatedAt desc');
}

{
  resetStorage();
  const d = deck.createDeck('delete-me');
  deck.saveDeckToStorage(d);
  ok(deck.deleteDeckFromStorage(d.id) === true, 'delete: returns true on success');
  ok(deck.listDecks().length === 0, 'delete: list now empty');
  ok(deck.deleteDeckFromStorage('nonexistent') === false, 'delete: nonexistent returns false');
}

console.log('\nTest group 6: rename + duplicate');

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
  deck.addSubjectToCanvas(d, { id: 's1', type: 'cube-3d' });
  deck.addWaypoint(d, {
    id: 'w1',
    camera: { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 },
  });
  deck.saveDeckToStorage(d);
  const dup = deck.duplicateDeck(d.id);
  ok(dup !== null, 'duplicate: returns new deck');
  ok(dup.title === 'source (copy)', 'duplicate: " (copy)" suffix');
  ok(
    dup.canvas.subjects.length === 1 && dup.canvas.subjects[0].id !== 's1',
    'duplicate: subject ids reassigned',
  );
  ok(
    dup.waypoints.length === 1 && dup.waypoints[0].id !== 'w1',
    'duplicate: waypoint ids reassigned',
  );
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
