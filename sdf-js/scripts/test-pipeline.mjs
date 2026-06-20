// =============================================================================
// test-pipeline.mjs — L1 unit tests for Atlas Present Sprint 1 v4 pipeline
// =============================================================================

import { createPipeline } from '../src/present/pipeline.js';
import { createDeck } from '../src/present/deck-model.js';

// Mock localStorage (deck-model uses it via saveDeck callback closure, not directly)
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
    console.log(`  ok ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
}

console.log('=== pipeline (Sprint 1 v4) smoke test ===\n');

// Helpers
function makeMockDeps(opts = {}) {
  const slides = opts.slides ?? [
    { pageIndex: 0, title: 'A', body: [] },
    { pageIndex: 1, title: 'B', body: [] },
    { pageIndex: 2, title: 'C', body: [] },
  ];
  const liftBehavior = opts.liftBehavior ?? 'success';
  const saveLog = opts.saveLog ?? [];
  return {
    saveLog,
    deps: {
      parsePDFFromBytes: async () => slides,
      emitSlide2dCode: (sd) => `// code for ${sd.title}`,
      callLiftLLM: async (prompt, code2d) => {
        if (liftBehavior === 'success') {
          return {
            text: JSON.stringify({
              v: 1,
              subjects: [
                { id: 'a', type: 'cube-3d', args: {}, transform: { translate: [0, 0, 0] } },
              ],
            }),
            usage: {},
          };
        }
        if (liftBehavior === 'error') {
          throw new Error('mock lift error');
        }
        if (liftBehavior === 'error-page-1' && prompt.includes('B')) {
          throw new Error('selective error for B');
        }
        return { text: JSON.stringify({ v: 1, subjects: [] }), usage: {} };
      },
      parseLiftResponse: (text) => JSON.parse(text),
      saveDeck: (deck) =>
        saveLog.push({
          ts: Date.now(),
          sectionCount: deck.sections.length,
          statuses: deck.sections.map((s) => s.status),
        }),
    },
  };
}

console.log('Test group 1: happy path (3 sections all lift successfully)');

{
  const deck = createDeck('test', { type: 'pdf', fileName: 'test.pdf', pageCount: 3 });
  const events = [];
  const { saveLog, deps } = makeMockDeps();
  const pipeline = createPipeline(deck, new Uint8Array(10), 'fake-api-key', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();

  // Event sequence
  ok(events[0]?.type === 'parse-start', 'first event = parse-start');
  ok(
    events[1]?.type === 'parse-done' && events[1].sectionCount === 3,
    'parse-done with sectionCount 3',
  );
  ok(events.filter((e) => e.type === 'lift-start').length === 3, '3 lift-start events');
  ok(events.filter((e) => e.type === 'lift-ready').length === 3, '3 lift-ready events');
  ok(events[events.length - 1].type === 'all-done', 'last event = all-done');

  // Sequential: lift-start for section i comes before lift-ready for i
  // AND before lift-start for i+1
  const liftStarts = events.filter((e) => e.type === 'lift-start');
  ok(
    liftStarts[0].pageIndex === 0 && liftStarts[1].pageIndex === 1 && liftStarts[2].pageIndex === 2,
    'lift order: 0 -> 1 -> 2 sequential',
  );

  // Deck state
  ok(deck.sections.length === 3, 'deck has 3 sections');
  ok(
    deck.sections.every((s) => s.status === 'ready'),
    'all sections status = ready',
  );
  ok(
    deck.sections.every((s) => s.sceneData !== undefined),
    'all sections have sceneData',
  );
  ok(
    deck.sections.every((s) => s.region !== undefined),
    'all sections have region',
  );

  // saveDeck called multiple times (after addPendingSections + after each status change)
  ok(saveLog.length >= 1 + 3 * 2, `saveDeck called >= 7 times (got ${saveLog.length})`);
}

console.log('\nTest group 2: lift error on one section, others continue');

{
  const deck = createDeck('errpath', { type: 'pdf', fileName: 'e.pdf', pageCount: 3 });
  const events = [];
  const { deps } = makeMockDeps({ liftBehavior: 'error-page-1' });
  const pipeline = createPipeline(deck, new Uint8Array(10), 'k', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();

  const liftErrors = events.filter((e) => e.type === 'lift-error');
  ok(liftErrors.length === 1, '1 lift-error event');
  ok(liftErrors[0].pageIndex === 1, 'lift-error for page 1');
  ok(deck.sections[0].status === 'ready', 'section 0 still ready');
  ok(deck.sections[1].status === 'error', 'section 1 error');
  ok(deck.sections[1].liftError === 'selective error for B', 'section 1 liftError text preserved');
  ok(deck.sections[2].status === 'ready', 'section 2 continued to ready after section 1 error');
}

console.log('\nTest group 3: parse error aborts pipeline');

{
  const deck = createDeck('parseerr', { type: 'pdf', fileName: 'p.pdf', pageCount: 0 });
  const events = [];
  const deps = {
    parsePDFFromBytes: async () => {
      throw new Error('bad pdf');
    },
    emitSlide2dCode: () => '',
    callLiftLLM: async () => ({ text: '{}', usage: {} }),
    parseLiftResponse: (t) => JSON.parse(t),
    saveDeck: () => {},
  };
  const pipeline = createPipeline(deck, new Uint8Array(10), 'k', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();

  ok(events[0].type === 'parse-start', 'first event parse-start');
  ok(events[1].type === 'parse-error', 'second event parse-error');
  ok(events[1].error.message === 'bad pdf', 'error message preserved');
  ok(
    events.find((e) => e.type === 'lift-start') === undefined,
    'no lift attempted after parse error',
  );
  ok(deck.sections.length === 0, 'deck has no sections on parse error');
}

console.log('\nTest group 4: cancel stops further lifts');

{
  const deck = createDeck('cancel', { type: 'pdf', fileName: 'c.pdf', pageCount: 3 });
  const events = [];
  let liftCallCount = 0;
  let pipelineRef;
  const deps = {
    parsePDFFromBytes: async () => [
      { pageIndex: 0, title: 'A', body: [] },
      { pageIndex: 1, title: 'B', body: [] },
      { pageIndex: 2, title: 'C', body: [] },
    ],
    emitSlide2dCode: (sd) => `// ${sd.title}`,
    callLiftLLM: async () => {
      liftCallCount++;
      if (liftCallCount === 1) {
        // Trigger cancel after first lift starts
        pipelineRef.cancel();
      }
      return { text: JSON.stringify({ v: 1, subjects: [] }), usage: {} };
    },
    parseLiftResponse: (t) => JSON.parse(t),
    saveDeck: () => {},
  };
  pipelineRef = createPipeline(deck, new Uint8Array(10), 'k', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipelineRef.start();

  ok(liftCallCount === 1, `only 1 lift call before cancel (got ${liftCallCount})`);
  const cancelEvent = events.find((e) => e.type === 'cancelled');
  ok(cancelEvent !== undefined, 'cancelled event emitted');
  // Sections 1 and 2 should still be 'pending' (never started)
  ok(deck.sections[1].status === 'pending', 'section 1 still pending after cancel');
  ok(deck.sections[2].status === 'pending', 'section 2 still pending after cancel');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
