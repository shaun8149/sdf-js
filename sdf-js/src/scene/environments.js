// sdf-js/src/scene/environments.js
// Shared world presets for structure renderers. A structure keeps its form /
// camera grammar / labels in ANY environment; env only swaps the WORLD around
// it (a renderer-axis choice, not an IR field — the same IR renders in the
// studio or on a mountainside). Extracted from render-sequence.js when the
// hierarchy renderer arrived (every structure renderer shares these).
//
// Contract: getEnvironment(name) → null (studio default: the caller provides
// its own stage defaults) or { subjects, defaults, payoffZoom }.
//   subjects   — world geometry appended after the structure's own subjects
//   defaults   — full scene defaults (camera fallback + light + shadow + postFx)
//   payoffZoom — multiplier for the ending pull-back distance (reveal the world)

const SNOWY_STONE = { hue: 0.07, sat: 0.3, value: 0.62, metal: 0, glow: 0, kind: 'snowy' };
const SNOWY_PINE = { hue: 0.3, sat: 0.55, value: 0.3, metal: 0, glow: 0, kind: 'snowy' };

function alpineEnvironment() {
  return {
    subjects: [
      {
        id: 'env-terrain',
        type: 'terrain-elevated',
        args: { maxHeight: 35.0, scale: 0.035, ridgePower: 2.0, mountainness: 0.3 },
        transform: { translate: [0, -8, 0] },
      },
      {
        id: 'env-snow-base',
        type: 'box',
        args: { dims: [400, 0.4, 400] },
        transform: { translate: [0, -7.9, 0] },
        material: { hue: 0.6, sat: 0.04, value: 0.94, metal: 0, glow: 0, kind: 'snowy' },
      },
      // the hero backdrop: the snowy stone bridge, spanning the frame behind the structure
      {
        id: 'env-bridge',
        type: 'arch-bridge',
        args: { bridgeLen: 30.0, bridgeWidth: 4.0, archH: 6.0, railH: 1.5, cornerOff: 10.0 },
        transform: { translate: [0, -1.2, -16], rotate: [0, 1.5708, 0] },
        material: SNOWY_STONE,
      },
      {
        id: 'env-pine-L',
        type: 'tree-pine',
        args: { trunkHeight: 4.4, trunkRadius: 0.18, foliageRadius: 1.3 },
        transform: { translate: [-9, -1.5, -4] },
        material: SNOWY_PINE,
      },
      {
        id: 'env-pine-R',
        type: 'tree-pine',
        args: { trunkHeight: 3.8, trunkRadius: 0.16, foliageRadius: 1.1 },
        transform: { translate: [8, -1.5, -7] },
        material: SNOWY_PINE,
      },
      {
        id: 'env-pine-far',
        type: 'tree-pine',
        args: { trunkHeight: 5.0, trunkRadius: 0.2, foliageRadius: 1.6 },
        transform: { translate: [-14, -1.5, -12] },
        material: SNOWY_PINE,
      },
    ],
    defaults: {
      // static fallback only — the cameraSequence drives the actual camera
      camera: {
        yaw: 0,
        pitch: -0.1,
        distance: 10,
        focal: 1.2,
        targetX: 0,
        targetY: 2,
        targetZ: 0,
      },
      light: { azimuth: -0.6, altitude: 0.3, distance: 60, intensity: 1.15 },
      shadow: { enabled: true, mode: 'darken', strength: 0.42 },
      postFx: {
        exposure: 1.05,
        vignetteStrength: 0.4,
        bloomMix: 0.22,
        bloomThreshold: 0.85,
        lensFlareStrength: 0.1,
        motionBlurStrength: 0.45,
      },
    },
    payoffZoom: 1.35, // pull the ending frame further back — reveal the world
  };
}

// 'canyon' — red-sandstone canyon at golden hour (the shipped terrain-canyon
// recipe: Y-stretched displacement gives the vertical wall striations; the
// mountain shader's HSV rock tint turns it sandstone). Low warm sun + flare.
function canyonEnvironment() {
  return {
    subjects: [
      {
        id: 'env-canyon',
        type: 'terrain-canyon',
        args: {
          maxHeight: 38,
          scale: 0.014,
          ridgePower: 2.2,
          mountainness: 0.22,
          displaceAmt: 5,
          yStretch: 4,
        },
        transform: { translate: [0, -8, 0] },
      },
      {
        id: 'env-sand-base',
        type: 'box',
        args: { dims: [400, 0.4, 400] },
        transform: { translate: [0, -7.9, 0] },
        material: {
          hue: 0.07,
          sat: 0.45,
          value: 0.6,
          metal: 0,
          glow: 0,
          kind: 'normal',
          roughness: 0.7,
        },
      },
    ],
    defaults: {
      camera: { yaw: 0, pitch: -0.1, distance: 10, focal: 1.2, targetX: 0, targetY: 2, targetZ: 0 },
      light: { azimuth: 2.4, altitude: 0.16, distance: 80, intensity: 1.25 },
      shadow: { enabled: true, mode: 'darken', strength: 0.45 },
      postFx: {
        exposure: 1.0,
        vignetteStrength: 0.42,
        bloomMix: 0.24,
        bloomThreshold: 0.8,
        lensFlareStrength: 0.18,
        motionBlurStrength: 0.45,
      },
    },
    payoffZoom: 1.35,
  };
}

export function getEnvironment(name) {
  if (name === 'alpine') return alpineEnvironment();
  if (name === 'canyon') return canyonEnvironment();
  return null;
}

// ---- Horizon silhouettes (the DEFAULT open world's skyline) -------------------
// Decks without an env fly over an infinite empty plain — the transits expose
// it. This is a CHEAP ring of hill silhouettes (ellipsoids only — no terrain
// fbm, so no shader-compile cost) at distance; atmospheric fog hazes them into
// a proper horizon. Deterministic layout from index math (no randomness).
export function horizonSilhouettes(center = [0, 0], ringRadius = 140) {
  const hills = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const th = (i * 2 * Math.PI) / N + 0.35 * Math.sin(i * 2.7);
    const r = ringRadius * (0.9 + 0.18 * Math.sin(i * 1.9 + 1.2));
    const w = 34 + 18 * Math.sin(i * 3.1 + 0.5) ** 2;
    const h = 8 + 7 * Math.sin(i * 2.3 + 2.1) ** 2;
    hills.push({
      id: `horizon-${i}`,
      type: 'ellipsoid',
      args: { dims: [w, h, w * 0.7] },
      // sink most of the body — only the CREST breaks the horizon line, so it
      // reads as a distant ridge, not a dome parked on the plain
      transform: {
        translate: [center[0] + Math.sin(th) * r, -h * 0.55, center[1] + Math.cos(th) * r],
      },
      material: {
        hue: 0.62,
        sat: 0.3,
        value: 0.3,
        metal: 0,
        glow: 0,
        kind: 'normal',
        roughness: 0.85,
      },
    });
  }
  return hills;
}

// ---------------------------------------------------------------------------
// stagePreset — the fighting-game stage, config-only tier (v0).
// Backdrop recedes (dark cyclorama + dimmed sky), the structure stands lit on a
// platform under a spotlight rig, and every shot gets DOF so the backdrop
// defocuses. Pure function: returns a copy, never mutates the input scene.
// Idiom ledger: docs/superpowers/artblocks-study/3d-stage-idioms.md (tier ✅).
// ---------------------------------------------------------------------------

export function stagePreset(scene, { center = [0, 1.6, 0] } = {}) {
  const out = {
    ...scene,
    subjects: [...(scene.subjects || [])],
    defaults: { ...(scene.defaults || {}) },
    cameraSequence: scene.cameraSequence
      ? { ...scene.cameraSequence, shots: (scene.cameraSequence.shots || []).map((s) => ({ ...s })) }
      : scene.cameraSequence,
  };

  // (a) backdrop recede: dark cyclorama + dim the sky ambient (theatre dark)
  // + strong vignette / slight under-exposure (postfx pipeline) so the frame
  // edges — the backdrop walls — fall off while the lit centre keeps its punch.
  // The main directional light is controls-owned (not scene-settable), so the
  // spotlight look comes from vignette + interiorDark + the rig below.
  out.defaults.studioBg = 'dark';
  if (out.defaults.interiorDark == null) out.defaults.interiorDark = 0.22;
  out.defaults.postFx = {
    vignetteStrength: 0.62,
    exposure: 0.9,
    bloomMix: 0.24,
    ...(out.defaults.postFx || {}),
  };
  // SDF glow (march-loop halo, idiom L08) — subtle silhouette light on the backdrop
  if (out.defaults.glow == null) out.defaults.glow = { amount: 0.35, k: 6.0 };

  // (b) spotlight rig: warm key spot above-front aimed at the structure + cool rim behind
  if (!Array.isArray(out.defaults.lights) || out.defaults.lights.length === 0) {
    const keyPos = [center[0] + 1.6, center[1] + 4.2, center[2] + 3.4];
    const dir = [center[0] - keyPos[0], center[1] - keyPos[1], center[2] - keyPos[2]];
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    out.defaults.lights = [
      { pos: keyPos, dir: dir.map((c) => c / dl), color: [1.0, 0.96, 0.88], intensity: 1.4 },
      { pos: [center[0] - 2.6, center[1] + 1.4, center[2] - 3.2], color: [0.45, 0.62, 1.0], intensity: 0.7 },
    ];
  }

  // (c) platform: flat dark disc under the structure (the "stage floor")
  if (!out.subjects.some((s) => s.id === 'stage-platform')) {
    out.subjects.push({
      id: 'stage-platform',
      type: 'cylinder',
      args: { radius: 2.6, height: 0.12 },
      transform: { translate: [center[0], 0.06, center[2]] },
      material: { hue: 0.62, sat: 0.12, value: 0.22, kind: 'normal', roughness: 0.75, clearcoat: 0.1 },
    });
  }

  // (d) DOF on every shot that doesn't set its own aperture
  if (out.cameraSequence && Array.isArray(out.cameraSequence.shots)) {
    for (const s of out.cameraSequence.shots) {
      if (!(s.aperture > 0)) {
        const t = s.target || center;
        const p = s.pos || [0, 0, 8];
        s.aperture = 0.06;
        s.focalDistance = Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]) || 8;
      } else if (!(s.focalDistance > 0)) {
        const t = s.target || center;
        const p = s.pos || [0, 0, 8];
        s.focalDistance = Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]) || 8;
      }
    }
  }

  return out;
}
