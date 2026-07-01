// =============================================================================
// device-mockup-3d.js — phone / tablet / laptop frame (Atlas shape atom).
// -----------------------------------------------------------------------------
// A device body slab with a recessed screen panel on the front face. Covers the
// scaffold "device-mockup-frame" (product-demo hero). Composite (box + box + union);
// the screen carries a dark _subjectMaterial so it reads as a display.
// =============================================================================

import { box } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';
import { resolveMaterial } from '../../spec.js';

const SCREEN_MAT = { hue: 0.6, sat: 0.35, value: 0.14, roughness: 0.15, clearcoat: 0.7 };

// aspect (w, h) per device kind — origin-centred, stands upright in XY facing camera
const ASPECT = {
  phone: [1.0, 2.05],
  tablet: [1.6, 2.1],
  laptop: [2.7, 1.7],
  desktop: [2.7, 1.7],
};

/**
 * @param {object} opts
 * @param {string} [opts.device='phone']  phone | tablet | laptop
 * @param {number} [opts.scale=1]         overall size multiplier
 * @param {number} [opts.depth=0.16]      body Z depth
 * @param {number} [opts.bezel=0.1]       frame border width
 * @returns {SDF3}
 */
export function deviceMockup3dSDF({ device = 'phone', scale = 1, depth = 0.16, bezel = 0.1 } = {}) {
  const [w0, h0] = ASPECT[device] || ASPECT.phone;
  const w = w0 * scale;
  const h = h0 * scale;
  const body = box([w, h, depth]);
  const screen = box([w - 2 * bezel, h - 2 * bezel, depth * 0.55]).translate([0, 0, depth * 0.3]);
  const m = resolveMaterial(SCREEN_MAT);
  if (m) screen._subjectMaterial = m;
  return union(body, screen);
}

export const deviceMockup3dSpec = {
  type: 'device-mockup-3d',
  category: 'shapes',
  args: {
    device: { type: 'string', default: 'phone', doc: 'phone | tablet | laptop' },
    scale: { type: 'number', default: 1, doc: 'Overall size multiplier' },
    depth: { type: 'number', default: 0.16, doc: 'Body Z depth' },
    bezel: { type: 'number', default: 0.1, doc: 'Frame border width' },
  },
  examples: [
    { name: 'Phone', args: { device: 'phone' } },
    { name: 'Tablet', args: { device: 'tablet' } },
    { name: 'Laptop', args: { device: 'laptop' } },
  ],
  description: 'Device frame (phone/tablet/laptop) with a screen panel — product-demo mockup',
  source: {
    author: 'Atlas',
    builtAt: '2026-07-01',
    builder: 'Scaffold coverage — device-mockup-frame',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
