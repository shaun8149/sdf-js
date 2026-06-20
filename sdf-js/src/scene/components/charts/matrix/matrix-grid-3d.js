// =============================================================================
// matrix-grid-3d.js — N×M card grid / 2×2 matrix (Atlas chart atom).
// -----------------------------------------------------------------------------
// A grid of card boxes with gaps — the Comparison/Opposition archetype Atlas
// was missing (SWOT, 2×2 matrix, BCG, feature grid). Covers PresentationLoad
// "Matrix Charts". Composite atom (box + union).
// =============================================================================

import { box } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(x)));

/**
 * @param {object} opts
 * @param {number} [opts.rows=2]   grid rows (1..6)
 * @param {number} [opts.cols=2]   grid columns (1..6)
 * @param {number} [opts.cardW=0.9] card width
 * @param {number} [opts.cardH=0.7] card height
 * @param {number} [opts.cardD=0.18] card depth
 * @param {number} [opts.gap=0.18] gap between cards
 * @returns {SDF3}
 */
export function matrixGrid3dSDF({
  rows = 2,
  cols = 2,
  cardW = 0.9,
  cardH = 0.7,
  cardD = 0.18,
  gap = 0.18,
} = {}) {
  const R = clampInt(rows, 1, 6);
  const C = clampInt(cols, 1, 6);
  const strideX = cardW + gap;
  const strideY = cardH + gap;
  const offX = ((C - 1) / 2) * strideX;
  const offY = ((R - 1) / 2) * strideY;
  const parts = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const x = c * strideX - offX;
      const y = (R - 1 - r) * strideY - offY; // row 0 on top
      parts.push(box([cardW, cardH, cardD]).translate([x, y, 0]));
    }
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const matrixGrid3dSpec = {
  type: 'matrix-grid-3d',
  category: 'charts/matrix',
  args: {
    rows: { type: 'number', default: 2, min: 1, max: 6, doc: 'Grid rows' },
    cols: { type: 'number', default: 2, min: 1, max: 6, doc: 'Grid columns' },
    cardW: { type: 'number', default: 0.9, doc: 'Card width' },
    cardH: { type: 'number', default: 0.7, doc: 'Card height' },
    cardD: { type: 'number', default: 0.18, doc: 'Card depth' },
    gap: { type: 'number', default: 0.18, doc: 'Gap between cards' },
  },
  examples: [
    { name: 'SWOT 2×2', args: { rows: 2, cols: 2 } },
    { name: 'Feature grid 3×3', args: { rows: 3, cols: 3 } },
    { name: 'Comparison row', args: { rows: 1, cols: 4 } },
  ],
  description: 'N×M card matrix — SWOT, 2×2, BCG, comparison / opposition grid',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave A — taxonomy charts/matrix/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
