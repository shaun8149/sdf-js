// =============================================================================
// MVP Step 1 —— Text → JS code → SDF render
// -----------------------------------------------------------------------------
// 直接调 Anthropic API（browser-direct flag）拿 JS code → 剥 markdown / 重写
// imports / Blob URL 动态 import → 渲染到 canvas。
//
// API key 存 localStorage（本地 demo）。商业部署改 backend proxy。
// =============================================================================

import * as render from '../../src/render/index.js';
import { SDF3 } from '../../src/index.js';
import * as bobPalette from '../../src/palette/bob.js';
import * as tyler from '../../src/palette/tyler.js';
import { createFly3DRenderer } from '../../src/render/flyLambert.js';
import { createBobShaderRenderer } from '../../src/render/bobShader.js';

const $ = id => document.getElementById(id);

// ============================================================================
// Fly 3D renderer (lazy singleton — only init'd when user first picks Fly 3D pill)
// ============================================================================
let _fly3dRenderer = null;
function getFly3D() {
  if (_fly3dRenderer) return _fly3dRenderer;
  const wgl = $('c-webgl');
  if (!wgl) return null;
  _fly3dRenderer = createFly3DRenderer({
    canvas: wgl,
    getControls: () => ({
      lightAzim: +$('fly-light-azim').value,
      lightAlt:  +$('fly-light-alt').value,
      lightDist: +$('fly-light-dist').value,
      fov:       +$('fly-focal').value,
      shadowsOn: $('fly-shadows').checked,
      groundOn:  $('fly-ground').checked,
      checkerOn: $('fly-checker').checked,
    }),
    onFps: (fps) => {
      const el = $('fly3d-fps');
      if (el) el.textContent = `FPS: ${fps.toFixed(0)}`;
    },
    onCamUpdate: (s) => {
      const r = $('fly3d-readout');
      if (r) r.textContent =
        `pos: ${s.position.map(x => x.toFixed(2)).join(' ')} · yaw ${(s.yaw*180/Math.PI).toFixed(0)}° pitch ${(s.pitch*180/Math.PI).toFixed(0)}°`;
    },
  });
  return _fly3dRenderer;
}

// ============================================================================
// BOB GPU renderer (lazy singleton, shares #c-webgl canvas with Fly 3D)
// ============================================================================
let _bobShaderRenderer = null;
function getBobShader() {
  if (_bobShaderRenderer) return _bobShaderRenderer;
  const wgl = $('c-webgl');
  if (!wgl) return null;
  _bobShaderRenderer = createBobShaderRenderer({
    canvas: wgl,
    twoPass: true,              // ← autoscope 2-pass FBO 沙画（跟 autoscope-clone 同款）
    bufferResolution: 320,
    getControls: () => ({
      lightAzim: +$('bob-light-azim').value,
      lightAlt:  +$('bob-light-alt').value,
      lightDist: 6,  // BOB 模式光源距离固定（autoscope 没暴露 dist slider）
      fov:        +$('bob-focal').value,
      coldiv:     +$('bob-coldiv').value,
      coloration: +$('bob-coloration').value,
      shadowMode: +$('bob-shadow-mode').value,
      shadowStrength: +$('bob-shadow-strength').value,
      shadowsOn:  $('bob-shadows').checked,
      groundOn:   $('bob-ground').checked,
      noiseSpeed: +$('bob-noise').value,
      exposure:   +$('bob-exposure').value,
      saturation: +$('bob-saturation').value,
      worldScale: 8.0,  // MVP: LLM ~0.5-unit SDF → 8.0 给 spaceCol 量化补偿。autoscope-clone 用 0.5（10-unit SDF）
      // Post-process（沙画 noise）—— 跟 autoscope-clone 同款
      postNoise:    +$('bob-post-noise').value,
      postNFactor:  1.0,
      postNoiseCap: 0.5,
    }),
    onFps: (fps) => {
      const el = $('bob-fps');
      if (el) el.textContent = `FPS: ${fps.toFixed(0)}`;
    },
    onCamUpdate: (s) => {
      const r = $('bob-readout');
      if (r) r.textContent =
        `pos: ${s.position.map(x => x.toFixed(2)).join(' ')} · yaw ${(s.yaw*180/Math.PI).toFixed(0)}° pitch ${(s.pitch*180/Math.PI).toFixed(0)}°`;
    },
    onPaletteChange: (sample) => {
      // sample = { palette1, palette2, paper, sky1, sky2 }
      const renderRow = (id, colors) => {
        const el = $(id);
        if (!el) return;
        el.innerHTML = '';
        for (const c of colors) {
          const sw = document.createElement('div');
          sw.style.cssText = `flex:1; background:${c}; min-width:0;`;
          el.appendChild(sw);
        }
      };
      renderRow('bob-palette-row1', sample.palette1);
      renderRow('bob-palette-row2', sample.palette2);
    },
  });
  return _bobShaderRenderer;
}

// ============================================================================
// Color sources (BOB pigments + Fidenza schemes pre-baked to RGB palettes)
// ============================================================================

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const BOB_PIGMENTS_RGB   = bobPalette.PIGMENTS.map(hexToRgb);
const BOB_PIGMENTS_2_RGB = bobPalette.PIGMENTS_2.map(hexToRgb);

// Fidenza schemes 在 tyler.js 是 weighted random factory（fg/bg → 单 HSB 三元组）
// 我们 deterministically call fg() N 次取 top K unique 颜色烤成 RGB palette。
function bakeFidenzaPalettes(samplesPerScheme = 60, topK = 12, seed = 42) {
  // Mulberry32 PRNG 临时替换 Math.random（factories 不接 rng 参数）
  function mulberry32(s) {
    s = s | 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const orig = Math.random;
  Math.random = mulberry32(seed);
  try {
    const out = {};
    for (const [name, { fg }] of Object.entries(tyler.SCHEMES)) {
      const seen = new Map();
      for (let i = 0; i < samplesPerScheme; i++) {
        const hsb = fg();
        const rgb = tyler.hsbToRgb(hsb).map(v => Math.round(v));
        const key = rgb.join(',');
        seen.set(key, (seen.get(key) || 0) + 1);
      }
      // 按频次降序取 topK，得到该 scheme 的代表色
      out[name] = Array.from(seen.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topK)
        .map(([key]) => key.split(',').map(Number));
    }
    return out;
  } finally {
    Math.random = orig;
  }
}

const FIDENZA_PALETTES = bakeFidenzaPalettes();

// 色源表：key 给 select option 用，每条记录 palette + palette2 + 显示名
const COLOR_SOURCES = {
  llm: { name: 'LLM 颜色 (默认 HSL 展开)', palette: null, palette2: null },
  'bob:1':    { name: 'BOB Set 1 (12 色 偏暖)', palette: BOB_PIGMENTS_RGB,   palette2: null },
  'bob:2':    { name: 'BOB Set 2 (11 色 偏冷)', palette: BOB_PIGMENTS_2_RGB, palette2: null },
  'bob:both': { name: 'BOB 双套交替 (BOB 原版)', palette: BOB_PIGMENTS_RGB,  palette2: BOB_PIGMENTS_2_RGB },
};

// Fidenza schemes 全部加进去
for (const [name, palette] of Object.entries(FIDENZA_PALETTES)) {
  COLOR_SOURCES[`fidenza:${name}`] = {
    name: `Fidenza ${name}`,
    palette,
    palette2: null,
  };
}

// ============================================================================
// Render mode dispatcher
// ----------------------------------------------------------------------------
// LLM code 总是写 `render.silhouette(ctx, layers, options)`。
// 我们在 rewriteRenderCalls 里把它替换成 `window.__renderDispatch(...)`，
// 然后这里根据 #render-mode select 的当前值路由到具体 renderer。
// 同时缓存 __lastRenderArgs，让 mode 切换时不需要重跑 LLM 代码。
// ============================================================================
// 排列 (Nx × Ny tile): 用 SDF chainable transforms scale + rep + translate 重写 layers
// 数学（per-axis）:
//   - period_x = 2V / Nx  ，period_y = 2V / Ny
//   - offset_x = Nx 偶数时 period_x/2，奇数时 0（独立判断）
//   - scale_x = 1/Nx，scale_y = 1/Ny（非对称时 subject 在 cell 内 squash 但 cells 满铺 view）
//   - 每个 SDF: sdf.scale([sx, sy]).rep([px, py], opts).translate([ox, oy])
// chain 顺序：translate 必须 *在 rep 之后*（否则偶数 N 会让 subject 跨 wrap boundary 半个被切）。
// Nx 或 Ny = 1 时该轴不 rep：用超大 period（100V）让 wrap 在 view 范围内不触发。
function applyArrangement(layers, nx, ny, view, padding = 0) {
  const Nx = Math.max(1, nx | 0);
  const Ny = Math.max(1, ny | 0);
  if (Nx === 1 && Ny === 1 && padding === 0) return layers;
  // 3D 场景跳过 arrangement：2D 的 scale([sx,sy]) / translate([ox,oy]) 应用到 SDF3
  // 会让 z 分量变 NaN，整个 SDF 不可用。3D arrangement 留作未来扩展。
  if (layers.length > 0 && layers[0].sdf instanceof SDF3) {
    if (Nx > 1 || Ny > 1) console.warn('[arrangement] 3D 场景暂不支持 NxN tile，已跳过 arrangement');
    return layers;
  }
  const sx = 1 / Nx, sy = 1 / Ny;
  const px = Nx > 1 ? 2 * view / Nx : 100 * view;  // huge period = effective no-rep
  const py = Ny > 1 ? 2 * view / Ny : 100 * view;
  const ox = (Nx > 1 && Nx % 2 === 0) ? px / 2 : 0;
  const oy = (Ny > 1 && Ny % 2 === 0) ? py / 2 : 0;
  const opts = padding > 0 ? { padding } : undefined;
  return layers.map(({ sdf, color }) => ({
    sdf: sdf.scale([sx, sy]).rep([px, py], opts).translate([ox, oy]),
    color,
  }));
}

function getActiveArrangement() {
  return {
    nx: parseInt($('p-nx')?.value || '1'),
    ny: parseInt($('p-ny')?.value || '1'),
  };
}

window.__lastRenderArgs = null;

// 给 layers 构建 union silhouette mask test —— pattern 用它的 inverse 来"避开" subject。
// 这是 Pasma 那一脉超现实场景的核心 compositing 机制：pattern fills negative space，
// subject 作为 opaque region 占据 positive space。SDF2 直接 inside-test；SDF3
// 走相机投影 raymarch（每像素 ~80 步，cell 中心采样 1 次，可接受）。
function buildSubjectMaskFn(layers, yaw, pitch, cameraDist) {
  if (!layers || layers.length === 0) return null;
  // ⚠ 静态 import 不能在函数里 await，假定 raymarch3 / SDF3 已经 import 到模块顶部
  // 这里用 sniff 方式：layer.sdf 是 SDF3 实例 → raymarch；否则 → 2D inside-test
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const inverseRotate = (p) => {
    const x = p[0] * cy - p[2] * sy;
    const z0 = p[0] * sy + p[2] * cy;
    const y = p[1];
    return [x, y * cp - z0 * sp, y * sp + z0 * cp];
  };
  // 预编译每 layer 的 inside-test
  const tests = layers.map(({ sdf }) => {
    if (sdf instanceof SDF3) {
      const camSdf = (p) => sdf(inverseRotate(p));
      // 用 sdf3 raymarch 通过 callable —— 这里 inline 化（避免去 sdf/raymarch.js 拿）
      // 简化版 sphere-trace：80 step，eps 0.003
      return (wx, wy) => {
        let t = 0;
        const tMax = cameraDist * 3;
        for (let i = 0; i < 80; i++) {
          const p = [wx, wy, cameraDist - t];
          const d = camSdf(p);
          if (d < 0.003) return true;
          t += d;
          if (t > tMax) return false;
        }
        return false;
      };
    }
    return (wx, wy) => sdf([wx, wy]) < 0;
  });
  // OR 所有 layer 的 inside-test
  return (wx, wy) => {
    for (const test of tests) if (test(wx, wy)) return true;
    return false;
  };
}

// 构建 density field：Pasma 风格"左上密 / 右下稀"径向衰减。
// variation=0 → 均匀（field=1 全保留）；variation=1 → 最大变化。
// 左上角 (-view, +view) 处 field=1；右下角 (+view, -view) 处 field=1-variation。
function buildDensityField(variation, view, flipY) {
  if (variation <= 0) return null;
  return (wx, wy) => {
    // 归一化坐标 0..1，左上 (0,0) → 右下 (1,1)
    const u = (wx + view) / (2 * view);
    const v = flipY ? (view - wy) / (2 * view) : (wy + view) / (2 * view);
    // 径向距离从左上角 (0,0)，最大值 √2 ≈ 1.41
    const r = Math.sqrt(u * u + v * v) / Math.SQRT2;
    return Math.max(0, 1 - variation * r);
  };
}

// 画 background pattern（Truchet / Gosper / Motifs），返回 true if 画了。
// 画完后 subject renderer 应该 background=null 透明叠加（保留 pattern）。
// layers 提供时，pattern 自动 mask 出 subject silhouette（pattern 只在 subject 外画）。
function drawBackgroundPattern(ctx, view, flipY, layers = null) {
  const patternMode = $('pattern-mode')?.value || 'none';
  if (patternMode === 'none') return false;
  const density = parseFloat($('p-pattern-density')?.value || '0.01');
  const depth = parseInt($('p-pattern-depth')?.value || '4');
  const variation = parseFloat($('p-pattern-variation')?.value || '0');
  const bandSize = parseFloat($('p-pattern-band-size')?.value || '0.16');
  const bands = parseInt($('p-pattern-bands')?.value || '3');
  const color = $('p-pattern-color')?.value || '#1a1410';

  // 自动 mask：layers 给了 → 构建 union silhouette mask，pattern invert（只在 outside）
  const maskFn = layers ? buildSubjectMaskFn(layers, 0.5, 0.35, 4) : null;
  // density field：variation > 0 时 Pasma 风格"左上密 / 右下稀"
  // 注：仅 Truchet 用 densityField（Motifs / curves 是固定结构，不接受 density variation）
  const densityField = buildDensityField(variation, view, flipY);

  const common = {
    view,
    flipY,
    color,
    lineWidth: 0.5,
    background: '#fdf9f6',
    maskFn,
    maskInvert: true,  // pattern 只在 subject 之外
  };
  if (patternMode === 'truchet') {
    render.truchet(ctx, { ...common, cellSize: density, densityField });
  } else if (patternMode === 'gosper') {
    render.gosper(ctx, { ...common, depth: Math.min(depth, 5) }); // Gosper depth>=6 太爆
  } else if (patternMode === 'motifs') {
    // Motifs: hand-drawn Nijhoff library，multi-band grid sweep，不接 noise/density field
    render.motifGrid(ctx, { ...common, baseCellSize: bandSize, bands });
  }
  return true;
}

window.__renderDispatch = (ctx, layers, options) => {
  window.__lastRenderArgs = { ctx, layers, options };
  const mode = $('render-mode')?.value || 'silhouette';
  const { nx, ny } = getActiveArrangement();
  const view = options.view ?? 1.2;
  const flipY = options.flipY ?? true;
  const padding = parseInt($('p-rep-padding')?.value || '0');
  console.log('[dispatch] mode =', mode, '| layers =', layers.length, '| view =', view, '| arrangement =', nx + 'x' + ny);

  const arrLayers = applyArrangement(layers, nx, ny, view, padding);

  // 1. 先画 background pattern（如果选了），自动用 subject silhouette 作 inverse mask
  //    → pattern 只在 subject 外画，subject 区域留给 renderer 自己 paint
  // 返回 true 时 subject 走透明合成，叠在已画好的 pattern 上面
  // Lambert (raymarched) 不接受透明合成（会 fillRect 覆盖 pattern），不兼容组合
  const patternPainted = drawBackgroundPattern(ctx, view, flipY, arrLayers);
  const subjectOptions = patternPainted ? { ...options, background: null } : options;

  if (mode === 'stipple') {
    const source = COLOR_SOURCES[$('color-source')?.value || 'llm'] || COLOR_SOURCES.llm;
    render.bobStipple(ctx, arrLayers, {
      ...subjectOptions,
      ...readStippleParams(),
      colorPalette:  source.palette,
      colorPalette2: source.palette2,
      // pattern 模式下关 stippleBackground —— 否则 stipple 会用白色把 pattern 反覆盖
      ...(patternPainted ? { stippleBackground: false } : {}),
    });
  } else if (mode === 'hatch') {
    const toCss = (c) => Array.isArray(c)
      ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
      : (c || '#fdf9f6');
    const bg = subjectOptions.background;
    // patternPainted 时 bg=null → hatch 跳过 fillRect，保留底纹；否则按原 bg 处理
    const bgStr = bg === null ? null
      : Array.isArray(bg) ? toCss(bg)
      : (bg && bg.top ? toCss(bg.top) : (bg || '#fdf9f6'));
    const hatchLayers = arrLayers.map(({ sdf, color, ...rest }) => ({
      sdf, color: toCss(color), ...rest,
    }));
    render.hatch(ctx, hatchLayers, {
      view,
      background: bgStr,
      flipY,
    });
  } else if (mode === 'raymarched') {
    // Lambert 不支持透明合成——pattern 会被覆盖；warn 用户
    if (patternPainted) console.warn('[dispatch] Lambert + background pattern: pattern is overwritten (Lambert fills opaque)');
    render.raymarched(ctx, arrLayers, options);
  } else if (mode === 'fly3d') {
    // Fly 3D = GPU shader Lambert + pointer-lock fly cam。layers[0].sdf 直接送
    // compiler；arrangement / pattern 都不支持（GPU 全填 + 没 rep AST compile）
    if (patternPainted) console.warn('[dispatch] Fly 3D + pattern: GPU shader fills opaque, pattern overwritten');
    const fly = getFly3D();
    if (!fly) { $('status').textContent = '⚠ Fly 3D: WebGL not available'; return; }
    if (!layers.length || !layers[0]?.sdf) { $('status').textContent = '⚠ Fly 3D: no SDF in scene'; return; }
    const baseSdf = layers[0].sdf;
    const check = fly.canRender(baseSdf);
    if (!check.ok) {
      $('status').textContent = `⚠ Fly 3D 不能编译：${check.error}（含 extrude/revolve/rep 的 SDF 暂不支持，留 v1）`;
      return;
    }
    try {
      const { bytes } = fly.render(baseSdf);
      $('status').textContent = `✓ Fly 3D · GPU shader ${(bytes / 1024).toFixed(1)}KB · 点击 canvas 进 WASD fly mode`;
    } catch (e) {
      $('status').textContent = `✗ Fly 3D shader error: ${e.message}`;
      console.error('[fly3d]', e);
    }
  } else if (mode === 'bob-shader') {
    // BOB GPU = Autoscope-style 量化色块 + 时间漂移噪声 + imin object-index。
    // 跟 Fly 3D 共享 #c-webgl canvas，互斥 mount/unmount。
    if (patternPainted) console.warn('[dispatch] BOB GPU + pattern: GPU shader fills opaque, pattern overwritten');
    const bob = getBobShader();
    if (!bob) { $('status').textContent = '⚠ BOB GPU: WebGL not available'; return; }
    if (!layers.length || !layers[0]?.sdf) { $('status').textContent = '⚠ BOB GPU: no SDF in scene'; return; }
    const baseSdf = layers[0].sdf;
    const check = bob.canRender(baseSdf);
    if (!check.ok) {
      $('status').textContent = `⚠ BOB GPU 不能编译：${check.error}（含 extrude/revolve/rep 的 SDF 暂不支持）`;
      return;
    }
    // 调试：递归 flatten union 算总 leaf 数（=spaceCol 的 objNum 多样性上限）
    const countLeaves = (s) => {
      const a = s.ast;
      if (a?.kind === 'op' && a.name === 'union') {
        return a.children.reduce((n, c) => n + countLeaves(c), 0);
      }
      return 1;
    };
    const ast = baseSdf.ast;
    const leafCount = countLeaves(baseSdf);
    if (ast?.kind === 'op' && ast.name === 'union') {
      console.log(`[bob-shader] flattened to ${leafCount} leaves (top union: ${ast.children.length} direct + nested recursed)`);
    } else if (leafCount > 1) {
      console.log(`[bob-shader] top is '${ast?.name}' but ${leafCount} leaves found by recursion`);
    } else {
      console.warn(`[bob-shader] only 1 leaf (top='${ast?.name ?? ast?.kind}') → reduced color variety. LLM should wrap scene as union(...) of named parts.`);
    }
    try {
      const { bytes } = bob.render(baseSdf);
      $('status').textContent = `✓ BOB GPU · GPU shader ${(bytes / 1024).toFixed(1)}KB · Autoscope-style · 🎨 Shuffle 换调色板`;
    } catch (e) {
      $('status').textContent = `✗ BOB GPU shader error: ${e.message}`;
      console.error('[bob-shader]', e);
    }
  } else {
    render.silhouette(ctx, arrLayers, subjectOptions);
  }
};

// ============================================================================
// API key (localStorage)
// ============================================================================
const apiKeyInput = $('api-key');
apiKeyInput.value = localStorage.getItem('anthropic-key') || '';
apiKeyInput.addEventListener('input', () => {
  localStorage.setItem('anthropic-key', apiKeyInput.value);
});

// ============================================================================
// 1. 加载 system prompt（= 当前 SKILL.md 副本）
// ============================================================================
let SYSTEM_PROMPT = '';

async function loadSystemPrompt() {
  try {
    const res = await fetch('./system-prompt.md');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    SYSTEM_PROMPT = await res.text();
    $('sys-prompt-status').textContent =
      `✓ System prompt loaded (${SYSTEM_PROMPT.length} chars, ${SYSTEM_PROMPT.split('\n').length} lines)`;
  } catch (e) {
    $('sys-prompt-status').textContent = `✗ failed to load system-prompt.md: ${e.message}`;
    $('sys-prompt-status').style.color = '#b00';
  }
}

// 把当前 renderer 视觉特征注入到 user prompt 前面。
// 关键：**只描述 renderer 的视觉表达**，不限制 SDF 维度——4 个 renderer 都接受 SDF2 / SDF3，
// LLM 看 prompt 内容自然决定（"花瓶 / 杯子 / 螺旋柱" → SDF3；"icon / flat illustration" → SDF2）。
// Lambert 是个特例：它本身就是 3D shading renderer，必须 SDF3。
function injectRenderModeHint(userPrompt) {
  const mode = $('render-mode')?.value || 'silhouette';
  const hints = {
    silhouette: `[Renderer: Silhouette — flat-color filled regions, smoothstep 1-px AA. Accepts SDF2 (per-pixel inside-test) OR SDF3 (raymarch hit → flat color projected silhouette). Choose SDF dim by subject: flat editorial / icon / emoji → SDF2; physical 3D forms (vase / cup / column / dice / volumetric thing) → SDF3.]`,
    stipple:    `[Renderer: Stipple (BOB 点彩) — multi-layer brush stipple, painterly register (Lotta / Bonnard / 后印象派). Accepts SDF2 (standard 2D inside-test) OR SDF3 (per-cell raymarch probe → Lambert intensity modulates brush density: dark = dense stipple, bright = sparse). Choose SDF dim by subject — both modes work, SDF3 produces volumetric shading via stipple density.]`,
    hatch:      `[Renderer: Lines (Pasma 流线 hatching) — contour-following evenly-spaced streamlines (Piter Pasma / generative plotter aesthetic). Accepts SDF2 (lines follow 2D contour, gradient-perp field) OR SDF3 (auto-detects → Pasma 3D rayhatching: lines wrap around the surface following projected tangents, true "缠绕表面" effect). Choose SDF dim by subject. Color = line stroke. NO dilate outline.]`,
    raymarched: `[Renderer: Lambert (Raymarched) — orthographic raymarched 3D with diffuse shading. REQUIRES SDF3 — use extrude / revolve / native 3D primitives (sphere/box/cylinder/torus/cone/etc.) / twist / bend / elongate. Single SDF3 + single color recommended. NO dilate outline.]`,
    fly3d:      `[Renderer: Fly 3D (Shader Lambert, GPU) — WebGL fragment shader raymarcher with pointer-lock fly camera (WASD + mouse). REQUIRES SDF3 — supports native primitives (sphere/box/cylinder/torus/capsule/capped_cone/cone/ellipsoid/rounded_box/tetrahedron/octahedron/dodecahedron/icosahedron/pyramid/wireframe_box) + transforms (translate/scale/rotate) + boolean (union/intersection/difference incl. smooth_k) + twist/bend/shell/dilate/erode/blend/negate. DOES NOT YET support extrude / revolve / rep (CPU fallback only) — prefer native 3D primitives + Boolean composition over 2D-upgrade ops. Single composed SDF3.]`,
    'bob-shader': `[Renderer: BOB GPU (Autoscope-style) — WebGL shader with Autoscope-style quantized palette coloring + time-animated drifting noise + per-object color separation via imin. REQUIRES SDF3 (same compile path as Fly 3D). **CRUCIAL**: structure the scene as a top-level union(...) of multiple distinct primitives — each child gets a unique object index → distinct color block, producing BOB-like 多色震颤. AVOID single monolithic SDF (collapses to one color). PREFER 3-10 named parts via union. Smooth-union k=0.05~0.15 keeps geometry organic. Supports: native 3D primitives + transforms + boolean + twist/bend/shell/dilate/erode/blend/negate. NO extrude / revolve / rep.]`,
  };
  const hint = hints[mode];
  return hint ? `${hint}\n\n${userPrompt}` : userPrompt;
}

// ============================================================================
// 2. LLM call —— Anthropic Messages API direct from browser
// ============================================================================
async function generateCode(userPrompt, model) {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) throw new Error('请填 Anthropic API key（顶部输入框）');
  if (!SYSTEM_PROMPT) throw new Error('system prompt 还没加载完');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: injectRenderModeHint(userPrompt) }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return {
    text: data.content[0].text,
    usage: data.usage,
  };
}

// ============================================================================
// 3. 渲染 —— 剥 markdown / 重写 imports / Blob URL 动态 import
// ============================================================================

function rewriteImports(code, baseUrl) {
  return code.replace(
    /(\bfrom\s+|^import\s*\(?\s*)['"](\.[^'"]*)['"]/gm,
    (match, prefix, relPath) => {
      const absUrl = new URL(relPath, baseUrl).href;
      return `${prefix}'${absUrl}'`;
    },
  );
}

// 把 LLM 写的 `render.silhouette(...)` 替换成 window.__renderDispatch(...)，
// 让 render mode 可以在不重新生成代码的前提下切换。
function rewriteRenderCalls(code) {
  return code.replace(/\brender\.silhouette\s*\(/g, 'window.__renderDispatch(');
}

// 从 LLM 输出里提取 JS code。处理三种情况：
//   1. ```js\n CODE \n``` + 后面 prose  → 取 fence 间内容
//   2. ```\n CODE \n``` （没 lang 标）  → 取 fence 间内容
//   3. 没 fence，直接是 code           → 全部取
function extractCode(text) {
  // 优先匹配带 fence 的块（fence 后可以有任意 prose）
  const fenced = text.match(/```(?:js|javascript|jsx)?\s*\r?\n([\s\S]*?)\r?\n```/);
  if (fenced) return fenced[1].trim();
  // 没 fence 直接当 code
  return text.trim();
}

async function renderCode(rawCode) {
  let code = extractCode(rawCode);
  const baseUrl = new URL('./', window.location.href).href;
  code = rewriteImports(code, baseUrl);
  code = rewriteRenderCalls(code);

  // 调试：把最终送进 import 的 code 暴露到 console
  console.log('[mvp] Final code length:', code.length);
  console.log('[mvp] First 300 chars:\n', code.slice(0, 300));

  const blob = new Blob([code], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    await import(url);
  } catch (e) {
    console.error('[mvp] Render failed. Full code follows:\n', code);
    throw e;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// 4. 主流程
// ============================================================================
async function run() {
  const userPrompt = $('prompt').value.trim();
  if (!userPrompt) return;

  $('generate').disabled = true;
  $('status').textContent = '调用 Claude API…';
  $('status').style.color = '#444';

  try {
    const t0 = performance.now();
    const { text, usage } = await generateCode(userPrompt, $('model').value);
    const apiMs = (performance.now() - t0).toFixed(0);

    // Show generated code
    $('code-output').value = text;
    $('code-stats').textContent =
      `API ${apiMs}ms · in ${usage.input_tokens} / out ${usage.output_tokens} tokens`;

    $('status').textContent = '✓ 代码生成完成，渲染中…';

    // Render
    await renderCode(text);
    $('status').textContent = `✓ 完成 (${apiMs}ms)`;

    // Save to history
    addToHistory(userPrompt, text, $('model').value);
  } catch (e) {
    $('status').textContent = `✗ ${e.message}`;
    $('status').style.color = '#b00';
    console.error(e);
  } finally {
    $('generate').disabled = false;
  }
}

$('generate').addEventListener('click', run);

// Re-render manually (after user edits generated code)
$('rerender').addEventListener('click', async () => {
  const code = $('code-output').value;
  if (!code.trim()) { $('status').textContent = '✗ 没代码可渲染'; return; }
  $('status').textContent = '重新渲染…';
  try {
    await renderCode(code);
    $('status').textContent = '✓ 重渲染完成';
  } catch (e) {
    $('status').textContent = `✗ ${e.message}`;
    $('status').style.color = '#b00';
  }
});

// Keyboard shortcuts
$('prompt').addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
});
$('code-output').addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') $('rerender').click();
});

// Render mode change → toggle stipple params panel + svg export 显隐 + pattern card 显隐
// (Stipple/Lambert/Fly 3D 跟 pattern 视觉冲突，自动隐藏 pattern card 并清空选择) + 缓存重渲
// Fly 3D 切换时还要 swap canvas + mount/unmount WebGL controller
$('render-mode')?.addEventListener('change', () => {
  updateStippleParamsVisibility();
  updateSvgExportVisibility();
  updatePatternCardVisibility();
  updateFly3DVisibility();
  if (!window.__lastRenderArgs) return;
  reRenderFromCache(`切换到 ${$('render-mode').value}`);
});

// 排列 (X / Y 手动数字输入) + Tile padding slider —— 改了立即（debounced）重渲
function initArrangement() {
  const stored = (key, fb) => {
    const v = localStorage.getItem(key);
    return v !== null ? v : fb;
  };
  const nxInput = $('p-nx');
  const nyInput = $('p-ny');
  const padSlider = $('p-rep-padding');
  if (nxInput)   nxInput.value   = stored('sdf-mvp-nx', '1');
  if (nyInput)   nyInput.value   = stored('sdf-mvp-ny', '1');
  if (padSlider) padSlider.value = stored('sdf-mvp-rep-padding', '0');
  const padVal = $('p-rep-padding-val');
  if (padVal) padVal.textContent = padSlider?.value || '0';

  let debounceTimer = null;
  const handle = (el, valSpan, key, label) => {
    el?.addEventListener('input', () => {
      if (valSpan) valSpan.textContent = el.value;
      localStorage.setItem(key, el.value);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (window.__lastRenderArgs) reRenderFromCache(`${label} ${el.value}`);
      }, 250);
    });
  };
  handle(nxInput,   null,   'sdf-mvp-nx',          'X');
  handle(nyInput,   null,   'sdf-mvp-ny',          'Y');
  handle(padSlider, padVal, 'sdf-mvp-rep-padding', 'Tile padding');
}

// Example prompts
document.querySelectorAll('[data-example]').forEach(btn => {
  btn.addEventListener('click', () => {
    $('prompt').value = btn.dataset.example;
  });
});

// ============================================================================
// History (localStorage)
// ============================================================================
const HISTORY_KEY = 'sdf-mvp-history';
const HISTORY_MAX = 50;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
}

function addToHistory(prompt, code, model) {
  const history = loadHistory();
  history.unshift({
    id: Date.now(),
    prompt,
    code,
    model,
    timestamp: Date.now(),
  });
  saveHistory(history);
  renderHistoryList();
}

function deleteFromHistory(id) {
  saveHistory(loadHistory().filter(e => e.id !== id));
  renderHistoryList();
}

function clearHistory() {
  if (!confirm('清空所有历史记录？')) return;
  saveHistory([]);
  renderHistoryList();
}

function formatTime(ts) {
  const diff = Date.now() - ts;
  const min = 60 * 1000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)}分前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;
  return new Date(ts).toLocaleDateString();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderHistoryList() {
  const el = $('history-list');
  if (!el) return;
  const history = loadHistory();
  if (history.length === 0) {
    el.innerHTML = '<div class="history-empty">还没有历史 — 生成后自动保存</div>';
    return;
  }
  el.innerHTML = history.map(entry => {
    const short = entry.prompt.length > 60 ? entry.prompt.slice(0, 60) + '…' : entry.prompt;
    return `<div class="history-item">
      <span class="history-prompt" data-load="${entry.id}" title="${escapeHtml(entry.prompt)}">${escapeHtml(short)}</span>
      <span class="history-time">${formatTime(entry.timestamp)}</span>
      <button class="history-del" data-del="${entry.id}" title="删除">×</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-load]').forEach(elem => {
    elem.addEventListener('click', () => loadHistoryEntry(parseInt(elem.dataset.load)));
  });
  el.querySelectorAll('[data-del]').forEach(elem => {
    elem.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFromHistory(parseInt(elem.dataset.del));
    });
  });
}

async function loadHistoryEntry(id) {
  const entry = loadHistory().find(e => e.id === id);
  if (!entry) return;
  $('prompt').value = entry.prompt;
  $('code-output').value = entry.code;
  $('code-stats').textContent = `loaded from history · ${new Date(entry.timestamp).toLocaleString()}`;
  $('status').textContent = `加载历史: "${entry.prompt.slice(0, 30)}…", 渲染中…`;
  $('status').style.color = '#444';
  try {
    await renderCode(entry.code);
    $('status').textContent = `✓ 已加载历史并渲染`;
  } catch (e) {
    $('status').textContent = `✗ ${e.message}`;
    $('status').style.color = '#b00';
    console.error(e);
  }
}

$('history-clear')?.addEventListener('click', clearHistory);

// ============================================================================
// Stipple params (localStorage + sliders + presets)
// ============================================================================
const STIPPLE_PARAMS_KEY = 'sdf-mvp-stipple-params';

const STIPPLE_DEFAULTS = {
  brushLayers: 5, gap: 0.75, smallOffset: 4, smallSegs: 5,
  smallScaleSize: 3, noiseScale: 0.04, rH: 0.6, rV: 0, seed: 42,
  colorSpread: 0, complementWeight: 0.5,
};

// Preset 起步点（每个 preset 也指定 colorSource）
// preset 应用时同时把 color-source select 切到对应值
const STIPPLE_PRESETS = {
  // 水彩点彩：LLM 颜色 + HSL 展开。用户 2026-05-14 验证的参数（5 层 / smallSegs=3 圆点 / rH=1.4 强横向 weave）
  watercolor:  { brushLayers: 5,  gap: 0.9,  smallOffset: 2,   smallSegs: 3, smallScaleSize: 2, noiseScale: 0.035, rH: 1.4, rV: 0, seed: 42, colorSpread: 0.6, complementWeight: 0.4,
                 colorSource: 'llm' },
  // BOB 经典：BOB 双套 pigments + BOB 原版 4px cell + 可见 weave（无 HSL 展开）
  // BOB painted.js 默认 smallScaleSize=2 → 4px cell，是 BOB 视觉的关键
  bob:         { brushLayers: 5,  gap: 0.75, smallOffset: 2,   smallSegs: 5, smallScaleSize: 2, noiseScale: 0.04, rH: 0.6, rV: 0,  seed: 42, colorSpread: 0,   complementWeight: 0.5,
                 colorSource: 'bob:both' },
  // Fidenza-BOB：Fidenza rad palette + 用户 2026-05-14 验证的 BOB-style 调参
  // （3 层笔触 + 大笔触 1.0 + 中等抖动 + smallSegs=3 圆点 + rH/rV 偏移制造 weave）
  fidenzaBob:  { brushLayers: 3,  gap: 1.0,  smallOffset: 2,   smallSegs: 3, smallScaleSize: 2, noiseScale: 0.035, rH: 1.1, rV: -0.4, seed: 42, colorSpread: 0, complementWeight: 0.5,
                 colorSource: 'fidenza:rad' },
};

function loadStippleParams() {
  try {
    const stored = JSON.parse(localStorage.getItem(STIPPLE_PARAMS_KEY));
    return { ...STIPPLE_DEFAULTS, ...stored };
  } catch (e) {
    return { ...STIPPLE_DEFAULTS };
  }
}

function saveStippleParams(params) {
  localStorage.setItem(STIPPLE_PARAMS_KEY, JSON.stringify(params));
}

function readStippleParams() {
  // 注意：这个函数被 __renderDispatch 调用，所以 DOM 元素必须已经存在
  const get = (id, parse = parseFloat) => {
    const el = $(id);
    return el ? parse(el.value) : STIPPLE_DEFAULTS[id.replace(/^p-/, '')];
  };
  return {
    brushLayers:      get('p-brushLayers',      parseInt),
    gap:              get('p-gap'),
    smallOffset:      get('p-smallOffset'),
    smallSegs:        get('p-smallSegs',        parseInt),
    smallScaleSize:   get('p-smallScaleSize',   parseInt),
    noiseScale:       get('p-noiseScale'),
    rH:               get('p-rH'),
    rV:               get('p-rV'),
    seed:             get('p-seed',             parseInt),
    colorSpread:      get('p-colorSpread'),
    complementWeight: get('p-complementWeight'),
  };
}

function applyStippleParamsToUI(params) {
  Object.entries(params).forEach(([k, v]) => {
    const slider = $(`p-${k}`);
    if (slider) {
      slider.value = v;
      const valSpan = $(`p-${k}-val`);
      if (valSpan) valSpan.textContent = v;
    }
  });
}

function reRenderFromCache(label = '重渲') {
  if (!window.__lastRenderArgs) return;
  const { ctx, layers, options } = window.__lastRenderArgs;
  const t0 = performance.now();
  $('status').textContent = `${label}…`;
  $('status').style.color = '#444';
  // 用 setTimeout 让 status 先刷到屏幕（stipple 同步且慢）
  setTimeout(() => {
    try {
      window.__renderDispatch(ctx, layers, options);
      $('status').textContent = `✓ ${label} 完成 (${(performance.now() - t0).toFixed(0)}ms)`;
    } catch (e) {
      $('status').textContent = `✗ ${e.message}`;
      $('status').style.color = '#b00';
      console.error(e);
    }
  }, 10);
}

let stippleDebounceTimer = null;
function debouncedRerender() {
  clearTimeout(stippleDebounceTimer);
  stippleDebounceTimer = setTimeout(() => reRenderFromCache('参数重渲'), 250);
}

function populateColorSourceDropdown() {
  const sel = $('color-source');
  if (!sel) return;
  // BOB group + Fidenza group via optgroup
  const bobOpts = [], fidenzaOpts = [], llmOpt = [];
  for (const [key, src] of Object.entries(COLOR_SOURCES)) {
    const o = document.createElement('option');
    o.value = key; o.textContent = src.name;
    if (key === 'llm') llmOpt.push(o);
    else if (key.startsWith('bob:')) bobOpts.push(o);
    else if (key.startsWith('fidenza:')) fidenzaOpts.push(o);
  }
  sel.innerHTML = '';
  llmOpt.forEach(o => sel.appendChild(o));
  if (bobOpts.length) {
    const og = document.createElement('optgroup');
    og.label = 'BOB pigments';
    bobOpts.forEach(o => og.appendChild(o));
    sel.appendChild(og);
  }
  if (fidenzaOpts.length) {
    const og = document.createElement('optgroup');
    og.label = 'Fidenza schemes (Tyler Hobbs)';
    fidenzaOpts.forEach(o => og.appendChild(o));
    sel.appendChild(og);
  }
  // Restore from localStorage
  const stored = localStorage.getItem('sdf-mvp-color-source');
  if (stored && COLOR_SOURCES[stored]) sel.value = stored;
}

// 把 color source 的 palette 转成 swatches preview（QQL card 用）
function updateColorSwatchesAndLabel() {
  const sel = $('color-source');
  const swatchesEl = $('color-source-swatches');
  const labelEl = $('color-source-label');
  if (!sel) return;
  const key = sel.value;
  const source = COLOR_SOURCES[key];
  if (labelEl) labelEl.textContent = source?.name || key;
  if (!swatchesEl) return;
  if (!source || !source.palette) {
    // LLM: 显示渐变 placeholder（LLM 颜色不是固定 palette）
    swatchesEl.innerHTML = '<div class="qql-swatch" style="background: linear-gradient(90deg, #4a6fa5, #a55a89, #6e9a4e, #c4a850, #8a4e7e); flex: 1;"></div>';
    return;
  }
  // 合并 palette + palette2（如有），取前 12 色
  const combined = source.palette2
    ? [...source.palette.slice(0, 6), ...source.palette2.slice(0, 6)]
    : source.palette.slice(0, 12);
  swatchesEl.innerHTML = combined
    .map(c => `<div class="qql-swatch" style="background: rgb(${c[0]|0},${c[1]|0},${c[2]|0});"></div>`)
    .join('');
}

function initStippleParams() {
  populateColorSourceDropdown();
  applyStippleParamsToUI(loadStippleParams());
  updateColorSwatchesAndLabel();

  // Slider change handlers
  document.querySelectorAll('#stipple-params input[type="range"]').forEach(slider => {
    slider.addEventListener('input', () => {
      const valSpan = $(`${slider.id}-val`);
      if (valSpan) valSpan.textContent = slider.value;
      saveStippleParams(readStippleParams());
      if ($('render-mode')?.value === 'stipple') debouncedRerender();
    });
  });

  // Color source dropdown
  $('color-source')?.addEventListener('change', (e) => {
    localStorage.setItem('sdf-mvp-color-source', e.target.value);
    updateColorSwatchesAndLabel();
    if ($('render-mode')?.value === 'stipple') reRenderFromCache(`色源切到 ${e.target.value}`);
  });

  // Preset pill buttons (QQL-style)
  document.querySelectorAll('#preset-pills [data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = STIPPLE_PRESETS[btn.dataset.preset];
      if (!preset) return;
      // 更新 active state
      document.querySelectorAll('#preset-pills .qql-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // 更新 preset label
      const labelEl = $('preset-label');
      if (labelEl) labelEl.textContent = btn.textContent;
      localStorage.setItem('sdf-mvp-preset', btn.dataset.preset);
      // 应用 preset：分离 colorSource，剩下的当 slider 参数
      const { colorSource, ...sliderParams } = preset;
      applyStippleParamsToUI(sliderParams);
      saveStippleParams(sliderParams);
      if (colorSource && $('color-source')) {
        $('color-source').value = colorSource;
        localStorage.setItem('sdf-mvp-color-source', colorSource);
        updateColorSwatchesAndLabel();
      }
      if ($('render-mode')?.value === 'stipple') reRenderFromCache(`${btn.textContent} preset`);
    });
  });
  // 恢复上次 active preset
  const storedPreset = localStorage.getItem('sdf-mvp-preset');
  if (storedPreset) {
    const btn = document.querySelector(`#preset-pills [data-preset="${storedPreset}"]`);
    if (btn) {
      btn.classList.add('active');
      const labelEl = $('preset-label');
      if (labelEl) labelEl.textContent = btn.textContent;
    }
  }
}

// Render mode pill buttons —— 同步隐藏 <select id="render-mode"> 的 value
// 然后 dispatch 'change' 让现有 change handler 自动触发 visibility + re-render
function initRenderModePills() {
  const select = $('render-mode');
  const labelEl = $('render-mode-label');
  if (!select) return;
  // 恢复 stored value 到 select
  const stored = localStorage.getItem('sdf-mvp-render-mode');
  const validModes = ['silhouette', 'stipple', 'hatch', 'raymarched', 'fly3d', 'bob-shader'];
  if (stored && validModes.includes(stored)) {
    select.value = stored;
  }
  // 同步 pill 状态到 select 当前值
  const sync = () => {
    document.querySelectorAll('#render-mode-pills .qql-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.renderMode === select.value);
    });
    if (labelEl) {
      labelEl.textContent =
        select.value === 'stipple'    ? 'Stipple (BOB)' :
        select.value === 'hatch'      ? 'Lines (Pasma)' :
        select.value === 'raymarched' ? 'Lambert (Raymarched)' :
        select.value === 'fly3d'      ? 'Fly 3D (Shader Lambert)' :
        select.value === 'bob-shader' ? 'BOB GPU (Autoscope)' :
                                        'Silhouette';
    }
  };
  sync();
  // Pill click → 更新 select + dispatch change
  document.querySelectorAll('#render-mode-pills [data-render-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      select.value = btn.dataset.renderMode;
      localStorage.setItem('sdf-mvp-render-mode', btn.dataset.renderMode);
      sync();
      select.dispatchEvent(new Event('change'));
    });
  });
}

function updateStippleParamsVisibility() {
  const panel = $('stipple-params');
  if (!panel) return;
  panel.style.display = $('render-mode')?.value === 'stipple' ? '' : 'none';
}

// Pattern card 只在 Silhouette / Lines mode 显示——Stipple/Lambert/Fly 3D 都
// 全填画布，跟 pattern 组合都会视觉冲突。切到不兼容模式时 force pattern → none
// 防止 dispatcher 仍读到 stored value 偷偷画底纹。
function updatePatternCardVisibility() {
  const card = $('pattern-card');
  if (!card) return;
  const mode = $('render-mode')?.value;
  const patternCompatible = mode === 'silhouette' || mode === 'hatch';
  card.style.display = patternCompatible ? '' : 'none';
  if (!patternCompatible) {
    const select = $('pattern-mode');
    if (select && select.value !== 'none') {
      select.value = 'none';
      // 触发 pill sync（pattern pill 上的 active state + label）
      select.dispatchEvent(new Event('change'));
    }
  }
}

// Fly 3D / BOB GPU 都用 #c-webgl canvas，跟 Canvas2D 互斥。切到这两个 mode 任一
// 时 → 显示 webgl canvas；切到其它 mode → 隐藏 webgl canvas + unmount 两个 controller。
function updateWebGLCanvasVisibility() {
  const mode = $('render-mode')?.value;
  const isFly3D    = mode === 'fly3d';
  const isBobGPU   = mode === 'bob-shader';
  const isWebGL    = isFly3D || isBobGPU;
  const c2d = $('c');
  const cwgl = $('c-webgl');
  const flyCard = $('fly3d-card');
  const bobCard = $('bob-shader-card');
  if (c2d)  c2d.style.display  = isWebGL ? 'none' : '';
  if (cwgl) cwgl.style.display = isWebGL ? '' : 'none';
  if (flyCard) flyCard.style.display = isFly3D  ? '' : 'none';
  if (bobCard) bobCard.style.display = isBobGPU ? '' : 'none';
  // 互斥：进 BOB GPU 时 unmount fly3d，反之亦然
  if (!isFly3D  && _fly3dRenderer)      _fly3dRenderer.unmount();
  if (!isBobGPU && _bobShaderRenderer)  _bobShaderRenderer.unmount();
}
// 保留旧名兼容
const updateFly3DVisibility = updateWebGLCanvasVisibility;

// SVG export 只对 Lines (hatch) mode 有意义——它的输出本来就是 polyline vector。
// 其它 renderer 输出是 raster pixels（silhouette/stipple = filled regions，需要
// marching-squares 才能 vectorize，那是 backlog 1 的另一半工作）。
function updateSvgExportVisibility() {
  const row = $('svg-export-row');
  if (!row) return;
  row.style.display = $('render-mode')?.value === 'hatch' ? '' : 'none';
}

// 把当前 cached layers + 当前 view → SVG 字符串 → 触发浏览器下载
async function exportCurrentHatchAsSvg() {
  if (!window.__lastRenderArgs) {
    $('status').textContent = '⚠ 还没有渲染过——先 Generate 一次再导出';
    return;
  }
  const { layers, options } = window.__lastRenderArgs;
  const { nx, ny } = getActiveArrangement();
  const view = options.view ?? 1.2;
  const padding = parseInt($('p-rep-padding')?.value || '0');
  const arrLayers = applyArrangement(layers, nx, ny, view, padding);

  // hatch.js 期望 color 是 CSS 字符串；layers 里可能是 [r,g,b] 数组
  const toCss = (c) => Array.isArray(c)
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : (c || '#1a1a1a');
  const bg = options.background;
  const bgStr = Array.isArray(bg)
    ? toCss(bg)
    : (bg && bg.top ? toCss(bg.top) : (bg || '#fdf9f6'));
  const svgLayers = arrLayers.map(({ sdf, color, ...rest }) => ({
    sdf, color: toCss(color), ...rest,
  }));

  const canvas = document.getElementById('c');
  const svg = render.hatchSvg(svgLayers, {
    view,
    width: canvas.width,
    height: canvas.height,
    background: bgStr,
    flipY: options.flipY ?? true,
  });

  // 触发下载
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const promptText = $('prompt')?.value?.trim().slice(0, 40).replace(/[^a-zA-Z0-9_-]+/g, '-') || 'hatch';
  a.download = `sdf-hatch-${promptText}-${Date.now()}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  $('status').textContent = `✓ SVG 导出 (${(svg.length / 1024).toFixed(1)} KB)`;
}

$('export-svg')?.addEventListener('click', exportCurrentHatchAsSvg);

// ----------------------------------------------------------------------------
// Background pattern pill row + 参数 slider —— 跟 renderer 正交的底纹层选择
// ----------------------------------------------------------------------------
function initPatternPills() {
  const select = $('pattern-mode');
  const labelEl = $('pattern-mode-label');
  if (!select) return;

  const stored = localStorage.getItem('sdf-mvp-pattern-mode');
  const validModes = ['none', 'truchet', 'gosper', 'motifs'];
  if (stored && validModes.includes(stored)) select.value = stored;

  const sync = () => {
    document.querySelectorAll('#pattern-mode-pills .qql-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.patternMode === select.value);
    });
    const labels = { none: 'None', truchet: 'Truchet', gosper: 'Gosper', motifs: 'Motifs' };
    if (labelEl) labelEl.textContent = labels[select.value] || 'None';
    // pattern params 面板只在选了 pattern 时显示
    const paramsEl = $('pattern-params');
    if (paramsEl) paramsEl.style.display = select.value === 'none' ? 'none' : '';
    // 动态 slider 可见性：每个 pattern 用自己专属的参数 slider
    const showTruchetOnly = select.value === 'truchet';
    const showCurveOnly = select.value === 'gosper';
    const showMotifsOnly = select.value === 'motifs';
    document.querySelectorAll('.pattern-truchet-only').forEach(el => {
      el.style.display = showTruchetOnly ? '' : 'none';
    });
    document.querySelectorAll('.pattern-curve-only').forEach(el => {
      el.style.display = showCurveOnly ? '' : 'none';
    });
    document.querySelectorAll('.pattern-motifs-only').forEach(el => {
      el.style.display = showMotifsOnly ? '' : 'none';
    });
  };
  sync();

  document.querySelectorAll('#pattern-mode-pills [data-pattern-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      select.value = btn.dataset.patternMode;
      localStorage.setItem('sdf-mvp-pattern-mode', btn.dataset.patternMode);
      sync();
      select.dispatchEvent(new Event('change'));
    });
  });
}

$('pattern-mode')?.addEventListener('change', () => {
  if (window.__lastRenderArgs) reRenderFromCache(`pattern → ${$('pattern-mode').value}`);
});

// Pattern 参数 slider 实时重渲（debounced）
['p-pattern-density', 'p-pattern-depth', 'p-pattern-variation', 'p-pattern-band-size', 'p-pattern-bands'].forEach(id => {
  const slider = $(id);
  if (!slider) return;
  const valEl = $(`${id}-val`);
  slider.addEventListener('input', () => {
    if (valEl) valEl.textContent = slider.value;
    if ($('pattern-mode')?.value !== 'none') debouncedRerender();
  });
});
$('p-pattern-color')?.addEventListener('input', () => {
  if ($('pattern-mode')?.value !== 'none') debouncedRerender();
});

// Fly 3D 控件：slider .val 实时显示 + auto picked up by rAF loop。值变了不需要
// 重新 compile shader，draw frame 每次 read getControls() 取最新值。
function initFly3DControls() {
  const wire = (id) => {
    const s = $(id);
    const v = $(id + '-val');
    if (!s) return;
    const update = () => { if (v) v.textContent = (+s.value).toFixed(2); };
    s.addEventListener('input', update);
    update();
  };
  ['fly-light-azim', 'fly-light-alt', 'fly-light-dist', 'fly-focal'].forEach(wire);
}

// BOB GPU 控件：跟 Fly 3D 同样逻辑。Shuffle 按钮换 palette texture。
function initBobShaderControls() {
  const wireSlider = (id, digits = 2) => {
    const s = $(id);
    const v = $(id + '-val');
    if (!s) return;
    const update = () => {
      if (v) {
        const n = +s.value;
        v.textContent = digits === 5 ? n.toFixed(5) : n.toFixed(digits);
      }
    };
    s.addEventListener('input', update);
    update();
  };
  wireSlider('bob-coldiv', 2);
  wireSlider('bob-noise', 5);   // 0.00008 这种小数得 5 位
  wireSlider('bob-post-noise', 2);
  wireSlider('bob-light-azim', 2);
  wireSlider('bob-light-alt', 2);
  wireSlider('bob-focal', 2);
  wireSlider('bob-exposure', 2);
  wireSlider('bob-saturation', 2);
  wireSlider('bob-shadow-strength', 2);

  $('bob-shuffle')?.addEventListener('click', () => {
    if (_bobShaderRenderer) {
      _bobShaderRenderer.shufflePalette();
    }
  });
}

loadSystemPrompt();
renderHistoryList();
initRenderModePills();
initStippleParams();
updateStippleParamsVisibility();
updateSvgExportVisibility();
initPatternPills();
updatePatternCardVisibility();
initFly3DControls();
initBobShaderControls();
updateFly3DVisibility();
initArrangement();
