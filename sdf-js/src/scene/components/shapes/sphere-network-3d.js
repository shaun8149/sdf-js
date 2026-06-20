// =============================================================================
// sphere-network-3d.js — hub-and-satellite sphere network (Atlas Shape atom).
// -----------------------------------------------------------------------------
// A central hub sphere connected to N satellite spheres by capsule links.
// Covers PresentationLoad "3D Spheres Network" (center + satellites). Composite
// atom built from shipped primitives (all GLSL-emit registered):
//   - sphere   (d3.js:16, sdf3.compile.js:313)
//   - capsule  (d3.js:54, sdf3.compile.js:326)
//   - union    (dn.js:37, sdf3.compile.js:224)
//
// Spec: docs/superpowers/specs/2026-06-20-sphere-atoms-design.md
// =============================================================================

import { sphere, capsule } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';

/**
 * Satellite positions around the hub.
 * @param {number} count
 * @param {number} radius        orbit radius (hub center → satellite center)
 * @param {string} arrangement   'ring' (XZ) | 'ring-xy' (XY) | 'sphere' (fibonacci)
 * @returns {number[][]} array of [x, y, z]
 */
function satellitePositions(count, radius, arrangement) {
  const positions = [];
  if (arrangement === 'sphere') {
    // Fibonacci sphere — evenly distributed points on a sphere surface.
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2; // 1 .. -1
      const rAtY = Math.sqrt(Math.max(1 - y * y, 0));
      const theta = i * golden;
      positions.push([
        radius * Math.cos(theta) * rAtY,
        radius * y,
        radius * Math.sin(theta) * rAtY,
      ]);
    }
    return positions;
  }
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    if (arrangement === 'ring-xy') {
      positions.push([radius * Math.cos(a), radius * Math.sin(a), 0]);
    } else {
      // 'ring' (default) — XZ plane
      positions.push([radius * Math.cos(a), 0, radius * Math.sin(a)]);
    }
  }
  return positions;
}

/**
 * sphere-network-3d SDF.
 *
 * @param {object} opts
 * @param {number} [opts.count=6]            number of satellites
 * @param {number} [opts.hubRadius=0.5]      central hub sphere radius
 * @param {number} [opts.satelliteRadius=0.28] satellite sphere radius
 * @param {number} [opts.radius=1.5]         orbit radius (hub → satellite)
 * @param {number} [opts.linkThickness=0.05] capsule link radius
 * @param {string} [opts.arrangement='ring'] 'ring' | 'ring-xy' | 'sphere'
 * @returns {SDF3|null}
 */
export function sphereNetwork3dSDF({
  count = 6,
  hubRadius = 0.5,
  satelliteRadius = 0.28,
  radius = 1.5,
  linkThickness = 0.05,
  arrangement = 'ring',
} = {}) {
  const N = Math.floor(count);
  if (N < 0) return null;

  const parts = [sphere(hubRadius)];
  const positions = satellitePositions(N, radius, arrangement);
  for (const pos of positions) {
    parts.push(capsule([0, 0, 0], pos, linkThickness));
    parts.push(sphere(satelliteRadius).translate(pos));
  }

  return parts.length === 1 ? parts[0] : union(...parts);
}

// ---- Spec (compile.js validation + lift prompt) -----------------------------

export const sphereNetwork3dSpec = {
  type: 'sphere-network-3d',
  category: 'shapes',
  args: {
    count: { type: 'number', default: 6, doc: 'Number of satellite spheres' },
    hubRadius: { type: 'number', default: 0.5, doc: 'Central hub sphere radius' },
    satelliteRadius: { type: 'number', default: 0.28, doc: 'Satellite sphere radius' },
    radius: { type: 'number', default: 1.5, doc: 'Orbit radius (hub → satellite)' },
    linkThickness: { type: 'number', default: 0.05, doc: 'Capsule link radius' },
    arrangement: {
      type: 'enum',
      values: ['ring', 'ring-xy', 'sphere'],
      default: 'ring',
    },
  },
  examples: [
    { name: 'Hub & spokes', args: { count: 6, arrangement: 'ring' } },
    { name: 'Org constellation', args: { count: 8, arrangement: 'sphere', radius: 1.8 } },
    { name: 'Front-facing wheel', args: { count: 5, arrangement: 'ring-xy' } },
  ],
  description: 'Central hub connected to N satellite spheres by links (network / mind-map)',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-20',
    builder: 'Sprint 2 sphere atom #2 — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
