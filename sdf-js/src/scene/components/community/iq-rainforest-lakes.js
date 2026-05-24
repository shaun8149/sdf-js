// =============================================================================
// terrain-with-lakes — IQ Rainforest-style terrain with carved lake pockets
// -----------------------------------------------------------------------------
// Recipe-only port of IQ MdX3Rr "Rainforest" envelope() idiom (CC educational
// license, IQ explicit no-port/no-AI-train terms — Atlas reimplements the
// idiom from scratch with our own building blocks).
//
// The clever bit: a low-frequency lake mask noise carves flat lake-floor
// pockets into the existing elevated-terrain equation. Lakes are PART of
// the terrain heightfield (continuous Lipschitz), not a separate water plane,
// so mountain ridges + valleys form naturally around them. Caller can add
// a `waves` primitive at the same waterLevel Y to get the actual water
// surface above the carved lake floors.
//
// Heightfield-as-SDF. Material auto-attached with kind='mountain' (4-layer
// rock/ground/grass/snow shading still applies — but lake bottoms appear as
// flat dark ground layer at low altitude). Pair with waves primitive at
// y=waterLevel for the actual water surface.
//
// vs terrain-elevated:
//   terrain-elevated  = sharp peaks rising from flat lowlands
//   terrain-with-lakes = lake-pocked landscape, continuous ridges between
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

export function terrainWithLakesSDF({
  maxHeight    = 60.0,
  scale        = 0.012,
  ridgePower   = 2.4,
  mountainness = 0.4,
  waterLevel   = 0.0,
  lakeScale    = 0.0008,
  lakeAmount   = 0.30,
} = {}) {
  const inst = SDF3((p) => {
    // CPU stub — same approximation as terrain-elevated (real eval is GPU
    // because 8-octave fbm + lake mask is too expensive for CPU raymarch).
    return (p[1] - Math.sin(p[0] * scale) * Math.cos(p[2] * scale) * maxHeight * 0.3) * 0.5;
  });
  inst.ast = {
    kind: 'prim',
    name: 'terrain-with-lakes',
    args: [maxHeight, scale, ridgePower, mountainness, waterLevel, lakeScale, lakeAmount],
  };
  return inst;
}

export const terrainWithLakesSpec = {
  type: 'terrain-with-lakes',
  category: 'primitive-heightfield',
  args: {
    maxHeight:    { type: 'number', default: 60.0,   doc: 'Peak Y in world units' },
    scale:        { type: 'number', default: 0.012,  doc: 'Horizontal terrain scale' },
    ridgePower:   { type: 'number', default: 2.4,    doc: 'Peak sharpness (1=soft hills, 3=alpine)' },
    mountainness: { type: 'number', default: 0.4,    doc: 'Fraction of land area covered by mountains' },
    waterLevel:   { type: 'number', default: 0.0,    doc: 'Y coordinate of lake floors (place water plane at same Y)' },
    lakeScale:    { type: 'number', default: 0.0008, doc: 'Horizontal lake-mask freq (smaller = bigger lakes)' },
    lakeAmount:   { type: 'number', default: 0.30,   doc: 'Fraction of surface area occupied by lakes (0-1)' },
  },
  source: {
    inspiration:  'IQ MdX3Rr "Rainforest" envelope() (CC educational, recipe-only port)',
    algorithmRef: 'IQ derivative-damped fbm + lake-mask multiplicative carve',
    license:      'PolyForm Noncommercial 1.0.0 (independent reimplementation, no source copied)',
    portedAt:     '2026-05-24',
    porter:       'Atlas terrain upgrade sprint — IQ Elevated + Rainforest study',
    notes:        'GPU evaluates 8-octave terrain fbm + 1 lake mask lookup per sample. ' +
                  'Pair with `waves` primitive at y=waterLevel for actual water surface.',
  },
};
