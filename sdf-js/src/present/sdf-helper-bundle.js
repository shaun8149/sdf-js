// =============================================================================
// sdf-helper-bundle.js — Atlas Present Sprint 3 SDF helpers for iframe sandbox
// -----------------------------------------------------------------------------
// Exposes 28 SDF math/utility functions as window globals inside the
// p5-sandbox-iframe. LLM-generated P5 sketch code can call any of these
// directly:
//
//   function setup() { createCanvas(600, 360); }
//   function draw() {
//     for (let y = -1; y <= 1; y += 0.02) {
//       for (let x = -1; x <= 1; x += 0.02) {
//         const d = sdf_circle([x, y], [0, 0], 0.5);
//         if (d < 0) fill(...__brandingPalette.silhouetteColor);
//         else fill(...__brandingPalette.bg);
//         rect((x + 1) * 300, (y + 1) * 180, 6, 6);
//       }
//     }
//   }
//
// Functions sourced from BOB code shared by user 2026-06-20. BOB composite
// SDFs (sdfSunset / sdf_building / sdf_bridge1/2 / sdf_BTC / sdf_cactus /
// sdf_tree / sdf_wall / sdf_flower) intentionally EXCLUDED — those are
// BOB-art-specific vocabulary; LLM should compose its own scenes from
// these general primitives.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md §7
// =============================================================================

(function () {
  // ============ Vector math (17 functions) ============

  function sub2(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
  }
  function add2(a, b) {
    return [a[0] + b[0], a[1] + b[1]];
  }
  function mul2(a, b) {
    return [a[0] * b[0], a[1] * b[1]];
  }
  function dot2(a, b) {
    return a[0] * b[0] + a[1] * b[1];
  }
  function lenSq2(a) {
    return a[0] * a[0] + a[1] * a[1];
  }
  function len2(a) {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
  }
  function rot2(angle) {
    return [Math.cos(angle), -Math.sin(angle), Math.sin(angle), Math.cos(angle)];
  }
  function trans2(m, a) {
    return [m[0] * a[0] + m[2] * a[1], m[1] * a[0] + m[3] * a[1]];
  }
  function clamp1(value, min, max) {
    return Math.max(Math.min(value, max), min);
  }
  function clamp2(a, tl, br) {
    return [Math.max(Math.min(br[0], a[0]), tl[0]), Math.max(Math.min(br[1], a[1]), tl[1])];
  }
  function max2(a, b) {
    return [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  }
  function min2(a, b) {
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1])];
  }
  function fract1(x) {
    return x - Math.floor(x);
  }
  function fract2(p) {
    return [p[0] - Math.floor(p[0]), p[1] - Math.floor(p[1])];
  }
  function scale2(a, s) {
    return [a[0] * s, a[1] * s];
  }
  function eq2(a, b) {
    return a[0] === b[0] && a[1] === b[1];
  }
  function step1(edge, x) {
    return x >= edge ? 1 : 0;
  }

  // ============ General SDF primitives (11 functions) ============

  // Internal helper used by sdf_box (k = "outside box" combiner)
  function _boxK(a, b) {
    return a > 0 && b > 0 ? Math.sqrt(a * a + b * b) : a > b ? a : b;
  }

  function sdf_box(p, c, dims) {
    const x = p[0] - c[0];
    const y = p[1] - c[1];
    return _boxK(Math.abs(x) - dims[0] * 0.5, Math.abs(y) - dims[1] * 0.5);
  }

  function sdf_circle(p, c, r) {
    const x = p[0] - c[0];
    const y = p[1] - c[1];
    return Math.sqrt(x * x + y * y) - r;
  }

  function sdRoundBox(p, b, r) {
    r = [p[0] > 0.0 ? r[0] : r[2], p[0] > 0.0 ? r[1] : r[3]];
    const rr = p[1] > 0.0 ? r[0] : r[1];
    const q = [Math.abs(p[0]) - b[0] + rr, Math.abs(p[1]) - b[1] + rr];
    return Math.min(Math.max(q[0], q[1]), 0.0) + len2(max2(q, [0, 0])) - rr;
  }

  function sdTriangle(p, p0, p1, p2) {
    const e0 = sub2(p1, p0);
    const e1 = sub2(p2, p1);
    const e2 = sub2(p0, p2);

    const v0 = sub2(p, p0);
    const v1 = sub2(p, p1);
    const v2 = sub2(p, p2);

    const t0 = clamp1(dot2(v0, e0) / dot2(e0, e0), 0.0, 1.0);
    const t1 = clamp1(dot2(v1, e1) / dot2(e1, e1), 0.0, 1.0);
    const t2 = clamp1(dot2(v2, e2) / dot2(e2, e2), 0.0, 1.0);
    const pq0 = sub2(v0, mul2(e0, [t0, t0]));
    const pq1 = sub2(v1, mul2(e1, [t1, t1]));
    const pq2 = sub2(v2, mul2(e2, [t2, t2]));

    const s0 = Math.sign(e0[0] * v0[1] - e0[1] * v0[0]);
    const s1 = Math.sign(e1[0] * v1[1] - e1[1] * v1[0]);
    const s2 = Math.sign(e2[0] * v2[1] - e2[1] * v2[0]);

    if (s0 === s1 && s1 === s2) {
      const d = Math.min(dot2(pq0, pq0), Math.min(dot2(pq1, pq1), dot2(pq2, pq2)));
      return -Math.sqrt(d);
    } else {
      const d = Math.min(dot2(pq0, pq0), Math.min(dot2(pq1, pq1), dot2(pq2, pq2)));
      return Math.sqrt(d);
    }
  }

  function sdTrapezoid(p, a, b, ra, rb) {
    p = [p[0], -p[1]]; // BOB convention: invert Y
    const rba = rb - ra;
    const baba = dot2(sub2(b, a), sub2(b, a));
    const papa = dot2(sub2(p, a), sub2(p, a));
    const paba = dot2(sub2(p, a), sub2(b, a)) / baba;
    const x = Math.sqrt(papa - paba * paba * baba);
    const cax = Math.max(0.0, x - (paba < 0.5 ? ra : rb));
    const cay = Math.abs(paba - 0.5) - 0.5;
    const k = rba * rba + baba;
    const f = clamp1((rba * (x - ra) + paba * baba) / k, 0.0, 1.0);
    const cbx = x - ra - f * rba;
    const cby = paba - f;
    const s = cbx < 0.0 && cay < 0.0 ? -1.0 : 1.0;
    return s * Math.sqrt(Math.min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
  }

  function sdEtriangle(p, r) {
    p = [p[0], -p[1]];
    const k = Math.sqrt(3);
    p[0] = Math.abs(p[0]) - r / 2;
    p[1] = p[1] + r / k / 2;
    if (k * p[1] + p[0] > 0) {
      p = [(p[0] - k * p[1]) / 2, (-k * p[0] - p[1]) / 2];
    }
    p[0] = p[0] - clamp1(p[0], -r, 0);
    return -len2(p) * Math.sign(p[1]);
  }

  function sdf_line(p, cy, k) {
    k = k || 0;
    return -(p[1] - cy - k * p[0]);
  }

  function sdf_line2(p, cy, k) {
    k = k || 0;
    return -(p[1] - cy - 0.05 * Math.sin(k * p[0] * Math.PI * 10));
  }

  function sdf_moon(p, c) {
    const n = [2, 0, 0, 2];
    const q = trans2(n, sub2(p, [c[0], -0.8]));
    const bal1 = sdf_circle(q, [0.3, 0.1], 0.5);
    const bal2 = sdf_circle(q, [-0.15, -0.45], 0.55);
    return Math.max(bal1, -bal2); // Max-with-negation = subtraction
  }

  function xRepeated(p, s) {
    p = p.slice();
    const id = Math.round(p[0] / s);
    p[0] = p[0] - s * id;
    return p; // Returns repeated p, caller passes to another SDF
  }

  function sdf_rep(x, r) {
    x /= r;
    x -= Math.floor(x) + 0.5;
    x *= r;
    return x;
  }

  // ============ Expose all 28 as window globals ============

  const globals = {
    // Vector math (17)
    sub2: sub2,
    add2: add2,
    mul2: mul2,
    dot2: dot2,
    lenSq2: lenSq2,
    len2: len2,
    rot2: rot2,
    trans2: trans2,
    clamp1: clamp1,
    clamp2: clamp2,
    max2: max2,
    min2: min2,
    fract1: fract1,
    fract2: fract2,
    scale2: scale2,
    eq2: eq2,
    step1: step1,
    // General SDF primitives (11)
    sdf_box: sdf_box,
    sdf_circle: sdf_circle,
    sdRoundBox: sdRoundBox,
    sdTriangle: sdTriangle,
    sdTrapezoid: sdTrapezoid,
    sdEtriangle: sdEtriangle,
    sdf_line: sdf_line,
    sdf_line2: sdf_line2,
    sdf_moon: sdf_moon,
    xRepeated: xRepeated,
    sdf_rep: sdf_rep,
  };

  // Attach to window for iframe sketches
  if (typeof window !== 'undefined') {
    for (const key of Object.keys(globals)) {
      window[key] = globals[key];
    }
  }

  // Also export as module for unit tests (Node-side)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globals;
  }
})();
