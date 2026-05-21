// =============================================================================
// canal-building — Venice-style procedural building atom
// -----------------------------------------------------------------------------
// Box shell with window grid recesses carved into all 4 vertical facades.
// Designed to compose with the `curve` DomainGroup so rows of buildings can
// snake along a sinuous canal path (the Venice idiom: x += amp*sin(z*freq)).
//
// Square footprint (width × width). Building rises from y=0 to y=2*height.
// Position via SceneData transform.translate.
//
// GPU path: emits sdCanalBuilding() declared in sdf3.glsl.js (real procedural
// windows via SDF subtraction).
// JS path: cheap approximation (just a box, no window detail) — only used by
// CPU silhouette renderer and BOB raymarcher fallback paths.
//
// Source inspiration: a Venice-canal-at-night Shadertoy (no license; idiom-only
// port). The "windows as modulated SDF cutouts" pattern is generic — works for
// any rectangular structure with regular fenestration (offices, apartments,
// warehouses, parking garages).
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Canal building atom.
 *
 * @param {object} opts
 * @param {number} [opts.width=2.0]   Half-extent on X and Z (footprint = 2w × 2w)
 * @param {number} [opts.height=6.0]  Half-extent on Y (total height = 2h, base at y=0)
 * @param {number} [opts.winX=5]      Window count along facade X axis
 * @param {number} [opts.winY=8]      Window count along facade Y axis
 */
export function canalBuildingSDF({
  width = 2.0,
  height = 6.0,
  winX = 5,
  winY = 8,
} = {}) {
  const inst = SDF3((p) => {
    // Cheap CPU approximation: just the building shell (no windows). GPU
    // path computes the real thing via sdCanalBuilding GLSL helper.
    const py = p[1] - height;
    const dx = Math.abs(p[0]) - width;
    const dy = Math.abs(py) - height;
    const dz = Math.abs(p[2]) - width;
    const inside = Math.min(Math.max(dx, Math.max(dy, dz)), 0);
    const outside = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2 + Math.max(dz, 0) ** 2);
    return inside + outside;
  });

  inst.ast = { kind: 'prim', name: 'canal-building', args: [width, height, winX, winY] };
  return inst;
}

/**
 * Canal-windows atom — thin glow planes at window centres.
 * Composes in the SAME position as a canal-building with matching args.
 * Carry a glow material for emissive shading.
 *
 * @param {object} opts
 * @param {number} [opts.width=2.0]
 * @param {number} [opts.height=6.0]
 * @param {number} [opts.winX=5]
 * @param {number} [opts.winY=8]
 * @param {number} [opts.density=0.4]  Fraction of windows lit (0..1)
 * @param {number} [opts.seed=1.0]     Hash seed for per-window lit roulette
 */
export function canalWindowsSDF({
  width = 2.0, height = 6.0,
  winX = 5, winY = 8,
  density = 0.4, seed = 1.0,
} = {}) {
  const inst = SDF3((p) => {
    // CPU stub: just an empty SDF — glow planes are GPU-only.
    return 1e3;
  });
  inst.ast = { kind: 'prim', name: 'canal-windows', args: [width, height, winX, winY, density, seed] };
  return inst;
}

/**
 * Canal-bridge atom — stone arch spanning the canal.
 *
 * @param {object} opts
 * @param {number} [opts.span=8.0]       Bridge length along X (canal width)
 * @param {number} [opts.archR=1.6]      Arch radius (cuts through bridge body)
 * @param {number} [opts.thickness=1.2]  Bridge width along Z (walkway)
 */
export function canalBridgeSDF({
  span = 8.0, archR = 1.6, thickness = 1.2,
} = {}) {
  const inst = SDF3((p) => {
    // CPU shell stub — bridge box without arch (GPU does the real subtraction).
    const halfY = archR;
    const py = p[1] - halfY;
    const dx = Math.abs(p[0]) - span * 0.5;
    const dy = Math.abs(py) - halfY;
    const dz = Math.abs(p[2]) - thickness * 0.5;
    const inside = Math.min(Math.max(dx, Math.max(dy, dz)), 0);
    const outside = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2 + Math.max(dz, 0) ** 2);
    return inside + outside;
  });
  inst.ast = { kind: 'prim', name: 'canal-bridge', args: [span, archR, thickness] };
  return inst;
}

export const canalWindowsSpec = {
  type: 'canal-windows',
  category: 'primitive-architectural',
  args: {
    width:   { type: 'number', default: 2.0 },
    height:  { type: 'number', default: 6.0 },
    winX:    { type: 'number', default: 5 },
    winY:    { type: 'number', default: 8 },
    density: { type: 'number', default: 0.4, doc: 'Fraction of windows lit (0..1)' },
    seed:    { type: 'number', default: 1.0, doc: 'Hash seed for lit/dark roulette' },
  },
  source: {
    inspiration: 'Venice canal Shadertoy — lit-window randomness idiom',
    license:     'PolyForm Noncommercial 1.0.0',
    portedAt:    '2026-05-21',
  },
};

export const canalBridgeSpec = {
  type: 'canal-bridge',
  category: 'primitive-architectural',
  args: {
    span:      { type: 'number', default: 8.0 },
    archR:     { type: 'number', default: 1.6 },
    thickness: { type: 'number', default: 1.2 },
  },
  source: {
    inspiration: 'Venice canal Shadertoy — bridge = (box ∪ tri-prism) - cylinder',
    license:     'PolyForm Noncommercial 1.0.0',
    portedAt:    '2026-05-21',
  },
};

export const canalBuildingSpec = {
  type: 'canal-building',
  category: 'primitive-architectural',
  args: {
    width:  { type: 'number', default: 2.0, doc: 'Footprint half-width on X/Z (square base)' },
    height: { type: 'number', default: 6.0, doc: 'Half-height on Y; total height = 2*height' },
    winX:   { type: 'number', default: 5,   doc: 'Window count per facade horizontal' },
    winY:   { type: 'number', default: 8,   doc: 'Window count per facade vertical' },
  },
  source: {
    inspiration:    'Venice canal Shadertoy (no license; idiom-only)',
    license:        'PolyForm Noncommercial 1.0.0 (independent reimplementation)',
    portedAt:       '2026-05-21',
    porter:         'Atlas /port-shader pipeline — canal sprint Day 1',
    notes:          'GPU emits real procedural windows; JS-side stub is shell-only.',
  },
  thumbnail: null,
};
