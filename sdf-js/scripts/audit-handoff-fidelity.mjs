// sdf-js/scripts/audit-handoff-fidelity.mjs — PRODUCT-PATH fidelity, pinned in
// CI. The sibling audit (audit-2d-fidelity) checks IR→3D; this one checks the
// lossier hop: 2D atlas-deck slots → IR (atlasDeckToIR). The covenant tested
// here is the numbers-are-payload rule: every VALUE the 2D page shows (kpi
// value, stat-banner value, donut centre readout) must survive into the IR —
// as a magnitude display string on aggregated pages, or as a hold bullet on
// no-structure pages.
//
// Two severity tiers:
//   HARD (exits 1): a hold-fallback slot lost a value — pure extraction bug.
//   SOFT (reported): a STRUCTURAL slot's sibling atoms lost values (the
//     chosen structure can't carry a stray "$81M" from a neighboring card —
//     IR has no notes channel yet; candidate for the §9.5 conversation).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { atlasDeckToIR } from '../src/scene/scaffold-to-ir.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AMMO = resolve(__dirname, '../examples/deck-handoff/ammo');

function payloadValues(sceneData) {
  const subjects = sceneData.subjects || sceneData.atoms || [];
  const vals = [];
  for (const s of subjects) {
    const a = (s && s.args) || {};
    if ((s.type === 'kpi-card' || s.type === 'stat-banner') && a.value != null)
      vals.push(String(a.value).trim());
    if (a.centerValue != null) vals.push(String(a.centerValue).trim());
    if (s.type === 'dashboard-multi-kpi-composite' && Array.isArray(a.kpis))
      for (const k of a.kpis) if (k && k.value != null) vals.push(String(k.value).trim());
  }
  return vals.filter((v) => v.length > 0 && v.length <= 40);
}

let hard = 0,
  soft = 0;
for (const f of readdirSync(AMMO).filter((x) => x.endsWith('.json'))) {
  const raw = readFileSync(`${AMMO}/${f}`, 'utf8');
  const deck = JSON.parse(raw);
  const { slides, report } = atlasDeckToIR(raw);
  const lines = [];
  (deck.slots || []).forEach((slot, i) => {
    const r = report[i];
    const slideIdx = report.slice(0, i + 1).filter((x) => x.outcome.startsWith('ir:')).length - 1;
    if (!r.outcome.startsWith('ir:')) return;
    const ir = slides[slideIdx];
    const irText = [
      ir.title,
      ...(ir.nodes || []).map((n) => (typeof n === 'string' ? n : n.label)),
      ...(ir.display || []),
    ]
      .filter(Boolean)
      .join(' | ');
    for (const v of payloadValues(slot.sceneData || {})) {
      if (irText.includes(v)) continue;
      if (r.outcome === 'ir:hold(fallback)') {
        hard++;
        lines.push(`  ✗ HARD [${r.title}] hold lost value "${v}"`);
      } else {
        soft++;
        lines.push(`  · soft [${r.title}] ${r.outcome} sibling lost value "${v}"`);
      }
    }
  });
  if (lines.length) {
    console.log(`=== ${f} ===`);
    lines.forEach((l) => console.log(l));
  }
}
console.log(
  `\nhold-fallback value losses (HARD): ${hard} · structural sibling losses (soft, backlog): ${soft}`,
);
process.exit(hard ? 1 : 0);
