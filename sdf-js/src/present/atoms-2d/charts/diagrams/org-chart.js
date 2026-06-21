// =============================================================================
// atoms-2d/charts/diagrams/org-chart.js — Organizational hierarchy
// -----------------------------------------------------------------------------
// 8th atom in 2D vector library (Phase 2b).
//
// Semantic: top-down org chart with named boxes connected by orthogonal
// (elbow) lines. Sibling of tree-diagram but specifically for organizations:
// boxier nodes, name + title sublabel, orthogonal connectors (not curved).
//
// Args:
//   root  — nested object { name, title?, sublabel?, children?: [{ name, title?, ... }] }
//   title — optional chart title
//   accent — optional accent color override (rgb tuple)
//
// Render: pseudo-3D
//   - Each node: rectangular card with gradient + drop shadow
//   - Name (Inter 700) top + title (Inter 500 faded) below
//   - Orthogonal "elbow" connectors (90° corners, not curved)
//   - Root node has accent fill
//
// Per [[atlas-sprint14-finance-preset-plan]] — diagram family.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { computeTreeLayout } from './_tree-layout.js';

export const spec = {
  type: 'org-chart',
  category: 'charts/diagrams',
  description:
    'Organizational hierarchy chart. Rectangular boxes with name + title, orthogonal connectors.',
  args: {
    root: {
      type: 'object { name, title?, sublabel?, children?: [...] }',
      required: true,
      example: {
        name: 'Sarah Chen',
        title: 'CEO',
        children: [
          {
            name: 'Mike Park',
            title: 'CTO',
            children: [{ name: 'Alex Wu', title: 'Eng Manager' }],
          },
          { name: 'Lisa Wang', title: 'CMO' },
          { name: 'David Liu', title: 'CFO' },
        ],
      },
    },
    title: { type: 'string?', example: 'Executive Team' },
  },
};

const PAD = 14;
const TITLE_FRAC = 0.1;
const NODE_HEIGHT = 56;

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
    minNodeWidth: 110,
    maxNodeWidth: 160,
  });
  if (layout.length === 0) return;

  // Connectors first
  for (const entry of layout) {
    if (entry.parentX == null) continue;
    drawOrthogonalConnector(
      ctx,
      entry.parentX,
      entry.parentY + NODE_HEIGHT / 2,
      entry.x,
      entry.y - NODE_HEIGHT / 2,
      fg,
    );
  }

  // Nodes
  for (const entry of layout) {
    const isRoot = entry.depth === 0;
    drawNode(ctx, entry.x, entry.y, entry.nodeWidth, NODE_HEIGHT, entry.node, isRoot, {
      fg,
      bg,
      accent,
    });
  }
}

function drawOrthogonalConnector(ctx, x0, y0, x1, y1, color) {
  ctx.save();
  ctx.strokeStyle = rgbaCss(color, 0.35);
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  const midY = (y0 + y1) / 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, midY);
  ctx.lineTo(x1, midY);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

function drawNode(ctx, cx, cy, w, h, nodeData, isRoot, colorCtx) {
  const { fg, bg, accent } = colorCtx;
  const nx = cx - w / 2;
  const ny = cy - h / 2;
  const radius = 6;

  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  const gradient = ctx.createLinearGradient(nx, ny, nx, ny + h);
  if (isRoot) {
    gradient.addColorStop(0, rgbCss(lighten(accent, 0.12)));
    gradient.addColorStop(1, rgbCss(accent));
  } else {
    gradient.addColorStop(0, rgbCss(bg));
    gradient.addColorStop(1, rgbCss(darken(bg, 0.05)));
  }
  ctx.fillStyle = gradient;
  roundedRectPath(ctx, nx, ny, w, h, radius);
  ctx.fill();
  ctx.restore();

  // Border for non-root
  if (!isRoot) {
    ctx.strokeStyle = rgbaCss(fg, 0.2);
    ctx.lineWidth = 1;
    roundedRectPath(ctx, nx, ny, w, h, radius);
    ctx.stroke();
  }

  // Name (top)
  const name = nodeData.name ?? nodeData.label ?? '';
  ctx.fillStyle = isRoot ? rgbCss(bg) : rgbCss(fg);
  ctx.font = `700 ${Math.min(14, h * 0.25)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(name), cx, ny + h * 0.36);

  // Title (below)
  if (nodeData.title) {
    ctx.fillStyle = isRoot ? rgbaCss(bg, 0.78) : rgbaCss(fg, 0.6);
    ctx.font = `500 ${Math.min(11, h * 0.2)}px Inter, system-ui, sans-serif`;
    ctx.fillText(String(nodeData.title), cx, ny + h * 0.66);
  }
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
