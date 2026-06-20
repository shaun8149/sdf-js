// =============================================================================
// parser/index.js — entry point. Auto-detect file type, delegate to parser.
//
// Browser-safe: `node:path` is loaded lazily inside parseDeck (Node-only API).
// Browser callers should import `parsePDFFromBytes` directly from ./pdf.js
// instead of going through parseDeck.
// =============================================================================

import { parsePDF } from './pdf.js';

/**
 * Parse a deck file. Auto-detects format by extension. NODE-ONLY (uses
 * node:path + fs). Browsers should use parsePDFFromBytes directly.
 * @param {string} filePath
 * @returns {Promise<SlideData[]>}
 */
export async function parseDeck(filePath) {
  const { default: path } = await import('node:path');
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return parsePDF(filePath);
    case '.pptx':
      throw new Error('PPTX parser not yet implemented (Sprint 2). Convert to PDF first.');
    default:
      throw new Error(`Unsupported deck format: ${ext} (only .pdf and .pptx supported)`);
  }
}

export { parsePDF, parsePDFFromBytes } from './pdf.js';
export { emptySlideData, validateSlideData, classifyLayout } from './slidedata.js';
