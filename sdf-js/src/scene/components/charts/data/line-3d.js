// =============================================================================
// line-3d — Polyline + point markers chart (Atlas chart atom, Sprint 1 atom 4/9)
// -----------------------------------------------------------------------------
// Fourth Atlas chart atom. N points connected by N-1 line segments (capsules),
// each point optionally marked with a sphere. Uses γ scheme: shares
// resolveBarParams from bar-3d for count clamping + value normalization,
// implements its own geometry (point + capsule, not box).
//
// Use cases:
//   - Time-series trends (revenue over months, user growth, latency over time)
//   - Trajectory visualization (path through 2D-projected state space)
//   - Multi-comparison (set closed=true for radar-like closed shapes)
//
// Axis convention:
//   - Points distributed along X axis, centered around origin
//   - Y = value * maxHeight (point height)
//   - Z = 0 (flat in XY plane)
//
// Diffusion baseline: cannot reliably render line charts with correct number
// of data points + exact relative heights. Will randomly add/drop points,
// distort axis spacing. Atlas gets each point's (x, y) exact.
//
// Author: Atlas (2026-06-18)
// License: PolyForm Noncommercial 1.0.0
// =============================================================================

import { SDF3 } from '../../../../sdf/core.js';
import { resolveBarParams } from './bar-3d.js';

/**
 * Pure-math sphere distance: ‖p - center‖ - r.
 */
function sdSphereAt(p, cx, cy, cz, r) {
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  const dz = p[2] - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

/**
 * Pure-math capsule (line segment with rounded ends, IQ canonical).
 * Segment from a=(ax,ay,az) to b=(bx,by,bz), radius r.
 */
function sdCapsuleSegment(p, ax, ay, az, bx, by, bz, r) {
  const pax = p[0] - ax,
    pay = p[1] - ay,
    paz = p[2] - az;
  const bax = bx - ax,
    bay = by - ay,
    baz = bz - az;
  const dotPaBa = pax * bax + pay * bay + paz * baz;
  const dotBaBa = bax * bax + bay * bay + baz * baz;
  const h = dotBaBa > 0 ? Math.max(0, Math.min(1, dotPaBa / dotBaBa)) : 0;
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  const dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

/**
 * Shared distance evaluator: N points at (x_i, value_i*maxH, 0), connected
 * by N-1 capsule segments. Optional closed loop (last → first).
 */
function evalLineSDF(p, N, vals, pointSpacing, pointRadius, lineThickness, maxHeight, closed) {
  if (N === 0) return 1e6;
  const totalX = (N - 1) * pointSpacing;
  const xStart = -totalX / 2;
  let minDist = Infinity;

  // Pre-compute Y values
  const ys = vals.map((v) => v * maxHeight);

  // Point markers
  if (pointRadius > 0) {
    for (let i = 0; i < N; i++) {
      const xc = xStart + i * pointSpacing;
      const d = sdSphereAt(p, xc, ys[i], 0, pointRadius);
      if (d < minDist) minDist = d;
    }
  }

  // Line segments
  if (lineThickness > 0 && N > 1) {
    for (let i = 0; i < N - 1; i++) {
      const xa = xStart + i * pointSpacing;
      const xb = xStart + (i + 1) * pointSpacing;
      const d = sdCapsuleSegment(p, xa, ys[i], 0, xb, ys[i + 1], 0, lineThickness);
      if (d < minDist) minDist = d;
    }
    if (closed && N > 2) {
      const xLast = xStart + (N - 1) * pointSpacing;
      const xFirst = xStart;
      const d = sdCapsuleSegment(p, xLast, ys[N - 1], 0, xFirst, ys[0], 0, lineThickness);
      if (d < minDist) minDist = d;
    }
  }

  return minDist === Infinity ? 1e6 : minDist;
}

/**
 * Line chart SDF (polyline + optional point markers).
 *
 * @param {object} opts
 * @param {number[]} [opts.values=[0.3,0.5,0.7,0.4,0.8,0.9]]  Normalized Y heights (0-1)
 * @param {number}   [opts.count]                              Explicit count (max 32)
 * @param {number}   [opts.pointSpacing=0.5]                   X distance between points
 * @param {number}   [opts.pointRadius=0.08]                   Sphere marker radius (0 = no markers)
 * @param {number}   [opts.lineThickness=0.04]                 Capsule line radius (0 = no line)
 * @param {number}   [opts.maxHeight=2.0]                      Y for value=1
 * @param {boolean}  [opts.closed=false]                       Connect last point back to first
 */
export function line3dSDF({
  values = [0.3, 0.5, 0.7, 0.4, 0.8, 0.9],
  count = null,
  pointSpacing = 0.5,
  pointRadius = 0.08,
  lineThickness = 0.04,
  maxHeight = 2.0,
  closed = false,
} = {}) {
  const { N, vals, paddedValues } = resolveBarParams(values, count);
  const closedFlag = closed ? 1 : 0;

  const inst = SDF3((p) =>
    evalLineSDF(p, N, vals, pointSpacing, pointRadius, lineThickness, maxHeight, !!closedFlag),
  );

  inst.ast = {
    kind: 'prim',
    name: 'line-3d',
    args: [paddedValues, N, pointSpacing, pointRadius, lineThickness, maxHeight, closedFlag],
  };
  return inst;
}

export const line3dSpec = {
  type: 'line-3d',
  category: 'charts/data',
  args: {
    values: {
      type: 'number[]',
      default: [0.3, 0.5, 0.7, 0.4, 0.8, 0.9],
      doc: 'Normalized point heights (0-1). Max 32 points.',
    },
    count: { type: 'number', default: null, doc: 'Explicit count override' },
    pointSpacing: { type: 'number', default: 0.5, doc: 'X distance between adjacent points' },
    pointRadius: { type: 'number', default: 0.08, doc: 'Sphere marker radius (0 = hide markers)' },
    lineThickness: {
      type: 'number',
      default: 0.04,
      doc: 'Capsule connector radius (0 = hide line)',
    },
    maxHeight: { type: 'number', default: 2.0, doc: 'Y for value=1' },
    closed: {
      type: 'boolean',
      default: false,
      doc: 'Connect last point back to first (radar / closed loop)',
    },
  },
  examples: [
    {
      name: 'Default 6-point upward trend',
      args: { values: [0.3, 0.5, 0.7, 0.4, 0.8, 0.9] },
    },
    {
      name: '12-month time-series',
      args: {
        values: [0.2, 0.3, 0.35, 0.5, 0.55, 0.6, 0.7, 0.85, 0.8, 0.9, 0.95, 1.0],
        pointSpacing: 0.25,
        pointRadius: 0.05,
      },
    },
    {
      name: 'Markers-only (scatter look)',
      args: { values: [0.2, 0.7, 0.4, 0.9, 0.5], lineThickness: 0, pointRadius: 0.12 },
    },
    {
      name: 'Line-only (no markers)',
      args: { values: [0.1, 0.3, 0.6, 0.4, 0.8, 0.5, 0.9], pointRadius: 0 },
    },
    {
      name: 'Closed pentagon (radar)',
      args: {
        values: [0.7, 0.85, 0.6, 0.8, 0.65],
        closed: true,
        pointRadius: 0.1,
        lineThickness: 0.05,
      },
    },
  ],
  description: 'Line chart (polyline + point markers) for time-series, trends, radar plots',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-18',
    builder: 'Sprint 1 atom #4 — reuses resolveBarParams from bar-3d (γ scheme)',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
