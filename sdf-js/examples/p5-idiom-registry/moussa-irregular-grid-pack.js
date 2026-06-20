/**
 * Irregular Rectangle Grid Packing (boolean grid sweep)
 *
 * Source: Ahmad Moussa, https://www.gorillasun.de/blog/an-algorithm-for-irregular-grids/
 * Atlas adaptation: 2026-06-20 — recipe-only port, multi-pass with descending size arrays
 *
 * What it does
 * ------------
 * Fills a `gridDivsX × gridDivsY` boolean grid with non-overlapping rectangles
 * of sizes drawn from `sizesArrX × sizesArrY`. Multi-pass: first pass uses
 * larger sizes (will leave gaps), subsequent passes use smaller sizes to fill
 * gaps. Result is non-uniform grid layout with mix of large/medium/small
 * rectangles.
 *
 * Atlas use case
 * --------------
 * Fixes L6-6C wedge boundary regression: when SaaS metrics text "$100M ARR /
 * 92% margin / $50 CAC / $5000 LTV / Magic Number 1.8 / top 5%" arrives,
 * Sprint 3 emitted 8 identical rounded_box (boring grid). With this idiom,
 * LLM can emit:
 *   pass 1: [3,4] × [2,3] → 1 large hero card for $100M ARR + 1 medium for 92%
 *   pass 2: [2,3] × [1,2] → 2 medium cards for $50/$5000
 *   pass 3: [1,2] × [1,1] → 4 small cards for Magic Number / top 5% / etc.
 * Result: visually hierarchical KPI dashboard (matches Gamma/Notion infographic
 * aesthetic), vs 8 identical boxes.
 *
 * Signature
 * ---------
 *   irregularGridPack(gridDivsX, gridDivsY, passes) → Array<{x, y, w, h}>
 *
 *   passes = [
 *     { sizesArrX: [3,4], sizesArrY: [2,3] },   // pass 1: big
 *     { sizesArrX: [2,3], sizesArrY: [1,2] },   // pass 2: medium
 *     { sizesArrX: [1,2], sizesArrY: [1,1] },   // pass 3: small
 *   ]
 *
 * Returns array of {x, y, w, h} in GRID UNITS (caller scales to pixel canvas).
 *
 * Inside-an-iframe usage (LLM-generated sketch):
 *   const rects = irregularGridPack(8, 6, [
 *     { sizesArrX: [3, 4], sizesArrY: [2, 3] },
 *     { sizesArrX: [2, 3], sizesArrY: [1, 2] },
 *     { sizesArrX: [1, 2], sizesArrY: [1, 1] },
 *   ]);
 *   const cellW = 600 / 8, cellH = 360 / 6;
 *   for (const r of rects) {
 *     fill(...); noStroke();
 *     rect(r.x * cellW, r.y * cellH, r.w * cellW, r.h * cellH, 8);
 *   }
 *
 * Test: scripts/test-p5-idiom-irregular-grid.mjs (pure JS Node)
 */

function irregularGridPack(gridDivsX, gridDivsY, passes = []) {
  // Boolean grid: 1 = free, 0 = occupied
  const bools = [];
  for (let x = 0; x < gridDivsX; x++) {
    bools.push(new Array(gridDivsY).fill(1));
  }

  const rectInfo = [];

  function tryPlace(x, y, w, h) {
    if (x + w > gridDivsX || y + h > gridDivsY) return false;
    for (let xc = x; xc < x + w; xc++) {
      for (let yc = y; yc < y + h; yc++) {
        if (bools[xc][yc] === 0) return false;
      }
    }
    return true;
  }
  function occupy(x, y, w, h) {
    for (let xc = x; xc < x + w; xc++) {
      for (let yc = y; yc < y + h; yc++) {
        bools[xc][yc] = 0;
      }
    }
  }

  for (const pass of passes) {
    const sizesArrX = pass.sizesArrX || [1];
    const sizesArrY = pass.sizesArrY || [1];
    const maxSizeX = Math.max(...sizesArrX);
    const maxSizeY = Math.max(...sizesArrY);

    for (let x = 0; x <= gridDivsX - 1; x++) {
      for (let y = 0; y <= gridDivsY - 1; y++) {
        // Try a random size from this pass's options
        const xdim = sizesArrX[Math.floor(Math.random() * sizesArrX.length)];
        const ydim = sizesArrY[Math.floor(Math.random() * sizesArrY.length)];
        if (tryPlace(x, y, xdim, ydim)) {
          occupy(x, y, xdim, ydim);
          rectInfo.push({ x, y, w: xdim, h: ydim });
        }
      }
    }
  }

  return rectInfo;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { irregularGridPack };
}
if (typeof window !== 'undefined') {
  window.irregularGridPack = irregularGridPack;
}
