// =============================================================================
// test-cut-disk.mjs — smoke test for gbms-cut-disk port (Track 4, 2026-05-26)
// -----------------------------------------------------------------------------
// Verifies the JS port of sdCutDisk matches expected sign behaviour at known
// probe points, then renders an ASCII silhouette as visual confirmation.
//
// Run:  node sdf-js/scripts/port-shader/test-cut-disk.mjs
// =============================================================================

import { cutDiskSDF } from '../../src/scene/components/community/gbms-cut-disk.js';

// Atlas convention: "keep below cut". cut=0.1 means everything with y > 0.1
// is removed; the lower portion of the disk remains.
const sdf = cutDiskSDF({ radius: 0.5, cut: 0.1 });
const eval2 = (x, y) => sdf.f([x, y]);

// ---- Probe points (radius=0.5, cut=0.1) ----
const probes = [
  // [x, y,      expectedSign, description]
  [0, 0.05,    'neg', 'just below cut, INSIDE kept region'],
  [0, 0.15,    'pos', 'just above cut, OUTSIDE (cut off)'],
  [0, -0.45,   'neg', 'near bottom edge, INSIDE'],
  [0, -0.55,   'pos', 'past bottom edge, OUTSIDE'],
  [0.6, 0,     'pos', 'past right edge, OUTSIDE'],
  [0.45, 0,    'neg', 'inside disk on x axis (well within radius), INSIDE'],
  [0,  0.1,    'zero','exactly ON the chord — boundary, SDF ≈ 0'],
];

let pass = 0, fail = 0;
console.log('Probe results:');
for (const [x, y, expected, desc] of probes) {
  const d = eval2(x, y);
  let actual;
  if (Math.abs(d) < 1e-3) actual = 'zero';
  else if (d > 0) actual = 'pos';
  else actual = 'neg';
  const ok = (expected === actual);
  console.log(`  (${x.toFixed(2)}, ${y.toFixed(2)}) → SDF=${d.toFixed(4)} expect=${expected} actual=${actual}  ${ok ? '✓' : '✗'}  ${desc}`);
  if (ok) pass++; else fail++;
}

console.log(`\n${pass}/${pass + fail} probes correct`);

// ---- ASCII silhouette ----
console.log('\nASCII silhouette (60×30, radius=0.5, cut=0.1, # = inside):');
const W = 60, H = 30;
for (let row = 0; row < H; row++) {
  let line = '';
  for (let col = 0; col < W; col++) {
    const x = (col / W) * 1.4 - 0.7;          // domain [-0.7, 0.7]
    const y = 0.7 - (row / H) * 1.4;           // domain [0.7, -0.7] (flip for screen)
    const d = eval2(x, y);
    if (d <= 0)     line += '#';
    else if (d < 0.02) line += '·';
    else            line += ' ';
  }
  console.log('  ' + line);
}

// ---- 2nd shape: exact half-disk (cut=0 → keep y ≤ 0) ----
console.log('\nASCII silhouette (cut=0 → exact lower half-disk, ∪-shape):');
const sdf2 = cutDiskSDF({ radius: 0.5, cut: 0 });
const eval2b = (x, y) => sdf2.f([x, y]);
for (let row = 0; row < H; row++) {
  let line = '';
  for (let col = 0; col < W; col++) {
    const x = (col / W) * 1.4 - 0.7;
    const y = 0.7 - (row / H) * 1.4;
    const d = eval2b(x, y);
    line += d <= 0 ? '#' : (d < 0.02 ? '·' : ' ');
  }
  console.log('  ' + line);
}

if (fail > 0) process.exit(1);
