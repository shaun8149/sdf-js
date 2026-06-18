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

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { emptySlideData, classifyLayout, validateSlideData } from './slidedata.js';

// pdfjs-dist v4+ requires explicit worker path even in Node. Point it at the
// bundled legacy worker (single-threaded Node uses main thread anyway, but
// pdfjs throws if workerSrc is unset).
const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

/**
 * Parse a PDF file into SlideData[].
 * @param {string} filePath - Absolute path to .pdf
 * @returns {Promise<SlideData[]>}
 */
export async function parsePDF(filePath) {
  const buffer = await fs.readFile(filePath);
  const data = new Uint8Array(buffer);
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
      fallback.notes = `[parse error] ${e.message}`;
      slides.push(fallback);
    }
  }

  await pdf.cleanup();
  await loadingTask.destroy();
  return slides;
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

  // Title heuristic: largest font size text in top half of page.
  // If multiple items tie on size, pick the topmost (smallest y).
  const topHalfItems = items.filter((it) => it.y < H * 0.5);
  const titleCandidates = topHalfItems.length > 0 ? topHalfItems : items;
  let title = null;
  if (titleCandidates.length > 0) {
    const maxSize = Math.max(...titleCandidates.map((it) => it.fontSize));
    const bigItems = titleCandidates.filter((it) => it.fontSize >= maxSize - 0.5);
    bigItems.sort((a, b) => a.y - b.y); // topmost first
    title = bigItems[0].text;
  }

  // Body: everything not in the title (matched by text equality).
  // Detect bullets: lines starting with •, ▪, -, *, ▸, ◦, ◾
  const bulletPrefix = /^[•▪■▸◦○●▶*\-·▪▫]\s*/;
  const body = items
    .filter((it) => it.text !== title)
    .map((it) => {
      const isBullet = bulletPrefix.test(it.text);
      return {
        kind: isBullet ? 'bullet' : 'paragraph',
        text: isBullet ? it.text.replace(bulletPrefix, '').trim() : it.text,
        level: 0, // TODO: detect indent level by x offset
        bbox: { x: it.x, y: it.y, w: it.w, h: it.h },
        fontSize: it.fontSize,
        fontFamily: it.fontFamily,
      };
    });

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
