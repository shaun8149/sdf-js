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

// ----- moussa-delaunay-voronoi (Sprint 5 Tier B) -----
console.log('\n--- moussa-delaunay-voronoi ---');
{
  const { delaunayTriangles, voronoiCells } = loadIdiom('moussa-delaunay-voronoi.js');
  ok(typeof delaunayTriangles === 'function', 'delaunayTriangles exported');
  ok(typeof voronoiCells === 'function', 'voronoiCells exported');

  // Simple 4 points in a square — should triangulate into 2 triangles
  const sq = [
    [100, 100],
    [200, 100],
    [200, 200],
    [100, 200],
  ];
  const tris = delaunayTriangles(sq, { minX: 0, maxX: 300, minY: 0, maxY: 300 });
  ok(Array.isArray(tris), 'tris is array');
  ok(tris.length === 2, `4-point square → 2 triangles (got ${tris.length})`);
  ok(
    tris.every((t) => t.circumcenter !== null),
    'every triangle has circumcenter',
  );
  ok(
    tris.every((t) => t.circumradius > 0),
    'every triangle has positive circumradius',
  );

  // 10 random points — Delaunay invariant: no point inside any circumcircle
  const rng = ((s) => () => ((s = (s * 1664525 + 1013904223) | 0), (s >>> 0) / 0xffffffff))(7);
  const pts = [];
  for (let i = 0; i < 10; i++) pts.push([50 + rng() * 200, 50 + rng() * 200]);
  const tris2 = delaunayTriangles(pts, { minX: 0, maxX: 300, minY: 0, maxY: 300 });
  ok(tris2.length > 0, `10 points → ${tris2.length} triangles`);
  let violations = 0;
  for (const t of tris2) {
    for (const p of pts) {
      // Skip the triangle's own vertices
      if (
        (p[0] === t.a[0] && p[1] === t.a[1]) ||
        (p[0] === t.b[0] && p[1] === t.b[1]) ||
        (p[0] === t.c[0] && p[1] === t.c[1])
      )
        continue;
      const dx = p[0] - t.circumcenter.x,
        dy = p[1] - t.circumcenter.y;
      if (dx * dx + dy * dy < t.circumradius * t.circumradius - 1) violations++;
    }
  }
  ok(
    violations === 0,
    `Delaunay invariant: no point inside any circumcircle (${violations} violations)`,
  );

  // Voronoi: each site gets a polygon
  const cells = voronoiCells(tris2, pts);
  ok(cells.length === pts.length, `voronoi cells match site count (${cells.length})`);
  ok(
    cells.every((c) => Array.isArray(c.polygon)),
    'every cell has polygon array',
  );
  ok(
    cells.some((c) => c.polygon.length >= 3),
    'at least one cell is a proper polygon (≥3 vertices)',
  );
}

// ----- moussa-perlin-flow-field (Sprint 5 Tier B) -----
console.log('\n--- moussa-perlin-flow-field ---');
{
  const { buildFlowField, traceFlowLines } = loadIdiom('moussa-perlin-flow-field.js');
  ok(typeof buildFlowField === 'function', 'buildFlowField exported');
  ok(typeof traceFlowLines === 'function', 'traceFlowLines exported');

  const grid = buildFlowField(600, 360, { spacing: 30, noiseScale: 0.01, seed: 42 });
  ok(Array.isArray(grid), 'grid is array');
  ok(
    grid.length === Math.ceil(600 / 30),
    `grid x-dim = ${Math.ceil(600 / 30)}, got ${grid.length}`,
  );
  ok(
    grid[0].length === Math.ceil(360 / 30),
    `grid y-dim = ${Math.ceil(360 / 30)}, got ${grid[0].length}`,
  );
  ok(
    grid.every((col) => col.every((g) => typeof g.angle === 'number')),
    'every cell has numeric angle',
  );
  ok(grid._spacing === 30, 'grid stores spacing metadata');

  // Deterministic: same seed → same angles
  const grid2 = buildFlowField(600, 360, { spacing: 30, noiseScale: 0.01, seed: 42 });
  ok(grid[0][0].angle === grid2[0][0].angle, 'same seed = same angles (deterministic)');

  // Trace lines
  const lines = traceFlowLines(grid, { lineCount: 20, stepsPerLine: 30, stepLength: 4, seed: 1 });
  ok(Array.isArray(lines), 'lines is array');
  ok(lines.length > 0, `produced ${lines.length} lines`);
  ok(
    lines.every((line) => line.length >= 2),
    'every line has ≥2 points',
  );
  ok(
    lines.every((line) => line.every(([x, y]) => x >= 0 && x <= 600 && y >= 0 && y <= 360)),
    'all line points within canvas bounds',
  );
}

// ----- moussa-hooke-brush-stroke (Sprint 5 Tier B) -----
console.log('\n--- moussa-hooke-brush-stroke ---');
{
  const { springBrushStroke } = loadIdiom('moussa-hooke-brush-stroke.js');
  ok(typeof springBrushStroke === 'function', 'springBrushStroke exported');

  // Single segment line
  const stroke = springBrushStroke(
    [
      [0, 0],
      [100, 0],
    ],
    { brushSize: 10, stepSize: 5 },
  );
  ok(Array.isArray(stroke), 'stroke is array');
  ok(stroke.length > 0, `produced ${stroke.length} points`);
  ok(
    stroke.every(
      (p) => typeof p.x === 'number' && typeof p.y === 'number' && typeof p.thickness === 'number',
    ),
    'every stroke point has {x, y, thickness}',
  );
  ok(
    stroke.every((p) => p.thickness >= 1 && p.thickness <= 10),
    'thickness in [minThickness, brushSize]',
  );

  // Final point snaps to last waypoint
  const final = stroke[stroke.length - 1];
  ok(final.x === 100 && final.y === 0, 'final point snaps to last waypoint');

  // Multi-segment path
  const stroke2 = springBrushStroke(
    [
      [0, 0],
      [50, 50],
      [100, 0],
    ],
    { brushSize: 8, stepSize: 2 },
  );
  ok(stroke2.length > stroke.length, 'longer path → more points');

  // Edge: 2-point path
  const tiny = springBrushStroke(
    [
      [0, 0],
      [10, 10],
    ],
    {},
  );
  ok(tiny.length >= 1, 'tiny path produces at least 1 point');

  // Edge: degenerate (1 point)
  const single = springBrushStroke([[5, 5]], { brushSize: 4 });
  ok(
    single.length === 1 && single[0].thickness === 4,
    'single waypoint returns 1 point with brushSize',
  );
}

// ----- kgolid-chromotome-palettes (Sprint 6) -----
console.log('\n--- kgolid-chromotome-palettes ---');
{
  const {
    getChromotomePalettes,
    getChromotomePaletteByName,
    getRandomChromotomePalette,
    hexToRgb,
  } = loadIdiom('kgolid-chromotome-palettes.js');
  ok(typeof getChromotomePalettes === 'function', 'getChromotomePalettes exported');
  ok(typeof getChromotomePaletteByName === 'function', 'getChromotomePaletteByName exported');
  ok(typeof getRandomChromotomePalette === 'function', 'getRandomChromotomePalette exported');
  ok(typeof hexToRgb === 'function', 'hexToRgb exported');

  const all = getChromotomePalettes();
  ok(Array.isArray(all), 'getChromotomePalettes returns array');
  ok(all.length >= 20, `>=20 palettes shipped (got ${all.length})`);
  ok(
    all.every((p) => typeof p.name === 'string' && Array.isArray(p.colors) && p.colors.length >= 3),
    'every palette has name + colors[≥3]',
  );
  ok(
    all.every((p) => typeof p.background === 'string' && p.background.startsWith('#')),
    'every palette has hex background',
  );
  ok(
    all.every((p) => p.source && p.source.startsWith('chromotome:')),
    'every palette credits chromotome source',
  );

  const found = getChromotomePaletteByName('hilda01');
  ok(found && found.name === 'hilda01', 'getChromotomePaletteByName works');
  ok(getChromotomePaletteByName('nope') === null, 'returns null for unknown');

  // Deterministic random with seeded rand
  let seed = 0;
  const rng = () => (seed = (seed + 0.37) % 1);
  const r1 = getRandomChromotomePalette(rng);
  ok(r1 && typeof r1.name === 'string', 'getRandomChromotomePalette returns palette');

  // hexToRgb conversions
  const rgb = hexToRgb('#ff8000');
  ok(
    rgb[0] === 255 && rgb[1] === 128 && rgb[2] === 0,
    `hexToRgb #ff8000 → [255,128,0] (got ${rgb})`,
  );
  ok(hexToRgb('#fff')[0] === 255, '3-digit hex expands correctly');
  ok(hexToRgb('xxxxxx')[0] === 0, 'invalid hex (non-hex chars) returns [0,0,0]');
  ok(hexToRgb('')[0] === 0, 'empty string returns [0,0,0]');
}

// ----- kgolid-marching-squares (Sprint 6) -----
console.log('\n--- kgolid-marching-squares ---');
{
  const { marchingSquaresLines, marchingSquaresPolygons, buildNoiseGrid } = loadIdiom(
    'kgolid-marching-squares.js',
  );
  ok(typeof marchingSquaresLines === 'function', 'marchingSquaresLines exported');
  ok(typeof marchingSquaresPolygons === 'function', 'marchingSquaresPolygons exported');
  ok(typeof buildNoiseGrid === 'function', 'buildNoiseGrid exported');

  // Trivial 3×3 grid: 4 corners high, center low → contour around center
  const grid = [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ];
  const lines = marchingSquaresLines(grid, 0.5, { cellSize: 10 });
  ok(Array.isArray(lines), 'returns array');
  ok(lines.length === 4, `3x3 center-hole → 4 segments (got ${lines.length})`);
  ok(
    lines.every((s) => typeof s.x1 === 'number' && typeof s.x2 === 'number'),
    'segments have x1/y1/x2/y2 numbers',
  );

  // Threshold above all values → no contour
  ok(marchingSquaresLines(grid, 100, {}).length === 0, 'threshold above max → no segments');
  // Threshold below all values → no contour
  ok(marchingSquaresLines(grid, -1, {}).length === 0, 'threshold below min → no segments');

  // Polygons: full-cell fill when all corners above threshold
  const allHigh = [
    [1, 1],
    [1, 1],
  ];
  const polys = marchingSquaresPolygons(allHigh, 0.5, { cellSize: 10 });
  ok(polys.length === 1 && polys[0].length === 4, 'all-above cell → 1 polygon with 4 vertices');

  // buildNoiseGrid determinism + shape
  const ng1 = buildNoiseGrid(20, 10, { scale: 0.2, seed: 7 });
  const ng2 = buildNoiseGrid(20, 10, { scale: 0.2, seed: 7 });
  ok(ng1.length === 10 && ng1[0].length === 20, 'grid shape: rows × cols');
  ok(ng1[5][10] === ng2[5][10], 'same seed = same grid (deterministic)');
  ok(
    ng1.every((row) => row.every((v) => v >= 0 && v <= 1)),
    'noise values in [0, 1]',
  );

  // Contour count grows with grid density
  const sparse = marchingSquaresLines(buildNoiseGrid(10, 10, { scale: 0.3, seed: 1 }), 0.5, {});
  const dense = marchingSquaresLines(buildNoiseGrid(40, 40, { scale: 0.3, seed: 1 }), 0.5, {});
  ok(
    dense.length > sparse.length,
    `denser grid → more contour segments (${sparse.length} → ${dense.length})`,
  );
}

// ----- kgolid-apparatus-ca (Sprint 7) -----
console.log('\n--- kgolid-apparatus-ca ---');
{
  const { generateApparatusGrid, drawApparatusGrid } = loadIdiom('kgolid-apparatus-ca.js');
  ok(typeof generateApparatusGrid === 'function', 'generateApparatusGrid exported');
  ok(typeof drawApparatusGrid === 'function', 'drawApparatusGrid exported');

  // Default options
  const grid = generateApparatusGrid({});
  ok(Array.isArray(grid), 'returns 2D array');
  ok(grid.length === 19, `default ydim 18 + 1 = 19 rows (got ${grid.length})`);
  ok(grid[0].length === 25, `default xdim 24 + 1 = 25 cols (got ${grid[0].length})`);

  // First row + first col are blank cells (boundary)
  ok(
    grid[0].every((c) => !c.in && !c.h && !c.v && c.col === null),
    'row 0 all blank',
  );
  ok(
    grid.every((row) => !row[0].in && !row[0].h && !row[0].v),
    'col 0 all blank',
  );

  // Cell shape contract
  ok(
    grid.every((row) =>
      row.every(
        (c) => typeof c.h === 'boolean' && typeof c.v === 'boolean' && typeof c.in === 'boolean',
      ),
    ),
    'every cell has h/v/in booleans',
  );

  // At least SOME cells have in=true (algo produces non-empty rooms)
  const insideCount = grid.flat().filter((c) => c.in).length;
  ok(insideCount > 0, `produced ${insideCount} inside cells (>0)`);

  // Inside cells have non-null col (when in)
  ok(
    grid
      .flat()
      .filter((c) => c.in)
      .every((c) => c.col !== null),
    'every inside cell has color',
  );

  // Inside cells have non-null id
  ok(
    grid
      .flat()
      .filter((c) => c.in)
      .every((c) => c.id !== null),
    'every inside cell has id',
  );

  // Multiple distinct ids = multiple rooms generated
  const ids = new Set(
    grid
      .flat()
      .filter((c) => c.in)
      .map((c) => c.id),
  );
  ok(ids.size >= 2, `≥2 distinct room ids (got ${ids.size})`);

  // simple:true skips boundary → full grid filled inside
  const simpleGrid = generateApparatusGrid({ simple: true, xdim: 8, ydim: 6 });
  const insideSimple = simpleGrid.flat().filter((c) => c.in).length;
  ok(insideSimple > 30, `simple mode fills most cells (${insideSimple})`);

  // Custom xdim / ydim respected
  const tiny = generateApparatusGrid({ xdim: 10, ydim: 6, radius_x: 5, radius_y: 3 });
  ok(tiny.length === 7 && tiny[0].length === 11, 'custom dims respected');

  // color_mode = 'random' produces ≥2 distinct colors when palette has ≥2
  let randomColors = new Set();
  for (let i = 0; i < 20 && randomColors.size < 2; i++) {
    const g = generateApparatusGrid({ color_mode: 'random', colors: ['#aaa', '#bbb', '#ccc'] });
    g.flat()
      .filter((c) => c.in)
      .forEach((c) => randomColors.add(c.col));
  }
  ok(randomColors.size >= 2, `random color_mode emits multi colors (got ${randomColors.size})`);

  // H-symmetry: right half mirrors left
  const symGrid = generateApparatusGrid({
    horizontal_symmetry: true,
    vertical_symmetry: false,
    xdim: 20,
    ydim: 14,
  });
  let mirrorOk = true;
  const yMid = 7; // sample middle row
  for (let x = 1; x < symGrid[yMid].length / 2; x++) {
    const left = symGrid[yMid][x];
    const right = symGrid[yMid][symGrid[yMid].length - x];
    if (left.in !== right.in) {
      mirrorOk = false;
      break;
    }
  }
  ok(mirrorOk, 'H-symmetric: row reflects left ↔ right');

  // drawApparatusGrid doesn't crash with no P5 globals (early-exit safe)
  let crashed = false;
  try {
    drawApparatusGrid(grid, { cellSize: 10 });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'drawApparatusGrid safe when no P5 globals available');
}

// ----- kgolid-space-colonization (Sprint 8) -----
console.log('\n--- kgolid-space-colonization ---');
{
  const { spaceColonization } = loadIdiom('kgolid-space-colonization.js');
  ok(typeof spaceColonization === 'function', 'spaceColonization exported');

  const result = spaceColonization({
    width: 600,
    height: 360,
    sourceCount: 100,
    rootCount: 3,
    gaussianSpread: 80,
    killRange: 12,
    growth: 5,
    maxIterations: 100,
    seed: 7,
  });
  ok(
    typeof result === 'object' && Array.isArray(result.edges) && Array.isArray(result.nodes),
    'returns {edges, nodes}',
  );
  ok(result.nodes.length > 3, `grew beyond initial 3 roots (${result.nodes.length})`);
  ok(result.edges.length > 0, `produced ${result.edges.length} edges`);
  ok(
    result.edges.every((e) => typeof e.x1 === 'number' && typeof e.x2 === 'number'),
    'edges have x1/y1/x2/y2 numbers',
  );

  // Determinism: same seed → same result
  const r2 = spaceColonization({
    width: 600,
    height: 360,
    sourceCount: 100,
    rootCount: 3,
    gaussianSpread: 80,
    killRange: 12,
    growth: 5,
    maxIterations: 100,
    seed: 7,
  });
  ok(result.nodes.length === r2.nodes.length, 'same seed = same node count');

  // Different seed → different result
  const r3 = spaceColonization({
    width: 600,
    height: 360,
    sourceCount: 100,
    rootCount: 3,
    gaussianSpread: 80,
    killRange: 12,
    growth: 5,
    maxIterations: 100,
    seed: 99,
  });
  ok(
    result.nodes.length !== r3.nodes.length || result.nodes[5].x !== r3.nodes[5].x,
    'different seed = different tree',
  );

  // Uniform sources mode
  const uniform = spaceColonization({
    width: 600,
    height: 360,
    sourceCount: 50,
    sourceMode: 'uniform',
    rootCount: 2,
    killRange: 10,
    growth: 5,
    maxIterations: 60,
    seed: 1,
  });
  ok(uniform.nodes.length > 2, 'uniform source mode also grows tree');
}

// ----- kgolid-lindenmayer-lsystem (Sprint 8) -----
console.log('\n--- kgolid-lindenmayer-lsystem ---');
{
  const { lSystemSegments, LSYSTEM_PRESETS } = loadIdiom('kgolid-lindenmayer-lsystem.js');
  ok(typeof lSystemSegments === 'function', 'lSystemSegments exported');
  ok(
    typeof LSYSTEM_PRESETS === 'object' && Object.keys(LSYSTEM_PRESETS).length === 4,
    '4 presets available (balanced/asymmetric/symmetric/wide_canopy)',
  );

  const segs = lSystemSegments({
    rule: 'FF[+F][-F]',
    generations: 3,
    extension: 100,
    angle: Math.PI / 8,
    startX: 300,
    startY: 350,
    seed: 7,
  });
  ok(Array.isArray(segs), 'returns array');
  ok(segs.length > 0, `produced ${segs.length} segments`);
  ok(
    segs.every((s) => typeof s.x1 === 'number' && typeof s.depth === 'number'),
    'segs have x1/y1/x2/y2 + depth',
  );

  const small = lSystemSegments({ rule: 'FF[+F][-F]', generations: 2, seed: 7 });
  const big = lSystemSegments({ rule: 'FF[+F][-F]', generations: 4, seed: 7 });
  ok(big.length > small.length, `more gens → more segs (${small.length} → ${big.length})`);

  let crashed = false;
  try {
    lSystemSegments({ rule: 'F]', generations: 2 });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'unbalanced brackets do not crash (silent pop on empty stack)');

  const empty = lSystemSegments({ axiom: '', rule: 'F', generations: 3 });
  ok(empty.length === 0, 'empty axiom → no segments');

  const preset = lSystemSegments({ rule: LSYSTEM_PRESETS.balanced, generations: 3, seed: 1 });
  ok(preset.length > 0, 'preset rule produces segments');
}

// ----- kgolid-weave-flow-dashes (Sprint 8) -----
console.log('\n--- kgolid-weave-flow-dashes ---');
{
  const { weaveFlowDashes } = loadIdiom('kgolid-weave-flow-dashes.js');
  ok(typeof weaveFlowDashes === 'function', 'weaveFlowDashes exported');

  const dashes = weaveFlowDashes({
    width: 300,
    height: 200,
    cellSize: 20,
    layers: 3,
    seed: 1,
  });
  ok(Array.isArray(dashes), 'returns array');
  ok(dashes.length === 15 * 10 * 3, `expected 450 dashes (${dashes.length})`);
  ok(
    dashes.every((d) => typeof d.x === 'number' && typeof d.dx === 'number'),
    'dashes have x/y/dx/dy numbers',
  );
  ok(
    dashes.every((d) => d.layer >= 0 && d.layer < 3),
    'all dashes have valid layer index',
  );

  const layerCounts = [0, 0, 0];
  for (const d of dashes) layerCounts[d.layer]++;
  ok(
    layerCounts.every((c) => c === 150),
    `each layer has 150 dashes (got ${layerCounts.join(',')})`,
  );

  const d2 = weaveFlowDashes({ width: 300, height: 200, cellSize: 20, layers: 3, seed: 1 });
  ok(d2[100].dx === dashes[100].dx, 'same seed = same dash direction');

  const layer0Dashes = dashes.filter((d) => d.layer === 0);
  const layer1Dashes = dashes.filter((d) => d.layer === 1);
  let differs = false;
  for (let i = 0; i < layer0Dashes.length; i++) {
    if (layer0Dashes[i].dx !== layer1Dashes[i].dx) {
      differs = true;
      break;
    }
  }
  ok(differs, 'different layers have different flow patterns');
}

// ----- atlas-icon-library (Sprint 13) -----
console.log('\n--- atlas-icon-library ---');
{
  const { drawAtlasIcon, ATLAS_ICON_NAMES } = loadIdiom('atlas-icon-library.js');
  ok(typeof drawAtlasIcon === 'function', 'drawAtlasIcon exported');
  ok(Array.isArray(ATLAS_ICON_NAMES), 'ATLAS_ICON_NAMES is array');
  ok(ATLAS_ICON_NAMES.length >= 20, `≥20 icons curated (got ${ATLAS_ICON_NAMES.length})`);
  ok(
    ATLAS_ICON_NAMES.every((n) => typeof n === 'string'),
    'all names are strings',
  );

  // Spot-check key icons exist
  const expected = ['user', 'users', 'database', 'arrow-right', 'check', 'lightning'];
  ok(
    expected.every((n) => ATLAS_ICON_NAMES.includes(n)),
    `key icons present: ${expected.join(', ')}`,
  );

  // drawAtlasIcon safe to call with no drawingContext (Node test env)
  let crashed = false;
  try {
    drawAtlasIcon('user', 100, 100, 32, '#000');
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'drawAtlasIcon no-op safe when drawingContext unavailable');

  // Unknown icon doesn't crash
  crashed = false;
  try {
    drawAtlasIcon('nonexistent', 100, 100, 32, '#000');
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'drawAtlasIcon unknown name no-op safe');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
