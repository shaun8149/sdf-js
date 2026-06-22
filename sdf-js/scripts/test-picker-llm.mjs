// =============================================================================
// test-picker-llm.mjs — Sprint 16 v2 smoke test for picker-llm.js
// -----------------------------------------------------------------------------
// Stubs globalThis.fetch so no real Anthropic call is made. Exercises:
//   - Happy path: LLM returns valid JSON → result.method='llm' + scaffold found
//   - Unknown scaffoldId → fallback to v1
//   - HTTP error → fallback to v1
//   - Network throw → fallback to v1
//   - No apiKey → fallback to v1
//   - Theme hint honored
// =============================================================================

import { pickScaffoldLLM } from '../src/present/scaffolds/picker-llm.js';

let pass = 0;
let fail = 0;
const originalFetch = globalThis.fetch;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

function mockFetch(responseBody, status = 200) {
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () =>
      typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
    json: async () => (typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody),
  });
}

function mockFetchThrows(message) {
  globalThis.fetch = async () => {
    throw new Error(message);
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

console.log('=== picker-llm smoke ===\n');

console.log('--- happy path: LLM picks pitch-deck-vc ---');
{
  mockFetch({
    content: [
      {
        text: '```json\n{"scaffoldId":"pitch-deck-vc","confidence":8,"reasoning":["Mentions Series A","TAM included","Has ask slot"]}\n```',
      },
    ],
    usage: { input_tokens: 1000, output_tokens: 50 },
  });
  const r = await pickScaffoldLLM(
    { title: 'Series A pitch', bodyTexts: ['Problem', 'TAM', 'Solution', 'Ask'] },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.scaffold.id === 'pitch-deck-vc', `scaffold=pitch-deck-vc (got ${r.scaffold.id})`);
  ok(r.method === 'llm', `method=llm (got ${r.method})`);
  ok(r.score === 8, `score=8 (got ${r.score})`);
  ok(r.signals.length === 3, `3 reasoning signals (got ${r.signals.length})`);
  ok(!r.fallback, 'not fallback');
  ok(r.theme && r.theme.id, `theme resolved (got ${r.theme?.id})`);
  restoreFetch();
}

console.log('\n--- theme hint honored ---');
{
  mockFetch({
    content: [
      {
        text: '{"scaffoldId":"pitch-deck-vc","confidence":7,"reasoning":["fit"],"themeHint":"pitch-charcoal-yellow"}',
      },
    ],
    usage: {},
  });
  const r = await pickScaffoldLLM(
    { title: 'Pitch', bodyTexts: ['x'] },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.theme.id === 'pitch-charcoal-yellow', `themeHint honored (got ${r.theme.id})`);
  restoreFetch();
}

console.log('\n--- ignores invalid theme hint, falls back to top affinity ---');
{
  mockFetch({
    content: [
      {
        text: '{"scaffoldId":"pitch-deck-vc","confidence":7,"reasoning":["fit"],"themeHint":"nonexistent-theme"}',
      },
    ],
    usage: {},
  });
  const r = await pickScaffoldLLM(
    { title: 'Pitch', bodyTexts: ['x'] },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.theme.id === 'pitch-cobalt-orange', `invalid themeHint → top affinity (got ${r.theme.id})`);
  restoreFetch();
}

console.log('\n--- unknown scaffoldId → fallback to v1 ---');
{
  mockFetch({
    content: [{ text: '{"scaffoldId":"made-up-deck","confidence":5,"reasoning":["x"]}' }],
    usage: {},
  });
  const r = await pickScaffoldLLM(
    { title: 'Mystery', bodyTexts: ['nothing'] },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.fallback === true, 'fallback=true');
  ok(r.method === 'fallback', `method=fallback (got ${r.method})`);
  ok(
    r.signals.some((s) => s.includes('unknown-id')),
    `signals include unknown-id (got ${r.signals.join(', ')})`,
  );
  restoreFetch();
}

console.log('\n--- HTTP 500 → fallback ---');
{
  mockFetch('Internal server error', 500);
  const r = await pickScaffoldLLM(
    { title: 'Q3 review', bodyTexts: ['kpi', 'wins'] },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.fallback === true, 'fallback=true on HTTP 500');
  ok(
    r.signals.some((s) => s.includes('http-500')),
    'signals include http-500',
  );
  // Should still resolve to a scaffold (v1 fallback)
  ok(r.scaffold && r.scaffold.id, `still has scaffold (${r.scaffold?.id})`);
  restoreFetch();
}

console.log('\n--- network throw → fallback ---');
{
  mockFetchThrows('ECONNREFUSED');
  const r = await pickScaffoldLLM(
    { title: 'Test', bodyTexts: ['x'] },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.fallback === true, 'fallback on network throw');
  ok(
    r.signals.some((s) => s.includes('ECONNREFUSED')),
    'reason captured in signals',
  );
  restoreFetch();
}

console.log('\n--- parse-failed → fallback ---');
{
  mockFetch({
    content: [{ text: 'I cannot answer this question.' }],
    usage: {},
  });
  const r = await pickScaffoldLLM(
    { title: 'x', bodyTexts: ['y'] },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.fallback === true, 'fallback on parse failure');
  ok(
    r.signals.some((s) => s.includes('parse-failed')),
    'reason captured',
  );
  restoreFetch();
}

console.log('\n--- no apiKey + fallbackToV1=true → fallback (no throw) ---');
{
  const r = await pickScaffoldLLM(
    { title: 'Series A', bodyTexts: ['Problem', 'TAM'] },
    { fallbackToV1: true, log: () => {} },
  );
  ok(r.fallback === true, 'fallback when no apiKey');
  ok(
    r.signals.some((s) => s.includes('no-api-key')),
    'reason captured',
  );
}

console.log('\n--- no apiKey + fallbackToV1=false → throws ---');
{
  let threw = false;
  try {
    await pickScaffoldLLM({ title: 'x', bodyTexts: ['y'] }, { fallbackToV1: false, log: () => {} });
  } catch {
    threw = true;
  }
  ok(threw === true, 'throws when fallbackToV1=false + no apiKey');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
