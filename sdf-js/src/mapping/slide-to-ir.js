// =============================================================================
// slide-to-ir.js — one presentation page → one validated IR (shared core)
// -----------------------------------------------------------------------------
// The extraction brain of the slides→IR deck pipeline, shared by the generator
// (scripts/gen-deck-ir.mjs) and the eval harness (scripts/eval-deck-ir.mjs) so
// the harness always measures the EXACT prompt + retry + gate the production
// path runs — a harness on a diverged copy measures nothing.
//
// Two modes:
//   text-only     — digest from the PDF text layer; chart pages whose data
//                   lives in bar geometry degrade to honest needsReview holds
//                   (anti-fabrication gate).
//   vision        — pass imageBase64 (PNG of the page): the model may READ the
//                   chart geometry; values become legitimate 读图近似 reads and
//                   the gate stands down for that page.
//
// The system prompt's fidelity rules were distilled from the 2015 BP deck's
// three adversarial supervisor rounds; the anti-fabrication machinery from the
// first audit of this pipeline (tick ladders copied as data on 5/8 chart
// pages). Every rule here was bought by a concrete audit finding.
// =============================================================================

import { validateIR } from '../scene/ir.js';
import { slideDigest, pageLadders } from './slide-digest.js';

export const SLIDE_SYSTEM = `You convert ONE presentation page into ONE "IR" JSON object for a 3D deck renderer. Respond with ONLY the JSON object — no prose, no fences.

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
- skippable: true — set it when the page carries NO presentable content of its own: reference/bibliography lists, appendix boilerplate, legal disclaimers, blank/divider pages. The deck builder drops these stations. A summary, thank-you, or contact page is NOT skippable (it closes the show).

## Structure selection heuristics (apply BEFORE defaulting to hold)
- ≥3 standalone LARGE numbers/percentages (fs ≥ ~2× body text) = chart data → "magnitude" (unit:"%", magnitude = the numbers, nodes = each value's nearby heading; if headings are placeholders/absent use "① ② ③…"). NEVER model chart data as hold bullets.
- Small numbers at round values (0%/50%/100%, tiny fs) near a chart are AXIS TICKS — scaffolding, not data; exclude them.
- Exactly 1 dominant number → still "magnitude" with a single node (a hero KPI).
- Repeated identical placeholder paragraphs = per-item captions, not content: they mark HOW MANY items exist; don't quote them more than once.
- "hold" is only for pages with NO numeric series at all.
- Standalone percentages/numbers are always DATA (magnitude family) — never {form:"circles"} concepts. circles is for named IDEAS (技术/世界/人), not values.

## Fidelity rules (hard — violations are audit failures)
1. NEVER invent numbers, names, dates, or claims. Every value/label must appear on the page (or be an explicit chart read — see rule 2).
2. A number read off a chart's bars (not printed as text) is an APPROXIMATION: keep ratios faithful and append "读图近似" (or "approx. from chart" for non-Chinese decks) inside callout.sub.
3. If a page holds TWO distinct primary charts (different chart types, or different units/axes — e.g. a revenue column chart AND a market-share pie), return a JSON ARRAY of two IR objects in page reading order, each with its own title (page title + that chart's subtitle) and its own callout. NEVER merge separate charts into one grouped station: "series" is ONLY for series that share one axis and one unit inside a single chart (2011 vs 2014 on the same % scale). Two charts with different units (分钟 vs 条数 vs %) or different axes are different charts. Minor decorative side-charts still go into callout.sub of the main chart — the ARRAY is for pages whose message needs both. A single time-series chart → form:"line", not grouped.
4. Template placeholder copy (lorem-style "This is a placeholder text") may be copied verbatim or dropped — never rewritten into realistic-sounding content.
5. Keep the page's own vocabulary; do not import claims from other pages.
6. callout.text must be a claim PRESENT on the page. If the page makes no claim (template/placeholder decks), give a neutral reading ("四档:20% → 90%") — never editorialize: no "achieved" / "success" / "growth" unless the page says so.
7. AXIS TICKS ARE NOT DATA. A WARNING in the digest bans exactly THE NAMED LADDER VALUES from magnitude/series — nothing else. If the page still has other prominent numbers (real data), model them normally. Degrade to "hold" + "needsReview": true ONLY when no usable numbers remain outside the banned ladders (a confident wrong chart is worse than an honest gap). AMBIGUOUS runs are yours to judge via the pairing evidence; unwarned prominent uniform runs (e.g. ten fill gauges 10%…100%) are data.
8. Pair labels with values by PROXIMITY in the digest (adjacent lines), never by list order. Superlative claims ("最高 X") must equal the actual max of your emitted values.
9. Never copy personal contact details (phone numbers, email addresses) into nodes or callouts — summarize ("联系人:创始人/CEO 与投资总监").

## Worked examples

INPUT: PAGE 27 … lines like "2018年移动广告市场份额E（亿元人民币）", "150 10%", "600 300", "20% 40%", "450 30%", "今日头条 百度WAP＋APP 微信 其他", "我们保守估计…份额不应小于10%，即150亿元"
OUTPUT: {"structure":"proportion","title":"2018 年移动广告市场份额（亿元）","groups":[{"label":"2018E 市场","values":[150,300,450,600],"sliceLabels":["今日头条","百度 WAP+APP","微信","其他"]}],"emphasis":0,"callout":{"text":"保守估计:份额 ≥10% = 150 亿","sub":"前提:实现 DAU 目标 —— 公司预估","sourcePage":27}}

INPUT: PAGE 9 … a rising timeline with gray boxes "字节跳动成立 2012年3月", "今日头条APP上线 2012年8月", "B轮融资 2013年5月", "用户规模超过2.4亿 2015年3月" …
OUTPUT: {"structure":"roadmap","title":"开创最早、技术最领先、用户规模最大","milestones":[{"date":"2012.3","label":"字节跳动成立"},{"date":"2012.8","label":"今日头条 APP 上线"},{"date":"2013.5","label":"B 轮融资"},{"date":"2015.3","label":"用户超 2.4 亿"}],"emphasis":3,"callout":{"text":"一直被模仿,从未被超越","sub":"已成为该领域全球领导者","sourcePage":9}}

INPUT: PAGE 3 … "[fs36] 社交和资讯一直都是用户在手机上的最大需求" then paired percentages "71.0% 78.4%" … "社交／聊天 新闻／资讯 … 移动搜索", "2011年 2014年"
OUTPUT: {"structure":"magnitude","form":"grouped","title":"社交和资讯是手机上的最大需求,搜索相对次要","nodes":["社交/聊天","新闻/资讯","看视频","听音乐","玩游戏","移动搜索"],"series":[{"label":"2011年","values":[71.0,77.2,17.4,23.2,9.2,48.3]},{"label":"2014年","values":[78.4,77.5,73.6,67.5,61.0,57.6]}],"magnitude":[78.4,77.5,73.6,67.5,61.0,57.6],"unit":"%","emphasis":[5],"callout":{"text":"移动搜索 57.6%,2014 年垫底","sub":"社交/资讯 ~78% 居首(源:DCCI 2014)","sourcePage":3}}`;

// Vision addendum: with the page image attached, chart geometry IS readable —
// rule 7's honest-gap escape hatch no longer applies.
export const VISION_ADDENDUM = `

## VISION MODE (a rendering of the page is attached)
The attached image IS the page. You can now READ chart geometry directly:
- Bar/line/pie values: estimate each from the geometry against the axis; keep ratios faithful; mark "读图近似" (or "approx. from chart") in callout.sub.
- Rule 7 is REPLACED: do NOT degrade chart pages to hold — emit the real structure with your chart-read values. Do NOT set needsReview just because the text layer only had ticks.
- Use the image to settle label↔value pairing and left-to-right order (it beats the text digest when they disagree).
- ARITY: nodes must have EXACTLY one label per value you emit. Reading 11 monthly bars → 11 labels (2014.1 … 2015.3; invent no dates — interpolate the axis labels you see) and 11 values. Same for every series in a grouped chart.
- AXIS ARITHMETIC: read the axis maximum carefully before scaling (7,000,000 is 700万, not 7000万) — every callout/script number must respect the axis units you read.
- AXIS-LABEL HONESTY: if tick labels are unreadable, corrupted, or absent, NEVER synthesize them (no invented dates/months — a 2013 deck cannot cite 2015). Use ①②… node labels, anchor only to endpoint annotations you can actually read, and set "axisUncertain": true. Cross-check chart-internal consistency: cumulative ≥ active, totals ≥ parts — a violation means you misread an axis.
- PAST vs PRESENT tables: bind each column/row to its era by the page's own 过去/现在 (before/after) markers — never by reading order.
- TIMELINES: each label box/callout connects to exactly ONE node by a thin connector line or by proximity along the curve — pair by FOLLOWING THE CONNECTOR in the image, not by reading order. A box sitting past the last dated node belongs to the FINAL date. Badges/icons decorating a segment are narrative color (callout.sub), not milestones.
- DENSE RANKINGS (>10 bars): emit only the TOP 8 by value, note "TOP15 truncated to 8" in callout.sub — the 3D stage can't seat 30 bars anyway.
- SECTION TAB RAILS: a row of 3-5 short section labels that repeats visually across consecutive pages (one highlighted) is NAVIGATION, not content. Extract this page's OWN content (its annotations, screenshots, channels) — never the rail labels as nodes.
- OURS-vs-COMPETITORS pages: bind each caption to the screenshot it sits under/next to in the IMAGE, and name each screenshot by its OWN visible logo/watermark/app chrome — never by the page headline. If you cannot identify a product from its logo, label it 竞品① (etc). A weakness caption (需手工…/信息杂/繁琐) belongs to a competitor; the deck's own product NEVER inherits a competitor's flaw — if your pairing gives it one, you paired wrong.
- Everything else (no invention beyond faithful chart reads, neutral callouts, page vocabulary) still applies.`;

// LLMs wrap JSON in fences / prose — strip to the outermost object. A second
// salvage pass escapes NAKED quotes inside string literals: pages whose
// titles carry quotation marks ("头条号"媒体平台…) come back as "..."..."..."
// and kill JSON.parse (eval vision rounds 1-3 lost p21 to exactly this).
export function parseJsonLoose(text) {
  // A multi-chart page returns a top-level ARRAY of IRs (rule 3). Try the
  // slice whose opener comes first; if it doesn't parse (a '[' inside prose
  // must not hijack an object response), fall back to the other one.
  const candidates = [];
  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  const obj = objStart >= 0 ? text.slice(objStart, text.lastIndexOf('}') + 1) : null;
  const arr = arrStart >= 0 ? text.slice(arrStart, text.lastIndexOf(']') + 1) : null;
  if (arr && (objStart < 0 || arrStart < objStart)) candidates.push(arr, obj);
  else candidates.push(obj, arr);
  let lastErr = null;
  for (const body of candidates) {
    if (!body || body.length < 2) continue;
    try {
      return JSON.parse(body);
    } catch (e) {
      lastErr = e;
    }
    try {
      return JSON.parse(escapeNakedQuotes(body));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('no JSON object in response');
}

function escapeNakedQuotes(s) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!inStr) {
      if (c === '"') inStr = true;
      out += c;
      continue;
    }
    if (c === '\\') {
      out += c + (s[i + 1] || '');
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      const nxt = s[j];
      // a quote followed by JSON syntax closes the string; anything else is
      // an embedded quote the model forgot to escape
      if (nxt === ',' || nxt === '}' || nxt === ']' || nxt === ':') {
        inStr = false;
        out += c;
      } else {
        out += '\\"';
      }
      continue;
    }
    out += c;
  }
  return out;
}

// Deterministic anti-fabrication gates (text-only mode). In vision mode the
// values are legitimate chart reads, so both gates stand down.
//
// Gate 1 — self-flagged: a chart the extractor marks needsReview must not
// ship a numeric series (models sometimes keep the chart structure with
// invented values).
// Gate 2 — ladder overlap: models also bypass rule 7 SILENTLY (the first
// eval baseline caught p16 shipping the tick ladder + zero-padding with no
// needsReview at all). If the emitted values largely coincide with the
// page's detected axis ladders, the series is a fabrication regardless of
// what the model claims — demote.
export function ladderOverlap(irValues, ladders) {
  const flat = ladders.flat();
  if (!flat.length || irValues.length < 3) return 0;
  const hit = irValues.filter((v) =>
    flat.some((t) => Math.abs(v - t) < Math.abs(t) * 0.001 + 1e-9),
  );
  return hit.length / irValues.length;
}

function collectValues(ir) {
  const out = [];
  if (Array.isArray(ir.magnitude)) out.push(...ir.magnitude);
  if (Array.isArray(ir.series)) for (const s of ir.series) out.push(...(s.values || []));
  if (Array.isArray(ir.groups)) for (const g of ir.groups) out.push(...(g.values || []));
  return out.map(Number).filter((x) => Number.isFinite(x));
}

export function antiFabricationGate(ir, { hadImage = false, ladders = [] } = {}) {
  if (!ir) return ir;
  if (hadImage) {
    // Vision mode: chart reads are legitimate, so the gates stand down — but
    // a high overlap with the page's axis ticks is still worth surfacing.
    // WARN, never demote: the audit block reads this flag; silence in vision
    // mode otherwise hides exactly the failure class the gate exists for.
    const vals = ir.magnitude || ir.series || ir.groups ? collectValues(ir) : [];
    const overlap = ladderOverlap(vals, ladders);
    return overlap >= 0.5 ? { ...ir, ladderWarning: true } : ir;
  }
  const hasSeries = ir.magnitude || ir.series || ir.groups;
  const vals = hasSeries ? collectValues(ir) : [];
  const overlap = ladderOverlap(vals, ladders);
  const zeroPadded = vals.length >= 4 && vals.filter((v) => v === 0).length >= vals.length / 2;
  if ((ir.needsReview && hasSeries) || overlap >= 0.5 || zeroPadded) {
    return {
      structure: 'hold',
      title: ir.title,
      nodes: [],
      callout: ir.callout,
      needsReview: true,
      demoted: true,
    };
  }
  return ir;
}

// Pad nodes with ①②… (or trim the surplus) so magnitude/nodes lengths agree.
// Values are sacred — only labels are synthesized.
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
export function repairArity(ir) {
  if (!ir || !Array.isArray(ir.nodes)) return ir;
  // Grouped charts: if every series agrees on a length, align nodes to IT
  // (pad with ①… / trim); if the series DISAGREE among themselves the read is
  // broken — leave it for the validator to reject and the retry to re-read
  // (final-showdown audit: a 9/12/12 series set shifted bars off their labels).
  if (Array.isArray(ir.series) && ir.series.length) {
    const lens = [...new Set(ir.series.map((s) => (s.values || []).length))];
    if (lens.length !== 1) return ir;
    const M = lens[0];
    if (M > 0 && ir.nodes.length !== M) {
      const fixed = { ...ir, nodes: ir.nodes.slice(0, M) };
      for (let k = fixed.nodes.length; k < M; k++) fixed.nodes.push(CIRCLED[k] || `#${k + 1}`);
      if (Array.isArray(ir.magnitude) && ir.magnitude.length !== M)
        fixed.magnitude = ir.series[ir.series.length - 1].values.slice();
      return fixed;
    }
    return ir;
  }
  if (!Array.isArray(ir.magnitude)) return ir;
  const M = ir.magnitude.length;
  const N = ir.nodes.length;
  if (M === N || M === 0) return ir;
  const fixed = { ...ir };
  if (N < M) {
    fixed.nodes = [...ir.nodes];
    for (let k = N; k < M; k++) fixed.nodes.push(CIRCLED[k] || `#${k + 1}`);
  } else {
    fixed.nodes = ir.nodes.slice(0, M);
  }
  return fixed;
}

// Grouped series spanning incommensurable units (分钟 vs 条数 vs %: five
// orders of magnitude on one axis) render as nonsense even when every number
// is honest. Flag — don't demote (the data is real; the assembly needs review).
export function flagUnitMismatch(ir) {
  if (!ir || !Array.isArray(ir.series) || ir.series.length < 2) return ir;
  const maxes = ir.series
    .map((s) => Math.max(...(s.values || [0]).map((v) => Math.abs(Number(v) || 0))))
    .filter((m) => m > 0);
  if (maxes.length < 2) return ir;
  if (Math.max(...maxes) / Math.min(...maxes) > 1000) return { ...ir, unitMismatch: true };
  return ir;
}

// Second-pass matrix binding verification, same pattern as the roadmap pass:
// era/category matrices (过去/现在, before/after) get their cell assignments
// re-derived from the 2× close-ups by VISUAL POSITION against the row/column
// markers. The 2015 BP's p4 swap was temp0-stable through four prompt rounds
// AND survived high-res input — the extractor's binding conviction only
// yields to a dedicated verification question.
export async function verifyMatrixBindings({ ir, callLLM, halves, imageBase64 = null }) {
  if (
    !ir ||
    ir.structure !== 'matrix' ||
    !Array.isArray(ir.axes) ||
    ir.axes.length !== 2 ||
    !Array.isArray(ir.cells) ||
    !halves ||
    halves.length === 0
  )
    return ir;
  // Full page first: the half-crops cut the middle column in two, which
  // wrecks COLUMN judgment; the full page restores column context while the
  // halves give the 2× detail for the edge row markers.
  const user = [
    ...(imageBase64
      ? [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } }]
      : []),
    ...halves.map((data) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data },
    })),
    {
      type: 'text',
      text: `Images: the full matrix page, then 2× close-ups (left/right halves).\nColumn categories (x): ${JSON.stringify(ir.axes[0])}\nRow categories (y): ${JSON.stringify(ir.axes[1])}\nNodes: ${JSON.stringify(ir.nodes)}\n\nFor EACH node in order, locate its box and answer from PHYSICAL ALIGNMENT alone: (1) which column category (use the FULL page for column alignment) is directly above/below it? (2) which row marker printed on the page edge (use the close-ups) is at the SAME HEIGHT as its box? Note the rows on the page may be printed in reverse order of the category list (e.g. 现在 above 过去). End your answer with ONLY a JSON array: one [xIndex, yIndex] pair per node, indices into the category lists above.`,
    },
  ];
  try {
    const raw = await callLLM({
      system:
        'You verify matrix cell bindings in chart close-ups by visual alignment. Respond with only a JSON array of [column,row] index pairs.',
      user,
      maxTokens: 1500,
      temperature: 0,
    });
    // The verifier reasons in prose before answering, and the prose itself
    // contains [x,y] pairs — grab the LAST array-of-arrays block, not the
    // first '[' (which killed the first p4 verification run silently).
    const blocks = raw.match(/\[\s*\[[\s\S]*?\]\s*\]/g);
    if (!blocks || !blocks.length) return ir;
    const cells = JSON.parse(blocks[blocks.length - 1]);
    const valid =
      Array.isArray(cells) &&
      cells.length === ir.cells.length &&
      cells.every(
        (c) =>
          Array.isArray(c) &&
          c.length === 2 &&
          c[0] >= 0 &&
          c[0] < ir.axes[0].length &&
          c[1] >= 0 &&
          c[1] < ir.axes[1].length,
      );
    if (!valid) return ir;
    const changed = JSON.stringify(cells) !== JSON.stringify(ir.cells);
    return { ...ir, cells, bindingVerified: true, ...(changed ? { bindingUncertain: true } : {}) };
  } catch {
    return ir;
  }
}

/**
 * Extract one page's IR. callLLM({system, user, maxTokens}) → response text;
 * `user` is a string (text mode) or Anthropic content blocks (vision mode).
 * Returns { ir, attempts, demoted } — ir is null only if every retry failed.
 */
// Second-pass timeline verification: dated-label boxes on a dense roadmap sit
// geometrically between nodes (the 2015 BP's 5000万 box defeated four prompt
// rounds at page scale). With 2× half-page crops the connector lines are
// visible — one extra call re-derives each date↔label pairing by following
// them. Only fires for roadmap results when the halves exist.
export async function verifyRoadmapPairings({ ir, callLLM, halves }) {
  if (!ir || ir.structure !== 'roadmap' || !halves || halves.length === 0) return ir;
  const user = [
    ...halves.map((data) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data },
    })),
    {
      type: 'text',
      text: `These are 2× close-ups (left/right halves) of the timeline page you just extracted. Current milestones:\n${JSON.stringify(ir.milestones, null, 1)}\n\nVerify EVERY date↔label pairing by FOLLOWING each label box's thin connector line to the node it touches. A box between two nodes belongs to the node its connector meets, not the nearest text. Badges/icons without boxes are not milestones. Respond with ONLY the corrected milestones JSON array (same shape).`,
    },
  ];
  try {
    const raw = await callLLM({
      system:
        'You verify timeline pairings in chart close-ups. Respond with only a JSON array of {date,label} milestones.',
      user,
      maxTokens: 2000,
      temperature: 0,
    });
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start < 0 || end <= start) return ir;
    const ms = JSON.parse(raw.slice(start, end + 1));
    if (Array.isArray(ms) && ms.length >= 2 && ms.every((m) => m && m.date && m.label)) {
      // Disagreement between the page-scale read and the close-up read is
      // itself the best ambiguity signal we have — surface it instead of
      // silently trusting either pass (the 2015 BP's 5000万 box survived
      // five prompt/mechanism rounds; some boxes are genuinely ambiguous).
      const key = (arr) => JSON.stringify(arr.map((m) => `${m.date}→${m.label}`));
      const changed = key(ms) !== key(ir.milestones || []);
      return {
        ...ir,
        milestones: ms,
        connectorVerified: true,
        ...(changed ? { pairingUncertain: true } : {}),
      };
    }
  } catch {
    /* verification is best-effort — keep the first-pass milestones */
  }
  return ir;
}

export async function extractSlideIR({
  slide,
  index,
  callLLM,
  imageBase64 = null,
  halves = null,
  chrome = null,
  retries = 3,
}) {
  const digest = slideDigest(slide, index, { vision: !!imageBase64, chrome });
  // Gate 2 arms on STRONG ladders only (font-relative axis ticks — see
  // slide-digest.js); ambiguous ladders are the model's call with pairing
  // evidence, so the gate must not override a legitimate data ladder.
  const ladders = pageLadders(slide).strong;
  const system = imageBase64 ? SLIDE_SYSTEM + VISION_ADDENDUM : SLIDE_SYSTEM;
  let lastErrs = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    const text = lastErrs
      ? `${digest}\n\nYour previous attempt failed validation:\n- ${lastErrs.join('\n- ')}\nReturn a corrected IR JSON.`
      : digest;
    // Full page first (layout context), then L/R half-crops at 2× effective
    // DPI. The halves are what make small logos, thin connectors and dense
    // tick labels readable — p9's milestone pairing and p12's competitor-logo
    // misread were both input-resolution failures, not prompt failures.
    const user = imageBase64
      ? [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
          },
          ...(halves || []).map((data) => ({
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data },
          })),
          {
            type: 'text',
            text:
              halves && halves.length
                ? `${text}\n\n(Images: full page, then LEFT and RIGHT half close-ups at 2× — read small logos, thin connector lines and dense labels from the close-ups.)`
                : text,
          },
        ]
      : text;
    try {
      // First attempt runs cold (reproducible); retries add temperature to
      // escape deterministic dead-loops (p16: the same 3-series read failed
      // identically three times, then passed on an out-of-band rerun).
      const raw = await callLLM({
        system,
        user,
        maxTokens: imageBase64 ? 6500 : 4000,
        temperature: attempt === 0 ? 0 : 0.5,
      });
      const parsed = parseJsonLoose(raw);
      // Multi-chart pages return an ARRAY of IRs (rule 3) — validate, repair
      // and gate each element; one bad element fails the whole attempt so the
      // retry feedback covers everything the model got wrong.
      const cands = Array.isArray(parsed) ? parsed : [parsed];
      if (cands.length === 0) throw new Error('empty IR array');
      const errs = [];
      const fixed = cands.map((cand, ci) => {
        let c = cand;
        let v = validateIR(c);
        if (!v.ok) {
          // Deterministic arity repair: vision reads often produce more data
          // points than the text layer has labels (11 monthly bars vs 6
          // printed dates) and the model loops on "length must match" at
          // temperature 0. Pad labels (①…) or truncate values — never invent.
          c = repairArity(c);
          v = validateIR(c);
        }
        if (!v.ok)
          errs.push(...v.errors.map((e) => (cands.length > 1 ? `chart ${ci + 1}: ${e}` : e)));
        return c;
      });
      if (errs.length === 0) {
        const irs = [];
        for (const c of fixed) {
          let gated = flagUnitMismatch(
            antiFabricationGate(c, { hadImage: !!imageBase64, ladders }),
          );
          gated = await verifyRoadmapPairings({ ir: gated, callLLM, halves });
          gated = await verifyMatrixBindings({ ir: gated, callLLM, halves, imageBase64 });
          irs.push(gated);
        }
        return {
          ir: irs[0],
          irs,
          attempts: attempt + 1,
          demoted: irs.some((x) => !!x.demoted),
        };
      }
      lastErrs = errs;
    } catch (e) {
      lastErrs = [String(e.message || e).slice(0, 200)];
    }
  }
  return { ir: null, irs: null, attempts: retries, demoted: false, errors: lastErrs };
}
