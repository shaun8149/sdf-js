#!/usr/bin/env node
// test-retheme.mjs — Sprint 39: zero-cost theme switching mechanics.
import { rethemeDeck, applySectionAccents, slotPalette } from '../src/present/retheme.js';
import { getTheme } from '../src/present/themes.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== retheme (Sprint 39: 一键换主题, 零 LLM 成本) ===\n');

const navy = getTheme('editorial-navy');
const teal = getTheme('organic-teal');
const [nr, ng, nb] = navy.accent;

function makeDeck() {
  return {
    title: 't',
    theme: navy,
    slots: [
      {
        slotIdx: 0,
        sceneData: {
          subjects: [
            {
              type: 'icon-row',
              x: 0,
              y: 0,
              w: 100,
              h: 100,
              args: {
                items: [{ icon: 'shield', label: 'A', iconColor: `rgb(${nr}, ${ng}, ${nb})` }],
                pillars: [{ accent: [...navy.accent] }],
                note: `uses rgba(${nr}, ${ng}, ${nb}, 0.55) wash`,
                custom: 'rgb(200, 10, 10)',
                customArr: [200, 10, 10],
              },
            },
          ],
        },
        liftParams: { theme: navy },
      },
    ],
  };
}

{
  const deck = makeDeck();
  rethemeDeck(deck, 'organic-teal');
  const args = deck.slots[0].sceneData.subjects[0].args;
  const [tr, tg, tb] = teal.accent;
  ok(deck.theme.id === 'organic-teal', 'deck.theme swapped');
  ok(
    args.items[0].iconColor === `rgb(${tr}, ${tg}, ${tb})`,
    'rgb() string arg remapped to new accent',
  );
  ok(
    args.pillars[0].accent[0] === tr && args.pillars[0].accent[2] === tb,
    'numeric triple arg remapped',
  );
  ok(args.note.includes(`rgba(${tr}, ${tg}, ${tb}, 0.55)`), 'rgba keeps its alpha');
  ok(args.custom === 'rgb(200, 10, 10)', 'non-theme string color untouched');
  ok(args.customArr[0] === 200, 'non-theme triple untouched');
  ok(
    deck.slots[0].liftParams.theme.id === 'organic-teal',
    'liftParams.theme follows (re-rolls use new theme)',
  );
}

{
  const deck = makeDeck();
  rethemeDeck(deck, 'organic-teal');
  rethemeDeck(deck, 'editorial-navy');
  const args = deck.slots[0].sceneData.subjects[0].args;
  ok(args.items[0].iconColor === `rgb(${nr}, ${ng}, ${nb})`, 'round-trip restores original colors');
}

{
  const deck = makeDeck();
  let threw = null;
  try {
    rethemeDeck(deck, 'nonexistent-theme');
  } catch (e) {
    threw = e.message;
  }
  ok(/unknown theme/.test(threw || ''), 'unknown theme id throws');
  ok(deck.theme.id === 'editorial-navy', 'failed switch leaves deck untouched');
}

// ── Sprint 72: section accent programming ──
{
  const mk = (name) => ({
    slotIdx: 0,
    slotName: name,
    sceneData: { subjects: [{ type: 'kpi-card', args: { iconColor: 'rgb(38, 70, 130)' } }] },
  });
  const deck = {
    theme: 'editorial-spectrum',
    slots: [
      mk('cover'),
      mk('theme-1-lead'),
      mk('theme-1-detail'),
      mk('theme-2-lead'),
      mk('summary'),
    ],
  };
  ok(applySectionAccents(deck) === true, 'section accents applied on a rich palette');
  ok(!deck.slots[0].sectionAccent && !deck.slots[4].sectionAccent, 'cover/summary hold the anchor');
  ok(!!deck.slots[1].sectionAccent, 'content sections get hues');
  ok(
    JSON.stringify(deck.slots[1].sectionAccent) === JSON.stringify(deck.slots[2].sectionAccent),
    'lead+detail of one theme share one hue',
  );
  ok(
    JSON.stringify(deck.slots[1].sectionAccent) !== JSON.stringify(deck.slots[3].sectionAccent),
    'different themes hold different hues',
  );
  const icon = deck.slots[1].sceneData.subjects[0].args.iconColor;
  const [r2, g2, b2] = deck.slots[1].sectionAccent;
  ok(icon === `rgb(${r2}, ${g2}, ${b2})`, 'baked anchor colors remapped to the section hue');
  const pal = slotPalette(
    {
      id: 't',
      accent: [38, 70, 130],
      colors: [
        [38, 70, 130],
        [9, 9, 9],
      ],
    },
    deck.slots[1],
  );
  ok(
    JSON.stringify(pal.accent) === JSON.stringify(deck.slots[1].sectionAccent) &&
      JSON.stringify(pal.colors[0]) === JSON.stringify(deck.slots[1].sectionAccent),
    'slotPalette overrides accent and colors[0]',
  );
  const deckNarrow = {
    theme: { id: 'x', accent: [1, 1, 1], colors: [[1, 1, 1]] },
    slots: [mk('theme-1-lead')],
  };
  ok(applySectionAccents(deckNarrow) === false, 'palette too narrow → untouched');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
