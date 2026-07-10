// =============================================================================
// eval-core.js — Sprint 67: the eval scorer's PURE numeric core, extracted
// from scripts/eval-deck-quality.mjs so the BROWSER can run the same checks
// (quality lights in author-2d — zero LLM, zero node deps). The scripts-side
// scorer re-imports everything from here; behavior is byte-identical.
// =============================================================================

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

// ── derived-value citations (Sprint 65, Rule 24) ──────────────────────────
// Sprint 64's live financial deck proved the lift does CORRECT arithmetic on
// source numbers (+580% growth, 22.7% cash decline, 1.7M rounding) — literal
// matching branded all of them hallucinations. Rule 24 now makes the lift
// cite parents inline ("+580% (30.6 vs 4.5)"); this verifier recomputes the
// arithmetic and, when it checks out AND the cited parents are themselves
// grounded, the derived value counts as grounded-derived, not hallucinated.
export function extractDeckTextLeaves(slotSceneDatas) {
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
  return leaves;
}

const NUM_TOKEN = String.raw`\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?[KMBT%]?|\$?\d+(?:\.\d+)?[KMBT%]?`;

export function verifiedDerivedTokens(leaves, sourceTokens, sourceValues) {
  const verified = new Set();
  const grounded = (tok) => numberGrounded(tok.replace(/,/g, ''), sourceTokens, sourceValues);
  const val = (tok) => numericValueOf(tok);
  // form A: X% (A vs B) / (A → B) / (from A to B) — growth, decline, ratio
  const two = new RegExp(
    `(${NUM_TOKEN})\\s*\\((?:from\\s*)?(${NUM_TOKEN})\\s*(?:vs\\.?|→|->|to|,)\\s*(${NUM_TOKEN})\\)`,
    'g',
  );
  // form B: X (Y) — rounding / scale restatement
  const one = new RegExp(`(${NUM_TOKEN})\\s*\\((${NUM_TOKEN})\\)`, 'g');
  const close = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
  for (const leaf of leaves) {
    const text = String(leaf);
    for (const m of text.matchAll(two)) {
      const [, xTok, aTok, bTok] = m;
      if (!grounded(aTok) || !grounded(bTok)) continue;
      const x = val(xTok);
      const a = val(aTok);
      const b = val(bTok);
      if (x == null || a == null || b == null || a === 0 || b === 0) continue;
      const isPct = /%$/.test(xTok);
      if (isPct) {
        const pct = Math.abs(x);
        const tol = Math.max(1, pct * 0.025);
        const candidates = [
          (Math.abs(a - b) / Math.abs(a)) * 100, // change relative to FIRST cited
          (Math.abs(a - b) / Math.abs(b)) * 100, // change relative to SECOND cited
          (a / b) * 100, // share of
          (b / a) * 100,
        ];
        if (candidates.some((c) => close(pct, c, tol))) verified.add(xTok);
      } else {
        // absolute difference / midpoint of the two parents ("-$336.4M
        // (1,483.2 vs 1,146.8)", "midpoint 319 (314 vs 324)"). Parents and
        // value may differ in unit suffix ($336.4M cites 1,483.2-in-$M), so
        // compare on the BARE magnitudes as written.
        const bareX = Math.abs(
          Number(
            xTok
              .replace(/,/g, '')
              .replace(/^\$/, '')
              .replace(/[KMBT%]$/, ''),
          ),
        );
        const bareA = Math.abs(
          Number(
            aTok
              .replace(/,/g, '')
              .replace(/^\$/, '')
              .replace(/[KMBT%]$/, ''),
          ),
        );
        const bareB = Math.abs(
          Number(
            bTok
              .replace(/,/g, '')
              .replace(/^\$/, '')
              .replace(/[KMBT%]$/, ''),
          ),
        );
        const tol = Math.max(0.11, bareX * 0.01);
        const candidates = [Math.abs(bareA - bareB), (bareA + bareB) / 2];
        if ([bareX].every(Number.isFinite) && candidates.some((c) => close(bareX, c, tol)))
          verified.add(xTok);
      }
    }
    for (const m of text.matchAll(one)) {
      const [, xTok, yTok] = m;
      if (/%$/.test(xTok)) continue; // percent needs two parents (form A)
      if (!grounded(yTok)) continue;
      const x = val(xTok);
      const y = val(yTok);
      // rounding: same value within 6% (1.7M cites 1,696,180)
      if (x != null && y != null && y !== 0 && Math.abs(x - y) / Math.abs(y) <= 0.06)
        verified.add(xTok);
    }
  }
  return verified;
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
