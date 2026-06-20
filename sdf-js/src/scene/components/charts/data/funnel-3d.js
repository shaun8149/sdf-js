// =============================================================================
// funnel-3d.js — funnel chart (Atlas chart atom).
// -----------------------------------------------------------------------------
// N stacked truncated-cone stages tapering top→bottom — a sales/conversion
// funnel. Covers PresentationLoad "Funnel". Composite atom (capped_cone +
// union).
// =============================================================================

import { capped_cone } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.stages=4]       number of funnel stages (≥1)
 * @param {number} [opts.topRadius=0.95] radius at the top
 * @param {number} [opts.bottomRadius=0.22] radius at the bottom
 * @param {number} [opts.stageHeight=0.4] height of each stage
 * @param {number} [opts.gap=0.06]       gap between stages
 * @returns {SDF3}
 */
export function funnel3dSDF({
  stages = 4,
  topRadius = 0.95,
  bottomRadius = 0.22,
  stageHeight = 0.4,
  gap = 0.06,
} = {}) {
  const N = Math.max(1, Math.floor(stages));
  const totalH = N * stageHeight + (N - 1) * gap;
  const radAt = (frac) => topRadius + frac * (bottomRadius - topRadius);
  const parts = [];
  for (let i = 0; i < N; i++) {
    const rT = radAt(i / N);
    const rB = radAt((i + 1) / N);
    const yTop = totalH / 2 - i * (stageHeight + gap);
    const yBot = yTop - stageHeight;
    parts.push(capped_cone([0, yTop, 0], [0, yBot, 0], rT, rB));
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const funnel3dSpec = {
  type: 'funnel-3d',
  category: 'charts/data',
  args: {
    stages: { type: 'number', default: 4, doc: 'Number of stages (≥1)' },
    topRadius: { type: 'number', default: 0.95, doc: 'Radius at the top' },
    bottomRadius: { type: 'number', default: 0.22, doc: 'Radius at the bottom' },
    stageHeight: { type: 'number', default: 0.4, doc: 'Height of each stage' },
    gap: { type: 'number', default: 0.06, doc: 'Gap between stages' },
  },
  examples: [
    { name: 'Sales funnel (4)', args: { stages: 4 } },
    { name: 'Conversion (5)', args: { stages: 5 } },
    { name: 'Steep funnel', args: { stages: 3, bottomRadius: 0.1 } },
  ],
  description: 'Funnel chart — sales / conversion / pipeline stages',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave B — taxonomy charts/data/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
