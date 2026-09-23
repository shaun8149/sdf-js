// sdf-js/scripts/test-figure-load.mjs — figure.html must fail loud on bad deck links.
import { loadFigureIR, showFigureLoadError } from '../apps/present/figure-load.js';

let pass = 0;
let fail = 0;
const ok = (condition, name) =>
  condition ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.log(`  ✗ ${name}`));
const same = (actual, expected, name) =>
  ok(JSON.stringify(actual) === JSON.stringify(expected), `${name} (${JSON.stringify(actual)})`);

async function rejects(fn, pattern, name) {
  try {
    await fn();
    ok(false, name);
  } catch (e) {
    ok(pattern.test(e.message), `${name} (${e.message})`);
  }
}

function makeDoc() {
  const loading = {
    children: [],
    replaceChildren(...children) {
      this.children = children;
    },
  };
  const createElement = () => ({
    className: '',
    style: {},
    textContent: '',
    children: [],
    append(...children) {
      this.children.push(...children);
    },
  });
  return {
    loading,
    getElementById: (id) => (id === 'loading' ? loading : null),
    createElement,
  };
}

console.log('=== figure load fail-loud ===\n');

{
  const seen = [];
  const ir = await loadFigureIR({
    irName: 'funnel-sales',
    fetchImpl: async (url) => {
      seen.push(url);
      return { ok: true, json: async () => ({ structure: 'magnitude' }) };
    },
  });
  same(seen, ['../../scenes/ir/funnel-sales.json'], 'IR path resolves to scenes/ir');
  ok(ir.structure === 'magnitude', 'valid single IR passes through');
}

{
  const deck = await loadFigureIR({
    deckName: 'flagship',
    fetchImpl: async () => ({ ok: true, json: async () => ({ slides: [{ title: 'one' }] }) }),
  });
  ok(deck.slides.length === 1, 'valid deck JSON passes through');
}

await rejects(
  () =>
    loadFigureIR({
      deckName: 'missing',
      fetchImpl: async () => ({ ok: false, status: 404, statusText: 'Not Found' }),
    }),
  /Unable to load deck "missing" \(HTTP 404 Not Found\)/,
  'missing deck reports HTTP status',
);

await rejects(
  () =>
    loadFigureIR({
      deckName: 'broken-json',
      fetchImpl: async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      }),
    }),
  /Unable to parse deck "broken-json" JSON: Unexpected token </,
  'HTML or malformed JSON reports parse failure',
);

await rejects(
  () =>
    loadFigureIR({
      deckName: 'empty',
      fetchImpl: async () => ({ ok: true, json: async () => ({ title: 'empty' }) }),
    }),
  /Invalid deck "empty": missing non-empty slides\[\]/,
  'deck mode rejects JSON without slides',
);

{
  const doc = makeDoc();
  ok(showFigureLoadError(new Error('HTTP 404'), { documentObj: doc }), 'load error updates overlay');
  const box = doc.loading.children[0];
  ok(box.className === 'msg', 'overlay keeps loader message styling hook');
  same(
    box.children.map((c) => c.textContent),
    [
      'ATLAS·PRESENT',
      'Unable to load this deck. Please check the link or regenerate the deck JSON.',
      'HTTP 404',
    ],
    'overlay renders title, action text, and detail',
  );
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
