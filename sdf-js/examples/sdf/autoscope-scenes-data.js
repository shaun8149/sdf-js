// =============================================================================
// autoscope-scenes-data —— SceneData-emitter twin of autoscope-scenes.js
// -----------------------------------------------------------------------------
// 6 scene generators returning full SceneData objects (not SDF3 instances).
// Each scene uses the same PRNG as the Direct-SDF version, so same hash →
// equivalent scene composition. Visual parity is the M0 Day 5 validation gate.
//
// Differences from autoscope-scenes.js:
//   - Returns { v: 1, subjects[], ground, defaults } not SDF3
//   - Ground: flat → SceneData.ground field; waves/slanted → pushed as Subject
//   - Camera / light / shadow defaults baked per scene (PRNG-randomized mode)
//   - Resets primitive id counter at scene start to keep ids deterministic per hash
// =============================================================================

import {
  boxE, cylinderE, houseP, houseC, houseS,
  arch, arch2, vault, cutouts,
  tree1, tree2, tree3,
  person1, person2, person3, person4,
  animal1, animal2,
  bird1, bird2, bird3, bird4,
  backdrop, autoscopePyramid, autoscopeCone, wavesData,
  resetIdCounter,
} from './autoscope-primitives-data.js';
import { linearT, sinT, sumT } from '../../src/sdf/time.js';

const PI = Math.PI;

// =============================================================================
// Helper Subject constructors for ad-hoc primitives used in scenes
// (sphere, plain box, plain cylinder, plain tri_prism — autoscope-scenes uses
// these for decorative bits that aren't wrapped in helper functions.)
// =============================================================================

let _adhocCounter = 0;
function adhocId(prefix) {
  return `adhoc-${prefix}-${++_adhocCounter}`;
}

function resetAdhocCounter() { _adhocCounter = 0; }

function adhocSphere(radius, translate) {
  return { id: adhocId('sphere'), type: 'sphere', args: { radius }, transform: { translate } };
}

function adhocBox(dims, translate) {
  return { id: adhocId('box'), type: 'box', args: { dims }, transform: { translate } };
}

function adhocCylinder(radius, height, transform) {
  return { id: adhocId('cylinder'), type: 'cylinder', args: { radius, height }, transform };
}

function adhocTriPrism(halfWidth, halfLength, translate) {
  return { id: adhocId('tri_prism'), type: 'tri_prism', args: { halfWidth, halfLength }, transform: { translate } };
}

// =============================================================================
// Ground variants
// -----------------------------------------------------------------------------
// SceneData has a top-level `ground: { y, region }` only for flat horizontal
// planes. For waves / slanted ground, push as a subject instead.
// =============================================================================

function groundFlatField() {
  // autoscope uses y=0; convert to SceneData ground (still flat horizontal)
  return { y: 0, region: 'ground' };
}

function groundSlantSubject(slopeZ = 0.05) {
  // tilted plane: normal=[0, -1, slopeZ] in autoscope coords. Best-effort.
  // We don't have a tilted-plane primitive in spec; use a massive thin box
  // rotated slightly. For Day 5 we keep it simple as a slightly-tilted box.
  return {
    id: adhocId('groundSlant'),
    type: 'box',
    args: { dims: [200, 0.1, 200] },
    transform: { rotate: [Math.atan(slopeZ), 0, 0], translate: [0, -0.05, 0] },
    region: 'ground',
  };
}

function groundWavesSubject(rng, opts = {}) {
  const freq = opts.freq ?? rng.random_num(2, 4);
  const amp = opts.amp ?? rng.random_num(0.33, 1);
  const angle = opts.angle ?? rng.random_angle();
  const speed = opts.speed ?? rng.random_num(0.1, 0.5);
  return { ...wavesData(freq, amp, angle, speed), region: 'water' };
}

// =============================================================================
// Subject populators (mountains / inhabitants / birds) — match autoscope-scenes.js
// =============================================================================

function mountainsParts(rng, count) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const pos = [rng.random_num(-15, 15), 0, rng.random_num(75, 150)];
    if (rng.random_bool(0.5)) {
      parts.push(autoscopeCone(pos, rng.random_num(10, 25), rng.random_num(1, 10)));
    } else {
      parts.push(autoscopePyramid(pos, [rng.random_num(10, 20), rng.random_num(1, 10), rng.random_num(10, 20)], rng.random_angle()));
    }
  }
  return parts;
}

function inhabitantsParts(rng, count) {
  const parts = [];
  const types = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 4, 5];
  for (let i = 0; i < count; i++) {
    const t = rng.random_choice(types);
    const pos = [rng.random_num(-15, 15), 0, rng.random_num(-20, 5)];
    const h = rng.random_num(1, 2.2);
    let movement = [0, 0, 0];
    if (rng.random_bool(0.05)) {
      movement = [rng.random_num(-0.25, 0.25), 0, rng.random_num(-0.25, 0.25)];
    }
    if (t === 0) parts.push(person1(pos, h, movement));
    else if (t === 1) parts.push(person2(pos, h, movement));
    else if (t === 2) parts.push(person3(pos, h, movement));
    else if (t === 3) parts.push(person4(pos, h, movement));
    else if (t === 4) parts.push(animal1(pos, rng.random_num(0.25, 1.25), Math.abs(movement[0]), rng.random_angle()));
    else parts.push(animal2(pos, rng.random_num(0.25, 1), Math.abs(movement[0]), rng.random_angle()));
  }
  return parts;
}

function birdsParts(rng, count) {
  const parts = [];
  let types = [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 3];
  if (rng.random_bool(0.05)) types = [rng.random_choice([0, 1, 2, 3])];
  for (let i = 0; i < count; i++) {
    const t = rng.random_choice(types);
    const pos = [rng.random_num(-10, 10), rng.random_num(4, 13), rng.random_num(-5, 15)];
    const speed = rng.random_num(2, 8);
    const rot = rng.random_angle();
    if (t === 0) parts.push(bird1(pos, rng.random_num(0.05, 0.4), rot, speed));
    else if (t === 1) parts.push(bird2(pos, rng.random_num(0.1, 0.6), rot, speed));
    else if (t === 2) parts.push(bird3([pos[0], rng.random_num(6, 13), pos[2]], 0.2, rot, rng.random_num(2, 12)));
    else parts.push(bird4([pos[0], rng.random_num(0, 13), pos[2]], 1, rot, rng.random_num(2, 12)));
  }
  return parts;
}

// =============================================================================
// Defaults factory — picks per-scene camera / light / shadow from PRNG
// -----------------------------------------------------------------------------
// Autoscope-clone INITIAL_CAM is { position: [0, 3, -15], yaw: 0, pitch: 0.30 }
// → in spherical: distance ≈ 15.3, pitch ≈ 0.2, target ≈ (0, 0, 0).
// We pass `rng` so shadow mode is hash-deterministic.
// =============================================================================

const SHADOW_MODES = ['channelSwap', 'hueRotate180', 'hueRotate90', 'darken'];

function makeDefaults(rng, opts = {}) {
  const distance = opts.cameraDistance ?? 15;
  const pitch = opts.cameraPitch ?? 0.2;

  // PRNG-pick camera animation mode — autoscope u_animation 1-9 spirit.
  // Distribution: 25% static, 25% yaw oscillation, 20% targetZ dolly, 15% slow zoom,
  // 15% light azimuth swing (extra). Subject anim continues underneath either way.
  const animMode = rng.random_choice(['static', 'yaw', 'yaw', 'dolly', 'dolly', 'zoom', 'lightSwing']);
  const cameraAnimation = [];
  const lightAnimation = [];

  if (animMode === 'yaw') {
    // slow back-and-forth orbit (±0.4 rad over ~50s period)
    const amp = rng.random_num(0.25, 0.45);
    cameraAnimation.push({ channel: 'yaw', value: sinT(amp, 0.12, 0) });
  } else if (animMode === 'dolly') {
    // targetZ creep forward (slowly reveal what's behind subjects)
    const speed = rng.random_num(0.15, 0.35) * (rng.random_bool(0.85) ? 1 : -1);
    cameraAnimation.push({ channel: 'targetZ', value: linearT(speed) });
  } else if (animMode === 'zoom') {
    // gentle distance oscillation (zoom in / out cycle ~30s)
    const amp = rng.random_num(1.5, 3.0);
    cameraAnimation.push({ channel: 'distance', value: sumT(distance, sinT(amp, 0.2, 0)) });
  }

  // 15% of scenes also get a slow light azimuth swing (independent of camera mode)
  if (animMode === 'lightSwing' || rng.random_bool(0.15)) {
    const amp = rng.random_num(0.3, 0.6);
    lightAnimation.push({ channel: 'azimuth', value: sumT(rng.random_num(0.3, 0.7), sinT(amp, 0.08, 0)) });
  }

  return {
    camera: {
      yaw: 0,
      pitch,
      distance,
      focal: 1.5,
      targetX: 0, targetY: opts.cameraTargetY ?? 1, targetZ: 0,
      ...(cameraAnimation.length ? { animation: cameraAnimation } : {}),
    },
    light: {
      azimuth: rng.random_num(0.2, 0.8),
      altitude: rng.random_num(0.5, 1.0),
      distance: 50,
      ...(lightAnimation.length ? { animation: lightAnimation } : {}),
    },
    shadow: {
      enabled: true,
      mode: rng.random_choice(SHADOW_MODES),
      strength: rng.random_num(0.25, 0.5),
    },
  };
}

// =============================================================================
// Scene 0: City — 15-30 buildings + backdrop + mountains + people + birds
// =============================================================================

export function scene0_city_data(rng, opts = {}) {
  resetIdCounter(); resetAdhocCounter();
  const subjects = [];

  const buildings = rng.random_int(15, 30);
  const objectTypes = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4];

  for (let i = 0; i < buildings; i++) {
    const t = rng.random_choice(objectTypes);
    const back = rng.random_num(20, 60);
    const left = rng.random_num(-5, -20);
    const right = rng.random_num(5, 20);
    const pos = rng.random_bool(0.5)
      ? [rng.random_bool(0.5) ? left : right, 0, rng.random_num(-10, back)]
      : [rng.random_num(left, right), 0, back];

    if (t === 0) subjects.push(boxE(pos, [rng.random_num(2, 6), rng.random_num(4, 20), rng.random_num(2, 6)]));
    else if (t === 1) subjects.push(houseS(pos, [3 * rng.random_int(1, 2), rng.random_num(5, 20), 3 * rng.random_int(1, 2)], rng.random_angle()));
    else if (t === 2) subjects.push(houseP(pos, [3 * rng.random_int(1, 2), rng.random_num(5, 20), 3 * rng.random_int(1, 2)], rng.random_num(3, 6), rng.random_angle()));
    else if (t === 3) subjects.push(arch2(pos, [rng.random_num(4, 8), rng.random_num(2, 16), rng.random_num(2, 20)], 0));
    else subjects.push(arch(pos, [rng.random_num(4, 8), rng.random_num(2, 16), rng.random_num(2, 20)], 0));
  }

  if (rng.random_bool(0.5)) subjects.push(backdrop(80.1));
  if (rng.random_bool(0.5)) subjects.push(...mountainsParts(rng, rng.random_int(2, 9)));
  subjects.push(...inhabitantsParts(rng, rng.random_int(4, 12)));
  subjects.push(...birdsParts(rng, rng.random_int(2, 8)));

  return {
    v: 1,
    name: 'City',
    subjects,
    ground: groundFlatField(),
    defaults: makeDefaults(rng),
  };
}

// =============================================================================
// Scene 1: Sea — wavy ground + occasional islands + mountains
// =============================================================================

export function scene1_sea_data(rng, opts = {}) {
  resetIdCounter(); resetAdhocCounter();
  const subjects = [];

  // Wavy ground as time-aware primitive subject (not SceneData.ground field)
  subjects.push(groundWavesSubject(rng));

  if (rng.random_bool(0.2)) {
    const angle = rng.random_num(0.1, 0.5) * (rng.random_bool(0.5) ? 1 : -1);
    subjects.push(adhocCylinder(rng.random_num(0.1, 0.4), rng.random_num(5, 15), {
      rotate: [angle, 0, 0],
      translate: [rng.random_num(-10, 10), 0, rng.random_num(5, 20)],
    }));
  } else if (rng.random_bool(0.1)) {
    subjects.push(autoscopeCone([rng.random_num(-14, 14), -1, rng.random_num(5, 25)], rng.random_num(0.5, 2), rng.random_num(5, 15)));
  } else if (rng.random_bool(0.15)) {
    subjects.push(cylinderE([rng.random_num(-10, 10), 0, rng.random_num(5, 20)], rng.random_num(7.5, 25), rng.random_num(1, 4)));
  }

  if (rng.random_bool(0.1)) {
    const w = rng.random_choice([10, 20, 50, 100]);
    const h = rng.random_choice([4, 8]);
    const d = rng.random_choice([10, 20, 40]);
    subjects.push(boxE([0, 0, rng.random_num(-40, 40)], [w, h, d]));
  }
  if (rng.random_bool(0.15)) {
    subjects.push(adhocSphere(rng.random_num(0.25, 0.75), [rng.random_num(-10, 10), 0.1, rng.random_num(0, 5)]));
  }

  subjects.push(...mountainsParts(rng, rng.random_int(3, 12)));
  if (rng.random_bool(0.25)) subjects.push(...birdsParts(rng, rng.random_int(1, 6)));

  return {
    v: 1,
    name: 'Sea',
    subjects,
    ground: null,  // wavy water surface IS the ground
    defaults: makeDefaults(rng, { cameraPitch: 0.15, cameraTargetY: 0.5 }),
  };
}

// =============================================================================
// Scene 2: Forest — trees + occasional house + mountains + birds
// =============================================================================

export function scene2_forest_data(rng, opts = {}) {
  resetIdCounter(); resetAdhocCounter();
  const subjects = [];

  // ground: 75% waves, 25% flat / slant
  let groundField = null;
  if (rng.random_bool(0.75)) {
    subjects.push(wavesData(rng.random_num(2, 8), rng.random_num(0.5, 0.5), rng.random_angle(), 0));
  } else if (rng.random_bool(0.8)) {
    groundField = groundFlatField();
  } else {
    subjects.push(groundSlantSubject(0.05));
  }

  let treeCount = rng.random_int(4, 12);
  let treeTypes = [0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 4];
  if (rng.random_bool(0.3)) {
    treeTypes = [3, 3, 3, 3, 3, 3, 3, 3, 1, 4];
    treeCount *= 3;
  }

  for (let i = 0; i < treeCount; i++) {
    const t = rng.random_choice(treeTypes);
    const pos = [rng.random_int(-12, 12), 0, rng.random_int(10, 40)];
    if (t === 0) subjects.push(tree1(pos, rng.random_num(3, 10)));
    else if (t === 1) subjects.push(tree2(pos, rng.random_num(8, 20)));
    else if (t === 2) {
      const tr = rng.random_num(0.5, 1.5);
      subjects.push(adhocSphere(tr, [rng.random_int(-12, 12), tr * rng.random_num(0.3, 0.5), rng.random_int(10, 40)]));
    } else if (t === 3) {
      subjects.push(cylinderE([rng.random_int(-15, 15), 0, rng.random_int(-40, 40)], 30, rng.random_num(0.15, 0.3)));
    } else if (t === 4) {
      subjects.push(tree3([rng.random_int(-12, 12), 0, rng.random_int(10, 40)], rng.random_num(5, 12), rng.random_angle()));
    }
  }

  if (rng.random_bool(0.33)) {
    if (rng.random_bool(0.5)) {
      subjects.push(houseS([rng.random_num(-10, 10), 0, rng.random_num(-5, 30)], [rng.random_num(3, 5), 3, rng.random_num(3, 9)], rng.random_angle()));
    } else {
      subjects.push(houseP([rng.random_num(-10, 10), 0, rng.random_num(-5, 30)], [3 * rng.random_int(1, 4), rng.random_num(3, 6), 3 * rng.random_int(1, 3)], 3, rng.random_angle()));
    }
  }

  subjects.push(...mountainsParts(rng, rng.random_int(4, 13)));
  if (rng.random_bool(0.67)) subjects.push(...inhabitantsParts(rng, rng.random_int(1, 6)));
  subjects.push(...birdsParts(rng, rng.random_int(3, 11)));

  return {
    v: 1,
    name: 'Forest',
    subjects,
    ground: groundField,
    defaults: makeDefaults(rng),
  };
}

// =============================================================================
// Scene 3: Village — 1-9 houses + occasional trees + birds
// =============================================================================

export function scene3_village_data(rng, opts = {}) {
  resetIdCounter(); resetAdhocCounter();
  const subjects = [];

  const buildings = rng.random_int(1, 9);
  for (let i = 0; i < buildings; i++) {
    const t = rng.random_choice([0, 0, 0, 1, 1, 1, 1, 2, 3]);
    const pos = [rng.random_num(-20, 20), 0, rng.random_num(-5, 40)];
    if (t === 0) subjects.push(houseS(pos, [rng.random_num(3, 5), 3, rng.random_num(3, 20)], rng.random_angle()));
    else if (t === 1) subjects.push(houseP(pos, [3 * rng.random_int(1, 4), rng.random_num(3, 6), 3 * rng.random_int(1, 3)], 3, rng.random_angle()));
    else if (t === 2) subjects.push(houseP(pos, [3 * rng.random_int(1, 2), rng.random_num(5, 20), 3 * rng.random_int(1, 2)], rng.random_num(3, 6), rng.random_angle()));
    else subjects.push(houseC(pos, [3 * rng.random_int(1, 4), rng.random_num(3, 6)], rng.random_num(3, 6)));
  }

  if (rng.random_bool(0.1)) {
    subjects.push({
      ...boxE([rng.random_num(-20, 20), 0, rng.random_num(-5, 40)], [3 * rng.random_int(2, 4), rng.random_num(6, 9), rng.random_int(1, 9)]),
      transform: {
        ...(boxE([0, 0, 0], [1, 1, 1]).transform || {}),
        rotate: [0, rng.random_angle(), 0],
      },
    });
  }
  if (rng.random_bool(0.2)) {
    subjects.push(cylinderE([rng.random_num(-20, 20), 0, rng.random_num(-5, 40)], rng.random_num(4, 20), 0.2));
  }

  if (rng.random_bool(0.33)) {
    const treeCount = rng.random_int(1, 4);
    for (let i = 0; i < treeCount; i++) {
      const t = rng.random_choice([0, 0, 0, 0, 0, 1, 1, 1, 2, 3, 4]);
      const pos = [rng.random_num(-12, 12), 0, rng.random_num(10, 40)];
      if (t === 0) subjects.push(tree1(pos, rng.random_num(3, 10)));
      else if (t === 1) subjects.push(tree2(pos, rng.random_num(8, 20)));
      else if (t === 2) {
        const tr = rng.random_num(0.5, 1.5);
        subjects.push(adhocSphere(tr, [pos[0], tr * 0.3, pos[2]]));
      } else if (t === 3) {
        subjects.push(cylinderE([rng.random_num(-15, 15), 0, rng.random_num(-40, 40)], 30, rng.random_num(0.15, 0.3)));
      } else {
        subjects.push(tree3([rng.random_int(-12, 12), 0, rng.random_int(10, 40)], rng.random_num(5, 12), rng.random_angle()));
      }
    }
  }

  if (rng.random_bool(0.5)) subjects.push(...mountainsParts(rng, rng.random_int(2, 9)));
  subjects.push(...inhabitantsParts(rng, rng.random_int(1, 6)));
  if (rng.random_bool(0.25)) subjects.push(...birdsParts(rng, rng.random_int(1, 6)));

  return {
    v: 1,
    name: 'Village',
    subjects,
    ground: groundFlatField(),
    defaults: makeDefaults(rng),
  };
}

// =============================================================================
// Scene 4: City axis — 3-14 mixed + occasional arch colonnades
// =============================================================================

export function scene4_axis_data(rng, opts = {}) {
  resetIdCounter(); resetAdhocCounter();
  const subjects = [];

  // ground: 80% flat, 20% slight slant
  let groundField = null;
  if (rng.random_bool(0.8)) {
    groundField = groundFlatField();
  } else {
    subjects.push(groundSlantSubject(0.025));
  }

  const buildings = rng.random_int(3, 14);
  let objectTypes;

  if (rng.random_bool(0.33)) {
    objectTypes = [0, 0, 0, 1, 3];
    if (rng.random_bool(0.15)) {
      const boxes = rng.random_choice([1, 1, 1, 2]);
      for (let i = 0; i < boxes; i++) {
        const ang = rng.random_angle();
        const pos = [rng.random_num(-30, 30), 0, rng.random_num(-10, 10)];
        const dims = [rng.random_num(1, 15), rng.random_num(0.5, 2.5), 1];
        const b = boxE([0, 0, 0], dims);
        // override transform with rotate + custom translate
        subjects.push({
          ...b,
          transform: {
            rotate: [0, ang, 0],
            translate: pos,
          },
        });
      }
    }
  } else {
    objectTypes = [0, 0, 0, 0, 0, 1, 1, 2, 2, 4];
  }
  if (rng.random_bool(0.2)) objectTypes = [rng.random_choice([0, 1, 2, 3, 4])];

  for (let i = 0; i < buildings; i++) {
    const t = rng.random_choice(objectTypes);
    const pos = [rng.random_num(-15, 15), 0, rng.random_num(0, 70)];
    if (t === 0) subjects.push(boxE(pos, [rng.random_num(2, 6), rng.random_num(4, 20), rng.random_num(2, 6)]));
    else if (t === 1) subjects.push(cylinderE([pos[0], 0, pos[2]], rng.random_num(10, 50), 0.2));
    else if (t === 2) subjects.push(houseP(pos, [3 * rng.random_int(1, 2), rng.random_num(5, 20), 3 * rng.random_int(1, 2)], rng.random_num(3, 6), rng.random_angle()));
    else if (t === 3) subjects.push(arch2([rng.random_num(-10, 10), 0, rng.random_num(-5, 15)], [rng.random_num(4, 8), rng.random_num(2, 16), rng.random_num(2, 20)], 0));
    else {
      // arch colonnade: rep wrapper around arch
      const archW = rng.random_num(2, 6);
      const archH = rng.random_num(3, 10);
      const repCount = rng.random_choice([0, 0, 1, 10, 20]);
      const archUnit = arch([0, 0, 0], [archW, archH, rng.random_num(2, 5)], 0);
      const outerTransform = {
        rotate: [0, rng.random_angle(), 0],
        translate: [rng.random_num(-20, 20), 0, rng.random_num(20, 40)],
      };
      if (repCount === 0) {
        subjects.push({ ...archUnit, transform: { ...(archUnit.transform || {}), ...outerTransform } });
      } else {
        subjects.push({
          id: `axis-arch-rep-${i}`,
          type: 'rep',
          args: { period: [archW * 2, 0, 0], count: [repCount, 0, 0] },
          transform: outerTransform,
          source: { ...archUnit, transform: { translate: [0, 0, 0] } },
        });
      }
    }
  }

  if (rng.random_bool(0.5)) subjects.push(...mountainsParts(rng, rng.random_int(2, 9)));
  subjects.push(...inhabitantsParts(rng, rng.random_int(1, 6)));
  if (rng.random_bool(0.25)) subjects.push(...birdsParts(rng, rng.random_int(1, 4)));

  return {
    v: 1,
    name: 'City axis',
    subjects,
    ground: groundField,
    defaults: makeDefaults(rng),
  };
}

// =============================================================================
// Scene 5: Abstract — cursor walk stacking primitives
// =============================================================================

export function scene5_abstract_data(rng, opts = {}) {
  resetIdCounter(); resetAdhocCounter();
  const subjects = [];

  // ground: 80% flat, 20% slant
  let groundField = null;
  if (rng.random_bool(0.8)) {
    groundField = groundFlatField();
  } else {
    subjects.push(groundSlantSubject(0.05));
  }

  const jobCount = rng.random_choice([1, 2, 3]);
  for (let j = 0; j < jobCount; j++) {
    const cursor = [rng.random_num(-4, 4), 0, rng.random_num(-4, 4)];
    const steps = rng.random_int(4, 16);
    for (let i = 0; i < steps; i++) {
      const dims = [rng.random_num(2, 5), rng.random_num(2, 6), rng.random_num(2, 12)];
      const t = rng.random_choice([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3]);
      const pos = [...cursor];
      if (t === 0) {
        subjects.push(adhocBox([...dims], pos));
      } else if (t === 1) {
        dims[0] *= 0.25; dims[1] *= 0.25; dims[2] *= 0.25;
        subjects.push(adhocSphere(dims[0], pos));
      } else if (t === 2) {
        dims[0] *= 0.5;
        subjects.push(adhocCylinder(dims[0], dims[1], { translate: pos }));
      } else {
        dims[0] *= 0.5;
        subjects.push(adhocTriPrism(dims[0], dims[1], pos));
      }
      cursor[0] += rng.random_int(-Math.floor(dims[0] * 0.8), Math.floor(dims[0] * 0.8));
      cursor[1] += rng.random_int(-Math.floor(dims[1] * 0.5), Math.floor(dims[1] * 0.8));
      cursor[2] += rng.random_int(-Math.floor(dims[2] * 0.8), Math.floor(dims[2] * 0.8));
    }
  }

  if (rng.random_bool(0.5)) subjects.push(...mountainsParts(rng, rng.random_int(0, 9)));

  return {
    v: 1,
    name: 'Abstract',
    subjects,
    ground: groundField,
    defaults: makeDefaults(rng),
  };
}

// =============================================================================
// Dispatcher
// =============================================================================

const SCENE_DATA_FNS = [
  scene0_city_data, scene1_sea_data, scene2_forest_data,
  scene3_village_data, scene4_axis_data, scene5_abstract_data,
];

export const SCENE_NAMES_DATA = ['City', 'Sea', 'Forest', 'Village', 'City axis', 'Abstract'];

export function generateSceneData(sceneType, rng, opts = {}) {
  const n = SCENE_DATA_FNS.length;
  const idx = ((sceneType | 0) % n + n) % n;
  return SCENE_DATA_FNS[idx](rng, opts);
}

export function randomSceneTypeData(rng) {
  return rng.random_choice([0, 0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5]);
}
