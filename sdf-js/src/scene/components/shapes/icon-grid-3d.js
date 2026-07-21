// =============================================================================
// icon-grid-3d.js — a wall of icon tiles (Atlas shape atom).
// -----------------------------------------------------------------------------
// rows×cols rounded tiles facing the camera, each with a simple raised pictogram
// (disc / ring / plus / bar / frame / dot / lines / square) cycling across cells.
// Covers PresentationLoad "Line Icons" style icon sets — an abstract visual
// language. Composite atom (box + cylinder + sphere + union/difference); glyphs
// carry an accent _subjectMaterial so they pop off the tile face.
// =============================================================================

import { box, cylinder, sphere } from '../../../sdf/d3.js';
import { union, difference } from '../../../sdf/dn.js';
import { resolveMaterial } from '../../spec.js';

const GLYPH_ACCENT = { hue: 0.57, sat: 0.5, value: 0.95 };

// glyph in the XY plane, thin in Z, centred at origin. s = glyph half-size, d = depth.
function glyph(kind, s, d) {
  const k = ((kind % 8) + 8) % 8;
  switch (k) {
    case 0: // disc
      return cylinder(s, d).rotateXYZ([Math.PI / 2, 0, 0]);
    case 1: // ring
      return difference(cylinder(s, d), cylinder(s * 0.55, d * 1.6)).rotateXYZ([Math.PI / 2, 0, 0]);
    case 2: // plus
      return union(box([s * 1.7, s * 0.5, d]), box([s * 0.5, s * 1.7, d]));
    case 3: // bar
      return box([s * 1.8, s * 0.55, d]);
    case 4: // square frame
      return difference(box([s * 1.7, s * 1.7, d]), box([s * 0.9, s * 0.9, d * 1.6]));
    case 5: // dot
      return sphere(s * 0.9);
    case 6: // stacked lines
      return union(
        box([s * 1.6, s * 0.4, d]).translate([0, s * 0.55, 0]),
        box([s * 1.6, s * 0.4, d]).translate([0, -s * 0.55, 0]),
      );
    default: // 7: filled square
      return box([s * 1.3, s * 1.3, d]);
  }
}

/**
 * @param {object} opts
 * @param {number} [opts.rows=2]
 * @param {number} [opts.cols=4]
 * @param {number} [opts.tileSize=0.8]   tile edge length
 * @param {number} [opts.gap=0.22]       gap between tiles
 * @param {number} [opts.tileDepth=0.22] tile Z depth
 * @param {number[]} [opts.glyphs]       per-cell glyph indices (default: cycle 0..7)
 * @returns {SDF3}
 */
export function iconGrid3dSDF({
  rows = 2,
  cols = 4,
  tileSize = 0.8,
  gap = 0.22,
  tileDepth = 0.22,
  glyphs = null,
} = {}) {
  const R = Math.max(1, Math.floor(rows));
  const C = Math.max(1, Math.floor(cols));
  const stride = tileSize + gap;
  const gs = tileSize * 0.24; // glyph half-size
  const gd = 0.08; // glyph raised depth
  const accent = resolveMaterial(GLYPH_ACCENT);
  const parts = [];
  let idx = 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const x = (c - (C - 1) / 2) * stride;
      const y = ((R - 1) / 2 - r) * stride;
      parts.push(box([tileSize, tileSize, tileDepth]).translate([x, y, 0]));
      const kind = glyphs && glyphs[idx] != null ? glyphs[idx] : idx;
      const g = glyph(kind, gs, gd).translate([x, y, tileDepth / 2 + gd / 2]);
      if (accent) g._subjectMaterial = accent;
      parts.push(g);
      idx++;
    }
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const iconGrid3dSpec = {
  type: 'icon-grid-3d',
  category: 'shapes',
  args: {
    rows: { type: 'number', default: 2, doc: 'Tile rows' },
    cols: { type: 'number', default: 4, doc: 'Tile columns' },
    tileSize: { type: 'number', default: 0.8, doc: 'Tile edge length' },
    gap: { type: 'number', default: 0.22, doc: 'Gap between tiles' },
    tileDepth: { type: 'number', default: 0.22, doc: 'Tile Z depth' },
    glyphs: { type: 'array', default: null, doc: 'Per-cell glyph indices (0..7), default cycles' },
  },
  examples: [
    { name: 'Icon wall 2x4', args: { rows: 2, cols: 4 } },
    { name: 'Toolbar', args: { rows: 1, cols: 6 } },
    { name: 'Grid 3x3', args: { rows: 3, cols: 3 } },
  ],
  description: 'A wall of icon tiles with raised pictograms — an icon set / visual language',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-25',
    builder: 'Polish round — recommendations coverage (Line Icons)',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
