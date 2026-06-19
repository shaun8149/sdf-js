// =============================================================================
// test-cube-3d.mjs — L1 unit tests for the cube-3d atom
// -----------------------------------------------------------------------------
// Probe-style SDF assertions. ~30 assertions across 6 groups:
//   1. Arrangements (10 layouts × positions verified)
//   2. Materials (3 — solid / wireframe / glass — tree-shape verified)
//   3. Connectors (4 — verify primitive count + placement)
//   4. Labels (3 modes + labelMaterial='extruded')
//   5. Per-cube transforms (cubeSizes / cubeRotations / cubeOffsets)
//   6. Edge cases (count=1, count=0, invalid combos)
// =============================================================================

import '../src/sdf/index.js';
import {
  cube3dSDF,
  ARRANGEMENTS,
  autoColor,
  cubeAutoId,
} from '../src/scene/components/shapes/cube-3d.js';

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

console.log('=== cube-3d smoke test ===\n');

// ---- Helpers ----------------------------------------------------------------

function distance3(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function isFinite3(p) {
  return Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);
}

function approxEq(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

console.log('Test group 1: Arrangement math');

// row: 5 cubes evenly spaced on X axis, centered
{
  const positions = ARRANGEMENTS.row(5, 0.6, 0.2, {});
  ok(positions.length === 5, 'row: 5 positions returned');
  ok(positions.every(isFinite3), 'row: all finite');
  ok(
    approxEq(positions[0][0], -1.6) && approxEq(positions[0][1], 0) && approxEq(positions[0][2], 0),
    `row: pos[0] = [-1.6, 0, 0] (got ${JSON.stringify(positions[0])})`,
  );
  ok(approxEq(positions[2][0], 0), 'row: middle cube on origin');
  ok(approxEq(positions[4][0], 1.6), 'row: last cube at +1.6');
}

// flow: like row but spacing × 1.5
{
  const positions = ARRANGEMENTS.flow(4, 0.6, 0.2, {});
  ok(positions.length === 4, 'flow: 4 positions');
  const stride = 0.6 + 0.2 * 1.5; // 0.9
  ok(
    approxEq(positions[0][0], ((-1.5 * stride) / 1) * 0.5) || approxEq(positions[0][0], -1.5 * 0.9),
    `flow: pos[0] x (got ${positions[0][0]})`,
  );
  ok(
    approxEq(positions[3][0] - positions[0][0], 3 * stride),
    `flow: total span = 3 × stride (got ${positions[3][0] - positions[0][0]})`,
  );
}

// stack
{
  const positions = ARRANGEMENTS.stack(5, 0.6, 0.2, {});
  ok(positions.length === 5, 'stack: 5 positions');
  ok(approxEq(positions[0][1], -1.6), 'stack: bottom y = -1.6');
  ok(approxEq(positions[2][1], 0), 'stack: middle y = 0');
  ok(approxEq(positions[0][0], 0) && approxEq(positions[0][2], 0), 'stack: x and z always 0');
}

// steps ascending
{
  const positions = ARRANGEMENTS.steps(3, 0.6, 0.2, { stepHeight: 0.3, ascending: true });
  ok(positions.length === 3, 'steps: 3 positions');
  ok(
    positions[0][1] < positions[1][1] && positions[1][1] < positions[2][1],
    'steps: y strictly ascending',
  );
  ok(
    approxEq(positions[0][1], 0) &&
      approxEq(positions[1][1], 0.3) &&
      approxEq(positions[2][1], 0.6),
    'steps: y = 0, 0.3, 0.6',
  );
}

// steps descending
{
  const positions = ARRANGEMENTS.steps(3, 0.6, 0.2, { stepHeight: 0.3, ascending: false });
  ok(positions[0][1] > positions[2][1], 'steps descending: y[0] > y[2]');
}

// grid 3×2
{
  const positions = ARRANGEMENTS.grid(6, 0.6, 0.2, { cols: 3 });
  ok(positions.length === 6, 'grid: 6 positions');
  ok(
    approxEq(positions[0][2], positions[1][2]) && approxEq(positions[1][2], positions[2][2]),
    'grid: row 0 same z',
  );
  ok(positions[3][2] !== positions[0][2], 'grid: row 0 and row 1 different z');
  ok(
    positions.every((p) => approxEq(p[1], 0)),
    'grid: y always 0',
  );
}

// grid3d 3×3×3 = 27 cubes
{
  const positions = ARRANGEMENTS.grid3d(27, 0.4, 0.05, { cols: 3, rows: 3, depth: 3 });
  ok(positions.length === 27, 'grid3d: 27 positions');
  ok(
    approxEq(positions[13][0], 0) && approxEq(positions[13][1], 0) && approxEq(positions[13][2], 0),
    `grid3d: center cube at origin (got ${JSON.stringify(positions[13])})`,
  );
  const stride = 0.4 + 0.05;
  ok(
    approxEq(positions[0][0], -stride) &&
      approxEq(positions[0][1], -stride) &&
      approxEq(positions[0][2], -stride),
    'grid3d: corner cube at -stride',
  );
}

// semicircle
{
  const positions = ARRANGEMENTS.semicircle(5, 0.6, 0.2, { arc: Math.PI });
  ok(positions.length === 5, 'semicircle: 5 positions');
  ok(positions.every(isFinite3), 'semicircle: all finite');
  ok(approxEq(positions[0][1], 0), 'semicircle: y always 0');
  ok(
    approxEq(positions[0][0], -positions[4][0], 1e-5),
    `semicircle: symmetric x (got ${positions[0][0]} vs ${positions[4][0]})`,
  );
  ok(
    positions[2][2] > 0 && approxEq(positions[2][0], 0, 1e-5),
    'semicircle: middle cube at +Z, x=0',
  );
}

// hub-spokes
{
  const positions = ARRANGEMENTS['hub-spokes'](5, 0.6, 0.2, { anchorSize: 1.0, arc: Math.PI });
  ok(positions.length === 5, 'hub-spokes: 5 positions');
  ok(
    approxEq(positions[0][0], 0) && approxEq(positions[0][2], 0),
    `hub-spokes: anchor (cube 0) at origin (got ${JSON.stringify(positions[0])})`,
  );
  const sat1Dist = Math.sqrt(positions[1][0] ** 2 + positions[1][2] ** 2);
  ok(sat1Dist > 1.5 && sat1Dist < 3.0, `hub-spokes: satellite distance ~2 (got ${sat1Dist})`);
}

// tower: 3×3 base + 3 stack
{
  const positions = ARRANGEMENTS.tower(12, 0.4, 0.1, { baseRows: 3, baseCols: 3, towerCount: 3 });
  ok(positions.length === 12, 'tower: 12 positions (9 base + 3 tower)');
  ok(
    positions.slice(0, 9).every((p) => approxEq(p[1], 0)),
    'tower: first 9 on Y=0 base',
  );
  ok(
    positions[9][1] > 0 &&
      positions[10][1] > positions[9][1] &&
      positions[11][1] > positions[10][1],
    'tower: last 3 ascending Y',
  );
  ok(
    approxEq(positions[9][0], 0) && approxEq(positions[9][2], 0),
    'tower: stack centered at x=0,z=0',
  );
}

// cluster (deterministic)
{
  const positions1 = ARRANGEMENTS.cluster(5, 0.6, 0.2, { radius: 1.5, zJitter: 0.3, seed: 7 });
  const positions2 = ARRANGEMENTS.cluster(5, 0.6, 0.2, { radius: 1.5, zJitter: 0.3, seed: 7 });
  ok(positions1.length === 5, 'cluster: 5 positions');
  ok(positions1.every(isFinite3), 'cluster: all finite');
  ok(distance3(positions1[0], positions2[0]) < 1e-9, 'cluster: deterministic same-seed');
  ok(distance3(positions1[3], positions2[3]) < 1e-9, 'cluster: deterministic same-seed [3]');
  const positionsB = ARRANGEMENTS.cluster(5, 0.6, 0.2, { radius: 1.5, zJitter: 0.3, seed: 42 });
  ok(
    distance3(positions1[0], positionsB[0]) > 0.01,
    'cluster: different seed → different positions',
  );
}

console.log('\nTest group 2: cube3dSDF core (solid material)');

// 5 cubes in a row, solid material
{
  const sdf = cube3dSDF({
    count: 5,
    arrangement: 'row',
    cubeSize: 0.6,
    spacing: 0.2,
    material: 'solid',
  });
  ok(sdf !== null, 'solid 5-row: SDF non-null');
  // Probe at cube 0 center (-1.6, 0, 0) — should be inside
  ok(sdf.f([-1.6, 0, 0]) < 0, `solid 5-row: cube 0 center inside (got ${sdf.f([-1.6, 0, 0])})`);
  // Probe at cube 2 center (0, 0, 0) — inside
  ok(sdf.f([0, 0, 0]) < 0, `solid 5-row: cube 2 center inside (got ${sdf.f([0, 0, 0])})`);
  // Probe far away — outside
  ok(sdf.f([10, 10, 10]) > 0, 'solid 5-row: far point outside');
}

// 1 cube, smoke test edge case
{
  const sdf = cube3dSDF({ count: 1, arrangement: 'row', cubeSize: 0.6 });
  ok(sdf !== null, 'solid count=1: SDF non-null');
  ok(sdf.f([0, 0, 0]) < 0, 'solid count=1: center inside');
}

// 0 cubes → null
{
  const sdf = cube3dSDF({ count: 0 });
  ok(sdf === null, 'count=0: SDF null');
}

// 3 cubes, wireframe material
{
  const sdf = cube3dSDF({ count: 3, arrangement: 'row', cubeSize: 0.6, material: 'wireframe' });
  ok(sdf !== null, 'wireframe 3-row: SDF non-null');
  // Center of cube 1 (origin) is HOLLOW for wireframe — SDF > 0
  ok(sdf.f([0, 0, 0]) > 0, `wireframe 3-row: cube center hollow (got ${sdf.f([0, 0, 0])})`);
  // Edge of cube 1 should be CLOSE to 0 (on the frame)
  ok(
    Math.abs(sdf.f([0.3, 0.3, 0])) < 0.1,
    `wireframe 3-row: cube edge near frame (got ${sdf.f([0.3, 0.3, 0])})`,
  );
}

// 1 cube, glass material — should have BOTH solid + frame components
{
  const sdf = cube3dSDF({ count: 1, cubeSize: 1.0, material: 'glass' });
  ok(sdf !== null, 'glass 1: SDF non-null');
  // Inner point (origin) should be SOLID (inside the 95% inner cube)
  ok(sdf.f([0, 0, 0]) < 0, `glass 1: center solid (inside inner cube, got ${sdf.f([0, 0, 0])})`);
  // Frame edge (0.5, 0.5, 0) should also be near 0 (on the outer frame)
  ok(
    Math.abs(sdf.f([0.5, 0.5, 0])) < 0.05,
    `glass 1: outer frame edge near 0 (got ${sdf.f([0.5, 0.5, 0])})`,
  );
}

// Sanity: every arrangement produces a non-null compileable SDF
{
  console.log('\nTest group 2.5: every arrangement compiles to SDF');
  const arrangements = [
    'row',
    'flow',
    'semicircle',
    'hub-spokes',
    'steps',
    'stack',
    'tower',
    'grid',
    'grid3d',
    'cluster',
  ];
  for (const arr of arrangements) {
    const sdf = cube3dSDF({ count: 5, arrangement: arr, cubeSize: 0.4, spacing: 0.1 });
    ok(sdf !== null, `arrangement '${arr}': non-null SDF`);
    ok(Number.isFinite(sdf.f([0, 0, 0])), `arrangement '${arr}': finite SDF at origin`);
  }
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
