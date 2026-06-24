// =============================================================================
// sphere-fill-3d.js — "fill level" gauge spheres (Atlas Shape atom, Sprint 2).
// -----------------------------------------------------------------------------
// A row of SOLID spheres, each read as a fill gauge: a coloured liquid bottom
// below a waterline + a light glass top above it, with a crisp meniscus between.
// Faithful 3D twin of PresentationLoad "3D Spheres Fill Levels" (stun-demo
// fixture D0961).
//
// The two-tone split happens IN THE SHADER (studio material kind 'fill', =9), not
// in geometry. Why: the earlier two-cap geometry can't be materialed as a gauge —
// the liquid/glass caps share the same outer sphere surface, so the raymarch can't
// disambiguate the material at a shared hit (see
// project_studio_coincident_surface_material_limit). And real glass refraction
// (kind 'glass', =8) smears the waterline. So each sphere is ONE solid leaf, and
// the 'fill' shader splits it by height: on a sphere the surface normal's
// y-component IS the local height, so the waterline is simply `n.y < 2*fill-1` —
// transform-invariant, no center/radius needed.
//
// Per-sphere fill fraction rides in the PATTERN LUT slot [3] (u_leafPattern.w),
// attached here per leaf. The LIQUID COLOUR comes from the subject's material
// (hue/sat/value); set the subject `material.kind = "fill"` to get the gauge look
// (without it the spheres render as plain solid spheres — a safe fallback).
//
// Per-sphere colour: pass `colors[]` (parallel to levels[]) to give each sphere
// its own liquid hue — each entry mirrors `material` (preset name or {hue,sat,
// value}) and is attached as a per-leaf material with kind forced to 'fill', so
// flattenUnion's child-overrides-parent rule lets one subject carry N colours.
// =============================================================================

import { sphere } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';
import { resolveMaterial, MATERIAL_KIND_INDEX } from '../../spec.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const FILL_KIND = MATERIAL_KIND_INDEX.fill;

/**
 * sphere-fill-3d SDF — a row of solid gauge spheres.
 *
 * @param {object} opts
 * @param {number[]} [opts.levels=[0.25,0.5,0.75,1.0]]  per-sphere fill fraction 0..1
 * @param {number|null} [opts.count=null]  number of spheres (defaults to levels.length)
 * @param {number} [opts.radius=0.6]       sphere radius
 * @param {number} [opts.spacing=0.3]      gap between spheres
 * @param {Array<string|object>|null} [opts.colors=null]  optional per-sphere
 *        liquid colour, parallel to levels[]. Each entry mirrors `material`
 *        (preset name or {hue,sat,value} object); kind is forced to 'fill' so
 *        the gauge shading is kept and only the liquid hue varies. Spheres past
 *        colors.length fall back to the subject's material (uniform colour).
 * @returns {SDF3|null}
 */
export function sphereFill3dSDF({
  levels = [0.25, 0.5, 0.75, 1.0],
  count = null,
  radius = 0.6,
  spacing = 0.3,
  colors = null,
} = {}) {
  const N = count != null ? Math.floor(count) : levels.length;
  if (N <= 0) return null;

  const stride = 2 * radius + spacing;
  const offset = ((N - 1) / 2) * stride;

  const parts = [];
  for (let i = 0; i < N; i++) {
    const f = clamp01(levels[i] != null ? levels[i] : (levels[levels.length - 1] ?? 0.5));
    const cx = i * stride - offset;
    const s = sphere(radius).translate([cx, 0, 0]);
    // Per-sphere fill rides in the pattern LUT slot [3]. The 'fill' material kind
    // (set on the subject) reads u_leafPattern.w as the waterline height.
    s._subjectPattern = { code: 0, scale: 0, strength: 0, fill: f };
    // Optional per-sphere liquid colour → per-leaf material (child overrides the
    // subject's material in flattenUnion). Force kind:'fill' so each sphere keeps
    // the gauge waterline look and only the hue changes; default a soft gauge
    // roughness when the colour entry doesn't specify one.
    if (colors && colors[i] != null) {
      const m = resolveMaterial(colors[i]);
      if (m) {
        s._subjectMaterial = { ...m, kind: FILL_KIND, roughness: m.roughness < 0 ? 0.3 : m.roughness };
      }
    }
    parts.push(s);
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
    colors: {
      type: 'array',
      default: null,
      doc: 'Optional per-sphere liquid colour, parallel to levels[]. Each entry mirrors material (preset name or {hue,sat,value}); kind is forced to "fill". Spheres past colors.length use the subject material.',
    },
  },
  examples: [
    { name: 'Quartile progress', args: { levels: [0.25, 0.5, 0.75, 1.0] } },
    { name: 'Capacity gauges', args: { levels: [0.9, 0.6, 0.3], radius: 0.7 } },
    {
      name: 'Multi-colour fill levels',
      args: {
        levels: [0.8, 0.4, 0.2],
        colors: [{ hue: 0.58, sat: 0.82, value: 0.66 }, 'fruit-red', { hue: 0.3, sat: 0.72, value: 0.6 }],
      },
    },
  ],
  description:
    'Row of fill-level gauge spheres (liquid bottom + glass top split at a waterline). Set the subject material.kind to "fill" with a liquid hue/sat/value for the gauge look. Pass colors[] (parallel to levels[]) to give each sphere its own liquid colour.',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-20',
    builder: 'Sprint 2 sphere atom #1 — taxonomy shapes/ (shader waterline gauge 2026-06-23)',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
