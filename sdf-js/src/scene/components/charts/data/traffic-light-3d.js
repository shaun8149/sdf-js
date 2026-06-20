// =============================================================================
// traffic-light-3d.js — status / RAG indicator (Atlas chart atom).
// -----------------------------------------------------------------------------
// A housing box with N stacked light spheres protruding from the front face —
// the red/amber/green status signal (RAG). Covers PresentationLoad status /
// "Traffic Light" indicators. Composite atom (box + sphere + union).
// =============================================================================

import { box, sphere } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.lights=3]      number of lights (≥1)
 * @param {number} [opts.lightRadius=0.22] light sphere radius
 * @param {number} [opts.spacing=0.55]  vertical spacing between lights
 * @param {number} [opts.housingPad=0.12] padding around the lights
 * @param {number} [opts.depth=0.3]     housing depth (Z)
 * @returns {SDF3}
 */
export function trafficLight3dSDF({
  lights = 3,
  lightRadius = 0.22,
  spacing = 0.55,
  housingPad = 0.12,
  depth = 0.3,
} = {}) {
  const N = Math.max(1, Math.floor(lights));
  const totalH = (N - 1) * spacing;
  const housingH = totalH + 2 * lightRadius + 2 * housingPad;
  const housingW = 2 * lightRadius + 2 * housingPad;
  const parts = [box([housingW, housingH, depth])];
  for (let i = 0; i < N; i++) {
    const y = totalH / 2 - i * spacing;
    parts.push(sphere(lightRadius).translate([0, y, depth / 2]));
  }
  return union(...parts);
}

export const trafficLight3dSpec = {
  type: 'traffic-light-3d',
  category: 'charts/data',
  args: {
    lights: { type: 'number', default: 3, doc: 'Number of lights (≥1)' },
    lightRadius: { type: 'number', default: 0.22, doc: 'Light sphere radius' },
    spacing: { type: 'number', default: 0.55, doc: 'Vertical spacing' },
    housingPad: { type: 'number', default: 0.12, doc: 'Padding around lights' },
    depth: { type: 'number', default: 0.3, doc: 'Housing depth (Z)' },
  },
  examples: [
    { name: 'Traffic light (3)', args: { lights: 3 } },
    { name: 'RAG status (3)', args: { lights: 3, spacing: 0.5 } },
    { name: 'Five-state', args: { lights: 5 } },
  ],
  description: 'Traffic-light / RAG status indicator — go/no-go, health, signal',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave C — taxonomy charts/data/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
