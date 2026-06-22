// =============================================================================
// sphere-fill-3d.js — "fill level" spheres (Atlas Shape atom, Sprint 2).
// -----------------------------------------------------------------------------
// A row of spheres, each split at a waterline into a coloured LIQUID bottom cap
// and a light GLASS top cap. Faithful 3D twin of PresentationLoad "3D Spheres
// Fill Levels" (stun-demo fixture D0961).
//
// Design note (2026-06-22): the PresentationLoad look is NOT a transparent shell
// holding a separate liquid volume — real glass refraction magnifies/fills the
// level and destroys the readable waterline (the gauge's whole purpose). It is a
// SOLID sphere cut at the waterline into two opaque-but-glossy materials:
//   - liquid (below waterline): the coloured fill — opaque, glossy + clearcoat
//   - glass  (above waterline): light/clear — light glossy material
// The seam between the two caps IS the waterline ellipse → the fill level reads
// at a glance. Both caps carry a glassy sheen via the standard PBR material
// (clearcoat + reflection), so it looks like glass without losing the data.
//
// `part` lets each cap carry its own material: 'liquid' (colored bottom),
// 'glass' (light top), or 'both' (default — single material, a plain sphere).
//
// KNOWN LIMITATION (2026-06-22): you cannot get the two-tone gauge by overlaying
// two instances (one part:'liquid' + one part:'glass') in one scene. Both caps
// are cut from the SAME radius sphere, so their outer surfaces COINCIDE; the
// studio raymarch can't tell which cap's material to use at a shared surface
// point and the first subject's material wins for the whole sphere (verified by
// order-swap: glass-first → all light, liquid-first → all blue). part:'liquid'
// and part:'glass' are therefore usable as standalone building blocks, but the
// full single-atom two-tone fill gauge awaits a SHADER waterline split (color by
// height vs a per-sphere waterline within one solid-sphere subject). Real glass
// refraction (studio material kind 'glass') was rejected for this atom: it
// magnifies/fills the level and destroys the readable waterline.
// =============================================================================

import { sphere, cutSphere } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Coloured liquid: the sphere portion BELOW the waterline (bottom cap).
 * cutSphere(r, h) keeps the y ≥ h portion; mirror it (rotate π about X) to keep
 * the bottom (y ≤ waterline) portion.
 * @returns {SDF3|null} null when empty (f ≤ 0)
 */
function liquidCap(r, f) {
  const frac = clamp01(f);
  if (frac <= 0) return null;
  if (frac >= 1) return sphere(r); // brim-full → whole sphere is liquid
  const waterline = r * (2 * frac - 1); // ∈ (−r, +r)
  return cutSphere(r, -waterline).rotate(Math.PI, [1, 0, 0]);
}

/**
 * Glass: the sphere portion ABOVE the waterline (top cap, the "empty" part).
 * cutSphere(r, waterline) keeps the y ≥ waterline portion directly.
 * @returns {SDF3|null} null when full (f ≥ 1 → no empty top)
 */
function glassCap(r, f) {
  const frac = clamp01(f);
  if (frac >= 1) return null;
  if (frac <= 0) return sphere(r); // empty → whole sphere is glass
  const waterline = r * (2 * frac - 1);
  return cutSphere(r, waterline);
}

/**
 * sphere-fill-3d SDF.
 *
 * @param {object} opts
 * @param {number[]} [opts.levels=[0.25,0.5,0.75,1.0]]  per-sphere fill fraction 0..1
 * @param {number|null} [opts.count=null]  number of spheres (defaults to levels.length)
 * @param {number} [opts.radius=0.6]       sphere radius
 * @param {number} [opts.spacing=0.3]      gap between spheres
 * @param {'both'|'liquid'|'glass'} [opts.part='both']  which cap to emit (composite materials them separately)
 * @returns {SDF3|null}
 */
export function sphereFill3dSDF({
  levels = [0.25, 0.5, 0.75, 1.0],
  count = null,
  radius = 0.6,
  spacing = 0.3,
  part = 'both',
} = {}) {
  const N = count != null ? Math.floor(count) : levels.length;
  if (N <= 0) return null;

  const stride = 2 * radius + spacing;
  const offset = ((N - 1) / 2) * stride;
  const wantLiquid = part === 'both' || part === 'liquid';
  const wantGlass = part === 'both' || part === 'glass';

  const parts = [];
  for (let i = 0; i < N; i++) {
    const f = levels[i] != null ? levels[i] : (levels[levels.length - 1] ?? 0.5);
    const cx = i * stride - offset;

    const capParts = [];
    if (wantLiquid) {
      const liquid = liquidCap(radius, f);
      if (liquid) capParts.push(liquid);
    }
    if (wantGlass) {
      const glass = glassCap(radius, f);
      if (glass) capParts.push(glass);
    }

    if (capParts.length === 0) continue;
    const group = capParts.length === 1 ? capParts[0] : union(...capParts);
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
    part: {
      type: 'string',
      default: 'both',
      doc: "Which cap: 'both' | 'liquid' (colored bottom) | 'glass' (light top)",
    },
  },
  examples: [
    { name: 'Quartile progress', args: { levels: [0.25, 0.5, 0.75, 1.0] } },
    { name: 'Capacity gauges', args: { levels: [0.9, 0.6, 0.3], radius: 0.7 } },
    { name: 'Liquid only', args: { levels: [0.5], part: 'liquid' } },
  ],
  description: 'Row of fill-level spheres (waterline split: colored liquid bottom + glass top)',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-20',
    builder: 'Sprint 2 sphere atom #1 — taxonomy shapes/ (waterline-split rebuild 2026-06-22)',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
