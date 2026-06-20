// =============================================================================
// test-pipeline.mjs — L1 unit tests for Atlas Present Sprint 2 visual-pipeline
// =============================================================================

import { createVisualPipeline, extractArchetype, VARIANT_COUNT } from '../src/present/pipeline.js';
import { createDeck, addVisual, setDocument } from '../src/present/deck-model.js';

// Mock localStorage (deck-model uses it via saveDeck closure)
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

function makeDeckWithVisual() {
  const deck = createDeck('test', { type: 'pdf', fileName: 't.pdf', pageCount: 1 });
  setDocument(deck, {
    flowingText: 'Hello world example text',
    pages: [{ startOffset: 0, endOffset: 24, pageNumber: 1 }],
    headings: [],
  });
  const visual = addVisual(deck, { startOffset: 0, endOffset: 11, text: 'Hello world' });
  return { deck, visualId: visual.id };
}

function makeMockDeps(opts = {}) {
  const archetypes = opts.archetypes ?? [
    'sequence',
    'list',
    'compare',
    'hierarchy',
    'relation',
    'kpi-hero',
  ];
  let callCount = 0;
  return {
    callLiftLLM: async (prompt, code2d, apiKey, callOpts) => {
      const idx = callCount++;
      if (opts.failOnIndex !== undefined && idx === opts.failOnIndex) {
        throw new Error(`mock error on variant ${idx}`);
      }
      if (opts.captureOpts) opts.captureOpts.push(callOpts);
      const archetype = archetypes[idx] || 'list';
      const sceneData = {
        v: 1,
        name: `${archetype}: Hello world`,
        subjects: [
          { id: 'a', type: 'sphere', args: {}, transform: { translate: [0, 0, 0] } },
          // Inject a text-3d-pipe subject to verify sanitize is being called
          {
            id: 'b',
            type: 'text-3d-pipe',
            args: { text: 'should be filtered' },
            transform: { translate: [0, 1, 0] },
          },
        ],
      };
      return { text: JSON.stringify(sceneData), usage: {} };
    },
    parseLiftResponse: (text) => JSON.parse(text),
    sanitize2dSceneData: (sd) => {
      if (!sd || !Array.isArray(sd.subjects)) return sd;
      return {
        ...sd,
        subjects: sd.subjects.filter(
          (s) => s.type !== 'text-3d-pipe' && s.type !== 'text-3d-extruded',
        ),
      };
    },
    saveDeck: () => {},
  };
}

console.log('=== pipeline (Sprint 2 visual-pipeline) smoke test ===\n');

console.log('Constants');
ok(VARIANT_COUNT === 6, `VARIANT_COUNT re-exported as 6 (got ${VARIANT_COUNT})`);

console.log('\nTest group 1: extractArchetype');
{
  ok(extractArchetype({ name: 'sequence: Q3 Roadmap' }) === 'sequence', 'extract sequence');
  ok(extractArchetype({ name: 'text-card: Definition' }) === 'text-card', 'extract text-card');
  ok(
    extractArchetype({ name: 'unknown-archetype: Title' }) === 'unknown',
    'unknown archetype → unknown',
  );
  ok(extractArchetype({ name: 'no colon prefix' }) === 'unknown', 'no colon → unknown');
  ok(extractArchetype({}) === 'unknown', 'missing name → unknown');
  ok(extractArchetype(null) === 'unknown', 'null sceneData → unknown');
}

console.log('\nTest group 2: happy path (6 lifts, 6 different archetypes via mock)');

{
  const { deck, visualId } = makeDeckWithVisual();
  const events = [];
  const capturedOpts = [];
  const deps = makeMockDeps({ captureOpts: capturedOpts });

  const pipeline = createVisualPipeline(deck, visualId, 'fake-key', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();

  const starts = events.filter((e) => e.type === 'lift-start');
  const readys = events.filter((e) => e.type === 'lift-ready');
  ok(starts.length === 6, `6 lift-start events (got ${starts.length})`);
  ok(readys.length === 6, `6 lift-ready events (got ${readys.length})`);
  ok(events[events.length - 1].type === 'all-done', 'last event = all-done');

  // Verify opts.mode = '2d' was passed to every callLiftLLM call
  ok(capturedOpts.length === 6, '6 callLiftLLM invocations');
  ok(
    capturedOpts.every((o) => o?.mode === '2d'),
    'every callLiftLLM call passed opts.mode = 2d',
  );

  // Verify deck state
  const visual = deck.visuals[0];
  ok(
    visual.variants.every((v) => v.status === 'ready'),
    'all 6 variants ready',
  );
  ok(
    visual.variants.every((v) => v.sceneData !== undefined),
    'all variants have sceneData',
  );
  ok(
    visual.variants.every((v) => v.archetype !== 'unknown'),
    'all variants extracted valid archetypes',
  );
  ok(visual.status === 'ready', 'visual status derived to ready');
}

console.log('\nTest group 3: sanitize2dSceneData was invoked (text-3d-pipe removed)');

{
  const { deck, visualId } = makeDeckWithVisual();
  const deps = makeMockDeps();
  const pipeline = createVisualPipeline(deck, visualId, 'fake-key', deps, { onEvent: () => {} });
  await pipeline.start();
  const visual = deck.visuals[0];
  for (let i = 0; i < 6; i++) {
    const subjects = visual.variants[i].sceneData?.subjects ?? [];
    ok(
      subjects.every((s) => s.type !== 'text-3d-pipe'),
      `variant ${i}: no text-3d-pipe subjects after sanitize`,
    );
  }
}

console.log('\nTest group 4: error tolerance — single variant error does not abort');

{
  const { deck, visualId } = makeDeckWithVisual();
  const events = [];
  const deps = makeMockDeps({ failOnIndex: 2 });
  const pipeline = createVisualPipeline(deck, visualId, 'fake-key', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();

  const errors = events.filter((e) => e.type === 'lift-error');
  const readys = events.filter((e) => e.type === 'lift-ready');
  ok(errors.length === 1, `1 lift-error (got ${errors.length})`);
  ok(errors[0].variantIndex === 2, `error on variant 2`);
  ok(readys.length === 5, `5 lift-ready (got ${readys.length})`);

  const visual = deck.visuals[0];
  ok(visual.variants[2].status === 'error', 'variant 2 = error');
  ok(
    visual.variants[2].liftError === 'mock error on variant 2',
    'variant 2 liftError text preserved',
  );
  ok(visual.status === 'ready', 'visual status = ready (5 of 6 ready)');
}

console.log('\nTest group 5: cancel stops further lifts');

{
  const { deck, visualId } = makeDeckWithVisual();
  const events = [];
  let liftCallCount = 0;
  let pipelineRef;
  const deps = {
    callLiftLLM: async () => {
      liftCallCount++;
      if (liftCallCount === 2) pipelineRef.cancel();
      return { text: JSON.stringify({ v: 1, name: 'list: Test', subjects: [] }), usage: {} };
    },
    parseLiftResponse: (text) => JSON.parse(text),
    sanitize2dSceneData: (sd) => sd,
    saveDeck: () => {},
  };
  pipelineRef = createVisualPipeline(deck, visualId, 'fake-key', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipelineRef.start();

  ok(liftCallCount === 2, `only 2 lift calls before cancel (got ${liftCallCount})`);
  ok(events.find((e) => e.type === 'cancelled') !== undefined, 'cancelled event emitted');
  const visual = deck.visuals[0];
  ok(visual.variants[2].status === 'pending', 'variant 2 still pending after cancel');
  ok(visual.variants[5].status === 'pending', 'variant 5 still pending after cancel');
}

console.log('\nTest group 6: visual not found returns lift-error');

{
  const { deck } = makeDeckWithVisual();
  const events = [];
  const deps = makeMockDeps();
  const pipeline = createVisualPipeline(deck, 'nonexistent-id', 'fake-key', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();
  ok(events.length === 1 && events[0].type === 'lift-error', 'fires lift-error');
  ok(events[0].error === 'visual not found', 'error message');
  ok(events[0].variantIndex === -1, 'variantIndex = -1 (no specific variant)');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
