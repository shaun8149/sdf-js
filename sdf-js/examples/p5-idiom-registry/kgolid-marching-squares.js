/**
 * Marching Squares (contour extraction from scalar grid)
 *
 * Source: Kjetil Midtgarden Golid (kgolid),
 *   https://github.com/kgolid/topographic — MIT licensed
 * Atlas adaptation: 2026-06-20 — recipe-only port, pure-JS (no P5 dep) returning
 *   line segments + polygon vertices for caller to draw.
 *
 * What it does
 * ------------
 * Given a 2D grid of scalar values (e.g., heightmap, density field, data
 * metric mapped to 2D), extracts contour lines at one or more threshold
 * values. Classic computer-graphics algorithm: for each 2×2 cell of the
 * grid, compute a 4-bit "case ID" (one bit per corner above/below threshold),
 * dispatch to one of 16 line/polygon shapes via linear interpolation along
 * cell edges. Output: connected contour line segments at each threshold.
 *
 * Atlas use case
 * --------------
 * Data topology visualization that no rectangular chart can match:
 *   - "Heat map" of any 2D metric (sales by region+time, density of mentions)
 *   - "Elevation" abstraction for hierarchical or layered data
 *   - Decorative contour background that follows underlying noise / data
 *
 * Pairs with `kgolid-chromotome-palettes` (each contour level gets a
 * palette color) and `moussa-perlin-flow-field` (use noise as the scalar
 * field if no data is available).
 *
 * Signatures
 * ----------
 *   marchingSquaresLines(grid, threshold, opts) → Array<{x1,y1,x2,y2}>
 *     grid: 2D array grid[y][x] of numbers
 *     threshold: number
 *     opts: {cellSize: 4 (px per grid cell)} — defaults to 1
 *     returns: line segments in pixel coords for caller to draw via P5 line()
 *
 *   marchingSquaresPolygons(grid, threshold, opts) → Array<Array<[x,y]>>
 *     same args; returns FILLED polygons (one per cell above threshold) for
 *     caller to draw via beginShape/vertex/endShape(CLOSE)
 *
 *   buildNoiseGrid(width, height, opts) → 2D grid array
 *     opts: {scale: 0.02, seed: 1, octaves: 4} — deterministic value noise
 *     convenience for testing + decorative use without external data
 *
 * Inside-iframe usage:
 *   // Render 5 contour levels over noise field
 *   const W = 600, H = 360, CELL = 8;
 *   const grid = buildNoiseGrid(W / CELL, H / CELL, {scale: 0.08, seed: 7});
 *   const fg = window.__brandingPalette.silhouetteColor;
 *   stroke(fg[0], fg[1], fg[2]);
 *   strokeWeight(0.7);
 *   noFill();
 *   for (const t of [0.2, 0.4, 0.6, 0.8]) {
 *     const lines = marchingSquaresLines(grid, t, {cellSize: CELL});
 *     for (const s of lines) line(s.x1, s.y1, s.x2, s.y2);
 *   }
 *
 * Test: scripts/test-p5-idiom-registry.mjs (contour line count, polygon
 * count vs threshold, deterministic noise grid)
 */

// Marching Squares case table:
// Each cell's 4 corners (NW, NE, SE, SW) form a 4-bit code (0-15).
// Bit 0 = SW, Bit 1 = SE, Bit 2 = NE, Bit 3 = NW (all > threshold = 1).
// Case 0 + 15 = no line; the others map to specific line / polygon shapes.

function _lerp(a, b, t) {
  return a + (b - a) * t;
}
function _edgePoint(v1, v2, threshold) {
  // Where on the edge between v1 (corner A, t=0) and v2 (corner B, t=1)
  // does the contour cross? Linear interpolation:
  // threshold = v1 + t * (v2 - v1)  →  t = (threshold - v1) / (v2 - v1)
  if (v1 === v2) return 0;
  return (threshold - v1) / (v2 - v1);
}

function _cellCase(v1, v2, v3, v4, threshold) {
  return (
    (v1 > threshold ? 8 : 0) +
    (v2 > threshold ? 4 : 0) +
    (v3 > threshold ? 2 : 0) +
    (v4 > threshold ? 1 : 0)
  );
}

function marchingSquaresLines(grid, threshold, opts = {}) {
  const cellSize = opts.cellSize ?? 1;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const out = [];

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const nw = grid[y][x];
      const ne = grid[y][x + 1];
      const se = grid[y + 1][x + 1];
      const sw = grid[y + 1][x];

      const id = _cellCase(nw, ne, se, sw, threshold);
      if (id === 0 || id === 15) continue;

      // Linear-interp edge crossings
      const n = [x + _edgePoint(nw, ne, threshold), y];
      const e = [x + 1, y + _edgePoint(ne, se, threshold)];
      const s = [x + _edgePoint(sw, se, threshold), y + 1];
      const w = [x, y + _edgePoint(nw, sw, threshold)];

      // Scale to pixel coords
      const toPx = (p) => ({ x: p[0] * cellSize, y: p[1] * cellSize });

      // 16-case dispatch (saddle cases 5/10 emit TWO lines)
      let pairs;
      if (id === 1 || id === 14) pairs = [[s, w]];
      else if (id === 2 || id === 13) pairs = [[e, s]];
      else if (id === 3 || id === 12) pairs = [[e, w]];
      else if (id === 4 || id === 11) pairs = [[n, e]];
      else if (id === 6 || id === 9) pairs = [[n, s]];
      else if (id === 7 || id === 8) pairs = [[w, n]];
      else
        pairs = [
          [e, s],
          [w, n],
        ]; // 5 + 10 saddle

      for (const [p1, p2] of pairs) {
        const a = toPx(p1),
          b = toPx(p2);
        out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
  }
  return out;
}

function marchingSquaresPolygons(grid, threshold, opts = {}) {
  const cellSize = opts.cellSize ?? 1;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const polygons = [];

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const nw = grid[y][x];
      const ne = grid[y][x + 1];
      const se = grid[y + 1][x + 1];
      const sw = grid[y + 1][x];

      const id = _cellCase(nw, ne, se, sw, threshold);
      if (id === 0) continue;

      // Edge crossings + corner labels in cell-local coords
      const n = [x + _edgePoint(nw, ne, threshold), y];
      const e = [x + 1, y + _edgePoint(ne, se, threshold)];
      const s = [x + _edgePoint(sw, se, threshold), y + 1];
      const w = [x, y + _edgePoint(nw, sw, threshold)];
      const NW = [x, y],
        NE = [x + 1, y],
        SE = [x + 1, y + 1],
        SW = [x, y + 1];

      let verts;
      if (id === 15)
        verts = [NW, NE, SE, SW]; // all above → full cell fill
      else if (id === 1) verts = [s, w, SW];
      else if (id === 2) verts = [e, s, SE];
      else if (id === 3) verts = [e, w, SW, SE];
      else if (id === 4) verts = [n, e, NE];
      else if (id === 5)
        verts = [e, s, SW, w, n, NE]; // saddle
      else if (id === 6) verts = [n, s, SE, NE];
      else if (id === 7) verts = [w, n, NE, SE, SW];
      else if (id === 8) verts = [NW, n, w];
      else if (id === 9) verts = [NW, n, s, SW];
      else if (id === 10)
        verts = [NW, n, e, SE, s, w]; // saddle
      else if (id === 11) verts = [NW, n, e, SE, SW];
      else if (id === 12) verts = [NW, NE, e, w];
      else if (id === 13) verts = [NW, NE, e, s, SW];
      else if (id === 14) verts = [NW, NE, SE, s, w];
      else continue;

      polygons.push(verts.map((p) => [p[0] * cellSize, p[1] * cellSize]));
    }
  }
  return polygons;
}

// Convenience: build a deterministic 2D noise grid for testing or background use.
// Same value-noise impl as moussa-perlin-flow-field (kept self-contained so
// callers don't need to bundle both).
function buildNoiseGrid(cols, rows, opts = {}) {
  const scale = opts.scale ?? 0.1;
  const seed = opts.seed ?? 1;
  function rand(ix, iy) {
    let h = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 0xffffffff;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  function sample(x, y) {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const sx = smooth(fx),
      sy = smooth(fy);
    const v00 = rand(ix, iy),
      v10 = rand(ix + 1, iy);
    const v01 = rand(ix, iy + 1),
      v11 = rand(ix + 1, iy + 1);
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  }
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) row.push(sample(x * scale, y * scale));
    grid.push(row);
  }
  return grid;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { marchingSquaresLines, marchingSquaresPolygons, buildNoiseGrid };
}
if (typeof window !== 'undefined') {
  window.marchingSquaresLines = marchingSquaresLines;
  window.marchingSquaresPolygons = marchingSquaresPolygons;
  window.buildNoiseGrid = buildNoiseGrid;
}
