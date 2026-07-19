// =============================================================================
// slide-digest.js — SlideData page → LLM-ready text digest (deterministic layer)
// -----------------------------------------------------------------------------
// The extraction LLM only sees what this file gives it, so every deterministic
// safeguard against chart fabrication lives HERE, unit-testable without a
// model in the loop:
//
//   • detectTickLadders — an equally-spaced numeric run in a chart page's text
//     layer is the AXIS, not the data. The first supervisor audit of the
//     slides→IR pipeline found tick ladders copied as data on 5 of 8 chart
//     pages ("产品粘性大幅提升" rendered as a collapse from 40 to 4). The
//     digest names the ladders so the extractor refuses them.
//   • spatialPairs — y-sorted line order lies about side-by-side columns; we
//     have bboxes, so each prominent number is paired with its nearest
//     HEADING-like label in 2D (nearest raw line is usually a column's
//     body-copy tail — "with your own text." — which names nothing).
//   • slideDigest — assembles the page text (top→bottom, font-size hints) +
//     the pairing notes + the tick-ladder warning into one prompt block.
//
// Extracted from scripts/gen-deck-ir.mjs so the eval harness and unit tests
// exercise the same code the pipeline runs.
// =============================================================================

/** Equally-spaced numeric runs (≥3 items incl. 0, or ≥4 anywhere) = axis ticks. */
export function detectTickLadders(nums) {
  // An equally-spaced run is a SUBSEQUENCE of the page's numbers, not a
  // contiguous slice — one data point between two ticks (73 amid 0/50/100)
  // must not hide the ladder. O(n²·n) pair-seeded greedy extension; page
  // number counts are tiny.
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const ladders = [];
  const seen = new Set();
  for (let i = 0; i < sorted.length - 2; i++) {
    for (let j = i + 1; j < sorted.length - 1; j++) {
      const step = sorted[j] - sorted[i];
      if (step <= 0) continue;
      const run = [sorted[i], sorted[j]];
      let next = sorted[j] + step;
      for (let k = j + 1; k < sorted.length; k++) {
        if (Math.abs(sorted[k] - next) < step * 0.02) {
          run.push(sorted[k]);
          next += step;
        }
      }
      if (run.length >= 3 && (run.includes(0) || run.length >= 4)) {
        const key = run.join(',');
        if (!seen.has(key)) {
          seen.add(key);
          ladders.push(run);
        }
      }
    }
  }
  // drop runs that are strict subsets of a longer detected ladder
  return ladders.filter(
    (r) => !ladders.some((o) => o !== r && o.length > r.length && r.every((v) => o.includes(v))),
  );
}

const NUMERIC = /^[\d,.]+%?$/;

/** Per-item {text,x,y,fs} centers from a SlideData body. */
function itemCenters(slide) {
  return (slide.body || [])
    .map((b) => ({
      text: (b.text || '').trim(),
      x: (b.bbox?.x ?? 0) + (b.bbox?.w ?? 0) / 2,
      y: (b.bbox?.y ?? 0) + (b.bbox?.h ?? 0) / 2,
      fs: b.fontSize ?? 0,
    }))
    .filter((l) => l.text);
}

/**
 * Pair each prominent number with its nearest heading-like label in 2D.
 * Returns [{num, label, d}] — deterministic, bbox-driven.
 */
export function spatialPairs(slide) {
  const items = itemCenters(slide);
  const bigNums = items.filter((l) => NUMERIC.test(l.text) && l.fs >= 14);
  const nonNum = items.filter((l) => !NUMERIC.test(l.text) && l.text.length >= 3);
  const fsMedian =
    nonNum.map((l) => l.fs).sort((a, b) => a - b)[Math.floor(nonNum.length / 2)] || 0;
  const headings = nonNum.filter(
    (l) => l.fs > fsMedian || (/^[A-Z0-9 .:：-]+$/.test(l.text) && l.text.length <= 40),
  );
  const labels = headings.length ? headings : nonNum;
  return bigNums
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
      return best ? { num: n.text, label: best.text, d: bd } : null;
    })
    .filter(Boolean);
}

/**
 * Page-level ladder analysis, font-RELATIVE (absolute fs thresholds don't
 * transfer between decks: D0961's ticks are fs11 under fs36 data; the 2015
 * BP's ticks are fs20 with no bigger number on the page).
 *   strong    — ladder members are smaller than the page's biggest numbers →
 *               axis ticks, refuse as data (and gate on them).
 *   ambiguous — the ladder IS the page's most prominent number set → could be
 *               axis (chart page whose only text numbers are its ticks) or a
 *               genuine data ladder (ten fill gauges 10%…100%); the label-
 *               pairing evidence decides.
 */
export function pageLadders(slide) {
  const nums = (slide.body || [])
    .map((b) => ({ text: (b.text || '').trim(), fs: b.fontSize ?? 0 }))
    .filter((l) => NUMERIC.test(l.text))
    .map((l) => ({ v: parseFloat(l.text.replace(/[,%]/g, '')), fs: l.fs }));
  const ladders = detectTickLadders(nums.map((n) => n.v));
  const maxFs = Math.max(0, ...nums.map((n) => n.fs));
  // Per-VALUE font = the MIN fs among its occurrences: when an axis tick and
  // a data value share a number (d0961's 50 appears as fs11 tick AND fs28
  // gauge), the tick occurrence is what makes the run an axis.
  const minFsOf = new Map();
  for (const n of nums) minFsOf.set(n.v, Math.min(minFsOf.get(n.v) ?? Infinity, n.fs));
  const strong = [];
  let ambiguous = [];
  for (const run of ladders) {
    const runFs = Math.max(...run.map((v) => minFsOf.get(v) ?? 0));
    if (runFs < maxFs - 0.5) strong.push(run);
    else if (run.length > 3) ambiguous.push(run);
    // 3-item runs at full prominence are combinatorial NOISE (any page whose
    // data includes 0-anchored spacings coughs up [0,a,2a] triples — eval
    // round 5 watched them eat d0961's real gauge values) — dropped.
  }
  // Escalations (both bought by eval round 4, where the model INTERPOLATED
  // between tick anchors on pages whose only numbers are their axes):
  //   • a ladder containing 0 is an axis — data ladders don't start at zero;
  //   • ≥2 ambiguous ladders on one page = a multi-axis chart page (each
  //     chart contributes its own tick run); a single genuine data ladder
  //     (ten fill gauges) is always alone.
  const withZero = ambiguous.filter((r) => r.includes(0));
  ambiguous = ambiguous.filter((r) => !r.includes(0));
  strong.push(...withZero);
  if (ambiguous.length >= 2) {
    strong.push(...ambiguous);
    ambiguous = [];
  }
  return { strong, ambiguous };
}

/**
 * Deck-level nav chrome: short label sets repeated across ≥3 pages are site
 * furniture (running footers, section tab rails), not page content — the 2013
 * BP's 4-tab rail leaked into three stations as nodes with subs scrambled
 * across pillars. Returns a Set of chrome strings for slideDigest's opts.chrome.
 *
 * Guardrails (the 2013 BP's text layer is FRAGMENTED — single chars 节/跳/动
 * repeat everywhere): items must be ≥minLen chars and not pure digits/punct,
 * and if the surviving set is still huge the text layer is fragmentation
 * noise — return empty rather than poison the digest with 100 banned words.
 */
export function detectNavChrome(slides, { minPages = 3, minLen = 4, maxLen = 14, fuse = 12 } = {}) {
  const count = new Map();
  for (const slide of slides) {
    const seen = new Set();
    for (const b of slide.body || []) {
      const t = (b.text || '').trim();
      if (
        t.length >= minLen &&
        t.length <= maxLen &&
        !/^[\d\s.,:;/、,。·©®™()()%-]+$/.test(t) &&
        !seen.has(t)
      ) {
        seen.add(t);
        count.set(t, (count.get(t) || 0) + 1);
      }
    }
  }
  const chrome = [...count.entries()].filter(([, n]) => n >= minPages).map(([t]) => t);
  return new Set(chrome.length > fuse ? [] : chrome);
}

/**
 * Full prompt block for one page.
 * opts.vision: the page image accompanies this digest — omit the tick-ladder
 * warnings entirely (they are text-blindness workarounds; with the image
 * present they only scare the model away from legitimate chart reads — eval
 * vision round 1 watched an unwarranted demotion on a ten-gauge data page).
 * opts.chrome: Set of nav-chrome strings (detectNavChrome) to call out.
 */
export function slideDigest(slide, i, opts = {}) {
  const lines = (slide.body || [])
    .map((b) => ({ text: (b.text || '').trim(), y: b.bbox?.y ?? 0, fs: b.fontSize ?? 0 }))
    .filter((l) => l.text);
  lines.sort((a, b) => a.y - b.y);
  const body = lines.map((l) => `[fs${Math.round(l.fs)}] ${l.text}`).join('\n');

  const { strong, ambiguous } = opts.vision ? { strong: [], ambiguous: [] } : pageLadders(slide);
  let warn = '';
  if (strong.length) {
    warn += `\nWARNING: the number run(s) ${strong.map((l) => `[${l.join(', ')}]`).join(' and ')} are equally spaced AND less prominent than the page's biggest numbers — AXIS TICKS, not data. The real data lives in bar/line geometry you cannot see. Do NOT emit these runs as magnitude/series values.`;
    // A tick value can COLLIDE with a real data value (d0961: 50 is an fs11
    // axis tick AND an fs36 gauge) — without this note the model refuses the
    // prominent occurrence too and demotes the whole page.
    const numsFs = (slide.body || [])
      .map((b) => ({ text: (b.text || '').trim(), fs: b.fontSize ?? 0 }))
      .filter((l) => NUMERIC.test(l.text))
      .map((l) => ({ v: parseFloat(l.text.replace(/[,%]/g, '')), fs: l.fs }));
    const maxFs = Math.max(0, ...numsFs.map((n) => n.fs));
    const dual = [
      ...new Set(strong.flat().filter((v) => numsFs.some((n) => n.v === v && n.fs >= maxFs - 0.5))),
    ];
    if (dual.length)
      warn += ` EXCEPTION: ${dual.join(', ')} ALSO appear at the page's largest size — those prominent occurrences are DATA; keep them.`;
  }
  if (ambiguous.length)
    warn += `\nAMBIGUOUS: the number run(s) ${ambiguous.map((l) => `[${l.join(', ')}]`).join(' and ')} are equally spaced and ARE the page's most prominent numbers. They are either axis ticks (chart page → treat per the axis-ticks rule) or a genuine data ladder (e.g. ten fill gauges). Decide from the SPATIAL PAIRING evidence: if each number pairs with its own item label, it is DATA; if they pair with nothing / cluster on one edge, they are ticks.`;

  const pairs = spatialPairs(slide);
  const pairNote = pairs.length
    ? `\nSPATIAL PAIRING (each number's nearest label by 2D distance — trust THIS over line order):\n${pairs.map((p) => `${p.num} ↔ "${p.label.slice(0, 40)}"`).join('\n')}`
    : '';

  const chromeHits = opts.chrome
    ? [...new Set(lines.map((l) => l.text).filter((t) => opts.chrome.has(t)))]
    : [];
  const chromeNote = chromeHits.length
    ? `\nNAV CHROME (these labels repeat across many pages — a section tab rail / running header, NOT this page's content; do NOT use them as nodes or attach subs to them): ${chromeHits.join(' · ')}`
    : '';

  return `PAGE ${i + 1}\nTITLE: ${slide.title || '(untitled)'}\nLAYOUT: ${slide.layout || '?'}\nBODY (top→bottom, fs = font size — bigger = more prominent):\n${body || '(no body text)'}${chromeNote}${pairNote}${warn}`;
}
