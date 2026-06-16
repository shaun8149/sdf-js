// =============================================================================
// sea-surface — open-ocean heightfield SDF primitive
// -----------------------------------------------------------------------------
// Inspired by afl_ext's Shadertoy "Ocean" (MIT, 2017-2024). Independent
// implementation — keeps the wave-drag idiom and exp(sin(x)-1) wave shape but
// reimplemented for Atlas's SDF3 + FLY 3D shading pipeline. GPU path emits
// sdSeaSurface() declared in sdf3.glsl.js; the JS path returns a cheap
// approximation (no iterative noise) so silhouette / CPU raymarchers still
// see *something* at this surface — only the GPU renders the real waves.
//
// Hit pixels in FLY 3D's shader are recognised by their leaf material kind
// and routed to a sea-specific shading branch (fresnel reflection of sky +
// subsurface scattering + sun glint + ACES tonemap globally).
//
// Source inspiration: https://www.shadertoy.com/view/Ms2SD1 (afl_ext, MIT)
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Sea-surface SDF — heightfield-as-SDF. JS-side returns a cheap distance
 * approximation (sphere-trace works but won't see real waves); GPU emits the
 * full iterative wave summation via sdSeaSurface() in sdf3.glsl.js.
 *
 * Wave height ranges roughly y ∈ [-depth, 0] with crests up to ~0.4×depth
 * above the high plane on choppy seas.
 *
 * @param {object} opts
 * @param {number} [opts.depth=1.0]   Wave amplitude scale. Larger = taller waves.
 * @param {number} [opts.scale=0.6]   Horizontal frequency scale. Larger = shorter waves (chop).
 */
export function seaSurfaceSDF({ depth = 1.0, scale = 0.6 } = {}) {
  const inst = SDF3((p) => {
    // Cheap approximation: a sloped plane at y=0 with low-frequency sinusoidal
    // displacement. Used only when something runs the SDF on the CPU (e.g.
    // BOB raymarcher fallback / silhouette debugging). Real GPU path is in
    // sdSeaSurface() GLSL and ignores this entirely.
    const cheapH = Math.sin(p[0] * 0.5 + p[2] * 0.3) * 0.1 * depth;
    return (p[1] - cheapH) * 0.5;
  });

  inst.ast = { kind: 'prim', name: 'sea-surface', args: [depth, scale] };
  return inst;
}

export const seaSurfaceSpec = {
  type: 'sea-surface',
  category: 'primitive-heightfield',
  args: {
    depth: { type: 'number', default: 1.0, doc: 'Wave amplitude / depth in world units' },
    scale: {
      type: 'number',
      default: 0.6,
      doc: 'Horizontal wave frequency scale (bigger = choppier)',
    },
  },
  source: {
    inspiration: 'https://www.shadertoy.com/view/Ms2SD1',
    originalAuthor: 'afl_ext',
    license: 'MIT (independent reimplementation, retains idiom only)',
    portedAt: '2026-05-21',
    porter: 'Atlas /port-shader pipeline — second port',
    notes:
      'GPU path is the real implementation; JS-side is a cheap approximation for CPU fallback paths.',
  },
  thumbnail: null,
};
