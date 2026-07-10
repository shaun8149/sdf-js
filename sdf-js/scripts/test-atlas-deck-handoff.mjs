// test-atlas-deck-handoff.mjs — the 2D→3D deck-handoff contract, pinned in CI.
// Per the handoff note (#280 / docs/atlas-deck-contract.md §6): valid/ fixtures
// must all pass, invalid/ must each fail, and the ammo decks must consume
// end-to-end (atlas-deck → IR → staged deck → compile).
import { readFileSync, readdirSync } from 'node:fs';
import { validateDeck } from '../src/present/deck-spec.js';
import { atlasDeckToIR, parseMagnitude } from '../src/scene/scaffold-to-ir.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { compile } from '../src/scene/index.js';

let pass = 0, fail = 0;
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
let totalSlots = 0, totalSlides = 0, zeroDecks = [];
for (const f of ammo) {
  const raw = read(`${H}/ammo/${f}`);
  const { ok: vok } = validateDeck(raw);
  if (!vok) { ok(false, `ammo/${f} validates`); continue; }
  const r = atlasDeckToIR(raw);
  totalSlots += r.report.length;
  totalSlides += r.slides.length;
  if (r.slides.length === 0) zeroDecks.push(f);
}
ok(zeroDecks.length === 0, `every ammo deck yields ≥1 slide${zeroDecks.length ? ` (zero: ${zeroDecks.join(', ')})` : ''}`);
console.log(`  · ammo coverage: ${totalSlides}/${totalSlots} slots → slides`);
ok(totalSlides / totalSlots >= 0.4, `ammo slot coverage ≥40% (${((totalSlides / totalSlots) * 100).toFixed(0)}%)`);

// ---- the recommended first target, end to end ---------------------------------
{
  const r = atlasDeckToIR(read(`${H}/ammo/eval-qbr-earnings.json`));
  ok(r.slides.length >= 6, `qbr-earnings: ≥6 slides (${r.slides.length}/10)`);
  const scene = assembleDeck({ title: r.title, slides: r.slides }, { stage: true });
  ok(scene.subjects.filter((s) => s.id.includes('stage-platform')).length === r.slides.length, 'staged: platform per station');
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
    format: 'atlas-deck', version: 1, title: 'alias',
    slots: [{ sceneData: { atoms: [
      { type: 'kpi-card', args: { value: '$10M', label: 'A' } },
      { type: 'kpi-card', args: { value: '$4M', label: 'B' } },
    ] } }],
  };
  const r = atlasDeckToIR(alias);
  ok(r.slides.length === 1, 'atoms alias accepted (§5 synonym)');

  // mixed-unit KPI page stays unaggregated (bars must not lie)
  const mixed = {
    format: 'atlas-deck', version: 1, title: 'mixed',
    slots: [{ sceneData: { subjects: [
      { type: 'kpi-card', args: { value: '$10M', label: 'Revenue' } },
      { type: 'kpi-card', args: { value: '+69%', label: 'Growth' } },
    ] } }],
  };
  ok(atlasDeckToIR(mixed).slides.length === 0, 'mixed-unit KPI page not force-aggregated');

  ok(parseMagnitude('$36-46M') === 41000000, 'KPI range midpoint parses with shared M suffix');
  ok(parseMagnitude('$963–969M') === 966000000, 'KPI range midpoint parses with en dash');

  const ranged = {
    format: 'atlas-deck', version: 1, title: 'ranges',
    slots: [{ slotTitle: 'Guidance', sceneData: { subjects: [
      { type: 'kpi-card', args: { value: '$36-46M', label: 'Q4 GAAP Operating Income' } },
      { type: 'kpi-card', args: { value: '$86-96M', label: 'Q4 Non-GAAP Operating Income' } },
      { type: 'kpi-card', args: { value: '$372.5M', label: 'Revenue' } },
    ] } }],
  };
  const rangedIr = atlasDeckToIR(ranged).slides[0];
  ok(rangedIr?.magnitude[0] === 41000000, 'range KPI page emits midpoint magnitude');
  ok(rangedIr?.display[0] === '$36-46M', 'range KPI page preserves human display value');

  const mixedScale = {
    format: 'atlas-deck', version: 1, title: 'mixed scale',
    slots: [{ sceneData: { subjects: [
      { type: 'kpi-card', args: { value: '$147.07', label: 'Average Price' } },
      { type: 'kpi-card', args: { value: '$240.5M', label: 'Remaining Authorization' } },
    ] } }],
  };
  ok(atlasDeckToIR(mixedScale).slides.length === 0, 'mixed-scale dollar KPIs are not force-aggregated');

  const dashboard = {
    format: 'atlas-deck', version: 1, title: 'dashboard',
    slots: [{ slotTitle: 'Financial Highlights', sceneData: { subjects: [
      { type: 'dashboard-multi-kpi-composite', args: { title: 'GAAP Performance', kpis: [
        { value: '$30.6M', label: 'Operating Income' },
        { value: '$16.5M', label: 'Net Income' },
        { value: '$0.19', label: 'EPS' },
      ] } },
    ] } }],
  };
  const dashboardIr = atlasDeckToIR(dashboard).slides[0];
  ok(dashboardIr?.nodes.length === 2 && !dashboardIr.nodes.includes('EPS'), 'dashboard KPI fallback drops incomparable EPS');
  ok(dashboardIr?.display[0] === '$30.6M', 'dashboard KPI values preserve human display strings');

  // contract violation → reject with the validator's error
  let threw = null;
  try { atlasDeckToIR({ format: 'atlas-deck', version: 1 }); } catch (e) { threw = e; }
  ok(!!threw && /contract violation/.test(threw.message), 'invalid deck rejected with contract error');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
