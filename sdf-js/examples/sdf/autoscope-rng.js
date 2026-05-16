// =============================================================================
// autoscope-rng —— SFC32 PRNG + URL hash helpers
// -----------------------------------------------------------------------------
// 用户提供的代码（2026-05-16），改成无 global state 的 module。
// 让 autoscope-clone "New scene" 按钮可以反复 new Random(newHash) 重生成。
//
// 用法：
//   import { Random, generateHash, readHashFromURL, writeHashToURL } from './autoscope-rng.js';
//   const hash = readHashFromURL() || generateHash();
//   const rng = new Random(hash);
//   rng.random_int(15, 30);
//   rng.random_choice([0,0,1,2]);
//
// URL 格式：`?hash=0x...` 或 `?payload=base64(JSON{hash:"0x..."})`
// 同一 hash 永远生成同一序列 → 可分享 / 可收藏（Autoscope 同款）
// =============================================================================

export class Random {
  constructor(hash) {
    this.hash = hash;
    this.useA = false;

    const sfc32 = function (uint128Hex) {
      let a = parseInt(uint128Hex.substring(0, 8), 16);
      let b = parseInt(uint128Hex.substring(8, 16), 16);
      let c = parseInt(uint128Hex.substring(16, 24), 16);
      let d = parseInt(uint128Hex.substring(24, 32), 16);
      return function () {
        a |= 0; b |= 0; c |= 0; d |= 0;
        let t = (((a + b) | 0) + d) | 0;
        d = (d + 1) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
      };
    };

    this.prngA = sfc32(hash.substring(2, 34));
    this.prngB = sfc32(hash.substring(34, 66));

    // 预热（user 原版 1e6，跟 Autoscope sketch.js 一致）
    for (let i = 0; i < 1e6; i += 2) {
      this.prngA();
      this.prngB();
    }
  }

  // [0, 1)
  random_dec() {
    this.useA = !this.useA;
    return this.useA ? this.prngA() : this.prngB();
  }

  // [a, b)
  random_num(a, b) { return a + (b - a) * this.random_dec(); }

  // [a, b] 整数
  random_int(a, b) { return Math.floor(this.random_num(a, b + 1)); }

  // 概率
  random_bool(p) { return this.random_dec() < p; }

  // 数组均匀选（Autoscope `r([0,0,0,1])` 加权 = 重复值 + 均匀选）
  random_choice(list) { return list[this.random_int(0, list.length - 1)]; }

  // Autoscope `ra()` —— 随机角度 0..2π
  random_angle() { return this.random_num(0, Math.PI * 2); }
}

// =============================================================================
// URL hash helpers
// =============================================================================

export function generateHash() {
  return '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function readHashFromURL() {
  const params = new URLSearchParams(window.location.search);
  // 优先 payload (base64 encoded JSON, Autoscope 平台 idiom)
  const payload = params.get('payload');
  if (payload) {
    try {
      const parsed = JSON.parse(atob(payload));
      if (parsed.hash) return parsed.hash;
    } catch {}
  }
  // fallback: ?hash=0x...
  return params.get('hash');
}

export function writeHashToURL(hash) {
  const url = new URL(window.location);
  url.searchParams.set('hash', hash);
  // Don't change scene query param if present
  window.history.replaceState(null, '', url);
}

export function isValidHash(hash) {
  return typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash);
}
