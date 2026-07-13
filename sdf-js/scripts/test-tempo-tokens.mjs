// sdf-js/scripts/test-tempo-tokens.mjs — Layer B temporal half: the breathing
// dial. Same discipline as layout-tokens: prove real CONSUMPTION (mutate a
// token → downstream durations re-derive), not just extraction theater.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TEMPO, introLead } from '../src/scene/tempo-tokens.js';
import { renderMagnitude } from '../src/scene/render-magnitude.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
const near = (a, b) => Math.abs(a - b) < 1e-9;
console.log('=== tempo tokens (Layer B: the breathing dial) ===\n');

const IR = { structure: 'magnitude', title: 'T', nodes: ['a', 'b', 'c'], magnitude: [1, 3, 2] };

// ---- consumption: render-magnitude --------------------------------------------
{
  const s = renderMagnitude(IR);
  ok(near(s.cameraSequence.shots[0].duration, TEMPO.hero), 'hero beat = TEMPO.hero');
  ok(near(s.cameraSequence.shots[1].duration, TEMPO.crane), 'crane beat = TEMPO.crane');
  ok(near(s.cameraSequence.shots.at(-1).duration, TEMPO.payoff), 'payoff beat = TEMPO.payoff');
  ok(near(introLead(), TEMPO.hero + TEMPO.crane), 'introLead = hero + crane');
}

// ---- consumption: deck-level beats ---------------------------------------------
{
  const scene = assembleDeck(DECK, { layout: 'courtyard' });
  const overlook = scene.cameraSequence.shots.find((sh) => sh.beat === 'overlook');
  ok(near(overlook.duration, TEMPO.overlook), 'overlook beat = TEMPO.overlook');
  ok(near(scene.cameraSequence.shots.at(-1).duration, TEMPO.finale), 'finale beat = TEMPO.finale');
}

// ---- the dial actually dials (mutate → re-derive → restore) ---------------------
{
  const orig = TEMPO.beatHold;
  TEMPO.beatHold = orig + 0.4;
  const s = renderMagnitude(IR);
  const track = s.cameraSequence.shots[2]; // first tracking beat
  ok(near(track.duration, orig + 0.4), 'changing TEMPO.beatHold re-derives the walk rhythm');
  // reveals ride the same clock — the label must still land on its beat
  // (role filter: insight reveals at payoff; short axis labels are world-
  // anchored cards since R4, longer node names ride the subtitle column)
  const firstReveal = s.overlay.find(
    (o) => (o.role === 'screen' || o.role === 'card') && o.revealAt != null,
  );
  ok(
    near(firstReveal.revealAt, TEMPO.hero + TEMPO.crane + 0.35),
    'reveal times re-derive from the same tokens (labels stay on beat)',
  );
  TEMPO.beatHold = orig;
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
