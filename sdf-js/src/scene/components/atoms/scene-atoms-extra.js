// =============================================================================
// Atlas scene atoms — EXTRA library (2026-05-19, v3.0 atom expansion)
// -----------------------------------------------------------------------------
// 33 new high-semantic composites across 7 categories:
//   Animals   (6): cow, horse, pig, dog, sheep, cat
//   Landscape (4): rock-boulder, fence-section, hill-mound, stream-segment
//   Architecture (5): tower-square, church-spire, gazebo, well, fountain
//   Vehicles  (4): sailboat-small, car-simple, wagon, biplane
//   Furniture (5): chair, table-round, lamp-standing, bookshelf, wine-bottle
//   Mechanical (4): gear-flat, pipe-l-bend, smokestack, windmill
//   Plants    (5): flower, mushroom, bush, vine, grass-tuft
//
// Composition pattern: each atom returns a single SDF3 built from primitives
// in d3.js + hg_sdf boolean variants (unionRound / unionSoft / unionChamfer)
// for organic-feeling internal joints. The whole atom presents as a single
// type-name to the lift LLM (`type: "cow"` → ~6 primitives expanded).
//
// All atoms accept opts objects with sensible defaults. Sizes assume the
// "Atlas unit" ≈ 1 meter scale convention (cottage width default 0.8 = 80cm
// model, scale up via Subject.transform.scale).
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
  torus,
  tri_prism,
} from '../../../sdf/d3.js';
import { union, unionRound, unionSoft, unionChamfer } from '../../../sdf/dn.js';

// =============================================================================
// ANIMALS — quadruped helper + 6 species
// =============================================================================

/**
 * Internal quadruped helper. Builds a generic 4-legged animal from
 * proportional parameters. Used by cow/horse/pig/dog/sheep/cat below.
 */
function _quadrupedSDF({
  bodyL, // body capsule length
  bodyR, // body capsule radius (fullness)
  legH, // leg height (ground to body bottom)
  legR, // leg radius
  headR, // head ellipsoid radius
  headXOff = 0.5, // head x-offset as fraction of bodyL
  headYBoost = 0.4, // head y above body center, fraction of bodyR
  fillet = 0.02, // unionRound r for smooth joints
} = {}) {
  const bodyY = legH + bodyR * 0.4; // body center y
  const headY = bodyY + bodyR * headYBoost;
  const body = capsule([-bodyL / 2, bodyY, 0], [bodyL / 2, bodyY, 0], bodyR);
  const head = ellipsoid([headR * 1.2, headR * 0.9, headR * 0.85]).translate([
    bodyL * headXOff,
    headY,
    0,
  ]);

  // 4 legs at body corners
  const lx = bodyL * 0.3,
    lz = bodyR * 0.65;
  const mkLeg = (x, z) => capsule([x, bodyY - 0.05, z], [x, 0, z], legR);
  const legFR = mkLeg(+lx, +lz);
  const legFL = mkLeg(+lx, -lz);
  const legBR = mkLeg(-lx, +lz);
  const legBL = mkLeg(-lx, -lz);

  return unionRound(body, head, legFR, legFL, legBR, legBL, { r: fillet });
}

export function cowSDF({ scale = 1 } = {}) {
  return _quadrupedSDF({
    bodyL: 0.85 * scale,
    bodyR: 0.2 * scale,
    legH: 0.5 * scale,
    legR: 0.06 * scale,
    headR: 0.18 * scale,
    fillet: 0.02 * scale,
  });
}

export function horseSDF({ scale = 1 } = {}) {
  // Horse: slimmer, taller, longer legs than cow
  return _quadrupedSDF({
    bodyL: 0.95 * scale,
    bodyR: 0.17 * scale,
    legH: 0.65 * scale,
    legR: 0.05 * scale,
    headR: 0.13 * scale,
    headYBoost: 0.7,
    fillet: 0.018 * scale,
  });
}

export function pigSDF({ scale = 1 } = {}) {
  // Pig: short low body, stubby legs
  return _quadrupedSDF({
    bodyL: 0.65 * scale,
    bodyR: 0.22 * scale,
    legH: 0.18 * scale,
    legR: 0.05 * scale,
    headR: 0.13 * scale,
    headXOff: 0.45,
    headYBoost: 0.2,
    fillet: 0.025 * scale,
  });
}

export function dogSDF({ scale = 1 } = {}) {
  // Dog: small, with tail
  const body = _quadrupedSDF({
    bodyL: 0.5 * scale,
    bodyR: 0.1 * scale,
    legH: 0.25 * scale,
    legR: 0.035 * scale,
    headR: 0.09 * scale,
    headYBoost: 0.6,
    fillet: 0.012 * scale,
  });
  // Tail — angled-up capsule from rear of body
  const bodyY = 0.25 * scale + 0.1 * scale * 0.4;
  const tail = capsule(
    [-0.25 * scale, bodyY, 0],
    [-0.4 * scale, bodyY + 0.12 * scale, 0],
    0.025 * scale,
  );
  return unionRound(body, tail, { r: 0.012 * scale });
}

export function sheepSDF({ scale = 1 } = {}) {
  // Sheep: rounded woolly body (sphere not capsule)
  const bodyR = 0.22 * scale;
  const legH = 0.18 * scale;
  const bodyY = legH + bodyR * 0.4;
  const body = sphere(bodyR).translate([0, bodyY, 0]);
  const head = ellipsoid([0.1 * scale, 0.09 * scale, 0.08 * scale]).translate([
    bodyR * 0.95,
    bodyY - bodyR * 0.1,
    0,
  ]);
  const lx = 0.13 * scale,
    lz = bodyR * 0.55;
  const mkLeg = (x, z) => capsule([x, bodyY - 0.05, z], [x, 0, z], 0.035 * scale);
  return unionRound(
    body,
    head,
    mkLeg(+lx, +lz),
    mkLeg(+lx, -lz),
    mkLeg(-lx, +lz),
    mkLeg(-lx, -lz),
    { r: 0.025 * scale },
  );
}

export function catSDF({ scale = 1 } = {}) {
  // Cat: small with vertical tail
  const body = _quadrupedSDF({
    bodyL: 0.4 * scale,
    bodyR: 0.08 * scale,
    legH: 0.2 * scale,
    legR: 0.025 * scale,
    headR: 0.08 * scale,
    headYBoost: 0.6,
    fillet: 0.01 * scale,
  });
  // Tail vertical-ish + slight curve (capsule pointing up)
  const bodyY = 0.2 * scale + 0.08 * scale * 0.4;
  const tail = capsule(
    [-0.2 * scale, bodyY, 0],
    [-0.18 * scale, bodyY + 0.22 * scale, 0.02 * scale],
    0.02 * scale,
  );
  return unionRound(body, tail, { r: 0.01 * scale });
}

// =============================================================================
// LANDSCAPE — terrain / outdoor decoration
// =============================================================================

export function rockBoulderSDF({ scale = 1 } = {}) {
  // 3 ellipsoids softly blended = irregular boulder
  const a = ellipsoid([0.45 * scale, 0.32 * scale, 0.38 * scale]);
  const b = ellipsoid([0.3 * scale, 0.28 * scale, 0.32 * scale]).translate([
    0.25 * scale,
    0.12 * scale,
    0.08 * scale,
  ]);
  const c = ellipsoid([0.25 * scale, 0.2 * scale, 0.26 * scale]).translate([
    -0.22 * scale,
    0.05 * scale,
    -0.1 * scale,
  ]);
  return unionSoft(a, b, c, { r: 0.08 * scale });
}

export function fenceSectionSDF({ length = 1.5, height = 0.5 } = {}) {
  // 4 posts + 2 rails = rural wooden fence segment
  const postR = 0.025,
    postH = height;
  const railR = 0.018;
  const spacing = length / 3;
  // 4 vertical posts at length endpoints + 2 intermediates
  const posts = [];
  for (let i = 0; i < 4; i++) {
    const x = -length / 2 + i * spacing;
    posts.push(box([postR * 2, postH, postR * 2]).translate([x, postH / 2, 0]));
  }
  // 2 horizontal rails (top + middle)
  const railTop = capsule([-length / 2, postH * 0.85, 0], [length / 2, postH * 0.85, 0], railR);
  const railMid = capsule([-length / 2, postH * 0.45, 0], [length / 2, postH * 0.45, 0], railR);
  return unionRound(...posts, railTop, railMid, { r: 0.008 });
}

export function hillMoundSDF({ radius = 1.5, height = 0.5 } = {}) {
  // Wide flat ellipsoid = small earth mound
  return ellipsoid([radius, height, radius]);
}

export function streamSegmentSDF({ length = 2.0, width = 0.3, depth = 0.05 } = {}) {
  // Flat capsule = water surface segment (low + wide)
  return capsule([-length / 2, 0, 0], [length / 2, 0, 0], width / 2).scale([
    1,
    depth / (width / 2),
    1,
  ]);
}

// =============================================================================
// ARCHITECTURE — buildings beyond cottage
// =============================================================================

export function towerSquareSDF({ width = 1.0, height = 4.0, roofHeight = 0.8 } = {}) {
  // 2-3 stage square tower with stone walls + pointed roof
  const baseH = height * 0.6;
  const midH = height * 0.4;
  const base = box([width, baseH, width]).translate([0, baseH / 2, 0]);
  const mid = box([width * 0.85, midH, width * 0.85]).translate([0, baseH + midH / 2, 0]);
  const roof = pyramid(roofHeight)
    .scale(width * 0.9)
    .translate([0, height, 0]);
  return unionChamfer(base, mid, roof, { r: 0.04 });
}

export function churchSpireSDF({ width = 0.8, baseHeight = 1.5, spireHeight = 2.5 } = {}) {
  // Church bell tower — box base + tall steep pyramid spire + small cross-top
  const base = box([width, baseHeight, width]).translate([0, baseHeight / 2, 0]);
  const spire = pyramid(spireHeight)
    .scale(width * 0.85)
    .translate([0, baseHeight, 0]);
  // Small finial sphere at apex
  const finial = sphere(width * 0.04).translate([0, baseHeight + spireHeight * 0.92, 0]);
  return unionChamfer(base, spire, finial, { r: 0.03 });
}

export function gazeboSDF({ radius = 0.8, height = 1.2, roofHeight = 0.6 } = {}) {
  // Octagonal pavilion: octagon prism base + cone roof + center finial
  // Note: octagon-prism axis is +Z by default, we want axis +Y → rotate around X
  // Easier: just use cylinder for base (gazebo body is "round-ish" enough)
  const base = cylinder(radius, height).translate([0, height / 2, 0]);
  const roof = cone(roofHeight, radius * 1.1).translate([0, height + roofHeight / 2, 0]);
  const finial = sphere(radius * 0.08).translate([0, height + roofHeight, 0]);
  return unionRound(base, roof, finial, { r: 0.04 });
}

export function wellSDF({ radius = 0.4, wallHeight = 0.5 } = {}) {
  // Circular stone well — short cylinder wall + torus rim + cross-bar for bucket
  const wall = cylinder(radius, wallHeight).translate([0, wallHeight / 2, 0]);
  const rim = torus(radius * 1.05, 0.04).translate([0, wallHeight, 0]);
  // Crossbar holder — 2 posts + horizontal bar
  const postR = 0.025;
  const postH = wallHeight + 0.5;
  const postL = box([postR * 2, postH, postR * 2]).translate([-radius * 0.9, postH / 2, 0]);
  const postR2 = box([postR * 2, postH, postR * 2]).translate([+radius * 0.9, postH / 2, 0]);
  const beam = capsule(
    [-radius * 0.9, wallHeight + 0.45, 0],
    [+radius * 0.9, wallHeight + 0.45, 0],
    0.02,
  );
  return unionChamfer(wall, rim, postL, postR2, beam, { r: 0.015 });
}

export function fountainSDF({ radius = 0.7, basinHeight = 0.3 } = {}) {
  // Multi-tier fountain: wide basin + center pillar + small bowl
  const basin = cylinder(radius, basinHeight).translate([0, basinHeight / 2, 0]);
  const basinRim = torus(radius * 1.02, 0.035).translate([0, basinHeight, 0]);
  const pillar = cylinder(radius * 0.2, basinHeight * 1.6).translate([
    0,
    basinHeight + basinHeight * 0.8,
    0,
  ]);
  const upperBowl = cylinder(radius * 0.35, basinHeight * 0.3).translate([0, basinHeight * 2.4, 0]);
  const upperRim = torus(radius * 0.38, 0.025).translate([0, basinHeight * 2.55, 0]);
  return unionRound(basin, basinRim, pillar, upperBowl, upperRim, { r: 0.02 });
}

// =============================================================================
// VEHICLES — small boats / cars / planes
// =============================================================================

export function sailboatSmallSDF({ scale = 1 } = {}) {
  // Small sailboat — hull capsule + mast + triangle sail
  const s = scale;
  const hull = capsule([-0.4 * s, 0, 0], [0.4 * s, 0, 0], 0.1 * s);
  const mast = cylinder(0.018 * s, 0.5 * s).translate([0, 0.25 * s, 0]);
  // tri_prism axis defaults to +Z (extrudes triangle along Z). Rotate X by
  // π/2 makes the triangle stand vertical (sail-like) with prism axis +Y.
  const sail = tri_prism(0.18 * s, 0.04 * s)
    .rotate(Math.PI / 2, [1, 0, 0])
    .translate([0.05 * s, 0.4 * s, 0]);
  return unionRound(hull, mast, sail, { r: 0.01 * s });
}

export function carSimpleSDF({ scale = 1 } = {}) {
  // Vintage car — body + cabin + 4 wheels
  const s = scale;
  const body = box([0.8 * s, 0.18 * s, 0.35 * s]).translate([0, 0.15 * s, 0]);
  const cabin = box([0.45 * s, 0.16 * s, 0.32 * s]).translate([-0.05 * s, 0.32 * s, 0]);
  // 4 wheel torus, axis Z (rotated)
  const wheelR = 0.08 * s,
    wheelT = 0.04 * s;
  const wheelCenter = 0.08 * s;
  const mkWheel = (xz) =>
    torus(wheelR, wheelT)
      .translate([xz[0], wheelCenter, xz[1]])
      .rotate(Math.PI / 2, [1, 0, 0]);
  const wheels = [
    mkWheel([+0.3 * s, +0.15 * s]),
    mkWheel([+0.3 * s, -0.15 * s]),
    mkWheel([-0.3 * s, +0.15 * s]),
    mkWheel([-0.3 * s, -0.15 * s]),
  ];
  return unionRound(body, cabin, ...wheels, { r: 0.015 * s });
}

export function wagonSDF({ scale = 1 } = {}) {
  // Cart with 2 large wheels — for old-time scenes
  const s = scale;
  const bed = box([0.8 * s, 0.15 * s, 0.5 * s]).translate([0, 0.25 * s, 0]);
  const sideL = box([0.8 * s, 0.25 * s, 0.04 * s]).translate([0, 0.35 * s, +0.23 * s]);
  const sideR = box([0.8 * s, 0.25 * s, 0.04 * s]).translate([0, 0.35 * s, -0.23 * s]);
  const wheelL = torus(0.18 * s, 0.04 * s)
    .translate([0, 0.18 * s, +0.27 * s])
    .rotate(Math.PI / 2, [1, 0, 0]);
  const wheelR = torus(0.18 * s, 0.04 * s)
    .translate([0, 0.18 * s, -0.27 * s])
    .rotate(Math.PI / 2, [1, 0, 0]);
  return unionRound(bed, sideL, sideR, wheelL, wheelR, { r: 0.015 * s });
}

export function biplaneSDF({ scale = 1 } = {}) {
  // Vintage biplane — fuselage + 2 stacked wings + tail wings + prop disc
  const s = scale;
  const fuselage = capsule([-0.55 * s, 0.4 * s, 0], [0.55 * s, 0.4 * s, 0], 0.08 * s);
  // Upper wing
  const wingUpper = box([0.25 * s, 0.025 * s, 1.5 * s]).translate([0.05 * s, 0.58 * s, 0]);
  // Lower wing
  const wingLower = box([0.25 * s, 0.025 * s, 1.3 * s]).translate([0.05 * s, 0.3 * s, 0]);
  // Wing struts (2 connecting upper/lower)
  const strutL = capsule([0.05 * s, 0.32 * s, +0.5 * s], [0.05 * s, 0.56 * s, +0.5 * s], 0.012 * s);
  const strutR = capsule([0.05 * s, 0.32 * s, -0.5 * s], [0.05 * s, 0.56 * s, -0.5 * s], 0.012 * s);
  // Tail vertical fin
  const tailVert = box([0.15 * s, 0.18 * s, 0.02 * s]).translate([-0.55 * s, 0.5 * s, 0]);
  // Tail horizontal wing
  const tailHoriz = box([0.18 * s, 0.025 * s, 0.4 * s]).translate([-0.55 * s, 0.42 * s, 0]);
  // Propeller disc (flat torus at nose)
  const prop = torus(0.1 * s, 0.012 * s).translate([0.62 * s, 0.4 * s, 0]);
  return unionRound(fuselage, wingUpper, wingLower, strutL, strutR, tailVert, tailHoriz, prop, {
    r: 0.012 * s,
  });
}

// =============================================================================
// FURNITURE — chair, table, lamp, bookshelf, wine-bottle
// =============================================================================

export function chairSDF({ scale = 1 } = {}) {
  // 4 legs + seat + back
  const s = scale;
  const seatH = 0.45 * s,
    seatThick = 0.04 * s;
  const seat = box([0.4 * s, seatThick, 0.4 * s]).translate([0, seatH, 0]);
  const back = box([0.4 * s, 0.45 * s, 0.04 * s]).translate([0, seatH + 0.22 * s, -0.18 * s]);
  // 4 legs
  const lx = 0.17 * s,
    lz = 0.17 * s;
  const mkLeg = (x, z) => box([0.04 * s, seatH, 0.04 * s]).translate([x, seatH / 2, z]);
  return unionChamfer(
    seat,
    back,
    mkLeg(+lx, +lz),
    mkLeg(+lx, -lz),
    mkLeg(-lx, +lz),
    mkLeg(-lx, -lz),
    { r: 0.012 * s },
  );
}

export function tableRoundSDF({ radius = 0.5, height = 0.5 } = {}) {
  // Round top + pedestal base
  const top = cylinder(radius, 0.05).translate([0, height, 0]);
  const post = cylinder(radius * 0.15, height * 0.95).translate([0, height * 0.475, 0]);
  const foot = cylinder(radius * 0.6, 0.04).translate([0, 0.02, 0]);
  return unionChamfer(top, post, foot, { r: 0.02 });
}

export function lampStandingSDF({ scale = 1 } = {}) {
  // Tall standing lamp — base + post + shade (truncated cone)
  const s = scale;
  const base = cylinder(0.12 * s, 0.04 * s).translate([0, 0.02 * s, 0]);
  const post = cylinder(0.018 * s, 1.2 * s).translate([0, 0.62 * s, 0]);
  // Shade — use cone (truncated by inverted cone difference at top is complex,
  // use cone with apex up + small sphere "bulb" inside)
  const shade = cone(0.18 * s, 0.16 * s).translate([0, 1.28 * s, 0]);
  const bulb = sphere(0.07 * s).translate([0, 1.32 * s, 0]); // visible glow source
  return unionRound(base, post, shade, bulb, { r: 0.015 * s });
}

export function bookshelfSDF({ width = 0.8, height = 1.5, depth = 0.25 } = {}) {
  // Vertical cabinet + 3 horizontal shelves
  const back = box([width, height, 0.02]).translate([0, height / 2, -depth / 2]);
  const sideL = box([0.02, height, depth]).translate([-width / 2, height / 2, 0]);
  const sideR = box([0.02, height, depth]).translate([+width / 2, height / 2, 0]);
  const top = box([width, 0.02, depth]).translate([0, height - 0.01, 0]);
  const shelf1 = box([width, 0.02, depth]).translate([0, height * 0.66, 0]);
  const shelf2 = box([width, 0.02, depth]).translate([0, height * 0.33, 0]);
  const bottom = box([width, 0.02, depth]).translate([0, 0.01, 0]);
  return unionChamfer(back, sideL, sideR, top, shelf1, shelf2, bottom, { r: 0.012 });
}

export function wineBottleSDF({ scale = 1 } = {}) {
  // Body cylinder + tapered neck + cork sphere
  const s = scale;
  const body = cylinder(0.1 * s, 0.55 * s).translate([0, 0.275 * s, 0]);
  // Tapered neck — use capped_cone via round-cone approximation: cylinder going up
  const shoulder = cylinder(0.04 * s, 0.08 * s).translate([0, 0.595 * s, 0]);
  const neck = cylinder(0.035 * s, 0.2 * s).translate([0, 0.735 * s, 0]);
  const cork = cylinder(0.038 * s, 0.04 * s).translate([0, 0.855 * s, 0]);
  return unionRound(body, shoulder, neck, cork, { r: 0.012 * s });
}

// =============================================================================
// MECHANICAL — gears, pipes, smokestacks, windmills
// =============================================================================

export function gearFlatSDF({ radius = 0.5, thickness = 0.08, teeth = 12 } = {}) {
  // Flat gear — disk + N teeth around perimeter (use box as tooth, modPolar
  // domain op). For simplicity here we synthesize teeth as N small boxes.
  // The modPolar approach gives 1 SDF eval for all teeth (efficient).
  const disk = cylinder(radius, thickness).translate([0, thickness / 2, 0]);
  // Place teeth manually around the perimeter (more controllable than modPolar
  // in atom code without compile-time integration; modPolar via the spec.js
  // type is for top-level subjects)
  const toothH = thickness * 1.1;
  const toothW = (2 * Math.PI * radius) / (teeth * 2.5); // gap = 1.5× tooth width
  const toothD = 0.15 * radius;
  const teethParts = [];
  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    const tx = Math.cos(angle) * (radius + toothD / 2);
    const tz = Math.sin(angle) * (radius + toothD / 2);
    teethParts.push(
      box([toothD, toothH, toothW])
        .rotate(-angle, [0, 1, 0])
        .translate([tx, toothH / 2, tz]),
    );
  }
  // Center hole (omitted for simplicity — would need difference)
  return unionChamfer(disk, ...teethParts, { r: 0.005 });
}

export function pipeLBendSDF({ scale = 1 } = {}) {
  // Industrial pipe with 90° bend — 2 perpendicular capsules + sphere joint
  const s = scale;
  const arm1 = capsule([0, 0, 0], [0.6 * s, 0, 0], 0.06 * s);
  const arm2 = capsule([0.6 * s, 0, 0], [0.6 * s, 0.6 * s, 0], 0.06 * s);
  const joint = sphere(0.08 * s).translate([0.6 * s, 0, 0]);
  return unionRound(arm1, arm2, joint, { r: 0.015 * s });
}

export function smokestackSDF({ radius = 0.25, height = 3.0 } = {}) {
  // Tall industrial smokestack — cylinder + small cap rim + small wider top band
  const stack = cylinder(radius, height).translate([0, height / 2, 0]);
  const cap = torus(radius * 1.1, radius * 0.08).translate([0, height, 0]);
  const band = cylinder(radius * 1.08, height * 0.04).translate([0, height * 0.93, 0]);
  return unionChamfer(stack, cap, band, { r: 0.02 });
}

export function windmillSDF({ scale = 1 } = {}) {
  // Tower base + 4 perpendicular sail blades on a hub
  const s = scale;
  // Tower — wider base, narrower top (use tapered cone approximation w/ 2 cyls)
  const towerBase = cylinder(0.35 * s, 0.3 * s).translate([0, 0.15 * s, 0]);
  const towerMid = cylinder(0.28 * s, 1.5 * s).translate([0, 1.05 * s, 0]);
  const towerTop = cylinder(0.25 * s, 0.25 * s).translate([0, 1.925 * s, 0]);
  const dome = sphere(0.27 * s).translate([0, 2.05 * s, 0]);
  // Hub
  const hub = sphere(0.08 * s).translate([0, 2.05 * s, 0.3 * s]);
  // 4 blades — long thin boxes at 90° intervals around hub Z-axis
  const bladeL = 1.5 * s,
    bladeW = 0.25 * s,
    bladeT = 0.04 * s;
  const blades = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    // Blade pointing radially from hub in XY plane (windmill axis = Z)
    blades.push(
      box([bladeW, bladeL, bladeT])
        .rotate(angle, [0, 0, 1])
        .translate([cos * bladeL * 0.5, 2.05 * s + sin * bladeL * 0.5, 0.32 * s]),
    );
  }
  return unionChamfer(towerBase, towerMid, towerTop, dome, hub, ...blades, { r: 0.025 * s });
}

// =============================================================================
// PLANTS — flower, mushroom, bush, vine, grass-tuft
// =============================================================================

export function flowerSDF({ stemHeight = 0.6, bloomRadius = 0.12 } = {}) {
  // Thin vertical stem + spherical bloom + 2 tiny leaves
  const stem = capsule([0, 0, 0], [0, stemHeight, 0], 0.012);
  const bloom = sphere(bloomRadius).translate([0, stemHeight + bloomRadius, 0]);
  // 2 leaves — small ellipsoids on either side
  const leafL = ellipsoid([0.05, 0.012, 0.025]).translate([+0.06, stemHeight * 0.5, 0]);
  const leafR = ellipsoid([0.05, 0.012, 0.025]).translate([-0.06, stemHeight * 0.4, 0]);
  return unionRound(stem, bloom, leafL, leafR, { r: 0.008 });
}

export function mushroomSDF({ stemHeight = 0.15, capRadius = 0.12 } = {}) {
  // Short cylindrical stem + domed cap
  const stem = cylinder(0.025, stemHeight).translate([0, stemHeight / 2, 0]);
  // Cap = hemisphere (sphere translated up by half its radius, intersected
  // with a half-space). Simpler approximation: scaled sphere flattened.
  const cap = ellipsoid([capRadius, capRadius * 0.55, capRadius]).translate([
    0,
    stemHeight + capRadius * 0.45,
    0,
  ]);
  return unionRound(stem, cap, { r: 0.008 });
}

export function bushSDF({ radius = 0.4 } = {}) {
  // Cluster of 4 overlapping spheres = irregular leafy bush
  const r = radius;
  const a = sphere(r * 0.85);
  const b = sphere(r * 0.7).translate([+r * 0.55, +r * 0.1, 0]);
  const c = sphere(r * 0.65).translate([-r * 0.55, +r * 0.05, +r * 0.1]);
  const d = sphere(r * 0.55).translate([0, +r * 0.45, -r * 0.15]);
  return unionSoft(a, b, c, d, { r: r * 0.12 });
}

export function vineSDF({ length = 1.0, thickness = 0.02 } = {}) {
  // Single curved capsule + 3-4 leaves alternating sides
  const main = capsule([0, 0, 0], [length, 0, 0], thickness);
  const leaves = [];
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5; // 0.2, 0.4, 0.6, 0.8
    const side = i % 2 === 0 ? +1 : -1;
    const lx = t * length;
    leaves.push(ellipsoid([0.06, 0.012, 0.025]).translate([lx, 0, side * 0.05]));
  }
  return unionRound(main, ...leaves, { r: 0.005 });
}

export function grassTuftSDF({ count = 5, height = 0.15 } = {}) {
  // N thin vertical capsules clustered at base = grass clump
  const blades = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const dx = Math.cos(a) * 0.03;
    const dz = Math.sin(a) * 0.03;
    const tilt = (i / count) * 0.08; // slight outward tilt
    blades.push(capsule([dx, 0, dz], [dx * (1 + tilt), height, dz * (1 + tilt)], 0.008));
  }
  return unionRound(...blades, { r: 0.004 });
}
