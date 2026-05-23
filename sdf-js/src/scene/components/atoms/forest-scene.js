// =============================================================================
// forest-scene — Tree / Maple-leaf / Flower / Meteor atoms
// -----------------------------------------------------------------------------
// 4 atoms composed to recreate the "tree + mountains + flowers + meteors" scene
// idiom from soft-servo/jake's "Tree in the wind" Shadertoy (idiom-only port,
// no source code copy — see project_shader_idiom_registry_v1.md).
//
// GPU path: each atom emits a single sdXxx() call declared in sdf3.glsl.js.
// JS path: cheap CPU stubs (single bounding sphere or 1e6) — these atoms are
// GPU-primary because composition is too expensive to evaluate on CPU.
//
// Key shared idiom: meteor-streak uses chunkedTime() helper which can also
// power future falling-leaves / flicker-light atoms (same per-particle cycle
// math). See sdf3.glsl.js chunkedTime() for the recipe.
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Stylized tree — 4-layer composition (wavy trunk + 3 polar branch layers +
 * cellular leaf instances). Real geometry lives in sdStylizedTree GLSL helper;
 * CPU stub is a single bounding capsule (good enough for region queries).
 *
 * @param {object} opts
 * @param {number} [opts.trunkLen=5.0]  Total trunk height (units)
 * @param {number} [opts.trunkRad=0.4]  Trunk base radius
 * @param {number} [opts.leafSize=0.18] Half-extent of each canopy leaf
 * @param {number} [opts.windK=0.12]    Wind sway amplitude (0=still)
 */
export function stylizedTreeSDF({
  trunkLen = 5.0,
  trunkRad = 0.4,
  leafSize = 0.18,
  windK    = 0.12,
} = {}) {
  const inst = SDF3((p) => {
    // CPU stub: trunk capsule + canopy sphere bound (no leaves on CPU).
    const dx = p[0], dy = p[1], dz = p[2];
    // Capsule trunk from y=0 to y=trunkLen
    const yClamp = Math.max(0, Math.min(trunkLen, dy));
    const tx = dx, ty = dy - yClamp, tz = dz;
    const dTrunk = Math.sqrt(tx*tx + ty*ty + tz*tz) - trunkRad;
    // Canopy sphere
    const cy = trunkLen * 0.95;
    const cdx = dx, cdy = dy - cy, cdz = dz;
    const dCanopy = Math.sqrt(cdx*cdx + cdy*cdy + cdz*cdz) - trunkLen * 0.55;
    return Math.min(dTrunk, dCanopy);
  });
  inst.ast = { kind: 'prim', name: 'stylized-tree', args: [trunkLen, trunkRad, leafSize, windK] };
  return inst;
}

/**
 * Single maple leaf — 2D shape extruded through z with a per-leaf random curl.
 *
 * @param {object} opts
 * @param {number} [opts.scale=0.15]  Half-extent of leaf (~half of full size)
 * @param {number} [opts.rand=0.5]    Seed for curl + edge bumps (0..1)
 */
export function mapleLeafSDF({ scale = 0.15, rand = 0.5 } = {}) {
  const inst = SDF3((p) => {
    // CPU stub: a tiny bounding sphere (leaf surface detail GPU-only).
    const dx = p[0], dy = p[1] - scale, dz = p[2];
    return Math.sqrt(dx*dx + dy*dy + dz*dz) - scale * 1.3;
  });
  inst.ast = { kind: 'prim', name: 'maple-leaf', args: [scale, rand] };
  return inst;
}

/**
 * Forest flower — thin stem + 5-petal bloom head. Compose with `rep` for
 * ground-scatter fields. Default stem height tall enough to peek above
 * grass-field at default 0.4 blade height.
 *
 * @param {object} opts
 * @param {number} [opts.stemH=1.0]   Stem height
 * @param {number} [opts.bloomR=0.16] Bloom head radius
 */
export function forestFlowerSDF({ stemH = 1.0, bloomR = 0.16 } = {}) {
  const inst = SDF3((p) => {
    // CPU stub: small sphere at bloom location
    const dx = p[0], dy = p[1] - stemH, dz = p[2];
    return Math.sqrt(dx*dx + dy*dy + dz*dz) - bloomR;
  });
  inst.ast = { kind: 'prim', name: 'forest-flower', args: [stemH, bloomR] };
  return inst;
}

/**
 * Meteor streak — animated emissive capsule that traverses the sky during a
 * window of each cycle. Uses chunkedTime() so multiple staggered meteors look
 * like a shower instead of synchronized lockstep.
 *
 * Default args: meteor falls from upper-left toward lower-right, 7s period,
 * 50% active window (~3.5s visible per cycle).
 *
 * @param {object} opts
 * @param {number[]} [opts.origin]      [x,y,z] start of active window
 * @param {number[]} [opts.velocity]    [vx,vy,vz] units/sec direction+speed
 * @param {number}   [opts.trailLen]    head-to-tail body length
 * @param {number}   [opts.period]      cycle length in seconds
 * @param {number}   [opts.activeFrac]  fraction of cycle meteor is visible
 * @param {number}   [opts.phase]       seconds offset for staggering
 */
/**
 * Grass field — cellular tapered-cone blades, pMod2 across infinite xz.
 * Wind sway. Wrap in rep + count if a bounded patch is desired.
 *
 * @param {object} opts
 * @param {number} [opts.bladeHeight=0.4]  Max tip y for blades
 * @param {number} [opts.density=0.10]     pMod2 cell size (smaller = denser)
 */
export function grassFieldSDF({ bladeHeight = 0.4, density = 0.10 } = {}) {
  const inst = SDF3((p) => {
    // CPU stub: slab above max blade tip
    return p[1] - bladeHeight * 1.3;
  });
  inst.ast = { kind: 'prim', name: 'grass-field', args: [bladeHeight, density] };
  return inst;
}

export function meteorStreakSDF({
  origin     = [-15, 18, 25],
  velocity   = [3.5, -2.5, 0.5],
  trailLen   = 1.4,
  period     = 7.0,
  activeFrac = 0.5,
  phase      = 0.0,
} = {}) {
  // CPU stub: always-far so meteor never contributes to region queries / CPU
  // raymarch. Meteors are GPU-emissive-only.
  const inst = SDF3(() => 1e6);
  inst.ast = {
    kind: 'prim',
    name: 'meteor-streak',
    args: [origin, velocity, trailLen, period, activeFrac, phase],
  };
  return inst;
}
