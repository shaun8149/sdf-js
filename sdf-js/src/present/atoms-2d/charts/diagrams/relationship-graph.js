// =============================================================================
// atoms-2d/charts/diagrams/relationship-graph.js — Network of related entities
// -----------------------------------------------------------------------------
// 10th atom in 2D vector library (Phase 2c).
//
// Semantic: arbitrary graph (nodes + edges) showing relationships between
// entities. Unlike tree/mindmap, edges can be many-to-many, no hierarchy.
//
// Layout: circular default (nodes evenly spaced around circle). LLM can
// optionally provide explicit x,y per node for custom layouts.
//
// Args:
//   nodes — array of { id, label, group?, size? }
//   edges — array of { from, to, label?, weight? }
//   title — optional chart title
//
// Render: pseudo-3D
//   - Each node: radial-gradient circle with drop shadow
//   - Color by group (palette.colors[group])
//   - Size scales with `size` arg (or weight = node degree if not provided)
//   - Edges: lines connecting nodes (weight = stroke width)
//   - Optional edge labels (small text above midpoint)
//
// Per [[atlas-sprint14-finance-preset-plan]] — diagram family.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'relationship-graph',
  category: 'charts/diagrams',
  description:
    'Network of related entities (nodes + edges). Many-to-many connections, no hierarchy assumed.',
  args: {
    nodes: {
      type: 'array of { id, label, group?, size? }',
      required: true,
      example: [
        { id: 'a', label: 'Team A', group: 0 },
        { id: 'b', label: 'Team B', group: 0 },
        { id: 'c', label: 'Tool X', group: 1 },
      ],
    },
    edges: {
      type: 'array of { from, to, label?, weight? }',
      required: true,
      example: [
        { from: 'a', to: 'c', label: 'uses' },
        { from: 'b', to: 'c', label: 'uses' },
      ],
    },
    title: { type: 'string?', example: 'Team Dependencies' },
  },
};

const PAD = 14;
const TITLE_FRAC = 0.1;
const NODE_RADIUS = 22;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 600;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [60, 100, 200];
  const groupColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
  ];

  const nodes = Array.isArray(args.nodes) ? args.nodes : [];
  const edges = Array.isArray(args.edges) ? args.edges : [];
  const title = args.title;
  if (nodes.length === 0) return;

  let plotTop = y;
  if (title) {
    const titleSize = Math.round(h * 0.06);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  // Layout: circular by default; nodes with explicit x/y override
  const cx = x + w / 2;
  const cy = plotTop + (y + h - plotTop) / 2;
  const radius = Math.min(w, y + h - plotTop) / 2 - NODE_RADIUS - 24;
  const positions = {};
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (typeof n.x === 'number' && typeof n.y === 'number') {
      positions[n.id] = { x: n.x, y: n.y, node: n };
    } else {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      positions[n.id] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        node: n,
      };
    }
  }

  // Draw edges first (under nodes)
  for (const e of edges) {
    const a = positions[e.from];
    const b = positions[e.to];
    if (!a || !b) continue;
    const weight = e.weight || 1;
    drawEdge(ctx, a.x, a.y, b.x, b.y, fg, weight, e.label);
  }

  // Draw nodes (on top)
  for (const id in positions) {
    const p = positions[id];
    const group = typeof p.node.group === 'number' ? p.node.group : 0;
    const color = groupColors[group % groupColors.length];
    const r = p.node.size ? Math.max(12, Math.min(36, p.node.size * NODE_RADIUS)) : NODE_RADIUS;
    drawNode(ctx, p.x, p.y, r, p.node.label || p.node.id, color, fg);
  }
}

function drawEdge(ctx, x0, y0, x1, y1, color, weight, label) {
  ctx.save();
  ctx.strokeStyle = rgbaCss(color, 0.35);
  ctx.lineWidth = Math.max(1, Math.min(4, weight));
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();

  if (label) {
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    ctx.fillStyle = rgbaCss(color, 0.7);
    ctx.font = '500 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), mx, my - 6);
  }
}

function drawNode(ctx, cx, cy, radius, label, color, fg) {
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  const grad = ctx.createRadialGradient(
    cx - radius * 0.3,
    cy - radius * 0.3,
    radius * 0.1,
    cx,
    cy,
    radius,
  );
  grad.addColorStop(0, rgbCss(lighten(color, 0.2)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,1)';
  const fontSize = Math.max(10, Math.min(13, radius * 0.55));
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = String(label);
  const maxChars = Math.max(6, Math.floor(radius / 4));
  const display = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
  ctx.fillText(display, cx, cy + 1);
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
