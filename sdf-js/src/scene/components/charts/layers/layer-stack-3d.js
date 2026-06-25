// =============================================================================
// layer-stack-3d.js — stacked strata / layers (Atlas chart atom).
// -----------------------------------------------------------------------------
// N wide flat slabs stacked in Y with gaps — OSI layers, tech stack, geological
// strata. Covers PresentationLoad "Layers". Distinct from cube-segmented-3d
// (one cube sliced) — these are independent wide layers. Composite (box +
// union).
// =============================================================================

import { box } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';
import { resolveMaterial } from '../../../spec.js';

/**
 * @param {object} opts
 * @param {number} [opts.layers=4]   number of layers (≥1)
 * @param {number} [opts.layerW=1.8] layer width (X)
 * @param {number} [opts.layerD=1.2] layer depth (Z)
 * @param {number} [opts.layerH=0.22] layer thickness (Y)
 * @param {number} [opts.gap=0.12]   gap between layers
 * @param {number} [opts.taper=1.0]  width × per layer going up (1=uniform)
 * @returns {SDF3}
 */
export function layerStack3dSDF({
  layers = 4,
  layerW = 1.8,
  layerD = 1.2,
  layerH = 0.22,
  gap = 0.12,
  taper = 1.0,
  colors = null,
} = {}) {
  const N = Math.max(1, Math.floor(layers));
  const stride = layerH + gap;
  const totalH = N * layerH + (N - 1) * gap;
  const parts = [];
  for (let i = 0; i < N; i++) {
    const y = i * stride - totalH / 2 + layerH / 2;
    const w = layerW * Math.pow(taper, i);
    const d = layerD * Math.pow(taper, i);
    const slab = box([w, layerH, d]).translate([0, y, 0]);
    if (colors && colors[i] != null) {
      const m = resolveMaterial(colors[i]);
      if (m) slab._subjectMaterial = m;
    }
    parts.push(slab);
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const layerStack3dSpec = {
  type: 'layer-stack-3d',
  category: 'charts/layers',
  args: {
    layers: { type: 'number', default: 4, doc: 'Number of layers (≥1)' },
    layerW: { type: 'number', default: 1.8, doc: 'Layer width (X)' },
    layerD: { type: 'number', default: 1.2, doc: 'Layer depth (Z)' },
    layerH: { type: 'number', default: 0.22, doc: 'Layer thickness (Y)' },
    gap: { type: 'number', default: 0.12, doc: 'Gap between layers' },
    taper: { type: 'number', default: 1.0, doc: 'Width × per layer upward' },
  },
  examples: [
    { name: 'Tech stack (4)', args: { layers: 4 } },
    { name: 'OSI model (7)', args: { layers: 7, layerH: 0.18 } },
    { name: 'Tapered strata', args: { layers: 5, taper: 0.82 } },
  ],
  description: 'Stacked layers / strata — tech stack, OSI, geology, hierarchy of layers',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave A — taxonomy charts/layers/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
