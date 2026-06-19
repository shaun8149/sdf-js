// =============================================================================
// text-3d.js — multi-character text layout + extrusion (Atlas typography atom)
// -----------------------------------------------------------------------------
// Takes a string, looks up each character in the glyph table ([[glyphs.js]]),
// lays them out with per-character advance widths, unions them into a single
// 2D SDF, then extrudes along Z for 3D presence.
//
// Coordinate space (BEFORE caller-applied scale / transform):
//   2D plane: baseline at y = 0, cap height at y = 1.0 × height
//   3D Z extent: ±depth/2 (so 3D bounds are roughly the cap-height rectangle
//   thick along Z)
//   X origin: depends on `align` — 'center' (default) puts the visual
//   midline of the rendered string at x = 0.
//
// Designed for KPI-style annotations and titles on 3D charts. Stroke radius
// follows the monoline grotesk convention (~12% cap height by default).
// Glyphs are real SDF curves (segment / arc / ring / circle), so the extruded
// 3D text composes correctly with other SDFs (boolean union, intersection,
// shared lighting, animation).
// =============================================================================

import { buildGlyph } from './glyphs.js';
import { buildPipeGlyph } from './glyphs-pipe.js';
import { union } from '../../../sdf/dn.js';
import { extrude } from '../../../sdf/d2.js';

/**
 * Walk a resolved-glyph list (output of per-char buildGlyph) and lay them out
 * with per-character advance widths + alignment, translating each glyph by
 * its cumulative x-cursor position. Returns the array of placed SDF copies
 * (caller is responsible for union + any further wrap like scale / extrude).
 *
 * Shared between text2dSDF (2D) and text3dPipeSDF (3D). Wave 2-3 letter
 * additions will reuse without duplication.
 *
 * @param {Array<{sdf: any|null, advance: number}>} resolved
 * @param {'2d'|'3d'} axis
 * @param {'left'|'center'|'right'} align
 * @param {number} letterSpacing
 * @returns {Array<any>}   non-null placed SDFs (skipped glyphs with null sdf)
 */
function layoutGlyphs(resolved, axis, align, letterSpacing) {
  const totalWidth =
    resolved.reduce((acc, g) => acc + g.advance + letterSpacing, 0) - letterSpacing;
  const startX = align === 'center' ? -totalWidth / 2 : align === 'right' ? -totalWidth : 0;
  let cursor = startX;
  const placed = [];
  for (const g of resolved) {
    if (g.sdf !== null) {
      const centerX = cursor + g.advance / 2;
      placed.push(axis === '3d' ? g.sdf.translate([centerX, 0, 0]) : g.sdf.translate([centerX, 0]));
    }
    cursor += g.advance + letterSpacing;
  }
  return placed;
}

/**
 * Build a 2D text SDF (unit cap-height) ready for caller-side .scale() /
 * .translate() / .extrude(). Returns null if the string contains zero
 * renderable characters (all unknown / all spaces).
 *
 * @param {object} opts
 * @param {string} opts.text                       The string to render.
 * @param {number} [opts.strokeWidth=0.12]         Stroke thickness in unit space (cap height = 1).
 * @param {number} [opts.letterSpacing=0]          Extra spacing between glyphs (added to each glyph's advance).
 * @param {'left'|'center'|'right'} [opts.align='center']  Horizontal alignment around x = 0.
 * @returns {SDF2|null}
 */
export function text2dSDF({ text, strokeWidth = 0.12, letterSpacing = 0, align = 'center' } = {}) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const strokeRadius = strokeWidth / 2;

  // Resolve each char to { sdf, advance } or null (unknown char dropped).
  const resolved = [];
  for (const ch of text) {
    const g = buildGlyph(ch, strokeRadius);
    if (g !== null) resolved.push(g);
  }
  if (resolved.length === 0) return null;

  const placed = layoutGlyphs(resolved, '2d', align, letterSpacing);
  if (placed.length === 0) return null;
  return placed.length === 1 ? placed[0] : union(...placed);
}

/**
 * Build a 3D extruded text SDF. Convenience wrapper around text2dSDF +
 * caller-side scale + extrude.
 *
 * @param {object} opts
 * @param {string} opts.text
 * @param {number} [opts.strokeWidth=0.12]   Same as text2dSDF (unit space — gets scaled with `height`).
 * @param {number} [opts.height=1.0]         Cap height in scene units. The whole 2D plane scales by this.
 * @param {number} [opts.depth=0.2]          Extrusion thickness along Z.
 * @param {number} [opts.letterSpacing=0]    In unit space.
 * @param {'left'|'center'|'right'} [opts.align='center']
 * @returns {SDF3|null}
 */
export function text3dExtrudedSDF({
  text,
  strokeWidth = 0.12,
  height = 1.0,
  depth = 0.2,
  letterSpacing = 0,
  align = 'center',
} = {}) {
  const sdf2d = text2dSDF({ text, strokeWidth, letterSpacing, align });
  if (sdf2d === null) return null;
  // Scale 2D plane to requested cap height, then extrude.
  const scaled = height === 1 ? sdf2d : sdf2d.scale(height);
  return extrude(scaled, depth);
}

/** Spec metadata for the renderer / mapper layer. */
export const text3dExtrudedSpec = {
  type: 'text-3d-extruded',
  category: 'typography',
  args: {
    text: { type: 'string', required: true },
    strokeWidth: { type: 'number', default: 0.12 },
    height: { type: 'number', default: 1.0 },
    depth: { type: 'number', default: 0.2 },
    letterSpacing: { type: 'number', default: 0 },
    align: { type: 'enum', values: ['left', 'center', 'right'], default: 'center' },
  },
  source: {
    type: 'first-party',
    family: 'Atlas typography (Wave 1: digits + KPI symbols, extruded variant)',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};

/**
 * Build a 3D pipe text SDF. Each glyph is composed from capsule/torus/sphere
 * primitives in unit cap-height space, then optionally scaled by `height`.
 * Returns null if the string has zero renderable characters.
 *
 * @param {object} opts
 * @param {string} opts.text
 * @param {number} [opts.pipeRadius=0.06]   Tube radius (analogue to extruded strokeWidth/2).
 * @param {number} [opts.height=1.0]        Cap height in scene units.
 * @param {number} [opts.letterSpacing=0]   Extra gap between glyphs (unit space).
 * @param {'left'|'center'|'right'} [opts.align='center']
 * @returns {SDF3|null}
 */
export function text3dPipeSDF({
  text,
  pipeRadius = 0.06,
  height = 1.0,
  letterSpacing = 0,
  align = 'center',
} = {}) {
  if (typeof text !== 'string' || text.length === 0) return null;

  const resolved = [];
  for (const ch of text) {
    const g = buildPipeGlyph(ch, pipeRadius);
    if (g !== null) resolved.push(g);
  }
  if (resolved.length === 0) return null;

  const placed = layoutGlyphs(resolved, '3d', align, letterSpacing);
  if (placed.length === 0) return null;
  const combined = placed.length === 1 ? placed[0] : union(...placed);
  return height === 1 ? combined : combined.scale(height);
}

export const text3dPipeSpec = {
  type: 'text-3d-pipe',
  category: 'typography',
  args: {
    text: { type: 'string', required: true },
    pipeRadius: { type: 'number', default: 0.06 },
    height: { type: 'number', default: 1.0 },
    letterSpacing: { type: 'number', default: 0 },
    align: { type: 'enum', values: ['left', 'center', 'right'], default: 'center' },
  },
  source: {
    type: 'first-party',
    family: 'Atlas typography (Wave 1-pipe: digits + KPI symbols, true 3D)',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
