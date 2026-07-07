#!/usr/bin/env node
// =============================================================================
// eval-deck-quality.mjs — Sprint 24 P2 eval harness: score ONE baked deck
// -----------------------------------------------------------------------------
// Scores a deck directory produced by bake-scaffold-pipeline.mjs against four
// axes: STRUCTURE (did every slot get filled), ATOM QUALITY (variety, no LLM
// hallucinated atom types, no silently-ignored args), 3D READINESS (every
// emitted atom has a working twin per Sprint 24 P1's X-gap closure, and the
// lift actually runs without throwing), and TEXT BUDGET (deck stays terse
// enough for a 3-second 3D read, per the lift prompt's hard text budget).
//
// Produces a single 0-100 composite SCORE so pipeline quality is a trackable
// number, not a vibe — see eval-corpus.mjs for the corpus-wide runner.
//
// Usage:
//   node sdf-js/scripts/eval-deck-quality.mjs <deck-dir>
//
// Writes <deck-dir>/eval.json and prints a human-readable table.
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { isAtom2DType, getAtomSpec } from '../src/present/atoms-2d/registry.js';
import { hasTwin, liftScaffoldSlot } from '../src/scene/lift-scaffold.js';
import { auditDeckVisual } from './visual-audit.mjs';

// Arg keys that are style/enum/identifier controls, not user-visible prose.
// Excluded (at any nesting depth, by key name) from the TEXT BUDGET char count.
// Kept as an explicit list (rather than spec-type reflection) so the budget
// definition stays legible and stable across atom-spec refactors.
export const NON_TEXT_ARG_KEYS = new Set([
  'type',
  'style',
  'format',
  'colorMode',
  'iconStyle',
  'iconSize',
  'trend',
  'trendDirection',
  'align',
  'fit',
  'layout',
  'cols',
  'icon',
  'id',
  'src',
  'href',
  'direction',
  'shape',
  'variant',
  'orientation',
  'position',
  'anchor',
  'mode',
  'kind',
  'category',
  'colorScheme',
  'size',
  'axis',
  'unit',
  'currency',
  'sortOrder',
  'role',
  'pattern',
  'iconColor',
  'accentColor',
  'font',
  // color-valued keys (Sprint 33: an rgb triple or [38,70,130] array is a
  // style choice, not prose — and definitely not a factual number claim)
  'color',
  'colors',
  'bg',
  'leftAccent',
  'silhouetteColor',
  'fill',
  'stroke',
  'strokeColor',
  'borderColor',
  'barColor',
]);

// A key is non-text if it's in the explicit list OR ends in Color/Accent
// (numberColor, chipColor, rightAccent, pillars[].accent … — atoms grow
// color knobs faster than any list can chase).
export function isNonTextKey(k) {
  return NON_TEXT_ARG_KEYS.has(k) || /(color|accent)$/i.test(k);
}

/**
 * Recursively sum the length of user-visible string leaves inside an atom's
 * `args` object, skipping any property keyed by a style/enum/identifier name
 * (at any depth — e.g. `items[].icon` is skipped the same as top-level `icon`).
 */
export function collectTextChars(node, keyName = null) {
  if (node == null) return 0;
  if (typeof node === 'string') {
    if (keyName && isNonTextKey(keyName)) return 0;
    return node.length;
  }
  if (Array.isArray(node)) {
    return node.reduce((sum, el) => sum + collectTextChars(el, keyName), 0);
  }
  if (typeof node === 'object') {
    let sum = 0;
    for (const [k, v] of Object.entries(node)) {
      if (isNonTextKey(k)) continue;
      sum += collectTextChars(v, k);
    }
    return sum;
  }
  return 0;
}

// text-budget sub-score: 1.0 at ≤280 chars/slot, linear falloff to 0 at 600.
function textBudgetScore(charsPerSlot) {
  if (charsPerSlot <= 280) return 1;
  if (charsPerSlot >= 600) return 0;
  return 1 - (charsPerSlot - 280) / (600 - 280);
}

/**
 * Score one baked deck directory (must contain deck.json + slots/*.json as
 * produced by bake-scaffold-pipeline.mjs).
 *
 * @param {string} deckDir — absolute or cwd-relative path to the deck dir
 * @returns {Promise<object>} the eval result (same shape written to eval.json)
 */
// Extract "key numbers" from source prose: currency, counts, percentages.
// Trailing punctuation stripped; bare 1-char digits skipped (years kept).
export function extractKeyNumbers(text) {
  // Scale words fold into suffix form ("$3.8 billion" → "$3.8B") so a deck's
  // "$3.8B" counts as preserving it (Sprint 33 — a16z essays write scales as
  // words far more often than slide fixtures did).
  const raw =
    text.match(/\$?[\d,]+\.?\d*(?:\s*(?:trillion|billion|million|thousand))?[KMBT%]?/gi) || [];
  const cleaned = raw
    .map((n) =>
      n
        .replace(/\s*trillion/i, 'T')
        .replace(/\s*billion/i, 'B')
        .replace(/\s*million/i, 'M')
        .replace(/\s*thousand/i, 'K')
        .replace(/[,.]+$/, ''),
    )
    .filter((n) => n.length > 1 && /\d/.test(n));
  return [...new Set(cleaned)];
}

// Canonical numeric value of a token: "$3.8B"→3.8e9, "500,000"→500000,
// "93%"→93, "46T"→4.6e13. null when the token isn't a plain number form.
// Percent keeps its face value (payloads store 93, not 0.93).
const NUMBER_SCALE = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
export function numericValueOf(token) {
  const m = String(token).match(/^\$?([\d,]+\.?\d*)([KMBT])?%?$/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(v)) return null;
  return m[2] ? v * NUMBER_SCALE[m[2].toUpperCase()] : v;
}

// Boundary-exact numeric tokens from serialized deck JSON. Comma counts as a
// thousands separator only when followed by exactly 3 digits — inside JSON
// arrays ("[5,1.1,5.4]") it is an element separator and must split tokens.
// Each token is stored in literal, comma-stripped, and bare (no $/K/M/B/%)
// forms. Rule 18 puts numbers into values arrays as bare payload (source
// "1.1%" → deck 1.1), so a source number counts as preserved when its bare
// form appears as an exact deck token — while exact matching stops "5%" from
// free-riding on a substring of "2.5%" (a false positive under .includes).
export function deckNumberTokens(deckText) {
  // Scale words fold to suffix form on the deck side too — a lift that
  // writes "100 trillion tokens" in a label preserves the source's "100T".
  const folded = deckText
    .replace(/(\d)\s*trillion/gi, '$1T')
    .replace(/(\d)\s*billion/gi, '$1B')
    .replace(/(\d)\s*million/gi, '$1M')
    .replace(/(\d)\s*thousand/gi, '$1K');
  const raw =
    folded.match(/\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?[KMBT%]?|\$?\d+(?:\.\d+)?[KMBT%]?/g) || [];
  const set = new Set();
  for (const t of raw) {
    const noComma = t.replace(/,/g, '');
    set.add(t);
    set.add(noComma);
    set.add(noComma.replace(/^\$/, '').replace(/[KMBT%]$/, ''));
  }
  return set;
}

// Is the source number n preserved in the deck? Literal (or comma-stripped)
// token match always counts; the bare form only stands in for a trailing
// "%" — percent payloads are stored bare by design, but "$3.4M" matching a
// bare "3.4" would be a coincidence, not preservation.
export function numberPreserved(n, tokens, tokenValues = null) {
  const noComma = n.replace(/,/g, '');
  if (tokens.has(n) || tokens.has(noComma)) return true;
  if (noComma.endsWith('%') && tokens.has(noComma.slice(0, -1))) return true;
  // Value equivalence (Sprint 33): "$500,000" is preserved by "$500K" or
  // 500000 — scale spelling is presentation, the value is the claim.
  if (tokenValues) {
    const v = numericValueOf(n);
    if (v != null && tokenValues.has(v)) return true;
  }
  return false;
}

// Canonical value set for a token collection (deck or source side).
export function valueSetOf(tokens) {
  const out = new Set();
  for (const t of tokens) {
    const v = numericValueOf(t);
    if (v != null) out.add(v);
  }
  return out;
}

// ── ADVERSARIAL: number precision (Sprint 33) ─────────────────────────────
// Recall asks "did source numbers survive?"; precision asks the adversarial
// converse: "does the deck contain numbers the source never said?" — the LLM
// inventing "$2.3B" on a slide is a worse fidelity failure than dropping a
// figure, because the deck asserts it with chart-grade confidence.
//
// Deck numbers come from ARGS ONLY (never x/y/w/h geometry). Pure integers
// 0-12 without a $/%/K/M/B suffix are exempt — list numbering, agenda
// indices, and step counts are presentation artifacts, not claims.
export function extractDeckPayloadNumbers(slotSceneDatas) {
  // Walk args collecting string/number leaves, skipping style/enum keys the
  // same way the text budget does (a theme color "rgb(38, 70, 130)" is not
  // a factual claim). Any surviving rgb()/rgba() strings are stripped too.
  const leaves = [];
  function walk(node, keyName = null) {
    if (node == null) return;
    if (typeof node === 'string' || typeof node === 'number') {
      if (!(keyName && isNonTextKey(keyName))) leaves.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      for (const el of node) walk(el, keyName);
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (isNonTextKey(k)) continue;
        walk(v, k);
      }
    }
  }
  for (const { sceneData } of slotSceneDatas) {
    for (const subject of sceneData.subjects || []) walk(subject.args || {});
  }
  const argsText = leaves
    .join(' ')
    .replace(/rgba?\([^)]*\)/g, ' ')
    .replace(/(\d)\s*trillion/gi, '$1T')
    .replace(/(\d)\s*billion/gi, '$1B')
    .replace(/(\d)\s*million/gi, '$1M')
    .replace(/(\d)\s*thousand/gi, '$1K');
  const raw =
    argsText.match(/\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?[KMBT%]?|\$?\d+(?:\.\d+)?[KMBT%]?/g) || [];
  const out = new Set();
  for (const t of raw) {
    const bare = t
      .replace(/,/g, '')
      .replace(/^\$/, '')
      .replace(/[KMBT%]$/, '');
    if (t === bare && /^\d{1,2}$/.test(bare) && Number(bare) <= 12) continue;
    out.add(t);
  }
  return [...out];
}

// ── ADVERSARIAL: entity precision (Sprint 35) ─────────────────────────────
// The converse of entity recall: does the deck name people/orgs/products
// the source never mentioned? An invented "Sarah Chen, CTO" attribution on
// a quote-pull is a WORSE failure than a dropped name — the deck fabricates
// a witness.
//
// Deck labels are Title Case by style ("Market Gap", "Launch Window"), so
// title-case alone is NOT a proper-noun signal here. The judgment is
// conservative on purpose: a candidate counts as hallucinated ONLY when
// NONE of its substantial words (≥4 chars, non-generic) appear anywhere in
// the source text — style-cased phrases built from source words self-ground.
export function extractDeckEntities(slotSceneDatas) {
  const leaves = [];
  function walk(node, keyName = null) {
    if (node == null) return;
    if (typeof node === 'string') {
      if (!(keyName && isNonTextKey(keyName))) leaves.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const el of node) walk(el, keyName);
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (isNonTextKey(k)) continue;
        walk(v, k);
      }
    }
  }
  for (const { sceneData } of slotSceneDatas) {
    for (const subject of sceneData.subjects || []) walk(subject.args || {});
  }
  const out = new Set();
  for (const line of leaves) {
    const runs = String(line).match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/g) || [];
    for (let run of runs) {
      let prev;
      do {
        prev = run;
        run = run.replace(ENTITY_STOP_PREFIX, '');
      } while (run !== prev && / /.test(run));
      if (/ /.test(run) && !isGenericHeading(run)) out.add(run);
    }
    for (const org of extractChineseOrgs(String(line))) out.add(org);
  }
  return [...out];
}

// Grounded unless NONE of the candidate's substantial words appear in the
// source (aliases count — deck "IMF" grounds against source 国际货币基金组织).
export function entityGrounded(candidate, srcTextLower) {
  const cand = candidate.toLowerCase();
  if (srcTextLower.includes(cand)) return true;
  for (const [zh, aliases] of Object.entries(ENTITY_ALIASES)) {
    if (
      aliases.some((a) => a.toLowerCase() === cand || cand.includes(a.toLowerCase())) &&
      srcTextLower.includes(zh)
    )
      return true;
  }
  // CJK candidate: substring failed and no alias — hallucinated
  if (/[一-鿿]/.test(candidate)) return false;
  const words = candidate
    .split(' ')
    .filter((w) => w.length >= 4 && !GENERIC_ENTITY_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return true; // nothing substantial to judge
  return words.some((w) => srcTextLower.includes(w.toLowerCase()));
}

// A deck number is grounded if the source's token set contains it in any
// form: literal, comma-stripped, bare (source "93%" grounds deck 93;
// source "$4.5M" grounds deck "4.5M"), or by canonical VALUE — the lift
// legitimately converts "$4.6 million" into 4600000 for chart geometry.
export function numberGrounded(n, sourceTokens, sourceValues = null) {
  const noComma = n.replace(/,/g, '');
  const bare = noComma.replace(/^\$/, '').replace(/[KMBT%]$/, '');
  if (sourceTokens.has(n) || sourceTokens.has(noComma) || sourceTokens.has(bare)) return true;
  if (sourceValues) {
    const v = numericValueOf(n);
    if (v != null && sourceValues.has(v)) return true;
  }
  return false;
}

// Leading words that make a capitalized 2+-word run a sentence fragment, not
// a proper noun ("The Team", "Our Mission", "How It Works" …). "New" strips
// ("The New Sarah Chen") EXCEPT before a geo name — "New York City" must
// survive intact (Sprint 33).
const ENTITY_STOP_PREFIX =
  /^(The|Our|A|An|This|That|These|Those|How|What|Why|When|Where|And|But|Or|If|We|You|It|They|New(?! (?:York|England|Jersey|Zealand|Hampshire|Mexico|Orleans|Delhi))|Every|All|Each|More|Most|Key|Total|First|Next|Last|Both)\s/;

// Extract proper-noun candidates (people / orgs / products) from source
// slides. BODY lines only: slide titles are headings by nature ("Financial
// Breakdown", "Thank You") and pollute the entity set with title-case
// fragments; real entities overwhelmingly live in body prose ("interviewed
// Village Chief Amara Kessy", "per Gartner Magic Quadrant"). Extraction is
// PER-LINE so runs never cross field boundaries. Deterministic — no NLP.
// Chinese org entities (Sprint 29): the Latin extractor is blind to CJK
// (no capitalization), so Chinese sources scored entities 0/0. Same
// philosophy — deterministic, no NLP:
//   1. CJK runs ending in an institutional suffix (组织/银行/公司/…)
//   2. Well-known financial institutions with no suffix (美联储/经合组织 is
//      suffix-covered, 美联储 is not)
// A leading function word glued onto the run ("的世界银行") is stripped
// the same way ENTITY_STOP_PREFIX strips "The Team".
const CJK_ORG_SUFFIX = /[一-鿿]{2,8}(?:组织|银行|央行|公司|集团|委员会|协会|研究院|基金会|交易所)/g;
const CJK_KNOWN_ORGS = /美联储|欧洲央行|英国央行|世界银行|国际货币基金组织|经合组织/g;
const CJK_STOP_LEAD =
  /^(?:的|了|在|与|和|及|等|从|被|向|对|把|据|按|该|各|以|由|为|将|其|是|个|但|而|则|仍|如|像)+/;

// Universal short forms a lift may use for well-known institutions — either
// direction counts as the entity surviving into the deck.
const ENTITY_ALIASES = {
  国际货币基金组织: ['IMF'],
  世界银行: ['World Bank'],
  经合组织: ['OECD'],
  美联储: ['Fed', 'Federal Reserve'],
  欧洲央行: ['ECB', 'European Central Bank'],
  英国央行: ['BoE', 'Bank of England'],
};

function extractChineseOrgs(line) {
  const out = [];
  // Split on connectors/punctuation first — 与/和/及 sit inside the CJK char
  // range, so "英国央行与欧洲央行" would otherwise greedily match as ONE run.
  for (const seg of line.split(/[与和及、，,;；。：:（）()\s]/)) {
    for (const m of seg.match(CJK_ORG_SUFFIX) || []) {
      const trimmed = m.replace(CJK_STOP_LEAD, '');
      if (trimmed.length >= 3) out.push(trimmed);
    }
  }
  for (const m of line.match(CJK_KNOWN_ORGS) || []) out.push(m);
  return out;
}

// Generic business/heading vocabulary. A title-case run made ENTIRELY of
// these is a section heading living in body prose ("Company Overview",
// "Connect With Us", "Best Product Award"), not a proper noun — corpus audit
// (Sprint 29) showed such runs were half of all "missing entities". One
// non-generic word rescues the run: "Gartner Magic Quadrant" (Gartner),
// "Google Slides" (Google), "Product Hunt" (Hunt) all survive.
const GENERIC_ENTITY_WORDS = new Set([
  'company',
  'overview',
  'team',
  'heritage',
  'potential',
  'user',
  'users',
  'group',
  'groups',
  'strategy',
  'custodial',
  'connect',
  'with',
  'us',
  'best',
  'product',
  'award',
  'awards',
  'search',
  'summary',
  'introduction',
  'agenda',
  'conclusion',
  'roadmap',
  'vision',
  'mission',
  'values',
  'goals',
  'objectives',
  'results',
  'findings',
  'analysis',
  'report',
  'update',
  'review',
  'plan',
  'steps',
  'thank',
  'you',
  'questions',
  'appendix',
  'background',
  'contact',
  'about',
  'welcome',
  // Sprint 35: chart-axis and synthesized-heading vocabulary — deck labels
  // are Title Case by style; phrases built ONLY from these are chrome.
  'core',
  'themes',
  'theme',
  'pain',
  'point',
  'points',
  'implications',
  'strategic',
  'possible',
  'causes',
  'cause',
  'very',
  'low',
  'high',
  'medium',
  'industry',
  'leaders',
  'leader',
  'app',
  'apps',
  'insights',
  'insight',
  'challenges',
  'challenge',
  'opportunities',
  'opportunity',
  'trends',
  'trend',
  'drivers',
  'driver',
  'factors',
  'factor',
  'risks',
  'risk',
  'impact',
  'likelihood',
  'severity',
  'outlook',
  'momentum',
  'takeaways',
  'takeaway',
]);

function isGenericHeading(run) {
  return run.split(' ').every((w) => GENERIC_ENTITY_WORDS.has(w.toLowerCase()));
}

export function extractKeyEntities(slides) {
  const out = new Set();
  const lines = [];
  for (const s of slides) {
    for (const b of s.body || []) {
      lines.push(typeof b === 'string' ? b : b.text || '');
    }
  }
  for (const line of lines) {
    const runs = line.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/g) || [];
    for (let run of runs) {
      // strip sentence-fragment prefixes repeatedly ("The New Sarah Chen" → "Sarah Chen")
      let prev;
      do {
        prev = run;
        run = run.replace(ENTITY_STOP_PREFIX, '');
      } while (run !== prev && / /.test(run));
      if (/ /.test(run) && !isGenericHeading(run)) out.add(run); // 2+ words, not a heading
    }
    for (const org of extractChineseOrgs(line)) out.add(org);
  }
  return [...out];
}

export async function scoreDeckQuality(deckDir) {
  const dir = resolve(deckDir);
  const deckJsonPath = join(dir, 'deck.json');
  if (!existsSync(deckJsonPath)) {
    throw new Error(`eval-deck-quality: no deck.json in ${dir}`);
  }
  const manifest = JSON.parse(readFileSync(deckJsonPath, 'utf8'));

  // Sprint 24 iter2 (contract A): empty slots are OMITTED from slots[] and
  // recorded in droppedSlots[] instead — the played deck has no holes. The
  // fill_rate metric keeps its original meaning (delivered / planned) so
  // scores stay comparable across iterations: planned = slots + dropped.
  const droppedSlots = Array.isArray(manifest.droppedSlots) ? manifest.droppedSlots : [];
  const legacyEmpty = manifest.slots.filter((s) => s.mappingEmpty).length; // pre-iter2 decks
  const slotsTotal = manifest.slots.length + droppedSlots.length;
  const slotsEmpty = droppedSlots.length + legacyEmpty;
  const slotsErrored = manifest.slots.filter((s) => s.error).length;
  const bakedSlotEntries = manifest.slots.filter((s) => s.liftFile && !s.error && !s.mappingEmpty);
  const slotsBaked = bakedSlotEntries.length;
  const fillRate = slotsTotal > 0 ? slotsBaked / slotsTotal : 0;

  // ── load each baked slot's sceneData ──
  const slotSceneDatas = []; // { slotIdx, slotName, sceneData }
  for (const s of bakedSlotEntries) {
    const slotPath = join(dir, s.liftFile);
    if (!existsSync(slotPath)) continue; // deck.json says baked but file missing — skip
    const slotEntry = JSON.parse(readFileSync(slotPath, 'utf8'));
    if (slotEntry.sceneData) {
      slotSceneDatas.push({
        slotIdx: s.slotIdx,
        slotName: s.slotName,
        sceneData: slotEntry.sceneData,
      });
    }
  }

  // ── ATOM QUALITY ──
  const allSubjects = []; // { slotIdx, subject }
  for (const { slotIdx, sceneData } of slotSceneDatas) {
    for (const subject of sceneData.subjects || []) {
      allSubjects.push({ slotIdx, subject });
    }
  }
  const nonCoverSubjects = allSubjects.filter(({ subject }) => subject.type !== 'cover');

  const atomInstances = nonCoverSubjects.length;
  const atomTypesDistinct = new Set(nonCoverSubjects.map(({ subject }) => subject.type)).size;
  const varietyRatio = atomInstances > 0 ? atomTypesDistinct / atomInstances : 0;

  const unknownSubjects = nonCoverSubjects.filter(({ subject }) => !isAtom2DType(subject.type));
  const unknownAtomCount = unknownSubjects.length;
  const unknownAtomTypes = [...new Set(unknownSubjects.map(({ subject }) => subject.type))];

  // arg_violations: subject.args keys not declared in the atom's spec.args.
  // Only checked for known atom types (unknown types are already flagged above).
  const specCache = new Map();
  async function specFor(type) {
    if (specCache.has(type)) return specCache.get(type);
    let spec = null;
    try {
      spec = await getAtomSpec(type);
    } catch {
      spec = null;
    }
    specCache.set(type, spec);
    return spec;
  }

  let argViolationCount = 0;
  const offenderCounts = new Map(); // `${type}.${key}` -> count
  for (const { subject } of allSubjects) {
    if (!isAtom2DType(subject.type)) continue;
    const spec = await specFor(subject.type);
    if (!spec || !spec.args) continue;
    const allowedKeys = new Set(Object.keys(spec.args));
    for (const key of Object.keys(subject.args || {})) {
      if (!allowedKeys.has(key)) {
        argViolationCount++;
        const offKey = `${subject.type}.${key}`;
        offenderCounts.set(offKey, (offenderCounts.get(offKey) || 0) + 1);
      }
    }
  }
  const argViolationTopOffenders = [...offenderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([offKey, count]) => {
      const dot = offKey.indexOf('.');
      return { type: offKey.slice(0, dot), key: offKey.slice(dot + 1), count };
    });

  // ── 3D READINESS ──
  const twinnedSubjects = allSubjects.filter(({ subject }) => hasTwin(subject.type));
  const twinCoverage = allSubjects.length > 0 ? twinnedSubjects.length / allSubjects.length : 0;
  const untwinnedTypes = [
    ...new Set(
      allSubjects
        .filter(({ subject }) => !hasTwin(subject.type))
        .map(({ subject }) => subject.type),
    ),
  ];

  let liftSuccessCount = 0;
  const liftErrors = [];
  let subjectsTotal = 0;
  let subjectsPlaced = 0;
  for (const { slotIdx, slotName, sceneData } of slotSceneDatas) {
    const total = (sceneData.subjects || []).length;
    subjectsTotal += total;
    try {
      const { scene } = liftScaffoldSlot(sceneData, { theme: manifest.theme });
      liftSuccessCount++;
      subjectsPlaced += scene.subjects.length;
    } catch (e) {
      liftErrors.push({ slotIdx, slotName, error: e.message });
    }
  }
  const liftedSubjectRate = subjectsTotal > 0 ? subjectsPlaced / subjectsTotal : 0;

  // ── TEXT BUDGET ──
  let totalCharsAcrossSlots = 0;
  let maxSlotChars = 0;
  for (const { sceneData } of slotSceneDatas) {
    let slotChars = 0;
    for (const subject of sceneData.subjects || []) {
      slotChars += collectTextChars(subject.args, null);
    }
    totalCharsAcrossSlots += slotChars;
    if (slotChars > maxSlotChars) maxSlotChars = slotChars;
  }
  const charsPerSlot = slotsBaked > 0 ? totalCharsAcrossSlots / slotsBaked : 0;

  // ── CONTENT FIDELITY (Sprint 25) ──
  // The presentation's payload is its FACTS. Extract key numbers from the
  // source fixture (deck.json records sourceFile) and measure how many
  // survive into the baked slot args. Literal-match on purpose: the lift
  // prompt teaches value preservation, and strictness IS the signal.
  // Reported separately from the composite so scores stay comparable
  // across pre-fidelity iterations.
  let fidelity = null;
  const sourceFile = manifest.sourceFile
    ? resolve(dir, '..', '..', '..', '..', manifest.sourceFile)
    : null;
  if (sourceFile && existsSync(sourceFile)) {
    const srcSlides = JSON.parse(readFileSync(sourceFile, 'utf8'));
    const srcText = srcSlides
      .map(
        (s) =>
          `${s.title || ''} ${(s.body || []).map((b) => (typeof b === 'string' ? b : b.text || '')).join(' ')}`,
      )
      .join(' ');
    const srcNumbers = extractKeyNumbers(srcText);
    let deckText = '';
    for (const { sceneData } of slotSceneDatas) {
      deckText += JSON.stringify(sceneData.subjects || []);
    }
    const tokens = deckNumberTokens(deckText);
    const tokenValues = valueSetOf(tokens);
    const found = [];
    const missing = [];
    for (const n of srcNumbers) {
      if (numberPreserved(n, tokens, tokenValues)) found.push(n);
      else missing.push(n);
    }
    // Entity recall (Sprint 26): people / orgs / products. Case-insensitive
    // match (covers uppercase "SARAH CHEN" in section titles). Cross-language
    // aliases (Sprint 29): a lift may legitimately render 国际货币基金组织 as
    // its universal short form "IMF" — count the entity as preserved either
    // way. Language PRESERVATION (Chinese in → Chinese out) is enforced by
    // the bake prompt, not scored here.
    const srcEntities = extractKeyEntities(srcSlides);
    const deckTextLower = deckText.toLowerCase();
    // Sentence-position words glue onto runs ("Leverages Microsoft", verbs
    // can't be enumerated) — when the full phrase misses, retry with leading
    // words dropped; a surviving non-generic word ≥4 chars counts.
    const entityMatches = (e) => {
      const forms = [e.toLowerCase(), ...(ENTITY_ALIASES[e] || []).map((a) => a.toLowerCase())];
      if (forms.some((f) => deckTextLower.includes(f))) return true;
      const words = e.split(' ');
      for (let i = 1; i < words.length; i++) {
        const tail = words.slice(i).join(' ').toLowerCase();
        const isGenericTail =
          words.slice(i).length === 1 &&
          (words[i].length < 4 || GENERIC_ENTITY_WORDS.has(words[i].toLowerCase()));
        if (!isGenericTail && deckTextLower.includes(tail)) return true;
      }
      return false;
    };
    const entFound = [];
    const entMissing = [];
    for (const e of srcEntities) {
      if (entityMatches(e)) entFound.push(e);
      else entMissing.push(e);
    }

    // Adversarial precision (Sprint 33): deck numbers with no grounding in
    // the source = hallucinated claims. Source tokens use the same
    // boundary-exact tokenizer as the deck side.
    const sourceTokens = new Set([...deckNumberTokens(srcText), ...extractKeyNumbers(srcText)]);
    const sourceValues = valueSetOf(sourceTokens);
    const deckNumbers = extractDeckPayloadNumbers(slotSceneDatas);
    const hallucinated = deckNumbers.filter((n) => !numberGrounded(n, sourceTokens, sourceValues));

    // Adversarial entity precision (Sprint 35): named people/orgs in the
    // deck that the source never mentioned. Scaffold chrome (slot titles
    // like "Secondary Risks") is the deck's own skeleton, not a claim about
    // the source — whitelist it into the grounding text.
    const chromeText = [
      manifest.scaffold?.label || '',
      ...(manifest.slots || []).map((sl) => `${sl.slotTitle || ''} ${sl.slotName || ''}`),
    ].join(' ');
    const srcTextLower = (srcText + ' ' + chromeText).toLowerCase();
    const deckEntities = extractDeckEntities(slotSceneDatas);
    const hallucEntities = deckEntities.filter((e) => !entityGrounded(e, srcTextLower));

    fidelity = {
      numbers_total: srcNumbers.length,
      numbers_found: found.length,
      number_recall: srcNumbers.length > 0 ? found.length / srcNumbers.length : 1,
      missing_numbers: missing.slice(0, 12),
      deck_numbers_total: deckNumbers.length,
      hallucinated_numbers: hallucinated.slice(0, 12),
      deck_entities_total: deckEntities.length,
      hallucinated_entities: hallucEntities.slice(0, 12),
      entity_precision:
        deckEntities.length > 0
          ? (deckEntities.length - hallucEntities.length) / deckEntities.length
          : 1,
      number_precision:
        deckNumbers.length > 0
          ? (deckNumbers.length - hallucinated.length) / deckNumbers.length
          : 1,
      entities_total: srcEntities.length,
      entities_found: entFound.length,
      entity_recall: srcEntities.length > 0 ? entFound.length / srcEntities.length : 1,
      missing_entities: entMissing.slice(0, 12),
    };
  }

  // ── VISUAL (Sprint 36 — adversarial render audit, report-only) ──
  // Instrumented render of every subject: off-canvas ink, text overflow,
  // unreadable fonts, cross-subject collisions, blank slots, overlapping
  // subject boxes. Not in the composite yet — counts are the worklist.
  const visual = await auditDeckVisual(slotSceneDatas, { palette: manifest.theme });

  // ── SCORE ──
  const structureScore = fillRate * 25;
  const varietyScore = Math.min(1, atomTypesDistinct / 6) * 15;
  const hallucinationScore = (1 - unknownAtomCount / Math.max(1, atomInstances)) * 15;
  const twinScore = twinCoverage * 20;
  const liftScore = (liftSuccessCount / Math.max(1, slotsBaked)) * 15;
  const textScore = textBudgetScore(charsPerSlot) * 10;
  const score =
    structureScore + varietyScore + hallucinationScore + twinScore + liftScore + textScore;

  return {
    deckDir: dir,
    deckName: manifest.deckName,
    structure: {
      slots_total: slotsTotal,
      slots_baked: slotsBaked,
      slots_empty: slotsEmpty,
      slots_errored: slotsErrored,
      fill_rate: fillRate,
      pick_method: manifest.scaffold.pickerMethod,
      scaffold_id: manifest.scaffold.id,
      theme_id: manifest.theme.id,
    },
    atomQuality: {
      atom_instances: atomInstances,
      atom_types_distinct: atomTypesDistinct,
      variety_ratio: varietyRatio,
      unknown_atom_count: unknownAtomCount,
      unknown_atom_types: unknownAtomTypes,
      arg_violations: argViolationCount,
      arg_violations_top_offenders: argViolationTopOffenders,
    },
    threeDReadiness: {
      twin_coverage: twinCoverage,
      untwinned_types: untwinnedTypes,
      lift_success: liftSuccessCount,
      lift_attempted: slotSceneDatas.length,
      lift_errors: liftErrors,
      lifted_subject_rate: liftedSubjectRate,
    },
    visual: {
      total: visual.total,
      counts: visual.counts,
      slots_with_issues: visual.bySlot.map((b) => ({
        slotIdx: b.slotIdx,
        slotName: b.slotName,
        issues: b.issues.slice(0, 6),
      })),
    },
    textBudget: {
      chars_per_slot: charsPerSlot,
      max_slot_chars: maxSlotChars,
    },
    fidelity,
    score: {
      total: Math.round(score * 10) / 10,
      breakdown: {
        structure: Math.round(structureScore * 10) / 10,
        variety: Math.round(varietyScore * 10) / 10,
        hallucination: Math.round(hallucinationScore * 10) / 10,
        twin: Math.round(twinScore * 10) / 10,
        lift: Math.round(liftScore * 10) / 10,
        text: Math.round(textScore * 10) / 10,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

function printHumanTable(result) {
  const s = result.structure;
  const a = result.atomQuality;
  const t = result.threeDReadiness;
  const b = result.textBudget;
  console.log(`\n══ eval: ${result.deckName} ══\n`);
  console.log('STRUCTURE');
  console.log(
    `  slots: ${s.slots_baked}/${s.slots_total} baked (fill_rate ${(s.fill_rate * 100).toFixed(0)}%), ${s.slots_empty} empty, ${s.slots_errored} errored`,
  );
  console.log(`  scaffold: ${s.scaffold_id}  theme: ${s.theme_id}  pick_method: ${s.pick_method}`);
  console.log('\nATOM QUALITY');
  console.log(
    `  atom_instances: ${a.atom_instances}  atom_types_distinct: ${a.atom_types_distinct}  variety_ratio: ${a.variety_ratio.toFixed(2)}`,
  );
  console.log(
    `  unknown_atom_count: ${a.unknown_atom_count}${a.unknown_atom_types.length ? ' [' + a.unknown_atom_types.join(', ') + ']' : ''}`,
  );
  console.log(
    `  arg_violations: ${a.arg_violations}${a.arg_violations_top_offenders.length ? '  top: ' + a.arg_violations_top_offenders.map((o) => `${o.type}.${o.key}×${o.count}`).join(', ') : ''}`,
  );
  console.log('\n3D READINESS');
  console.log(
    `  twin_coverage: ${(t.twin_coverage * 100).toFixed(0)}%${t.untwinned_types.length ? '  untwinned: [' + t.untwinned_types.join(', ') + ']' : ''}`,
  );
  console.log(
    `  lift_success: ${t.lift_success}/${t.lift_attempted}${t.lift_errors.length ? '  errors: ' + t.lift_errors.map((e) => `slot${e.slotIdx}(${e.error.slice(0, 40)})`).join('; ') : ''}`,
  );
  console.log(`  lifted_subject_rate: ${(t.lifted_subject_rate * 100).toFixed(0)}%`);
  if (result.fidelity) {
    const f = result.fidelity;
    console.log('\nCONTENT FIDELITY');
    console.log(
      `  numbers: ${f.numbers_found}/${f.numbers_total} preserved (recall ${(f.number_recall * 100).toFixed(0)}%)${f.missing_numbers.length ? '  missing: ' + f.missing_numbers.join(', ') : ''}`,
    );
    console.log(
      `  entities: ${f.entities_found}/${f.entities_total} preserved (recall ${(f.entity_recall * 100).toFixed(0)}%)${f.missing_entities.length ? '  missing: ' + f.missing_entities.join(', ') : ''}`,
    );
    if (f.number_precision != null) {
      console.log(
        `  precision: ${f.deck_numbers_total - f.hallucinated_numbers.length}/${f.deck_numbers_total} deck numbers grounded (${(f.number_precision * 100).toFixed(0)}%)${f.hallucinated_numbers.length ? '  HALLUCINATED: ' + f.hallucinated_numbers.join(', ') : ''}`,
      );
    }
    if (f.entity_precision != null) {
      console.log(
        `  ent-precision: ${f.deck_entities_total - f.hallucinated_entities.length}/${f.deck_entities_total} deck entities grounded (${(f.entity_precision * 100).toFixed(0)}%)${f.hallucinated_entities.length ? '  INVENTED: ' + f.hallucinated_entities.join(', ') : ''}`,
      );
    }
  }
  if (result.visual) {
    console.log('\nVISUAL AUDIT');
    console.log(
      `  issues: ${result.visual.total}${result.visual.total ? '  ' + JSON.stringify(result.visual.counts) : ''}`,
    );
    for (const b of result.visual.slots_with_issues.slice(0, 5)) {
      for (const i of b.issues.slice(0, 3)) {
        console.log(
          `    slot ${b.slotIdx} (${b.slotName}): ${i.kind} ${i.type || ''} — ${i.detail}`,
        );
      }
    }
  }
  console.log('\nTEXT BUDGET');
  console.log(
    `  chars_per_slot: ${b.chars_per_slot.toFixed(0)}  max_slot_chars: ${b.max_slot_chars}`,
  );
  console.log(
    `\nSCORE: ${result.score.total}/100  (structure ${result.score.breakdown.structure} + variety ${result.score.breakdown.variety} + hallucination ${result.score.breakdown.hallucination} + twin ${result.score.breakdown.twin} + lift ${result.score.breakdown.lift} + text ${result.score.breakdown.text})\n`,
  );
}

// -----------------------------------------------------------------------------
// CLI entry point
// -----------------------------------------------------------------------------
const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const deckDir = process.argv[2];
  if (!deckDir) {
    console.error('Usage: node sdf-js/scripts/eval-deck-quality.mjs <deck-dir>');
    process.exit(2);
  }
  const result = await scoreDeckQuality(deckDir);
  printHumanTable(result);
  writeFileSync(join(resolve(deckDir), 'eval.json'), JSON.stringify(result, null, 2));
  console.log(`Wrote ${join(resolve(deckDir), 'eval.json')}`);
}
