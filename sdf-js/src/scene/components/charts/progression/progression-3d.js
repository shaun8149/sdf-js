// =============================================================================
// progression-3d.js — ascending staircase (Atlas chart atom).
// -----------------------------------------------------------------------------
// N steps of increasing height standing on the ground, a left-to-right growth /
// progression. Covers PresentationLoad "Progression" (the taxonomy's flagged
// archetype). Composite atom (box + union).
// =============================================================================

import { box } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.steps=5]      number of steps (≥1)
 * @param {number} [opts.run=0.5]      width of each step (X)
 * @param {number} [opts.stepRise=0.3] height added per step (Y)
 * @param {number} [opts.depth=0.5]    Z depth
 * @returns {SDF3}
 */
export function progression3dSDF({ steps = 5, run = 0.5, stepRise = 0.3, depth = 0.5 } = {}) {
  const N = Math.max(1, Math.floor(steps));
  const totalW = N * run;
  const parts = [];
  for (let i = 0; i < N; i++) {
    const h = (i + 1) * stepRise; // grows from ground up
    const x = i * run - totalW / 2 + run / 2;
    parts.push(box([run, h, depth]).translate([x, h / 2, 0]));
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const progression3dSpec = {
  type: 'progression-3d',
  category: 'charts/progression',
  args: {
    steps: { type: 'number', default: 5, doc: 'Number of steps (≥1)' },
    run: { type: 'number', default: 0.5, doc: 'Width of each step (X)' },
    stepRise: { type: 'number', default: 0.3, doc: 'Height added per step (Y)' },
    depth: { type: 'number', default: 0.5, doc: 'Z depth' },
  },
  examples: [
    { name: 'Growth steps (5)', args: { steps: 5 } },
    { name: 'Roadmap (4)', args: { steps: 4, stepRise: 0.4 } },
    { name: 'Maturity (7)', args: { steps: 7, run: 0.4 } },
  ],
  description: 'Ascending staircase — growth, progression, maturity stages, roadmap',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave A — taxonomy charts/progression/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
