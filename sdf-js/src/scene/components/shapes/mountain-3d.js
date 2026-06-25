// =============================================================================
// mountain-3d.js — summit / journey metaphor graphic (Atlas shape atom).
// -----------------------------------------------------------------------------
// A mountain massif (a main peak + flanking side peaks) with a trail of markers
// ascending the front face to the summit. Covers PresentationLoad "Mountain Path
// – Graphics" — the climb-to-goal metaphor. Composite atom (cone + sphere + union),
// trail markers carry an accent _subjectMaterial so the path reads against the rock.
// =============================================================================

import { cone, sphere } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';
import { resolveMaterial } from '../../spec.js';

const TRAIL_ACCENT = { hue: 0.08, sat: 0.85, value: 0.92 }; // warm summit-trail accent

/**
 * @param {object} opts
 * @param {number} [opts.height=2.4]      main-peak height (base sits on y=0)
 * @param {number} [opts.baseRadius=1.5]  main-peak base radius
 * @param {number} [opts.sidePeaks=2]     flanking peaks (0..2)
 * @param {number} [opts.spread=1.7]      x offset of side peaks
 * @param {number} [opts.sideScale=0.6]   side-peak size vs main
 * @param {number} [opts.pathMarkers=4]   trail markers up the front face
 * @param {number} [opts.markerRadius=0.13] trail marker radius
 * @returns {SDF3}
 */
export function mountain3dSDF({
  height = 2.4,
  baseRadius = 1.5,
  sidePeaks = 2,
  spread = 1.7,
  sideScale = 0.6,
  pathMarkers = 4,
  markerRadius = 0.13,
} = {}) {
  const parts = [];
  // main peak — cone is centred on its own height, lift base to y=0
  parts.push(cone(height, baseRadius).translate([0, height / 2, 0]));

  // flanking peaks, slightly back and to the sides
  const S = Math.max(0, Math.min(2, Math.floor(sidePeaks)));
  const sh = height * sideScale;
  const sr = baseRadius * sideScale;
  if (S >= 1) parts.push(cone(sh, sr).translate([-spread, sh / 2, -0.5]));
  if (S >= 2) parts.push(cone(sh * 0.9, sr * 0.95).translate([spread * 0.95, (sh * 0.9) / 2, -0.6]));

  // trail of markers zig-zagging up the front face (z+) of the main peak
  const M = Math.max(0, Math.floor(pathMarkers));
  const accent = resolveMaterial(TRAIL_ACCENT);
  for (let i = 0; i < M; i++) {
    const t = (i + 0.5) / M; // 0..1 up the peak
    const y = t * height * 0.82;
    const rAtY = baseRadius * (1 - y / height); // cone radius shrinks with height
    const x = (i % 2 === 0 ? -1 : 1) * Math.min(0.45, rAtY * 0.5); // zig-zag
    const z = rAtY * 0.86 + markerRadius * 0.4; // sit on the front slope
    const m = sphere(markerRadius).translate([x, y + markerRadius, z]);
    if (accent) m._subjectMaterial = accent;
    parts.push(m);
  }

  return parts.length === 1 ? parts[0] : union(...parts);
}

export const mountain3dSpec = {
  type: 'mountain-3d',
  category: 'shapes',
  args: {
    height: { type: 'number', default: 2.4, doc: 'Main-peak height' },
    baseRadius: { type: 'number', default: 1.5, doc: 'Main-peak base radius' },
    sidePeaks: { type: 'number', default: 2, doc: 'Flanking peaks (0..2)' },
    spread: { type: 'number', default: 1.7, doc: 'x offset of side peaks' },
    sideScale: { type: 'number', default: 0.6, doc: 'Side-peak scale vs main' },
    pathMarkers: { type: 'number', default: 4, doc: 'Trail markers up the front' },
    markerRadius: { type: 'number', default: 0.13, doc: 'Trail marker radius' },
  },
  examples: [
    { name: 'Summit + trail', args: { pathMarkers: 4 } },
    { name: 'Lone peak', args: { sidePeaks: 0, pathMarkers: 5 } },
    { name: 'Range', args: { sidePeaks: 2, pathMarkers: 0 } },
  ],
  description: 'Mountain massif with an ascending trail — the climb-to-goal metaphor',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-25',
    builder: 'Polish round — recommendations coverage (Mountain Path)',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
