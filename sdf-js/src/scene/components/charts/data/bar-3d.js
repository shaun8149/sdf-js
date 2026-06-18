// =============================================================================
// bar-3d — Data-driven horizontal bar chart (Atlas chart atom, P0)
// -----------------------------------------------------------------------------
// Second Atlas-built chart atom under taxonomy charts/data/. N bars arranged
// along X axis, each bar's height driven by a normalized value (0-1) scaled
// by maxHeight. Bars sit ON ground (bottom at y=0, top at y=value*maxHeight),
// X-centered around origin.
//
// Use cases:
//   - KPI dashboards (quarterly revenue, regional performance, etc.)
//   - Financial slides (P&L breakdown, segment comparison)
//   - Time-series snapshots (monthly active users, weekly conversions)
//
// Data binding: `values` is a normalized array. Pass raw data already
// normalized to [0, 1], then use maxHeight to control absolute scale.
// Diffusion baseline famously fails: cannot reliably render N bars at
// the correct relative heights when N > 4. Atlas gets each bar exact.
//
// GLSL constraint: max 32 bars (GLSL float[32] array literal). Values past
// index 31 are dropped on the JS side (clamped + warned in dev console
// via the sanity layer if implemented later).
//
// Author: Atlas (2026-06-18)
// License: PolyForm Noncommercial 1.0.0
// =============================================================================

import { SDF3 } from '../../../../sdf/core.js';

const MAX_BARS = 32;

/**
 * Data-driven bar chart SDF.
 *
 * @param {object} opts
 * @param {number[]} [opts.values=[0.3,0.7,1.0,0.5,0.8]]  Normalized bar heights (0-1)
 * @param {number}   [opts.count]                          Explicit bar count (overrides values.length, pads/truncates)
 * @param {number}   [opts.barWidth=0.4]                   X width per bar
 * @param {number}   [opts.barDepth=0.4]                   Z depth per bar
 * @param {number}   [opts.gap=0.1]                        X gap between bars
 * @param {number}   [opts.maxHeight=2.0]                  Y height for value=1
 */
export function bar3dSDF({
  values = [0.3, 0.7, 1.0, 0.5, 0.8],
  count = null,
  barWidth = 0.4,
  barDepth = 0.4,
  gap = 0.1,
  maxHeight = 2.0,
} = {}) {
  // Resolve final count + values list (clamped to MAX_BARS for GLSL compat)
  const N = Math.max(0, Math.min(MAX_BARS, Math.floor(count ?? values.length)));
  const vals = [];
  for (let i = 0; i < N; i++) {
    const v = values[i];
    vals.push(Number.isFinite(v) ? Math.max(0, v) : 0);
  }

  const totalX = N > 0 ? N * barWidth + (N - 1) * gap : 0;
  const xStart = -totalX / 2 + barWidth / 2;

  const inst = SDF3((p) => {
    if (N === 0) return 1e6; // degenerate: nothing
    let minDist = Infinity;
    for (let i = 0; i < N; i++) {
      const h = vals[i] * maxHeight;
      if (h <= 0) continue; // skip zero-height bars (no surface)
      const xc = xStart + i * (barWidth + gap);
      const yc = h / 2;
      // sdBox(p - [xc, yc, 0], [barWidth/2, h/2, barDepth/2])
      const qx = Math.abs(p[0] - xc) - barWidth / 2;
      const qy = Math.abs(p[1] - yc) - h / 2;
      const qz = Math.abs(p[2]) - barDepth / 2;
      const dx = Math.max(qx, 0);
      const dy = Math.max(qy, 0);
      const dz = Math.max(qz, 0);
      const outside = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const inside = Math.min(Math.max(qx, qy, qz), 0);
      const d = outside + inside;
      if (d < minDist) minDist = d;
    }
    return minDist === Infinity ? 1e6 : minDist;
  });

  // GLSL emit needs fixed-length array. Pad to MAX_BARS with zeros.
  const paddedValues = vals.slice();
  while (paddedValues.length < MAX_BARS) paddedValues.push(0);

  inst.ast = {
    kind: 'prim',
    name: 'bar-3d',
    args: [paddedValues, N, barWidth, barDepth, gap, maxHeight],
  };
  return inst;
}

export const bar3dSpec = {
  type: 'bar-3d',
  category: 'charts/data',
  args: {
    values: {
      type: 'number[]',
      default: [0.3, 0.7, 1.0, 0.5, 0.8],
      doc: 'Normalized bar heights (0-1). Max 32 bars.',
    },
    count: {
      type: 'number',
      default: null,
      doc: 'Explicit bar count override (pads/truncates values). Max 32.',
    },
    barWidth: { type: 'number', default: 0.4, doc: 'X width per bar' },
    barDepth: { type: 'number', default: 0.4, doc: 'Z depth per bar' },
    gap: { type: 'number', default: 0.1, doc: 'X gap between bars' },
    maxHeight: { type: 'number', default: 2.0, doc: 'Y height for value=1' },
  },
  examples: [
    { name: 'Quarterly revenue (5 bars)', args: { values: [0.3, 0.5, 0.7, 0.6, 0.9] } },
    {
      name: '12 monthly users',
      args: {
        values: [0.2, 0.25, 0.3, 0.4, 0.5, 0.55, 0.65, 0.7, 0.75, 0.85, 0.9, 1.0],
        barWidth: 0.25,
        gap: 0.05,
      },
    },
    {
      name: 'Regional comparison (4 bars)',
      args: { values: [0.6, 0.9, 0.4, 0.7], barWidth: 0.6, gap: 0.15 },
    },
    { name: 'Single bar (KPI single value)', args: { values: [0.85] } },
  ],
  description: 'Data-driven 3D bar chart for KPI dashboards, financial slides, time-series',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-18',
    builder: 'Sprint 1 atom #2 — taxonomy charts/data/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
