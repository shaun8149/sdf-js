// =============================================================================
// test-deck-view.mjs — deck-view security regression tests
// =============================================================================

// Mock localStorage before importing the view. The "deck not found" branch only
// needs deck-model storage lookup, so this stays a lightweight Node test.
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

const { mountDeckView } = await import('../src/present/deck-view.js');

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

console.log('=== deck-view security regression tests ===\n');

{
  localStorage.clear();
  const target = { innerHTML: '' };
  const maliciousDeckId = '<img src=x onerror="globalThis.__deckViewXss=1">';

  await mountDeckView(target, maliciousDeckId);

  ok(target.innerHTML.includes('Deck not found:'), 'missing deck renders not-found message');
  ok(
    !target.innerHTML.includes(maliciousDeckId),
    'missing deck id is not injected as raw HTML',
  );
  ok(
    target.innerHTML.includes('&lt;img src=x onerror=&quot;globalThis.__deckViewXss=1&quot;&gt;'),
    'missing deck id is HTML-escaped',
  );
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
