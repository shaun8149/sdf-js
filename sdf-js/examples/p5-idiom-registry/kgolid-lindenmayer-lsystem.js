/**
 * Lindenmayer L-System (string-rewriting fractal plant via turtle graphics)
 *
 * Source: Kjetil Midtgarden Golid (kgolid),
 *   https://github.com/kgolid/p5ycho/tree/master/lindenmayer — MIT-implicit
 * Atlas adaptation: 2026-06-21 — recipe-only port, pure-JS (no P5 dep). Builds
 *   L-string via rule expansion + walks with deterministic turtle to produce
 *   line segments. Returns segments for caller to draw.
 *
 * What it does
 * ------------
 * L-system: start with an "axiom" string, repeatedly substitute symbols via
 * production rules. E.g., axiom 'F' + rule 'F' → 'FF[+F][--FF][-F+F]' after 4
 * generations produces an exponentially-growing string. Then walk the string
 * with turtle graphics:
 *   - 'F' = move forward + draw line
 *   - '+' = rotate +angle
 *   - '-' = rotate -angle
 *   - '[' = push state (position + heading)
 *   - ']' = pop state
 * Result: organic fractal plant / tree / coral.
 *
 * 4 classic rules from p5ycho/lindenmayer (Moussa's defaults):
 *   r1: 'FF[+F][--FF][-F+F]'   — balanced branching
 *   r2: 'F[++F[-F]]F[-FF[F]]'  — asymmetric reaches
 *   r3: 'F[-FF[+F]]F[+F[+F]]'  — symmetric tree
 *   r4: 'F[-F[-F++F]][+F[--F]]F' — wider canopy
 *
 * Atlas use case
 * --------------
 * Decorative fractal plant / tree motifs:
 *   - Branding ornament (organic stamp on KPI hero)
 *   - "Growth" content visualization with metaphor (sales → tree growth)
 *   - Section divider / page ornament
 *   - Background filler (low opacity tree silhouettes)
 *
 * Pairs with kgolid-chromotome-palettes (color depth-by-depth) and
 * moussa-hooke-brush-stroke (hand-drawn branches).
 *
 * Signature
 * ---------
 *   lSystemSegments(opts) → Array<{x1,y1,x2,y2,depth}>
 *
 *   opts = {
 *     axiom: 'F',
 *     rule: 'FF[+F][--FF][-F+F]',   — production for 'F'
 *     generations: 4,                — string rewrite iterations
 *     extension: 100,                — initial step distance (halves per gen)
 *     extensionChaos: 0,             — random variance in step (0-1)
 *     angle: Math.PI / 10,           — turn angle in radians
 *     angleChaos: 0,                 — random variance in angle (0-1)
 *     startX: 300, startY: 360,      — turtle start position
 *     startHeading: -Math.PI / 2,    — initial direction (straight up by default)
 *     seed: 1,                       — deterministic randomness
 *   }
 *
 * Inside-iframe usage:
 *   const segs = lSystemSegments({
 *     rule: 'FF[+F][--FF][-F+F]', generations: 4,
 *     extension: 200, extensionChaos: 0.3,
 *     angle: Math.PI / 10, angleChaos: 0.4,
 *     startX: 300, startY: 350,
 *     seed: 7,
 *   });
 *   const fg = window.__brandingPalette.silhouetteColor;
 *   stroke(fg[0], fg[1], fg[2], 80); strokeWeight(1);
 *   for (const s of segs) line(s.x1, s.y1, s.x2, s.y2);
 *
 * Test: scripts/test-p5-idiom-registry.mjs
 */

function _seededRand(seed) {
  let s = seed | 0 || 1;
  return function () {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function lSystemSegments(opts = {}) {
  const axiom = opts.axiom ?? 'F';
  const rule = opts.rule ?? 'FF[+F][--FF][-F+F]';
  const generations = opts.generations ?? 4;
  const extension = opts.extension ?? 100;
  const extensionChaos = opts.extensionChaos ?? 0;
  const angle = opts.angle ?? Math.PI / 10;
  const angleChaos = opts.angleChaos ?? 0;
  const startX = opts.startX ?? 300;
  const startY = opts.startY ?? 360;
  const startHeading = opts.startHeading ?? -Math.PI / 2;
  const seed = opts.seed ?? 1;

  // String rewriting — substitute 'F' with rule each generation
  let sentence = axiom;
  for (let g = 0; g < generations; g++) {
    let next = '';
    for (const c of sentence) {
      next += c === 'F' ? rule : c;
    }
    sentence = next;
  }

  // Turtle walk
  const rand = _seededRand(seed);
  const segments = [];
  let x = startX;
  let y = startY;
  let heading = startHeading;
  let depth = 0;
  const stack = [];
  const currentExtension = extension * Math.pow(0.5, generations);

  for (const c of sentence) {
    if (c === 'F') {
      const ext = currentExtension * (1 + (rand() * 2 - 1) * extensionChaos);
      const newX = x + Math.cos(heading) * ext;
      const newY = y + Math.sin(heading) * ext;
      segments.push({ x1: x, y1: y, x2: newX, y2: newY, depth });
      x = newX;
      y = newY;
    } else if (c === '+') {
      const ang = angle * (1 + (rand() * 2 - 1) * angleChaos);
      heading -= ang;
    } else if (c === '-') {
      const ang = angle * (1 + (rand() * 2 - 1) * angleChaos);
      heading += ang;
    } else if (c === '[') {
      stack.push({ x, y, heading, depth });
      depth++;
    } else if (c === ']') {
      const s = stack.pop();
      if (s) {
        x = s.x;
        y = s.y;
        heading = s.heading;
        depth = s.depth;
      }
    }
  }

  return segments;
}

// Convenience: 4 classic rules from Moussa's defaults
const LSYSTEM_PRESETS = {
  balanced: 'FF[+F][--FF][-F+F]', // r1
  asymmetric: 'F[++F[-F]]F[-FF[F]]', // r2
  symmetric: 'F[-FF[+F]]F[+F[+F]]', // r3
  wide_canopy: 'F[-F[-F++F]][+F[--F]]F', // r4
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { lSystemSegments, LSYSTEM_PRESETS };
}
if (typeof window !== 'undefined') {
  window.lSystemSegments = lSystemSegments;
  window.LSYSTEM_PRESETS = LSYSTEM_PRESETS;
}
