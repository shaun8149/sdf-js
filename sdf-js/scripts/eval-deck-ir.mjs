#!/usr/bin/env node
// =============================================================================
// eval-deck-ir.mjs — golden regression for the slides→IR extractor
// -----------------------------------------------------------------------------
// The measuring stick that turns prompt tuning from whack-a-mole into
// engineering: fixtures/ir-eval/*.json hold per-page expected-IR checks whose
// ground truth was settled by adversarial supervisor audits + rendered-page
// adjudications. This script runs the PRODUCTION extractor (the shared core
// in src/mapping/slide-to-ir.js — same prompt, same retries, same gate) over
// every golden page and scores the result.
//
// Costs real LLM calls (~$0.01-0.03/page) → NOT in CI, run on demand:
//   ANTHROPIC_API_KEY=... node sdf-js/scripts/eval-deck-ir.mjs             # text mode
//   ANTHROPIC_API_KEY=... node sdf-js/scripts/eval-deck-ir.mjs \
//       --images-bp2015 sdf-js/fixtures/pages/bp2015                        # vision for a suite
//   --save results.json  --suite bp2015                                     # subset / persist
//
// Check types (see fixtures/ir-eval/*.json):
//   structure {anyOf}          — ir.structure in set
//   form {anyOf}               — ir.form/orientation in set
//   values {equals}            — numeric multiset of ALL ir values == target
//   valuesContain {values}     — every target number present
//   valuesAnyOf {sets}         — at least one set fully present
//   approxOrHonest {target,tol}— (vision) multiset ≈ target within rel. tol;
//                                (text) ALSO passes on an honest needsReview
//                                hold with no numbers — fabrication fails.
//   trend {direction}          — emitted series rises/falls (only if numbers)
//   forbidden {values}         — none of these appear (axis ticks)
//   pair {label,value}         — node whose label contains `label` maps to value
//   milestone {date,label}     — roadmap milestone with date has label substring
//   milestoneNot {date,label}  — that pairing must NOT exist
//   containsText {all}         — every substring appears in nodes/axes text
//   mentions {text}            — substring appears anywhere in the IR JSON
//   noContact                  — no phone numbers / emails anywhere in the IR
// =============================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractSlideIR, ladderOverlap } from '../src/mapping/slide-to-ir.js';
import { pageLadders } from '../src/mapping/slide-digest.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY env var required (eval calls the real extractor).');
  process.exit(1);
}
// Pinned to a DATED snapshot: the floating alias drifted overnight 2026-07-20→21
// and flipped 3 borderline golden pages (p16/p17 extraction, p18/p21 curve reads,
// d0961 hero-100%) with zero code change — an eval instrument must not float.
const MODEL = process.env.MODEL || 'claude-sonnet-4-5-20250929';
const REPO = fileURLToPath(new URL('../..', import.meta.url));

const arg = (flag, dflt = null) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const SUITE_FILTER = arg('--suite');
const SAVE = arg('--save');

let totalCost = 0;
async function callLLM({ system, user, maxTokens = 4000, temperature = 0 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      // pass the caller's temperature through: retry-warming (attempt 0 at
      // temp 0, retries at 0.5) is what breaks temp-0 validation dead-loops;
      // hardcoding 0 here silently disabled it and p16 failed 3 identical
      // attempts in a row while the SAME page passed in gen-deck-ir.
      temperature,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  totalCost += ((data.usage?.input_tokens ?? 0) * 3 + (data.usage?.output_tokens ?? 0) * 15) / 1e6;
  return data.content?.[0]?.text ?? '';
}

// ---- IR value extraction --------------------------------------------------------
function allValues(ir) {
  const out = [];
  // magnitude is a PROJECTION of series (contract: "keep magnitude = latest
  // series") — counting both double-counts every grouped chart.
  if (Array.isArray(ir.magnitude) && !Array.isArray(ir.series)) out.push(...ir.magnitude);
  if (Array.isArray(ir.series)) for (const s of ir.series) out.push(...(s.values || []));
  if (Array.isArray(ir.groups)) for (const g of ir.groups) out.push(...(g.values || []));
  return out.map(Number).filter((x) => Number.isFinite(x));
}
const multisetEq = (a, b) => {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => Math.abs(v - sb[i]) < 1e-9);
};
function approxMultiset(got, target, tol) {
  if (got.length !== target.length) return false;
  const g = [...got].sort((a, b) => a - b);
  const t = [...target].sort((a, b) => a - b);
  return g.every((v, i) => {
    const ref = Math.max(Math.abs(t[i]), 1e-9);
    return Math.abs(v - t[i]) / ref <= tol;
  });
}
const irText = (ir) => JSON.stringify(ir);

// node label ↔ value pairs across magnitude / series / groups
function labelValuePairs(ir) {
  const pairs = [];
  if (Array.isArray(ir.nodes) && Array.isArray(ir.magnitude))
    ir.nodes.forEach((n, i) => {
      const label = typeof n === 'string' ? n : (n && (n.label ?? '')) || '';
      pairs.push([label, Number(ir.magnitude[i])]);
    });
  if (Array.isArray(ir.groups))
    for (const g of ir.groups)
      (g.sliceLabels || []).forEach((sl, i) => pairs.push([String(sl), Number(g.values?.[i])]));
  return pairs;
}

// every candidate value list on the IR (each series separately + magnitude)
function seriesLists(ir) {
  const lists = [];
  if (Array.isArray(ir.series)) for (const s of ir.series) lists.push((s.values || []).map(Number));
  if (Array.isArray(ir.magnitude)) lists.push(ir.magnitude.map(Number));
  if (Array.isArray(ir.groups)) for (const g of ir.groups) lists.push((g.values || []).map(Number));
  return lists.filter((l) => l.length && l.every(Number.isFinite));
}
function curveMatch(vals, check) {
  const specs = check.anyOf || [check];
  const tol = check.tol ?? 0.3;
  const minPoints = check.minPoints ?? 4;
  if (vals.length < minPoints) return false;
  const first = vals[0];
  const last = vals[vals.length - 1];
  return specs.some((sp) => {
    const okStart = Math.abs(first - sp.start) / Math.max(Math.abs(sp.start), 1e-9) <= tol;
    const okEnd = Math.abs(last - sp.end) / Math.max(Math.abs(sp.end), 1e-9) <= tol;
    const dirOk =
      sp.direction === 'up' ? last > first : sp.direction === 'down' ? last < first : true;
    return okStart && okEnd && dirOk;
  });
}

// ---- check runner ----------------------------------------------------------------
function runCheck(check, ir, { vision, chartGeometry }) {
  const vals = allValues(ir);
  switch (check.type) {
    case 'structure':
      return check.anyOf.includes(ir.structure);
    case 'form':
      return check.anyOf.includes(ir.form || ir.orientation);
    case 'values':
      return multisetEq(vals, check.equals);
    case 'valuesIfAny':
      return vals.length === 0 || multisetEq(vals, check.equals);
    case 'valuesContain':
      return check.values.every((t) => vals.some((v) => Math.abs(v - t) < 1e-9));
    case 'valuesAnyOf':
      return check.sets.some((set) => set.every((t) => vals.some((v) => Math.abs(v - t) < 1e-9)));
    case 'approxOrHonest': {
      const honest = ir.structure === 'hold' && ir.needsReview && vals.length === 0;
      if (!vision) return honest || approxMultiset(vals, check.target, check.tol ?? 0.35);
      return approxMultiset(vals, check.target, check.tol ?? 0.35);
    }
    case 'trend': {
      if (vals.length < 2) return ir.needsReview === true; // honest gap allowed
      const rising = vals[vals.length - 1] > vals[0];
      return check.direction === 'up' ? rising : !rising;
    }
    case 'forbidden': {
      // Text mode: any tick value in the output is a copy — hard fail.
      // Vision mode: a legitimate chart read may LAND on a tick by
      // coincidence (新浪's true 19 sits on the 19 gridline); only a
      // majority overlap with the banned set marks a copy.
      if (!vision) return !check.values.some((t) => vals.some((v) => Math.abs(v - t) < 1e-9));
      return ladderOverlap(vals, [check.values]) < 0.6;
    }
    case 'curve': {
      // Chart-read series: judge SHAPE, not point count (the model may read
      // 11 monthly bars where the golden sampled 6). A series passes a spec
      // when its endpoints match within tol and it trends the right way.
      if (!vision)
        return (
          (ir.structure === 'hold' && ir.needsReview && vals.length === 0) ||
          seriesLists(ir).some((s) => curveMatch(s, check))
        );
      return seriesLists(ir).some((s) => curveMatch(s, check));
    }
    case 'pair': {
      const pairs = labelValuePairs(ir);
      const hit = pairs.find(([label]) => label.includes(check.label));
      return !!hit && Math.abs(hit[1] - check.value) < 1e-9;
    }
    case 'cellRow': {
      // matrix binding: the node containing check.node must sit in the
      // axes[1] row containing check.row (p4 过去/现在 swap regression lock)
      if (ir.structure !== 'matrix' || !ir.axes || !ir.cells) return false;
      const i = (ir.nodes || []).findIndex((n) => String(n).includes(check.node));
      if (i < 0 || !ir.cells[i]) return false;
      return String(ir.axes[1][ir.cells[i][1]] || '').includes(check.row);
    }
    case 'milestone': {
      const ms = ir.milestones || [];
      return ms.some(
        (m) =>
          String(m.date || '').includes(check.date) && String(m.label || '').includes(check.label),
      );
    }
    case 'milestoneNot': {
      const ms = ir.milestones || [];
      return !ms.some(
        (m) =>
          String(m.date || '').includes(check.date) && String(m.label || '').includes(check.label),
      );
    }
    case 'containsText': {
      const t = irText(ir);
      return check.all.every((s) => t.includes(s));
    }
    case 'flag':
      return ir[check.field] === check.equals;
    case 'mentions':
      return irText(ir).includes(check.text);
    case 'noContact':
      return (
        !/1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/.test(irText(ir)) && !/@[\w.-]+\.\w{2,}/.test(irText(ir))
      );
    default:
      throw new Error(`unknown check type ${check.type}`);
  }
}

// ---- main ------------------------------------------------------------------------
async function main() {
  const evalDir = `${REPO}sdf-js/fixtures/ir-eval`;
  const suites = readdirSync(evalDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(`${evalDir}/${f}`, 'utf8')))
    .filter((s) => !SUITE_FILTER || s.name === SUITE_FILTER);

  const results = [];
  for (const suite of suites) {
    const imagesDir = arg(`--images-${suite.name}`);
    let slides;
    if (suite.source.slidedata) {
      slides = JSON.parse(readFileSync(`${REPO}${suite.source.slidedata}`, 'utf8'));
    } else {
      const { parseDeck } = await import('../src/parser/index.js');
      slides = await parseDeck(`${REPO}${suite.source.pdf}`);
    }
    console.log(
      `\n=== suite ${suite.name} (${Object.keys(suite.pages).length} pages, ${imagesDir ? 'VISION' : 'text'} mode) ===`,
    );

    for (const [idxStr, page] of Object.entries(suite.pages)) {
      const i = parseInt(idxStr, 10);
      let imageBase64 = null;
      if (imagesDir) {
        const p = `${imagesDir}/page-${String(i + 1).padStart(2, '0')}.png`;
        if (existsSync(p)) imageBase64 = readFileSync(p).toString('base64');
      }
      let halves = null;
      if (imagesDir) {
        const hs = ['L', 'R'].map(
          (sd) => `${imagesDir}/page-${String(i + 1).padStart(2, '0')}-${sd}.png`,
        );
        if (hs.every((p) => existsSync(p)))
          halves = hs.map((p) => readFileSync(p).toString('base64'));
      }
      const { irs } = await extractSlideIR({
        slide: slides[i],
        index: i,
        callLLM,
        imageBase64,
        halves,
      });
      if (!irs || irs.length === 0) {
        console.log(`  ✗ [${idxStr}] ${page.label} — extraction failed entirely`);
        results.push({
          suite: suite.name,
          page: i,
          label: page.label,
          pass: 0,
          total: page.checks.length,
        });
        continue;
      }
      // Multi-chart pages return several IRs; a golden page's checks are
      // scored against the BEST-matching one (existing single-IR goldens
      // describe one chart — the split must not fail them for also
      // extracting the page's second chart).
      let ir = irs[0];
      let pass = -1;
      let fails = [];
      for (const cand of irs) {
        let p = 0;
        const f = [];
        for (const check of page.checks) {
          const okc = runCheck(check, cand, {
            vision: !!imageBase64,
            chartGeometry: !!page.chartGeometry,
          });
          if (okc) p++;
          else f.push(check.type);
        }
        if (p > pass) {
          pass = p;
          fails = f;
          ir = cand;
        }
      }
      const mark = pass === page.checks.length ? '✓' : '✗';
      console.log(
        `  ${mark} [${idxStr}] ${page.label} — ${pass}/${page.checks.length}${fails.length ? ` (failed: ${fails.join(', ')})` : ''} [${ir.structure}${ir.form ? '·' + ir.form : ''}${ir.needsReview ? '·NR' : ''}]`,
      );
      results.push({
        suite: suite.name,
        page: i,
        label: page.label,
        pass,
        total: page.checks.length,
        fails,
        ir,
      });
    }
  }

  const totPass = results.reduce((s, r) => s + r.pass, 0);
  const totAll = results.reduce((s, r) => s + r.total, 0);
  const pagesClean = results.filter((r) => r.pass === r.total).length;
  console.log(
    `\n==== ${pagesClean}/${results.length} pages clean · ${totPass}/${totAll} checks · LLM cost $${totalCost.toFixed(2)} ====`,
  );
  if (SAVE) {
    writeFileSync(
      SAVE,
      JSON.stringify(
        { pagesClean, pages: results.length, checks: [totPass, totAll], results },
        null,
        1,
      ),
    );
    console.log(`saved → ${SAVE}`);
  }
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
