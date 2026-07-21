// =============================================================================
// pdf.js — PDF → SlideData[] parser (M0.3, Atlas use case lock)
// -----------------------------------------------------------------------------
// Uses pdfjs-dist (Mozilla PDF.js) to extract per-page text items with bbox +
// font size + font name. Heuristic title detection (largest top-area text).
// Optional theme extraction from operator stream colors (best effort).
//
// NOT included in this MVP:
//   - Screenshot rasterization (LibreOffice headless or node-canvas — heavy
//     deps deferred to Sprint 2+)
//   - Image extraction (PDF op-stream walking is non-trivial — deferred)
//   - OCR fallback for scanned PDFs (deferred)
//
// Hard rules (per memory):
//   1. Local processing only — file path stays local, no network calls
//   2. Lossless — preserve text + bbox even if mapper doesn't use them
//   3. Graceful fallback — bad page → emit empty SlideData, don't crash
// =============================================================================

import { emptySlideData, classifyLayout, validateSlideData } from './slidedata.js';

// Browser-safe pdfjs loader — both module import + worker config are deferred
// to first use so this file loads in the browser without resolving bare
// specifiers (CORS blocks `pdfjs-dist/...` at top-level in pure ES modules).
//
// Node uses the bundled legacy worker via createRequire (single-threaded).
// Browser uses unpkg CDN (no build step in this MVP; swap to a vendored copy
// in Sprint 2 if offline use becomes important).
const PDFJS_BROWSER_CDN = 'https://unpkg.com/pdfjs-dist@4.0.379/legacy/build/pdf.mjs';
const PDFJS_WORKER_BROWSER_CDN = 'https://unpkg.com/pdfjs-dist@4.0.379/legacy/build/pdf.worker.mjs';

let pdfjsModule = null;
async function getPdfjs() {
  if (pdfjsModule) return pdfjsModule;
  if (typeof window === 'undefined') {
    // Node — resolve the locally installed copy.
    pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createRequire } = await import('node:module');
    const { pathToFileURL } = await import('node:url');
    const require = createRequire(import.meta.url);
    // pathToFileURL, not the raw resolved path: on Windows require.resolve
    // yields "C:\…", which the ESM worker loader rejects ("protocol 'c:'").
    pdfjsModule.GlobalWorkerOptions.workerSrc = pathToFileURL(
      require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
    ).href;
  } else {
    // Browser — pull from CDN at call time.
    pdfjsModule = await import(/* @vite-ignore */ PDFJS_BROWSER_CDN);
    pdfjsModule.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_BROWSER_CDN;
  }
  return pdfjsModule;
}

/**
 * Parse a PDF file from disk (Node only). Wraps parsePDFFromBytes after
 * fs.readFile.
 *
 * @param {string} filePath - Absolute path to .pdf
 * @returns {Promise<SlideData[]>}
 */
export async function parsePDF(filePath) {
  // Node-only dynamic import — keeps top-of-module browser-safe.
  const { default: fs } = await import('node:fs/promises');
  const buffer = await fs.readFile(filePath);
  return parsePDFFromBytes(new Uint8Array(buffer), filePath);
}

/**
 * Parse a PDF from raw bytes (browser + Node compatible). Browser callers pass
 * a Uint8Array from File API ArrayBuffer; Node `parsePDF(filePath)` wraps this
 * after fs.readFile.
 *
 * @param {Uint8Array} data - PDF bytes
 * @param {string} [sourceLabel] - optional source label for error messages
 * @returns {Promise<SlideData[]>}
 */
export async function parsePDFFromBytes(data, sourceLabel = '<bytes>') {
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0, // suppress info logs
  });
  const pdf = await loadingTask.promise;
  const slides = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const slide = await parsePage(pdf, i);
      slides.push(slide);
    } catch (e) {
      // Graceful fallback: emit empty SlideData with error noted
      const fallback = emptySlideData(i - 1, 'pdf');
      fallback.notes = `[parse error in ${sourceLabel} page ${i}] ${e.message}`;
      slides.push(fallback);
    }
  }

  await pdf.cleanup();
  await loadingTask.destroy();
  return slides;
}

/**
 * Group PDF.js text items into visual lines.
 *
 * Each PDF.js text item is one "text run" — for English that's roughly a word,
 * for CJK that's often a single character. Downstream consumers
 * (pdf-text-extractor) treat one item = one paragraph, so without clustering
 * a CJK page renders as one character per line (vertical stack bug).
 *
 * Clustering rule:
 *   - 2 items are in the same line if |y1 - y2| < 0.5 × avg(fontSize)
 *   - Sort items in a line by x (left → right)
 *   - Split a same-y band back into separate visual lines when a large
 *     horizontal gap indicates columns rather than words in one sentence
 *   - Concat text with space INSERTED only if x-gap > 0.3 × avg(fontSize)
 *     (preserves natural English inter-word space; CJK glyphs touching → no
 *     spurious space inserted)
 *
 * @param {Array<{text,x,y,w,h,fontSize,fontFamily}>} items
 * @returns {Array<{text,x,y,w,h,fontSize,fontFamily}>} one entry per visual line
 */
export function clusterItemsIntoLines(items) {
  if (items.length === 0) return [];
  // Sort by y (top-to-bottom), then x (left-to-right within a row)
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  let current = [sorted[0]];
  let currentY = sorted[0].y;
  let currentH = sorted[0].fontSize;

  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i];
    const tol = Math.max(currentH, it.fontSize) * 0.5;
    if (Math.abs(it.y - currentY) <= tol) {
      current.push(it);
      // Track tallest item in line — drives the next y tolerance
      currentH = Math.max(currentH, it.fontSize);
    } else {
      lines.push(...mergeLineBand(current));
      current = [it];
      currentY = it.y;
      currentH = it.fontSize;
    }
  }
  lines.push(...mergeLineBand(current));
  return lines;
}

function mergeLineBand(itemsInBand) {
  const sorted = [...itemsInBand].sort((a, b) => a.x - b.x);
  const avgFontSize = sorted.reduce((s, it) => s + it.fontSize, 0) / sorted.length;
  const segments = [];
  let segment = [sorted[0]];
  let prev = sorted[0];
  let prevEndX = prev.x + prev.w;

  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i];
    const gap = it.x - prevEndX;
    const columnGap = Math.max(avgFontSize * 8, Math.min(prev.w, it.w) * 0.65);
    if (gap > columnGap) {
      segments.push(segment);
      segment = [it];
    } else {
      segment.push(it);
    }
    prev = it;
    prevEndX = Math.max(prevEndX, it.x + it.w);
  }
  segments.push(segment);
  return segments.map((items) => mergeLine(items));
}

function mergeLine(itemsInLine) {
  // Sort left-to-right
  const sorted = [...itemsInLine].sort((a, b) => a.x - b.x);
  const avgFontSize = sorted.reduce((s, it) => s + it.fontSize, 0) / sorted.length;
  let text = sorted[0].text;
  let prevEndX = sorted[0].x + sorted[0].w;
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i];
    const gap = it.x - prevEndX;
    // Insert space only if visible gap (typical inter-word space ≈ 0.3-0.5 × fontSize)
    // CJK glyphs sit flush → gap is ~0 → no space inserted
    if (gap > avgFontSize * 0.3) text += ' ';
    text += it.text;
    prevEndX = it.x + it.w;
  }
  // bbox of merged line: leftmost x, top y, total width, max h
  const xMin = Math.min(...sorted.map((it) => it.x));
  const xMax = Math.max(...sorted.map((it) => it.x + it.w));
  const yMin = Math.min(...sorted.map((it) => it.y));
  const yMax = Math.max(...sorted.map((it) => it.y + it.h));
  // Use first item's font for the merged line (heuristic — most lines are
  // single-font; mixed-font lines pick the leftmost which is usually the
  // semantically dominant one)
  return {
    text,
    x: xMin,
    y: yMin,
    w: xMax - xMin,
    h: yMax - yMin,
    fontSize: sorted[0].fontSize,
    fontFamily: sorted[0].fontFamily,
  };
}

/**
 * Filter page-chrome (repeating headers, footers, page numbers, URLs) from
 * clustered line set. Used by parsePage after clusterItemsIntoLines.
 *
 * Strategy: position + pattern. A line is chrome if BOTH:
 *   1. y is in top/bottom 6% of page (typical margin for headers/footers)
 *   2. text matches a chrome pattern (URL, page number "N/M", timestamp)
 *      OR is the only line in that y-zone (single isolated margin item)
 *
 * In-body lines (between margins) are always kept, even if they happen to
 * contain URLs (article citations / inline references stay).
 *
 * @param {Array<{text,x,y,w,h,fontSize,fontFamily}>} lines
 * @param {number} pageHeight - page height in same units as line.y
 * @returns {Array<{text,x,y,w,h,fontSize,fontFamily}>}
 */
export function filterPageChrome(lines, pageHeight) {
  if (lines.length === 0) return [];
  const TOP_BAND = pageHeight * 0.06;
  const BOTTOM_BAND = pageHeight * 0.94;

  // Chrome patterns:
  //   URL anywhere in line:           https://... | http://... | www.foo.com
  //   Page indicator at line end:     "13/42" or " 13/42" or "page 13"
  //   Datestamp at line start:        "2026/6/18" "2026-06-18" "06/18/2026"
  //   Standalone short number-ish:    "13", "Page 13", "13 of 42"
  const chromePatterns = [
    /https?:\/\/\S+/i,
    /\bwww\.\S+/i,
    /\d+\s*\/\s*\d+\s*$/, // "2/13" at end of line
    /^\s*(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/,
    /^\s*page\s+\d+/i,
    /^\s*\d+\s+of\s+\d+\s*$/i,
  ];

  return lines.filter((line) => {
    const inTopBand = line.y < TOP_BAND;
    const inBotBand = line.y > BOTTOM_BAND;
    if (!inTopBand && !inBotBand) return true; // body — always keep
    // In margin band — filter if chrome pattern matches
    for (const re of chromePatterns) {
      if (re.test(line.text)) return false;
    }
    return true;
  });
}

async function parsePage(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.0 });
  const W = viewport.width;
  const H = viewport.height;

  const textContent = await page.getTextContent({
    includeMarkedContent: false,
    disableNormalization: false,
  });

  // Extract structured text items. PDF.js text item shape:
  //   { str, dir, transform: [a,b,c,d,e,f], width, height, fontName }
  // transform[4] = x (PDF coords, Y-up from bottom-left)
  // transform[5] = y (PDF coords)
  // We flip to screen coords (Y-down from top-left): screenY = H - pdfY
  const items = textContent.items
    .filter((it) => it.str && it.str.trim().length > 0)
    .map((it) => {
      const x = it.transform[4];
      const yPdf = it.transform[5];
      const fontSize = it.height || it.transform[3] || 12;
      return {
        text: it.str,
        x,
        y: H - yPdf - fontSize, // screen coords: top edge of text
        w: it.width || it.str.length * fontSize * 0.5, // approx if no width
        h: fontSize,
        fontSize,
        fontFamily: it.fontName || null,
      };
    });

  // 2026-06-21 fix: cluster items into lines BEFORE downstream consumers.
  // PDF.js gives each text run as its own item — for CJK PDFs that's often
  // each character (no inter-char space anchor), causing pdf-text-extractor
  // (which adds \n after each body element) to render every character as
  // its own div = vertical character stack.
  // Cluster by y-band (items within ~0.5 × fontSize are same line), then
  // sort by x within the line, then concatenate text (insert space only if
  // x-gap exceeds 0.3 × fontSize — preserves natural inter-word spacing in
  // English while NOT inserting spurious spaces between CJK chars).
  const rawLines = clusterItemsIntoLines(items);
  // 2026-06-21 fix #2: filter page-chrome (header / footer / page number).
  // English PDFs (e.g. blog-export PDFs from aetherlabs.ai) carry the article
  // title in top margin + URL + "N/M" page indicator in bottom margin on
  // every page. Without filter these get joined into body text, polluting
  // every paragraph break with "https://... 2/13" garbage.
  const lines = filterPageChrome(rawLines, H);

  // Title heuristic: largest font size LINE in top half, **excluding** items
  // that look like in-chart labels (pure numbers, percentage signs, single
  // characters). Real titles contain letters.
  const titleLikeRegex = /[A-Za-z一-鿿]{2,}/; // ≥2 letters/CJK = word-y
  const topHalfItems = lines.filter((it) => it.y < H * 0.5 && titleLikeRegex.test(it.text));
  const titleCandidates =
    topHalfItems.length > 0 ? topHalfItems : lines.filter((it) => titleLikeRegex.test(it.text));
  let title = null;
  if (titleCandidates.length > 0) {
    const maxSize = Math.max(...titleCandidates.map((it) => it.fontSize));
    const bigItems = titleCandidates.filter((it) => it.fontSize >= maxSize - 0.5);
    bigItems.sort((a, b) => a.y - b.y); // topmost first
    title = bigItems[0].text;
  }

  // Body: every clustered line not the title.
  // Detect bullets: lines starting with •, ▪, -, *, ▸, ◦, ◾
  // Drop empty-after-strip items (PDF decoration glyphs that had only a
  // bullet character with no following text).
  const bulletPrefix = /^[•▪■▸◦○●▶*\-·▪▫]\s*/;
  const body = lines
    .filter((it) => it.text !== title)
    .map((it) => {
      const isBullet = bulletPrefix.test(it.text);
      const cleaned = isBullet ? it.text.replace(bulletPrefix, '').trim() : it.text;
      return {
        kind: isBullet ? 'bullet' : 'paragraph',
        text: cleaned,
        level: 0, // TODO: detect indent level by x offset
        bbox: { x: it.x, y: it.y, w: it.w, h: it.h },
        fontSize: it.fontSize,
        fontFamily: it.fontFamily,
      };
    })
    .filter((b) => b.text.length > 0);

  // Visuals: defer to Sprint 2 (need PDF op-stream walking). For now empty.
  const visuals = [];

  // Theme: cheap heuristic — most common font family among body items
  const fontCounts = {};
  for (const b of body) {
    if (b.fontFamily) fontCounts[b.fontFamily] = (fontCounts[b.fontFamily] || 0) + 1;
  }
  const topFont = Object.entries(fontCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const theme = {
    primaryColor: '#000000', // TODO: extract from op-stream color ops
    accentColors: [],
    textColor: '#000000',
    bgColor: '#ffffff',
    fontFamily: topFont,
    vibe: null,
  };

  // Layout classification
  const layout = classifyLayout({
    title,
    body,
    visuals,
    pageSize: { width: W, height: H },
  });

  const slide = {
    index: pageNum - 1,
    sourceFormat: 'pdf',
    title,
    body,
    visuals,
    layout,
    theme,
    notes: null, // PDFs typically don't carry speaker notes
    pageSize: { width: W, height: H },
    screenshot: null, // Sprint 2
    classified: null, // M1.5 LLM classifier
  };

  const errs = validateSlideData(slide);
  if (errs.length > 0) {
    throw new Error(`SlideData validation failed: ${errs.join('; ')}`);
  }
  return slide;
}
