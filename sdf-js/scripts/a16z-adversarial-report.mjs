#!/usr/bin/env node
// =============================================================================
// a16z-adversarial-report.mjs — Sprint 33: adversarial verification over the
// 20-article a16z batch. Three independent checks per deck:
//   1. eval scorer (structure/variety/twin/lift/text + facts & entity recall)
//   2. ADVERSARIAL number precision — deck numbers with no source grounding
//   3. render smoke — every subject drawn against a stub ctx (crash = fail)
// Writes docs/superpowers/sprint33-a16z-adversarial.md with worst-first
// ranking so the next iteration knows exactly what to attack.
//
// Usage: node sdf-js/scripts/a16z-adversarial-report.mjs
// =============================================================================
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { scoreDeckQuality } from './eval-deck-quality.mjs';
import { renderAtom } from '../src/present/atoms-2d/registry.js';

const REPO = new URL('../..', import.meta.url).pathname;
const DECKS_DIR = `${REPO}sdf-js/examples/scaffold-pipeline`;
const FIX_DIR = `${REPO}sdf-js/scripts/scaffold-pipeline-fixtures/a16z`;

function stubCtx() {
  const noop = () => {};
  return {
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    arcTo: noop,
    ellipse: noop,
    rect: noop,
    roundRect: noop,
    clip: noop,
    stroke: noop,
    fill: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    fillText: noop,
    strokeText: noop,
    setLineDash: noop,
    drawImage: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    transform: noop,
    setTransform: noop,
    measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
  };
}

const manifest = JSON.parse(readFileSync(join(FIX_DIR, 'manifest.json'), 'utf8'));
const ids = Object.keys(manifest);
const rows = [];

for (const id of ids) {
  const deckDir = join(DECKS_DIR, `a16z-${id}`);
  if (!existsSync(join(deckDir, 'deck.json'))) {
    rows.push({ id, missing: true });
    continue;
  }
  const ev = await scoreDeckQuality(deckDir);

  // render smoke: every subject of every slot
  const renderFailures = [];
  for (const f of readdirSync(join(deckDir, 'slots'))) {
    const lift = JSON.parse(readFileSync(join(deckDir, 'slots', f), 'utf8'));
    for (const subj of lift.sceneData?.subjects || []) {
      try {
        await renderAtom(stubCtx(), subj.type, subj.args, 'pseudo3d', {
          x: subj.x ?? 0,
          y: subj.y ?? 0,
          w: subj.w ?? 320,
          h: subj.h ?? 240,
          palette: ev.theme || {
            bg: [247, 244, 224],
            silhouetteColor: [30, 27, 30],
            accent: [38, 70, 130],
            colors: [[38, 70, 130]],
          },
        });
      } catch (e) {
        renderFailures.push({ slot: f, type: subj.type, error: e.message.slice(0, 120) });
      }
    }
  }

  const f = ev.fidelity || {};
  rows.push({
    id,
    pages: ev.structure.slots_baked,
    inBand: ev.structure.slots_baked >= 10 && ev.structure.slots_baked <= 20,
    score: ev.score.total,
    facts: f.number_recall != null ? Math.round(f.number_recall * 100) : null,
    ents: f.entity_recall != null ? Math.round(f.entity_recall * 100) : null,
    precision: f.number_precision != null ? Math.round(f.number_precision * 100) : null,
    entPrecision: f.entity_precision != null ? Math.round(f.entity_precision * 100) : null,
    inventedEntities: f.hallucinated_entities || [],
    hallucinated: f.hallucinated_numbers || [],
    visualIssues: ev.visual?.total ?? 0,
    visualCounts: ev.visual?.counts || {},
    missingNumbers: f.missing_numbers || [],
    missingEntities: f.missing_entities || [],
    renderFailures,
  });
}

// worst-first: any render failure, then out-of-band, then by precision, then facts
rows.sort((a, b) => {
  if (a.missing || b.missing) return a.missing ? -1 : 1;
  if (a.renderFailures.length !== b.renderFailures.length)
    return b.renderFailures.length - a.renderFailures.length;
  if (a.inBand !== b.inBand) return a.inBand ? 1 : -1;
  if ((a.precision ?? 100) !== (b.precision ?? 100))
    return (a.precision ?? 100) - (b.precision ?? 100);
  if ((a.entPrecision ?? 100) !== (b.entPrecision ?? 100))
    return (a.entPrecision ?? 100) - (b.entPrecision ?? 100);
  return (a.facts ?? 100) - (b.facts ?? 100);
});

console.log(
  '\ndeck                      pages band score facts% ents% prec% entP% visual  renderFail',
);
for (const r of rows) {
  if (r.missing) {
    console.log(`${r.id.padEnd(26)} MISSING (bake failed?)`);
    continue;
  }
  console.log(
    `${r.id.padEnd(26)}${String(r.pages).padStart(4)}  ${r.inBand ? ' ✓  ' : ' ✗  '}${String(r.score).padStart(5)}${String(r.facts ?? '—').padStart(6)}${String(r.ents ?? '—').padStart(6)}${String(r.precision ?? '—').padStart(6)}${String(r.entPrecision ?? '—').padStart(6)}${String(r.visualIssues || 0).padStart(7)}  ${r.renderFailures.length || ''}`,
  );
  if (r.hallucinated.length) console.log(`    HALLUC#: ${r.hallucinated.join(', ')}`);
  if (r.inventedEntities.length) console.log(`    INVENTED-ENT: ${r.inventedEntities.join(', ')}`);
  if (r.missingNumbers.length) console.log(`    missing#: ${r.missingNumbers.join(', ')}`);
  for (const rf of r.renderFailures)
    console.log(`    RENDER ✗ ${rf.type} (${rf.slot}): ${rf.error}`);
}

const ok = rows.filter((r) => !r.missing);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const summary = {
  decks: ok.length,
  missing: rows.length - ok.length,
  inBand: ok.filter((r) => r.inBand).length,
  meanScore: +mean(ok.map((r) => r.score)).toFixed(1),
  meanFacts: +mean(ok.filter((r) => r.facts != null).map((r) => r.facts)).toFixed(1),
  meanEnts: +mean(ok.filter((r) => r.ents != null).map((r) => r.ents)).toFixed(1),
  meanPrecision: +mean(ok.filter((r) => r.precision != null).map((r) => r.precision)).toFixed(1),
  meanEntPrecision: +mean(
    ok.filter((r) => r.entPrecision != null).map((r) => r.entPrecision),
  ).toFixed(1),
  totalRenderFailures: ok.reduce((s, r) => s + r.renderFailures.length, 0),
};
console.log(`\nSUMMARY ${JSON.stringify(summary)}`);

// markdown report
let md = `# Sprint 33 — a16z 20 篇对抗验证报告 (${new Date().toISOString().slice(0, 10)})\n\n`;
md += `20 篇 a16z 文章摘录 (英文, 风格从数据密集报告到概念宣言) 打穿 news-to-deck 全链。\n`;
md += `三路独立对抗检查: eval scorer / **number precision** (幻觉数字) / 全 subject 渲染冒烟。\n\n`;
md += `**Summary**: ${summary.decks} decks, ${summary.inBand}/${summary.decks} in [10,20] band, mean score ${summary.meanScore}, facts ${summary.meanFacts}%, entities ${summary.meanEnts}%, precision ${summary.meanPrecision}%, render failures ${summary.totalRenderFailures}\n\n`;
md += `| deck | pages | band | score | facts% | ents% | prec% | halluc / renderFail |\n|---|---|---|---|---|---|---|---|\n`;
for (const r of rows) {
  if (r.missing) {
    md += `| ${r.id} | — | ✗ | — | — | — | — | BAKE FAILED |\n`;
    continue;
  }
  const notes = [
    r.hallucinated.length ? `halluc: ${r.hallucinated.join(' ')}` : '',
    r.renderFailures.length ? `render✗: ${r.renderFailures.map((x) => x.type).join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('; ');
  md += `| ${r.id} | ${r.pages} | ${r.inBand ? '✓' : '✗'} | ${r.score} | ${r.facts ?? '—'} | ${r.ents ?? '—'} | ${r.precision ?? '—'} | ${notes} |\n`;
}
writeFileSync(`${REPO}docs/superpowers/sprint33-a16z-adversarial.md`, md);
console.log(`\nWrote docs/superpowers/sprint33-a16z-adversarial.md`);
process.exit(summary.missing > 0 || summary.totalRenderFailures > 0 ? 1 : 0);
