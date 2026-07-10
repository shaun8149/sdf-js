// test-quality-lights.mjs — Sprint 67: browser quality lights = offline eval
// semantics (visual audit + number grounding + Rule 24 derived citations).
import { assessSlot, assessDeck, buildSourceGrounding } from '../src/present/quality-lights.js';

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

const palette = { id: 't', bg: [248, 246, 240], accent: [38, 70, 130], colors: [[200, 60, 60]] };
const grounding = buildSourceGrounding([
  'revenue was $30.6 million, versus $4.5 million a year ago; 4,100 brands.',
]);

// clean slot: grounded number, sane layout
{
  const a = await assessSlot(
    {
      sceneData: {
        subjects: [
          {
            type: 'kpi-card',
            x: 40,
            y: 60,
            w: 1200,
            h: 300,
            args: { value: '$30.6M', label: 'Revenue' },
          },
          {
            type: 'bullet-list',
            x: 40,
            y: 400,
            w: 1200,
            h: 280,
            args: {
              title: 'Notes',
              items: ['4,100 brands', 'steady growth', 'expansion continues', 'plan on track'],
            },
          },
        ],
      },
    },
    { palette, grounding },
  );
  ok(a.level === 'ok', `clean slot is 🟢 (${a.summary})`);
}

// hallucinated number → bad
{
  const a = await assessSlot(
    {
      sceneData: {
        subjects: [
          {
            type: 'kpi-card',
            x: 40,
            y: 60,
            w: 1200,
            h: 300,
            args: { value: '$99.9M', label: 'Revenue' },
          },
          {
            type: 'bullet-list',
            x: 40,
            y: 400,
            w: 1200,
            h: 280,
            args: {
              title: 'Notes',
              items: ['4,100 brands', 'steady growth', 'expansion continues', 'plan on track'],
            },
          },
        ],
      },
    },
    { palette, grounding },
  );
  ok(
    a.level === 'bad' && a.hallucinated.includes('$99.9M'),
    `ungrounded number is 🔴 (${a.hallucinated})`,
  );
}

// derived + cited → ok (Rule 24 semantics in the browser)
{
  const a = await assessSlot(
    {
      sceneData: {
        subjects: [
          {
            type: 'kpi-card',
            x: 40,
            y: 60,
            w: 1200,
            h: 300,
            args: { value: '$30.6M', label: '+580% (30.6 vs 4.5)' },
          },
          {
            type: 'bullet-list',
            x: 40,
            y: 400,
            w: 1200,
            h: 280,
            args: {
              title: 'Notes',
              items: ['4,100 brands', 'steady growth', 'expansion continues', 'plan on track'],
            },
          },
        ],
      },
    },
    { palette, grounding },
  );
  ok(
    a.level === 'ok' && a.derivedCited >= 1,
    `derived-cited value stays 🟢 (cited ×${a.derivedCited})`,
  );
}

// overlapping subjects → visual error → bad, even without grounding
{
  const a = await assessSlot(
    {
      sceneData: {
        subjects: [
          { type: 'kpi-card', x: 100, y: 100, w: 400, h: 300, args: { value: '1', label: 'a' } },
          { type: 'kpi-card', x: 150, y: 150, w: 400, h: 300, args: { value: '2', label: 'b' } },
        ],
      },
    },
    { palette, grounding: null },
  );
  ok(
    a.level === 'bad' && a.visual.some((i) => i.kind === 'SUBJECT_OVERLAP'),
    `overlap is 🔴 (${a.visual.map((i) => i.kind)})`,
  );
}

// deck-level counts
{
  const deck = {
    theme: palette,
    slots: [
      {
        sceneData: {
          subjects: [
            { type: 'kpi-card', x: 40, y: 60, w: 1200, h: 300, args: { value: '$30.6M' } },
            {
              type: 'bullet-list',
              x: 40,
              y: 400,
              w: 1200,
              h: 280,
              args: {
                title: 'Notes',
                items: ['4,100 brands', 'steady growth', 'expansion continues', 'plan on track'],
              },
            },
          ],
        },
      },
      {
        sceneData: {
          subjects: [
            { type: 'kpi-card', x: 40, y: 60, w: 1200, h: 300, args: { value: '$77.7M' } },
            {
              type: 'bullet-list',
              x: 40,
              y: 400,
              w: 1200,
              h: 280,
              args: {
                title: 'Notes',
                items: ['4,100 brands', 'steady growth', 'expansion continues', 'plan on track'],
              },
            },
          ],
        },
      },
    ],
  };
  const { counts, grounded } = await assessDeck(deck, {
    sourceTexts: ['revenue was $30.6 million; 4,100 brands on the platform'],
  });
  ok(
    grounded && counts.ok === 1 && counts.bad === 1,
    `deck counts ok=1 bad=1 (${JSON.stringify(counts)})`,
  );
  const noSrc = await assessDeck(deck, { sourceTexts: [] });
  ok(!noSrc.grounded && noSrc.counts.bad === 0, 'without source text only the visual axis runs');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
