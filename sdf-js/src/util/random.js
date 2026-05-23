// =============================================================================
// SFC32 PRNG — autoscope-style deterministic random
// -----------------------------------------------------------------------------
// Moved 2026-05-23 from examples/sdf/autoscope-rng.js for use by both
// renderer-side (Generator-V style randomization in BOB GPU) and scene-side
// (Generator-S variant expansion in src/scene/generator-s.js). URL helpers
// stayed in autoscope-rng.js since they depend on `window`.
//
// hash format: 0x-prefix 64 hex chars (256 bit). Use generateHash() in
// autoscope-rng.js (browser only). For deterministic Node tests, pass any
// valid 64-hex string — same hash always produces same sequence.
//
// API mirrors p5 Random + autoscope sketch.js r() helper family:
//   const rng = new Random('0xabcdef...');
//   rng.random_dec()           // [0, 1)
//   rng.random_num(a, b)       // [a, b)
//   rng.random_int(a, b)       // [a, b] integer
//   rng.random_bool(p)         // probability
//   rng.random_choice(list)    // uniform pick (weight via repeats)
//   rng.random_angle()         // [0, 2π)
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

  random_dec() {
    this.useA = !this.useA;
    return this.useA ? this.prngA() : this.prngB();
  }
  random_num(a, b) { return a + (b - a) * this.random_dec(); }
  random_int(a, b) { return Math.floor(this.random_num(a, b + 1)); }
  random_bool(p) { return this.random_dec() < p; }
  random_choice(list) { return list[this.random_int(0, list.length - 1)]; }
  random_angle() { return this.random_num(0, Math.PI * 2); }
}
