// =============================================================================
// bullet-list-3d.js — bulleted list (Atlas chart atom).
// -----------------------------------------------------------------------------
// N stacked rows, each a round bullet + a content bar. Covers PresentationLoad
// "Lists". Distinct from agenda-list-3d (square number chips). Composite atom
// (sphere + box + union).
// =============================================================================

import { sphere, box } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.items=5]       number of rows (≥1)
 * @param {number} [opts.rowHeight=0.45] vertical stride per row
 * @param {number} [opts.bulletRadius=0.11] bullet sphere radius
 * @param {number} [opts.lineW=1.8]     content bar width
 * @param {number} [opts.lineH=0.16]    content bar height
 * @param {number} [opts.depth=0.1]     Z depth
 * @returns {SDF3}
 */
export function bulletList3dSDF({
  items = 5,
  rowHeight = 0.45,
  bulletRadius = 0.11,
  lineW = 1.8,
  lineH = 0.16,
  depth = 0.1,
} = {}) {
  const N = Math.max(1, Math.floor(items));
  const totalH = (N - 1) * rowHeight;
  const bulletX = -lineW / 2 - bulletRadius - 0.07;
  const parts = [];
  for (let i = 0; i < N; i++) {
    const y = totalH / 2 - i * rowHeight; // first item on top
    parts.push(sphere(bulletRadius).translate([bulletX, y, 0]));
    parts.push(box([lineW, lineH, depth]).translate([0, y, 0]));
  }
  return union(...parts);
}

export const bulletList3dSpec = {
  type: 'bullet-list-3d',
  category: 'charts/lists',
  args: {
    items: { type: 'number', default: 5, doc: 'Number of rows (≥1)' },
    rowHeight: { type: 'number', default: 0.45, doc: 'Vertical stride per row' },
    bulletRadius: { type: 'number', default: 0.11, doc: 'Bullet sphere radius' },
    lineW: { type: 'number', default: 1.8, doc: 'Content bar width' },
    lineH: { type: 'number', default: 0.16, doc: 'Content bar height' },
    depth: { type: 'number', default: 0.1, doc: 'Z depth' },
  },
  examples: [
    { name: 'Bullet list (5)', args: { items: 5 } },
    { name: 'Key points (3)', args: { items: 3 } },
    { name: 'Checklist (7)', args: { items: 7, rowHeight: 0.38 } },
  ],
  description: 'Bulleted list — key points, features, checklist, takeaways',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave A — taxonomy charts/lists/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
