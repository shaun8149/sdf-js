// =============================================================================
// linear-layout.js — Atlas Present Linear archetype layout (Sprint 1 v4)
// -----------------------------------------------------------------------------
// Pure functions for computing section regions in Linear archetype:
//   centerX = i * spacing
//   bbox derived from sceneData subjects (mode-agnostic)
//
// Used by info-graphic-render.js (2D Info Graphic mode) and Sprint 2+ by
// 3D Play mode. Regions are mode-agnostic — they describe spatial bounds,
// NOT cameras.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-v4-design.md §5
// =============================================================================

export const DEFAULT_SPACING = 6;

/**
 * Compute mode-agnostic bounding box for a SceneData's subjects.
 * Returns center + halfSize on each axis. Empty subjects → unit box at origin.
 *
 * @param {object} sceneData — SceneData v1
 * @returns {{centerX:number, centerY:number, centerZ:number, halfWidth:number, halfHeight:number, halfDepth:number}}
 */
export function computeBoundingBox(sceneData) {
  const subjects = sceneData?.subjects ?? [];
  if (subjects.length === 0) {
    return {
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      halfWidth: 0.5,
      halfHeight: 0.5,
      halfDepth: 0.5,
    };
  }
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const s of subjects) {
    const t = s.transform?.translate ?? [0, 0, 0];
    if (t[0] < minX) minX = t[0];
    if (t[1] < minY) minY = t[1];
    if (t[2] < minZ) minZ = t[2];
    if (t[0] > maxX) maxX = t[0];
    if (t[1] > maxY) maxY = t[1];
    if (t[2] > maxZ) maxZ = t[2];
  }
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2,
    halfWidth: Math.max(0.5, (maxX - minX) / 2),
    halfHeight: Math.max(0.5, (maxY - minY) / 2),
    halfDepth: Math.max(0.5, (maxZ - minZ) / 2),
  };
}

/**
 * Compute Linear archetype regions: place sections along X axis with `spacing`
 * between centers. Each region carries center + halfSize derived from the
 * section's sceneData bbox, plus a title (fallback "Page {i+1}").
 *
 * Mode-agnostic — describes spatial bounds, NOT cameras. 2D Info Graphic
 * uses region.centerX/centerY for 2D layout positions; Sprint 2 3D Play will
 * derive camera target from region.centerX/Y/Z + distance from halfSize.
 *
 * @param {Array<{sceneData:object, title?:string}>} sections
 * @param {number} [spacing=DEFAULT_SPACING] — distance between section centers
 * @returns {Array<{centerX:number, centerY:number, centerZ:number, halfWidth:number, halfHeight:number, halfDepth:number, title:string}>}
 */
export function computeRegions(sections, spacing = DEFAULT_SPACING) {
  return sections.map((section, i) => {
    const bbox = computeBoundingBox(section.sceneData);
    return {
      centerX: i * spacing, // Linear archetype: linear along X
      centerY: bbox.centerY,
      centerZ: bbox.centerZ,
      halfWidth: bbox.halfWidth,
      halfHeight: bbox.halfHeight,
      halfDepth: bbox.halfDepth,
      title: section.title || `Page ${i + 1}`,
    };
  });
}
