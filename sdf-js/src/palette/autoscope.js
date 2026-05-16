// =============================================================================
// Autoscope palette library —— Erik Swahn / 2023-2024 (MIT)
// -----------------------------------------------------------------------------
// 移植 Autoscope sketch.js 的三组色卡 + 一个 bakePaletteTexture helper（把
// palette1 / palette2 / paper-bg 烤进 WebGL texture，shader 通过 UV 索引取色）。
//
// 用法：
//   import { PALETTES, SKIES, PAPERS, bakePaletteTexture } from '.../autoscope.js';
//   const palette1 = pickShuffled(PALETTES, prng);
//   const palette2 = pickShuffled(PALETTES, prng);
//   const paper    = pick(PAPERS, prng);
//   const sky      = pickShuffled(SKIES, prng);  // sky[0] = 高光，sky[1] = 阴影
//   const { tex, length } = bakePaletteTexture(gl, palette1, palette2, paper);
// =============================================================================

// 21 个物体色卡（鲜艳，BOB / 后印象派 / Lotta 风格混合）
export const PALETTES = [
  ['#007fe2','#ffe900','#ffa05d','#fe282c','#f6f3e6','#82c681'],
  ['#057a74','#feef5e','#f06508','#003b9f','#b84b7c','#c01d13','#32c5c0','#0181b4'],
  ['#4040e0','#a0a0fc','#d21900','#51edff','#a908ff','#60fc00','#eeff5c','#c66e00','#ff523a','#aeff7e'],
  ['#47bcc3','#b02c39','#e64327','#7fa824','#f9c801','#483e6a','#cfc1b8','#723a71'],
  ['#52a716','#a6d7f2','#3ebdef','#f7d84a','#cd1919','#350d0d','#da307c','#0457c3','#f6b76f'],
  ['#800000','#aaffee','#cc44cc','#00cc55','#0000aa','#eeee77','#dd8855','#664400','#ff7777','#aaff66','#0088ff'],
  ['#8fe0a9','#56a1b4','#f1dc8d','#fbd21e','#edbd7d','#56dcaf','#fe6106','#2178ab','#0f97e6','#fda307','#c7140b'],
  ['#ebbfa5','#55b1dd','#b8ccb2','#e2594f','#587654','#285cb2','#fb7244','#404080'],
  ['#edbe03','#2c56b2','#21a656','#f1a598','#ad2721','#e3d68c','#4594d8'],
  ['#ef3e6a','#182d81','#2872a4','#ed8012','#5dc691','#fbde5b','#2a937e','#fadbc2','#e81c23'],
  ['#f2d2b0','#80c4d6','#b1b82d','#ec6756','#e693a6','#c7da49','#fdcc63','#e05267','#0967d2','#33a398','#93153b'],
  ['#f3bb9b','#47b7eb','#ade19e','#ee4f44','#3e9a32','#f9d2d5','#faf6a9','#185ac3','#fd7345'],
  ['#f3fb5b','#4eaa2c','#ed2ca3','#e98be7','#05030c','#f7f7d4','#429db8','#35138b','#9e011d'],
  ['#fa9405','#6e9bfc','#1435d6','#f0310f','#f5d238','#7bb60b','#ee856d','#951e09'],
  ['#fbb40e','#f92601','#294ec7','#5aac2a','#e1cbad','#fd8002','#183090','#46b9af'],
  ['#fbe77e','#189a3f','#e5860b','#094895','#fbb993','#e6dc9e','#e92e11','#3389c2','#fcc245'],
  ['#fed743','#ffad3f','#ffed27','#df4835','#e4581b','#abcc4a','#5a9344','#426f79','#423e57','#d76b5f','#986e78'],
  ['#fefdfb','#fa3d89','#2db508','#34caf4','#fe8801','#024c9c','#ffee00','#111131'],
  ['#ff5e00','#ffa81f','#fde039','#e4fd88','#00b689','#007686','#004d8a','#084078','#a92715','#113339'],
  ['#ffd303','#2e942d','#006b27','#004f5a','#144193','#6e2c86','#de0810','#ec6c00','#f8ad00','#ebbfa5','#55b1dd','#b8ccb2','#e2594f','#587654','#285cb2','#fb7244','#404080'],
  ['#ffd303','#2e942d','#006b27','#004f5a','#144193','#6e2c86','#de0810','#ec6c00','#f8ad00'],
];

// 11 个天空色卡（[0] = 高光区，[1] = 阴影区；其余备选）
export const SKIES = [
  ['#00478d','#05387a','#096d8f','#022b61','#005b8d','#0d6e9a'],
  ['#005670','#044763','#077473','#02364d','#006670','#0a757a'],
  ['#2c3b51','#152320','#263947','#152124','#3f535b'],
  ['#502122','#220f20','#461d26','#220f17','#592e3d'],
  ['#778890','#8c9ca3','#67878b','#d5c8a8','#f1dcaf'],
  ['#9faa99','#7c9084','#c4c3b2','#98bdb5','#94a998'],
  ['#d79c57','#aa5f53','#d6bd8d','#e8e5d6','#d3a456','#b2a690'],
  ['#e2b361','#eff0ea','#cf8f6d','#d7a40a','#b1540f','#df8f33','#62667f','#97a7b6'],
  ['#ecedeb','#b8c4cb','#7c9cb9','#8bacc5','#ded9d3'],
  ['#eed9ad','#416d91','#fefedc','#758083','#b5aa9a','#5d839d','#94b1ae','#366075'],
  ['#fce66a','#de8641','#cd6019','#7d749c','#ffc54c','#ad4210','#be9991'],
];

// 7 个纸面底色（中性奶白系，跟 BOB 原版一致）
export const PAPERS = [
  '#f4efdc', '#e4e3df', '#f8f0e9', '#f4f3ef', '#fcfaed', '#f4ecd9', '#faf7e8',
];

// ---- random pickers --------------------------------------------------------
// 这些不依赖 PRNG，直接 Math.random()；如果要 deterministic 可以 caller 自己
// pre-shuffle 数组后再传给 bakePaletteTexture。

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function pickShuffled(arr) {
  const chosen = pick(arr);
  return shuffleCopy(chosen);
}

function shuffleCopy(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Texture baking --------------------------------------------------------

/**
 * Bake (palette1, palette2, paperBg) into a WebGL texture matching the
 * Autoscope sketch.js layout:
 *   - Width  = max(palette1.length, palette2.length) * 5 px
 *   - Height = 10 px (row0 = palette1, row1 = palette2, each 5 px tall)
 *   - Background filled with paperBg
 *   - 5% of cells skipped (paper shows through) — Autoscope "rngOpacity" idiom
 *
 * Shader sample: row 0 = `vec2(idx, 0.25)`, row 1 = `vec2(idx, 0.75)`.
 *
 * @param {WebGLRenderingContext} gl
 * @param {string[]} palette1 - hex CSS colors (row 0)
 * @param {string[]} palette2 - hex CSS colors (row 1)
 * @param {string}   paperBg  - hex CSS color (background between cells)
 * @returns {{ tex: WebGLTexture, length: number }}
 */
export function bakePaletteTexture(gl, palette1, palette2, paperBg) {
  const length = Math.max(palette1.length, palette2.length);
  const cellW = 8;       // px per swatch（autoscope 用 5，加大点让纹理清晰）
  const W = length * cellW;
  const H = cellW * 2;

  // ---- 用 2D canvas 离屏画 swatches ----
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = paperBg;
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < length; i++) {
    if (Math.random() < 0.95) {
      ctx.fillStyle = palette1[i % palette1.length];
      ctx.fillRect(i * cellW, 0, cellW, cellW);
    }
    if (Math.random() < 0.95) {
      ctx.fillStyle = palette2[i % palette2.length];
      ctx.fillRect(i * cellW, cellW, cellW, cellW);
    }
  }

  // ---- 上传到 GL texture ----
  // **关键**：WebGL1 NPOT texture 必须用 CLAMP_TO_EDGE 否则贴图 incomplete →
  // 所有 sample 返回 vec4(0,0,0,1) → 整个物体渲染为黑。palette 宽度 = N*8 px
  // 大多数 N 不是 2^k；以前用 gl.REPEAT 导致 ~92% palette 失效（黑屏 bug）。
  // CLAMP_TO_EDGE 让 NPOT 也合法；caller 自己 fract() 把 u 限制在 [0,1)。
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return { tex, length };
}

// ---- hex → vec3 ------------------------------------------------------------
// 给 shader uniform 用：'#f4efdc' → [0.957, 0.937, 0.863]
export function hexToVec3(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// =============================================================================
// Autoscope randomization knobs (mirror / twist / gridRot)
// -----------------------------------------------------------------------------
// 这 3 个 knob 是 BOB GPU shader 接受的 uniforms，autoscope sketch.js 用 PRNG
// 给每个 hash 派生一组值 → 让单 hash 的视觉变体空间 ×5。
// 概率跟 Autoscope 原版严格对齐。
//
// caller 把返回值喂进 bobShader getControls() 即可。
// =============================================================================

export const DEFAULT_KNOBS = Object.freeze({
  mirrorX: false,
  mirrorZ: false,
  twist: 0,
  twistType: 0,           // 0=Y / 1=Z / 2=X
  gridRot: [0, 0, 0],
});

/**
 * Autoscope-style 随机化（mirror / twist / gridRot），跟 sketch.js setup() 一致。
 * @param {{random_bool: Function, random_num: Function, random_choice: Function}} rng
 * @returns {typeof DEFAULT_KNOBS}
 */
export function randomizeKnobs(rng) {
  return {
    mirrorX:   rng.random_bool(0.15),
    mirrorZ:   rng.random_bool(0.15),
    twist:     rng.random_bool(0.5) ? rng.random_num(-0.2, 0.2) : 0,
    twistType: rng.random_choice([0, 1, 1, 2]),  // Y/Z/Z/X weighted (autoscope idiom)
    gridRot: [
      rng.random_bool(0.2) ? rng.random_choice([Math.PI / 4, Math.PI / 2]) : 0,
      rng.random_bool(0.2) ? rng.random_choice([Math.PI / 4, Math.PI / 2]) : 0,
      rng.random_bool(0.2) ? rng.random_choice([Math.PI / 4, Math.PI / 2]) : 0,
    ],
  };
}

/**
 * 把 knobs 跟"开关 boolean"合并：开关 off → 所有 knobs 归零，开关 on → 原 knobs。
 * 给 UI 的"启用/禁用 autoscope randomization" toggle 用。
 * @param {typeof DEFAULT_KNOBS} knobs
 * @param {boolean} enabled
 */
export function applyKnobsGate(knobs, enabled) {
  if (enabled) return knobs;
  return { ...DEFAULT_KNOBS, twistType: knobs.twistType };
}

/**
 * 短读出字符串（debug overlay 用）：`mirror XZ  twist 0.18/Z  gridRot [π/4,0,π/2]`
 */
export function describeKnobs(knobs) {
  const k = knobs;
  const twistAxis = ['Y', 'Z', 'X'][k.twistType] || 'Y';
  const gr = k.gridRot.map(v =>
    v === 0 ? '0' : (Math.abs(v - Math.PI / 4) < 1e-4 ? 'π/4' :
                     Math.abs(v - Math.PI / 2) < 1e-4 ? 'π/2' : v.toFixed(2))
  ).join(',');
  return `mirror ${k.mirrorX ? 'X' : '·'}${k.mirrorZ ? 'Z' : '·'}  ` +
         `twist ${(+k.twist).toFixed(2)}/${twistAxis}  ` +
         `gridRot [${gr}]`;
}
