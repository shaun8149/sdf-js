/**
 * Arbitrary Shape Packing via Grid-Spatial Hashing
 *
 * Source: Ahmad Moussa, https://www.gorillasun.de/blog/a-simple-solution-for-shape-packing-in-2d/
 * Atlas adaptation: 2026-06-20 — recipe-only port, simplified to circle-bounding-sphere collision
 *
 * What it does
 * ------------
 * Packs arbitrary shapes (represented by their bounding circles for fast
 * collision) into a 2D region. Uses spatial hashing: divide canvas into
 * grid cells, each circle registers in cells it touches, collision check
 * only queries adjacent cells (O(1) per candidate vs O(N) brute force).
 * Each candidate is randomly placed + iteratively shrunk if overlap detected,
 * up to max attempts.
 *
 * Atlas use case
 * --------------
 * Generalizes Sprint 3 wedge: instead of filling carrier with uniform coins,
 * LLM can fill with ARBITRARY shapes (dollar bills as rotated rectangles,
 * soldier icons as small SDF compositions, etc.) — each represented by its
 * bounding circle for collision, drawn with custom code at the placed position.
 *
 * Algorithm enables visuals like:
 *   - "Each carrier costs $13B" → 13 dollar-bill icons grouped into carrier outline
 *   - "1000 students enrolled" → 1000 small head icons packed into school silhouette
 *   - "100 servers running" → 100 small server-rack rects packed into data center outline
 *
 * Signature
 * ---------
 *   packShapes(width, height, count, opts) → Array<{x, y, r}>
 *
 *   opts = {
 *     minRadius: 4 (default), maxRadius: 30 (default),
 *     pad: 1 (gap between shapes),
 *     gridSize: 50 (spatial hash cell size in same units as width/height),
 *     maxAttempts: 5000 (per shape),
 *     insideTest: (x, y) => bool   // optional region filter (e.g., SDF inside)
 *   }
 *
 * Returns array of {x, y, r} representing successfully placed shapes.
 *
 * Inside-an-iframe usage:
 *   // Fill carrier silhouette with 50 dollar-bill rectangles
 *   const shapes = packShapes(600, 360, 50, {
 *     minRadius: 8, maxRadius: 14, pad: 2,
 *     insideTest: (x, y) => {
 *       const nx = (x / 300) - 1, ny = 1 - (y / 180);
 *       return sdf_box([nx, ny], [0, 0], [1.6, 0.5]) < 0;
 *     }
 *   });
 *   for (const s of shapes) {
 *     push(); translate(s.x, s.y); rotate(random(TAU));
 *     fill(34, 139, 34); noStroke();
 *     rect(-s.r, -s.r * 0.5, s.r * 2, s.r);  // dollar-bill rectangle
 *     pop();
 *   }
 *
 * Test: scripts/test-p5-idiom-shape-pack.mjs
 */

function packShapes(canvasW, canvasH, count, opts = {}) {
  const minR = opts.minRadius ?? 4;
  const maxR = opts.maxRadius ?? 30;
  const pad = opts.pad ?? 1;
  const cellSize = opts.gridSize ?? 50;
  const maxAttempts = opts.maxAttempts ?? 5000;
  const insideTest = opts.insideTest || (() => true);

  // Spatial hash: cells[col][row] = array of {x, y, r}
  const cols = Math.ceil(canvasW / cellSize);
  const rows = Math.ceil(canvasH / cellSize);
  const cells = [];
  for (let c = 0; c < cols; c++) cells.push(new Array(rows).fill(null).map(() => []));

  const placed = [];

  function getCellsAround(x, y, r) {
    const minCol = Math.max(0, Math.floor((x - r) / cellSize));
    const maxCol = Math.min(cols - 1, Math.floor((x + r) / cellSize));
    const minRow = Math.max(0, Math.floor((y - r) / cellSize));
    const maxRow = Math.min(rows - 1, Math.floor((y + r) / cellSize));
    const out = [];
    for (let c = minCol; c <= maxCol; c++) {
      for (let row = minRow; row <= maxRow; row++) out.push(cells[c][row]);
    }
    return out;
  }
  function collides(x, y, r) {
    const candidates = getCellsAround(x, y, r);
    for (const cell of candidates) {
      for (const o of cell) {
        const dx = o.x - x,
          dy = o.y - y;
        if (dx * dx + dy * dy < (o.r + r + pad) * (o.r + r + pad)) return true;
      }
    }
    return false;
  }
  function register(s) {
    placed.push(s);
    const cs = getCellsAround(s.x, s.y, s.r);
    for (const cell of cs) cell.push(s);
  }

  for (let i = 0, attempts = 0; i < count && attempts < maxAttempts * count; attempts++) {
    const x = minR + Math.random() * (canvasW - minR * 2);
    const y = minR + Math.random() * (canvasH - minR * 2);
    if (!insideTest(x, y)) continue;

    // Try to grow from minR up to maxR, stop on first collision
    let r = minR;
    let success = false;
    while (r <= maxR) {
      if (collides(x, y, r)) {
        if (r > minR) {
          // Step back one and place
          register({ x, y, r: r - 1 });
          success = true;
        }
        break;
      }
      if (x - r < 0 || x + r > canvasW || y - r < 0 || y + r > canvasH) {
        if (r > minR) {
          register({ x, y, r: r - 1 });
          success = true;
        }
        break;
      }
      r++;
    }
    if (r > maxR && !success) {
      register({ x, y, r: maxR });
      success = true;
    }
    if (success) i++;
  }

  return placed;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { packShapes };
}
if (typeof window !== 'undefined') {
  window.packShapes = packShapes;
}
