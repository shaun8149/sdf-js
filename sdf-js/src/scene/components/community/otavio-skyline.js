// =============================================================================
// procedural-city — Otavio Good Skyline-style infinite procedural city SDF
// -----------------------------------------------------------------------------
// Recipe port of Otavio Good's "Skyline" Shadertoy (CC0 public domain — no
// license restriction). Per-block skyscrapers tiled across infinite XZ plane;
// each block gets a deterministic random building from hash(blockId).
//
// Key features:
//   - Infinite extent (raymarch evaluates per-block on demand)
//   - Downtown bias (buildings near origin are taller)
//   - Per-block style variety (dome / cylinder / second-section)
//   - Window-aligned floor quantization
//   - Ground plane at y=0 (roads)
//
// CRITICAL — voxel-walk required: The SDF is DISCONTINUOUS at block boundaries.
// flyLambert raymarch automatically enables voxel-walk clamping when scene
// contains a procedural-city primitive (via u_cityActive uniform). Sphere
// trace alone would overshoot block boundaries.
//
// Auto-attached material kind='building' so window grid + sky reflection
// shading branch is used (see flyLambert kind=6 branch).
//
// Place at world origin recommended (block grid is world-axis-aligned).
// Custom translate works but block boundaries shift accordingly.
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

export function proceduralCitySDF({
  blockSize  = 1.0,
  maxHeight  = 18.0,
  downtownK  = 4.0,
} = {}) {
  const inst = SDF3((p) => {
    // CPU stub: cheap approximation — just a sloped plane (real SDF requires
    // 8+ hash + 3+ sdBox per block, too expensive for CPU raymarch fallback).
    return p[1] * 0.5;
  });
  inst.ast = {
    kind: 'prim',
    name: 'procedural-city',
    args: [blockSize, maxHeight, downtownK],
  };
  return inst;
}

export const proceduralCitySpec = {
  type: 'procedural-city',
  category: 'primitive-procedural-scene',
  args: {
    blockSize: { type: 'number', default: 1.0,  doc: 'XZ tile size per block (1 world unit typical)' },
    maxHeight: { type: 'number', default: 18.0, doc: 'Peak skyscraper height in world units' },
    downtownK: { type: 'number', default: 4.0,  doc: 'Center-bias strength (larger = more concentrated downtown)' },
  },
  source: {
    inspiration:  'Otavio Good Skyline (CC0 public domain Shadertoy)',
    algorithmRef: 'per-block fract/floor SDF + hash randomization + downtown bias + window-floor quantization',
    license:      'PolyForm Noncommercial 1.0.0 (Atlas reimplementation; source is CC0 so technically copy-allowed)',
    portedAt:     '2026-05-25',
    porter:       'Atlas Sprint A7 — first procedural-scene primitive (city)',
    notes:        'GPU-only. Requires u_cityActive uniform set by renderer for voxel-walk raymarch ' +
                  '(otherwise sphere trace overshoots discontinuous block boundaries). Auto-attach ' +
                  "material kind='building' for window grid + sky reflection.",
  },
};
