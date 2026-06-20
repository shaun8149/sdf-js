// =============================================================================
// pdf-text-extractor.js — Atlas Present Sprint 2: SlideData[] → DocumentData
// -----------------------------------------------------------------------------
// Transforms the existing PDF parser output (SlideData[]) into a flowing
// document representation suitable for Napkin-style selection-driven UX.
//
// Output schema:
//   DocumentData {
//     flowingText: string,            // concatenated text across all pages
//     pages: [{ startOffset, endOffset, pageNumber }],
//     headings: [{ offset, level, text }]
//   }
//
// Heading detection: font size relative to the document's median body text
// size. Slide.title (already detected by parser as "largest top-area text")
// is always treated as a heading. Among body elements, ones with fontSize
// >= 1.4 × median are also treated as headings; level derived from ratio.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §3 #9, §5
// =============================================================================

/**
 * @typedef {object} PageBoundary
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {number} pageNumber  1-based page number for user-facing display
 */

/**
 * @typedef {object} Heading
 * @property {number} offset
 * @property {1|2|3} level
 * @property {string} text
 */

/**
 * @typedef {object} DocumentData
 * @property {string} flowingText
 * @property {PageBoundary[]} pages
 * @property {Heading[]} headings
 */

/**
 * Transform SlideData[] (from parsePDFFromBytes) into DocumentData.
 *
 * @param {Array<object>} slides — SlideData[]
 * @returns {DocumentData}
 */
export function extractDocumentData(slides) {
  if (!Array.isArray(slides) || slides.length === 0) {
    return { flowingText: '', pages: [], headings: [] };
  }

  // Compute median body fontSize across all slides (for heading detection)
  const bodyFontSizes = [];
  for (const slide of slides) {
    if (Array.isArray(slide.body)) {
      for (const element of slide.body) {
        if (typeof element?.fontSize === 'number' && element.fontSize > 0) {
          bodyFontSizes.push(element.fontSize);
        }
      }
    }
  }
  const medianBodySize = computeMedian(bodyFontSizes) || 12;
  const HEADING_FACTOR = 1.4; // body element >= 1.4 × median is a heading

  const pages = [];
  const headings = [];
  let flowingText = '';

  for (const slide of slides) {
    const startOffset = flowingText.length;

    // Slide title → always a level-1 heading
    if (slide.title && typeof slide.title === 'string' && slide.title.length > 0) {
      headings.push({ offset: flowingText.length, level: 1, text: slide.title });
      flowingText += slide.title;
      flowingText += '\n';
    }

    // Body elements
    if (Array.isArray(slide.body)) {
      for (const element of slide.body) {
        if (!element || typeof element.text !== 'string' || element.text.length === 0) continue;

        // Large body element → heading (level 2 or 3 based on size ratio)
        if (
          typeof element.fontSize === 'number' &&
          element.fontSize >= medianBodySize * HEADING_FACTOR
        ) {
          const ratio = element.fontSize / medianBodySize;
          const level = ratio >= 2.0 ? 2 : 3;
          headings.push({ offset: flowingText.length, level, text: element.text });
        }

        flowingText += element.text;
        flowingText += '\n';
      }
    }

    const endOffset = flowingText.length;
    pages.push({
      pageNumber: (slide.index ?? pages.length) + 1,
      startOffset,
      endOffset,
    });
  }

  return { flowingText, pages, headings };
}

function computeMedian(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
