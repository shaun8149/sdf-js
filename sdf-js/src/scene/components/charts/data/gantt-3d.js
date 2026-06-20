// =============================================================================
// gantt-3d.js — Gantt chart (Atlas chart atom).
// -----------------------------------------------------------------------------
// N horizontal task bars on stacked rows, each with a start offset + duration
// along a shared track. Covers PresentationLoad "Gantt / schedule". Composite
// atom (box + union).
// =============================================================================

import { box } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

function defaultSegments(n) {
  // staggered cascade: each task starts a bit later, similar durations
  const s = [];
  for (let i = 0; i < n; i++) s.push({ start: Math.min(0.6, i * 0.16), dur: 0.34 });
  return s;
}

/**
 * @param {object} opts
 * @param {number} [opts.tasks=4]       number of task rows (used when segments omitted)
 * @param {Array<{start:number,dur:number}>} [opts.segments=null] per-task {start,dur} as track fractions
 * @param {number} [opts.rowHeight=0.42] vertical stride per row
 * @param {number} [opts.barH=0.26]     bar height
 * @param {number} [opts.depth=0.18]    Z depth
 * @param {number} [opts.trackLength=3.0] total track width (X)
 * @returns {SDF3}
 */
export function gantt3dSDF({
  tasks = 4,
  segments = null,
  rowHeight = 0.42,
  barH = 0.26,
  depth = 0.18,
  trackLength = 3.0,
} = {}) {
  const S =
    segments && segments.length ? segments : defaultSegments(Math.max(1, Math.floor(tasks)));
  const N = S.length;
  const topY = ((N - 1) / 2) * rowHeight;
  const parts = [];
  for (let i = 0; i < N; i++) {
    const start = Math.max(0, Math.min(0.98, S[i].start));
    const dur = Math.max(0.04, Math.min(1 - start, S[i].dur));
    const x0 = -trackLength / 2 + start * trackLength;
    const len = dur * trackLength;
    const y = topY - i * rowHeight;
    parts.push(box([len, barH, depth]).translate([x0 + len / 2, y, 0]));
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const gantt3dSpec = {
  type: 'gantt-3d',
  category: 'charts/data',
  args: {
    tasks: { type: 'number', default: 4, doc: 'Number of task rows (when segments omitted)' },
    segments: { type: 'array', default: null, doc: 'Per-task {start,dur} track fractions' },
    rowHeight: { type: 'number', default: 0.42, doc: 'Vertical stride per row' },
    barH: { type: 'number', default: 0.26, doc: 'Bar height' },
    depth: { type: 'number', default: 0.18, doc: 'Z depth' },
    trackLength: { type: 'number', default: 3.0, doc: 'Total track width (X)' },
  },
  examples: [
    { name: 'Gantt (4)', args: { tasks: 4 } },
    {
      name: 'Project plan',
      args: {
        segments: [
          { start: 0, dur: 0.4 },
          { start: 0.3, dur: 0.5 },
          { start: 0.6, dur: 0.4 },
        ],
      },
    },
    { name: 'Sprint board', args: { tasks: 6 } },
  ],
  description: 'Gantt chart — schedule, project plan, task timeline',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave B — taxonomy charts/data/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
