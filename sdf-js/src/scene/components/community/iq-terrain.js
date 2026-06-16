// =============================================================================
// terrain-heightmap — IQ Elevated-style mountain terrain SDF primitive
// -----------------------------------------------------------------------------
// Inspired by Reinder Nijhoff Himalayas (CC BY-NC-SA, idiom-only port) and
// IQ MdX3Rr "Elevated" (the canonical value-noise + analytical-derivatives
// fbm heightmap). Independent reimplementation — no source copied.
//
// Heightfield-as-SDF (same range as sea-surface). Material auto-attached
// with kind='mountain' so renderer routes shading via the mountain branch
// (snow-line shading + 3-light + slope-AO + height-fog).
//
// Place as a top-level subject. Position via SceneData transform.translate.
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Mountain terrain heightmap atom.
 *
 * @param {object} opts
 * @param {number} [opts.maxHeight=30.0]  Peak Y in world units
 * @param {number} [opts.hwRatio=0.08]    Horizontal-to-vertical scale ratio
 *                                        (smaller = wider mountains; 0.08 ~
 *                                        Himalayas-feel at world scale ~10)
 */
export function terrainHeightmapSDF({ maxHeight = 30.0, hwRatio = 0.08 } = {}) {
  const inst = SDF3((p) => {
    // CPU stub: just a sloped plane at y=0 (real eval is GPU-only because
    // 7-octave fbm per sample is too expensive for CPU raymarch fallback).
    return (p[1] - Math.sin(p[0] * 0.1) * maxHeight * 0.1) * 0.6;
  });

  inst.ast = { kind: 'prim', name: 'terrain-heightmap', args: [maxHeight, hwRatio] };
  return inst;
}

export const terrainHeightmapSpec = {
  type: 'terrain-heightmap',
  category: 'primitive-heightfield',
  args: {
    maxHeight: { type: 'number', default: 30.0, doc: 'Peak Y in world units' },
    hwRatio: { type: 'number', default: 0.08, doc: 'Horizontal-to-vertical scale ratio' },
  },
  source: {
    inspiration: 'Reinder Nijhoff Himalayas Shadertoy (CC BY-NC-SA, idiom-only)',
    algorithmRef: 'IQ MdX3Rr "Elevated" (value noise + analytical derivatives)',
    license: 'PolyForm Noncommercial 1.0.0 (independent reimplementation)',
    portedAt: '2026-05-21',
    porter: 'Atlas /port-shader pipeline — snow-mountain sprint',
    notes:
      'GPU evaluates 7-octave fbm; renderer mountain-shading branch uses 15-octave for normal.',
  },
};
