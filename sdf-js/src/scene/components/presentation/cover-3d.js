// =============================================================================
// cover-3d — Presentation cover stage + backdrop (Atlas atom 8/9)
// -----------------------------------------------------------------------------
// First Atlas atom under taxonomy presentation/. A "stage + backdrop"
// composition giving a cover slide a 3D sense of depth, distinct from a flat
// kpi-card. Stage = horizontal rounded plate (floor). Backdrop = vertical
// rounded wall behind the stage. Both share the same X width by default.
//
// Use cases:
//   - Deck cover slide (title + subtitle staged on the floor)
//   - Section divider (chapter title with theatrical framing)
//   - Final/thank-you slide
//   - Any slide where presenter wants stage feel rather than flat card
//
// Geometry: 2 rounded boxes unioned. Stage centered below y=0 (top surface
// at y=0). Backdrop above y=0, at z = -stageDepth/2 (behind the stage).
//
// Title / subtitle stored in AST for downstream material/typography layer.
//
// Author: Atlas (2026-06-18)
// License: PolyForm Noncommercial 1.0.0
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

function sdRBox(p, cx, cy, cz, hx, hy, hz, rr) {
  const qx = Math.abs(p[0] - cx) - hx + rr;
  const qy = Math.abs(p[1] - cy) - hy + rr;
  const qz = Math.abs(p[2] - cz) - hz + rr;
  const dx = Math.max(qx, 0),
    dy = Math.max(qy, 0),
    dz = Math.max(qz, 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) + Math.min(Math.max(qx, qy, qz), 0) - rr;
}

function evalCoverSDF(p, sw, sd, st, bh, bt, r) {
  // Clamp corner radius to half of smallest dim per box
  const rStage = Math.min(r, Math.min(sw, sd, st) * 0.5);
  // Stage: floor plate, top surface at y=0
  const dStage = sdRBox(p, 0, -st / 2, 0, sw / 2, st / 2, sd / 2, rStage);

  if (bh <= 0 || bt <= 0) return dStage;

  // Backdrop: vertical wall at back of stage (z = -sd/2 - bt/2), y centered above floor
  const rBack = Math.min(r, Math.min(sw, bh, bt) * 0.5);
  const dBack = sdRBox(p, 0, bh / 2, -sd / 2 - bt / 2, sw / 2, bh / 2, bt / 2, rBack);
  return Math.min(dStage, dBack);
}

/**
 * Cover stage + backdrop SDF.
 *
 * @param {object} opts
 * @param {number} [opts.stageWidth=4.0]         X width of stage (and backdrop)
 * @param {number} [opts.stageDepth=2.0]         Z depth of stage (front-to-back floor)
 * @param {number} [opts.stageThickness=0.2]     Y thickness of stage floor
 * @param {number} [opts.backdropHeight=2.5]     Y height of backdrop wall (0 = no backdrop)
 * @param {number} [opts.backdropThickness=0.15] Z thickness of backdrop wall (0 = no backdrop)
 * @param {number} [opts.cornerRadius=0.1]       Corner radius (clamped per-box)
 * @param {string} [opts.title='']               Cover title (semantic, AST-only)
 * @param {string} [opts.subtitle='']            Cover subtitle (semantic, AST-only)
 */
export function cover3dSDF({
  stageWidth = 4.0,
  stageDepth = 2.0,
  stageThickness = 0.2,
  backdropHeight = 2.5,
  backdropThickness = 0.15,
  cornerRadius = 0.1,
  title = '',
  subtitle = '',
} = {}) {
  const sw = Math.max(0, stageWidth);
  const sd = Math.max(0, stageDepth);
  const st = Math.max(0, stageThickness);
  const bh = Math.max(0, backdropHeight);
  const bt = Math.max(0, backdropThickness);
  const r = Math.max(0, cornerRadius);

  const inst = SDF3((p) => evalCoverSDF(p, sw, sd, st, bh, bt, r));

  inst.ast = {
    kind: 'prim',
    name: 'cover-3d',
    args: [sw, sd, st, bh, bt, r, title, subtitle],
  };
  return inst;
}

export const cover3dSpec = {
  type: 'cover-3d',
  category: 'presentation',
  args: {
    stageWidth: { type: 'number', default: 4.0, doc: 'X width of stage + backdrop' },
    stageDepth: { type: 'number', default: 2.0, doc: 'Z depth of stage floor' },
    stageThickness: { type: 'number', default: 0.2, doc: 'Y thickness of stage floor' },
    backdropHeight: {
      type: 'number',
      default: 2.5,
      doc: 'Y height of backdrop wall (0 = no wall)',
    },
    backdropThickness: {
      type: 'number',
      default: 0.15,
      doc: 'Z thickness of backdrop wall (0 = no wall)',
    },
    cornerRadius: {
      type: 'number',
      default: 0.1,
      doc: 'Corner radius (clamped per-box to half smallest dim)',
    },
    title: { type: 'string', default: '', doc: 'Cover title (semantic, AST-only)' },
    subtitle: { type: 'string', default: '', doc: 'Cover subtitle (semantic, AST-only)' },
  },
  examples: [
    { name: 'Default cover', args: {} },
    { name: 'Wide cinema (16:9)', args: { stageWidth: 5.0, backdropHeight: 2.8 } },
    {
      name: 'Tall portrait',
      args: { stageWidth: 2.0, stageDepth: 1.0, backdropHeight: 4.0 },
    },
    { name: 'No backdrop (stage only)', args: { backdropHeight: 0, backdropThickness: 0 } },
    { name: 'Thick relief backdrop', args: { backdropThickness: 0.5 } },
    { name: 'Sharp corporate', args: { cornerRadius: 0.02 } },
  ],
  description: 'Stage + backdrop cover slide composition (rounded floor plate + back wall)',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-18',
    builder: 'Sprint 1 atom #8 — presentation/cover-3d (taxonomy new)',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
