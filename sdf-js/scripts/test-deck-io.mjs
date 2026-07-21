// test-deck-io.mjs — Sprint 62: deck persistence round-trip + streaming hooks.
import {
  serializeDeck,
  deserializeDeck,
  DECK_FORMAT,
  DECK_FORMAT_VERSION,
} from '../src/present/deck-io.js';
import {
  newsToFullDeck,
  chooseScaffoldForOutline,
  retryFailedSlot,
  rescueEmptyMapping,
  genericHoldSlot,
} from '../src/present/news/full-deck.js';

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

// ── Sprint 63: scaffold auto-choice (deterministic ranker over the outline) ──
{
  const qbrOutline = [
    { title: 'Q3 Quarterly Business Review', body: ['quarter in review for the exec team'] },
    { title: 'Revenue', body: ['revenue grew 40% QoQ to $12M ARR'] },
    { title: 'KPIs', body: ['churn dropped to 2.1%, NRR 118%'] },
    { title: 'OKR progress', body: ['7 of 9 objectives on track'] },
    { title: 'Next quarter goals', body: ['expand EMEA, hire 12'] },
  ];
  const { scaffold, ranked } = chooseScaffoldForOutline(qbrOutline);
  ok(scaffold && Array.isArray(scaffold.slots), 'auto choice returns a real scaffold');
  ok(ranked.length >= 10 && ranked[0].score >= ranked[1].score, 'ranking is ordered');
  ok(
    ['qbr', 'okr-goal-setting', 'financial-summary', 'investor-update'].includes(scaffold.id),
    `QBR-ish outline lands on a business skeleton (${scaffold.id})`,
  );
  const newsOutline = [
    {
      title: 'Breaking: major earthquake hits region',
      body: ['news wire report, casualties unknown'],
    },
    { title: 'What happened', body: ['a 7.1 magnitude quake struck at dawn'] },
  ];
  const pick2 = chooseScaffoldForOutline(newsOutline).scaffold;
  ok(
    Array.isArray(pick2.slots) && pick2.slots.length > 0,
    'news outline also resolves to a scaffold',
  );
  // determinism: same outline → same pick
  ok(chooseScaffoldForOutline(qbrOutline).scaffold.id === scaffold.id, 'auto choice deterministic');
}

// ── Sprint 68: retryFailedSlot — a failed slot is a retryable unit ──
{
  const lp = (i) => ({
    scaffold,
    slot: { name: `s${i}`, title: `Slide ${i}` },
    slotIdx: i,
    slideIdx: 0,
    theme,
    slide: slides[0],
    slides,
    extraSlides: [],
  });
  const deck2 = {
    slots: [
      { slotIdx: 0, slotName: 's0', sceneData: { subjects: [] } },
      { slotIdx: 4, slotName: 's4', sceneData: { subjects: [] } },
    ],
    errors: [{ slot: 's2', slotIdx: 2, slotTitle: 'Slide 2', message: 'boom', liftParams: lp(2) }],
  };
  const okLift = async () => ({ sceneData: { subjects: [{ type: 'kpi-card', args: {} }] } });
  const slot = await retryFailedSlot(deck2, deck2.errors[0], { apiKey: 'k', liftFn: okLift });
  ok(
    slot.slotIdx === 2 && deck2.slots[1] === slot,
    'rescued slot splices at its skeleton position',
  );
  ok(deck2.errors.length === 0, 'error entry removed on success');

  const deck3 = {
    slots: [],
    errors: [{ slot: 's1', slotIdx: 1, slotTitle: 'S1', message: 'old', liftParams: lp(1) }],
  };
  let threw = false;
  try {
    await retryFailedSlot(deck3, deck3.errors[0], {
      apiKey: 'k',
      liftFn: async () => {
        throw new Error('still down');
      },
    });
  } catch {
    threw = true;
  }
  ok(
    threw && deck3.errors.length === 1 && deck3.errors[0].message === 'still down',
    'failed retry keeps the entry with the fresh message',
  );

  let threw2 = false;
  try {
    await retryFailedSlot(deck3, { slot: 'x' }, { apiKey: 'k', liftFn: okLift });
  } catch {
    threw2 = true;
  }
  ok(threw2, 'entry without liftParams rejected');
}

// ── Sprint 70: CJK ranker + weak-signal fallback + collapse rescue ──
{
  // CJK keywords: a Chinese QBR outline lands qbr with a strong signal
  const cjkQbr = [
    { title: '三季度业务复盘', body: ['季度营收与增长回顾'] },
    { title: '下季度规划', body: ['战略目标'] },
  ];
  const p1 = chooseScaffoldForOutline(cjkQbr);
  ok(!p1.weakSignal && p1.scaffold.id === 'qbr', `CJK 季度复盘 → qbr (${p1.scaffold.id})`);

  // weak signal → news-briefing fallback (the ANTFUN lesson)
  const nonsense = [{ title: '完全不知所云的内容', body: ['既无关键词也无结构信号的一段话'] }];
  const p2 = chooseScaffoldForOutline(nonsense);
  ok(
    p2.weakSignal === true && p2.scaffold.id === 'news-briefing',
    `weak signal falls back to news-briefing (${p2.scaffold.id})`,
  );

  // collapse rescue: only cover mapped → fill empties by heuristic score
  const mkSlot2 = (name) => ({ name, title: name, purpose: name, recommendedAtoms: [] });
  const asn = [
    { slotIdx: 0, slot: mkSlot2('cover'), slideIdx: 0, empty: false },
    { slotIdx: 1, slot: mkSlot2('overview'), empty: true },
    { slotIdx: 2, slot: mkSlot2('details'), empty: true },
    { slotIdx: 3, slot: mkSlot2('summary'), empty: true },
  ];
  const outlineSlides = [
    { title: 'Cover', body: ['t'] },
    { title: 'A', body: ['overview of the system'] },
    { title: 'B', body: ['details of the design'] },
    { title: 'C', body: ['summary and outlook'] },
  ];
  const did = rescueEmptyMapping(asn, outlineSlides, 4);
  ok(did === true, 'collapse detected and rescued');
  ok(
    asn.filter((a) => !a.empty).length === 4,
    `deck no longer collapses to cover (${asn.filter((a) => !a.empty).length} filled)`,
  );
  const healthy = [
    { slotIdx: 0, slot: mkSlot2('cover'), slideIdx: 0, empty: false },
    { slotIdx: 1, slot: mkSlot2('body'), slideIdx: 1, empty: false },
  ];
  ok(rescueEmptyMapping(healthy, outlineSlides, 4) === false, 'healthy mapping untouched');
}

// ── Sprint 71: generic hold fallback — 强灌槽位脱掉专家戏服 ──
{
  const slot = {
    name: 'comparison',
    title: 'Comparison',
    purpose: 'This vs the alternatives — head-to-head on the axes that matter',
    recommended_atoms: ['comparison-table'],
  };
  const cjkSlide = { title: '毕业门槛设计', body: ['美元锚定, 65 SOL 初值'] };
  const held = genericHoldSlot(slot, cjkSlide);
  ok(held.generic === true && held.name === 'comparison', 'held slot keeps its skeleton position');
  ok(held.title === '毕业门槛设计', "held slot wears the content's own title");
  ok(!/alternatives/.test(held.purpose), 'specialist costume removed from purpose');

  // rescue path applies the hold when fit score is 0 (CJK vs EN purposes)
  const mkSlot3 = (name, purpose) => ({ name, title: name, purpose, recommended_atoms: [] });
  const asn2 = [
    { slotIdx: 0, slot: mkSlot3('cover', 'headline'), slideIdx: 0, empty: false },
    { slotIdx: 1, slot: mkSlot3('comparison', 'versus alternatives head-to-head'), empty: true },
  ];
  const cjkSlides = [
    { title: '封面', body: ['x'] },
    { title: '机制设计', body: ['规则参数'] },
  ];
  rescueEmptyMapping(asn2, cjkSlides, 2);
  ok(
    asn2[1].empty === false && asn2[1].slot.generic === true,
    'rescued CJK slide gets the generic hold, not the specialist costume',
  );
  // and a genuinely matching slide keeps the specialist slot
  const asn3 = [
    { slotIdx: 0, slot: mkSlot3('cover', 'headline'), slideIdx: 0, empty: false },
    { slotIdx: 1, slot: mkSlot3('risks', 'risks scenarios probability impact'), empty: true },
  ];
  const enSlides = [
    { title: 'Cover', body: ['x'] },
    { title: 'Risks', body: ['probability and impact of scenarios'] },
  ];
  rescueEmptyMapping(asn3, enSlides, 2);
  ok(
    asn3[1].empty === false && !asn3[1].slot.generic,
    'a genuinely fitting slide keeps the specialist slot',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
