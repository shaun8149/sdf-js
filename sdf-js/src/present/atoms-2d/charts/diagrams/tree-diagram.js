// =============================================================================
// atoms-2d/charts/diagrams/tree-diagram.js — Generic hierarchical tree
// -----------------------------------------------------------------------------
// 7th atom in 2D vector library (Phase 2b).
//
// Semantic: top-down hierarchical tree with rounded card nodes connected by
// curved lines. Use for: decision trees, category taxonomies, file systems,
// feature decompositions.
//
// (org-chart is sibling atom with same data shape but boxier style + name/title.)
//
// Args:
//   root  — nested object { label, children?: [{ label, children?, ... }] }
//   title — optional chart title
//
// Render: pseudo-3D (drawPseudo3D)
//   - Each node: rounded card with gradient + drop shadow (same pattern as
//     kpi-card / flow-chart node)
//   - Connector: bezier curve from parent bottom to child top
//   - Root node: emphasized with accent color fill
//
// Per [[atlas-sprint14-finance-preset-plan]] — diagram family.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { computeTreeLayout } from './_tree-layout.js';

export const spec = {
  type: 'tree-diagram',
  category: 'charts/diagrams',
  description: 'Generic hierarchical tree (decision tree / taxonomy / decomposition).',
  args: {
    root: {
      type: 'object { label, children?: [...] }',
      required: true,
      example: {
        label: 'Product',
        children: [
          { label: 'Engineering', children: [{ label: 'Backend' }, { label: 'Frontend' }] },
          { label: 'Design' },
          { label: 'Marketing' },
        ],
      },
    },
    title: { type: 'string?', example: 'Org Tree' },
  },
};

const PAD = 14;
const TITLE_FRAC = 0.1;
const NODE_HEIGHT = 36;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 600;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const accent = palette.colors?.[0] || [60, 100, 200];

  const root = args.root;
  const title = args.title;
  if (!root || typeof root !== 'object') return;

  let layoutTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    layoutTop = y + h * TITLE_FRAC + PAD;
  }

  const layout = computeTreeLayout(root, {
    x: x + PAD,
    y: layoutTop,
    w: w - PAD * 2,
    h: y + h - layoutTop - PAD,
    minNodeWidth: 80,
    maxNodeWidth: 140,
  });
  if (layout.length === 0) return;

  // ---- Draw connectors first (so they sit under nodes) ----
  for (const entry of layout) {
    if (entry.parentX == null) continue;
    drawConnector(
      ctx,
      entry.parentX,
      entry.parentY + NODE_HEIGHT / 2,
      entry.x,
      entry.y - NODE_HEIGHT / 2,
      accent,
    );
  }

  // ---- Draw nodes ----
  for (const entry of layout) {
    const isRoot = entry.depth === 0;
    drawNode(ctx, entry.x, entry.y, entry.nodeWidth, NODE_HEIGHT, entry.node.label, isRoot, {
      fg,
      bg,
      accent,
    });
  }
}

function drawConnector(ctx, x0, y0, x1, y1, color) {
  ctx.save();
  ctx.strokeStyle = rgbaCss(color, 0.55);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  // Smooth S-curve: control points midway with vertical bias
  const midY = (y0 + y1) / 2;
  ctx.bezierCurveTo(x0, midY, x1, midY, x1, y1);
  ctx.stroke();
  ctx.restore();
}

function drawNode(ctx, cx, cy, w, h, label, isRoot, colorCtx) {
  const { fg, bg, accent } = colorCtx;
  const nx = cx - w / 2;
  const ny = cy - h / 2;
  const radius = h / 2; // pill-shaped

  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.15);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  const gradient = ctx.createLinearGradient(nx, ny, nx, ny + h);
  if (isRoot) {
    gradient.addColorStop(0, rgbCss(lighten(accent, 0.12)));
    gradient.addColorStop(1, rgbCss(accent));
  } else {
    gradient.addColorStop(0, rgbCss(bg));
    gradient.addColorStop(1, rgbCss(darken(bg, 0.06)));
  }
  ctx.fillStyle = gradient;
  roundedRectPath(ctx, nx, ny, w, h, radius);
  ctx.fill();
  ctx.restore();

  // Border for non-root (light separator from bg)
  if (!isRoot) {
    ctx.strokeStyle = rgbaCss(fg, 0.18);
    ctx.lineWidth = 1;
    roundedRectPath(ctx, nx, ny, w, h, radius);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = isRoot ? rgbCss(bg) : rgbCss(fg);
  ctx.font = `${isRoot ? 700 : 500} ${Math.min(13, h * 0.4)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label), cx, cy + 1);
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
