// =============================================================================
// autoscope-clone —— 把 6 个 autoscope-scenes 用 BOB GPU shader 渲染
// -----------------------------------------------------------------------------
// 流程：
//   1. URL hash 读 / 生成 → new Random(hash)
//   2. Scene type 读 / 随机 → generateScene(t, rng) → SDF3
//   3. BOB GPU renderer (groundOn=false, worldScale=0.8) → render(sdf)
//   4. "New scene" 按钮：生成新 hash → 更新 URL → 重 seed → 重新 generateScene
//
// 共享：BOB shader from src/render/bobShader.js（autoscope-clone 跟 MVP 同一 renderer）
// =============================================================================

import {
  Random, generateHash, isValidHash,
  readSceneHashFromURL, readStyleHashFromURL, writeSplitHashToURL,
} from './autoscope-rng.js';
import {
  generateSceneData,
  SCENE_NAMES_DATA as SCENE_NAMES,
  randomSceneTypeData as randomSceneType,
} from './autoscope-scenes-data.js';
import { compile as compileSceneData } from '../../src/scene/index.js';
import { createBobShaderRenderer } from '../../src/render/bobShader.js';
// Generator-V: BOB GPU style randomizer + applyStyleGate + describe
import {
  DEFAULT_STYLE, randomizeBobStyle, applyStyleGate, describeStyle,
} from '../../src/render/bobShader-style.js';
import { union as sdfUnion } from '../../src/sdf/dn.js';  // also has side-effect of registering .rep / .union etc on SDF3.prototype

const $ = id => document.getElementById(id);

// =============================================================================
// State
// =============================================================================

// Split hashes: sceneHash drives Generator-S (SDF scene structure),
// styleHash drives Generator-V (BOB GPU palette / chess / render params).
// Orthogonal — cross-product variant space.
let currentSceneHash = readSceneHashFromURL();
if (!isValidHash(currentSceneHash)) currentSceneHash = generateHash();
let currentStyleHash = readStyleHashFromURL();
if (!isValidHash(currentStyleHash)) currentStyleHash = generateHash();
writeSplitHashToURL(currentSceneHash, currentStyleHash);

let currentSceneTypeChoice = 'random';  // dropdown value
let currentSdf = null;
let currentCompiled = null;  // SceneData mode: { sdf, evalCamera, evalLight, ... }; null in Direct SDF mode
let renderer = null;
let currentStyle = { ...DEFAULT_STYLE };  // Generator-V output (palette/chess/render uniforms)
let sceneStartTime = performance.now();
let userTookCameraControl = false;        // set on canvas click → yields scene camera anim to fly-controls

// Initial camera：autoscope 缺省 ortho 视角不能完全 match 透视，用 close+low+lookdown 模拟
// pos=[0, 3, -15] pitch=0.30 → horizon at uv.y ≈ 1.5*tan(0.3) ≈ 0.46
// → sky 只占顶部 ~27%（贴近 autoscope "背景很少看到" 的 framing）
const INITIAL_CAM = { position: [0, 3, -15], yaw: 0, pitch: 0.30 };

// =============================================================================
// UI wire-up: slider value display
// =============================================================================

function wireSlider(id, digits = 2) {
  const el = $(id);
  const v = $(id + '-val');
  if (!el) return;
  const update = () => {
    if (v) {
      const n = +el.value;
      v.textContent = digits === 5 ? n.toFixed(5) : n.toFixed(digits);
    }
  };
  el.addEventListener('input', update);
  update();
}
wireSlider('coldiv', 2);
wireSlider('world-scale', 2);
wireSlider('noise', 5);
wireSlider('exposure', 2);
wireSlider('saturation', 2);
wireSlider('shadow-strength', 2);
wireSlider('post-noise', 2);
wireSlider('focal', 2);

// =============================================================================
// BOB GPU renderer
// =============================================================================

function ensureRenderer() {
  if (renderer) return renderer;
  const canvas = $('cv');
  renderer = createBobShaderRenderer({
    canvas,
    twoPass: true,              // ← autoscope 2-pass FBO sand painting
    bufferResolution: 320,      // 低分 buffer，全屏 canvas 上呈"颗粒/水彩"感
    getControls: () => {
      // Generator-V output (deterministic from styleHash) gated by UI toggle.
      // applyStyleGate(style, false) → identity DEFAULT_STYLE (palette preserved)
      const styleGated = applyStyleGate(currentStyle, $('knobs-on').checked);
      // shadowMode in BobStyle is named `shadow`; bob expects `shadowMode`. Map.
      const shadowMode = styleGated.shadow ?? +$('shadow-mode').value;
      return {
        lightAzim: 0.6,
        lightAlt:  0.5,
        lightDist: 50,
        fov:        +$('focal').value,
        shadowsOn:  $('shadows-on').checked,
        groundOn:   false,
        noiseSpeed: +$('noise').value,
        worldScale: +$('world-scale').value,
        // Style-driven (Generator-V):
        ...styleGated,
        shadowMode,  // rename for bobShader
        // Style param renames bobShader expects: postNFactor / postNoiseCap / postColorLeak
        postNFactor:   styleGated.nFactor,
        postNoiseCap:  styleGated.noiseCap,
        postColorLeak: styleGated.colorLeak,
        // UI slider overrides (advanced)
        coldiv:     +$('coldiv').value || styleGated.coldiv,
        coloration: +$('coloration').value || styleGated.coloration,
        shadowStrength: +$('shadow-strength').value || styleGated.shadowStrength,
        exposure:   +$('exposure').value || styleGated.exposure,
        saturation: +$('saturation').value || styleGated.saturation,
        seed:       1.0,
      };
    },
    onFps: (fps) => {
      const el = $('fps');
      if (el) el.textContent = `FPS: ${fps.toFixed(0)}`;
    },
    onCamUpdate: (s) => {
      const r = $('pos-readout');
      if (r) r.textContent = s.position.map(x => x.toFixed(1)).join(' ');
      const yp = $('yp-readout');
      if (yp) yp.textContent = `${(s.yaw * 180 / Math.PI).toFixed(0)}° ${(s.pitch * 180 / Math.PI).toFixed(0)}°`;
    },
    onPaletteChange: (sample) => {
      const renderRow = (id, colors) => {
        const el = $(id);
        if (!el) return;
        el.innerHTML = '';
        for (const c of colors) {
          const sw = document.createElement('div');
          sw.className = 'swatch';
          sw.style.background = c;
          el.appendChild(sw);
        }
      };
      renderRow('palette-row1', sample.palette1);
      renderRow('palette-row2', sample.palette2);
    },
  });
  return renderer;
}

// =============================================================================
// Scene generation
// =============================================================================

function regenerateScene({ keepCamera = false } = {}) {
  const startTime = performance.now();

  // Update hash input fields
  if ($('scene-hash-input')) $('scene-hash-input').value = currentSceneHash;
  if ($('style-hash-input')) $('style-hash-input').value = currentStyleHash;

  // sceneRng — deterministic from sceneHash, drives Generator-S (SDF structure)
  const rng = new Random(currentSceneHash);
  const sceneTypeChoice = $('scene-type').value;
  const sceneType = sceneTypeChoice === 'random' ? randomSceneType(rng) : (+sceneTypeChoice);

  // SceneData → compile → SDF (single pipeline, 2026-05-23 removed legacy "Direct SDF" path)
  const sceneData = generateSceneData(sceneType, rng);
  let sdf, leafCount;
  let extraStatus = '';
  try {
    const compiled = compileSceneData(sceneData);
    // compile() returns subjects SDF + groundSdf separately. bobShader expects a
    // single SDF tree — union them so scene's ground.y is respected (vs bobShader's
    // internal GROUND_Y=-1).
    if (compiled.groundSdf && compiled.sdf) {
      sdf = sdfUnion(compiled.sdf, compiled.groundSdf);
    } else {
      sdf = compiled.sdf || compiled.groundSdf;
    }
    currentCompiled = compiled;  // enables cameraLoop scene-driven camera/light anim
    leafCount = compiled.subjects.length;
    const camAnim = compiled.cameraStatic && (sceneData.defaults.camera.animation?.length || 0);
    const lightAnim = sceneData.defaults.light.animation?.length || 0;
    const groundTag = compiled.ground ? ` · ground@y=${compiled.ground.y}` : '';
    extraStatus = ` · ${leafCount} subjects · shadow=${compiled.shadowStatic?.mode ?? 'off'} · camAnim=${camAnim} · lightAnim=${lightAnim}${groundTag}`;
  } catch (e) {
    setStatus(`✗ SceneData compile error: ${e.message}`, false);
    console.error('SceneData failed, sceneData =', sceneData);
    console.error(e);
    return;
  }
  currentSdf = sdf;
  sceneStartTime = performance.now();
  userTookCameraControl = false;

  // Update display
  $('scene-name').textContent = `${sceneType} · ${SCENE_NAMES[sceneType]}`;

  // Render
  const bob = ensureRenderer();
  if (!keepCamera) bob.setCamState(INITIAL_CAM);

  // Apply current Generator-V style (palette + skip rate + bg variety).
  // bob.applyStyle re-bakes the palette texture from style.{palette1,palette2,paper}.
  bob.applyStyle(currentStyle);

  try {
    const { bytes } = bob.render(sdf);
    const totalMs = (performance.now() - startTime).toFixed(0);
    setStatus(`✓ ${SCENE_NAMES[sceneType]} · ${(bytes / 1024).toFixed(1)} KB shader · ${totalMs} ms${extraStatus}`, true);
    $('leaves').textContent = `${leafCount} subjects`;
  } catch (e) {
    setStatus(`✗ render error: ${e.message}`, false);
    console.error(e);
  }
}

function updateStyleReadout() {
  const el = $('knobs-readout');
  if (el) el.textContent = describeStyle(currentStyle);
}

// =============================================================================
// Generator-V: regenerate style from styleHash
// -----------------------------------------------------------------------------
// Independent of scene. Re-bakes palette texture + replaces all per-uniform
// style values. Doesn't touch SDF — same scene, new "skin".
// =============================================================================
function regenerateStyle() {
  const styleRng = new Random(currentStyleHash);
  currentStyle = randomizeBobStyle(styleRng);
  updateStyleReadout();
  if (renderer) renderer.applyStyle(currentStyle);
  if ($('style-hash-input')) $('style-hash-input').value = currentStyleHash;
}

function setStatus(msg, ok = true) {
  const el = $('status');
  el.textContent = msg;
  el.className = ok ? '' : 'err';
}

// =============================================================================
// Buttons / events
// =============================================================================

$('btn-new-scene').addEventListener('click', () => {
  currentSceneHash = generateHash();
  writeSplitHashToURL(currentSceneHash, currentStyleHash);
  regenerateScene();
});

$('btn-new-style').addEventListener('click', () => {
  currentStyleHash = generateHash();
  writeSplitHashToURL(currentSceneHash, currentStyleHash);
  regenerateStyle();
});

$('btn-share').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    setStatus(`✓ URL copied (sceneHash ${currentSceneHash.slice(0, 8)}… × styleHash ${currentStyleHash.slice(0, 8)}…)`, true);
  } catch {
    prompt('Copy this URL:', window.location.href);
  }
});

$('btn-cam-reset').addEventListener('click', () => {
  if (renderer) renderer.setCamState(INITIAL_CAM);
});

$('scene-type').addEventListener('change', () => {
  regenerateScene();
});

$('scene-hash-input').addEventListener('change', (e) => {
  const v = e.target.value.trim();
  if (isValidHash(v)) {
    currentSceneHash = v;
    writeSplitHashToURL(currentSceneHash, currentStyleHash);
    regenerateScene();
  } else {
    setStatus(`✗ Invalid sceneHash format (expected 0x + 64 hex chars)`, false);
    e.target.value = currentSceneHash;
  }
});

$('style-hash-input').addEventListener('change', (e) => {
  const v = e.target.value.trim();
  if (isValidHash(v)) {
    currentStyleHash = v;
    writeSplitHashToURL(currentSceneHash, currentStyleHash);
    regenerateStyle();
  } else {
    setStatus(`✗ Invalid styleHash format (expected 0x + 64 hex chars)`, false);
    e.target.value = currentStyleHash;
  }
});

// Spacebar = New scene；Shift+Space = New style（pointer-lock 时被 fly-controls 用）
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.pointerLockElement !== $('cv') && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    if (e.shiftKey) $('btn-new-style').click();
    else $('btn-new-scene').click();
  }
});

// =============================================================================
// Camera animation loop: in SceneData mode, push compiled.evalCamera(t) →
// bobShader.setCamState per frame so scene-driven camera animations apply.
// Yields to fly-controls once user clicks canvas (pointer lock).
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
  if (renderer && currentCompiled && !userTookCameraControl) {
    const t = (performance.now() - sceneStartTime) / 1000;
    const cam = currentCompiled.evalCamera(t);
    renderer.setCamState(sphericalToCamState(cam));
  }
  requestAnimationFrame(cameraLoop);
}
cameraLoop();

// User clicks canvas → take camera control (yields scene anim until new scene)
const canvasEl = document.getElementById('cv');
if (canvasEl) {
  canvasEl.addEventListener('pointerdown', () => {
    userTookCameraControl = true;
  });
}

// =============================================================================
// Init: regenerate Generator-V style first (populates currentStyle), then
// scene (which calls bob.applyStyle(currentStyle) before render).
// =============================================================================

{
  // Bootstrap Generator-V output from styleHash BEFORE ensureRenderer/render,
  // so the first render already uses the deterministic palette + opts.
  const styleRng = new Random(currentStyleHash);
  currentStyle = randomizeBobStyle(styleRng);
  updateStyleReadout();
}
regenerateScene();
