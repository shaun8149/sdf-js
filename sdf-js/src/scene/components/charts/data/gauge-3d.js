// =============================================================================
// gauge-3d.js — KPI gauge / speedometer dial (Atlas chart atom).
// -----------------------------------------------------------------------------
// A semicircular arc (top half of a ring) + a needle pointing to a 0..1 value +
// a hub. Covers PresentationLoad "Cockpit Charts" (dashboard gauges) and any
// KPI speedometer. Faces +Z (camera). Composite atom (torus + box + cylinder +
// union/difference).
// =============================================================================

import { torus, box, cylinder } from '../../../../sdf/d3.js';
import { union, difference } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.value=0.7]      needle position 0..1 (left→right)
 * @param {number} [opts.radius=0.9]     arc radius
 * @param {number} [opts.tube=0.1]       arc tube radius
 * @param {number} [opts.needleLen=0.8]  needle length
 * @param {number} [opts.needleWidth=0.07] needle width
 * @param {number} [opts.depth=0.2]      Z thickness of needle/hub
 * @returns {SDF3}
 */
export function gauge3dSDF({
  value = 0.7,
  radius = 0.9,
  tube = 0.1,
  needleLen = 0.8,
  needleWidth = 0.07,
  depth = 0.2,
} = {}) {
  const v = Math.max(0, Math.min(1, value));
  // Ring in the XY plane; keep only the top half (y ≥ 0) → semicircular arc.
  const ring = torus(radius, tube).rotate(Math.PI / 2, [1, 0, 0]);
  const lowerHalf = box([radius * 3, radius * 1.5, tube * 4]).translate([0, -radius * 1.5, 0]);
  const arc = difference(ring, lowerHalf);
  // Needle: a box centered at origin, rotated to the value angle (v=0 → π/left,
  // v=1 → 0/right), then shifted out so its inner end sits at the hub.
  const ang = Math.PI * (1 - v);
  const needle = box([needleLen, needleWidth, depth])
    .rotate(ang, [0, 0, 1])
    .translate([(Math.cos(ang) * needleLen) / 2, (Math.sin(ang) * needleLen) / 2, 0]);
  // Hub: short cylinder facing the camera (axis Z).
  const hub = cylinder(tube * 1.6, depth).rotate(Math.PI / 2, [1, 0, 0]);
  return union(arc, needle, hub);
}

export const gauge3dSpec = {
  type: 'gauge-3d',
  category: 'charts/data',
  args: {
    value: { type: 'number', default: 0.7, min: 0, max: 1, doc: 'Needle position 0..1' },
    radius: { type: 'number', default: 0.9, doc: 'Arc radius' },
    tube: { type: 'number', default: 0.1, doc: 'Arc tube radius' },
    needleLen: { type: 'number', default: 0.8, doc: 'Needle length' },
    needleWidth: { type: 'number', default: 0.07, doc: 'Needle width' },
    depth: { type: 'number', default: 0.2, doc: 'Z thickness of needle/hub' },
  },
  examples: [
    { name: 'KPI gauge 70%', args: { value: 0.7 } },
    { name: 'Low reading', args: { value: 0.2 } },
    { name: 'Full', args: { value: 1.0 } },
  ],
  description: 'KPI gauge / speedometer dial (arc + needle) — dashboards, cockpit charts, scores',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Charts coverage — taxonomy charts/data/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
