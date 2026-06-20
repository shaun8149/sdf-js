// =============================================================================
// agenda-list-3d.js — numbered agenda (Atlas chart atom).
// -----------------------------------------------------------------------------
// N stacked rows, each a square number chip + a content bar. Covers
// PresentationLoad "Agenda". Distinct from bullet-list-3d (round bullets, no
// chip). Composite atom (box + union).
// =============================================================================

import { box } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.items=5]     number of rows (≥1)
 * @param {number} [opts.rowHeight=0.5] vertical stride per row
 * @param {number} [opts.chipSize=0.34] number-chip edge
 * @param {number} [opts.lineW=2.0]   content bar width
 * @param {number} [opts.lineH=0.22]  content bar height
 * @param {number} [opts.depth=0.12]  Z depth
 * @returns {SDF3}
 */
export function agendaList3dSDF({
  items = 5,
  rowHeight = 0.5,
  chipSize = 0.34,
  lineW = 2.0,
  lineH = 0.22,
  depth = 0.12,
} = {}) {
  const N = Math.max(1, Math.floor(items));
  const totalH = (N - 1) * rowHeight;
  const chipX = -lineW / 2 - chipSize / 2 - 0.1;
  const parts = [];
  for (let i = 0; i < N; i++) {
    const y = totalH / 2 - i * rowHeight; // first item on top
    parts.push(box([chipSize, chipSize, depth]).translate([chipX, y, 0]));
    parts.push(box([lineW, lineH, depth]).translate([0, y, 0]));
  }
  return union(...parts);
}

export const agendaList3dSpec = {
  type: 'agenda-list-3d',
  category: 'charts/agenda',
  args: {
    items: { type: 'number', default: 5, doc: 'Number of rows (≥1)' },
    rowHeight: { type: 'number', default: 0.5, doc: 'Vertical stride per row' },
    chipSize: { type: 'number', default: 0.34, doc: 'Number-chip edge' },
    lineW: { type: 'number', default: 2.0, doc: 'Content bar width' },
    lineH: { type: 'number', default: 0.22, doc: 'Content bar height' },
    depth: { type: 'number', default: 0.12, doc: 'Z depth' },
  },
  examples: [
    { name: 'Agenda (5)', args: { items: 5 } },
    { name: 'Short agenda (3)', args: { items: 3 } },
    { name: 'Long agenda (7)', args: { items: 7, rowHeight: 0.4 } },
  ],
  description: 'Numbered agenda — meeting agenda, table of contents, steps',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave A — taxonomy charts/agenda/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
