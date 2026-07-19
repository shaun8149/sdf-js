#!/usr/bin/env node
// =============================================================================
// gen-deck-ir.mjs — SlideData → IR deck (the "整本 deck 一键成型" pipeline)
// -----------------------------------------------------------------------------
// Closes the gap between per-slide lifts and a playable deck: the 2015 BP's
// 31-station IR (scenes/ir/bytedance-bp-2015.json) was assembled by hand over
// many sessions; this script derives the same artifact automatically.
//
//   SlideData[] (M0.3 parser output, or --pdf → parseDeck)
//     → per-slide IR extraction   (LLM, validateIR-checked, self-repair retry)
//     → deck narrative pass       (LLM: title/chapters/zones/script/finale)
//     → assembleDeck compile check (theater layout must build)
//     → scenes/ir/<name>.json     (playable via figure.html?deck=<name>)
//
// Fidelity rules are baked into the system prompt from the 2015 deck's three
// adversarial supervisor rounds: never invent numbers/names/dates; chart
// values read off bars are approximations and must carry 读图近似; one chart
// per station, the rest of the page's headline claims ride the callout.
//
// Usage:
//   ANTHROPIC_API_KEY=... node sdf-js/scripts/gen-deck-ir.mjs \
//     --slidedata sdf-js/examples/pdf-demo/slidedata.json \
//     --name d0961-fill-levels --title "3D Spheres — Fill Levels"
//   (or --pdf path/to/deck.pdf instead of --slidedata)
//
// Idempotent: per-slide IRs cache in <out>.slides-cache.json — a re-run only
// calls the LLM for missing/failed slides. --force re-extracts everything.
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateIR, STRUCTURES } from '../src/scene/ir.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY env var required.');
  process.exit(1);
}
const MODEL = process.env.MODEL || 'claude-sonnet-4-5';
const REPO = fileURLToPath(new URL('../..', import.meta.url));

const arg = (flag, dflt = null) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const FORCE = process.argv.includes('--force');
const SLIDEDATA_PATH = arg('--slidedata');
const PDF_PATH = arg('--pdf');
const NAME = arg('--name');
const DECK_TITLE = arg('--title', '');
const ONLY = arg('--only') ? parseInt(arg('--only'), 10) : null;
if (!NAME || (!SLIDEDATA_PATH && !PDF_PATH)) {
  console.error('✗ required: --name <deck-name> and (--slidedata <path> | --pdf <path>)');
  process.exit(1);
}
const OUT_PATH = `${REPO}sdf-js/scenes/ir/${NAME}.json`;
const CACHE_PATH = `${OUT_PATH}.slides-cache.json`;

// ---- Anthropic ---------------------------------------------------------------
let totalCost = 0;
async function callLLM(system, user, maxTokens = 4000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const inTok = data.usage?.input_tokens ?? 0;
  const outTok = data.usage?.output_tokens ?? 0;
  totalCost += (inTok * 3 + outTok * 15) / 1e6; // sonnet pricing
  return data.content?.[0]?.text ?? '';
}

// LLMs wrap JSON in fences / prose — strip to the outermost object.
function parseJsonLoose(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');
  return JSON.parse(text.slice(start, end + 1));
}

// ---- Slide text digest ---------------------------------------------------------
// The LLM sees each page as y-ordered lines with font-size hints — the same
// evidence a human reads: big text = headings, clustered numbers = chart data.
// Axis-tick-ladder detector: an equally-spaced numeric run (usually ending at
// 0) in a chart page's text layer is the AXIS, not the data — the data lives
// in bar geometry the text layer can't see. The first supervisor audit of this
// pipeline found tick ladders copied as data on 5 of 8 chart pages (rendering
// "粘性大幅提升" as a collapse from 40 to 4); the digest now names the ladders
// so the extractor refuses them.
function detectTickLadders(nums) {
  const ladders = [];
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  for (let s = 0; s < sorted.length - 2; s++) {
    for (let len = sorted.length - s; len >= 3; len--) {
      const run = sorted.slice(s, s + len);
      const step = run[1] - run[0];
      if (step <= 0) continue;
      if (run.every((v, k) => k === 0 || Math.abs(v - run[k - 1] - step) < step * 0.02)) {
        if (run.includes(0) || run.length >= 4) ladders.push(run);
        break;
      }
    }
  }
  return ladders;
}

function slideDigest(slide, i) {
  const lines = (slide.body || [])
    .map((b) => ({ text: (b.text || '').trim(), y: b.bbox?.y ?? 0, fs: b.fontSize ?? 0 }))
    .filter((l) => l.text);
  lines.sort((a, b) => a.y - b.y);
  const body = lines.map((l) => `[fs${Math.round(l.fs)}] ${l.text}`).join('\n');
  const nums = [];
  for (const l of lines) {
    const m = l.text.match(/^[\d,.]+%?$/);
    if (m) nums.push(parseFloat(l.text.replace(/[,%]/g, '')));
  }
  const ladders = detectTickLadders(nums);

  // Deterministic 2D label↔value pairing: the y-sorted digest interleaves
  // side-by-side columns, so "adjacent lines" lies about adjacency. We have
  // bboxes — pair each prominent number with its nearest non-numeric text
  // block in 2D and SAY SO, instead of hoping the model re-derives layout
  // (first audit: 3 stations mispaired by list order).
  const items = (slide.body || [])
    .map((b) => ({
      text: (b.text || '').trim(),
      x: (b.bbox?.x ?? 0) + (b.bbox?.w ?? 0) / 2,
      y: (b.bbox?.y ?? 0) + (b.bbox?.h ?? 0) / 2,
      fs: b.fontSize ?? 0,
    }))
    .filter((l) => l.text);
  const bigNums = items.filter((l) => /^[\d,.]+%?$/.test(l.text) && l.fs >= 14);
  const nonNum = items.filter((l) => !/^[\d,.]+%?$/.test(l.text) && l.text.length >= 3);
  // Pair against HEADING-like labels (uppercase or above-median font) — the
  // nearest raw line is usually a column's body-copy tail ("with your own
  // text."), which names nothing. Fall back to all text if no headings.
  const fsMedian =
    nonNum.map((l) => l.fs).sort((a, b) => a - b)[Math.floor(nonNum.length / 2)] || 0;
  const headings = nonNum.filter(
    (l) => l.fs > fsMedian || (/^[A-Z0-9 .:：-]+$/.test(l.text) && l.text.length <= 40),
  );
  const labels = headings.length ? headings : nonNum;
  const pairs = bigNums
    .map((n) => {
      let best = null;
      let bd = Infinity;
      for (const lb of labels) {
        const d = Math.hypot(n.x - lb.x, (n.y - lb.y) * 1.6); // columns beat rows
        if (d < bd) {
          bd = d;
          best = lb;
        }
      }
      return best ? `${n.text} ↔ "${best.text.slice(0, 40)}"` : null;
    })
    .filter(Boolean);
  const pairNote = pairs.length
    ? `\nSPATIAL PAIRING (each number's nearest label by 2D distance — trust THIS over line order):\n${pairs.join('\n')}`
    : '';
  const warn = ladders.length
    ? `\nWARNING: the number run(s) ${ladders.map((l) => `[${l.join(', ')}]`).join(' and ')} are equally spaced — almost certainly AXIS TICKS, not data. The real data lives in bar/line geometry you cannot see. Do NOT emit these runs as magnitude/series values.`
    : '';
  return `PAGE ${i + 1}\nTITLE: ${slide.title || '(untitled)'}\nLAYOUT: ${slide.layout || '?'}\nBODY (top→bottom, fs = font size — bigger = more prominent):\n${body || '(no body text)'}${pairNote}${warn}`;
}

// ---- System prompt: the IR contract + fidelity rules + worked examples ---------
const SLIDE_SYSTEM = `You convert ONE presentation page into ONE "IR" JSON object for a 3D deck renderer. Respond with ONLY the JSON object — no prose, no fences.

## Structures (pick exactly one per page)
- "hold"      — no chartable structure: covers, agendas, bullet/summary pages. Fields: title, nodes (string bullets, MAY be empty for a bare cover; prefix ① ② … when the page enumerates), emphasis [idx]. For N peer concepts side by side use {"structure":"hold","form":"circles"} with nodes as {label, sub} objects — "form" is a FIELD; "circles" is NEVER a structure value.
- "magnitude" — quantities compared. REQUIRED: nodes (category names), magnitude (numbers, same length). Variants: orientation:"horizontal" (rankings / long category names); form:"line" (time series — nodes are time labels); form:"grouped" + series:[{label, values[]}] (category × series comparison, e.g. 2011 vs 2014; keep magnitude = latest series). Optional: unit ("%"), display (per-node label strings), emphasis [idx].
- "proportion"— share-of-whole (pies). REQUIRED: groups:[{label, values:[…], sliceLabels:[…]}] — one group per pie. Optional per-group colors:[[r,g,b]0..1] ONLY when the source page's slice colors are known. emphasis <groupIdx>.
- "roadmap"   — dated milestones. REQUIRED: milestones:[{date, label}]. climb:false for a flat staged timeline (default true = rising curve). emphasis <idx>.
- "matrix"    — 2-axis classification / VS tables. REQUIRED: axes:[[colCategories],[rowCategories]], nodes (cell texts), cells:[[colIdx,rowIdx] per node]. emphasis [nodeIdx] = the page's verdict cell.
- "network"   — graph/ecosystem/flows. REQUIRED: nodes, relations:[[from,to]…] (no self-loops). form:"cycle" for a hub+ring flywheel (hub first in nodes). emphasis [idx].
- "hierarchy" — tree/org/tiers. REQUIRED: nodes, relations:[[parent,child]…], exactly one root. emphasis [idx].
- "sequence"  — ordered funnel stages. REQUIRED: nodes; magnitude optional (stage sizes).
- "image"     — ONLY when the page's content IS a picture (product screenshots, photos). Fields: image (path string — use "PLACEHOLDER" if unknown), nodes [] . Use as a LAST resort; prefer a structural mapping.

## Shared fields
- title: the page's own headline (its own words, condensed is fine).
- callout: {text, sub, sourcePage} — text = the page's single punchline claim (verbatim-condensed); sub = the page's remaining load-bearing claims joined with " · " or " —— "; sourcePage = the 1-based page number. Every station should have one unless the page is a bare cover.
- emphasis: what the page itself emphasizes (its biggest number, its verdict, its NOW).

## Structure selection heuristics (apply BEFORE defaulting to hold)
- ≥3 standalone LARGE numbers/percentages (fs ≥ ~2× body text) = chart data → "magnitude" (unit:"%", magnitude = the numbers, nodes = each value's nearby heading; if headings are placeholders/absent use "① ② ③…"). NEVER model chart data as hold bullets.
- Small numbers at round values (0%/50%/100%, tiny fs) near a chart are AXIS TICKS — scaffolding, not data; exclude them.
- Exactly 1 dominant number → still "magnitude" with a single node (a hero KPI).
- Repeated identical placeholder paragraphs = per-item captions, not content: they mark HOW MANY items exist; don't quote them more than once.
- "hold" is only for pages with NO numeric series at all.

## Fidelity rules (hard — violations are audit failures)
1. NEVER invent numbers, names, dates, or claims. Every value/label must appear on the page (or be an explicit chart read — see rule 2).
2. A number read off a chart's bars (not printed as text) is an APPROXIMATION: keep ratios faithful and append "读图近似" (or "approx. from chart" for non-Chinese decks) inside callout.sub.
3. If a page holds several charts, model the one carrying the headline claim; the other charts' key claims go into callout.sub. (A page MAY NOT be split here — one page, one IR.)
4. Template placeholder copy (lorem-style "This is a placeholder text") may be copied verbatim or dropped — never rewritten into realistic-sounding content.
5. Keep the page's own vocabulary; do not import claims from other pages.
6. callout.text must be a claim PRESENT on the page. If the page makes no claim (template/placeholder decks), give a neutral reading ("四档:20% → 90%") — never editorialize: no "achieved" / "success" / "growth" unless the page says so.
7. AXIS TICKS ARE NOT DATA. If a chart page's only numbers form an equally-spaced ladder (the digest will warn you), the real values are unreadable from text: emit the correct structure WITHOUT a fabricated magnitude/series — use "hold" carrying the page's text-borne claims in nodes/callout, and add "needsReview": true. A confident wrong chart is worse than an honest gap.
8. Pair labels with values by PROXIMITY in the digest (adjacent lines), never by list order. Superlative claims ("最高 X") must equal the actual max of your emitted values.
9. Never copy personal contact details (phone numbers, email addresses) into nodes or callouts — summarize ("联系人:创始人/CEO 与投资总监").

## Worked examples

INPUT: PAGE 27 … lines like "2018年移动广告市场份额E（亿元人民币）", "150 10%", "600 300", "20% 40%", "450 30%", "今日头条 百度WAP＋APP 微信 其他", "我们保守估计…份额不应小于10%，即150亿元"
OUTPUT: {"structure":"proportion","title":"2018 年移动广告市场份额（亿元）","groups":[{"label":"2018E 市场","values":[150,300,450,600],"sliceLabels":["今日头条","百度 WAP+APP","微信","其他"]}],"emphasis":0,"callout":{"text":"保守估计:份额 ≥10% = 150 亿","sub":"前提:实现 DAU 目标 —— 公司预估","sourcePage":27}}

INPUT: PAGE 9 … a rising timeline with gray boxes "字节跳动成立 2012年3月", "今日头条APP上线 2012年8月", "B轮融资 2013年5月", "用户规模超过2.4亿 2015年3月" …
OUTPUT: {"structure":"roadmap","title":"开创最早、技术最领先、用户规模最大","milestones":[{"date":"2012.3","label":"字节跳动成立"},{"date":"2012.8","label":"今日头条 APP 上线"},{"date":"2013.5","label":"B 轮融资"},{"date":"2015.3","label":"用户超 2.4 亿"}],"emphasis":3,"callout":{"text":"一直被模仿,从未被超越","sub":"已成为该领域全球领导者","sourcePage":9}}

INPUT: PAGE 3 … "[fs36] 社交和资讯一直都是用户在手机上的最大需求" then paired percentages "71.0% 78.4%" … "社交／聊天 新闻／资讯 … 移动搜索", "2011年 2014年"
OUTPUT: {"structure":"magnitude","form":"grouped","title":"社交和资讯是手机上的最大需求,搜索相对次要","nodes":["社交/聊天","新闻/资讯","看视频","听音乐","玩游戏","移动搜索"],"series":[{"label":"2011年","values":[71.0,77.2,17.4,23.2,9.2,48.3]},{"label":"2014年","values":[78.4,77.5,73.6,67.5,61.0,57.6]}],"magnitude":[78.4,77.5,73.6,67.5,61.0,57.6],"unit":"%","emphasis":[5],"callout":{"text":"移动搜索 57.6%,2014 年垫底","sub":"社交/资讯 ~78% 居首(源:DCCI 2014)","sourcePage":3}}`;

// ---- Deck narrative pass --------------------------------------------------------
const DECK_SYSTEM = `You are given the station list of a 3D presentation deck (one station per source page, already structured). Produce the deck-level narrative envelope as ONE JSON object — no prose, no fences.

Output shape:
{
  "title": "<deck title — use the provided hint or the cover station's title>",
  "chapters": [{"title":"开场"}, {"title":"第一章 · <theme>","note":"<one-line>"}, …],
  "zones": [[stationIdx…], …],   // one zone per chapter, contiguous, ALL stations exactly once, in order
  "script": [{"text":"<spoken line>","station":<idx>,"kind":"station"}, …],
  "finale": {"text":"<closing line>","sub":"<one-line send-off>"}
}

Rules:
1. zones partition 0..N-1 contiguously (e.g. [[0,1],[2,3,4],[5,6]]). First zone = opening (cover + agenda-like stations). 3-6 chapters total for a 15-35 station deck.
2. script: EXACTLY one {kind:"station"} line per station, in order. Optionally add {kind:"super"} lines after a station line for its punch moment (sparingly, the deck's 3-5 biggest beats).
3. Narration is GROUNDED: every claim in a script line must come from that station's provided facts (title/callout/nodes). No invented numbers, names, or history. Template placeholder content → describe the structure neutrally ("三个量表,20、40、80"), don't fabricate meaning.
4. Language: match the deck's language (Chinese deck → Chinese narration; English template → concise Chinese narration describing the visuals is fine, quoting values verbatim).
5. Keep each line speakable in ~8 seconds.`;

// ---- main -----------------------------------------------------------------------
async function main() {
  // Phase 0: slides
  let slides;
  if (SLIDEDATA_PATH) {
    slides = JSON.parse(readFileSync(SLIDEDATA_PATH, 'utf8'));
  } else {
    const { parseDeck } = await import('../src/parser/index.js');
    slides = await parseDeck(PDF_PATH);
  }
  console.log(`deck "${NAME}": ${slides.length} slides`);

  // Phase 1: per-slide IR (cached, validated, self-repairing)
  // --force alone wipes the cache; --force --only N keeps it and re-extracts
  // only slide N (otherwise a one-slide retouch nukes 30 cached results).
  const wipeCache = FORCE && ONLY == null;
  const cache =
    existsSync(CACHE_PATH) && !wipeCache ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};
  const irs = [];
  for (let i = 0; i < slides.length; i++) {
    if (ONLY != null && i !== ONLY) {
      irs.push(cache[i] || null);
      continue;
    }
    const forceThis = FORCE && (ONLY == null || i === ONLY);
    if (cache[i] && !forceThis) {
      irs.push(antiFabricationGate(cache[i], i));
      console.log(`  [${i}] cached (${cache[i].structure})`);
      continue;
    }
    const digest = slideDigest(slides[i], i);
    let ir = null;
    let lastErrs = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const user = lastErrs
        ? `${digest}\n\nYour previous attempt failed validation:\n- ${lastErrs.join('\n- ')}\nReturn a corrected IR JSON.`
        : digest;
      try {
        const raw = await callLLM(SLIDE_SYSTEM, user);
        const cand = parseJsonLoose(raw);
        const v = validateIR(cand);
        if (v.ok) {
          ir = cand;
          break;
        }
        lastErrs = v.errors;
        console.log(`  [${i}] attempt ${attempt + 1} invalid: ${v.errors.join('; ')}`);
      } catch (e) {
        lastErrs = [e.message.slice(0, 200)];
        console.log(`  [${i}] attempt ${attempt + 1} error: ${lastErrs[0]}`);
      }
    }
    if (!ir) {
      // Deterministic fallback keeps the deck buildable; flagged for review.
      ir = {
        structure: 'hold',
        title: slides[i].title || `第 ${i + 1} 页`,
        nodes: [],
        needsReview: true,
      };
      console.log(`  [${i}] FELL BACK to bare hold (needsReview)`);
    }
    ir = antiFabricationGate(ir, i);
    irs.push(ir);
    cache[i] = ir;
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));
    console.log(
      `  [${i}] ${ir.structure}${ir.form ? `·${ir.form}` : ''} "${(ir.title || '').slice(0, 36)}"`,
    );
  }
  if (ONLY != null) {
    console.log('(--only run: cache updated, deck not assembled)');
    console.log(`cost so far: $${totalCost.toFixed(2)}`);
    return;
  }

  // Phase 2: deck narrative
  const stationFacts = irs.map((ir, i) => ({
    i,
    structure: ir.structure,
    title: ir.title,
    callout: ir.callout || null,
    nodesPreview: (ir.nodes || ir.milestones || ir.groups || []).slice(0, 6),
  }));
  const deckUser = `Deck title hint: ${DECK_TITLE || '(none)'}\nStations:\n${JSON.stringify(stationFacts, null, 1)}`;
  let envelope = null;
  let envErrs = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const user = envErrs
      ? `${deckUser}\n\nYour previous attempt failed:\n- ${envErrs.join('\n- ')}\nReturn a corrected JSON.`
      : deckUser;
    try {
      const raw = await callLLM(DECK_SYSTEM, user, 8000);
      const cand = parseJsonLoose(raw);
      envErrs = validateEnvelope(cand, irs.length);
      if (envErrs.length === 0) {
        envelope = cand;
        break;
      }
      console.log(`  deck pass attempt ${attempt + 1} invalid: ${envErrs.join('; ')}`);
    } catch (e) {
      envErrs = [e.message.slice(0, 200)];
      console.log(`  deck pass attempt ${attempt + 1} error: ${envErrs[0]}`);
    }
  }
  if (!envelope) throw new Error('deck narrative pass failed after 3 attempts');

  // Phase 3: assemble + compile check
  const deck = {
    title: envelope.title || DECK_TITLE || NAME,
    zones: envelope.zones,
    chapters: envelope.chapters,
    finale: envelope.finale,
    slides: irs,
    script: envelope.script,
  };
  const { assembleDeck } = await import('../src/scene/assemble-deck.js');
  const scene = assembleDeck(deck, { layout: 'theater' });
  console.log(
    `assembleDeck OK: ${scene.subjects.length} subjects, ${scene.cameraSequence.shots.length} shots, ${scene.deckWindows.length} windows`,
  );

  writeFileSync(OUT_PATH, JSON.stringify(deck, null, 1) + '\n');
  const flagged = irs.filter((x) => x.needsReview).length;
  console.log(`\n✓ wrote ${OUT_PATH}`);
  console.log(
    `  ${irs.length} stations | structures: ${[...new Set(irs.map((x) => x.structure))].join(', ')} | needsReview: ${flagged}`,
  );
  console.log(`  total LLM cost: $${totalCost.toFixed(2)}`);
}

// Deterministic anti-fabrication gate: a chart the extractor itself flags
// needsReview must not ship a numeric series — the prompt asks for hold, but
// models sometimes keep the chart structure with invented values (axis ticks,
// zero-padding). Convert to an honest hold; the text-borne claims survive in
// the callout. A confident wrong chart is worse than a gap (first supervisor
// audit of this pipeline: 5/8 chart pages carried fabricated series).
function antiFabricationGate(ir, i) {
  if (!ir || !ir.needsReview || !(ir.magnitude || ir.series || ir.groups)) return ir;
  console.log(`  [${i}] chart+needsReview → demoted to hold (no fabricated series)`);
  return {
    structure: 'hold',
    title: ir.title,
    nodes: [],
    callout: ir.callout,
    needsReview: true,
  };
}

function validateEnvelope(env, N) {
  const errs = [];
  if (!Array.isArray(env.zones) || env.zones.length === 0)
    errs.push('zones must be a non-empty array');
  else {
    const flat = env.zones.flat();
    const want = Array.from({ length: N }, (_, i) => i);
    if (JSON.stringify(flat) !== JSON.stringify(want))
      errs.push(
        `zones must partition 0..${N - 1} contiguously in order (got ${JSON.stringify(flat.slice(0, 8))}…)`,
      );
    if (!Array.isArray(env.chapters) || env.chapters.length !== env.zones.length)
      errs.push('chapters must match zones length');
  }
  if (!Array.isArray(env.script) || env.script.length === 0)
    errs.push('script must be a non-empty array');
  else {
    const stations = env.script.filter((s) => s.kind === 'station').map((s) => s.station);
    const want = Array.from({ length: N }, (_, i) => i);
    if (JSON.stringify(stations) !== JSON.stringify(want))
      errs.push('script needs exactly one kind:"station" line per station, in order');
    if (env.script.some((s) => !s.text || typeof s.station !== 'number'))
      errs.push('each script line needs text + numeric station');
  }
  if (!env.finale || !env.finale.text) errs.push('finale.text required');
  return errs;
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
