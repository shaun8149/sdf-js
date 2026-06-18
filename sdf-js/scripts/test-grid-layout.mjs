// =============================================================================
// test-grid-layout.mjs — smoke test for Sprint 1 atom #9 (grid-layout helper)
// -----------------------------------------------------------------------------
// Verifies grid math:
//   1. Default 2×2 grid produces 4 positions
//   2. Grid centered around origin (positions sum to ~origin)
//   3. rowDirection='down' puts row 0 at top, 'up' at bottom
//   4. Custom origin offsets all cells
//   5. 1×1 grid → single position at origin
//   6. Edge cases (cols=0, rows=0)
//
// Run:  node sdf-js/scripts/test-grid-layout.mjs
// =============================================================================

import { gridLayout } from '../src/scene/grid-layout.js';

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

console.log('=== grid-layout smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: Default 2×2 grid (cellWidth=2.0, cellHeight=1.5, spacing=0.3)
// totalW = 2*2 + 1*0.3 = 4.3 → xStart = -4.3/2 + 1.0 = -1.15
// totalH = 2*1.5 + 1*0.3 = 3.3 → yStart (down) = +3.3/2 - 0.75 = +0.9
// Cells: (-1.15, +0.9), (+1.15, +0.9), (-1.15, -0.9), (+1.15, -0.9)
// -----------------------------------------------------------------------------
console.log('Test group 1: Default 2×2 grid');
const g2x2 = gridLayout();
ok(g2x2.length === 4, `2×2 produces 4 positions (got ${g2x2.length})`);
ok(approx(g2x2[0].x, -1.15) && approx(g2x2[0].y, 0.9), `[0] = (-1.15, +0.9) top-left`);
ok(approx(g2x2[1].x, 1.15) && approx(g2x2[1].y, 0.9), `[1] = (+1.15, +0.9) top-right`);
ok(approx(g2x2[2].x, -1.15) && approx(g2x2[2].y, -0.9), `[2] = (-1.15, -0.9) bottom-left`);
ok(approx(g2x2[3].x, 1.15) && approx(g2x2[3].y, -0.9), `[3] = (+1.15, -0.9) bottom-right`);
ok(g2x2[0].row === 0 && g2x2[0].col === 0, '[0] row=0 col=0');
ok(g2x2[3].row === 1 && g2x2[3].col === 1, '[3] row=1 col=1');

// -----------------------------------------------------------------------------
// Test group 2: Grid centered around origin (sum of positions = origin × N)
// -----------------------------------------------------------------------------
console.log('\nTest group 2: Grid centered');
const sum2x2 = g2x2.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), {
  x: 0,
  y: 0,
  z: 0,
});
ok(approx(sum2x2.x, 0) && approx(sum2x2.y, 0) && approx(sum2x2.z, 0), `sum of 2×2 cells = origin`);

// -----------------------------------------------------------------------------
// Test group 3: rowDirection up vs down
// -----------------------------------------------------------------------------
console.log('\nTest group 3: rowDirection');
const gDown = gridLayout({ cols: 1, rows: 2 });
const gUp = gridLayout({ cols: 1, rows: 2, rowDirection: 'up' });
ok(gDown[0].y > gDown[1].y, `down: row 0 above row 1 (y[0]=${gDown[0].y}, y[1]=${gDown[1].y})`);
ok(gUp[0].y < gUp[1].y, `up: row 0 below row 1 (y[0]=${gUp[0].y}, y[1]=${gUp[1].y})`);

// -----------------------------------------------------------------------------
// Test group 4: Custom origin offset
// -----------------------------------------------------------------------------
console.log('\nTest group 4: Custom origin');
const gOrig = gridLayout({ cols: 2, rows: 2, origin: [10, 5, -3] });
const sumOrig = gOrig.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), {
  x: 0,
  y: 0,
  z: 0,
});
// Sum should be 4 × origin
ok(
  approx(sumOrig.x, 4 * 10) && approx(sumOrig.y, 4 * 5) && approx(sumOrig.z, 4 * -3),
  `sum of positions = N × origin (${sumOrig.x}, ${sumOrig.y}, ${sumOrig.z})`,
);

// -----------------------------------------------------------------------------
// Test group 5: 1×1 grid → single position at origin
// -----------------------------------------------------------------------------
console.log('\nTest group 5: 1×1 grid');
const g1x1 = gridLayout({ cols: 1, rows: 1 });
ok(g1x1.length === 1, '1×1 produces 1 position');
ok(approx(g1x1[0].x, 0) && approx(g1x1[0].y, 0), '1×1 cell at origin');

// -----------------------------------------------------------------------------
// Test group 6: Edge cases
// -----------------------------------------------------------------------------
console.log('\nTest group 6: Edge cases');
const g0c = gridLayout({ cols: 0, rows: 3 });
ok(g0c.length === 0, 'cols=0 → empty');

const g0r = gridLayout({ cols: 3, rows: 0 });
ok(g0r.length === 0, 'rows=0 → empty');

// -----------------------------------------------------------------------------
// Test group 7: Realistic usage — KPI dashboard 2×2
// 4 cells of kpi-card sized 1.6 × 1.0 with spacing 0.2
// -----------------------------------------------------------------------------
console.log('\nTest group 7: KPI dashboard layout');
const gKpi = gridLayout({ cols: 2, rows: 2, cellWidth: 1.6, cellHeight: 1.0, spacing: 0.2 });
ok(gKpi.length === 4, 'KPI 2×2 → 4 cells');
const xSpan = Math.abs(gKpi[0].x - gKpi[1].x); // adjacent cells in same row
ok(approx(xSpan, 1.8), `adjacent X span = cellWidth + spacing = 1.8 (got ${xSpan})`);

// -----------------------------------------------------------------------------
// Test group 8: 3×3 icon grid
// -----------------------------------------------------------------------------
console.log('\nTest group 8: 3×3 icon grid');
const g3x3 = gridLayout({ cols: 3, rows: 3, cellWidth: 1.0, cellHeight: 1.0, spacing: 0.2 });
ok(g3x3.length === 9, '3×3 produces 9 cells');
ok(approx(g3x3[4].x, 0) && approx(g3x3[4].y, 0), 'center cell [4] at origin (row=1, col=1)');

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
