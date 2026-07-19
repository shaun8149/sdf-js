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
3. If a page holds several charts, model the one carrying the headline claim; the other charts' key claims go into callout.sub. (A page MAY NOT be split here — one page, one IR.)
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
- DENSE RANKINGS (>10 bars): emit only the TOP 8 by value, note "TOP15 truncated to 8" in callout.sub — the 3D stage can't seat 30 bars anyway.
- Everything else (no invention beyond faithful chart reads, neutral callouts, page vocabulary) still applies.`;

// LLMs wrap JSON in fences / prose — strip to the outermost object. A second
// salvage pass escapes NAKED quotes inside string literals: pages whose
// titles carry quotation marks ("头条号"媒体平台…) come back as "..."..."..."
// and kill JSON.parse (eval vision rounds 1-3 lost p21 to exactly this).
export function parseJsonLoose(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');
  const body = text.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    return JSON.parse(escapeNakedQuotes(body));
  }
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
  if (hadImage || !ir) return ir;
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
  if (!ir || !Array.isArray(ir.magnitude) || !Array.isArray(ir.nodes)) return ir;
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

/**
 * Extract one page's IR. callLLM({system, user, maxTokens}) → response text;
 * `user` is a string (text mode) or Anthropic content blocks (vision mode).
 * Returns { ir, attempts, demoted } — ir is null only if every retry failed.
 */
export async function extractSlideIR({ slide, index, callLLM, imageBase64 = null, retries = 3 }) {
  const digest = slideDigest(slide, index, { vision: !!imageBase64 });
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
    const user = imageBase64
      ? [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
          },
          { type: 'text', text },
        ]
      : text;
    try {
      const raw = await callLLM({ system, user, maxTokens: imageBase64 ? 6500 : 4000 });
      let cand = parseJsonLoose(raw);
      let v = validateIR(cand);
      if (!v.ok) {
        // Deterministic arity repair: vision reads often produce more data
        // points than the text layer has labels (11 monthly bars vs 6 printed
        // dates) and the model loops on "length must match" at temperature 0.
        // Pad labels (①…) or truncate values — never invent data.
        cand = repairArity(cand);
        v = validateIR(cand);
      }
      if (v.ok) {
        const gated = antiFabricationGate(cand, { hadImage: !!imageBase64, ladders });
        return { ir: gated, attempts: attempt + 1, demoted: !!gated.demoted };
      }
      lastErrs = v.errors;
    } catch (e) {
      lastErrs = [String(e.message || e).slice(0, 200)];
    }
  }
  return { ir: null, attempts: retries, demoted: false, errors: lastErrs };
}
