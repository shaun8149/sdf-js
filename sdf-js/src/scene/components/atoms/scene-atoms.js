// =============================================================================
// Atlas scene atoms — high-semantic-level components composed from primitives
// -----------------------------------------------------------------------------
// These are NOT new SDF primitive functions — they are PARAMETERIZED COMPOSITIONS
// of existing primitives (Atlas core + IQ community ports). Their value: the
// LLM-lift system prompt can `type: "tree-pine"` (one token) instead of
// hand-rolling { union: [trunk-cylinder, cone-foliage-1, cone-foliage-2, ...] }
// every time.
//
// Each function returns an SDF3 instance directly via standard composition.
// The GLSL compiler walks the tree automatically — no new helper functions
// needed in sdf3.glsl.js.
//
// These cover the gaps the 8-demo lift run identified:
//   lighthouse → missing moon, stars
//   village    → uses 5+ box-pyramid pairs that could be `cottage`
//   carrier    → uses { box wall + pyramid roof } as island, could be `cottage`
//                missing flag-on-pole
//   bicycle    → no use here, but composite future
//   any sky    → cloud puffs
// =============================================================================

import {
  sphere,
  box,
  cylinder,
  capsule,
  ellipsoid,
  cone,
  octahedron,
  pyramid,
} from '../../../sdf/d3.js';
import { dilate, unionRound, unionChamfer, unionSoft } from '../../../sdf/dn.js';

// =============================================================================
// Atom composition uses hg_sdf boolean variants where it gives a clear visual
// upgrade vs plain `union`. Pattern:
//   unionSoft r=0.1-0.15  — cubic-smooth blend (clouds, organic foliage)
//   unionRound r=0.005-0.02 — quarter-circle fillet (welded metal seams, organic
//                              soft joints — body-to-wing, trunk-to-foliage)
//   unionChamfer r=0.02-0.04 — 45° flat bevel (cut stone, carved wood, beveled
//                               architectural eaves)
//
// These small radii are intentionally SUBTLE — the variant should add a quiet
// "this looks handcrafted, not minecraft" finish, not dominate the geometry.
// =============================================================================

// ---- Sky atoms -------------------------------------------------------------

/**
 * Moon — a sphere. Trivial wrapper, but having it as a named type lets the
 * lift LLM emit `type: "moon"` instead of `type: "sphere"` + a random region
 * name. Color / palette is the renderer's job; the SDF is just a sphere.
 *
 * @param {number} [opts.radius=0.4]
 */
export function moonSDF({ radius = 0.4 } = {}) {
  return sphere(radius);
}

/**
 * Star — small octahedron giving 6-point spike silhouette, or sphere for soft
 * dot. Defaults to octahedron for distinctiveness in scenes.
 *
 * @param {number} [opts.radius=0.08]
 * @param {'octahedron'|'sphere'} [opts.shape='octahedron']
 */
export function starSDF({ radius = 0.08, shape = 'octahedron' } = {}) {
  return shape === 'sphere' ? sphere(radius) : octahedron(radius);
}

/**
 * Sun — sphere with a slightly larger "glow halo" ring around it. The halo is
 * NOT a separate visual element here (no shading); it's a slightly inflated
 * second sphere that the renderer's region coloring can shade differently.
 *
 * @param {number} [opts.radius=0.4]      core sphere
 * @param {number} [opts.haloThickness=0.06]
 */
export function sunSDF({ radius = 0.4, haloThickness = 0.06 } = {}) {
  return dilate(sphere(radius), -haloThickness * 0.5);
  // Note: just core sphere for now; halo as separate subject if needed.
}

/**
 * Cloud puff — 3-5 overlapping ellipsoids unioned together for a soft cumulus
 * look. Deterministic positions (no randomness in SDF; the LLM can place N
 * cloud subjects at different transforms for variation).
 *
 * @param {number} [opts.width=1.0]    overall X extent
 * @param {number} [opts.height=0.45]  overall Y extent
 * @param {number} [opts.depth=0.6]    overall Z extent
 */
export function cloudPuffSDF({ width = 1.0, height = 0.45, depth = 0.6 } = {}) {
  const main = ellipsoid([width * 0.5, height * 0.5, depth * 0.5]);
  const left = ellipsoid([width * 0.32, height * 0.42, depth * 0.42]).translate([
    -width * 0.38,
    height * 0.06,
    0,
  ]);
  const right = ellipsoid([width * 0.32, height * 0.42, depth * 0.42]).translate([
    width * 0.38,
    height * 0.06,
    0,
  ]);
  const top1 = ellipsoid([width * 0.24, height * 0.3, depth * 0.3]).translate([
    -width * 0.12,
    height * 0.3,
    0,
  ]);
  const top2 = ellipsoid([width * 0.22, height * 0.28, depth * 0.3]).translate([
    width * 0.14,
    height * 0.32,
    0,
  ]);
  // unionSoft cubic blend — fluffy cumulus blob. Without it the 5 ellipsoids
  // have visible seams. r scales with overall cloud size.
  return unionSoft(main, left, right, top1, top2, { r: Math.max(width, depth) * 0.12 });
}

// ---- Landscape atoms -------------------------------------------------------

/**
 * Pine tree — cylinder trunk + N cone foliage layers stacked.
 *
 * @param {number} [opts.trunkHeight=0.5]
 * @param {number} [opts.trunkRadius=0.1]
 * @param {number} [opts.foliageHeight=1.4]   total height of foliage cone stack
 * @param {number} [opts.foliageBaseR=0.55]   widest layer radius
 * @param {number} [opts.layers=3]            number of cone layers (2-5)
 */
export function pineTreeSDF({
  trunkHeight = 0.5,
  trunkRadius = 0.1,
  foliageHeight = 1.4,
  foliageBaseR = 0.55,
  layers = 3,
} = {}) {
  // trunk: cylinder centered at y = trunkHeight/2
  const trunk = cylinder(trunkRadius, trunkHeight).translate([0, trunkHeight / 2, 0]);

  // foliage layers: each cone sits above the previous, each smaller
  const layerH = foliageHeight / layers;
  const parts = [trunk];
  for (let i = 0; i < layers; i++) {
    // each cone takes 1.5 * layerH (overlap) and gets smaller upward
    const t = i / Math.max(layers - 1, 1); // 0..1
    const r = foliageBaseR * (1 - t * 0.55); // taper
    const h = layerH * 1.4;
    const yCenter = trunkHeight + i * layerH * 0.85 + h / 2 - 0.05;
    parts.push(cone(h, r).translate([0, yCenter, 0]));
  }
  // unionRound r=0.015 — small organic fillet between trunk and foliage layers.
  // Preserves the discrete cone-stack silhouette but softens hard seams where
  // trunk meets bottom cone and cone meets cone above.
  return unionRound(...parts, { r: 0.015 });
}

/**
 * Broadleaf tree — cylinder trunk + sphere foliage cluster.
 *
 * @param {number} [opts.trunkHeight=0.7]
 * @param {number} [opts.trunkRadius=0.09]
 * @param {number} [opts.foliageR=0.55]
 */
export function broadleafTreeSDF({ trunkHeight = 0.7, trunkRadius = 0.09, foliageR = 0.55 } = {}) {
  const trunk = cylinder(trunkRadius, trunkHeight).translate([0, trunkHeight / 2, 0]);
  // 3-sphere cluster centered at top of trunk
  const yTop = trunkHeight + foliageR * 0.55;
  const main = sphere(foliageR).translate([0, yTop, 0]);
  const sideL = sphere(foliageR * 0.62).translate([
    -foliageR * 0.55,
    yTop - foliageR * 0.1,
    foliageR * 0.1,
  ]);
  const sideR = sphere(foliageR * 0.62).translate([
    foliageR * 0.55,
    yTop - foliageR * 0.1,
    -foliageR * 0.1,
  ]);
  // unionSoft r ~ 5% of foliage — blobs the 3 spheres into one organic
  // foliage mass with a soft fillet where trunk meets canopy.
  return unionSoft(trunk, main, sideL, sideR, { r: foliageR * 0.09 });
}

// ---- Building atoms --------------------------------------------------------

/**
 * Cottage — a simple house: box wall + pyramid roof. Useful for villages,
 * carrier island superstructures, gingerbread scenes, etc.
 *
 * @param {number} [opts.width=0.8]    X+Z extent of the wall (square footprint)
 * @param {number} [opts.height=0.6]   wall height
 * @param {number} [opts.roofHeight=0.45]  pyramid roof height above the wall
 */
export function cottageSDF({ width = 0.8, height = 0.6, roofHeight = 0.45 } = {}) {
  const wall = box([width, height, width]).translate([0, height / 2, 0]);
  // pyramid(h) is centered on origin, base size 1×1, apex at +h.
  // Scale to match wall footprint by translating + treating as base at y=height.
  const roof = pyramid(roofHeight).scale(width).translate([0, height, 0]);
  // unionChamfer r=0.03 — 3cm bevel at the wall-to-roof seam reads as a
  // carved-stone cornice / wooden cottage eave. Without it the joint looks
  // like a child's block-tower. r small enough to feel handcrafted, not
  // dominating the geometry.
  return unionChamfer(wall, roof, { r: 0.03 });
}

// ---- Decorative / mechanical atoms ----------------------------------------

/**
 * Flag on pole — vertical pole + rectangular flag at top, fluttering out one
 * side. Useful for carriers, building rooftops, garden flags.
 *
 * @param {number} [opts.poleHeight=2.0]
 * @param {number} [opts.poleRadius=0.04]
 * @param {number} [opts.flagWidth=0.5]
 * @param {number} [opts.flagHeight=0.3]
 * @param {number} [opts.flagSide=1]    +1 = flag points +X, -1 = -X
 */
export function flagOnPoleSDF({
  poleHeight = 2.0,
  poleRadius = 0.04,
  flagWidth = 0.5,
  flagHeight = 0.3,
  flagSide = 1,
} = {}) {
  const pole = cylinder(poleRadius, poleHeight).translate([0, poleHeight / 2, 0]);
  const flagYCenter = poleHeight - flagHeight * 0.6;
  const flag = box([flagWidth, flagHeight, 0.012]).translate([
    flagSide * (flagWidth / 2 + poleRadius),
    flagYCenter,
    0,
  ]);
  // unionRound r=0.005 — tiny fillet where flag meets pole. Reads as fabric
  // attached to pole rather than two free-floating shapes.
  return unionRound(pole, flag, { r: 0.005 });
}

/**
 * Bird silhouette — capsule body with two flat ellipsoid wings angled
 * upward. Useful for sky decoration in lighthouse / mountain / coastal scenes.
 *
 * @param {number} [opts.bodyLength=0.18]
 * @param {number} [opts.bodyRadius=0.025]
 * @param {number} [opts.wingSpan=0.45]
 * @param {number} [opts.wingRise=0.1]    how high wingtips rise above body
 */
export function birdSilhouetteSDF({
  bodyLength = 0.18,
  bodyRadius = 0.025,
  wingSpan = 0.45,
  wingRise = 0.1,
} = {}) {
  const body = capsule([-bodyLength / 2, 0, 0], [bodyLength / 2, 0, 0], bodyRadius);
  const wingL = ellipsoid([wingSpan / 2, 0.012, 0.05]).translate([-wingSpan / 4, wingRise / 2, 0]);
  const wingR = ellipsoid([wingSpan / 2, 0.012, 0.05]).translate([wingSpan / 4, wingRise / 2, 0]);
  // unionRound r=0.008 — small organic fillet where wings meet body. Reads
  // as a single bird silhouette, not capsule-with-stuck-on wings.
  return unionRound(body, wingL, wingR, { r: 0.008 });
}
