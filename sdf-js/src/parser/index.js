// =============================================================================
// parser/index.js — entry point. Auto-detect file type, delegate to parser.
// =============================================================================

import path from 'node:path';
import { parsePDF } from './pdf.js';

/**
 * Parse a deck file. Auto-detects format by extension.
 * @param {string} filePath
 * @returns {Promise<SlideData[]>}
 */
export async function parseDeck(filePath) {
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
