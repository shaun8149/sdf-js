/* global fill, noStroke, stroke, strokeWeight, rect, line */
/**
 * Apparatus Generator (cellular-automaton-style block grid composition)
 *
 * Source: Kjetil Midtgarden Golid (kgolid) —
 *   https://github.com/kgolid/apparatus-generator (canonical npm-style, MIT)
 *   https://github.com/kgolid/p5ycho (apparat / apparat2 / apparat3 / apparat4 — 4 evolution stages)
 *   https://github.com/kgolid/apparatus-assembly (Transformers-like assembly demo)
 * Atlas adaptation: 2026-06-20 — recipe-only port, self-contained version for
 *   Atlas Present iframe sandbox. Strips simplex-noise animation feature
 *   (Atlas iframe uses noLoop() static frames, no cross-frame continuity needed).
 *
 * NOTE: Atlas engine already has a full apparatus port at sdf-js/src/ca/ca.js
 *   that adds SDF-region generalization (replace hardcoded ellipse with any
 *   SDF predicate via fromSdf2 helper). This iframe-side idiom file is the
 *   STANDALONE inline-able variant for LLM-generated p5-sketches that can't
 *   import the engine module. Both implement the same 9-block state machine.
 *
 * What it does
 * ------------
 * Procedurally generates a grid composition resembling "robot anatomy" /
 * Mondrian-on-acid / blueprint of a fictional machine. The algorithm:
 *   1. Walk the grid top-left to bottom-right
 *   2. For each cell, dispatch on the state of (left neighbor, top neighbor)
 *      to one of 9 "block sets" — decides whether to extend existing room,
 *      start new room, leave blank
 *   3. Apply ellipse boundary mask (radius_x × radius_y) so the composition
 *      stays organic, not corner-to-corner
 *   4. Color rooms via one of 4 modes (random / main / group / default)
 *
 * Output: 2D grid where each cell = {h, v, in, col, id}. h/v = whether to
 * draw horizontal/vertical edge; in = whether cell is inside a room;
 * col = room color; id = stable room identifier.
 *
 * Atlas use case
 * --------------
 * Decorative compositional layout for visuals where the content is itself
 * COMPOSITIONAL (team org charts, scheduled blocks, multi-tier dashboards
 * with implicit grouping). The apparat aesthetic = "engineered organic" —
 * blueprint of a system. Use when content text implies:
 *   - Teams / departments / units composed into an org
 *   - Steps / phases / pipelines with shared structure
 *   - Components / modules / parts of a system
 *
 * Pairs with:
 *   - kgolid-chromotome-palettes (apparat looks great with multi-color palettes)
 *   - moussa-hooke-brush-stroke (hand-drawn arrows between rooms)
 *
 * Signature
 * ---------
 *   generateApparatusGrid(opts) → 2D grid array
 *
 *   opts = {
 *     xdim: 24, ydim: 18,          — grid resolution
 *     radius_x: 12, radius_y: 9,    — ellipse boundary (organic mask)
 *     initiate_chance: 0.8,         — start new room when active
 *     extension_chance: 0.8,        — extend existing room
 *     solidness: 0.5,               — fill blank cell when active
 *     vertical_chance: 0.5,
 *     horizontal_symmetry: true,
 *     vertical_symmetry: false,
 *     roundness: 0.1,               — 0 = soft ellipse fuzz, 1 = hard
 *     colors: ['#ec5526', '#f4ac12', '#9ebbc1', '#f7f4e2'],
 *     color_mode: 'group',          — 'random' | 'main' | 'group' | else=main
 *     group_size: 0.8,              — group-mode color clumping
 *     simple: false,                — true = skip ellipse mask (full grid)
 *   }
 *
 *   drawApparatusGrid(grid, opts) — convenience drawer using P5 fill/line/rect.
 *     Caller must pass P5 functions or use inside iframe where they're global.
 *     Returns nothing — draws directly to current canvas.
 *
 * Inside-iframe usage:
 *   const grid = generateApparatusGrid({
 *     xdim: 30, ydim: 20, radius_x: 14, radius_y: 9,
 *     colors: ['#ec5526', '#f4ac12', '#9ebbc1', '#f7f4e2'],
 *   });
 *   const cellSize = 18;
 *   const offsetX = (600 - 30 * cellSize) / 2, offsetY = 30;
 *   for (let y = 0; y < grid.length; y++) {
 *     for (let x = 0; x < grid[y].length; x++) {
 *       const c = grid[y][x];
 *       if (c.in && c.col) {
 *         fill(c.col); noStroke();
 *         rect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
 *       }
 *       stroke('#000'); strokeWeight(1);
 *       if (c.h) line(offsetX + x * cellSize, offsetY + y * cellSize,
 *                     offsetX + (x + 1) * cellSize, offsetY + y * cellSize);
 *       if (c.v) line(offsetX + x * cellSize, offsetY + y * cellSize,
 *                     offsetX + x * cellSize, offsetY + (y + 1) * cellSize);
 *     }
 *   }
 *
 * Test: scripts/test-p5-idiom-registry.mjs
 */

const _DEFAULT_OPTS = {
  xdim: 24,
  ydim: 18,
  radius_x: 12,
  radius_y: 9,
  initiate_chance: 0.8,
  extension_chance: 0.8,
  vertical_chance: 0.5,
  horizontal_symmetry: true,
  vertical_symmetry: false,
  roundness: 0.1,
  solidness: 0.5,
  colors: ['#8ec07c', '#fabd2f', '#fb472c', '#d38693', '#314550'],
  color_mode: 'group',
  group_size: 0.8,
  simple: false,
};

const _blankCell = () => ({ h: false, v: false, in: false, col: null, id: null });

function _deepCopy(cell) {
  return { h: cell.h, v: cell.v, in: cell.in, col: cell.col, id: cell.id };
}

function _getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateApparatusGrid(userOpts = {}) {
  const opts = { ..._DEFAULT_OPTS, ...userOpts };
  const ctx = {
    ...opts,
    main_color: _getRandom(opts.colors),
    id_counter: 0,
  };

  const grid = new Array(opts.ydim + 1);
  for (let y = 0; y < grid.length; y++) {
    grid[y] = new Array(opts.xdim + 1);
    for (let x = 0; x < grid[y].length; x++) {
      if (y === 0 || x === 0) {
        grid[y][x] = _blankCell();
      } else if (opts.horizontal_symmetry && x > grid[y].length / 2) {
        // Mirror horizontally — copy from left half, adjust v-edge offset
        const m = grid[y][grid[y].length - x];
        const mv = grid[y][grid[y].length - x + 1];
        grid[y][x] = _deepCopy(m);
        if (mv) grid[y][x].v = mv.v;
      } else if (opts.vertical_symmetry && y > grid.length / 2) {
        const m = grid[grid.length - y][x];
        const mh = grid[grid.length - y + 1] ? grid[grid.length - y + 1][x] : m;
        grid[y][x] = _deepCopy(m);
        grid[y][x].h = mh.h;
      } else {
        grid[y][x] = _nextBlock(x, y, grid[y][x - 1], grid[y - 1][x], ctx);
      }
    }
  }
  return grid;
}

function _nextBlock(x, y, left, top, ctx) {
  // 9-block state machine — dispatch on (left.in, top.in, left.h, top.v)
  const newBlock = () => _newBlock(x, y, left, top, ctx);

  if (!left.in && !top.in) {
    // case 1
    if (_startNewFromBlank(x, y, ctx)) return newBlock();
    return _blankCell();
  }
  if (left.in && !top.in) {
    if (left.h) {
      // case 3
      if (_extend(x, y, ctx)) return { h: true, v: false, in: true, col: left.col, id: left.id };
    }
    // case 2 or fallthrough from 3
    if (_startNewFromBlank(x, y, ctx)) return newBlock();
    return { h: false, v: true, in: false, col: null, id: null };
  }
  if (!left.in && top.in) {
    if (top.v) {
      // case 5
      if (_extend(x, y, ctx)) return { h: false, v: true, in: true, col: top.col, id: top.id };
    }
    // case 4 or fallthrough
    if (_startNewFromBlank(x, y, ctx)) return newBlock();
    return { h: true, v: false, in: false, col: null, id: null };
  }
  // both left.in and top.in
  if (!left.h && !top.v) {
    // case 6 — interior of an existing room
    return { h: false, v: false, in: true, col: left.col, id: left.id };
  }
  if (left.h && !top.v) {
    // case 7
    if (_extend(x, y, ctx)) return { h: true, v: false, in: true, col: left.col, id: left.id };
    if (_startNew(x, y, ctx)) return newBlock();
    return { h: true, v: true, in: false, col: null, id: null };
  }
  if (!left.h && top.v) {
    // case 8
    if (_extend(x, y, ctx)) return { h: false, v: true, in: true, col: top.col, id: top.id };
    if (_startNew(x, y, ctx)) return newBlock();
    return { h: true, v: true, in: false, col: null, id: null };
  }
  // case 9 — both directions
  if (Math.random() <= ctx.vertical_chance)
    return { h: false, v: true, in: true, col: top.col, id: top.id };
  return { h: true, v: false, in: true, col: left.col, id: left.id };
}

function _newBlock(x, y, left, top, ctx) {
  let col;
  if (ctx.color_mode === 'random') {
    col = _getRandom(ctx.colors);
  } else if (ctx.color_mode === 'main') {
    col = Math.random() > 0.75 ? _getRandom(ctx.colors) : ctx.main_color;
  } else if (ctx.color_mode === 'group') {
    const keep = Math.random() > 0.5 ? left.col : top.col;
    ctx.main_color =
      Math.random() > ctx.group_size ? _getRandom(ctx.colors) : keep || ctx.main_color;
    col = ctx.main_color;
  } else {
    col = ctx.main_color;
  }
  return { h: true, v: true, in: true, col, id: ctx.id_counter++ };
}

function _startNewFromBlank(x, y, ctx) {
  if (ctx.simple) return true;
  if (!_activePosition(x, y, -1 * (1 - ctx.roundness), ctx)) return false;
  return Math.random() <= ctx.solidness;
}
function _startNew(x, y, ctx) {
  if (ctx.simple) return true;
  if (!_activePosition(x, y, 0, ctx)) return false;
  return Math.random() <= ctx.initiate_chance;
}
function _extend(x, y, ctx) {
  if (!_activePosition(x, y, 1 - ctx.roundness, ctx) && !ctx.simple) return false;
  return Math.random() <= ctx.extension_chance;
}

function _activePosition(x, y, fuzzy, ctx) {
  // Ellipse boundary mask: (x/radius_x)^2 + (y/radius_y)^2 < 1, with fuzzy edge
  const fuzziness = 1 + Math.random() * fuzzy;
  const dx = (x - ctx.xdim / 2) / (ctx.radius_x * fuzziness);
  const dy = (y - ctx.ydim / 2) / (ctx.radius_y * fuzziness);
  return dx * dx + dy * dy < 1;
}

/**
 * Convenience drawer — caller provides P5 drawing functions (or uses inside iframe
 * where they're global). Draws filled rooms + edges to current canvas.
 *
 * @param {Array} grid — output from generateApparatusGrid
 * @param {object} drawOpts — {cellSize, offsetX, offsetY, strokeColor, strokeWeight}
 * @param {object} p — optional P5 instance (default: assume globals available in iframe)
 */
function drawApparatusGrid(grid, drawOpts = {}, p = null) {
  const cellSize = drawOpts.cellSize ?? 16;
  const offsetX = drawOpts.offsetX ?? 0;
  const offsetY = drawOpts.offsetY ?? 0;
  const strokeColor = drawOpts.strokeColor ?? '#000';
  const sw = drawOpts.strokeWeight ?? 1;
  // Resolve P5 functions: either from `p` instance or from global scope (iframe sandbox)
  const _fill = p?.fill || (typeof fill !== 'undefined' ? fill : null);
  const _noStroke = p?.noStroke || (typeof noStroke !== 'undefined' ? noStroke : null);
  const _stroke = p?.stroke || (typeof stroke !== 'undefined' ? stroke : null);
  const _strokeWeight =
    p?.strokeWeight || (typeof strokeWeight !== 'undefined' ? strokeWeight : null);
  const _rect = p?.rect || (typeof rect !== 'undefined' ? rect : null);
  const _line = p?.line || (typeof line !== 'undefined' ? line : null);

  if (!_rect || !_line) return; // No P5, no draw

  // First pass: filled rooms (no stroke)
  _noStroke && _noStroke();
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c.in && c.col) {
        _fill && _fill(c.col);
        _rect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
      }
    }
  }
  // Second pass: edges
  _stroke && _stroke(strokeColor);
  _strokeWeight && _strokeWeight(sw);
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c.h) {
        _line(
          offsetX + x * cellSize,
          offsetY + y * cellSize,
          offsetX + (x + 1) * cellSize,
          offsetY + y * cellSize,
        );
      }
      if (c.v) {
        _line(
          offsetX + x * cellSize,
          offsetY + y * cellSize,
          offsetX + x * cellSize,
          offsetY + (y + 1) * cellSize,
        );
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateApparatusGrid, drawApparatusGrid };
}
if (typeof window !== 'undefined') {
  window.generateApparatusGrid = generateApparatusGrid;
  window.drawApparatusGrid = drawApparatusGrid;
}
