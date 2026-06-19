// =============================================================================
// cube-3d.js — Atlas's first PresentationLoad-style 3D Shape atom.
// -----------------------------------------------------------------------------
// One parameterized atom (19 args, 10 arrangements, 3 materials, 4 connectors,
// 3 label modes) covering ~96 reference slides across 5 PresentationLoad cube
// templates (Cubes Count D1501, Connected D2628, Glass D2431, Buzzword D7031,
// Cubes Count D1501-variant). Reuses existing primitives (all verified shipped 2026-06-19):
//   - rounded_box (d3.js:152, .ast set, GLSL emit registered)
//   - wireframe_box (d3.js:352, .ast set, GLSL emit at sdf3.compile.js:463,
//     GLSL helper sdBoxFrame at sdf3.glsl.js:58, registered in SDF3_GLSL_PRIMITIVES)
//   - capsule (d3.js:54, for connector geometry)
//   - text3dPipeSDF + text3dExtrudedSDF (Wave 1+2 typography, label glyph source)
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

// Mulberry32 — minimal seeded PRNG. Same seed → same sequence.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ARRANGEMENTS = {
  row: (count, cubeSize, spacing) => {
    const stride = cubeSize + spacing;
    const offset = ((count - 1) / 2) * stride;
    const positions = [];
    for (let i = 0; i < count; i++) {
      positions.push([i * stride - offset, 0, 0]);
    }
    return positions;
  },

  flow: (count, cubeSize, spacing) => {
    // flow is row with 1.5× spacing
    return ARRANGEMENTS.row(count, cubeSize, spacing * 1.5);
  },

  stack: (count, cubeSize, spacing) => {
    const stride = cubeSize + spacing;
    const offset = ((count - 1) / 2) * stride;
    const positions = [];
    for (let i = 0; i < count; i++) {
      positions.push([0, i * stride - offset, 0]);
    }
    return positions;
  },

  steps: (count, cubeSize, spacing, params = {}) => {
    const stepHeight = params.stepHeight ?? 0.3;
    const ascending = params.ascending !== false;
    const stride = cubeSize + spacing;
    const offsetX = ((count - 1) / 2) * stride;
    const dir = ascending ? 1 : -1;
    const positions = [];
    for (let i = 0; i < count; i++) {
      positions.push([i * stride - offsetX, i * stepHeight * dir, 0]);
    }
    return positions;
  },

  grid: (count, cubeSize, spacing, params = {}) => {
    const cols = params.cols ?? Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const stride = cubeSize + spacing;
    const offsetX = ((cols - 1) / 2) * stride;
    const offsetZ = ((rows - 1) / 2) * stride;
    const positions = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push([col * stride - offsetX, 0, row * stride - offsetZ]);
    }
    return positions;
  },

  grid3d: (count, cubeSize, spacing, params = {}) => {
    const cols = params.cols ?? 3;
    const rows = params.rows ?? 3;
    const stride = cubeSize + spacing;
    const offsetX = ((cols - 1) / 2) * stride;
    const offsetY = ((rows - 1) / 2) * stride;
    const positions = [];
    for (let i = 0; i < count; i++) {
      const x = i % cols;
      const y = Math.floor(i / cols) % rows;
      const z = Math.floor(i / (cols * rows));
      positions.push([x * stride - offsetX, y * stride - offsetY, z * stride]);
    }
    const maxZ = Math.max(...positions.map((p) => p[2]));
    const offsetZ = maxZ / 2;
    return positions.map((p) => [p[0], p[1], p[2] - offsetZ]);
  },

  semicircle: (count, cubeSize, spacing, params = {}) => {
    const arc = params.arc ?? Math.PI;
    const stride = cubeSize + spacing;
    const radius = (count * stride) / arc;
    const positions = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const theta = -arc / 2 + t * arc;
      positions.push([radius * Math.sin(theta), 0, radius * Math.cos(theta) - radius]);
    }
    const meanZ = positions.reduce((s, p) => s + p[2], 0) / count;
    return positions.map((p) => [p[0], p[1], p[2] - meanZ]);
  },

  'hub-spokes': (count, cubeSize, spacing, params = {}) => {
    const anchorSize = params.anchorSize ?? 1.0;
    const arc = params.arc ?? Math.PI;
    const positions = [[0, 0, 0]];
    if (count <= 1) return positions;
    const radius = 2 * anchorSize;
    for (let i = 1; i < count; i++) {
      const t = count === 2 ? 0.5 : (i - 1) / (count - 2);
      const theta = -arc / 2 + t * arc;
      positions.push([radius * Math.sin(theta), 0, radius * Math.cos(theta)]);
    }
    return positions;
  },

  tower: (count, cubeSize, spacing, params = {}) => {
    const baseRows = params.baseRows ?? 3;
    const baseCols = params.baseCols ?? 3;
    const towerCount = params.towerCount ?? Math.max(0, count - baseRows * baseCols);
    const baseCount = Math.min(count, baseRows * baseCols);
    const stride = cubeSize + spacing;
    const offsetX = ((baseCols - 1) / 2) * stride;
    const offsetZ = ((baseRows - 1) / 2) * stride;
    const positions = [];
    for (let i = 0; i < baseCount; i++) {
      const col = i % baseCols;
      const row = Math.floor(i / baseCols);
      positions.push([col * stride - offsetX, 0, row * stride - offsetZ]);
    }
    const baseTop = cubeSize / 2 + cubeSize / 2;
    for (let i = 0; i < towerCount; i++) {
      positions.push([0, baseTop + i * stride, 0]);
    }
    return positions;
  },

  cluster: (count, cubeSize, spacing, params = {}) => {
    const radius = params.radius ?? 1.5;
    const zJitter = params.zJitter ?? 0.3;
    const seed = params.seed ?? 1;
    const rng = mulberry32(seed);
    const positions = [];
    for (let i = 0; i < count; i++) {
      let u, v, s;
      do {
        u = 2 * rng() - 1;
        v = 2 * rng() - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const factor = 2 * Math.sqrt(1 - s);
      const x = u * factor;
      const y = v * factor;
      const z = 1 - 2 * s;
      const r2 = rng();
      const gauss = Math.sqrt(-2 * Math.log(Math.max(r2, 1e-9))) * Math.cos(2 * Math.PI * rng());
      positions.push([x * radius, y * radius * 0.5, z * radius + gauss * zJitter]);
    }
    return positions;
  },
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
