// =============================================================================
// sphere-fill-3d.js — "fill level" spheres (Atlas Shape atom, Sprint 2).
// -----------------------------------------------------------------------------
// A row of glass spheres, each holding a liquid fill cap whose height encodes a
// 0..1 fraction. Covers PresentationLoad "3D Spheres Fill Levels" (deck P0 use
// case). Pure geometry — readable without per-part color:
//   - container: 3 great-circle wireframe rings (tori) → recognizable "globe"
//   - liquid:    cutSphere cap, filled from the bottom up to the waterline
//
// Reuses shipped primitives (all GLSL-emit registered 2026-06-19):
//   - sphere/cut-sphere (d3.js, sdf3.compile.js:313/566)
//   - torus             (d3.js:73,  sdf3.compile.js:328)
//   - union             (dn.js:37,  sdf3.compile.js:224)
//
// Spec: docs/superpowers/specs/2026-06-20-sphere-atoms-design.md
// =============================================================================

import { sphere, cutSphere, torus } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Build a wireframe "globe cage": 3 orthogonal great-circle rings.
 * @param {number} r          ring radius (= sphere radius)
 * @param {number} thickness  tube radius
 * @returns {SDF3}
 */
function cageRings(r, thickness) {
  const equator = torus(r, thickness); // ring in XZ plane (axis Y)
  const meridianA = torus(r, thickness).rotate(Math.PI / 2, [1, 0, 0]); // XY plane
  const meridianB = torus(r, thickness).rotate(Math.PI / 2, [0, 0, 1]); // YZ plane
  return union(equator, meridianA, meridianB);
}

/**
 * Liquid fill cap for one sphere. Fills from the bottom (−Y) up to a waterline
 * set by the fill fraction. Returns null for an empty (fraction ≤ 0) sphere.
 *
 * cutSphere(r, h) keeps the y ≥ h portion; we mirror it (rotate π about X) so
 * the kept cap is the y ≤ waterline bottom portion.
 *
 * @param {number} r  liquid radius (slightly inset inside the cage)
 * @param {number} f  fill fraction (0..1)
 * @returns {SDF3|null}
 */
function liquidCap(r, f) {
  const frac = clamp01(f);
  if (frac <= 0) return null;
  // A full tank is a plain sphere. cutSphere(r, ±r) is degenerate (w → 0), so
  // route the brim-full case to the exact primitive instead of the cut cap.
  if (frac >= 1) return sphere(r);
  const waterline = r * (2 * frac - 1); // open interval (−r, +r)
  return cutSphere(r, -waterline).rotate(Math.PI, [1, 0, 0]);
}

/**
 * sphere-fill-3d SDF.
 *
 * @param {object} opts
 * @param {number[]} [opts.levels=[0.25,0.5,0.75,1.0]]  per-sphere fill fraction 0..1
 * @param {number|null} [opts.count=null]  number of spheres (defaults to levels.length)
 * @param {number} [opts.radius=0.6]       sphere radius
 * @param {number} [opts.spacing=0.3]      gap between spheres
 * @param {boolean} [opts.cage=true]       draw the wireframe container cage
 * @param {number} [opts.cageThickness=0.025]  cage ring tube radius
 * @param {number} [opts.fillScale=0.92]   liquid radius as a fraction of sphere radius
 * @returns {SDF3|null}
 */
export function sphereFill3dSDF({
  levels = [0.25, 0.5, 0.75, 1.0],
  count = null,
  radius = 0.6,
  spacing = 0.3,
  cage = true,
  cageThickness = 0.025,
  fillScale = 0.92,
} = {}) {
  const N = count != null ? Math.floor(count) : levels.length;
  if (N <= 0) return null;

  const stride = 2 * radius + spacing;
  const offset = ((N - 1) / 2) * stride;
  const fillR = radius * fillScale;

  const parts = [];
  for (let i = 0; i < N; i++) {
    const f = levels[i] != null ? levels[i] : (levels[levels.length - 1] ?? 0.5);
    const cx = i * stride - offset;

    const sphereParts = [];
    if (cage) sphereParts.push(cageRings(radius, cageThickness));
    const liquid = liquidCap(fillR, f);
    if (liquid) sphereParts.push(liquid);

    if (sphereParts.length === 0) continue; // empty + no cage → nothing
    const group = sphereParts.length === 1 ? sphereParts[0] : union(...sphereParts);
    parts.push(group.translate([cx, 0, 0]));
  }

  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : union(...parts);
}

// ---- Spec (compile.js validation + lift prompt) -----------------------------

export const sphereFill3dSpec = {
  type: 'sphere-fill-3d',
  category: 'shapes',
  args: {
    levels: {
      type: 'array',
      default: [0.25, 0.5, 0.75, 1.0],
      doc: 'Per-sphere fill fraction 0..1',
    },
    count: { type: 'number', default: null, doc: 'Number of spheres (defaults to levels.length)' },
    radius: { type: 'number', default: 0.6, doc: 'Sphere radius' },
    spacing: { type: 'number', default: 0.3, doc: 'Gap between spheres' },
    cage: { type: 'boolean', default: true, doc: 'Draw the wireframe container cage' },
    cageThickness: { type: 'number', default: 0.025, doc: 'Cage ring tube radius' },
    fillScale: { type: 'number', default: 0.92, doc: 'Liquid radius as fraction of sphere radius' },
  },
  examples: [
    { name: 'Quartile progress', args: { levels: [0.25, 0.5, 0.75, 1.0] } },
    { name: 'Capacity gauges', args: { levels: [0.9, 0.6, 0.3], radius: 0.7 } },
    { name: 'Single tank', args: { levels: [0.65], cage: true } },
  ],
  description: 'Row of glass spheres with liquid fill levels (0..1) for capacity / progress',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-20',
    builder: 'Sprint 2 sphere atom #1 — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
