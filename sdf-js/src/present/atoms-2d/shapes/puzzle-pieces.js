// =============================================================================
// atoms-2d/shapes/puzzle-pieces.js — Interlocking puzzle pieces
// -----------------------------------------------------------------------------
// 19th atom in 2D vector library.
//
// Semantic: 2-N jigsaw puzzle pieces arranged in a grid, fitting together.
// Generic integration / collaboration / "fitting together" metaphor used
// across countless products since jigsaw puzzles (1760s John Spilsbury).
//
// Args:
//   rows       — integer 1-4 (default 2)
//   cols       — integer 1-4 (default 2)
//   colors     — array [r,g,b][]; cycled per piece (default: 1 accent + grey rest)
//   highlight  — integer (index of piece to render in accent), default null
//   title      — optional title
//
// Render technique (generic):
//   - Each piece: rectangle base + tabs/blanks on each edge (jigsaw protocol)
//   - Pseudo-3D thickness: piece offset shadow + side wall band
//   - Gradient face shading
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'puzzle-pieces',
  category: 'shapes',
  description: 'Interlocking jigsaw puzzle pieces. Generic integration / collaboration metaphor.',
  args: {
    rows: { type: 'integer 1-4', default: 2, example: 2 },
    cols: { type: 'integer 1-4', default: 2, example: 2 },
    colors: {
      type: '[r,g,b][]?',
      example: [
        [60, 130, 200],
        [200, 200, 205],
      ],
    },
    highlight: { type: 'integer?', example: 1 },
    title: { type: 'string?', example: 'Integration' },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 400;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = args.colors ||
    palette.colors || [
      [200, 200, 205],
      [60, 130, 200],
    ];
  const rows = clamp(Number(args.rows ?? 2) | 0, 1, 4);
  const cols = clamp(Number(args.cols ?? 2) | 0, 1, 4);
  const highlight = typeof args.highlight === 'number' ? args.highlight : -1;
  const accent = palette.colors?.[0] || [60, 130, 200];

  const title = args.title;
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  const plotW = w - PAD * 2;
  const plotH = y + h - plotTop - PAD;

  // Piece size — fit the grid in the plot area with breathing room
  const cellW = Math.min(plotW / cols, plotH / rows) * 0.85;
  const cellH = cellW;
  const tabSize = cellW * 0.18; // tab/blank extent
  const gridW = cols * cellW;
  const gridH = rows * cellH;
  const ox = x + (w - gridW) / 2;
  const oy = plotTop + (plotH - gridH) / 2;

  // Pre-compute edge "kinds" so adjacent pieces interlock (tab on one side = blank on the other)
  // For each piece (r, c), edges: top, right, bottom, left.
  // Convention: pos = tab, neg = blank, 0 = flat.
  // Top edge of (r, c) matches bottom edge of (r-1, c) (opposite sign).
  const edges = makeEdges(rows, cols);
  const depth = tabSize * 0.45; // pseudo-3D thickness

  // Draw back-to-front (top rows first so bottom rows overlap shadows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const pieceX = ox + c * cellW;
      const pieceY = oy + r * cellH;
      let color = baseColors[idx % baseColors.length];
      if (idx === highlight) color = accent;
      drawPiece(ctx, pieceX, pieceY, cellW, cellH, tabSize, edges[r][c], color, depth);
    }
  }
}

// ============================================================================
// Edge generation: build per-piece (top, right, bottom, left) edge signs
// such that adjacent pieces interlock.
// ============================================================================

function makeEdges(rows, cols) {
  // Horizontal edges between (r,c) and (r,c+1): sign random ±1
  // Vertical edges between (r,c) and (r+1,c): sign random ±1
  // Outer boundary edges = 0 (flat)
  //
  // Edges array: edges[r][c] = { top, right, bottom, left }
  // We use a deterministic sign assignment based on (r,c) parity for repro.
  const edges = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const top = r === 0 ? 0 : -((r * 7 + c * 3) % 2 === 0 ? 1 : -1);
      // Top = opposite of bottom of (r-1, c)
      const bottom = r === rows - 1 ? 0 : (r * 7 + c * 3) % 2 === 0 ? 1 : -1;
      const left = c === 0 ? 0 : -((r * 5 + c * 11) % 2 === 0 ? 1 : -1);
      const right = c === cols - 1 ? 0 : (r * 5 + c * 11) % 2 === 0 ? 1 : -1;
      row.push({ top, right, bottom, left });
    }
    edges.push(row);
  }
  // Stitch boundaries to ensure top(r,c) === -bottom(r-1,c) and left(r,c) === -right(r,c-1)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r > 0) edges[r][c].top = -edges[r - 1][c].bottom;
      if (c > 0) edges[r][c].left = -edges[r][c - 1].right;
    }
  }
  return edges;
}

// ============================================================================
// Draw a single puzzle piece with pseudo-3D thickness
// ============================================================================

function drawPiece(ctx, x, y, w, h, tabSize, edge, color, depth) {
  // Step 1: drop shadow + extruded side wall (offset down-right)
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = depth * 1.4;
  ctx.shadowOffsetY = depth * 0.5;
  ctx.fillStyle = rgbCss(darken(color, 0.3));
  buildPiecePath(ctx, x, y + depth, w, h, tabSize, edge);
  ctx.fill();
  ctx.restore();

  // Step 2: front face with gradient
  ctx.save();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, rgbCss(lighten(color, 0.2)));
  grad.addColorStop(0.5, rgbCss(color));
  grad.addColorStop(1, rgbCss(darken(color, 0.08)));
  ctx.fillStyle = grad;
  buildPiecePath(ctx, x, y, w, h, tabSize, edge);
  ctx.fill();
  // Edge stroke
  ctx.strokeStyle = rgbaCss(darken(color, 0.42), 0.65);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();

  // Step 3: subtle highlight on top edge (suggests light from above)
  ctx.save();
  ctx.strokeStyle = rgbaCss([255, 255, 255], 0.28);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + tabSize * 0.5, y + 1);
  ctx.lineTo(x + w - tabSize * 0.5, y + 1);
  ctx.stroke();
  ctx.restore();
}

function buildPiecePath(ctx, x, y, w, h, tabSize, edge) {
  // Build path for piece body with tabs/blanks on each edge.
  // Each side has a center "knob" region (tab outward or blank inward).
  // Edge sign: +1 = tab outward, -1 = blank inward, 0 = flat
  const ts = tabSize;
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.beginPath();
  // Start at top-left corner
  ctx.moveTo(x, y);

  // TOP edge: left to right, with optional knob at center
  if (edge.top === 0) {
    ctx.lineTo(x + w, y);
  } else {
    const dir = edge.top; // +1 outward (up), -1 inward (down)
    ctx.lineTo(cx - ts, y);
    // Half-circle knob
    ctx.arc(cx, y, ts, Math.PI, 0, dir > 0); // outward = counterclockwise when y-down
    ctx.lineTo(x + w, y);
  }

  // RIGHT edge: top to bottom
  if (edge.right === 0) {
    ctx.lineTo(x + w, y + h);
  } else {
    const dir = edge.right;
    ctx.lineTo(x + w, cy - ts);
    ctx.arc(x + w, cy, ts, -Math.PI / 2, Math.PI / 2, dir < 0);
    ctx.lineTo(x + w, y + h);
  }

  // BOTTOM edge: right to left
  if (edge.bottom === 0) {
    ctx.lineTo(x, y + h);
  } else {
    const dir = edge.bottom;
    ctx.lineTo(cx + ts, y + h);
    ctx.arc(cx, y + h, ts, 0, Math.PI, dir < 0);
    ctx.lineTo(x, y + h);
  }

  // LEFT edge: bottom to top
  if (edge.left === 0) {
    ctx.lineTo(x, y);
  } else {
    const dir = edge.left;
    ctx.lineTo(x, cy + ts);
    ctx.arc(x, cy, ts, Math.PI / 2, -Math.PI / 2, dir > 0);
    ctx.lineTo(x, y);
  }

  ctx.closePath();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
