// =============================================================================
// bobShader-style — Generator-V for BOB GPU renderer
// -----------------------------------------------------------------------------
// "Generator-V" 是 Atlas thesis Point #10 (zero-marginal-cost variant) 在
// renderer 层的落地。**架构上跟 Renderer 平行的独立 layer**：
//
//   Scene Generator (Generator-S)  →  VariantSceneData  →  compile() → SDF
//          ↑ sceneHash                                              ↓
//                                                              Renderer
//                                                                   ↓
//   Style Generator (Generator-V, this file)  →  StyleParams  →  uniforms
//          ↑ styleHash
//
// 两个 hash 正交：sceneHash 决定"画什么"（subjects 数量 / 位置 / 镜像 /
// scatter）；styleHash 决定"画成什么样"（palette / chess / shadow mode /
// 噪声 / 后期）。笛卡尔积 → N×M variant 空间。
//
// Generator-V 的输出是**完全可序列化的 JSON object**（pure data, no GL
// handles, no functions）。可以存 .json、贴 URL、上传分享 — 任何一份 style
// + 任何一份 sceneData 都能复现作品。
//
// 跟 Renderer 的关系：
//   - BOB GPU shader 完全不知道 "randomize" 概念
//   - 只接受 uniforms（StyleParams 里所有字段是 uniform 输入）
//   - Generator-V 是 styleHash → uniforms 的纯函数
//
// 跟 FLY 3D / 未来 renderer 的关系：
//   - FLY 3D 没有 Generator-V（材料是 SceneData 显式定义的，确定性）
//   - 未来 watercolor / pen 渲染器各自配自己的 <renderer>-style.js
//   - "Generator-V is renderer-specific" 是设计 invariant
//
// 概率分布严格跟 autoscope sketch.js setup() 对齐。
// =============================================================================

import { PALETTES, SKIES, PAPERS, bakePaletteTexture } from '../palette/autoscope.js';

// =============================================================================
// DEFAULT_STYLE — identity Generator-V output
// -----------------------------------------------------------------------------
// 当 caller 不想要 randomization（autoscope-clone 的 "knobs off" 开关），
// 用这个作为 baseline — BOB GPU 渲染器收到这组值会产出"默认 BOB 风格"
// （没有 chess / 没有 canvas drift / 没有 animation / 中等 saturation）。
// =============================================================================

export const DEFAULT_STYLE = Object.freeze({
  // chess offset
  xMod: 1,
  yMod: 1,

  // chess pattern + coloration
  coloration: 0,
  coldiv: 1.0,

  // rendering modes
  renderType: 0,
  shadow: 0,
  shadowStrength: 0.25,

  // tuning
  exposure: 2.5,
  saturation: 0.8,
  margin: 0.06,

  // noise (post FS)
  nFactor: 1.0,
  nOffset: 0.0,
  noiseCap: 0.5,
  colorLeak: 0.25,

  // global transforms (BOB-renderer-applied)
  mirrorX: false,
  mirrorZ: false,
  twist: 0,
  twistType: 0,
  gridRot: [0, 0, 0],
  rotateCanvas: 0.0,

  // animation
  animation: 0,
  length: 60,

  // palette baking opts (consumed by bakePaletteTexture)
  paletteSkipRate: 0.0,
  paletteBgIsBlack: false,

  // palette colors (selected from pool by Generator-V; null = caller picks)
  palette1: null,
  palette2: null,
  paper: null,
  sky1: null,
  sky2: null,
});

// =============================================================================
// randomizeBobStyle — the Generator-V function
// -----------------------------------------------------------------------------
// 给一个 PRNG（deterministic from styleHash），产出完整 BOB GPU style 参数。
//
// 跟 autoscope sketch.js setup() 严格对齐：
//   palette1 = r(palettes) shuffled         (random of 21 curated palettes)
//   palette2 = r(palettes) shuffled
//   paper    = r(papers)                    (random of 7 paper tones)
//   sky1/sky2 = r(skies)[0] × 2 different   (cross-palette pairing for hue contrast)
//   coldiv   = r([0.25,0.5,0.75,1×4,1.5×2,2×2,3×2,4])
//   coloration = r() < .025 ? 3 : r([0,0,0,0,1,2,2])
//   shadow     = r([0,1,1,2,3,3,3])
//   shadowStrength = r(.15, .35)
//   exposure   = r(2, 3)
//   saturation = .8 (fixed)
//   margin     = r(.08, .2)
//   nFactor    = r([.5,.5,.75,.75,1×5,1.5])
//   nOffset    = r([0,.5,1]) × r([-1,1])
//   noiseCap   = r(.1,.8) × r([1,.5])
//   colorLeak  = r(.05, .6)
//   chess      = r() < .2 ? {0,0} : {r([1,2,2,2,3]), r([1,2,2,2,3])}
//   renderType = r([0,1])
//   mirror{X,Z} = r() < .15
//   twist      = r() < .5 ? r(-.2,.2) : 0
//   twistType  = r([0,1,1,2])
//   gridRot[i] = r() < .2 ? r([π/4,π/2]) : 0
//   rotateCanvas = r(-.015, .015)
//   animation  = r([0..9])   (0 = no animation, 1-9 = autoscope modes)
//   paletteSkipRate = .05 (5% cells empty, autoscope idiom)
//   paletteBgIsBlack = r() < .25
//
// @param {{ random_bool, random_num, random_choice, random }} rng
//   PRNG with autoscope-style methods. See src/palette/autoscope.js for SFC32 wrap.
// @returns {object} BobStyle — pure data, serializable
// =============================================================================

export function randomizeBobStyle(rng) {
  const chessOff = rng.random_bool(0.2);

  return {
    // chess
    xMod: chessOff ? 0 : rng.random_choice([1, 2, 2, 2, 3]),
    yMod: chessOff ? 0 : rng.random_choice([1, 2, 2, 2, 3]),

    // coloration + coldiv
    coloration: rng.random_dec() < 0.025 ? 3 : rng.random_choice([0, 0, 0, 0, 1, 2, 2]),
    coldiv: rng.random_choice([0.25, 0.5, 0.75, 1, 1, 1, 1, 1.5, 1.5, 2, 2, 3, 3, 4]),

    // rendering modes
    renderType: rng.random_choice([0, 1]),
    shadow: rng.random_choice([0, 1, 1, 2, 3, 3, 3]),
    shadowStrength: rng.random_num(0.15, 0.35),

    // tuning
    exposure: rng.random_num(2.0, 3.0),
    saturation: 0.8,
    margin: rng.random_num(0.08, 0.2),

    // noise (post FS)
    nFactor: rng.random_choice([0.5, 0.5, 0.75, 0.75, 1, 1, 1, 1, 1, 1.5]),
    nOffset: rng.random_choice([0, 0.5, 1]) * rng.random_choice([-1, 1]),
    noiseCap: rng.random_num(0.1, 0.8) * rng.random_choice([1, 0.5]),
    colorLeak: rng.random_num(0.05, 0.6),

    // global transforms (BOB-renderer-applied)
    mirrorX: rng.random_bool(0.15),
    mirrorZ: rng.random_bool(0.15),
    twist: rng.random_bool(0.5) ? rng.random_num(-0.2, 0.2) : 0,
    twistType: rng.random_choice([0, 1, 1, 2]),
    gridRot: [
      rng.random_bool(0.2) ? rng.random_choice([Math.PI / 4, Math.PI / 2]) : 0,
      rng.random_bool(0.2) ? rng.random_choice([Math.PI / 4, Math.PI / 2]) : 0,
      rng.random_bool(0.2) ? rng.random_choice([Math.PI / 4, Math.PI / 2]) : 0,
    ],
    rotateCanvas: rng.random_num(-0.015, 0.015),

    // animation (autoscope buffer.frag modes 1-9; 0 = static)
    animation: rng.random_choice([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    length: 60,

    // palette baking opts (consumed by bakePaletteTexture below)
    paletteSkipRate: 0.05,
    paletteBgIsBlack: rng.random_bool(0.25),

    // palette colors — shuffled selections from curated pools
    palette1: rngShuffle(rng, rng.random_choice(PALETTES).slice()),
    palette2: rngShuffle(rng, rng.random_choice(PALETTES).slice()),
    paper: rng.random_choice(PAPERS),
    sky1: rng.random_choice(rng.random_choice(SKIES).slice()),
    sky2: rng.random_choice(rng.random_choice(SKIES).slice()),
  };
}

// =============================================================================
// applyStyleGate — toggle "randomization on/off"
// -----------------------------------------------------------------------------
// 给 UI 一个 "knobs off" 开关用：enabled=false → 返回 DEFAULT_STYLE
// 但保留 palette 颜色（不希望关掉 randomization 就回到一套调色板）。
// =============================================================================

export function applyStyleGate(style, enabled) {
  if (enabled) return style;
  return {
    ...DEFAULT_STYLE,
    // preserve palette colors selected by Generator-V (color is data, not knob)
    palette1: style.palette1,
    palette2: style.palette2,
    paper: style.paper,
    sky1: style.sky1,
    sky2: style.sky2,
  };
}

// =============================================================================
// describeStyle — debug overlay string
// =============================================================================

export function describeStyle(s) {
  const twistAxis = ['Y', 'Z', 'X'][s.twistType] || 'Y';
  const grNote = (v) =>
    v === 0
      ? '0'
      : Math.abs(v - Math.PI / 4) < 1e-4
        ? 'π/4'
        : Math.abs(v - Math.PI / 2) < 1e-4
          ? 'π/2'
          : v.toFixed(2);
  const gr = s.gridRot.map(grNote).join(',');
  const chess = s.xMod === 0 && s.yMod === 0 ? 'flat' : `${s.xMod}/${s.yMod}`;
  return [
    `mirror ${s.mirrorX ? 'X' : '·'}${s.mirrorZ ? 'Z' : '·'}`,
    `twist ${(+s.twist).toFixed(2)}/${twistAxis}`,
    `gridRot [${gr}]`,
    `chess ${chess}`,
    `col ${s.coloration}`,
    `coldiv ${s.coldiv}`,
    `shadow ${s.shadow}`,
    `render ${s.renderType}`,
    `expo ${s.exposure.toFixed(2)}`,
    `mar ${s.margin.toFixed(2)}`,
    `nF ${s.nFactor}`,
    `leak ${s.colorLeak.toFixed(2)}`,
    `rot ${s.rotateCanvas.toFixed(3)}/s`,
    `anim ${s.animation}`,
    `paletteBg ${s.paletteBgIsBlack ? 'black' : 'paper'}`,
  ].join('  ');
}

// =============================================================================
// bakeStylePalette — wrap bakePaletteTexture with style opts
// -----------------------------------------------------------------------------
// Generator-V owns palette baking strategy (skip rate / bg variety). This
// convenience function takes a BobStyle + gl and bakes the palette texture
// the renderer can consume directly.
// =============================================================================

export function bakeStylePalette(gl, style) {
  return bakePaletteTexture(gl, style.palette1, style.palette2, style.paper, {
    skipRate: style.paletteSkipRate,
    bgIsBlack: style.paletteBgIsBlack,
  });
}

// =============================================================================
// Helpers — local (not exported)
// =============================================================================

// PRNG-driven Fisher-Yates shuffle (returns shuffled copy of input array).
// rng must provide random_dec() returning [0, 1) — matches autoscope Random API.
function rngShuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random_dec() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =============================================================================
// Re-exports for caller convenience (so caller only imports from one place)
// =============================================================================

export { hexToVec3 } from '../palette/autoscope.js';
