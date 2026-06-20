// =============================================================================
// waterfall-3d.js — waterfall chart (Atlas chart atom).
// -----------------------------------------------------------------------------
// N floating bars, each starting where the previous ended (cumulative deltas) —
// a waterfall / bridge chart. Covers PresentationLoad "Waterfall". Composite
// atom (box + union).
// =============================================================================

import { box } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

function defaultDeltas(n) {
  // start tall, then alternating gains / smaller losses (reads as a bridge)
  const d = [];
  for (let i = 0; i < n; i++) d.push(i === 0 ? 0.7 : i % 2 ? 0.35 : -0.25);
  return d;
}

/**
 * @param {object} opts
 * @param {number} [opts.count=5]    number of bars (used when deltas omitted)
 * @param {number[]} [opts.deltas=null] per-bar signed deltas (cumulative)
 * @param {number} [opts.barW=0.5]   bar width
 * @param {number} [opts.gap=0.12]   gap between bars
 * @param {number} [opts.depth=0.4]  Z depth
 * @returns {SDF3}
 */
export function waterfall3dSDF({
  count = 5,
  deltas = null,
  barW = 0.5,
  gap = 0.12,
  depth = 0.4,
} = {}) {
  const D = deltas && deltas.length ? deltas : defaultDeltas(Math.max(1, Math.floor(count)));
  const N = D.length;
  const stride = barW + gap;
  const offX = ((N - 1) / 2) * stride;
  const parts = [];
  let cum = 0;
  for (let i = 0; i < N; i++) {
    const y0 = cum;
    const y1 = cum + D[i];
    const barH = Math.max(0.02, Math.abs(D[i]));
    const x = i * stride - offX;
    parts.push(box([barW, barH, depth]).translate([x, (y0 + y1) / 2, 0]));
    cum = y1;
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const waterfall3dSpec = {
  type: 'waterfall-3d',
  category: 'charts/data',
  args: {
    count: { type: 'number', default: 5, doc: 'Number of bars (when deltas omitted)' },
    deltas: { type: 'array', default: null, doc: 'Per-bar signed deltas (cumulative)' },
    barW: { type: 'number', default: 0.5, doc: 'Bar width' },
    gap: { type: 'number', default: 0.12, doc: 'Gap between bars' },
    depth: { type: 'number', default: 0.4, doc: 'Z depth' },
  },
  examples: [
    { name: 'Waterfall (5)', args: { count: 5 } },
    { name: 'P&L bridge', args: { deltas: [1.0, 0.4, -0.3, 0.5, -0.6, 0.2] } },
    { name: 'Short', args: { count: 3 } },
  ],
  description: 'Waterfall / bridge chart — cumulative gains and losses',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave B — taxonomy charts/data/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
