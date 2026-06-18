// =============================================================================
// column-3d — Horizontal bar chart (Atlas chart atom, Sprint 1 atom 3/9)
// -----------------------------------------------------------------------------
// Third Atlas-built chart atom. **Implementation shares evalBarsSDF with bar-3d
// via axis swap** — column-3d is bar-3d rotated 90° so bars grow horizontally
// (along +X) with items stacked vertically (along world Y, top to bottom).
//
// Use cases:
//   - Ranking / leaderboard slides (top 10 sales reps, regions)
//   - Survey breakdowns (percentage agree / neutral / disagree)
//   - Time-to-completion comparisons (project A vs B vs C)
//   - Long-label categories (horizontal bars give text room)
//
// In presentation taxonomy (PresentationLoad inherits), "Bar Charts" and
// "Column Charts" are distinct categories — vertical (bar-3d) and horizontal
// (column-3d) are conceptually different even though geometry is just swap.
//
// Axis convention (column-3d, world frame):
//   - bars stacked along world Y axis (FIRST item at TOP, last at bottom)
//   - bars grow along +X (rightward, length = value * maxHeight)
//   - depth along Z
//
// Param semantics are kept identical to bar-3d for symmetry (LLM can call
// either with same shape). barWidth = bar thickness (Y), maxHeight = max
// horizontal extent. See docstring for clarification.
//
// Author: Atlas (2026-06-18)
// License: PolyForm Noncommercial 1.0.0
// =============================================================================

import { SDF3 } from '../../../../sdf/core.js';
import { evalBarsSDF, resolveBarParams } from './bar-3d.js';

/**
 * Horizontal bar chart SDF (column chart).
 *
 * @param {object} opts
 * @param {number[]} [opts.values=[0.3,0.5,0.7,0.4,0.8]]  Normalized bar lengths (0-1)
 * @param {number}   [opts.count]                          Explicit count (max 32)
 * @param {number}   [opts.barWidth=0.4]                   Y thickness per bar (top-to-bottom)
 * @param {number}   [opts.barDepth=0.4]                   Z depth per bar
 * @param {number}   [opts.gap=0.1]                        Y gap between stacked bars
 * @param {number}   [opts.maxHeight=2.0]                  X length for value=1
 */
export function column3dSDF({
  values = [0.3, 0.5, 0.7, 0.4, 0.8],
  count = null,
  barWidth = 0.4,
  barDepth = 0.4,
  gap = 0.1,
  maxHeight = 2.0,
} = {}) {
  const { N, vals, paddedValues } = resolveBarParams(values, count);

  // Axis swap: world (X, Y, Z) → bar-3d input (-Y, X, Z)
  //   - World +Y (chart top)    → bar-3d input -X (item 0, leftmost in canonical)
  //   - World +X (right, where bars extend) → bar-3d input +Y (bar growth direction)
  //   - Result: first item at top, bars grow rightward
  const inst = SDF3((p) => {
    const swappedP = [-p[1], p[0], p[2]];
    return evalBarsSDF(swappedP, N, vals, barWidth, barDepth, gap, maxHeight);
  });

  inst.ast = {
    kind: 'prim',
    name: 'column-3d',
    args: [paddedValues, N, barWidth, barDepth, gap, maxHeight],
  };
  return inst;
}

export const column3dSpec = {
  type: 'column-3d',
  category: 'charts/data',
  args: {
    values: {
      type: 'number[]',
      default: [0.3, 0.5, 0.7, 0.4, 0.8],
      doc: 'Normalized bar lengths (0-1). Max 32.',
    },
    count: { type: 'number', default: null, doc: 'Explicit count override (pads/truncates)' },
    barWidth: { type: 'number', default: 0.4, doc: 'Y thickness per bar (top-to-bottom span)' },
    barDepth: { type: 'number', default: 0.4, doc: 'Z depth per bar' },
    gap: { type: 'number', default: 0.1, doc: 'Y gap between stacked bars' },
    maxHeight: {
      type: 'number',
      default: 2.0,
      doc: 'X length for value=1 (named for parity with bar-3d)',
    },
  },
  examples: [
    { name: 'Top 5 regions', args: { values: [0.95, 0.8, 0.6, 0.55, 0.3] } },
    { name: '3-row survey breakdown', args: { values: [0.65, 0.25, 0.1], barWidth: 0.6 } },
    {
      name: 'Project timeline (8 phases)',
      args: { values: [0.3, 0.6, 1.0, 0.8, 0.5, 0.9, 0.4, 0.7], barWidth: 0.25, gap: 0.05 },
    },
    { name: 'Single value (KPI row)', args: { values: [0.85], barWidth: 0.8 } },
  ],
  description: 'Horizontal bar chart for rankings, breakdowns, long-label data',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-18',
    builder: 'Sprint 1 atom #3 — reuses evalBarsSDF from bar-3d via axis swap',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
