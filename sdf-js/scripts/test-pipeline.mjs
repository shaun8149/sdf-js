// =============================================================================
// test-pipeline.mjs — L1 unit tests for Atlas Present Sprint 1.5 v4 pipeline
// (variant-aware: 3 lifts per section, archetype extraction)
// =============================================================================

import { createPipeline } from '../src/present/pipeline.js';
import { createDeck, VARIANT_COUNT, addPendingSections } from '../src/present/deck-model.js';

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

console.log('=== pipeline (Sprint 1.5 v4 variants) smoke test ===\n');

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
              name: 'list: ' + prompt,
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
        return {
          text: JSON.stringify({ v: 1, name: 'list: ' + prompt, subjects: [] }),
          usage: {},
        };
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

console.log('Test group 1: happy path (3 sections × 3 variants all lift successfully)');

{
  const deck = createDeck('test', { type: 'pdf', fileName: 'test.pdf', pageCount: 3 });
  const events = [];
  const { saveLog, deps } = makeMockDeps();
  const pipeline = createPipeline(deck, new Uint8Array(10), 'fake-api-key', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();

  // Event sequence — Sprint 1.5: 3 sections × 3 variants = 9 lift-start / 9 lift-ready
  ok(events[0]?.type === 'parse-start', 'first event = parse-start');
  ok(
    events[1]?.type === 'parse-done' && events[1].sectionCount === 3,
    'parse-done with sectionCount 3',
  );
  const liftStarts = events.filter((e) => e.type === 'lift-start');
  const liftReadys = events.filter((e) => e.type === 'lift-ready');
  ok(
    liftStarts.length === 3 * VARIANT_COUNT,
    `${3 * VARIANT_COUNT} lift-start events (3 sections × 3 variants), got ${liftStarts.length}`,
  );
  ok(
    liftReadys.length === 3 * VARIANT_COUNT,
    `${3 * VARIANT_COUNT} lift-ready events, got ${liftReadys.length}`,
  );
  ok(
    liftStarts.every((e) => typeof e.variantIndex === 'number'),
    'every lift-start event carries variantIndex',
  );
  ok(
    liftReadys.every((e) => typeof e.variantIndex === 'number'),
    'every lift-ready event carries variantIndex',
  );
  ok(
    liftReadys.every((e) => typeof e.archetype === 'string'),
    'every lift-ready event carries archetype field',
  );
  ok(events[events.length - 1].type === 'all-done', 'last event = all-done');

  // Sequential per section: variants 0,1,2 in order, then next section
  // Section 0 variants come before section 1 variants
  const section0Starts = liftStarts.filter((e) => e.pageIndex === 0);
  const section1Starts = liftStarts.filter((e) => e.pageIndex === 1);
  ok(section0Starts.length === 3, 'section 0 has 3 lift-start events');
  ok(
    section0Starts[0].variantIndex === 0 &&
      section0Starts[1].variantIndex === 1 &&
      section0Starts[2].variantIndex === 2,
    'section 0 variants lifted in order 0 -> 1 -> 2',
  );
  // Section 0's last variant lift-start comes before section 1's first variant lift-start
  const lastS0Idx = events.lastIndexOf(section0Starts[2]);
  const firstS1Idx = events.indexOf(section1Starts[0]);
  ok(lastS0Idx < firstS1Idx, 'section 0 completes all 3 variants before section 1 begins');

  // Deck state
  ok(deck.sections.length === 3, 'deck has 3 sections');
  ok(
    deck.sections.every((s) => s.status === 'ready'),
    'all sections derived status = ready',
  );
  ok(
    deck.sections.every((s) => s.variants.length === VARIANT_COUNT),
    `every section has ${VARIANT_COUNT} variants`,
  );
  ok(
    deck.sections.every((s) => s.variants.every((v) => v.status === 'ready')),
    'every variant of every section status = ready',
  );
  ok(
    deck.sections.every((s) => s.variants.every((v) => v.sceneData !== undefined)),
    'every variant has sceneData',
  );
  ok(
    deck.sections.every((s) => s.variants.every((v) => v.region !== undefined)),
    'every variant has region',
  );
  ok(
    deck.sections.every((s) => s.variants.every((v) => v.archetype === 'list')),
    "every variant has archetype === 'list' (from mock sceneData.name 'list: ...')",
  );

  // saveDeck: 1 (after addPendingSections) + 3 sections × 3 variants × 2 (lifting + ready) = 19
  ok(
    saveLog.length >= 1 + 3 * VARIANT_COUNT * 2,
    `saveDeck called >= 19 times (got ${saveLog.length})`,
  );
}

console.log(
  '\nTest group 2: variant error tolerance (Sprint 1.5 v2 — error in 1 variant of 1 section does not abort other variants in same section, others continue normally)',
);

{
  // Strategy: error on the 2nd lift call only. That's section 0 variant 1.
  // Section 0 should end with variants[0]=ready, variants[1]=error, variants[2]=ready
  // → section.status derived = 'ready' (any ready beats error).
  // Sections 1 and 2 should all-variants-ready.
  const deck = createDeck('error-test', { type: 'pdf', fileName: 'e.pdf', pageCount: 3 });
  const events = [];
  let callCount = 0;
  const deps = {
    parsePDFFromBytes: async () => [
      { pageIndex: 0, title: 'A', body: [] },
      { pageIndex: 1, title: 'B', body: [] },
      { pageIndex: 2, title: 'C', body: [] },
    ],
    emitSlide2dCode: (sd) => `// ${sd.title}`,
    callLiftLLM: async (prompt) => {
      callCount++;
      if (callCount === 2) throw new Error('mock variant error');
      return {
        text: JSON.stringify({ v: 1, name: 'list: ' + prompt, subjects: [] }),
        usage: {},
      };
    },
    parseLiftResponse: (text) => JSON.parse(text),
    saveDeck: () => {},
  };

  const pipeline = createPipeline(deck, new Uint8Array(10), 'k', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();

  const errorEvents = events.filter((e) => e.type === 'lift-error');
  ok(errorEvents.length === 1, `1 lift-error event, got ${errorEvents.length}`);
  ok(
    errorEvents[0].variantIndex === 1 && errorEvents[0].pageIndex === 0,
    `error tagged variantIndex=1 pageIndex=0 (got vi=${errorEvents[0].variantIndex} pi=${errorEvents[0].pageIndex})`,
  );

  // Variant-granular error
  ok(
    deck.sections[0].variants[1].status === 'error',
    `section 0 variant 1 status=error, got ${deck.sections[0].variants[1].status}`,
  );
  ok(
    deck.sections[0].variants[1].liftError === 'mock variant error',
    `section 0 variant 1 liftError text preserved (got '${deck.sections[0].variants[1].liftError}')`,
  );

  // Sibling variants of same section still succeeded
  ok(
    deck.sections[0].variants[0].status === 'ready',
    'section 0 variant 0 ready (sibling not aborted)',
  );
  ok(
    deck.sections[0].variants[2].status === 'ready',
    'section 0 variant 2 ready (sibling not aborted)',
  );

  // Section status derived: any ready → section ready
  ok(
    deck.sections[0].status === 'ready',
    `section 0 derived status='ready' (any variant ready beats error), got '${deck.sections[0].status}'`,
  );

  // Other sections fully ready
  ok(
    deck.sections[1].variants.every((v) => v.status === 'ready'),
    'section 1: all 3 variants ready (subsequent sections unaffected)',
  );
  ok(
    deck.sections[2].variants.every((v) => v.status === 'ready'),
    'section 2: all 3 variants ready (subsequent sections unaffected)',
  );
  ok(deck.sections[1].status === 'ready', 'section 1 derived status=ready');
  ok(deck.sections[2].status === 'ready', 'section 2 derived status=ready');
}

console.log('\nTest group 2b: first variant error auto-selects first ready sibling');

{
  const deck = createDeck('variant0-error', { type: 'pdf', fileName: 'e0.pdf', pageCount: 1 });
  let callCount = 0;
  const deps = {
    parsePDFFromBytes: async () => [{ pageIndex: 0, title: 'A', body: [] }],
    emitSlide2dCode: () => '// A',
    callLiftLLM: async () => {
      callCount++;
      if (callCount === 1) throw new Error('variant 0 failed');
      return {
        text: JSON.stringify({ v: 1, name: 'list: A', subjects: [] }),
        usage: {},
      };
    },
    parseLiftResponse: (text) => JSON.parse(text),
    saveDeck: () => {},
  };

  const pipeline = createPipeline(deck, new Uint8Array(10), 'k', deps, { onEvent: () => {} });
  await pipeline.start();

  ok(deck.sections[0].status === 'ready', 'section ready after siblings succeed');
  ok(deck.sections[0].variants[0].status === 'error', 'variant 0 captured error');
  ok(deck.sections[0].variants[1].status === 'ready', 'variant 1 ready');
  ok(
    deck.sections[0].selectedVariantIndex === 1,
    `selectedVariantIndex moved to first ready sibling (got ${deck.sections[0].selectedVariantIndex})`,
  );
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

console.log('\nTest group 4: cancel stops further lifts (granular at variant boundary)');

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
      return {
        text: JSON.stringify({ v: 1, name: 'list: page', subjects: [] }),
        usage: {},
      };
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
  // Section 0 variant 0 got the lift-ready (since cancel only halts before the
  // *next* lift). Variants 1 & 2 of section 0 + all of sections 1,2 stay pending.
  ok(
    deck.sections[0].variants[0].status === 'ready',
    `section 0 variant 0 ready after in-flight lift completes (got '${deck.sections[0].variants[0].status}')`,
  );
  ok(
    deck.sections[0].variants[1].status === 'pending',
    `section 0 variant 1 still pending after cancel (got '${deck.sections[0].variants[1].status}')`,
  );
  ok(
    deck.sections[0].variants[2].status === 'pending',
    `section 0 variant 2 still pending after cancel (got '${deck.sections[0].variants[2].status}')`,
  );
  ok(
    deck.sections[1].variants.every((v) => v.status === 'pending'),
    'section 1: all 3 variants still pending after cancel',
  );
  ok(
    deck.sections[2].variants.every((v) => v.status === 'pending'),
    'section 2: all 3 variants still pending after cancel',
  );
}

console.log(
  '\nTest group 5: archetype extraction (Sprint 1.5 v2 — 3 different archetypes across 3 lifts)',
);

{
  const deck = createDeck('archetype-test', { type: 'pdf', fileName: 't.pdf', pageCount: 1 });
  const events = [];
  let callCount = 0;
  const archetypes = ['sequence: Page Title', 'list: Page Title', 'compare: Page Title'];
  const deps = {
    parsePDFFromBytes: async () => [{ pageIndex: 0, title: 'p1', body: [] }],
    emitSlide2dCode: () => '// code',
    callLiftLLM: async () => {
      const name = archetypes[callCount++];
      return { text: JSON.stringify({ v: 1, name, subjects: [] }), usage: {} };
    },
    parseLiftResponse: (text) => JSON.parse(text),
    saveDeck: () => {},
  };

  const pipeline = createPipeline(deck, new Uint8Array(10), 'k', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();

  ok(
    deck.sections[0].variants[0].archetype === 'sequence',
    `variant 0 archetype='sequence', got '${deck.sections[0].variants[0].archetype}'`,
  );
  ok(
    deck.sections[0].variants[1].archetype === 'list',
    `variant 1 archetype='list', got '${deck.sections[0].variants[1].archetype}'`,
  );
  ok(
    deck.sections[0].variants[2].archetype === 'compare',
    `variant 2 archetype='compare', got '${deck.sections[0].variants[2].archetype}'`,
  );

  const readyEvents = events.filter((e) => e.type === 'lift-ready');
  ok(readyEvents.length === 3, '3 lift-ready events');
  ok(readyEvents[0].archetype === 'sequence', 'lift-ready event 0 carries archetype=sequence');
  ok(readyEvents[1].archetype === 'list', 'lift-ready event 1 carries archetype=list');
  ok(readyEvents[2].archetype === 'compare', 'lift-ready event 2 carries archetype=compare');
}

console.log(
  '\nTest group 6: archetype fallback to "unknown" (Sprint 1.5 v2 — malformed sceneData.name)',
);

{
  const deck = createDeck('fallback-test', { type: 'pdf', fileName: 't.pdf', pageCount: 1 });
  let callIdx = 0;
  // Three cases: name missing entirely, name has no colon, name has unrecognized archetype
  const malformedNames = [undefined, 'no colon prefix at all', 'invalid-archetype: Title'];
  const deps = {
    parsePDFFromBytes: async () => [{ pageIndex: 0, title: 'p', body: [] }],
    emitSlide2dCode: () => '',
    callLiftLLM: async () => {
      const name = malformedNames[callIdx++];
      const sceneData = { v: 1, subjects: [] };
      if (name !== undefined) sceneData.name = name;
      return { text: JSON.stringify(sceneData), usage: {} };
    },
    parseLiftResponse: (text) => JSON.parse(text),
    saveDeck: () => {},
  };

  const pipeline = createPipeline(deck, new Uint8Array(10), 'k', deps, { onEvent: () => {} });
  await pipeline.start();

  for (let i = 0; i < 3; i++) {
    ok(
      deck.sections[0].variants[i].archetype === 'unknown',
      `variant ${i} archetype falls back to 'unknown', got '${deck.sections[0].variants[i].archetype}'`,
    );
  }
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
