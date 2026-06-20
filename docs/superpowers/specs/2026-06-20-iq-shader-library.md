# IQ shader-technique library (11-wave program)

**Date:** 2026-06-20 · **Status:** complete (W1–W11 shipped)

A comprehensive port of Inigo Quilez's shader/SDF techniques into sdf-js, built
ahead of demand (per user directive — don't gate future capability on today's
needs). Each module ships **JS** (CPU, fully node-tested) **+ a GLSL mirror
string** (shader-side, identical names). All GLSL mirrors compile + link
together in a real WebGL2 context — verified by `scripts/glsl-smoke.html`
(headless, `GLSL-SMOKE-OK all 11 IQ-shader libraries`).

Recipe-only ports ([[recipe-only-port-pattern]]): reimplemented from the math,
credited, no source copied.

## Modules (`src/sdf/`)

| wave | module | exports (GLSL string) | covers |
| --- | --- | --- | --- |
| W1 | `easing.js` | `EASING_GLSL` | remap, smoothstep/smoother, sigmoid, inverse-smoothstep, smoothstep-integral, parabola, pcurve, cubicPulse, expImpulse/Step, gain, sinc, almostIdentity |
| W2 | `noise.js` | `NOISE_GLSL` | value/gradient noise **+ analytic derivatives**, fbm+deriv, domain warping, voronoise, smooth voronoi, voronoi edges |
| W3 | `filter.js` | `FILTER_GLSL` | ray-differential footprint, band-limited checker/grid/stripes/triangle, no-tile, biplanar, gamma sRGB↔linear, premult alpha, improved bilinear |
| W4 | `lighting.js` | `LIGHTING_GLSL` | sphere AO + soft shadow (analytic), fresnel, hemisphere, outdoor 3-light model, better fog |
| W5 | `sdg.js` | `SDG_GLSL` | SDFs returning analytic gradient — circle/box/segment (2D), sphere/box/torus (3D) |
| W6 | `bounds.js` | `BOUNDS_GLSL` | bbox(SDF) + camera-fit (**auto-framing**), sphere projection, AABB bounding volume, L∞ box |
| W7 | `intersect.js` | `INTERSECT_GLSL` | ray–sphere/box/plane/triangle, sphere density, inverse bilinear |
| W8 | `fractal.js` | `FRACTAL_GLSL` | Mandelbrot/Julia (continuous iter), orbit trap, Mandelbulb DE, quaternion Julia DE, Menger, Sierpinski |
| W9 | `effects.js` | `EFFECTS_GLSL` | 2D dynamic clouds, plane deformations, feedback blend, Game of Life |
| W10 | `mathx.js` | `MATHX_GLSL` | quaternions, Fourier square, triangle/polygon area+normal, point-to-triangle distance, sphere UV |
| W11 | `extra.js` | `EXTRA_GLSL` | exact ellipse distance, directional derivative, generic SDF AO, box shadow, Lyapunov exponent |

Tests: `scripts/test-{easing,noise,filter,lighting,sdg,bounds,intersect,fractal,effects,mathx,extra}.mjs`
(category `math` in `run-tests.mjs`). Derivative functions are checked against
finite differences; SDFs against sign/|grad|=1; band-limited patterns against
the w→0/w→∞ limits; fractals against set membership; everything deterministic.

## Out of scope (renderer-integration, not library helpers)

These IQ techniques need an accumulation/feedback framebuffer or depth buffer,
so they belong to a future renderer feature, not a pure-function library:
SSAO, per-vertex AO, multi-resolution AO, full analytic box occlusion,
Budhabrot, popcorn, Lyapunov *fractal image*, IFS point clouds, bitmap orbit
traps, depth-buffer raymarching. Also excluded from the whole program (non-
shader): compression, size-coding, Mandelbrot pure set-math, IK, FM synthesis,
mesh normals/compression, stereo/VR.

## Not yet wired into a renderer

Every module is additive and standalone. A follow-up pass can route existing
renderers through them — e.g. studio's checker → `FILTER_GLSL.checkersFiltered`,
studio auto-framing → `bounds.bbox3FromSDF`/`cameraFitFromBBox`, terrain shading
→ `NOISE_GLSL` derivative noise, new fractal/effect atoms → `FRACTAL_GLSL` /
`EFFECTS_GLSL`. That wiring is intentionally separate from these capability PRs.
