// =============================================================================
// cube-3d.js — Atlas's first PresentationLoad-style 3D Shape atom.
// -----------------------------------------------------------------------------
// One parameterized atom (19 args, 10 arrangements, 3 materials, 4 connectors,
// 3 label modes) covering ~96 reference slides across 5 PresentationLoad cube
// templates (Cubes Count D1501, Connected D2628, Glass D2431, Buzzword D7031,
// Cubes Count D1501-variant). Reuses existing rounded_box + wireframe_box
// primitives (verified shipped in d3.js); delegates label glyphs to existing
// text3dPipeSDF / text3dExtrudedSDF (Wave 1+2 typography).
//
// Auto-color: when caller passes empty colors[], each cube gets a float id
// (i * 1.7 + 13.0) → IQ shadertoy formula 0.2 + 0.2*sin(id*2 + vec3(0,1,2))
// yields a harmonious rainbow without user effort.
//
// Spec: docs/superpowers/specs/2026-06-19-cube-3d-design.md
// =============================================================================

import { rounded_box, wireframe_box, capsule } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';
import { text3dPipeSDF, text3dExtrudedSDF } from '../typography/text-3d.js';

// ---- Arrangements -----------------------------------------------------------
// Each arrangement returns an array of cube positions [x, y, z] for indices
// 0..count-1. All centered around origin.

export const ARRANGEMENTS = {
  // [Implemented in Phase 2 tasks 2.2-2.10]
};

// ---- Auto-color -------------------------------------------------------------

/**
 * IQ shadertoy "Raymarching - Primitives" per-id color formula. Given a float
 * material id, yields a harmonious RGB triple in [0,1].
 * Reference: https://www.shadertoy.com/view/Xds3zN (render function).
 */
export function autoColor(id) {
  const r = 0.2 + 0.2 * Math.sin(id * 2.0 + 0.0);
  const g = 0.2 + 0.2 * Math.sin(id * 2.0 + 1.0);
  const b = 0.2 + 0.2 * Math.sin(id * 2.0 + 2.0);
  return [r, g, b];
}

/**
 * Convert an integer cube index into the float material id passed to autoColor.
 * Spaced via 1.7 + 13.0 offset so adjacent cubes get visibly different hues.
 */
export function cubeAutoId(i) {
  return i * 1.7 + 13.0;
}

// ---- Main API ---------------------------------------------------------------

/**
 * Build a cube-3d SDF tree. See spec for full args reference.
 * Returns SDF3 (or null if count <= 0).
 */
export function cube3dSDF({
  count = 5,
  arrangement = 'row',
  cubeSize = 0.6,
  cornerRadius = 0.04,
  spacing = 0.2,
  arrangementParams = {},
  labels = [],
  labelsByFace = null,
  labelOnAllFaces = false,
  labelMaterial = 'pipe',
  labelScale = 0.6,
  material = 'solid',
  colors = [],
  connector = 'none',
  connectorThickness = 0.04,
  connectorIndices = null,
  cubeSizes = null,
  cubeRotations = null,
  cubeOffsets = null,
} = {}) {
  // [Implemented in Phase 3+]
  return null;
}

// ---- Spec (for compile.js validation + lift prompt) -------------------------

export const cube3dSpec = {
  type: 'cube-3d',
  category: 'shapes',
  args: {
    count: { type: 'number', default: 5 },
    arrangement: {
      type: 'enum',
      values: [
        'row',
        'flow',
        'semicircle',
        'hub-spokes',
        'steps',
        'stack',
        'tower',
        'grid',
        'grid3d',
        'cluster',
      ],
      default: 'row',
    },
    cubeSize: { type: 'number', default: 0.6 },
    cornerRadius: { type: 'number', default: 0.04 },
    spacing: { type: 'number', default: 0.2 },
    arrangementParams: { type: 'object', default: {} },
    labels: { type: 'array', default: [] },
    labelsByFace: { type: 'array', default: null },
    labelOnAllFaces: { type: 'boolean', default: false },
    labelMaterial: { type: 'enum', values: ['pipe', 'extruded'], default: 'pipe' },
    labelScale: { type: 'number', default: 0.6 },
    material: { type: 'enum', values: ['solid', 'wireframe', 'glass'], default: 'solid' },
    colors: { type: 'array', default: [] },
    connector: {
      type: 'enum',
      values: ['none', 'pipe-through', 'pipe-vertical', 'spokes'],
      default: 'none',
    },
    connectorThickness: { type: 'number', default: 0.04 },
    connectorIndices: { type: 'array', default: null },
    cubeSizes: { type: 'array', default: null },
    cubeRotations: { type: 'array', default: null },
    cubeOffsets: { type: 'array', default: null },
  },
  source: { type: 'first-party' },
};
