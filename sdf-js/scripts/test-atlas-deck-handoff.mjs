// test-atlas-deck-handoff.mjs — the 2D→3D deck-handoff contract, pinned in CI.
// Per the handoff note (#280 / docs/atlas-deck-contract.md §6): valid/ fixtures
// must all pass, invalid/ must each fail, and the ammo decks must consume
// end-to-end (atlas-deck → IR → staged deck → compile).
import { readFileSync, readdirSync } from 'node:fs';
import { validateDeck } from '../src/present/deck-spec.js';
import { atlasDeckToIR } from '../src/scene/scaffold-to-ir.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { compile } from '../src/scene/index.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== atlas-deck handoff (contract pinned in CI) ===\n');

const H = 'sdf-js/examples/deck-handoff';
const read = (p) => readFileSync(p, 'utf8');

// ---- golden fixtures: valid/ all ok, invalid/ each fails ----------------------
for (const f of readdirSync(`${H}/valid`).filter((x) => x.endsWith('.json'))) {
  const { ok: vok, errors } = validateDeck(read(`${H}/valid/${f}`));
  ok(vok, `valid/${f} passes${vok ? '' : ` — ${errors[0]}`}`);
}
for (const f of readdirSync(`${H}/invalid`).filter((x) => x.endsWith('.json'))) {
  const { ok: vok } = validateDeck(read(`${H}/invalid/${f}`));
  ok(!vok, `invalid/${f} is rejected`);
}

// ---- all 15 ammo decks validate + convert with usable coverage ---------------
const ammo = readdirSync(`${H}/ammo`).filter((x) => x.endsWith('.json'));
ok(ammo.length >= 15, `ammo has ≥15 decks (${ammo.length})`);
let totalSlots = 0,
  totalSlides = 0,
  zeroDecks = [];
for (const f of ammo) {
  const raw = read(`${H}/ammo/${f}`);
  const { ok: vok } = validateDeck(raw);
  if (!vok) {
    ok(false, `ammo/${f} validates`);
    continue;
  }
  const r = atlasDeckToIR(raw);
  totalSlots += r.report.length;
  totalSlides += r.slides.length;
  if (r.slides.length === 0) zeroDecks.push(f);
}
ok(
  zeroDecks.length === 0,
  `every ammo deck yields ≥1 slide${zeroDecks.length ? ` (zero: ${zeroDecks.join(', ')})` : ''}`,
);
console.log(`  · ammo coverage: ${totalSlides}/${totalSlots} slots → slides`);
// §9.5-3 hold fallback: page-count PARITY, not "usable coverage" — every slot
// becomes a station (structural IR or hold). Was 59/123 (48%) before Wave 1.
ok(
  totalSlides === totalSlots,
  `ammo slot coverage = 100% page parity (${totalSlides}/${totalSlots})`,
);

// ---- hold fallback shape (Wave 1) ---------------------------------------------
{
  const r = atlasDeckToIR(read(`${H}/ammo/eval-funding-round.json`));
  const holds = r.report.filter((x) => x.outcome === 'ir:hold(fallback)');
  ok(holds.length >= 4, `funding-round: no-structure pages fall back to hold (${holds.length})`);
  const tldr = r.slides[r.report.findIndex((x) => x.title === 'TL;DR')];
  ok(tldr && tldr.structure === 'hold', 'TL;DR page is a hold station');
  ok(
    tldr && typeof tldr.title === 'string' && tldr.title.length > 0,
    `hold title lifted from cover atom ("${tldr && tldr.title.slice(0, 40)}…")`,
  );
  ok(
    tldr &&
      Array.isArray(tldr.nodes) &&
      tldr.nodes.every((n) => typeof n === 'string' && n.length <= 90),
    `hold bullets are label-length strings only (${tldr ? tldr.nodes.length : 0})`,
  );
}

// ---- the recommended first target, end to end ---------------------------------
{
  const r = atlasDeckToIR(read(`${H}/ammo/eval-qbr-earnings.json`));
  ok(r.slides.length >= 6, `qbr-earnings: ≥6 slides (${r.slides.length}/10)`);
  const scene = assembleDeck({ title: r.title, slides: r.slides }, { stage: true });
  ok(
    scene.subjects.filter((s) => s.id.includes('stage-platform')).length === r.slides.length,
    'staged: platform per station',
  );
  try {
    compile(scene, {});
    ok(true, 'atlas-deck → IR → staged deck → ONE compiled scene');
  } catch (e) {
    ok(false, `compile failed: ${e.message.slice(0, 120)}`);
  }
}

// ---- contract details our adapter honors --------------------------------------
{
  // subjects/atoms alias (§5)
  const alias = {
    format: 'atlas-deck',
    version: 1,
    title: 'alias',
    slots: [
      {
        sceneData: {
          atoms: [
            { type: 'kpi-card', args: { value: '$10M', label: 'A' } },
            { type: 'kpi-card', args: { value: '$4M', label: 'B' } },
          ],
        },
      },
    ],
  };
  const r = atlasDeckToIR(alias);
  ok(r.slides.length === 1, 'atoms alias accepted (§5 synonym)');

  // mixed-unit KPI page stays unaggregated (bars must not lie)
  const mixed = {
    format: 'atlas-deck',
    version: 1,
    title: 'mixed',
    slots: [
      {
        sceneData: {
          subjects: [
            { type: 'kpi-card', args: { value: '$10M', label: 'Revenue' } },
            { type: 'kpi-card', args: { value: '+69%', label: 'Growth' } },
          ],
        },
      },
    ],
  };
  // Since the §9.5-3 hold fallback, the page still becomes a station (page-
  // count parity) — the assertion's spirit is that it must never become a
  // MAGNITUDE (bars comparing $ against % would lie).
  const mixedIR = atlasDeckToIR(mixed).slides[0];
  ok(
    mixedIR && mixedIR.structure === 'hold',
    `mixed-unit KPI page not force-aggregated (got ${mixedIR ? mixedIR.structure : 'nothing'})`,
  );

  // contract violation → reject with the validator's error
  let threw = null;
  try {
    atlasDeckToIR({ format: 'atlas-deck', version: 1 });
  } catch (e) {
    threw = e;
  }
  ok(
    !!threw && /contract violation/.test(threw.message),
    'invalid deck rejected with contract error',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
