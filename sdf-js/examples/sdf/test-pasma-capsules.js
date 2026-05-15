// =============================================================================
// test-pasma-capsules.js —— sdf-js 3D surface-aware rayhatching 实验
// -----------------------------------------------------------------------------
// [A] projectedTangentField(probe) → 3D 法向投影到屏幕的角度场
// [B] densePack({ dsep: dsepFn }) → intensity → 线间距（暗处密、亮处稀）
// [C] Domain warping ×2：
//     - intensity warp（只影响密度纹理，silhouette 不变）
//     - spatial warp（warp 输入坐标，几何本身变 organic）
//
// Slider 实时触发重跑（150ms 防抖）。
// =============================================================================

import { makeProbe } from './scenes-3d.js';
import { createFlyCamera, lightFromSpherical } from '../../src/sdf/probe.js';
import { attachFlyControls } from './helpers/fly-controls.js';
import { densePack, projectedTangentField } from '../../src/streamline/index.js';
import * as easing from '../../src/math/easing.js';
import { createPerlin } from '../../src/field/noise.js';
const perlinNoise = createPerlin(42);             // 固定 seed，让结果可复现

// 从 URL hash 读取 scene（默认 16 capsules，跟旧 URL 兼容）
// 支持 #15 = 单球 + 地面 / #16 = 4 胶囊 + 地面
const SCENE = (() => {
  const h = parseInt(location.hash.slice(1), 10);
  return (h === 15 || h === 16) ? h : 16;
})();
// 同步 painted-scenes link
const paintedLink = document.getElementById('painted-link');
if (paintedLink) paintedLink.href = `./painted-scenes.html#${SCENE}`;
// 高亮当前 scene button
document.querySelectorAll('[data-scene]').forEach(btn => {
  if (parseInt(btn.dataset.scene, 10) === SCENE) btn.style.fontWeight = 'bold';
  btn.addEventListener('click', () => {
    location.hash = btn.dataset.scene;
    location.reload();
  });
});

const EASING_FNS = {
  'linear':              easing.linear,
  'smoothStart2':        easing.smoothStart2,
  'smoothStart3':        easing.smoothStart3,
  'smoothStart4':        easing.smoothStart4,
  'smoothStop2':         easing.smoothStop2,
  'smoothStop3':         easing.smoothStop3,
  'smoothStop4':         easing.smoothStop4,
  'smoothStep2':         easing.smoothStep2,
  'smoothStep3':         easing.smoothStep3,
  'smoothStepBounce':    easing.smoothStepBounce,
  'smoothStepElastic':   easing.smoothStepElastic,
};

// ---- Named recipes（按 SKILL.md idiom #8 的美学 register 表）-------------
const PRESETS = {
  'pasma-clean': {
    label:        'pasma-clean (几何纯度 / 平视)',
    DSEP_DARK:    0.004,  DSEP_LIGHT:    0.040,
    IMIN:         0.50,   IMAX:          1.00,
    EASING:       'smoothStart3',
    INT_WARP_AMP: 0.00,   INT_WARP_FREQ: 8.0,
    SP_WARP_AMP:  0.000,  SP_WARP_FREQ:  5.0,   SP_WARP_LAYERS: 1,
    CAM_YAW: 0, CAM_PITCH: 0, CAM_DIST: 3.5,
  },
  'pasma-3q': {
    label:        'pasma-3q (俯视 3/4 angle, 接近原作)',
    DSEP_DARK:    0.004,  DSEP_LIGHT:    0.040,
    IMIN:         0.50,   IMAX:          1.00,
    EASING:       'smoothStart3',
    INT_WARP_AMP: 0.00,   INT_WARP_FREQ: 8.0,
    SP_WARP_AMP:  0.000,  SP_WARP_FREQ:  5.0,   SP_WARP_LAYERS: 1,
    CAM_YAW: -0.30, CAM_PITCH: 0.30, CAM_DIST: 3.0,    // 左偏 17° + 俯 17° + 拉近
  },
  'henry-moore': {
    label:        'henry-moore (biomorphic 雕塑)',
    DSEP_DARK:    0.005,  DSEP_LIGHT:    0.045,
    IMIN:         0.45,   IMAX:          1.00,
    EASING:       'smoothStart2',
    INT_WARP_AMP: 0.00,   INT_WARP_FREQ: 8.0,
    SP_WARP_AMP:  0.050,  SP_WARP_FREQ:  4.0,   SP_WARP_LAYERS: 1,
    CAM_YAW: 0, CAM_PITCH: 0, CAM_DIST: 3.5,
  },
  'eroded-stone': {
    label:        'eroded-stone (风化石 / 陶器)',
    DSEP_DARK:    0.004,  DSEP_LIGHT:    0.035,
    IMIN:         0.55,   IMAX:          1.00,
    EASING:       'smoothStart3',
    INT_WARP_AMP: 0.08,   INT_WARP_FREQ: 12.0,
    SP_WARP_AMP:  0.030,  SP_WARP_FREQ:  7.0,   SP_WARP_LAYERS: 2,
    CAM_YAW: 0, CAM_PITCH: 0, CAM_DIST: 3.5,
  },
  'ink-wash': {
    label:        'ink-wash (水墨 / sumi-e)',
    DSEP_DARK:    0.003,  DSEP_LIGHT:    0.050,
    IMIN:         0.55,   IMAX:          1.00,
    EASING:       'smoothStop3',
    INT_WARP_AMP: 0.20,   INT_WARP_FREQ: 15.0,
    SP_WARP_AMP:  0.000,  SP_WARP_FREQ:  5.0,   SP_WARP_LAYERS: 1,
    CAM_YAW: 0, CAM_PITCH: 0, CAM_DIST: 3.5,
  },
  'chalk-grain': {
    label:        'chalk-grain (粉笔 / 细颗粒)',
    DSEP_DARK:    0.005,  DSEP_LIGHT:    0.035,
    IMIN:         0.50,   IMAX:          1.00,
    EASING:       'smoothStart2',
    INT_WARP_AMP: 0.10,   INT_WARP_FREQ: 25.0,
    SP_WARP_AMP:  0.000,  SP_WARP_FREQ:  5.0,   SP_WARP_LAYERS: 1,
    CAM_YAW: 0, CAM_PITCH: 0, CAM_DIST: 3.5,
  },
  'biomorph': {
    label:        'biomorph (Brancusi / Henry Moore 抽象有机体)',
    DSEP_DARK:    0.005,  DSEP_LIGHT:    0.045,
    IMIN:         0.50,   IMAX:          1.00,
    EASING:       'smoothStart2',
    INT_WARP_AMP: 0.00,   INT_WARP_FREQ: 8.0,
    SP_WARP_AMP:  0.060,  SP_WARP_FREQ:  6.0,   SP_WARP_LAYERS: 3,
    CAM_YAW: 0, CAM_PITCH: 0, CAM_DIST: 3.5,
  },
  'marble': {
    label:        'marble (大理石纹 / 几何不变，密度生 vein)',
    DSEP_DARK:    0.004,  DSEP_LIGHT:    0.045,
    IMIN:         0.50,   IMAX:          1.00,
    EASING:       'smoothStart2',
    INT_WARP_AMP: 0.25,   INT_WARP_FREQ: 28.0,
    SP_WARP_AMP:  0.010,  SP_WARP_FREQ:  25.0,  SP_WARP_LAYERS: 3,
    CAM_YAW: 0, CAM_PITCH: 0, CAM_DIST: 3.5,
  },
  'turbulence': {
    label:        'turbulence (湍流 / 火焰)',
    DSEP_DARK:    0.004,  DSEP_LIGHT:    0.060,
    IMIN:         0.40,   IMAX:          1.00,
    EASING:       'smoothStep3',
    INT_WARP_AMP: 0.15,   INT_WARP_FREQ: 18.0,
    SP_WARP_AMP:  0.080,  SP_WARP_FREQ:  12.0,  SP_WARP_LAYERS: 3,
    CAM_YAW: 0, CAM_PITCH: 0, CAM_DIST: 3.5,
  },
};

const $ = id => document.getElementById(id);

function readParams() {
  return {
    DSEP_DARK:      parseFloat($('dsep-dark').value),
    DSEP_LIGHT:     parseFloat($('dsep-light').value),
    EASING:         $('easing').value,
    IMIN:           parseFloat($('imin').value),
    IMAX:           parseFloat($('imax').value),
    SEED_COUNT:     parseInt($('seed-count').value, 10),
    STEP_SIZE:      parseFloat($('step-size').value),
    INT_WARP_AMP:   parseFloat($('int-warp-amp').value),
    INT_WARP_FREQ:  parseFloat($('int-warp-freq').value),
    SP_WARP_AMP:    parseFloat($('sp-warp-amp').value),
    SP_WARP_FREQ:   parseFloat($('sp-warp-freq').value),
    SP_WARP_LAYERS: parseInt($('sp-warp-layers').value, 10),
    CAM_YAW:        parseFloat($('cam-yaw').value),
    CAM_PITCH:      parseFloat($('cam-pitch').value),
    CAM_PX:         parseFloat($('cam-px').value),
    CAM_PY:         parseFloat($('cam-py').value),
    CAM_PZ:         parseFloat($('cam-pz').value),
    LIGHT_AZIM:     parseFloat($('light-azim').value),
    LIGHT_ALT:      parseFloat($('light-alt').value),
    LIGHT_DIST:     parseFloat($('light-dist').value),
  };
}

function updateLabels(p) {
  $('dsep-dark-v').textContent     = p.DSEP_DARK.toFixed(3);
  $('dsep-light-v').textContent    = p.DSEP_LIGHT.toFixed(3);
  $('imin-v').textContent          = p.IMIN.toFixed(2);
  $('imax-v').textContent          = p.IMAX.toFixed(2);
  $('seed-count-v').textContent    = p.SEED_COUNT;
  $('step-size-v').textContent     = p.STEP_SIZE.toFixed(3);
  $('int-warp-amp-v').textContent  = p.INT_WARP_AMP.toFixed(2);
  $('int-warp-freq-v').textContent = p.INT_WARP_FREQ.toFixed(1);
  $('sp-warp-amp-v').textContent   = p.SP_WARP_AMP.toFixed(3);
  $('sp-warp-freq-v').textContent  = p.SP_WARP_FREQ.toFixed(1);
  $('sp-warp-layers-v').textContent = p.SP_WARP_LAYERS;
  $('cam-yaw-v').textContent       = (p.CAM_YAW   * 180 / Math.PI).toFixed(0) + '°';
  $('cam-pitch-v').textContent     = (p.CAM_PITCH * 180 / Math.PI).toFixed(0) + '°';
  $('cam-px-v').textContent        = p.CAM_PX.toFixed(2);
  $('cam-py-v').textContent        = p.CAM_PY.toFixed(2);
  $('cam-pz-v').textContent        = p.CAM_PZ.toFixed(2);
  $('light-azim-v').textContent    = (p.LIGHT_AZIM * 180 / Math.PI).toFixed(0) + '°';
  $('light-alt-v').textContent     = (p.LIGHT_ALT  * 180 / Math.PI).toFixed(0) + '°';
  $('light-dist-v').textContent    = p.LIGHT_DIST.toFixed(1);
}

const CONTROL_IDS = [
  'dsep-dark', 'dsep-light', 'easing', 'imin', 'imax',
  'seed-count', 'step-size',
  'int-warp-amp', 'int-warp-freq',
  'sp-warp-amp', 'sp-warp-freq', 'sp-warp-layers',
  'cam-yaw', 'cam-pitch',
  'cam-px', 'cam-py', 'cam-pz',
  'light-azim', 'light-alt', 'light-dist',
];

// 双 timer 调度：preview (快、低质量、drag 时跟手) + final (慢、高质量、松手后)
//   preview: 50ms 防抖 → seedCount /4 + shadows off + stepSize ×2 + 1-octave warp cap
//   final:   600ms 静止后 → 用 slider 原值 full quality
// 鼠标拖动 / WASD 持续触发 scheduleRun → preview 50ms 一次轮询，final 不断 reset
// 直到用户停手 600ms 才 fire final
let previewTimer = null;
let finalTimer = null;
function scheduleRun() {
  updateLabels(readParams());
  clearTimeout(previewTimer);
  clearTimeout(finalTimer);
  previewTimer = setTimeout(() => runHatch(true),  50);
  finalTimer   = setTimeout(() => runHatch(false), 600);
}

CONTROL_IDS.forEach(id => {
  const el = $(id);
  el.addEventListener('input', scheduleRun);
  el.addEventListener('change', scheduleRun);
});

// 🎲 random easing
$('randomize-easing').addEventListener('click', () => {
  const keys = Object.keys(EASING_FNS);
  $('easing').value = keys[Math.floor(Math.random() * keys.length)];
  scheduleRun();
});

// Preset apply —— 一键设置所有 slider 到 named recipe
function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  $('dsep-dark').value     = preset.DSEP_DARK;
  $('dsep-light').value    = preset.DSEP_LIGHT;
  $('imin').value          = preset.IMIN;
  $('imax').value          = preset.IMAX;
  $('easing').value        = preset.EASING;
  $('int-warp-amp').value  = preset.INT_WARP_AMP;
  $('int-warp-freq').value = preset.INT_WARP_FREQ;
  $('sp-warp-amp').value     = preset.SP_WARP_AMP;
  $('sp-warp-freq').value    = preset.SP_WARP_FREQ;
  $('sp-warp-layers').value  = preset.SP_WARP_LAYERS;
  // Preset 用的是 orbit camera 语义 (CAM_YAW/PITCH/DIST)，转换到当前 fly camera：
  //   fly_yaw = -orbit_yaw（convention 翻转）
  //   fly_pitch = orbit_pitch
  //   fly_pos = orbit cam position = [D·sin(Y)·cos(P), D·sin(P), -D·cos(Y)·cos(P)]
  const ocy = preset.CAM_YAW   ?? 0;
  const ocp = preset.CAM_PITCH ?? 0;
  const ocd = preset.CAM_DIST  ?? 3.5;
  const cp = Math.cos(ocp), sp = Math.sin(ocp);
  const cy = Math.cos(ocy), sy = Math.sin(ocy);
  $('cam-yaw').value   = (-ocy).toFixed(3);
  $('cam-pitch').value = ocp.toFixed(3);
  $('cam-px').value    = (ocd * sy * cp).toFixed(2);
  $('cam-py').value    = (ocd * sp).toFixed(2);
  $('cam-pz').value    = (-ocd * cy * cp).toFixed(2);
  scheduleRun();
}
$('preset').addEventListener('change', e => applyPreset(e.target.value));

const clamp01 = v => Math.max(0, Math.min(1, v));

// ---- IQ recursive domain warp ---------------------------------------------
// LAYERS=1 = 标准单层 warp（跟之前的代码等价）
// LAYERS=2 = warp of warp（"卷"）
// LAYERS=3 = warp of warp of warp（"湍流 / 火焰"）
//
// IQ 原论文：中间 warp 用 `4 * amp`（大幅度），output 用 `amp`（小幅度）。
// 大的中间 amp 让 noise sample 位置真的"跳"到不同 noise 区域 → LAYERS 升级
// 才有明显视觉差。如果中间也用 amp，递归基本被压在原点附近，跟单层一样。
function fbmWarpedCoord(x, y, amp, freq, layers) {
  if (amp === 0 || layers < 1) return [x, y];
  const intermediateAmp = amp * 4;
  let qx = 0, qy = 0;
  for (let l = 0; l < layers; l++) {
    const sx = x + intermediateAmp * qx;
    const sy = y + intermediateAmp * qy;
    qx = perlinNoise(sx * freq,        sy * freq);
    qy = perlinNoise(sx * freq + 1000, sy * freq + 1000);
  }
  return [x + amp * qx, y + amp * qy];
}

// =============================================================================
// preview=true: drag/fly 期间用，少种子 + 无阴影 + 大 stepSize + 跳 warp，保证 60fps 跟手
// preview=false: 静止 600ms 后跑 full quality
function runHatch(preview = false) {
  const p = readParams();
  const imin = p.IMIN;
  const imax = Math.max(p.IMAX, p.IMIN + 0.01);

  // ---- Free-fly camera：position + yaw/pitch 直接定姿态 ---------------------
  // 跟 Blender fly mode / UE editor 同 paradigm，pointer-lock 后 WASD + 鼠标转头
  // 跟 scenes-3d.js DEFAULT_CAMERA focal=2 一致（透视）
  const camera = createFlyCamera({
    position: [p.CAM_PX, p.CAM_PY, p.CAM_PZ],
    yaw:      p.CAM_YAW,
    pitch:    p.CAM_PITCH,
    focal:    2,
  });
  // 光源球坐标 → Cartesian (scene engine convention #4)
  const lightPos = lightFromSpherical(p.LIGHT_AZIM, p.LIGHT_ALT, p.LIGHT_DIST);
  // Preview mode：shadows=false 省 ~50% raymarch3 调用
  const rawProbeForCam = makeProbe(SCENE, camera, lightPos, !preview);

  // ---- spatial-warped probe（每次重跑用当前 warp 参数构造一个 closure）------
  // Preview 跳 spatial warp 省 fbm 计算（每点 ~3 个 Perlin lookup）
  let _lx, _ly, _lr;
  const skipSpWarp = preview || p.SP_WARP_AMP === 0;
  const probe = skipSpWarp
    ? rawProbeForCam
    : (x, y) => {
        if (x === _lx && y === _ly) return _lr;
        _lx = x; _ly = y;
        const [xW, yW] = fbmWarpedCoord(x, y, p.SP_WARP_AMP, p.SP_WARP_FREQ, p.SP_WARP_LAYERS);
        _lr = rawProbeForCam(xW, yW);
        return _lr;
      };

  // ---- field / inScene / dsepFn 都基于这个 spatial-warped probe -------------
  const field = projectedTangentField(probe, {
    ref:    [1, 0, 0],
    camera,
  });

  const inScene = (x, y) => {
    const d = probe(x, y);
    return d.region === 'object' || d.region === 'ground';
  };

  const easingFn = EASING_FNS[p.EASING] || easing.linear;
  const dsepFn = (x, y) => {
    const d = probe(x, y);
    if (!d || d.region === 'background') return p.DSEP_LIGHT;

    let i = clamp01(d.intensity);
    // intensity warp —— 只影响密度，不影响 silhouette
    if (p.INT_WARP_AMP > 0) {
      i = clamp01(i + p.INT_WARP_AMP * perlinNoise(x * p.INT_WARP_FREQ, y * p.INT_WARP_FREQ));
    }

    const ir = clamp01((i - imin) / (imax - imin));
    const t = clamp01(easingFn(ir));
    return p.DSEP_DARK + (p.DSEP_LIGHT - p.DSEP_DARK) * t;
  };

  // ---- 跑流线 ----
  // Preview mode: seedCount /4 + stepSize ×2.5 + maxSteps /2 + 退化 dsep（密度对比降）
  // 目标 ~50-100ms/帧 让 fly mode 60fps 跟手；松手 600ms 后 full quality 重渲
  const VIEW = 1.0;
  const previewSeedCount = Math.max(500, Math.round(p.SEED_COUNT / 4));
  const previewStepSize = Math.min(0.015, p.STEP_SIZE * 2.5);
  const seedCount = preview ? previewSeedCount : p.SEED_COUNT;
  const stepSize  = preview ? previewStepSize  : p.STEP_SIZE;
  const maxStepsPerLine = preview ? 400 : 800;
  // Preview 时 dsep 也用 light 端（线稀，trace 数少）
  const effectiveDsepFn = preview ? () => p.DSEP_LIGHT : dsepFn;

  $('stats').textContent = preview ? 'preview…' : 'tracing…';

  setTimeout(() => {
    const t0 = performance.now();
    const streamlines = densePack(field, {
      bounds:          { minX: -VIEW, maxX: VIEW, minY: -VIEW, maxY: VIEW },
      dsep:            effectiveDsepFn,
      dsepMax:         p.DSEP_LIGHT,
      stepSize,
      minLength:       6,
      seedCount,
      seedStrategy:    'grid',
      maxStreamlines:  Math.max(seedCount, 5000),
      maxStepsPerLine,
      extraValid:      inScene,
    });
    const elapsed = performance.now() - t0;

    // ---- 渲染 ----
    const canvas = $('c');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#fdfdfd';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#181818';
    ctx.lineWidth = 0.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const wxToPx = wx => (wx + VIEW) / (2 * VIEW) * W;
    const wyToPx = wy => (wy + VIEW) / (2 * VIEW) * H;

    for (const sl of streamlines) {
      const pts = sl.centerline;
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(wxToPx(pts[0][0]), wyToPx(pts[0][1]));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(wxToPx(pts[i][0]), wyToPx(pts[i][1]));
      }
      ctx.stroke();
    }

    const warpTag = [];
    if (p.INT_WARP_AMP > 0 && !preview) warpTag.push(`int-warp ${p.INT_WARP_AMP.toFixed(2)}@${p.INT_WARP_FREQ}`);
    if (p.SP_WARP_AMP > 0 && !preview)  warpTag.push(`sp-warp ${p.SP_WARP_AMP.toFixed(3)}@${p.SP_WARP_FREQ}×${p.SP_WARP_LAYERS}L`);
    const tag = preview ? ' · ⚡ preview' : '';
    $('stats').textContent =
      `${streamlines.length} lines · dsep ${p.DSEP_DARK}→${p.DSEP_LIGHT} · curve=${p.EASING} · i ∈ [${imin.toFixed(2)},${imax.toFixed(2)}]`
      + (warpTag.length ? ` · ${warpTag.join(' / ')}` : '')
      + tag + ` · ${elapsed.toFixed(0)}ms`;
  }, 30);
}

updateLabels(readParams());
runHatch();

// ---- Fly controls ---------------------------------------------------------
// 鼠标 / WASD 输入 → 写回 5 个 camera slider → dispatch 'input' → 现有 debounced
// rerender 自动触发。State 单一来源 = slider（rerender 已经从 slider 读）。
// fly-controls 只做 "input → slider value" 的纯 wrapper。
const canvasEl = $('c');
const DEFAULTS = { yaw: 0, pitch: 0, position: [0, 0, -3.5] };

attachFlyControls(canvasEl,
  // getState：从 5 个 slider 读最新
  () => ({
    yaw:      parseFloat($('cam-yaw').value),
    pitch:    parseFloat($('cam-pitch').value),
    position: [parseFloat($('cam-px').value), parseFloat($('cam-py').value), parseFloat($('cam-pz').value)],
  }),
  // setState：写回 slider + trigger input event（→ 既更新 label 又触发 debounced rerender）
  (partial) => {
    if ('yaw' in partial) {
      $('cam-yaw').value = partial.yaw.toFixed(3);
      $('cam-yaw').dispatchEvent(new Event('input'));
    }
    if ('pitch' in partial) {
      $('cam-pitch').value = partial.pitch.toFixed(3);
      $('cam-pitch').dispatchEvent(new Event('input'));
    }
    if ('position' in partial) {
      $('cam-px').value = partial.position[0].toFixed(2);
      $('cam-py').value = partial.position[1].toFixed(2);
      $('cam-pz').value = partial.position[2].toFixed(2);
      $('cam-px').dispatchEvent(new Event('input'));
      // px 那次 input 已经触发 scheduleRun，py/pz 不需要再各自 trigger（debounce 合并）
    }
  },
  // R 键 reset → 写回 defaults
  {
    onReset: () => {
      $('cam-yaw').value = DEFAULTS.yaw;
      $('cam-pitch').value = DEFAULTS.pitch;
      $('cam-px').value = DEFAULTS.position[0];
      $('cam-py').value = DEFAULTS.position[1];
      $('cam-pz').value = DEFAULTS.position[2];
      scheduleRun();
    },
  },
);
