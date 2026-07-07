#!/usr/bin/env node
// test-slide-reroll.mjs — Sprint 38: per-slide re-roll / revision mechanics
// (no LLM — liftFn injection; the prompt-side revision block is asserted
// as text).
import { buildSlotUserMessage } from '../src/present/scaffolds/lift-slot-llm.js';
import { reliftSlot } from '../src/present/news/full-deck.js';
import { getScaffold, getThemeAffinity } from '../src/present/scaffolds/registry.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== slide re-roll (Sprint 38: 生成→微调→导出 闭环) ===\n');

const scaffold = getScaffold('news-briefing');
const theme = getThemeAffinity(scaffold)[0];
const slide = { title: '增长预测', body: ['IMF 3.3%', 'OECD 2.9%'] };
const baseParams = {
  scaffold,
  slot: scaffold.slots[3],
  slotIdx: 3,
  slideIdx: 1,
  theme,
  slide,
  slides: [slide],
  extraSlides: [],
};

// ── revision block in the prompt ──
{
  const plain = buildSlotUserMessage(baseParams);
  const revised = buildSlotUserMessage({ ...baseParams, revision: '换成柱状图' });
  ok(!plain.includes('USER REVISION REQUEST'), 'no revision block without revision');
  ok(revised.includes('USER REVISION REQUEST'), 'revision block present');
  ok(revised.includes('换成柱状图'), 'revision text carried verbatim');
  ok(
    revised.includes('never the underlying facts'),
    'revision constrained by fidelity rules (presentation-only)',
  );
  ok(
    revised.indexOf('USER REVISION REQUEST') < revised.indexOf('## OUTPUT'),
    'revision sits before the OUTPUT contract',
  );
  // quotes in the revision must not break the prompt quoting
  const tricky = buildSlotUserMessage({ ...baseParams, revision: 'say "hello" twice' });
  ok(tricky.includes("say 'hello' twice"), 'double quotes in revision are neutralized');
}

// ── reliftSlot mechanics (injected liftFn) ──
{
  const deck = {
    title: 't',
    theme,
    scaffold: { id: scaffold.id },
    slots: [
      {
        slotIdx: 3,
        slotName: 'theme-1-lead',
        slotTitle: 'Theme 1',
        sceneData: { subjects: [{ type: 'pie', x: 0, y: 0, w: 100, h: 100, args: {} }] },
        liftParams: baseParams,
      },
      { slotIdx: 4, slotName: 'x', sceneData: { subjects: [] } },
    ],
  };
  const calls = [];
  const fakeLift = async (params, opts) => {
    calls.push({ revision: params.revision, hasSystem: !!opts.systemPrompt });
    return { sceneData: { subjects: [{ type: 'bar', x: 0, y: 0, w: 100, h: 100, args: {} }] } };
  };

  const sceneData = await reliftSlot(deck, 3, {
    apiKey: 'k',
    revision: '换成柱状图',
    liftFn: fakeLift,
  });
  ok(sceneData.subjects[0].type === 'bar', 'returns the new sceneData');
  ok(deck.slots[0].sceneData.subjects[0].type === 'bar', 'deck mutated in place (exports follow)');
  ok(calls[0].revision === '换成柱状图', 'revision forwarded to the lift');
  ok(calls[0].hasSystem, 'system prompt supplied (cache-friendly)');

  await reliftSlot(deck, 3, { apiKey: 'k', liftFn: fakeLift });
  ok(calls[1].revision === null, 'plain re-roll sends no revision');

  let threw = null;
  try {
    await reliftSlot(deck, 4, { apiKey: 'k', liftFn: fakeLift });
  } catch (e) {
    threw = e.message;
  }
  ok(/liftParams/.test(threw || ''), 'slot without liftParams throws a clear error');

  threw = null;
  try {
    await reliftSlot(deck, 99, { apiKey: 'k', liftFn: fakeLift });
  } catch (e) {
    threw = e.message;
  }
  ok(/no slot/.test(threw || ''), 'unknown slotIdx throws');
}

// ── Sprint 40: mergeLockedSlots ──
{
  const { mergeLockedSlots } = await import('../src/present/news/full-deck.js');
  const fresh = [
    { slotIdx: 0, slotName: 'cover', sceneData: { v: 'new0' } },
    { slotIdx: 3, slotName: 'lead', sceneData: { v: 'new3' } },
    { slotIdx: 5, slotName: 'risk', sceneData: { v: 'new5' } },
  ];
  const locked = [
    { slotIdx: 3, slotName: 'lead', sceneData: { v: 'PINNED3' } },
    { slotIdx: 9, slotName: 'quote', sceneData: { v: 'PINNED9' } },
  ];
  const merged = mergeLockedSlots(fresh, locked);
  ok(
    merged.find((s) => s.slotIdx === 3).sceneData.v === 'PINNED3',
    'pinned slot replaces the fresh one',
  );
  ok(merged.find((s) => s.slotIdx === 3).locked === true, 'merged slot carries locked flag');
  ok(
    merged.find((s) => s.slotIdx === 9)?.sceneData.v === 'PINNED9',
    'pinned slot survives even when new run dropped its slotIdx',
  );
  ok(
    merged.find((s) => s.slotIdx === 5).sceneData.v === 'new5',
    'unlocked slots come from the new run',
  );
  ok(merged.map((s) => s.slotIdx).join(',') === '0,3,5,9', 'merged list sorted by slotIdx');
  ok(mergeLockedSlots(fresh, []) === fresh, 'no locks → passthrough');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
