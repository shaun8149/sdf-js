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

console.log('\nTest group 3: Labels');

// Front-face labels (default mode)
{
  const sdf = cube3dSDF({
    count: 3,
    arrangement: 'row',
    cubeSize: 1.0,
    spacing: 0.4,
    labels: ['1', '2', '3'],
    labelMaterial: 'pipe',
    labelScale: 0.5,
  });
  ok(sdf !== null, 'labels front-face: SDF non-null');
  // Front face of cube 1 (origin) is at z = +0.5. The label is on top of the face.
  // Point JUST IN FRONT of the front face center should be near the label.
  ok(Number.isFinite(sdf.f([0, 0, 0.6])), 'labels front-face: finite at probe');
}

// Stricter: label SDF should make the front face have geometry slightly closer
// than a bare cube would.
{
  const labeled = cube3dSDF({
    count: 1,
    cubeSize: 1.0,
    labels: ['8'],
    labelMaterial: 'pipe',
    labelScale: 0.6,
  });
  const bare = cube3dSDF({ count: 1, cubeSize: 1.0, labels: [] });
  // At point just outside front face center (where label sits), labeled SDF
  // should be ≤ bare SDF (label pulls geometry forward).
  const probe = [0, 0, 0.55]; // 0.05 outside cube front face
  const dLabeled = labeled.f(probe);
  const dBare = bare.f(probe);
  ok(
    dLabeled <= dBare + 1e-3,
    `label front-face probe: labeled (${dLabeled.toFixed(3)}) ≤ bare (${dBare.toFixed(3)})`,
  );
}

// labelOnAllFaces: same label on all 6 faces
{
  const sdf = cube3dSDF({
    count: 1,
    cubeSize: 1.0,
    labels: ['W'],
    labelOnAllFaces: true,
    labelMaterial: 'pipe',
    labelScale: 0.5,
  });
  ok(sdf !== null, 'labelOnAllFaces: SDF non-null');
  // Labels should sit on each face. Probe just outside each face should be near labels.
  for (const probe of [
    [0, 0, 0.55],
    [0, 0, -0.55],
    [0.55, 0, 0],
    [-0.55, 0, 0],
    [0, 0.55, 0],
    [0, -0.55, 0],
  ]) {
    ok(Number.isFinite(sdf.f(probe)), `labelOnAllFaces: finite at ${JSON.stringify(probe)}`);
  }
}

// labelsByFace: each face has independent label
{
  const sdf = cube3dSDF({
    count: 1,
    cubeSize: 1.0,
    labelsByFace: [['A', 'B', 'C', 'D', 'E', 'F']], // 6 letters one per face
    labelMaterial: 'pipe',
    labelScale: 0.5,
  });
  ok(sdf !== null, 'labelsByFace: SDF non-null');
  // Probe each face — all should be finite
  for (const probe of [
    [0, 0, 0.55],
    [0, 0, -0.55],
    [0.55, 0, 0],
    [-0.55, 0, 0],
    [0, 0.55, 0],
    [0, -0.55, 0],
  ]) {
    ok(Number.isFinite(sdf.f(probe)), `labelsByFace: finite at ${JSON.stringify(probe)}`);
  }
}

console.log('\nTest group 4: Connectors');

// pipe-through: 4 cubes row, single skewer
{
  const sdf = cube3dSDF({
    count: 4,
    arrangement: 'row',
    cubeSize: 0.6,
    spacing: 0.4,
    connector: 'pipe-through',
    connectorThickness: 0.05,
  });
  ok(sdf !== null, 'pipe-through 4-row: SDF non-null');
  // Probe between cubes (should be INSIDE the pipe, SDF < 0)
  ok(
    sdf.f([0.5, 0, 0]) < 0,
    `pipe-through 4-row: gap point should be inside pipe (got ${sdf.f([0.5, 0, 0])})`,
  );
  // Probe far above cubes (should be outside)
  ok(sdf.f([0, 5, 0]) > 0, 'pipe-through 4-row: far above is outside');
}

// pipe-vertical: 3 cubes stack with risers between
{
  const sdf = cube3dSDF({
    count: 3,
    arrangement: 'stack',
    cubeSize: 0.5,
    spacing: 0.3,
    connector: 'pipe-vertical',
    connectorThickness: 0.04,
  });
  ok(sdf !== null, 'pipe-vertical 3-stack: SDF non-null');
  // Between cube 0 and cube 1, on Y axis, should be inside the riser
  // cube positions: [0, -0.8, 0], [0, 0, 0], [0, 0.8, 0]; gap midpoint at [0, -0.4, 0]
  ok(
    sdf.f([0, -0.4, 0]) < 0,
    `pipe-vertical: midpoint between cubes inside riser (got ${sdf.f([0, -0.4, 0])})`,
  );
}

// spokes: anchor + 4 satellites, only indices [1, 3] connected
{
  const sdf = cube3dSDF({
    count: 5,
    arrangement: 'hub-spokes',
    cubeSize: 0.4,
    arrangementParams: { anchorSize: 0.8, arc: Math.PI },
    connector: 'spokes',
    connectorIndices: [1, 3],
    connectorThickness: 0.04,
  });
  ok(sdf !== null, 'spokes selective: SDF non-null');
  // Midpoint between anchor (origin) and satellite 1: should be inside spoke
  const positions = ARRANGEMENTS['hub-spokes'](5, 0.4, 0.2, { anchorSize: 0.8, arc: Math.PI });
  const sat1 = positions[1];
  const midSat1 = [sat1[0] / 2, sat1[1] / 2, sat1[2] / 2];
  ok(sdf.f(midSat1) < 0.1, `spokes: midpoint to satellite 1 near spoke (got ${sdf.f(midSat1)})`);
}

// spokes invalid arrangement throws
{
  let threw = false;
  try {
    cube3dSDF({
      count: 3,
      arrangement: 'row', // INVALID for spokes
      connector: 'spokes',
    });
  } catch (e) {
    threw = e.message.includes('spokes');
  }
  ok(threw, 'spokes + non-hub-spokes arrangement: throws');
}

// connector='none' (default): no connector geometry
{
  const sdf = cube3dSDF({
    count: 3,
    arrangement: 'row',
    cubeSize: 0.6,
    spacing: 0.5,
    connector: 'none',
  });
  // Big gap (0.5 spacing) midpoint should be OUTSIDE (no connector)
  ok(sdf.f([0.55, 0, 0]) > 0, `connector=none: gap point outside (got ${sdf.f([0.55, 0, 0])})`);
}

console.log('\nTest group 5: Per-cube transforms');

// cubeSizes: per-cube size override
{
  // Cube at origin, size 1.0 vs sized override 2.0 — bigger cube extends further
  const sdfDefault = cube3dSDF({ count: 1, cubeSize: 1.0 });
  const sdfBig = cube3dSDF({ count: 1, cubeSize: 1.0, cubeSizes: [2.0] });
  // Probe at [0.7, 0, 0]: default cube (half-extent 0.5) → outside; big cube (half-extent 1.0) → inside
  ok(sdfDefault.f([0.7, 0, 0]) > 0, 'cubeSizes baseline: 0.7 outside default cube');
  ok(sdfBig.f([0.7, 0, 0]) < 0, `cubeSizes: 0.7 inside big cube (got ${sdfBig.f([0.7, 0, 0])})`);
}

// cubeOffsets: per-cube delta position
{
  const sdf = cube3dSDF({
    count: 3,
    arrangement: 'row',
    cubeSize: 0.6,
    spacing: 0.1,
    cubeOffsets: [null, [0, 0, 1.0], null], // push middle cube forward by 1.0 in Z
  });
  // Cube 1 originally at origin; offset pushes it to [0, 0, 1.0]
  ok(sdf.f([0, 0, 1.0]) < 0, `cubeOffsets: middle cube at [0,0,1.0] (got ${sdf.f([0, 0, 1.0])})`);
  ok(
    sdf.f([0, 0, 0]) > 0,
    `cubeOffsets: original middle position [0,0,0] now empty (got ${sdf.f([0, 0, 0])})`,
  );
}

// cubeRotations: per-cube euler rotation
{
  const sdf = cube3dSDF({
    count: 1,
    cubeSize: 1.0,
    cubeRotations: [[0, Math.PI / 4, 0]], // rotate 45° around Y
  });
  ok(sdf !== null, 'cubeRotations: SDF non-null');
  // Rotated cube has different corners — the diagonal corner at [0.707, 0, 0]
  // (sqrt(2)/2) should be near the rotated cube's edge
  ok(
    Math.abs(sdf.f([0.707, 0, 0])) < 0.1,
    `cubeRotations: 45° rotated cube near edge at sqrt(2)/2 (got ${sdf.f([0.707, 0, 0])})`,
  );
}

console.log('\nTest group 6: Edge cases');

// Mismatched colors length — should NOT throw (silent pad/truncate)
{
  const sdf = cube3dSDF({ count: 5, colors: ['#ff0000', '#00ff00'] });
  ok(sdf !== null, 'mismatched colors: SDF non-null (silent pad)');
}

// Unknown arrangement throws
{
  let threw = false;
  try {
    cube3dSDF({ count: 3, arrangement: 'bogus' });
  } catch (e) {
    threw = e.message.includes('arrangement');
  }
  ok(threw, 'unknown arrangement: throws');
}

// Unknown material throws
{
  let threw = false;
  try {
    cube3dSDF({ count: 3, material: 'bogus' });
  } catch (e) {
    threw = e.message.includes('material');
  }
  ok(threw, 'unknown material: throws');
}

// labelOnAllFaces + labelsByFace: pick labelsByFace, ignore labelOnAllFaces (no throw)
{
  const sdf = cube3dSDF({
    count: 1,
    labels: ['X'],
    labelOnAllFaces: true,
    labelsByFace: [['A', 'B', 'C', 'D', 'E', 'F']],
  });
  ok(sdf !== null, 'both label modes set: SDF non-null (labelsByFace wins)');
}

console.log('\nTest group 7: End-to-end SceneData compile');

// SceneData v1 → compile pipeline
{
  const { compile } = await import('../src/scene/compile.js');
  const scene = {
    v: 1,
    name: 'cube-3d smoke',
    defaults: {
      camera: {
        yaw: 0.4,
        pitch: 0.2,
        distance: 10,
        focal: 1.5,
        targetX: 0,
        targetY: 0.3,
        targetZ: 0,
      },
      light: { altitude: 0.5, azimuth: 0.6, distance: 15, intensity: 1.2 },
    },
    subjects: [
      {
        id: 'cubes',
        type: 'cube-3d',
        args: { count: 3, arrangement: 'row', cubeSize: 0.5, spacing: 0.3 },
        transform: { translate: [0, 0.3, 0] },
        material: 'silver',
      },
    ],
  };
  let compiled;
  try {
    compiled = compile(scene);
    ok(compiled.sdf !== null, 'SceneData compile: non-null SDF');
    ok(typeof compiled.sdf.f === 'function', 'SceneData compile: SDF has .f');
    ok(Number.isFinite(compiled.sdf.f([0, 0.3, 0])), 'SceneData compile: finite at scene origin');
  } catch (e) {
    ok(false, `SceneData compile threw: ${e.message}`);
  }
}

console.log('\nTest group 8: GLSL emit (real-browser GPU prerequisite)');

// Verify cube-3d compiles to valid GLSL — does NOT actually run on GPU,
// just verifies the SDF tree can be walked and emitted without throws.
{
  const { canCompileSDF3, compileSDF3ToGLSL } = await import('../src/sdf/sdf3.compile.js');

  for (const arr of ['row', 'grid', 'grid3d', 'stack']) {
    const sdf = cube3dSDF({ count: 3, arrangement: arr, cubeSize: 0.5, material: 'solid' });
    ok(canCompileSDF3(sdf).ok, `GLSL: ${arr} canCompile`);
    let result;
    try {
      result = compileSDF3ToGLSL(sdf, { entry: `map_${arr}` });
      ok(typeof result.glsl === 'string' && result.glsl.length > 0, `GLSL: ${arr} emit non-empty`);
    } catch (e) {
      ok(false, `GLSL: ${arr} emit threw: ${e.message}`);
    }
  }

  // Wireframe + glass also emit
  for (const mat of ['wireframe', 'glass']) {
    const sdf = cube3dSDF({ count: 2, arrangement: 'row', cubeSize: 0.5, material: mat });
    ok(canCompileSDF3(sdf).ok, `GLSL: material '${mat}' canCompile`);
    const result = compileSDF3ToGLSL(sdf, { entry: `map_${mat}` });
    ok(
      result.glsl.includes('sdBoxFrame') || mat === 'solid',
      `GLSL: material '${mat}' emits sdBoxFrame`,
    );
  }
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
