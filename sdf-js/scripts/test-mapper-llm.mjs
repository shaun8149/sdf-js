// =============================================================================
// test-mapper-llm.mjs — Sprint 18 Tier 2 B smoke test for mapper-llm.js
// -----------------------------------------------------------------------------
// Stubs globalThis.fetch so no real Anthropic call is made. Exercises:
//   - Happy path: 5 slides + 5 slots → all match
//   - Fewer slides than slots → some -1 entries
//   - More slides than slots → 1:1 best match
//   - HTTP error → fallback to heuristic
//   - Parse error (non-JSON) → fallback
//   - Validation error (length mismatch) → fallback
//   - Validation error (slotIdx mismatch) → fallback
//   - Validation error (slideIdx out of range) → fallback
//   - No apiKey + fallbackToHeuristic: true → fallback (no throw)
//   - No apiKey + fallbackToHeuristic: false → throws
// =============================================================================

import { mapSlidesToSlotsLLM, scoreSlideForSlot } from '../src/present/scaffolds/mapper-llm.js';

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SLIDES_5 = [
  { title: 'ANTFUN', body: ['On-Chain Trading Super App', 'Company Overview', '2026-Q3'] },
  { title: 'Our Mission', body: ['Make on-chain trading as natural as messaging'] },
  { title: 'Market Opportunity', body: ['$2T addressable market', '500M crypto users by 2027'] },
  { title: 'Product', body: ['Mobile-first wallet', 'AI co-pilot', 'Cross-chain liquidity'] },
  { title: 'Team', body: ['Ex-Binance + ex-Coinbase engineers', 'Backed by Sequoia, Paradigm'] },
];

const SCAFFOLD_5 = {
  slots: [
    { name: 'cover', title: 'Cover', purpose: 'Company name and tagline, deck title' },
    { name: 'mission', title: 'Mission', purpose: 'Why we exist, core mission statement' },
    { name: 'market', title: 'Market', purpose: 'Market size and opportunity' },
    { name: 'product', title: 'Product', purpose: 'Product features and capabilities' },
    { name: 'team', title: 'Team', purpose: 'Team background and credentials' },
  ],
};

// LLM response helper — build valid assignments array
function makeAssignments(pairs) {
  // pairs: [[slotIdx, slideIdx, conf, reason], ...]
  return {
    content: [
      {
        text: JSON.stringify({
          assignments: pairs.map(([slotIdx, slideIdx, confidence, reason]) => ({
            slotIdx,
            slideIdx,
            confidence,
            reason,
          })),
        }),
      },
    ],
    usage: { input_tokens: 500, output_tokens: 120 },
  };
}

console.log('=== mapper-llm smoke ===\n');

// ---------------------------------------------------------------------------
console.log('--- happy path: 5 slides → 5 slots, all match ---');
{
  mockFetch(
    makeAssignments([
      [0, 0, 10, 'Title slide is the cover'],
      [1, 1, 9, 'Mission slide → mission slot'],
      [2, 2, 9, 'Market slide → market slot'],
      [3, 3, 8, 'Product slide → product slot'],
      [4, 4, 9, 'Team slide → team slot'],
    ]),
  );
  const r = await mapSlidesToSlotsLLM(
    { slides: SLIDES_5, scaffold: SCAFFOLD_5 },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.method === 'llm', `method=llm (got ${r.method})`);
  ok(r.assignments.length === 5, `5 assignments (got ${r.assignments.length})`);
  ok(r.assignments[0].slotName === 'cover', `slot 0 = cover (got ${r.assignments[0].slotName})`);
  ok(r.assignments[0].slideIdx === 0, `slot 0 → slide 0 (got ${r.assignments[0].slideIdx})`);
  ok(
    r.assignments[0].sourceTitle === 'ANTFUN',
    `sourceTitle resolved (got ${r.assignments[0].sourceTitle})`,
  );
  ok(r.assignments[0].confidence === 10, `confidence=10 (got ${r.assignments[0].confidence})`);
  ok(r.cost.usdEstimate >= 0, `cost.usdEstimate is a number (got ${r.cost.usdEstimate})`);
  ok(typeof r.cost.tokens === 'object', 'cost.tokens is object');
  restoreFetch();
}

// ---------------------------------------------------------------------------
console.log('\n--- fewer slides than slots: 3 slides, 5 slots → some -1 ---');
{
  const slides3 = SLIDES_5.slice(0, 3);
  mockFetch(
    makeAssignments([
      [0, 0, 10, 'Title slide → cover'],
      [1, 1, 9, 'Mission slide → mission'],
      [2, 2, 8, 'Market slide → market'],
      [3, -1, 0, 'no source content matches this slot purpose'],
      [4, -1, 0, 'no source content matches this slot purpose'],
    ]),
  );
  const r = await mapSlidesToSlotsLLM(
    { slides: slides3, scaffold: SCAFFOLD_5 },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.method === 'llm', 'method=llm');
  ok(r.assignments[3].slideIdx === -1, `slot 3 → -1 (got ${r.assignments[3].slideIdx})`);
  ok(
    r.assignments[3].sourceTitle === null,
    `slot 3 sourceTitle=null (got ${r.assignments[3].sourceTitle})`,
  );
  ok(r.assignments[4].slideIdx === -1, `slot 4 → -1 (got ${r.assignments[4].slideIdx})`);
  restoreFetch();
}

// ---------------------------------------------------------------------------
console.log('\n--- more slides than slots: 7 slides, 5 slots → best 1:1 ---');
{
  const slides7 = [
    ...SLIDES_5,
    { title: 'Financials', body: ['ARR $1.2M', 'Runway 18 months'] },
    { title: 'Ask', body: ['Raising $5M Series A'] },
  ];
  mockFetch(
    makeAssignments([
      [0, 0, 10, 'Cover slide'],
      [1, 1, 9, 'Mission slide'],
      [2, 2, 9, 'Market slide'],
      [3, 3, 8, 'Product slide'],
      [4, 4, 8, 'Team slide'],
    ]),
  );
  const r = await mapSlidesToSlotsLLM(
    { slides: slides7, scaffold: SCAFFOLD_5 },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.method === 'llm', 'method=llm');
  ok(r.assignments.length === 5, `5 assignments despite 7 slides (got ${r.assignments.length})`);
  restoreFetch();
}

// ---------------------------------------------------------------------------
console.log('\n--- HTTP 500 → fallback to heuristic ---');
{
  mockFetch('Internal server error', 500);
  const r = await mapSlidesToSlotsLLM(
    { slides: SLIDES_5, scaffold: SCAFFOLD_5 },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.method === 'heuristic-fallback', `method=heuristic-fallback (got ${r.method})`);
  ok(
    r.fallbackReason?.includes('http-500'),
    `fallbackReason contains http-500 (got ${r.fallbackReason})`,
  );
  ok(r.assignments.length === 5, 'still has 5 assignments from heuristic');
  restoreFetch();
}

// ---------------------------------------------------------------------------
console.log('\n--- network throw → fallback ---');
{
  mockFetchThrows('ECONNREFUSED');
  const r = await mapSlidesToSlotsLLM(
    { slides: SLIDES_5, scaffold: SCAFFOLD_5 },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(r.method === 'heuristic-fallback', 'fallback on network throw');
  ok(
    r.fallbackReason?.includes('ECONNREFUSED'),
    `fallbackReason captures error (got ${r.fallbackReason})`,
  );
  restoreFetch();
}

// ---------------------------------------------------------------------------
console.log('\n--- parse error (non-JSON response) → fallback ---');
{
  mockFetch({
    content: [{ text: 'I cannot answer this question.' }],
    usage: {},
  });
  const r = await mapSlidesToSlotsLLM(
    { slides: SLIDES_5, scaffold: SCAFFOLD_5 },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(
    r.method === 'heuristic-fallback',
    `method=heuristic-fallback on parse error (got ${r.method})`,
  );
  ok(r.fallbackReason === 'parse-failed', `fallbackReason=parse-failed (got ${r.fallbackReason})`);
  restoreFetch();
}

// ---------------------------------------------------------------------------
console.log('\n--- validation error: length mismatch → fallback ---');
{
  // LLM returns only 3 assignments for 5 slots
  mockFetch({
    content: [
      {
        text: JSON.stringify({
          assignments: [
            { slotIdx: 0, slideIdx: 0, confidence: 10, reason: 'cover' },
            { slotIdx: 1, slideIdx: 1, confidence: 9, reason: 'mission' },
            { slotIdx: 2, slideIdx: 2, confidence: 8, reason: 'market' },
          ],
        }),
      },
    ],
    usage: {},
  });
  const r = await mapSlidesToSlotsLLM(
    { slides: SLIDES_5, scaffold: SCAFFOLD_5 },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(
    r.method === 'heuristic-fallback',
    `method=heuristic-fallback on length mismatch (got ${r.method})`,
  );
  ok(
    r.fallbackReason === 'validation-length-mismatch',
    `fallbackReason correct (got ${r.fallbackReason})`,
  );
  restoreFetch();
}

// ---------------------------------------------------------------------------
console.log('\n--- validation error: slotIdx mismatch → fallback ---');
{
  // LLM returns wrong slotIdx at position 1
  mockFetch({
    content: [
      {
        text: JSON.stringify({
          assignments: [
            { slotIdx: 0, slideIdx: 0, confidence: 10, reason: 'cover' },
            { slotIdx: 99, slideIdx: 1, confidence: 9, reason: 'wrong slotIdx' }, // <-- bad
            { slotIdx: 2, slideIdx: 2, confidence: 8, reason: 'market' },
            { slotIdx: 3, slideIdx: 3, confidence: 7, reason: 'product' },
            { slotIdx: 4, slideIdx: 4, confidence: 6, reason: 'team' },
          ],
        }),
      },
    ],
    usage: {},
  });
  const r = await mapSlidesToSlotsLLM(
    { slides: SLIDES_5, scaffold: SCAFFOLD_5 },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(
    r.method === 'heuristic-fallback',
    `method=heuristic-fallback on slotIdx mismatch (got ${r.method})`,
  );
  ok(
    r.fallbackReason === 'validation-slotIdx-mismatch',
    `fallbackReason correct (got ${r.fallbackReason})`,
  );
  restoreFetch();
}

// ---------------------------------------------------------------------------
console.log('\n--- validation error: slideIdx out of range → fallback ---');
{
  // LLM returns a syntactically valid assignment to a non-existent source slide.
  mockFetch({
    content: [
      {
        text: JSON.stringify({
          assignments: [
            { slotIdx: 0, slideIdx: 0, confidence: 10, reason: 'cover' },
            { slotIdx: 1, slideIdx: 99, confidence: 9, reason: 'bad slideIdx' },
            { slotIdx: 2, slideIdx: 2, confidence: 8, reason: 'market' },
            { slotIdx: 3, slideIdx: 3, confidence: 7, reason: 'product' },
            { slotIdx: 4, slideIdx: 4, confidence: 6, reason: 'team' },
          ],
        }),
      },
    ],
    usage: {},
  });
  const r = await mapSlidesToSlotsLLM(
    { slides: SLIDES_5, scaffold: SCAFFOLD_5 },
    { apiKey: 'sk-test', log: () => {} },
  );
  ok(
    r.method === 'heuristic-fallback',
    `method=heuristic-fallback on slideIdx out of range (got ${r.method})`,
  );
  ok(
    r.fallbackReason === 'validation-slideIdx-out-of-range',
    `fallbackReason correct (got ${r.fallbackReason})`,
  );
  ok(
    r.assignments.every((a) => a.slideIdx < SLIDES_5.length),
    'fallback assignments only reference existing slides',
  );
  restoreFetch();
}

// ---------------------------------------------------------------------------
console.log('\n--- no apiKey + fallbackToHeuristic: true → fallback (no throw) ---');
{
  const r = await mapSlidesToSlotsLLM(
    { slides: SLIDES_5, scaffold: SCAFFOLD_5 },
    { fallbackToHeuristic: true, log: () => {} },
  );
  ok(r.method === 'heuristic-fallback', `method=heuristic-fallback (got ${r.method})`);
  ok(r.fallbackReason === 'no-api-key', `fallbackReason=no-api-key (got ${r.fallbackReason})`);
  ok(r.assignments.length === 5, '5 assignments from heuristic');
  // Cover slot should map to slide 0 (first unconsumed)
  ok(r.assignments[0].slideIdx === 0, `cover slot → slide 0 (got ${r.assignments[0].slideIdx})`);
}

// ---------------------------------------------------------------------------
console.log('\n--- no apiKey + fallbackToHeuristic: false → throws ---');
{
  let threw = false;
  try {
    await mapSlidesToSlotsLLM(
      { slides: SLIDES_5, scaffold: SCAFFOLD_5 },
      { fallbackToHeuristic: false, log: () => {} },
    );
  } catch {
    threw = true;
  }
  ok(threw === true, 'throws when fallbackToHeuristic=false + no apiKey');
}

// ---------------------------------------------------------------------------
console.log('\n--- scoreSlideForSlot export: direct unit test ---');
{
  const slide = { title: 'Market Opportunity', body: ['Large addressable market for crypto'] };
  const slot = { name: 'market', title: 'Market', purpose: 'Market size and opportunity' };
  const score = scoreSlideForSlot(slide, slot);
  ok(typeof score === 'number', `scoreSlideForSlot returns number (got ${typeof score})`);
  ok(score > 0, `score > 0 for "Market Opportunity" → market slot (got ${score})`);
  const emptySlide = { title: 'xyz', body: ['nothing relevant here'] };
  const emptyScore = scoreSlideForSlot(emptySlide, slot);
  ok(
    typeof emptyScore === 'number',
    `scoreSlideForSlot returns number for no-match (got ${emptyScore})`,
  );
}

// ---------------------------------------------------------------------------
console.log('\n--- heuristic fallback: bodyTexts shape (scaffold-view style) ---');
{
  // scaffold-view uses bodyTexts[] instead of body[]
  const slidesViewShape = [
    { title: 'ANTFUN', bodyTexts: ['On-Chain Trading Super App', 'Company Overview'] },
    { title: 'Our Mission', bodyTexts: ['Make on-chain trading as natural as messaging'] },
    { title: 'Market', bodyTexts: ['$2T addressable market opportunity'] },
    { title: 'Product', bodyTexts: ['Mobile wallet with embedded trading'] },
    { title: 'Team', bodyTexts: ['Ex-Binance engineers, backed by Sequoia'] },
  ];
  const r = await mapSlidesToSlotsLLM(
    { slides: slidesViewShape, scaffold: SCAFFOLD_5 },
    { fallbackToHeuristic: true, log: () => {} }, // no apiKey → heuristic
  );
  ok(r.method === 'heuristic-fallback', 'heuristic works with bodyTexts shape');
  ok(r.assignments.length === 5, '5 assignments');
  ok(r.assignments[0].slideIdx === 0, 'cover → slide 0');
}

// ---------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
