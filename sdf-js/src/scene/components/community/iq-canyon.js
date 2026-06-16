// =============================================================================
// terrain-canyon — IQ Canyon-style sandstone canyon terrain SDF primitive
// -----------------------------------------------------------------------------
// Recipe-only port of IQ Canyon XdsXDS terrain map (CC educational license,
// IQ explicit no-port/no-AI-train terms — Atlas independently reimplements
// from scratch with our own helpers + parameter names + no source copied).
//
// The KEY idiom this primitive adds beyond terrain-elevated: a 3D fbm overlay
// with **Y-axis frequency stretch** (typical 4×). Stretching Y by 4× before
// passing into 3D noise causes horizontal noise bands to map to VERTICAL wall
// striations on cliffs — the signature look of red sandstone canyons (Bryce /
// Zion / Antelope Canyon). Plain heightmap terrain (terrain-elevated) gives
// smooth alpine peaks; this adds the 3D crag detail that makes canyon walls.
//
// Material auto-attached with kind='mountain' and a red-orange hue tint so
// the upgraded mountain branch (which now respects material hue/sat on rock)
// renders as sandstone instead of gray rock.
//
// vs terrain-elevated:
//   terrain-elevated = sharp alpine peaks rising from flat lowlands
//   terrain-canyon   = sandstone cliffs with vertical wall striations + crags
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

export function terrainCanyonSDF({
  maxHeight = 35.0,
  scale = 0.015,
  ridgePower = 2.0,
  mountainness = 0.2,
  displaceAmt = 4.0,
  yStretch = 4.0,
} = {}) {
  const inst = SDF3((p) => {
    // CPU stub: cheap sloped plane (real eval is GPU-only because
    // displacement adds 3-octave 3D fbm per sample on top of terrain fbm).
    return (p[1] - Math.sin(p[0] * scale) * Math.cos(p[2] * scale) * maxHeight * 0.3) * 0.5;
  });
  inst.ast = {
    kind: 'prim',
    name: 'terrain-canyon',
    args: [maxHeight, scale, ridgePower, mountainness, displaceAmt, yStretch],
  };
  return inst;
}

export const terrainCanyonSpec = {
  type: 'terrain-canyon',
  category: 'primitive-heightfield',
  args: {
    maxHeight: { type: 'number', default: 35.0, doc: 'Peak Y in world units' },
    scale: { type: 'number', default: 0.015, doc: 'Horizontal terrain scale' },
    ridgePower: { type: 'number', default: 2.0, doc: 'Peak sharpness (1=soft, 3=sharp)' },
    mountainness: { type: 'number', default: 0.2, doc: 'Fraction of land area covered by cliffs' },
    displaceAmt: {
      type: 'number',
      default: 4.0,
      doc: '3D displacement amplitude (3-8 for canyon)',
    },
    yStretch: {
      type: 'number',
      default: 4.0,
      doc: 'Y multiplier on displacement noise (4=vertical striations)',
    },
  },
  source: {
    inspiration: 'IQ Canyon XdsXDS map() function (CC educational, recipe-only)',
    algorithmRef: 'heightmap fbm + 3D displacement overlay with Y-axis frequency stretch',
    license: 'PolyForm Noncommercial 1.0.0 (independent reimplementation, no source copied)',
    portedAt: '2026-05-24',
    porter: 'Atlas canyon sprint — third terrain primitive after elevated + with-lakes',
    notes:
      'GPU-only. Pair with mountain material kind + red-orange hue for sandstone look. ' +
      'Y-stretch 4× is the secret to vertical wall striations.',
  },
};
