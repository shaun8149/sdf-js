// =============================================================================
// 2D Perlin Noise（Ken Perlin improved noise，纯 JS，不依赖 p5）
// -----------------------------------------------------------------------------
// 给定一个 seed 构造一个 noise function：(x, y) → [-1, +1]。
//
// 内部使用经典 permutation table（512 元素，重复一遍标准 256 表）+ 梯度向量做点积。
// 每次 createPerlin(seed) 会生成一份独立的 permutation 表，相同 seed 输出确定。
// =============================================================================

// Mulberry32 PRNG —— 32-bit state，确定性、足够好的统计性、~10 行
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 八个梯度向量（2D Perlin 经典）
const GRAD = [
  [ 1,  1], [-1,  1], [ 1, -1], [-1, -1],
  [ 1,  0], [-1,  0], [ 0,  1], [ 0, -1],
];

// Quintic ease（5-th degree smoothstep，Perlin 改进版用的）
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 构造一个 Perlin noise function。
 *
 * @param {number} [seed=0]  整数 seed
 * @returns {(x: number, y: number) => number}  返回 noise(x, y) ∈ [-1, +1]
 */
export function createPerlin(seed = 0) {
  // 用 PRNG 洗一个 256 长度的 permutation
  const rng = mulberry32(seed);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  // 拼成 512 长度，避免取模
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

  // 单点 noise（梯度 hash 查表 + 双线性 + quintic ease）
  return function noise(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = fade(xf);
    const v = fade(yf);

    const aa = p[p[xi]     + yi    ] & 7;
    const ab = p[p[xi]     + yi + 1] & 7;
    const ba = p[p[xi + 1] + yi    ] & 7;
    const bb = p[p[xi + 1] + yi + 1] & 7;

    const dot = (i, dx, dy) => GRAD[i][0] * dx + GRAD[i][1] * dy;

    const x1 = lerp(dot(aa, xf,     yf),     dot(ba, xf - 1, yf),     u);
    const x2 = lerp(dot(ab, xf,     yf - 1), dot(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  };
}

/**
 * 创建一个 noise-based flow field：(x, y) → angle ∈ [-range/2, +range/2]
 *
 * @param {object} opts
 * @param {number} [opts.scale=0.005]  noise 频率
 * @param {number} [opts.seed=0]
 * @param {number} [opts.range=Math.PI*2]  noise 输出 [-1,1] 乘以的范围。默认 2π
 * @returns {(x: number, y: number) => number}
 */
export function noiseField({ scale = 0.005, seed = 0, range = Math.PI * 2 } = {}) {
  const noise = createPerlin(seed);
  return (x, y) => noise(x * scale, y * scale) * range;
}
