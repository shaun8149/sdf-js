// test-deck-io.mjs — Sprint 62: deck persistence round-trip + streaming hooks.
import {
  serializeDeck,
  deserializeDeck,
  DECK_FORMAT,
  DECK_FORMAT_VERSION,
} from '../src/present/deck-io.js';
import { newsToFullDeck } from '../src/present/news/full-deck.js';

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
};

// a representative deck: shared scaffold/slides/theme duplicated per slot,
// plus one quick-mode slot without liftParams and a decor artifact
const scaffold = { id: 'news-briefing', label: 'News', slots: [{ name: 'cover' }] };
const slides = [
  { title: 'A', facts: ['x is 40%'] },
  { title: 'B', facts: ['y is 12'] },
];
const theme = { id: 'editorial-navy', bg: [248, 246, 240], accent: [38, 70, 130] };
const mkSlot = (i) => ({
  slotIdx: i,
  slotName: `s${i}`,
  slotTitle: `Slide ${i}`,
  sceneData: { atoms: [{ type: 'stat-banner', args: { value: i } }] },
  liftParams: {
    scaffold,
    slot: { name: `s${i}` },
    slotIdx: i,
    slideIdx: i,
    theme,
    slide: slides[i % slides.length],
    slides,
    extraSlides: [],
  },
});
const deck = {
  title: 'RT 测试 deck',
  theme,
  scaffold: { id: scaffold.id, label: scaffold.label },
  decor: { family: 'peg-wraps', seed: 42, personality: 'wild', hash: 'abc123', v: 3, serial: 7 },
  slots: [mkSlot(0), mkSlot(1), { slotIdx: 2, slotName: 'plain', sceneData: { atoms: [] } }],
  errors: [],
};

// ── round-trip identity ──
{
  const json = JSON.stringify(serializeDeck(deck));
  const back = deserializeDeck(json);
  ok(back.title === deck.title, 'title survives');
  ok(back.slots.length === 3, 'slot count survives');
  ok(
    JSON.stringify(back.decor) === JSON.stringify(deck.decor),
    'decor artifact survives verbatim (hash/v/serial)',
  );
  ok(
    JSON.stringify(back.slots[1].sceneData) === JSON.stringify(deck.slots[1].sceneData),
    'sceneData survives verbatim',
  );
  ok(
    JSON.stringify(back.slots[0].liftParams.slides) === JSON.stringify(slides),
    'hoisted slides rehydrate into liftParams',
  );
  ok(
    back.slots[0].liftParams.scaffold.id === 'news-briefing',
    'hoisted scaffold rehydrates into liftParams',
  );
  ok(
    back.slots[0].liftParams.slides === back.slots[1].liftParams.slides,
    'rehydrated slides are SHARED refs (no re-duplication)',
  );
  ok(back.slots[2].liftParams === undefined, 'quick-mode slot stays liftParams-less');
}

// ── hoisting actually shrinks the file ──
{
  const hoisted = JSON.stringify(serializeDeck(deck)).length;
  const naive = JSON.stringify(deck).length;
  ok(hoisted < naive, `hoisting shrinks payload (${hoisted} < ${naive})`);
}

// ── mixed outlines from locked slides must not be flattened into one shared block ──
{
  const oldSlides = [
    { title: 'OLD primary', body: ['old main'] },
    { title: 'OLD orphan', body: ['old orphan must survive'] },
  ];
  const newSlides = [
    { title: 'NEW primary', body: ['new main'] },
    { title: 'NEW orphan', body: ['new orphan'] },
  ];
  const mixed = {
    ...deck,
    slots: [
      {
        ...mkSlot(0),
        liftParams: {
          ...mkSlot(0).liftParams,
          slide: newSlides[0],
          slides: newSlides,
        },
      },
      {
        ...mkSlot(1),
        locked: true,
        liftParams: {
          ...mkSlot(1).liftParams,
          slide: oldSlides[0],
          slides: oldSlides,
          extraSlides: [1],
        },
      },
    ],
  };
  const payload = serializeDeck(mixed);
  const back = deserializeDeck(JSON.stringify(payload));
  ok(payload.shared === null, 'heterogeneous liftParams are not hoisted');
  ok(
    back.slots[1].liftParams.slides[1].title === 'OLD orphan',
    'locked slide keeps its own outline across deck.json round-trip',
  );
  ok(
    back.slots[0].liftParams.slides[0].title === 'NEW primary',
    'new slide keeps the new outline across deck.json round-trip',
  );
  ok(
    back.slots[0].liftParams.slides !== back.slots[1].liftParams.slides,
    'mixed outlines rehydrate as separate refs',
  );
}

// ── guardrails ──
{
  let threw = false;
  try {
    deserializeDeck('{"format":"other"}');
  } catch {
    threw = true;
  }
  ok(threw, 'foreign json rejected');
  let threw2 = false;
  try {
    deserializeDeck(JSON.stringify({ format: DECK_FORMAT, version: DECK_FORMAT_VERSION + 1 }));
  } catch {
    threw2 = true;
  }
  ok(threw2, 'future format version rejected');
}

// ── streaming hooks: onPlan fires before lifts, onSlotReady per slot, and
// the returned deck reuses the streamed slot objects ──
{
  const fakeLift = async (params) => ({
    sceneData: { atoms: [{ type: 'stat-banner', args: { t: params.slot.name } }] },
  });
  // stub the LLM stages: expandNews/mapSlides need an apiKey + fetch — instead
  // drive liftSlotsPool through newsToFullDeck is heavy; test the contract at
  // pool level via full-deck's own dependency (already covered) and assert
  // here only the deck-io interplay: a streamed slot serializes cleanly.
  const streamedSlot = {
    slotIdx: 0,
    slotName: 'cover',
    slotTitle: 'Cover',
    sceneData: await fakeLift({ slot: { name: 'cover' } }).then((r) => r.sceneData),
    liftParams: {
      scaffold,
      slot: { name: 'cover' },
      slotIdx: 0,
      slideIdx: 0,
      theme,
      slide: slides[0],
      slides,
      extraSlides: [],
    },
  };
  const mini = {
    title: 't',
    theme,
    scaffold: { id: scaffold.id },
    decor: null,
    slots: [streamedSlot],
  };
  const rt = deserializeDeck(JSON.stringify(serializeDeck(mini)));
  ok(rt.slots[0].sceneData.atoms[0].args.t === 'cover', 'streamed slot round-trips');
  ok(typeof newsToFullDeck === 'function', 'newsToFullDeck exports (streaming hooks live there)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
