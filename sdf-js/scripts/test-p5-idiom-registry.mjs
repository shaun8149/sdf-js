// =============================================================================
// test-p5-idiom-registry.mjs — Smoke tests for Sprint 4 P5 idiom registry
// -----------------------------------------------------------------------------
// Verifies each idiom file in sdf-js/examples/p5-idiom-registry/ exports correct
// shape + produces plausible output on minimal inputs. Pure JS, no browser
// needed. Iframe-rendering smoke verified manually via browse skill in Sprint 4
// L3 testing (separate file).
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Loader: idiom files use IIFE-style "module.exports = ..." + "window.X = ..."
// to be classic-JS-loadable in iframe + Node-testable. package.json declares
// "type":"module" so plain require() ignores module.exports. Workaround: read
// file source + evaluate via new Function with mock module/exports/window.
const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY = resolve(__dirname, '../examples/p5-idiom-registry');
function loadIdiom(filename) {
  const src = readFileSync(resolve(REGISTRY, filename), 'utf8');
  const mod = { exports: {} };
  const win = {};
  const fn = new Function('module', 'exports', 'window', src);
  fn(mod, mod.exports, win);
  return Object.keys(mod.exports).length > 0 ? mod.exports : win;
}

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

console.log('=== p5-idiom-registry smoke ===\n');

// ----- moussa-recursive-circle-pack -----
console.log('--- moussa-recursive-circle-pack ---');
{
  const { packCirclesInSDF } = loadIdiom('moussa-recursive-circle-pack.js');
  ok(typeof packCirclesInSDF === 'function', 'packCirclesInSDF exported');

  // Inside-test: large box at origin
  const boxSdf = (x, y) => Math.max(Math.abs(x) - 1, Math.abs(y) - 1);
  const circles = packCirclesInSDF(boxSdf, {
    bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    maxNodes: 50,
    rootR: 0.1,
    decay: 0.9,
    minR: 0.02,
    maxR: 0.2,
  });
  ok(Array.isArray(circles), 'returns array');
  ok(circles.length > 0, `produced ${circles.length} circles (>0)`);
  ok(
    circles.every(
      (c) => typeof c.x === 'number' && typeof c.y === 'number' && typeof c.r === 'number',
    ),
    'every circle has {x, y, r} numbers',
  );
  ok(
    circles.every((c) => boxSdf(c.x, c.y) < 0),
    'every circle center is inside box SDF',
  );

  // No collisions (within pad tolerance)
  let collisionCount = 0;
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const dx = circles[i].x - circles[j].x;
      const dy = circles[i].y - circles[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < circles[i].r + circles[j].r - 0.001) collisionCount++;
    }
  }
  ok(collisionCount === 0, `no inter-circle overlap (${collisionCount} collisions)`);
}

// ----- moussa-irregular-grid-pack -----
console.log('\n--- moussa-irregular-grid-pack ---');
{
  const { irregularGridPack } = loadIdiom('moussa-irregular-grid-pack.js');
  ok(typeof irregularGridPack === 'function', 'irregularGridPack exported');

  const rects = irregularGridPack(8, 6, [
    { sizesArrX: [3, 4], sizesArrY: [2, 3] },
    { sizesArrX: [2], sizesArrY: [1, 2] },
    { sizesArrX: [1], sizesArrY: [1] },
  ]);
  ok(Array.isArray(rects), 'returns array');
  ok(rects.length > 0, `produced ${rects.length} rects`);
  ok(
    rects.every((r) => r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0),
    'all rects have valid pos+dim',
  );
  ok(
    rects.every((r) => r.x + r.w <= 8 && r.y + r.h <= 6),
    'all rects fit in 8×6 grid',
  );

  // No overlaps between any two rects
  let overlaps = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i],
        b = rects[j];
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlap) overlaps++;
    }
  }
  ok(overlaps === 0, `no rect overlaps (${overlaps})`);

  // Confirm mix of sizes (not all 1×1)
  const distinctSizes = new Set(rects.map((r) => r.w + 'x' + r.h));
  ok(distinctSizes.size >= 2, `mix of sizes: ${[...distinctSizes].join(', ')}`);
}

// ----- moussa-shape-pack-grid-collision -----
console.log('\n--- moussa-shape-pack-grid-collision ---');
{
  const { packShapes } = loadIdiom('moussa-shape-pack-grid-collision.js');
  ok(typeof packShapes === 'function', 'packShapes exported');

  const shapes = packShapes(600, 360, 30, {
    minRadius: 5,
    maxRadius: 20,
    pad: 1,
    gridSize: 50,
    insideTest: (x, y) => true,
  });
  ok(Array.isArray(shapes), 'returns array');
  ok(shapes.length > 0, `produced ${shapes.length} shapes`);
  ok(
    shapes.every((s) => s.r >= 5 && s.r <= 20),
    'all shape radii in [5, 20]',
  );

  // Spot-check non-overlap (allowing pad slack)
  let overlap = 0;
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const dx = shapes[i].x - shapes[j].x,
        dy = shapes[i].y - shapes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < shapes[i].r + shapes[j].r - 1) overlap++;
    }
  }
  ok(overlap === 0, `no shape overlap (${overlap})`);

  // insideTest filter actually applied
  const insideOnly = packShapes(600, 360, 20, {
    minRadius: 5,
    maxRadius: 15,
    insideTest: (x, y) => x < 300, // only left half
  });
  ok(
    insideOnly.every((s) => s.x < 300),
    `insideTest filter applied (${insideOnly.length} in left half)`,
  );
}

// ----- moussa-graphics-buffer -----
console.log('\n--- moussa-graphics-buffer (docs only, smoke export shape) ---');
{
  const buf = loadIdiom('moussa-graphics-buffer.js');
  ok(typeof buf === 'object', 'exports object');
  ok(typeof buf.workedExample1 === 'string', 'workedExample1 doc string present');
  ok(typeof buf.workedExample2 === 'string', 'workedExample2 doc string present');
}

// ----- moussa-rounded-polygon -----
console.log('\n--- moussa-rounded-polygon ---');
{
  const { roundedPolyPath } = loadIdiom('moussa-rounded-polygon.js');
  ok(typeof roundedPolyPath === 'function', 'roundedPolyPath exported');

  // Mock canvas2d context that records called methods
  const recorded = [];
  const mockCtx = {
    moveTo: (x, y) => recorded.push(['moveTo', x, y]),
    lineTo: (x, y) => recorded.push(['lineTo', x, y]),
    arcTo: (x1, y1, x2, y2, r) => recorded.push(['arcTo', x1, y1, x2, y2, r]),
    closePath: () => recorded.push(['closePath']),
  };

  // Triangle
  const tri = [
    [100, 100],
    [200, 100],
    [150, 200],
  ];
  roundedPolyPath(mockCtx, tri, 10);
  ok(recorded.length > 0, `triangle: ${recorded.length} path ops recorded`);
  ok(recorded[0][0] === 'moveTo', 'starts with moveTo');
  ok(
    recorded.filter((r) => r[0] === 'arcTo').length === 3,
    '3 arcTo calls for triangle (one per corner)',
  );
  ok(recorded[recorded.length - 1][0] === 'closePath', 'ends with closePath');

  // Rectangle with mixed per-vertex radii
  const recorded2 = [];
  const mock2 = {
    moveTo: (x, y) => recorded2.push(['moveTo', x, y]),
    lineTo: (x, y) => recorded2.push(['lineTo', x, y]),
    arcTo: (x1, y1, x2, y2, r) => recorded2.push(['arcTo', x1, y1, x2, y2, r]),
    closePath: () => recorded2.push(['closePath']),
  };
  const rect = [
    [0, 0],
    [100, 0],
    [100, 60],
    [0, 60],
  ];
  roundedPolyPath(mock2, rect, [12, 0, 12, 0]);
  ok(recorded2.filter((r) => r[0] === 'arcTo').length === 4, '4 arcTo for rectangle');
  const rs = recorded2.filter((r) => r[0] === 'arcTo').map((r) => r[5]);
  ok(rs.includes(12) && rs.includes(0), 'mixed radii applied (some 12, some 0)');

  // Edge: too-small polygon (no-op safety)
  const tooSmall = [
    [0, 0],
    [1, 0],
  ]; // 2 vertices = not a polygon
  const recorded3 = [];
  const mock3 = {
    moveTo: () => recorded3.push('m'),
    lineTo: () => recorded3.push('l'),
    arcTo: () => recorded3.push('a'),
    closePath: () => recorded3.push('c'),
  };
  roundedPolyPath(mock3, tooSmall, 5);
  ok(recorded3.length === 0, 'silently no-ops on <3 vertices');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
