// =============================================================================
// kpi-card-3d — Rounded card with KPI semantic metadata (Atlas chart atom 6/9)
// -----------------------------------------------------------------------------
// Sixth Atlas chart atom under taxonomy charts/data/. Geometry is just an
// IQ rounded box (extruded card shape). The interesting work is in the
// SEMANTIC metadata stored in AST (value/label/unit/trend/trendValue) for
// downstream material/typography rendering — actual number + label + trend
// arrow drawn on top via material layer in Sprint 2+.
//
// Pattern parallel to pie-3d: SDF is plain geometry, semantic info is AST-
// only. Visual differentiation comes from material layer, not from SDF.
//
// Use cases:
//   - KPI dashboard tiles (Q3 Revenue, MAU, NPS, etc.)
//   - Single-number callouts in pitch decks ("$42M ARR ↑12%")
//   - Status indicators in operational dashboards
//   - Grid of metric cards (compose 4-6 via grid-layout atom, future)
//
// GLSL: emits sdRoundedBox directly (no new helper). The semantic args
// are stored in JS-side AST only.
//
// Author: Atlas (2026-06-18)
// License: PolyForm Noncommercial 1.0.0
// =============================================================================

import { SDF3 } from '../../../../sdf/core.js';

/**
 * IQ rounded-box SDF: like sdBox but with rounded corners of radius r.
 * @param {number[3]} p   point
 * @param {number} hx     half-extent X
 * @param {number} hy     half-extent Y
 * @param {number} hz     half-extent Z
 * @param {number} r      corner radius
 */
function sdRoundedBoxLocal(p, hx, hy, hz, r) {
  const qx = Math.abs(p[0]) - hx + r;
  const qy = Math.abs(p[1]) - hy + r;
  const qz = Math.abs(p[2]) - hz + r;
  const dx = Math.max(qx, 0);
  const dy = Math.max(qy, 0);
  const dz = Math.max(qz, 0);
  const outside = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const inside = Math.min(Math.max(qx, qy, qz), 0);
  return outside + inside - r;
}

/**
 * KPI card SDF — rounded box with semantic metadata in AST.
 *
 * @param {object} opts
 * @param {number} [opts.width=1.6]          Card X width
 * @param {number} [opts.height=1.0]         Card Y height
 * @param {number} [opts.depth=0.15]         Card Z depth (extrusion)
 * @param {number} [opts.cornerRadius=0.08]  Corner radius (clamped to half of smallest dim)
 * @param {number} [opts.value=0]            KPI value (semantic, AST-only)
 * @param {string} [opts.label='']           KPI label (semantic, AST-only)
 * @param {string} [opts.unit='']            Unit suffix ('M', '%', '$', semantic, AST-only)
 * @param {string} [opts.trend='flat']       'up' | 'down' | 'flat' | 'none' (semantic, AST-only)
 * @param {number} [opts.trendValue=0]       Change % (semantic, AST-only)
 */
export function kpiCard3dSDF({
  width = 1.6,
  height = 1.0,
  depth = 0.15,
  cornerRadius = 0.08,
  value = 0,
  label = '',
  unit = '',
  trend = 'flat',
  trendValue = 0,
} = {}) {
  const hx = Math.max(0, width / 2);
  const hy = Math.max(0, height / 2);
  const hz = Math.max(0, depth / 2);
  // Clamp corner radius to half of the smallest dimension (else SDF goes negative inside-out)
  const r = Math.max(0, Math.min(cornerRadius, Math.min(hx, hy, hz)));

  const inst = SDF3((p) => sdRoundedBoxLocal(p, hx, hy, hz, r));

  // AST: emits as rounded_box (sdRoundedBox GLSL). Semantic fields are
  // stored in a side channel so AST.args matches the rounded_box PRIMS
  // signature (size, radius), but we tag the atom name as 'kpi-card-3d'
  // so downstream tools can identify the semantic intent.
  inst.ast = {
    kind: 'prim',
    name: 'kpi-card-3d',
    args: [width, height, depth, r, value, label, unit, trend, trendValue],
  };
  return inst;
}

export const kpiCard3dSpec = {
  type: 'kpi-card-3d',
  category: 'charts/data',
  args: {
    width: { type: 'number', default: 1.6, doc: 'Card X width' },
    height: { type: 'number', default: 1.0, doc: 'Card Y height' },
    depth: { type: 'number', default: 0.15, doc: 'Card Z depth (extrusion)' },
    cornerRadius: {
      type: 'number',
      default: 0.08,
      doc: 'Corner radius (clamped to half of smallest dim)',
    },
    value: { type: 'number', default: 0, doc: 'KPI value (semantic, for material layer)' },
    label: { type: 'string', default: '', doc: 'KPI label text' },
    unit: { type: 'string', default: '', doc: 'Unit suffix (M / % / $ / etc.)' },
    trend: {
      type: 'string',
      default: 'flat',
      doc: "Trend direction: 'up' | 'down' | 'flat' | 'none'",
    },
    trendValue: { type: 'number', default: 0, doc: 'Trend change % (for material layer)' },
  },
  examples: [
    {
      name: 'Q3 revenue card',
      args: {
        width: 1.8,
        height: 1.0,
        value: 42,
        unit: 'M',
        label: 'Q3 Revenue',
        trend: 'up',
        trendValue: 12,
      },
    },
    { name: 'Wide dashboard tile', args: { width: 2.4, height: 0.9, cornerRadius: 0.12 } },
    {
      name: 'Tall stacked KPI',
      args: { width: 0.9, height: 1.6, cornerRadius: 0.06 },
    },
    {
      name: 'Modern rounded UI',
      args: { width: 1.6, height: 1.0, cornerRadius: 0.25 },
    },
    {
      name: 'Sharp corporate',
      args: { width: 1.6, height: 1.0, cornerRadius: 0.02 },
    },
    {
      name: 'Thick standalone',
      args: { width: 1.6, height: 1.0, depth: 0.5, cornerRadius: 0.12 },
    },
  ],
  description:
    'Rounded KPI card for dashboard tiles, with semantic metadata for downstream material layer',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-18',
    builder: 'Sprint 1 atom #6 — rounded box geometry + KPI semantic metadata',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
