// text-to-ir-eval.mjs — REAL-LLM end-to-end eval for the text → IR front-end.
// Needs ANTHROPIC_API_KEY (BYOK); not part of `npm test` (see regression/README).
//
//   ANTHROPIC_API_KEY=$(cat ~/.atlas-key) node sdf-js/scripts/regression/text-to-ir-eval.mjs
//
// For each case: textToIR (real model round) → structure choices vs expectation →
// assembleDeck({stage:true}) → compile. Reports one row per case + a summary.
// Results JSON saved next to this file (results/) for diffing across prompt changes.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { textToIR } from '../../src/scene/text-to-ir.js';
import { assembleDeck } from '../../src/scene/assemble-deck.js';
import { compile } from '../../src/scene/index.js';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.log('SKIP: ANTHROPIC_API_KEY not set');
  process.exit(0);
}

// expect: acceptable structure sets per remembered narrative point (order-free).
// `anyOf` = the slide set must be drawn from these; `mustInclude` = at least one of each.
const CASES = [
  {
    id: 'funnel-en-numbers',
    text: 'our funnel: 5000 visitors, 800 signups, 120 paying customers — push the conversion story',
    mustInclude: [['sequence']],
  },
  {
    id: 'magnitude-cn',
    text: '2025年营收按区域:美洲 890 万,亚太 620 万,欧洲 340 万,拉美 150 万,重点讲美洲的领先',
    mustInclude: [['magnitude']],
  },
  {
    id: 'hierarchy-en',
    text: 'our new org: CEO on top; under her a CTO and a COO; the CTO runs platform and apps teams; the COO runs sales and support',
    mustInclude: [['hierarchy']],
  },
  {
    id: 'network-en',
    text: 'the AI agent ecosystem: models, tooling, orchestration, evals and deployment all interconnect — models sit at the center of everything',
    mustInclude: [['network']],
  },
  {
    id: 'sequence-cn-nonum',
    text: '产品发布流程:立项、设计、开发、内测、公测、正式发布',
    mustInclude: [['sequence']],
  },
  {
    id: 'ambiguous-services',
    text: 'microservices: the gateway talks to auth, orders and inventory; orders also calls inventory and payments',
    mustInclude: [['network', 'hierarchy']], // either reading is defensible
  },
  {
    id: 'matrix-swot',
    text: 'SWOT for our startup: strengths are the team and the tech; weaknesses are cash and brand; opportunities: the AI wave; threats: incumbents',
    mustInclude: [['matrix']],
  },
  {
    id: 'pitch-3-points',
    text: 'Q3 review: revenue by region (Americas leads at 890), our sales funnel from 1200 leads to 45 closed, and the new org under the CEO',
    mustInclude: [['magnitude'], ['sequence'], ['hierarchy']],
  },
  {
    id: 'news-cn-messy',
    text: '据报道,某新能源车企第三季度交付量创新高:国内交付 18.2 万辆,欧洲 4.5 万辆,东南亚 1.8 万辆。公司称将继续推进从预订、锁单、生产到交付的全流程数字化,并强调国内市场仍是基本盘。',
    mustInclude: [['magnitude']], // sequence also plausible as a 2nd slide
  },
  {
    id: 'vague',
    text: 'why we win',
    mustInclude: [], // no expectation — probing behavior on near-empty input
  },
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'results');
mkdirSync(OUT_DIR, { recursive: true });

const rows = [];
let pass = 0,
  fail = 0;

for (const c of CASES) {
  const row = { id: c.id, ok: false };
  const t0 = Date.now();
  try {
    const deck = await textToIR(c.text, KEY);
    row.ms = Date.now() - t0;
    row.slides = deck.slides.map((s) => ({
      structure: s.structure,
      n: s.nodes.length,
      mag: s.magnitude || null,
      emphasis: s.emphasis ?? null,
      title: s.title,
    }));
    const structures = deck.slides.map((s) => s.structure);
    row.structures = structures;

    // structure expectation
    row.structOk = (c.mustInclude || []).every((alts) => alts.some((s) => structures.includes(s)));

    // staged assembly + compile (the author-page default path)
    try {
      const scene = assembleDeck(deck, { stage: true });
      compile(scene, {});
      row.assembleOk = true;
    } catch (e) {
      row.assembleOk = false;
      row.assembleErr = e.message.slice(0, 140);
    }

    row.ok = row.structOk && row.assembleOk;
  } catch (e) {
    row.ms = Date.now() - t0;
    row.err = e.message.slice(0, 200);
  }
  rows.push(row);
  row.ok ? pass++ : fail++;
  console.log(
    `${row.ok ? '✓' : '✗'} ${c.id.padEnd(20)} ${String(row.ms).padStart(6)}ms  ` +
      `[${(row.structures || []).join(' → ') || 'ERR'}]` +
      (row.structOk === false ? '  STRUCT-MISS' : '') +
      (row.assembleOk === false ? `  ASSEMBLE-FAIL: ${row.assembleErr}` : '') +
      (row.err ? `  ERR: ${row.err}` : ''),
  );
  await new Promise((r) => setTimeout(r, 400)); // gentle pacing
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
writeFileSync(resolve(OUT_DIR, `text-to-ir-${stamp}.json`), JSON.stringify(rows, null, 2));
console.log(
  `\n${pass}/${CASES.length} pass — details in scripts/regression/results/text-to-ir-${stamp}.json`,
);
