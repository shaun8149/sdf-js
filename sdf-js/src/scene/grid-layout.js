// =============================================================================
// grid-layout — Pure JS layout helper for composing multiple atoms (Sprint 1 atom 9/9)
// -----------------------------------------------------------------------------
// Returns an array of grid cell positions { x, y, z, row, col, index } given a
// grid spec (cols × rows + cell size + spacing). Caller maps positions to
// atoms (translate each atom to its cell center) then unions them, OR creates
// SceneData subjects with these positions.
//
// NOT an SDF primitive: no GLSL helper, no PRIMS entry, no spec.js / compile.js
// factory wiring. Pure layout utility — composes atoms, doesn't produce SDF
// itself.
//
// Use cases:
//   - KPI dashboard: 2×2 or 3×2 grid of kpi-card-3d atoms
//   - Icon grid: 3×3 grid of business-icon atoms (one per name)
//   - Chart strip: 1×N row of pie-3d atoms (regional comparison)
//   - Org chart row: 1×4 horizontal of person icons
//
// Grid is centered on `origin` by default (4 cells: 2 left + 2 right around X=0).
// rowDirection = 'down' (default, presentation convention) puts row 0 at TOP.
// rowDirection = 'up' puts row 0 at BOTTOM.
//
// Author: Atlas (2026-06-18)
// License: PolyForm Noncommercial 1.0.0
// =============================================================================

/**
 * Compute grid cell positions.
 *
 * @param {object} opts
 * @param {number} [opts.cols=2]
 * @param {number} [opts.rows=2]
 * @param {number} [opts.cellWidth=2.0]
 * @param {number} [opts.cellHeight=1.5]
 * @param {number} [opts.spacing=0.3]                 X+Y gap between cells
 * @param {[number,number,number]} [opts.origin=[0,0,0]]  Grid center
 * @param {'down'|'up'} [opts.rowDirection='down']    row 0 at top ('down') or bottom ('up')
 * @returns {Array<{x:number, y:number, z:number, row:number, col:number, index:number}>}
 */
export function gridLayout({
  cols = 2,
  rows = 2,
  cellWidth = 2.0,
  cellHeight = 1.5,
  spacing = 0.3,
  origin = [0, 0, 0],
  rowDirection = 'down',
} = {}) {
  const positions = [];
  if (cols <= 0 || rows <= 0) return positions;

  const stepX = cellWidth + spacing;
  const stepY = cellHeight + spacing;
  const totalW = cols * cellWidth + (cols - 1) * spacing;
  const totalH = rows * cellHeight + (rows - 1) * spacing;
  const xStart = origin[0] - totalW / 2 + cellWidth / 2;
  const yStart =
    rowDirection === 'down'
      ? origin[1] + totalH / 2 - cellHeight / 2 // row 0 at top
      : origin[1] - totalH / 2 + cellHeight / 2; // row 0 at bottom
  const yStep = rowDirection === 'down' ? -stepY : stepY;

  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positions.push({
        x: xStart + col * stepX,
        y: yStart + row * yStep,
        z: origin[2],
        row,
        col,
        index: index++,
      });
    }
  }
  return positions;
}
