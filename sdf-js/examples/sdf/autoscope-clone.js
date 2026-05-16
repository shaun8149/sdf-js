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

import { Random, generateHash, readHashFromURL, writeHashToURL, isValidHash } from './autoscope-rng.js';
import { generateScene, SCENE_NAMES, randomSceneType } from './autoscope-scenes.js';
import { createBobShaderRenderer } from '../../src/render/bobShader.js';
import { DEFAULT_KNOBS, randomizeKnobs, applyKnobsGate, describeKnobs } from '../../src/palette/autoscope.js';
import '../../src/sdf/dn.js';  // side-effect import to register .rep / .union etc on SDF3.prototype

const $ = id => document.getElementById(id);

// =============================================================================
// State
// =============================================================================

let currentHash = readHashFromURL();
if (!isValidHash(currentHash)) currentHash = generateHash();
writeHashToURL(currentHash);

let currentSceneTypeChoice = 'random';  // dropdown value
let currentSdf = null;
let renderer = null;
let currentKnobs = { ...DEFAULT_KNOBS };  // PRNG-randomized autoscope knobs（mirror/twist/gridRot）

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
    getControls: () => ({
      lightAzim: 0.6,   // autoscope 风格固定光向（azim 60°）
      lightAlt:  0.5,   // 中等仰角
      lightDist: 50,    // far light (scene scale 50+)
      fov:        +$('focal').value,
      coldiv:     +$('coldiv').value,
      coloration: +$('coloration').value,
      shadowMode: +$('shadow-mode').value,
      shadowStrength: +$('shadow-strength').value,
      shadowsOn:  $('shadows-on').checked,
      groundOn:   false,  // scene 自带 ground
      noiseSpeed: +$('noise').value,
      exposure:   +$('exposure').value,
      saturation: +$('saturation').value,
      worldScale: +$('world-scale').value,
      // Autoscope 随机化 knobs（PRNG 派生）+ UI 开关 gate
      ...applyKnobsGate(currentKnobs, $('knobs-on').checked),
      // Post-process (sand painting) noise amount
      postNoise:     +$('post-noise').value,
      postNFactor:   1.0,    // octave noise nFactor（固定，slider 可加）
      postNoiseCap:  0.5,    // octaves clamp 上限
    }),
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

  // Update hash input
  $('hash-input').value = currentHash;

  // Build rng (~30ms warmup)
  const rng = new Random(currentHash);
  const sceneTypeChoice = $('scene-type').value;
  const sceneType = sceneTypeChoice === 'random' ? randomSceneType(rng) : (+sceneTypeChoice);

  // Generate scene
  const sdf = generateScene(sceneType, rng);
  currentSdf = sdf;

  // Autoscope-style 随机化 knobs（用 scene 之后剩下的 PRNG state，保证 hash 决定一切）
  currentKnobs = randomizeKnobs(rng);
  updateKnobsReadout();

  // Update display
  $('scene-name').textContent = `${sceneType} · ${SCENE_NAMES[sceneType]}`;

  // Render
  const bob = ensureRenderer();
  if (!keepCamera) bob.setCamState(INITIAL_CAM);

  try {
    const { bytes } = bob.render(sdf);
    const totalMs = (performance.now() - startTime).toFixed(0);
    setStatus(`✓ ${SCENE_NAMES[sceneType]} · ${(bytes / 1024).toFixed(1)} KB shader · ${totalMs} ms total`, true);

    // Leaf count for display
    const leafCount = countLeaves(sdf);
    $('leaves').textContent = `${leafCount} leaves`;
  } catch (e) {
    setStatus(`✗ render error: ${e.message}`, false);
    console.error(e);
  }
}

function countLeaves(sdf) {
  const a = sdf.ast;
  if (a?.kind === 'op' && a.name === 'union') {
    return a.children.reduce((n, c) => n + countLeaves(c), 0);
  }
  return 1;
}

function updateKnobsReadout() {
  const el = $('knobs-readout');
  if (el) el.textContent = describeKnobs(currentKnobs);
}

function setStatus(msg, ok = true) {
  const el = $('status');
  el.textContent = msg;
  el.className = ok ? '' : 'err';
}

// =============================================================================
// Buttons / events
// =============================================================================

$('btn-new').addEventListener('click', () => {
  currentHash = generateHash();
  writeHashToURL(currentHash);
  regenerateScene();
});

$('btn-share').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    setStatus(`✓ URL copied to clipboard (hash ${currentHash.slice(0, 10)}…)`, true);
  } catch {
    // Fallback: show URL
    prompt('Copy this URL:', window.location.href);
  }
});

$('btn-shuffle').addEventListener('click', () => {
  if (renderer) renderer.shufflePalette();
});

$('btn-cam-reset').addEventListener('click', () => {
  if (renderer) renderer.setCamState(INITIAL_CAM);
});

$('scene-type').addEventListener('change', () => {
  regenerateScene();
});

$('hash-input').addEventListener('change', (e) => {
  const v = e.target.value.trim();
  if (isValidHash(v)) {
    currentHash = v;
    writeHashToURL(currentHash);
    regenerateScene();
  } else {
    setStatus(`✗ Invalid hash format (expected 0x + 64 hex chars)`, false);
    e.target.value = currentHash;
  }
});

// Spacebar = New scene（不在 pointer-lock 时；pointer-lock 时 Space 是 fly-controls 上升）
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.pointerLockElement !== $('cv') && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    $('btn-new').click();
  }
});

// =============================================================================
// Init
// =============================================================================

regenerateScene();
