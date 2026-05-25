// =============================================================================
// terrain-elevated — Kolaczynski-style sharp alpine terrain SDF primitive
// -----------------------------------------------------------------------------
// Inspired by Kamil Kolaczynski's MttGz4 terrain.glsl (CC BY-NC-SA 3.0,
// recipe-only port — no source copied) which itself builds on IQ's MdX3Rr
// "Elevated" (canonical value-noise + analytical-derivatives fbm).
//
// Differs from `terrain-heightmap` (Atlas's existing terrain primitive) by:
//   1. Ridge sharpening via pow(f, ridgePower) — alpine peaks vs rolling hills
//   2. Mountain mask via low-frequency noise — sparse peaks rising from flat
//      lowlands rather than uniform corduroy ripples
//   3. Hole carving on lowlands for subtle valley relief
//
// Heightfield-as-SDF. Material auto-attached with kind='mountain' so the
// renderer routes shading via the mountain branch (layered rock/ground/grass/
// snow by altitude + normal — see flyLambert).
//
// Tuning notes:
//   ridgePower 1.0 = soft fbm hills (similar to atlasTerrainHeight)
//   ridgePower 2-3 = sharp alpine peaks (MttGz4 / Elevated look)
//   mountainness 0.55 = scattered peaks, 0.35 = continuous mountain range
//   scale 0.005 = continent-sized features, 0.02 = village-sized
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

export function terrainElevatedSDF({
  maxHeight    = 60.0,
  scale        = 0.012,
  ridgePower   = 2.4,
  mountainness = 0.4,
  // 2026-05-25: IQ Rainforest cliff injection. Defaults disable (cliffJump=0).
  cliffStart   = 600.0,
  cliffEnd     = 600.0,
  cliffJump    = 0.0,
  // 2026-05-25: IQ Rainforest tree canopy bumps. Default disable (canopyAmount=0).
  canopyAmount = 0.0,
} = {}) {
  const inst = SDF3((p) => {
    // CPU stub: cheap sloped plane (real eval is GPU-only; 6-octave fbm × ridge
    // pow × mask is too expensive for CPU raymarch fallback).
    return (p[1] - Math.sin(p[0] * scale) * Math.cos(p[2] * scale) * maxHeight * 0.3) * 0.5;
  });
  inst.ast = {
    kind: 'prim',
    name: 'terrain-elevated',
    args: [maxHeight, scale, ridgePower, mountainness, cliffStart, cliffEnd, cliffJump, canopyAmount],
  };
  return inst;
}

export const terrainElevatedSpec = {
  type: 'terrain-elevated',
  category: 'primitive-heightfield',
  args: {
    maxHeight:    { type: 'number', default: 60.0, doc: 'Peak Y in world units' },
    scale:        { type: 'number', default: 0.012, doc: 'Horizontal scale (smaller = wider features)' },
    ridgePower:   { type: 'number', default: 2.4, doc: 'Peak sharpness (1=soft hills, 3=alpine)' },
    mountainness: { type: 'number', default: 0.4, doc: 'Fraction of area covered by mountains (0-1)' },
  },
  source: {
    inspiration:  'Kolaczynski MttGz4 terrain.glsl (CC BY-NC-SA, recipe-only)',
    algorithmRef: 'IQ MdX3Rr "Elevated" + ridge-pow extension',
    license:      'PolyForm Noncommercial 1.0.0 (independent reimplementation)',
    portedAt:     '2026-05-24',
    porter:       'Atlas Sprint A1 — jet aircraft terrain upgrade',
    notes:        'GPU evaluates 6-octave fbm + pow ridge + mountain mask. ' +
                  'CPU stub is a cheap sin*cos plane (GPU-only primitive for raymarch use).',
  },
};
