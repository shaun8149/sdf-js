// =============================================================================
// pie-3d — Pie / donut chart (Atlas chart atom, Sprint 1 atom 5/9)
// -----------------------------------------------------------------------------
// Fifth Atlas chart atom under taxonomy charts/data/. SDF is a disc (or donut
// if innerRadius > 0) extruded along Z. **Slice values are stored in AST for
// downstream material/label rendering — the SDF itself is just the disc**.
//
// Why disc SDF (not per-slice MIN): a UNION of N IQ-canonical pie-slice SDFs
// is NOT a valid SDF of the disc — at any shared slice boundary (radial
// edges, axes meeting at origin), per-slice SDFs are all 0 (each slice
// considers that point "on my boundary"), but the union's correct SDF should
// be the radial distance to the outer circle. MIN gives 0, which corrupts
// raymarch. Strict-SDF approach: disc geometry + slice values stored.
// Visual slice differentiation belongs in the material/renderer layer (color
// by atan2(p.y,p.x) → slice index → palette lookup, future sprint).
//
// Use cases:
//   - Market share breakdown (5 vendor slices, colored by material)
//   - Budget allocation (8 expense categories)
//   - Portfolio composition (donut with innerR > 0)
//   - Survey response distribution
//
// Author: Atlas (2026-06-18)
// License: PolyForm Noncommercial 1.0.0
// =============================================================================

import { SDF3 } from '../../../../sdf/core.js';

const MAX_SLICES = 32;

/**
 * Resolve pie params: clamp count, normalize values to sum=1, pad for GLSL
 * (AST array used by future material layer for slice color lookup).
 */
function resolvePieParams(values, count) {
  const N = Math.max(0, Math.min(MAX_SLICES, Math.floor(count ?? values.length)));
  const rawVals = [];
  for (let i = 0; i < N; i++) {
    const v = values[i];
    rawVals.push(Number.isFinite(v) && v > 0 ? v : 0);
  }
  const sum = rawVals.reduce((a, b) => a + b, 0);
  // Normalize to sum=1. If all zeros, distribute equally so the pie still renders.
  const normVals = sum > 0 ? rawVals.map((v) => v / sum) : rawVals.map(() => (N > 0 ? 1 / N : 0));
  const paddedValues = normVals.slice();
  while (paddedValues.length < MAX_SLICES) paddedValues.push(0);
  return { N, normVals, paddedValues };
}

/**
 * SDF of disc (or donut) extruded along Z. Slice values stored in AST but
 * don't affect geometry — see file header for why.
 */
function evalPieSDF(p, N, outerRadius, innerRadius, thickness) {
  if (N === 0) return 1e6; // empty pie = no surface
  const lenXY = Math.sqrt(p[0] * p[0] + p[1] * p[1]);
  // 2D radial SDF: signed distance to outer circle, optionally subtract inner
  let radial = lenXY - outerRadius;
  if (innerRadius > 0) {
    radial = Math.max(radial, -(lenXY - innerRadius));
  }
  // IQ 2D-to-3D extrusion along Z
  const wx = radial;
  const wy = Math.abs(p[2]) - thickness / 2;
  const insideTerm = Math.min(Math.max(wx, wy), 0);
  const wxMax = Math.max(wx, 0);
  const wyMax = Math.max(wy, 0);
  const outsideTerm = Math.sqrt(wxMax * wxMax + wyMax * wyMax);
  return insideTerm + outsideTerm;
}

/**
 * Pie / donut chart SDF.
 *
 * @param {object} opts
 * @param {number[]} [opts.values=[0.3,0.2,0.15,0.2,0.15]]   Raw values (auto-normalized to sum=1)
 * @param {number}   [opts.count]                              Explicit count override (max 32)
 * @param {number}   [opts.outerRadius=1.0]                    Outer radius
 * @param {number}   [opts.innerRadius=0]                      Inner radius (>0 = donut)
 * @param {number}   [opts.thickness=0.3]                      Z thickness
 * @param {number}   [opts.startAngle=Math.PI/2]               Start angle in radians (default 12 o'clock)
 * @param {boolean}  [opts.clockwise=true]                     Slice direction (true = standard pie convention)
 */
export function pie3dSDF({
  values = [0.3, 0.2, 0.15, 0.2, 0.15],
  count = null,
  outerRadius = 1.0,
  innerRadius = 0,
  thickness = 0.3,
  startAngle = Math.PI / 2,
  clockwise = true,
} = {}) {
  const { N, paddedValues } = resolvePieParams(values, count);
  const clockwiseFlag = clockwise ? 1 : 0;

  const inst = SDF3((p) => evalPieSDF(p, N, outerRadius, innerRadius, thickness));

  // AST stores values + startAngle + clockwise for future material/slice-color
  // rendering. SDF geometry only uses outerR/innerR/thickness.
  inst.ast = {
    kind: 'prim',
    name: 'pie-3d',
    args: [paddedValues, N, outerRadius, innerRadius, thickness, startAngle, clockwiseFlag],
  };
  return inst;
}

export const pie3dSpec = {
  type: 'pie-3d',
  category: 'charts/data',
  args: {
    values: {
      type: 'number[]',
      default: [0.3, 0.2, 0.15, 0.2, 0.15],
      doc: 'Raw values (auto-normalized to sum=1). Max 32 slices.',
    },
    count: { type: 'number', default: null, doc: 'Explicit count override' },
    outerRadius: { type: 'number', default: 1.0, doc: 'Outer radius' },
    innerRadius: { type: 'number', default: 0, doc: 'Inner radius (>0 = donut)' },
    thickness: { type: 'number', default: 0.3, doc: 'Z thickness (extrusion depth)' },
    startAngle: {
      type: 'number',
      default: Math.PI / 2,
      doc: "Start angle in radians (default π/2 = 12 o'clock)",
    },
    clockwise: {
      type: 'boolean',
      default: true,
      doc: 'Clockwise slice direction (standard pie convention)',
    },
  },
  examples: [
    { name: 'Market share (5 slices)', args: { values: [40, 25, 15, 12, 8] } },
    {
      name: 'Donut: budget allocation',
      args: { values: [30, 25, 20, 15, 10], innerRadius: 0.5 },
    },
    {
      name: 'Three big slices',
      args: { values: [50, 30, 20] },
    },
    { name: 'Even 8-way split', args: { values: [1, 1, 1, 1, 1, 1, 1, 1] } },
    { name: 'Thin donut ring', args: { values: [25, 25, 25, 25], innerRadius: 0.85 } },
  ],
  description: 'Pie / donut chart for share / breakdown / composition data',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-18',
    builder: 'Sprint 1 atom #5 — IQ canonical pie SDF + extrusion + donut',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
