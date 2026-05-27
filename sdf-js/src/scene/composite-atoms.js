// =============================================================================
// composite-atoms.js — scene-level composite atoms (Track 5.4a)
// -----------------------------------------------------------------------------
// "Composite atom" = a single subject `type` that compile-time-expands into
// multiple peer subjects (each with their own variants[] / material /
// transform). Distinct from PRIMITIVE_FACTORIES (single-SDF atoms like
// `tree-pine` or `cottage`): a composite atom returns a CONSTELLATION.
//
// Pipeline position:
//
//   SceneData (LLM lifted, may contain composite types)
//          ↓ expandCompositeAtoms()  ← THIS FILE
//   SceneData with composite subjects replaced by peer subjects + sea + cinematic
//          ↓ expandVariants(rng)    (Generator-S Phase 1/2)
//          ↓ compile()              (validator + SDF assembly)
//
// vs v3.11 Scene completion (prompt cheatsheet):
//   - v3.11 path: LLM emits ~6-12 lines of variants[] specs by hand.
//     Pros: combinatorial flexibility, LLM picks subjects per prompt.
//     Cons: token cost, requires byte-precision Example 15.
//   - 5.4a path: LLM emits ONE line `type: 'carrier-strike-group'`.
//     Pros: 1-token emit, curated quality, reusable.
//     Cons: hand-curated structure, less variation per call.
//
// Both paths coexist (v3.12 prompt does NOT remove v3.11 scene-completion
// table). The LLM picks: composite atom for canonical scenes, hand-emit
// when the scene needs non-standard structure.
// =============================================================================

const COMPOSITE_ATOM_FACTORIES = {
  'carrier-strike-group': carrierStrikeGroupAtom,
  'airport-apron':        airportApronAtom,
  'harbor-quay':          harborQuayAtom,
  'concert-stage':        concertStageAtom,   // v3.15 leisure
};

export const COMPOSITE_ATOM_TYPES = new Set(Object.keys(COMPOSITE_ATOM_FACTORIES));

/**
 * Walk SceneData.subjects, replace any composite-atom subjects with their
 * expanded peer subjects (+ optional cinematic patches to defaults/volumes).
 * Returns a NEW SceneData. Idempotent: scenes without composite types are
 * returned unchanged (zero alloc beyond the spread).
 *
 * @param {SceneData} scene
 * @returns {SceneData}
 */
export function expandCompositeAtoms(scene) {
  if (!scene || !Array.isArray(scene.subjects)) return scene;
  const anyComposite = scene.subjects.some(s => s && COMPOSITE_ATOM_TYPES.has(s.type));
  if (!anyComposite) return scene;

  const newSubjects = [];
  const accumPostFx = {};
  const accumCameraExt = {};
  const accumVolumes = [];

  for (const subj of scene.subjects) {
    if (!subj || !COMPOSITE_ATOM_TYPES.has(subj.type)) {
      newSubjects.push(subj);
      continue;
    }
    const factory = COMPOSITE_ATOM_FACTORIES[subj.type];
    const expansion = factory(subj.args || {});
    // Each composite atom returns:
    //   { subjects: Subject[], postFx?: {...}, cameraExt?: {...}, volumes?: [...] }
    for (const s of expansion.subjects) newSubjects.push(s);
    if (expansion.postFx)    Object.assign(accumPostFx,    expansion.postFx);
    if (expansion.cameraExt) Object.assign(accumCameraExt, expansion.cameraExt);
    if (Array.isArray(expansion.volumes)) accumVolumes.push(...expansion.volumes);
  }

  // Merge cinematic patches into scene defaults / volumes (atom doesn't
  // overwrite existing fields — author's explicit values win).
  const out = { ...scene, subjects: newSubjects };
  const hasPostFx    = Object.keys(accumPostFx).length > 0;
  const hasCameraExt = Object.keys(accumCameraExt).length > 0;
  const hasVolumes   = accumVolumes.length > 0;

  if (hasPostFx || hasCameraExt) {
    out.defaults = { ...(scene.defaults || {}) };
    if (hasPostFx) {
      out.defaults.postFx = { ...accumPostFx, ...(scene.defaults?.postFx || {}) };
    }
    if (hasCameraExt) {
      out.defaults.camera = { ...(scene.defaults?.camera || {}), ...accumCameraExt };
      // User-set camera fields win over atom defaults — re-merge keeping
      // explicit author values:
      for (const k of Object.keys(scene.defaults?.camera || {})) {
        if (scene.defaults.camera[k] !== undefined) out.defaults.camera[k] = scene.defaults.camera[k];
      }
    }
  }
  if (hasVolumes) {
    out.volumes = [ ...accumVolumes, ...(Array.isArray(scene.volumes) ? scene.volumes : []) ];
  }
  return out;
}

// =============================================================================
// carrier-strike-group
// =============================================================================
//
// Args (all optional):
//   escortCount     (4)     — N destroyer-class escorts
//   escortSpread    ([120,80]) — rectXZ region size
//   separation      (25)    — minimum distance between escorts
//   birdCount       (6)     — N gulls scattered overhead
//   cloudCount      (3)     — N cloud-puffs in distant sky
//   sea             (true)  — auto-add waves subject if not present
//   cinematic       (true)  — auto-patch postFx + camera.aperture + 1 fog
//
// Output: 3-5 peer subjects (escort, gull, cloud, optional sea) + cinematic.

function carrierStrikeGroupAtom(args = {}) {
  const escortCount  = args.escortCount  ?? 4;
  const escortSpread = args.escortSpread ?? [120, 80];
  const separation   = args.separation   ?? 25;
  const birdCount    = args.birdCount    ?? 6;
  const cloudCount   = args.cloudCount   ?? 3;
  const withSea      = args.sea          !== false;
  const withCine     = args.cinematic    !== false;

  const subjects = [];

  // Escort destroyer prototype (hull + deck + bridge), scattered via Generator-S.
  subjects.push({
    id: 'escort-destroyer',
    type: 'union',
    children: [
      { id: 'esc-hull',   type: 'box',
        args: { dims: [10, 1.4, 2.2] },
        transform: { translate: [0, -0.2, 0] },
        material: 'matte-black' },
      { id: 'esc-deck',   type: 'box',
        args: { dims: [9.5, 0.3, 2.5] },
        transform: { translate: [0, 0.7, 0] },
        material: 'stone' },
      { id: 'esc-bridge', type: 'rounded_box',
        args: { dims: [1.5, 1.6, 1.3], cornerR: 0.1 },
        transform: { translate: [0.5, 1.7, 0] } },
    ],
    transform: { translate: [0, 0, 0] },
    variants: [{
      op: 'scatter', count: escortCount,
      region: { type: 'rectXZ', center: [0, 0, 0], size: escortSpread },
      separation,
      heading: { jitter: 0.4 },
      scale:     { jitter: 0.15 },
      translate: { jitter: [3, 0, 3] },
    }],
  });

  // Gulls overhead
  subjects.push({
    id: 'gull',
    type: 'bird-silhouette',
    args: { bodyLength: 0.22, wingSpan: 0.6 },
    transform: { translate: [0, 8, 0] },
    variants: [{
      op: 'scatter', count: birdCount,
      region: { type: 'box3', center: [0, 9, 0], size: [80, 4, 50] },
      scale:     { jitter: 0.20 },
      translate: { jitter: [2, 0.5, 2] },
    }],
  });

  // Distant cloud puffs
  subjects.push({
    id: 'cloud',
    type: 'cloud-puff',
    args: { scale: 1.6 },
    transform: { translate: [0, 14, -30] },
    variants: [{
      op: 'scatter', count: cloudCount,
      region: { type: 'box3', center: [0, 14, -25], size: [60, 2, 8] },
      scale: { jitter: 0.35 },
    }],
  });

  // Sea (peer level — singletons, not scattered)
  if (withSea) {
    subjects.push({
      id: 'sea',
      type: 'waves',
      args: { freq: 3.5, amp: 0.18, angle: 0.3, speed: 0.8 },
      transform: { translate: [0, -1.2, 0] },
      material: { hue: 0.58, sat: 0.65, value: 0.45, kind: 'sea' },
    });
  }

  const result = { subjects };
  if (withCine) {
    result.postFx = {
      exposure: 1.1, bloomMix: 0.25, vignetteStrength: 0.4, lensFlareStrength: 0.15,
    };
    result.cameraExt = { aperture: 0.6, focalDistance: 55 };
    result.volumes = [{
      id: 'sea-fog',
      kind: 'fog',
      center: [0, 4, -25],
      size: [200, 12, 100],
      density: 0.06,
      color: [0.85, 0.90, 0.95],
    }];
  }
  return result;
}

// =============================================================================
// airport-apron
// =============================================================================
//
// Args:
//   parkedPlaneCount   (4)     — N parked planes via array
//   parkedPlaneSpacing (8)     — meters between planes
//   groundVehicleCount (3)     — N tugs/fuel trucks scattered
//   lampCount          (12)    — N runway edge lamps via array
//   lampSpacing        (4)     — meters between lamps
//   cinematic          (true)
//
// Output: parked-plane + ground-vehicle + runway-lamp peer subjects + cinematic.

function airportApronAtom(args = {}) {
  const parkedPlaneCount   = args.parkedPlaneCount   ?? 4;
  const parkedPlaneSpacing = args.parkedPlaneSpacing ?? 8;
  const groundVehicleCount = args.groundVehicleCount ?? 3;
  const lampCount          = args.lampCount          ?? 12;
  const lampSpacing        = args.lampSpacing        ?? 4;
  const withCine           = args.cinematic          !== false;

  const subjects = [];

  // Parked plane prototype (simple body + tail). Array along z (apron line).
  subjects.push({
    id: 'parked-plane',
    type: 'union',
    children: [
      { id: 'pp-body',  type: 'capsule',
        args: { a: [0, 0, -2.2], b: [0, 0, 2.2], radius: 0.6 },
        transform: { translate: [0, 0.6, 0] },
        material: 'matte-white' },
      { id: 'pp-wing-l', type: 'box',
        args: { dims: [4.2, 0.15, 0.7] },
        transform: { translate: [-2.0, 0.6, 0.2] } },
      { id: 'pp-wing-r', type: 'box',
        args: { dims: [4.2, 0.15, 0.7] },
        transform: { translate: [ 2.0, 0.6, 0.2] } },
      { id: 'pp-tail',   type: 'box',
        args: { dims: [0.1, 0.9, 0.6] },
        transform: { translate: [0, 1.3, -1.8] } },
    ],
    transform: { translate: [4, 0, 0] },
    material: 'matte-white',
    variants: [{
      op: 'array', count: parkedPlaneCount, axis: 'z', spacing: parkedPlaneSpacing,
      origin: 'center',
      scale: { jitter: 0.05 },
    }],
  });

  // Ground vehicles (tugs / fuel trucks) — small boxes scattered near terminal.
  subjects.push({
    id: 'ground-vehicle',
    type: 'union',
    children: [
      { id: 'gv-body', type: 'box',
        args: { dims: [0.8, 0.5, 0.4] },
        transform: { translate: [0, 0.25, 0] },
        material: 'silver' },
      { id: 'gv-cab',  type: 'box',
        args: { dims: [0.4, 0.4, 0.4] },
        transform: { translate: [-0.15, 0.7, 0] },
        material: 'silver' },
    ],
    transform: { translate: [0, 0, 0] },
    variants: [{
      op: 'scatter', count: groundVehicleCount,
      region: { type: 'rectXZ', center: [6, 0, 0], size: [8, 12] },
      heading: 'random',
      scale: { jitter: 0.10 },
    }],
  });

  // Runway edge lamps — long array along z-axis, on the runway shoulder.
  subjects.push({
    id: 'runway-lamp',
    type: 'union',
    children: [
      { id: 'rl-pole', type: 'cylinder',
        args: { radius: 0.04, height: 0.6 },
        transform: { translate: [0, 0.3, 0] },
        material: 'silver' },
      { id: 'rl-head', type: 'sphere',
        args: { radius: 0.08 },
        transform: { translate: [0, 0.65, 0] },
        material: { hue: 0.12, sat: 0.3, value: 1.0, glow: 0.8, kind: 'emissive' } },
    ],
    transform: { translate: [-8, 0, 0] },
    variants: [{
      op: 'array', count: lampCount, axis: 'z', spacing: lampSpacing, origin: 'center',
    }],
  });

  const result = { subjects };
  if (withCine) {
    result.postFx = {
      exposure: 1.05, bloomMix: 0.30, vignetteStrength: 0.35, lensFlareStrength: 0.20,
    };
    result.cameraExt = { aperture: 0.5, focalDistance: 30 };
    result.volumes = [{
      id: 'apron-haze',
      kind: 'fog',
      center: [0, 3, -15],
      size: [80, 8, 80],
      density: 0.05,
      color: [0.88, 0.92, 0.96],
    }];
  }
  return result;
}

// =============================================================================
// harbor-quay
// =============================================================================
//
// Args:
//   cargoShipCount       (3)
//   craneCount           (3)
//   containerStackCount  (6)
//   gullCount            (4)
//   sea                  (true)
//   cinematic            (true)
//
// Output: cargo ship + crane + container stack + gull peer subjects + cinematic.

function harborQuayAtom(args = {}) {
  const cargoShipCount      = args.cargoShipCount      ?? 3;
  const craneCount          = args.craneCount          ?? 3;
  const containerStackCount = args.containerStackCount ?? 6;
  const gullCount           = args.gullCount           ?? 4;
  const withSea             = args.sea                 !== false;
  const withCine            = args.cinematic           !== false;

  const subjects = [];

  // Cargo ship prototype (hull + cabin) — scattered along quay.
  subjects.push({
    id: 'cargo-ship',
    type: 'union',
    children: [
      { id: 'cs-hull',  type: 'box',
        args: { dims: [14, 1.8, 3.2] },
        transform: { translate: [0, -0.3, 0] },
        material: 'matte-black' },
      { id: 'cs-deck',  type: 'box',
        args: { dims: [13, 0.3, 3.5] },
        transform: { translate: [0, 0.9, 0] },
        material: 'stone' },
      { id: 'cs-cabin', type: 'rounded_box',
        args: { dims: [2.5, 2.0, 2.6], cornerR: 0.12 },
        transform: { translate: [4, 2.1, 0] },
        material: 'matte-white' },
    ],
    transform: { translate: [0, 0, 0] },
    variants: [{
      op: 'scatter', count: cargoShipCount,
      region: { type: 'rectXZ', center: [0, 0, 8], size: [70, 4] },
      separation: 18,
      heading: 'aligned',
      scale: { jitter: 0.10 },
    }],
  });

  // Dockside crane (4 legs + boom). Array along quay.
  subjects.push({
    id: 'harbor-crane',
    type: 'union',
    children: [
      { id: 'hc-leg-a', type: 'cylinder',
        args: { radius: 0.15, height: 8 },
        transform: { translate: [-1.5, 4, -1.5] },
        material: 'silver' },
      { id: 'hc-leg-b', type: 'cylinder',
        args: { radius: 0.15, height: 8 },
        transform: { translate: [ 1.5, 4, -1.5] },
        material: 'silver' },
      { id: 'hc-leg-c', type: 'cylinder',
        args: { radius: 0.15, height: 8 },
        transform: { translate: [-1.5, 4,  1.5] },
        material: 'silver' },
      { id: 'hc-leg-d', type: 'cylinder',
        args: { radius: 0.15, height: 8 },
        transform: { translate: [ 1.5, 4,  1.5] },
        material: 'silver' },
      { id: 'hc-boom',  type: 'box',
        args: { dims: [10, 0.3, 0.4] },
        transform: { translate: [3, 8.2, 0] },
        material: 'silver' },
    ],
    transform: { translate: [0, 0, -4] },
    variants: [{
      op: 'array', count: craneCount, axis: 'x', spacing: 14, origin: 'center',
    }],
  });

  // Container stack (single stack of boxes). Array along quay.
  subjects.push({
    id: 'container-stack',
    type: 'union',
    children: [
      { id: 'cont-1', type: 'box', args: { dims: [2.4, 1.2, 1.0] }, transform: { translate: [0, 0.6, 0] } },
      { id: 'cont-2', type: 'box', args: { dims: [2.4, 1.2, 1.0] }, transform: { translate: [0, 1.8, 0] } },
      { id: 'cont-3', type: 'box', args: { dims: [2.4, 1.2, 1.0] }, transform: { translate: [0, 3.0, 0] } },
    ],
    transform: { translate: [0, 0, -2] },
    material: { hue: 0.05, sat: 0.55, value: 0.6 },
    variants: [{
      op: 'array', count: containerStackCount, axis: 'x', spacing: 3, origin: 'center',
      scale: { jitter: 0.04 },
    }],
  });

  // Gulls
  subjects.push({
    id: 'gull',
    type: 'bird-silhouette',
    args: { bodyLength: 0.22, wingSpan: 0.6 },
    transform: { translate: [0, 6, 0] },
    variants: [{
      op: 'scatter', count: gullCount,
      region: { type: 'box3', center: [0, 7, 0], size: [40, 4, 20] },
      scale: { jitter: 0.20 },
      translate: { jitter: [2, 0.5, 2] },
    }],
  });

  // Sea
  if (withSea) {
    subjects.push({
      id: 'sea',
      type: 'waves',
      args: { freq: 4.0, amp: 0.12, angle: 0.4, speed: 0.6 },
      transform: { translate: [0, -1.5, 0] },
      material: { hue: 0.58, sat: 0.60, value: 0.35, kind: 'sea' },
    });
  }

  const result = { subjects };
  if (withCine) {
    result.postFx = {
      exposure: 1.05, bloomMix: 0.20, vignetteStrength: 0.35, lensFlareStrength: 0.10,
    };
    result.cameraExt = { aperture: 0.5, focalDistance: 35 };
    result.volumes = [{
      id: 'harbor-mist',
      kind: 'fog',
      center: [0, 5, -20],
      size: [120, 10, 60],
      density: 0.07,
      color: [0.82, 0.86, 0.92],
    }];
  }
  return result;
}

// =============================================================================
// concert-stage (v3.15 — leisure category)
// =============================================================================
//
// Args:
//   audienceCount    (30)    — N audience capsule silhouettes via scatter
//   audienceArea     ([20,12]) — rectXZ size for audience scatter
//   stageLampCount   (6)     — N stage lamps via array along stage front edge
//   stageLampSpacing (2.6)   — meters between lamps
//   speakers         (true)  — emit bilateral speaker pair via mirror
//   backdrop         (true)  — emit stage backdrop wall
//   cinematic        (true)  — auto-add postFx + aperture + haze fog
//
// Output: 4-6 peer subjects (audience scatter + stage lamps + speakers
// mirror + optional backdrop) + warm stage-haze cinematic.

function concertStageAtom(args = {}) {
  const audienceCount    = args.audienceCount    ?? 30;
  const audienceArea     = args.audienceArea     ?? [20, 12];
  const stageLampCount   = args.stageLampCount   ?? 6;
  const stageLampSpacing = args.stageLampSpacing ?? 2.6;
  const withSpeakers     = args.speakers         !== false;
  const withBackdrop     = args.backdrop         !== false;
  const withCine         = args.cinematic        !== false;

  const subjects = [];

  // Stage floor (hero — singleton, no variants)
  subjects.push({
    id: 'stage-floor',
    type: 'box',
    args: { dims: [16, 0.6, 8] },
    transform: { translate: [0, 0.3, 0] },
    material: 'matte-black',
  });

  // Backdrop wall
  if (withBackdrop) {
    subjects.push({
      id: 'stage-backdrop',
      type: 'box',
      args: { dims: [16, 6, 0.3] },
      transform: { translate: [0, 3, -4] },
      material: { hue: 0.85, sat: 0.30, value: 0.20 },
    });
  }

  // Speakers (bilateral pair via mirror)
  if (withSpeakers) {
    subjects.push({
      id: 'speaker',
      type: 'box',
      args: { dims: [1.2, 2.5, 1.0] },
      transform: { translate: [8, 1.25, 2] },
      material: 'matte-black',
      variants: [{ op: 'mirror', plane: 'yz' }],
    });
  }

  // Stage lamps (array along front edge of stage)
  subjects.push({
    id: 'stage-lamp',
    type: 'union',
    children: [
      { id: 'sl-housing', type: 'rounded_box',
        args: { dims: [0.4, 0.4, 0.4], cornerR: 0.05 },
        transform: { translate: [0, 0, 0] },
        material: 'matte-black' },
      { id: 'sl-bulb', type: 'sphere',
        args: { radius: 0.18 },
        transform: { translate: [0, -0.15, 0] },
        material: { hue: 0.10, sat: 0.6, value: 1.0, glow: 0.9, kind: 'emissive' } },
    ],
    transform: { translate: [0, 5.5, -1] },
    variants: [{
      op: 'array', count: stageLampCount, axis: 'x', spacing: stageLampSpacing, origin: 'center',
    }],
  });

  // Audience figures (scattered in front of stage)
  subjects.push({
    id: 'audience-figure',
    type: 'capsule',
    args: { a: [0, 0, 0], b: [0, 1.6, 0], radius: 0.25 },
    transform: { translate: [0, 0, 8] },
    material: { hue: 0.65, sat: 0.05, value: 0.25 },
    variants: [{
      op: 'scatter', count: audienceCount,
      region: { type: 'rectXZ', center: [0, 0, 12], size: audienceArea },
      separation: 1.0,
      heading: 'aligned',
      scale:     { jitter: 0.08 },
      translate: { jitter: [0.3, 0, 0.3] },
    }],
  });

  const result = { subjects };
  if (withCine) {
    result.postFx = {
      exposure: 1.2, bloomMix: 0.45, vignetteStrength: 0.5, lensFlareStrength: 0.25,
    };
    result.cameraExt = { aperture: 0.7, focalDistance: 15 };
    result.volumes = [{
      id: 'stage-haze',
      kind: 'fog',
      center: [0, 3, 2],
      size: [20, 6, 12],
      density: 0.12,
      color: [0.95, 0.85, 0.70],
    }];
  }
  return result;
}
