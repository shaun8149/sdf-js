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

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractSlideIR, parseJsonLoose } from '../src/mapping/slide-to-ir.js';
import { detectNavChrome } from '../src/mapping/slide-digest.js';

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
let IMAGES_DIR = arg('--images'); // dir of page-<n>.png (1-based); enables vision mode
// --vision: one flag does it all — derive the pages dir from the deck name
// and bake the renders if they aren't there yet.
if (!IMAGES_DIR && process.argv.includes('--vision')) {
  if (!PDF_PATH) {
    console.error('✗ --vision requires --pdf (page renders come from the PDF)');
    process.exit(1);
  }
  IMAGES_DIR = `${REPO}sdf-js/fixtures/pages/${NAME}`;
  // Halves are part of the standard vision input now (full page + L/R 2×
  // close-ups), so the bake always includes them — missing halves on an
  // already-baked dir triggers a top-up bake.
  if (!existsSync(`${IMAGES_DIR}/page-01.png`) || !existsSync(`${IMAGES_DIR}/page-01-L.png`)) {
    console.log(`--vision: baking page renders (+halves) → ${IMAGES_DIR}`);
    const r = spawnSync(
      process.execPath,
      [
        `${REPO}sdf-js/scripts/bake-pdf-pages.mjs`,
        '--pdf',
        resolve(process.cwd(), PDF_PATH),
        '--out',
        `sdf-js/fixtures/pages/${NAME}`,
        '--halves',
      ],
      { stdio: 'inherit' },
    );
    if (r.status !== 0) {
      console.error('✗ page bake failed');
      process.exit(1);
    }
  }
}
const pageImage = (i) => {
  if (!IMAGES_DIR) return null;
  const p = `${IMAGES_DIR}/page-${String(i + 1).padStart(2, '0')}.png`;
  return existsSync(p) ? readFileSync(p).toString('base64') : null;
};
// 2× half-page crops (bake-pdf-pages --halves) power the roadmap
// connector-verification pass; absent files just skip the pass.
const pageHalves = (i) => {
  if (!IMAGES_DIR) return null;
  const out = [];
  for (const side of ['L', 'R']) {
    const p = `${IMAGES_DIR}/page-${String(i + 1).padStart(2, '0')}-${side}.png`;
    if (existsSync(p)) out.push(readFileSync(p).toString('base64'));
  }
  return out.length === 2 ? out : null;
};
if (!NAME || (!SLIDEDATA_PATH && !PDF_PATH)) {
  console.error('✗ required: --name <deck-name> and (--slidedata <path> | --pdf <path>)');
  process.exit(1);
}
const OUT_PATH = `${REPO}sdf-js/scenes/ir/${NAME}.json`;
const CACHE_PATH = `${OUT_PATH}.slides-cache.json`;

// ---- Anthropic ---------------------------------------------------------------
let totalCost = 0;
async function callLLM(system, user, maxTokens = 4000, temperature = 0) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
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
  const chrome = detectNavChrome(slides);
  if (chrome.size)
    console.log(
      `  nav chrome (repeats ≥3 pages, suppressed as content): ${[...chrome].slice(0, 8).join(' · ')}${chrome.size > 8 ? ' …' : ''}`,
    );

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
      irs.push(cache[i]);
      console.log(`  [${i}] cached (${cache[i].structure})`);
      continue;
    }
    const imageBase64 = pageImage(i);
    const { ir: extracted, demoted } = await extractSlideIR({
      slide: slides[i],
      index: i,
      callLLM: ({ system, user, maxTokens, temperature }) =>
        callLLM(system, user, maxTokens, temperature),
      imageBase64,
      halves: pageHalves(i),
      chrome,
    });
    let ir = extracted;
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
    if (demoted) console.log(`  [${i}] chart+needsReview → demoted to hold (no fabricated series)`);
    // An image station with an unknown path gets the baked page render,
    // copied into the standard scenes/assets/<deck>/ home (wild corpus
    // finding: "PLACEHOLDER" shipped verbatim and 404'd in the player).
    if (ir.structure === 'image' && (!ir.image || ir.image === 'PLACEHOLDER') && IMAGES_DIR) {
      const pageFile = `page-${String(i + 1).padStart(2, '0')}.png`;
      const src = `${IMAGES_DIR}/${pageFile}`;
      if (existsSync(src)) {
        const assetDir = `${REPO}sdf-js/scenes/assets/${NAME}`;
        mkdirSync(assetDir, { recursive: true });
        writeFileSync(`${assetDir}/${pageFile}`, readFileSync(src));
        ir.image = `assets/${NAME}/${pageFile}`;
        console.log(`  [${i}] image PLACEHOLDER → ${ir.image}`);
      }
    }
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

  // Drop skippable pages (references / appendix / legal boilerplate) BEFORE
  // the narrative pass — the model never sees them, so the "editorially
  // skipped stations break the zone partition" failure class (3DGS wild run)
  // disappears at the source. --keep-all opts out. sourcePage in callouts
  // keeps pointing at the ORIGINAL page numbers, so provenance survives.
  let deckIrs = irs;
  if (!process.argv.includes('--keep-all')) {
    const dropped = irs.map((ir, i) => (ir.skippable ? i : -1)).filter((i) => i >= 0);
    if (dropped.length) {
      deckIrs = irs.filter((ir) => !ir.skippable);
      console.log(
        `  skippable pages dropped: ${dropped.map((i) => i + 1).join(', ')} (${deckIrs.length} stations remain)`,
      );
    }
  }

  // Phase 2: deck narrative
  const stationFacts = deckIrs.map((ir, i) => ({
    i,
    structure: ir.structure,
    title: ir.title,
    callout: ir.callout || null,
    nodesPreview: (ir.nodes || ir.milestones || ir.groups || []).slice(0, 6),
  }));
  const deckUser = `Deck title hint: ${DECK_TITLE || '(none)'}\nStations:\n${JSON.stringify(stationFacts, null, 1)}`;
  let envelope = null;
  let envErrs = null;
  let lastCand = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const user = envErrs
      ? `${deckUser}\n\nYour previous attempt failed:\n- ${envErrs.join('\n- ')}\nReturn a corrected JSON.`
      : deckUser;
    try {
      const raw = await callLLM(DECK_SYSTEM, user, 8000);
      const cand = parseJsonLoose(raw);
      lastCand = cand;
      envErrs = validateEnvelope(cand, deckIrs.length);
      if (envErrs.length === 0) {
        envelope = cand;
        break;
      }
      console.log(`  deck pass attempt ${attempt + 1} invalid: ${envErrs.join('; ')}`);
    } catch (e) {
      envErrs = [e.message.slice(0, 200)];
      console.log(`  deck pass attempt ${attempt + 1} error: ${envErrs[0]}`);
      lastCand = null;
    }
  }
  if (!envelope) {
    // Deterministic envelope repair — same philosophy as the arity repair: at
    // temperature 0 the model loops on the same partition mistake (first wild
    // corpus, a 14-page SIGGRAPH paper: zones written for only 8 of 14
    // stations, three identical retries). Salvage what it wrote — titles,
    // narration lines it DID produce — and rebuild the invariants: contiguous
    // zone partition, exactly one station line per station.
    envelope = repairEnvelope(lastCand, deckIrs, DECK_TITLE || NAME);
    console.log('  deck pass REPAIRED deterministically (envelopeRepaired: true)');
  }

  // Phase 3: assemble + compile check
  const deck = {
    title: envelope.title || DECK_TITLE || NAME,
    zones: envelope.zones,
    chapters: envelope.chapters,
    finale: envelope.finale,
    slides: deckIrs,
    script: envelope.script,
  };
  const { assembleDeck } = await import('../src/scene/assemble-deck.js');
  const scene = assembleDeck(deck, { layout: 'theater' });
  console.log(
    `assembleDeck OK: ${scene.subjects.length} subjects, ${scene.cameraSequence.shots.length} shots, ${scene.deckWindows.length} windows`,
  );

  writeFileSync(OUT_PATH, JSON.stringify(deck, null, 1) + '\n');
  const flagged = deckIrs.filter((x) => x.needsReview).length;
  console.log(`\n✓ wrote ${OUT_PATH}`);
  console.log(
    `  ${deckIrs.length} stations | structures: ${[...new Set(irs.map((x) => x.structure))].join(', ')} | needsReview: ${flagged}`,
  );
  console.log(`  total LLM cost: $${totalCost.toFixed(2)}`);

  // ---- audit block (review-then-ship v0) -----------------------------------
  // Every flag the pipeline can raise, in one place, so a human can review a
  // deck without opening the JSON. Silence ≠ clean unless the coverage note
  // says the check ran: connector verification covers roadmap structures
  // only, and the demotion gates stand down in vision mode (ladderWarning is
  // their non-demoting vision-mode residue).
  const flagOf = (pred, tag) => {
    const hits = deckIrs.map((x, i) => ({ x, i })).filter(({ x }) => pred(x));
    if (hits.length)
      console.log(
        `  ${tag}: ${hits.map(({ x, i }) => `#${i}${x.callout?.sourcePage ? `(p${x.callout.sourcePage})` : ''} ${String(x.title || '').slice(0, 24)}`).join(' | ')}`,
      );
    return hits.length;
  };
  console.log('\n== AUDIT (review before shipping) ==');
  const nUncertain = flagOf(
    (x) => x.pairingUncertain || x.bindingUncertain,
    'pairing/bindingUncertain (two passes disagreed)',
  );
  const nReview = flagOf((x) => x.needsReview || x.demoted, 'needsReview/demoted');
  const nLadder = flagOf(
    (x) => x.ladderWarning,
    'ladderWarning (values overlap axis ticks ≥50%, vision mode — verify against the page)',
  );
  const nAxis = flagOf((x) => x.axisUncertain, 'axisUncertain (tick labels unreadable)');
  const nUnit = flagOf((x) => x.unitMismatch, 'unitMismatch (grouped series mix units)');
  const nHold = deckIrs.filter((x) => x.structure === 'hold').length;
  console.log(`  hold stations: ${nHold}/${deckIrs.length} (high share = chart pages flattened)`);
  console.log(
    `  coverage: connector verification = roadmap only; fabrication demotion gates stand down in vision mode`,
  );
  const total = nUncertain + nReview + nLadder + nAxis + nUnit;
  console.log(
    total === 0
      ? '  no flags raised — still spot-check chart pages against source renders'
      : `  ${total} flag(s) — resolve or route the camera around these before shipping`,
  );
}

// Rebuild a broken narrative envelope around what the model DID produce.
// Zones: keep the chapter count if plausible, re-partition 0..N-1 evenly.
// Script: keep every grounded station line the model wrote; synthesize a
// title-based placeholder for missing stations; drop out-of-range lines.
function repairEnvelope(cand, irs, fallbackTitle) {
  const N = irs.length;
  const c = cand && typeof cand === 'object' ? cand : {};
  const chapterCount = Math.min(
    Math.max(Array.isArray(c.chapters) ? c.chapters.length : 0, 2),
    Math.max(2, Math.min(6, Math.round(N / 6) + 1)),
  );
  const zones = [];
  const per = Math.ceil(N / chapterCount);
  for (let z = 0; z < chapterCount; z++) {
    const zone = [];
    for (let i = z * per; i < Math.min((z + 1) * per, N); i++) zone.push(i);
    if (zone.length) zones.push(zone);
  }
  const chapters = zones.map(
    (_, z) => (Array.isArray(c.chapters) && c.chapters[z]) || { title: `第 ${z + 1} 章` },
  );
  const byStation = new Map();
  if (Array.isArray(c.script))
    for (const line of c.script)
      if (
        line &&
        line.kind === 'station' &&
        Number.isInteger(line.station) &&
        line.station >= 0 &&
        line.station < N &&
        !byStation.has(line.station)
      )
        byStation.set(line.station, line);
  const script = [];
  for (let i = 0; i < N; i++) {
    script.push(
      byStation.get(i) || {
        text: String(irs[i].callout?.text || irs[i].title || `第 ${i + 1} 页`),
        station: i,
        kind: 'station',
      },
    );
  }
  return {
    title: c.title || fallbackTitle,
    chapters,
    zones,
    script,
    finale: c.finale && c.finale.text ? c.finale : { text: fallbackTitle, sub: '完' },
    envelopeRepaired: true,
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
