// =============================================================================
// scenedata-demo —— SceneData JSON → compile() → BOB GPU render (M0 Day 4)
// -----------------------------------------------------------------------------
// End-to-end pipeline validation: paste a SceneData JSON, click render, see it
// rendered by the same bobShader that autoscope-clone uses. Confirms the spec
// produces a renderable SDF tree with working camera / light / shadow.
//
// 3 pre-baked samples cover the v1 spec extension surface:
//   - tiny:            single sphere on ground (basic shape + ground + camera)
//   - birds-house:     DomainGroup rep + subject animation (transform.translate.x linear, args.dims sin)
//   - coastal-village: Example 5 from SPEC.md — everything mixed: rep + waves + camera dolly + light osc + hueRotate180 shadow
// =============================================================================

import { parse, compile } from '../../src/scene/index.js';
import { createBobShaderRenderer } from '../../src/render/bobShader.js';

const $ = id => document.getElementById(id);

// =============================================================================
// State
// =============================================================================

let renderer = null;
let compiled = null;  // result of compile(parsedScene)
let currentSampleId = 'birds-house';   // sensible default — exercises animation + rep
let sceneStartTime = performance.now();
let userTookCameraControl = false;   // set when user clicks canvas → pause scene camera anim

// =============================================================================
// Load + render
// =============================================================================

async function loadSample(id) {
  const url = `./scenedata-samples/${id}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    $('json-input').value = text;
    setStatus(`✓ Loaded ${id}.json (${text.length} bytes)`, true);
  } catch (e) {
    setStatus(`✗ Failed to load ${id}.json: ${e.message}`, false);
  }
}

function compileAndRender() {
  const text = $('json-input').value.trim();
  if (!text) {
    setStatus('✗ JSON input empty', false);
    return;
  }

  // Parse + compile
  try {
    const scene = parse(text);
    compiled = compile(scene);
    setStatus(
      `✓ Compiled: "${scene.name || '(unnamed)'}" · ${compiled.subjects.length} subjects · shadow=${compiled.shadowStatic?.mode ?? 'off'}`,
      true,
    );
    $('scene-name').textContent = scene.name || '(unnamed)';
    $('leaves').textContent = `${compiled.subjects.length} subjects`;
  } catch (e) {
    setStatus(`✗ parse/compile error: ${e.message}`, false);
    console.error(e);
    return;
  }

  // Render
  const bob = ensureRenderer();
  if (!compiled.sdf) {
    setStatus('✗ Compiled SDF is null (empty scene?)', false);
    return;
  }

  // Apply scene's initial camera state to renderer
  bob.setCamState(sphericalToCamState(compiled.cameraStatic));

  // Mark scene start time so the per-frame camera loop animates from t=0.
  sceneStartTime = performance.now();
  // Reset user camera-control flag — fresh scene = fresh scene-driven camera.
  userTookCameraControl = false;

  try {
    const { bytes } = bob.render(compiled.sdf);
    setStatus(
      `✓ Rendered · ${(bytes / 1024).toFixed(1)} KB GLSL · shadow=${compiled.shadowStatic?.mode ?? 'off'} · ${compiled.subjects.length} subjects`,
      true,
    );
  } catch (e) {
    setStatus(`✗ render error: ${e.message}`, false);
    console.error(e);
  }
}

// =============================================================================
// BOB GPU renderer (controls read from compiled SceneData live)
// =============================================================================

function ensureRenderer() {
  if (renderer) return renderer;
  renderer = createBobShaderRenderer({
    canvas: $('cv'),
    twoPass: true,
    bufferResolution: 320,
    getControls: () => {
      if (!compiled) {
        // Pre-compile: return reasonable defaults so renderer doesn't crash
        return defaultControls();
      }
      // Per-frame: evaluate animations at current time. bobShader has internal
      // tSec tracking via gl.uniform1f(u_time, tSec). We can re-evaluate
      // here using performance.now() if we want — but the time-expr in
      // sdf3.compile already emits u_time so subject animations animate
      // automatically. We only need to evaluate camera/light/shadow here.
      const t = (performance.now() - startTime) / 1000;
      const cam = compiled.evalCamera(t);
      const light = compiled.evalLight(t);
      const shadow = compiled.evalShadow ? compiled.evalShadow(t) : compiled.shadowStatic;

      return {
        // Light: scene-driven azim/alt/distance (allows animation)
        lightAzim: light.azimuth,
        lightAlt:  light.altitude,
        lightDist: light.distance,
        // Camera: focal from scene (renderer handles pos/yaw/pitch via fly-controls)
        fov:       cam.focal,
        // BOB GPU palette / shadow controls
        coldiv:        +$('coldiv-val')?.value || 1.1,
        coloration:    0,
        shadowMode:    shadow ? modeNameToInt(shadow.mode) : 0,
        shadowStrength: shadow ? shadow.strength : 0.35,
        shadowsOn:     shadow ? shadow.enabled : true,
        groundOn:      !!compiled.ground,
        noiseSpeed:    0.00016,
        exposure:      1.05,
        saturation:    1.0,
        worldScale:    0.5,  // autoscope-clone idiom — matches 10-unit-ish scenes
        // Sand painting
        postNoise:     1.0,
        postNFactor:   1.0,
        postNoiseCap:  0.5,
        // Knobs all zero (no mirror/twist/gridRot in our SceneData yet)
        mirrorX: false, mirrorZ: false, twist: 0, twistType: 0, gridRot: [0, 0, 0],
      };
    },
    onFps: (fps) => {
      $('fps').textContent = `FPS: ${fps.toFixed(0)}`;
    },
  });
  return renderer;
}

const startTime = performance.now();

// =============================================================================
// Camera loop: push evalCamera(t) → bobShader.setCamState per frame.
// Scene animations on yaw / pitch / distance / target* are scene-driven; the
// renderer's fly-controls take over when user clicks canvas (Pointer Lock).
// =============================================================================

function sphericalToCamState(cam) {
  const pos = [
    cam.targetX - cam.distance * Math.sin(cam.yaw) * Math.cos(cam.pitch),
    cam.targetY + cam.distance * Math.sin(cam.pitch),
    cam.targetZ - cam.distance * Math.cos(cam.yaw) * Math.cos(cam.pitch),
  ];
  return { position: pos, yaw: cam.yaw, pitch: cam.pitch };
}

function cameraLoop() {
  if (renderer && compiled && !userTookCameraControl) {
    const t = (performance.now() - sceneStartTime) / 1000;
    const cam = compiled.evalCamera(t);
    renderer.setCamState(sphericalToCamState(cam));
  }
  requestAnimationFrame(cameraLoop);
}
cameraLoop();

// User clicks canvas → take camera control (yields scene anim)
$('cv').addEventListener('pointerdown', () => {
  userTookCameraControl = true;
  setStatus('• Camera control: user (Pointer Lock). Reload sample to restore scene animation.', true);
});

function defaultControls() {
  return {
    lightAzim: 0.5, lightAlt: 0.7, lightDist: 8, fov: 1.5,
    coldiv: 1.1, coloration: 0, shadowMode: 0, shadowStrength: 0.35,
    shadowsOn: true, groundOn: true, noiseSpeed: 0.00016,
    exposure: 1.05, saturation: 1.0, worldScale: 0.5,
    postNoise: 1.0, postNFactor: 1.0, postNoiseCap: 0.5,
    mirrorX: false, mirrorZ: false, twist: 0, twistType: 0, gridRot: [0, 0, 0],
  };
}

// SPEC mode names → bobShader's u_shadow int (0..3)
function modeNameToInt(mode) {
  return { channelSwap: 0, hueRotate180: 1, hueRotate90: 2, darken: 3 }[mode] ?? 0;
}

function setStatus(msg, ok = true) {
  const el = $('status');
  el.textContent = msg;
  el.className = ok ? '' : 'err';
}

// =============================================================================
// Wire UI
// =============================================================================

$('sample-select').value = currentSampleId;
$('sample-select').addEventListener('change', async (e) => {
  currentSampleId = e.target.value;
  await loadSample(currentSampleId);
  compileAndRender();
});

$('btn-render').addEventListener('click', compileAndRender);

$('btn-shuffle').addEventListener('click', () => {
  if (renderer) renderer.shufflePalette();
});

// =============================================================================
// Init: load default sample + render
// =============================================================================

(async () => {
  await loadSample(currentSampleId);
  compileAndRender();
})();
