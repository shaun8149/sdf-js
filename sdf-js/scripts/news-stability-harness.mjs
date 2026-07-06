#!/usr/bin/env node
// =============================================================================
// news-stability-harness.mjs — Sprint 30 acceptance: "任意 500 字新闻 →
// 稳定 10-20 页". Runs news-to-deck over every article fixture N times and
// reports page count + score + fidelity per run. PASS = every run in band.
//
// Usage:
//   node sdf-js/scripts/news-stability-harness.mjs --key-file key.txt [--runs 2]
// =============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const REPO = new URL('../..', import.meta.url).pathname;
const FIX = `${REPO}sdf-js/scripts/scaffold-pipeline-fixtures`;
const args = process.argv.slice(2);
const arg = (n, fb = null) => {
  const i = args.indexOf(n);
  return i > -1 ? args[i + 1] : fb;
};
const KEY_FILE = arg('--key-file', 'key.txt');
const RUNS = Number(arg('--runs', 2));

const ARTICLES = [
  { id: 'econ', text: `${FIX}/econ-news-excerpt.txt` },
  { id: 'tech', text: `${FIX}/tech-news-excerpt.txt` },
  { id: 'policy', text: `${FIX}/policy-news-excerpt.txt` },
];

const rows = [];
for (const a of ARTICLES) {
  for (let r = 1; r <= RUNS; r++) {
    const deckName = `news-${a.id}-run${r}`;
    console.log(`\n════════ ${deckName} ════════`);
    const res = spawnSync(
      'node',
      [
        `${REPO}sdf-js/scripts/news-to-deck.mjs`,
        '--text',
        a.text,
        '--deck-name',
        deckName,
        '--key-file',
        KEY_FILE,
      ],
      { stdio: 'inherit', env: process.env },
    );
    const deckDir = `${REPO}sdf-js/examples/scaffold-pipeline/${deckName}`;
    let pages = 0;
    let score = 0;
    let facts = 0;
    let ents = 0;
    if (existsSync(`${deckDir}/eval.json`)) {
      const ev = JSON.parse(readFileSync(`${deckDir}/eval.json`, 'utf8'));
      pages = ev.structure.slots_baked;
      score = ev.score.total;
      facts = ev.fidelity ? Math.round(ev.fidelity.number_recall * 100) : -1;
      ents = ev.fidelity ? Math.round(ev.fidelity.entity_recall * 100) : -1;
    }
    rows.push({ deckName, pages, inBand: res.status === 0, score, facts, ents });
  }
}

console.log('\n══════════ STABILITY REPORT ══════════');
console.log('run                     pages  band   score   facts%  ents%');
let allPass = true;
for (const r of rows) {
  if (!r.inBand) allPass = false;
  console.log(
    `${r.deckName.padEnd(22)} ${String(r.pages).padStart(5)}  ${r.inBand ? '  ✓ ' : '  ✗ '}  ${String(r.score).padStart(5)}   ${String(r.facts).padStart(4)}    ${String(r.ents).padStart(4)}`,
  );
}
console.log(
  `\n${allPass ? 'PASS' : 'FAIL'}: ${rows.filter((r) => r.inBand).length}/${rows.length} runs in the 10-20 page band`,
);
process.exit(allPass ? 0 : 1);
