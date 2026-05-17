// =============================================================================
// autoscope-primitives-data —— SceneData-emitter twin of autoscope-primitives.js
// -----------------------------------------------------------------------------
// Each factory returns a Subject (PrimitiveLeaf | BooleanGroup | DomainGroup)
// that compiles via src/scene/compile.js into the same SDF as the JS version.
//
// Differences from autoscope-primitives.js:
//   - Returns Subject object (not SDF3 instance)
//   - Auto-generates unique id via module-level counter; caller resets per scene
//   - TimeExpr embedded directly in args/transform (matches original idiom)
//   - Composites (houseP = pyramid + box) → BooleanGroup union with children
//
// Time-expr embedding: linearT/sinT/sumT/mulT from time.js produce structured
// objects matching SPEC.md TimeExpr. They round-trip through JSON, and
// compile.js feeds them to sdf-js primitive factories which already accept them.
// No animation-channel indirection needed — direct embed is simpler.
//
// Day 5 of M0 — validates SceneData spec covers full autoscope vocabulary.
// =============================================================================

import { linearT, sinT, sumT, mulT, evalT, isTimeExpr } from '../../src/sdf/time.js';

const PI = Math.PI;

// =============================================================================
// ID counter
// =============================================================================

let _idCounter = 0;

export function resetIdCounter() { _idCounter = 0; }

function nextId(prefix) {
  return `${prefix}-${++_idCounter}`;
}

// =============================================================================
// arithmetic helpers — same idiom as autoscope-primitives.js
// =============================================================================

function add(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  return sumT(a, b);
}

function mul(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a * b;
  if (typeof a === 'number') return mulT(b, a);
  if (typeof b === 'number') return mulT(a, b);
  throw new Error('mul: time-expr × time-expr not supported');
}

const half = (x) => mul(x, 0.5);

function freeze(x) {
  return isTimeExpr(x) ? evalT(x, 0) : x;
}

function breatheDims(dims, amp, period) {
  if (!Array.isArray(dims)) dims = [dims, dims, dims];
  const b = sinT(amp, 1 / period, 0);
  return dims.map((d) => add(d, b));
}

// =============================================================================
// Buildings
// =============================================================================

/** boxE: ground-aligned box (base on y=0). */
export function boxE(loc, dims) {
  const [w, h, d] = dims;
  return {
    id: nextId('boxE'),
    type: 'box',
    args: { dims: [w, h, d] },
    transform: { translate: [loc[0], add(loc[1], half(h)), loc[2]] },
  };
}

/** cylinderE: ground-aligned cylinder. */
export function cylinderE(loc, height, radius) {
  return {
    id: nextId('cylinderE'),
    type: 'cylinder',
    args: { radius, height },
    transform: { translate: [loc[0], add(loc[1], half(height)), loc[2]] },
  };
}

/** houseP: pyramid roof + box body. */
export function houseP(loc, dims, roofHeight, angle = 0, opts = {}) {
  const { breathe = true } = opts;
  const [w, h, d] = breathe ? breatheDims(dims, 0.15, 4) : dims;
  return {
    id: nextId('houseP'),
    type: 'union',
    transform: { rotate: [0, angle, 0], translate: loc },
    children: [
      {
        id: nextId('houseP-roof'),
        type: 'pyramid',
        args: { height: roofHeight },
        transform: { scale: [mul(w, 0.99), 1, mul(d, 0.99)], translate: [0, h, 0] },
      },
      {
        id: nextId('houseP-body'),
        type: 'box',
        args: { dims: [w, h, d] },
        transform: { translate: [0, half(h), 0] },
      },
    ],
  };
}

/** houseC: cylinder body + cone roof. */
export function houseC(loc, dims, roofHeight, opts = {}) {
  const { breathe = true } = opts;
  let [w, h] = dims;
  if (breathe) {
    const b = sinT(0.15, 1 / 5, 0);
    w = add(w, b);
    h = add(h, b);
  }
  return {
    id: nextId('houseC'),
    type: 'union',
    transform: { translate: loc },
    children: [
      // body: ground-aligned cylinder
      {
        id: nextId('houseC-body'),
        type: 'cylinder',
        args: { radius: half(w), height: h },
        transform: { translate: [0, half(h), 0] },
      },
      // roof: cone on top
      {
        id: nextId('houseC-roof'),
        type: 'cone',
        args: { height: roofHeight, baseRadius: half(w) },
        transform: { translate: [0, add(h, half(roofHeight)), 0] },
      },
    ],
  };
}

/** houseS: tri-prism roof + box body. */
export function houseS(loc, dims, angle = 0, opts = {}) {
  const { breathe = true } = opts;
  const [w, h, d] = breathe ? breatheDims(dims, 0.15, 6) : dims;
  const cos30 = Math.cos(PI / 6);
  const j = cos30 / 1.5;
  const roofHalfWidth = mul(w, j);
  const roofHalfDepth = half(d);
  const roofY = add(h, mul(w, j * 0.5));
  return {
    id: nextId('houseS'),
    type: 'union',
    transform: { rotate: [0, angle, 0], translate: loc },
    children: [
      {
        id: nextId('houseS-body'),
        type: 'box',
        args: { dims: [w, h, d] },
        transform: { translate: [0, half(h), 0] },
      },
      {
        id: nextId('houseS-roof'),
        type: 'tri_prism',
        args: { halfWidth: roofHalfWidth, halfLength: roofHalfDepth },
        transform: { translate: [0, roofY, 0] },
      },
    ],
  };
}

/** arch: difference of box minus (rect + half-circle door cutout). */
export function arch(loc, dims, xyRot = 0, opts = {}) {
  const { pulse = true } = opts;
  const [w, h, d] = dims;
  const baseR = 0.375 * Math.min(freeze(w), freeze(h));
  const radius = pulse ? add(baseR, sinT(0.2, 0.5, 0)) : baseR;
  return {
    id: nextId('arch'),
    type: 'difference',
    transform: { rotate: [0, xyRot, 0], translate: loc },
    children: [
      // block
      {
        id: nextId('arch-block'),
        type: 'box',
        args: { dims: [w, h, d] },
        transform: { translate: [0, half(h), 0] },
      },
      // cutout = union of rect + cylinder
      {
        id: nextId('arch-cutout'),
        type: 'union',
        children: [
          {
            id: nextId('arch-cutout-box'),
            type: 'box',
            args: { dims: [mul(radius, 2), add(half(h), 0.1), add(d, 0.5)] },
            transform: { translate: [0, mul(h, 0.25), 0] },
          },
          {
            id: nextId('arch-cutout-cyl'),
            type: 'cylinder',
            args: { radius, height: add(d, 1.0) },
            transform: { rotate: [PI / 2, 0, 0], translate: [0, half(h), 0] },
          },
        ],
      },
    ],
  };
}

/** arch2: rectangular door cutout (no half-circle). */
export function arch2(loc, dims, xyRot = 0) {
  const [w, h, d] = dims;
  const radius = 0.375 * Math.min(freeze(w), freeze(h));
  return {
    id: nextId('arch2'),
    type: 'difference',
    transform: { rotate: [0, xyRot, 0], translate: loc },
    children: [
      {
        id: nextId('arch2-block'),
        type: 'box',
        args: { dims: [w, h, d] },
        transform: { translate: [0, half(h), 0] },
      },
      {
        id: nextId('arch2-cutout'),
        type: 'box',
        args: { dims: [radius * 2, add(half(h), 0.1), add(d, 0.5)] },
        transform: { translate: [0, mul(h, 0.25), 0] },
      },
    ],
  };
}

/** vault: union (box + half-cylinder), used as `-vault` to dig a tunnel. */
export function vault(loc, dims, xyRot = 0) {
  const [w, h, d] = dims;
  const radius = 0.375 * Math.min(freeze(w), freeze(h));
  return {
    id: nextId('vault'),
    type: 'union',
    transform: { rotate: [0, xyRot, 0], translate: loc },
    children: [
      {
        id: nextId('vault-box'),
        type: 'box',
        args: { dims: [radius * 2, half(h), d] },
        transform: { translate: [0, mul(h, 0.25), 0] },
      },
      {
        id: nextId('vault-cyl'),
        type: 'cylinder',
        args: { radius, height: d },
        transform: { rotate: [PI / 2, 0, 0], translate: [0, half(h), 0] },
      },
    ],
  };
}

/** cutouts: periodic wall perforation. intersection of 2 reps. */
export function cutouts(loc, offsets, w, h, rot1 = 0, rot2 = 0) {
  const [ox, oy, oz] = offsets;
  return {
    id: nextId('cutouts'),
    type: 'intersection',
    transform: { rotate: [rot2, rot1, 0], translate: loc },
    children: [
      {
        id: nextId('cutouts-tileXY'),
        type: 'rep',
        args: { period: [ox, oy, 0] },
        source: {
          id: nextId('cutouts-boxXY'),
          type: 'box',
          args: { dims: [w, h, oz] },
        },
      },
      {
        id: nextId('cutouts-tileZY'),
        type: 'rep',
        args: { period: [0, oy, ox] },
        source: {
          id: nextId('cutouts-boxZY'),
          type: 'box',
          args: { dims: [oz, h, w] },
        },
      },
    ],
  };
}

// =============================================================================
// Trees
// =============================================================================

/** tree1: cylinder trunk + pulsing sphere crown. */
export function tree1(loc, height, opts = {}) {
  const { breathe = true } = opts;
  const trunkR = mul(height, 0.02);
  const crownR = breathe
    ? add(mul(height, 0.5), sinT(0.075, 1, 0))
    : mul(height, 0.5);
  return {
    id: nextId('tree1'),
    type: 'union',
    transform: { translate: loc },
    children: [
      {
        id: nextId('tree1-trunk'),
        type: 'cylinder',
        args: { radius: trunkR, height },
        transform: { translate: [0, half(height), 0] },
      },
      {
        id: nextId('tree1-crown'),
        type: 'sphere',
        args: { radius: crownR },
        transform: { translate: [0, height, 0] },
      },
    ],
  };
}

/** tree2: cylinder trunk + cone crown (pine). */
export function tree2(loc, height, opts = {}) {
  const { breathe = true } = opts;
  const trunkR = mul(height, 0.015);
  const crownR = breathe
    ? add(mul(height, 0.15), sinT(0.04, 1 / 1.5, 0))
    : mul(height, 0.15);
  return {
    id: nextId('tree2'),
    type: 'union',
    transform: { translate: loc },
    children: [
      {
        id: nextId('tree2-trunk'),
        type: 'cylinder',
        args: { radius: trunkR, height },
        transform: { translate: [0, half(height), 0] },
      },
      {
        id: nextId('tree2-crown'),
        type: 'cone',
        args: { height, baseRadius: crownR },
        transform: { translate: [0, add(half(height), mul(height, 0.6)), 0] },
      },
    ],
  };
}

/** tree3: cylinder trunk + cube crown (geometric). */
export function tree3(loc, height, angle = 0, opts = {}) {
  const { breathe = true } = opts;
  const trunkR = mul(height, 0.02);
  const w = breathe ? add(height, sinT(0.15, 1 / 1.25, 0)) : height;
  return {
    id: nextId('tree3'),
    type: 'union',
    transform: { translate: loc },
    children: [
      {
        id: nextId('tree3-trunk'),
        type: 'cylinder',
        args: { radius: trunkR, height },
        transform: { translate: [0, half(height), 0] },
      },
      {
        id: nextId('tree3-crown'),
        type: 'box',
        args: { dims: [w, w, w] },
        transform: { rotate: [0, angle, 0], translate: [0, height, 0] },
      },
    ],
  };
}

// =============================================================================
// People / animals / birds
// =============================================================================

function applyMovementTranslate(loc, movement) {
  const mvX = movement[0] ? linearT(movement[0]) : 0;
  const mvY = movement[1] ? linearT(movement[1]) : 0;
  const mvZ = movement[2] ? linearT(movement[2]) : 0;
  return [add(loc[0], mvX), add(loc[1], mvY), add(loc[2], mvZ)];
}

/** person1: cone body + sphere head. */
export function person1(loc, height, movement = [0, 0, 0]) {
  const head = mul(height, 0.15);
  return {
    id: nextId('person1'),
    type: 'union',
    transform: { translate: applyMovementTranslate(loc, movement) },
    children: [
      {
        id: nextId('person1-body'),
        type: 'cone',
        args: { height, baseRadius: 0.5 },
        transform: { translate: [0, half(height), 0] },
      },
      {
        id: nextId('person1-head'),
        type: 'sphere',
        args: { radius: head },
        transform: { translate: [0, add(height, head), 0] },
      },
    ],
  };
}

/** person2: box body + sphere head. */
export function person2(loc, height, movement = [0, 0, 0]) {
  const head = mul(height, 0.15);
  return {
    id: nextId('person2'),
    type: 'union',
    transform: { translate: applyMovementTranslate(loc, movement) },
    children: [
      {
        id: nextId('person2-body'),
        type: 'box',
        args: { dims: [0.5, height, 0.5] },
        transform: { translate: [0, half(height), 0] },
      },
      {
        id: nextId('person2-head'),
        type: 'sphere',
        args: { radius: head },
        transform: { translate: [0, add(height, mul(head, 2)), 0] },
      },
    ],
  };
}

/** person3: cylinder body + transverse cylinder head. */
export function person3(loc, height, movement = [0, 0, 0]) {
  const head = mul(height, 0.15);
  return {
    id: nextId('person3'),
    type: 'union',
    transform: { translate: applyMovementTranslate(loc, movement) },
    children: [
      {
        id: nextId('person3-body'),
        type: 'cylinder',
        args: { radius: 0.25, height },
        transform: { translate: [0, half(height), 0] },
      },
      {
        id: nextId('person3-head'),
        type: 'cylinder',
        args: { radius: 0.2, height: head },
        transform: { rotate: [PI / 2, 0, 0], translate: [0, add(height, mul(head, 2.5)), 0] },
      },
    ],
  };
}

/** person4: inverted cone body + sphere head (hourglass). */
export function person4(loc, height, movement = [0, 0, 0]) {
  const head = mul(height, 0.15);
  return {
    id: nextId('person4'),
    type: 'union',
    transform: { translate: applyMovementTranslate(loc, movement) },
    children: [
      {
        id: nextId('person4-body'),
        type: 'cone',
        args: { height, baseRadius: 0.3 },
        transform: { rotate: [PI, 0, 0], translate: [0, half(height), 0] },
      },
      {
        id: nextId('person4-head'),
        type: 'sphere',
        args: { radius: head },
        transform: { translate: [0, add(height, mul(head, 1.5)), 0] },
      },
    ],
  };
}

/** animal1: long box body + sphere head. */
export function animal1(loc, height, speed = 0, rotation = 0) {
  const head = mul(height, 0.25);
  const offset = speed ? linearT(-speed) : 0;
  return {
    id: nextId('animal1'),
    type: 'union',
    transform: {
      rotate: [0, rotation, 0],
      translate: [add(loc[0], offset), loc[1], loc[2]],
    },
    children: [
      {
        id: nextId('animal1-body'),
        type: 'box',
        args: { dims: [mul(height, 1.5), height, 0.25] },
        transform: { translate: [0, half(height), 0] },
      },
      {
        id: nextId('animal1-head'),
        type: 'sphere',
        args: { radius: head },
        transform: { translate: [add(height, head), add(height, head), 0] },
      },
    ],
  };
}

/** animal2: horizontal cylinder body + sphere head. */
export function animal2(loc, height, speed = 0, rotation = 0) {
  const head = mul(height, 0.25);
  const offset = speed ? linearT(-speed) : 0;
  return {
    id: nextId('animal2'),
    type: 'union',
    transform: {
      rotate: [0, rotation, 0],
      translate: [add(loc[0], offset), loc[1], loc[2]],
    },
    children: [
      {
        id: nextId('animal2-body'),
        type: 'cylinder',
        args: { radius: head, height },
        transform: { rotate: [0, 0, PI / 2], translate: [0, add(height, mul(head, -1)), 0] },
      },
      {
        id: nextId('animal2-head'),
        type: 'sphere',
        args: { radius: head },
        transform: { translate: [add(height, mul(head, 2)), add(height, head), 0] },
      },
    ],
  };
}

/** bird1: two crossed cylinders, rep flock. */
export function bird1(loc, len, rotation = 0, speed = 2) {
  const thickness = mul(len, 0.2);
  return {
    id: nextId('bird1'),
    type: 'rep',
    args: { period: [60, 0, 0] },
    transform: { translate: loc },
    source: {
      id: nextId('bird1-body'),
      type: 'union',
      transform: {
        rotate: [0, rotation, 0],
        translate: [linearT(speed), 0, 0],
      },
      children: [
        {
          id: nextId('bird1-cyl1'),
          type: 'cylinder',
          args: { radius: half(thickness), height: len },
          transform: { rotate: [0, 0, -PI / 2] },
        },
        {
          id: nextId('bird1-cyl2'),
          type: 'cylinder',
          args: { radius: half(thickness), height: mul(len, 1.25) },
          // chain: rotateZ(-PI/2) then rotateX(PI/2) then translate
          // In our Euler XYZ convention with rotateXYZ applying X then Y then Z,
          // composing two non-axis rotations as Euler is non-trivial. Approximate
          // as two separate rotates via sequential transform on the GeoData tree.
          // For this case the two rotations result in cyl2 axis pointing along Z.
          // Simpler: directly construct it with that orientation. The body is
          // a cross of horizontal cylinder + transverse one. We use the same
          // final shape as bird1 in autoscope-primitives.js: cyl1 horizontal X,
          // cyl2 horizontal Z, slight z offset.
          transform: { rotate: [PI / 2, 0, -PI / 2], translate: [0, 0, mul(len, 0.33)] },
        },
      ],
    },
  };
}

/** bird2: single horizontal cylinder + Y bobbing. */
export function bird2(loc, len, rotation = 0, speed = 2) {
  const thickness = mul(len, 0.2);
  const bobY = sinT(0.5, speed * 0.25, 0);
  return {
    id: nextId('bird2'),
    type: 'rep',
    args: { period: [60, 0, 0] },
    transform: { translate: loc },
    source: {
      id: nextId('bird2-cyl'),
      type: 'cylinder',
      args: { radius: half(thickness), height: len },
      transform: {
        rotate: [0, rotation, -PI / 2],
        translate: [linearT(speed), bobY, 0],
      },
    },
  };
}

/** bird3: sphere (distant bird, appears as a dot). */
export function bird3(loc, radius, rotation = 0, speed = 2) {
  return {
    id: nextId('bird3'),
    type: 'rep',
    args: { period: [60, 0, 0] },
    transform: { translate: loc },
    source: {
      id: nextId('bird3-ball'),
      type: 'sphere',
      args: { radius },
      transform: {
        rotate: [0, rotation, 0],
        translate: [linearT(speed), 0, 0],
      },
    },
  };
}

/** bird4: small box (silhouette) + Y bobbing. */
export function bird4(loc, radius, rotation = 0, speed = 2) {
  const r = freeze(radius);
  const bobY = sinT(0.5, speed * 0.25, 0);
  return {
    id: nextId('bird4'),
    type: 'rep',
    args: { period: [60, 0, 0] },
    transform: { translate: loc },
    source: {
      id: nextId('bird4-box'),
      type: 'box',
      args: { dims: [r, r * 0.25, r * 0.25] },
      transform: {
        rotate: [0, rotation, 0],
        translate: [linearT(speed), bobY, 0],
      },
    },
  };
}

// =============================================================================
// Special
// =============================================================================

/** backdrop: distant wall (creates silhouette framing in autoscope). */
export function backdrop(z) {
  return {
    id: nextId('backdrop'),
    type: 'box',
    args: { dims: [400, 400, 0.1] },
    transform: { translate: [0, 0, z] },
  };
}

/** autoscope-style pyramid: dims-controlled base + Y rotation. */
export function autoscopePyramid(loc, dims, rotation = 0) {
  const [w, h, d] = dims;
  return {
    id: nextId('autoscopePyramid'),
    type: 'pyramid',
    args: { height: h },
    transform: {
      scale: [w, 1, d],
      rotate: [0, rotation, 0],
      translate: loc,
    },
  };
}

/** autoscope-style cone: loc + radius + height (different signature than d3.cone). */
export function autoscopeCone(loc, radius, height) {
  return {
    id: nextId('autoscopeCone'),
    type: 'cone',
    args: { height, baseRadius: radius },
    transform: { translate: [loc[0], add(loc[1], half(height)), loc[2]] },
  };
}

/** waves: time-aware wave surface (sea/lake ground). Already a registry primitive. */
export function wavesData(freq = 2, amp = 0.5, angle = 0, speed = 0) {
  return {
    id: nextId('waves'),
    type: 'waves',
    args: { freq, amp, angle, speed },
  };
}
