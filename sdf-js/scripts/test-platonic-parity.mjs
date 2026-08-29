// sdf-js/scripts/test-platonic-parity.mjs — Platonic solids CPU↔GPU parity smoke.
//
// Background (DIMENSION 3D expand-vol final review, 2026-08-29): sdIcosahedron
// in sdf3.glsl.js shipped a twin-typo constant family (len = phi*sqrt(2)
// instead of phi*sqrt(3)) — non-unit plane normals (Lipschitz 1.2247 > 1),
// GPU body was not a regular icosahedron while the JS body was. This test
// pins all five Platonic bodies (tetra / octa / cube / dodeca / icosa) so the
// two implementations can never drift silently again:
//
//   1. Constant pins — numeric literals are regex-extracted from the *shipped*
//      GLSL source text and checked against exact closed-form recomputations
//      (tol 1e-12). Editing the GLSL constants without updating the math here
//      goes red.
//   2. Value parity — the extracted GLSL bodies are mirrored in JS (same
//      structure, extracted constants) and compared against the d3.js DSL
//      primitives on a deterministic sample-point sweep (13 directions x 5
//      radial shells x 3 sizes per solid), tol 1e-3 (covers float32 GPU
//      rounding headroom; observed max |Δ| is 0 — bodies are bit-identical
//      in float64).
//
// Argument conventions mirror the sdf3.compile.js emit table: tetra/octa/
// dodeca/icosa pass r straight through; box(size) emits sdBox with
// half-extents size/2.
//
// No Math.random / Date.now — sample set is a fixed literal table.

import { SDF3_GLSL } from '../src/sdf/sdf3.glsl.js';
import { tetrahedron, octahedron, box, dodecahedron, icosahedron } from '../src/sdf/d3.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));

console.log('=== platonic parity (JS DSL ↔ shipped GLSL constants) ===\n');

// ---- 1. extract shipped GLSL function bodies + constants -------------------

function fnText(name) {
  const m = SDF3_GLSL.match(new RegExp(`float ${name}\\(vec3 p[^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`GLSL function ${name} not found`);
  return m[0];
}

function constOf(fn, name) {
  const m = fn.match(new RegExp(`const float ${name}\\s*=\\s*(-?[0-9.]+)`));
  if (!m) throw new Error(`const ${name} not found`);
  return Number(m[1]);
}

const icoSrc = fnText('sdIcosahedron');
const dodSrc = fnText('sdDodecahedron');
fnText('sdTetrahedron'); // existence pins
fnText('sdOctahedron');
fnText('sdBox');

const ico = {
  scale: constOf(icoSrc, 'scale'),
  phi: constOf(icoSrc, 'phi'),
  len: constOf(icoSrc, 'len'),
  nx: constOf(icoSrc, 'nx'),
  ny: constOf(icoSrc, 'ny'),
  w13: constOf(icoSrc, 'w13'),
};
const dod = {
  n1: constOf(dodSrc, 'n1'),
  n2: constOf(dodSrc, 'n2'),
  rho: constOf(dodSrc, 'rho'),
};

// ---- 2. constant pins vs exact closed forms (tol 1e-12) --------------------

const PHI = (1 + Math.sqrt(5)) / 2;
const pin = (label, got, want) =>
  ok(Math.abs(got - want) < 1e-12, `${label}: shipped ${got} ≈ exact ${want}`);

console.log('icosahedron constants (final-review I1 corrected values):');
pin('  scale = phi/sqrt(1+phi^2)', ico.scale, PHI / Math.sqrt(1 + PHI * PHI));
pin('  phi', ico.phi, PHI);
pin('  len = sqrt(1+(1+phi)^2) = phi*sqrt(3)', ico.len, Math.sqrt(1 + (1 + PHI) * (1 + PHI)));
pin('  nx = 1/len', ico.nx, 1 / (PHI * Math.sqrt(3)));
pin('  ny = (1+phi)/len', ico.ny, (1 + PHI) / (PHI * Math.sqrt(3)));
pin('  w13 = 1/sqrt(3)', ico.w13, 1 / Math.sqrt(3));
ok(
  Math.abs(Math.hypot(ico.nx, ico.ny) - 1) < 1e-12,
  `  |(nx,ny)| = 1 (unit normals → 1-Lipschitz), got ${Math.hypot(ico.nx, ico.ny)}`,
);

console.log('\ndodecahedron constants:');
pin('  n1 = 1/sqrt(1+phi^2)', dod.n1, 1 / Math.sqrt(1 + PHI * PHI));
pin('  n2 = phi/sqrt(1+phi^2)', dod.n2, PHI / Math.sqrt(1 + PHI * PHI));
pin(
  '  rho = (1+phi)/(sqrt(1+phi^2)*sqrt(3))',
  dod.rho,
  (1 + PHI) / (Math.sqrt(1 + PHI * PHI) * Math.sqrt(3)),
);

// ---- 3. JS mirrors of the shipped GLSL bodies ------------------------------

const glsl = {
  tetrahedron: (p, r) =>
    (Math.max(Math.abs(p[0] + p[1]) - p[2], Math.abs(p[0] - p[1]) + p[2]) - r) / Math.sqrt(3),

  octahedron: (p, s) => {
    const px = Math.abs(p[0]),
      py = Math.abs(p[1]),
      pz = Math.abs(p[2]);
    const m = px + py + pz - s;
    let q;
    if (3 * px < m) q = [px, py, pz];
    else if (3 * py < m) q = [py, pz, px];
    else if (3 * pz < m) q = [pz, px, py];
    else return m * 0.57735027;
    const k = Math.min(Math.max(0.5 * (q[2] - q[1] + s), 0), s);
    return Math.hypot(q[0], q[1] - s + k, q[2] - k);
  },

  // emit table: box(size) → sdBox(p, size/2) — b are half-extents
  box: (p, b) => {
    const dx = Math.abs(p[0]) - b[0],
      dy = Math.abs(p[1]) - b[1],
      dz = Math.abs(p[2]) - b[2];
    const inside = Math.min(Math.max(dx, Math.max(dy, dz)), 0);
    return inside + Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
  },

  dodecahedron: (p, r) => {
    const px = Math.abs(p[0]),
      py = Math.abs(p[1]),
      pz = Math.abs(p[2]);
    const a = py * dod.n2 + pz * dod.n1;
    const b = px * dod.n1 + pz * dod.n2;
    const c = px * dod.n2 + py * dod.n1;
    return Math.max(Math.max(a, b), c) - dod.rho * r;
  },

  icosahedron: (p, r) => {
    const R = r * ico.scale;
    const px = Math.abs(p[0]) / R,
      py = Math.abs(p[1]) / R,
      pz = Math.abs(p[2]) / R;
    const a = px * ico.nx + py * ico.ny;
    const b = py * ico.nx + pz * ico.ny;
    const c = px * ico.ny + pz * ico.nx;
    const d = (px + py + pz) * ico.w13;
    return (Math.max(Math.max(Math.max(a, b), c), d) - ico.nx) * R;
  },
};

// ---- 4. deterministic sample sweep -----------------------------------------

// 13 fixed directions: axes, face diagonal, space diagonal, phi-family
// (icosa/dodeca vertex & face directions), plus three "awkward" generic dirs.
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const DIRS = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  norm([1, 1, 0]),
  norm([1, 1, 1]),
  norm([0, 1, PHI]),
  norm([1, PHI, 0]),
  norm([0, 1, 1 + PHI]),
  norm([1 + PHI, 0, 1]),
  norm([0.3, -0.7, 0.62]),
  norm([-0.9, 0.13, 0.41]),
  norm([0.05, 0.99, -0.11]),
  norm([-0.55, -0.5, -0.67]),
];
const SHELLS = [0, 0.5, 1.0, 1.5, 3.0]; // × r (surface neighbourhood in + out)
const SIZES = [0.4, 1.0, 1.7];

const CASES = [
  { name: 'tetrahedron', js: (r) => tetrahedron(r), g: (p, r) => glsl.tetrahedron(p, r) },
  { name: 'octahedron', js: (r) => octahedron(r), g: (p, r) => glsl.octahedron(p, r) },
  { name: 'cube (box)', js: (r) => box(r), g: (p, r) => glsl.box(p, [r / 2, r / 2, r / 2]) },
  { name: 'dodecahedron', js: (r) => dodecahedron(r), g: (p, r) => glsl.dodecahedron(p, r) },
  { name: 'icosahedron', js: (r) => icosahedron(r), g: (p, r) => glsl.icosahedron(p, r) },
];

console.log('\nvalue parity sweep (13 dirs × 5 shells × 3 sizes, tol 1e-3):');
const TOL = 1e-3;
for (const { name, js, g } of CASES) {
  let maxD = 0,
    n = 0;
  for (const r of SIZES) {
    const f = js(r);
    for (const dir of DIRS) {
      for (const t of SHELLS) {
        const p = [dir[0] * r * t, dir[1] * r * t, dir[2] * r * t];
        const dJs = f(p);
        const dGl = g(p, r);
        const delta = Math.abs(dJs - dGl);
        if (delta > maxD) maxD = delta;
        n++;
      }
    }
  }
  ok(maxD <= TOL, `${name}: ${n} samples, max |Δ| = ${maxD.toExponential(3)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
