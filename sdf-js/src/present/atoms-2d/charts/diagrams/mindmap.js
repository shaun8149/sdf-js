// =============================================================================
// atoms-2d/charts/diagrams/mindmap.js — Radial mindmap
// -----------------------------------------------------------------------------
// 9th atom in 2D vector library (Phase 2c).
//
// Semantic: radial tree with central concept + branches radiating outward.
// Same data shape as tree-diagram but layout = radial (root at center,
// children on first ring, grandchildren on second ring, etc.)
//
// Use cases: brainstorming, concept maps, taxonomy explorers, knowledge graphs.
//
// Args:
//   root  — nested object { label, children?: [{ label, children?, ... }] }
//   title — optional chart title (top-left)
//
// Render: pseudo-3D
//   - Root: large filled circle with accent gradient + drop shadow + label inside
//   - Branch nodes: smaller circles with palette-cycled colors
//   - Connector: curved line from parent to child (arc-like)
//   - Labels: positioned around each node, oriented for readability
//
// Per [[atlas-sprint14-finance-preset-plan]] — diagram family.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'mindmap',
  category: 'charts/diagrams',
  description: 'Radial mindmap with central concept + branches radiating outward.',
  args: {
    root: {
      type: 'object { label, children?: [...] }',
      required: true,
      example: {
        label: 'Atlas',
        children: [
          { label: 'Engine', children: [{ label: 'SDF' }, { label: 'Renderer' }] },
          { label: 'Present', children: [{ label: 'Atoms' }, { label: 'Pipeline' }] },
          { label: 'Compositor' },
        ],
      },
    },
    title: { type: 'string?', example: 'Atlas Architecture' },
  },
};

const PAD = 14;
const TITLE_FRAC = 0.1;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 600;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const accent = palette.colors?.[0] || [60, 100, 200];
  const branchColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
    [120, 120, 120],
  ];

  const root = args.root;
  const title = args.title;
  if (!root || typeof root !== 'object') return;

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

  // Layout: radial — root at center, children on first ring, etc. Sized to
  // use ~80% of the available radius (previously a conservative constant
  // margin left the whole cluster cramped into the center third of the
  // canvas).
  const cx = x + w / 2;
  const cy = plotTop + (y + h - plotTop) / 2;
  const availRadius = Math.min(w, y + h - plotTop) / 2;
  const maxRadius = availRadius * 0.8;

  // Node radii scale with the plot size but stay small — labels now render
  // OUTSIDE the circles (radially offset), so nodes are just position
  // markers, not label containers.
  const ROOT_RADIUS = clamp(maxRadius * 0.16, 26, 46);
  const BRANCH_RADIUS = clamp(maxRadius * 0.075, 10, 18);
  const LEAF_RADIUS = clamp(maxRadius * 0.05, 6, 12);

  const branches = Array.isArray(root.children) ? root.children : [];

  // First-ring positions
  const branchRing = maxRadius * 0.42;
  const leafRing = maxRadius * 0.86;
  const branchPositions = [];
  for (let i = 0; i < branches.length; i++) {
    const angle = (i / branches.length) * Math.PI * 2 - Math.PI / 2;
    branchPositions.push({
      x: cx + Math.cos(angle) * branchRing,
      y: cy + Math.sin(angle) * branchRing,
      angle,
      node: branches[i],
      color: branchColors[i % branchColors.length],
    });
  }

  // Draw branch→leaf connectors + leaf nodes (so they sit under branch nodes)
  for (const bp of branchPositions) {
    const leaves = Array.isArray(bp.node.children) ? bp.node.children : [];
    if (leaves.length === 0) continue;
    // Spread leaves across an arc around the branch angle
    const arcSpread = Math.min(Math.PI / 3, ((Math.PI * 2) / branches.length) * 0.7);
    for (let j = 0; j < leaves.length; j++) {
      const t = leaves.length === 1 ? 0 : j / (leaves.length - 1) - 0.5;
      const leafAngle = bp.angle + t * arcSpread;
      const lx = cx + Math.cos(leafAngle) * leafRing;
      const ly = cy + Math.sin(leafAngle) * leafRing;
      drawCurvedConnector(ctx, bp.x, bp.y, lx, ly, bp.color);
      drawNode(ctx, lx, ly, LEAF_RADIUS, bp.color);
      drawLabelOutside(ctx, lx, ly, leafAngle, LEAF_RADIUS, leaves[j].label || '', fg, 600, 12);
    }
  }

  // Root→branch connectors
  for (const bp of branchPositions) {
    drawCurvedConnector(ctx, cx, cy, bp.x, bp.y, bp.color);
  }

  // Branch nodes
  for (const bp of branchPositions) {
    drawNode(ctx, bp.x, bp.y, BRANCH_RADIUS, bp.color);
    drawLabelOutside(ctx, bp.x, bp.y, bp.angle, BRANCH_RADIUS, bp.node.label || '', fg, 700, 14);
  }

  // Root node (largest, accent, drawn last so it sits on top). Root keeps
  // its label INSIDE (it's the biggest circle and the one true "container"
  // of this diagram) but auto-shrinks instead of truncating.
  drawNode(ctx, cx, cy, ROOT_RADIUS, accent);
  drawRootLabel(ctx, cx, cy, ROOT_RADIUS, root.label || '');
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function drawNode(ctx, cx, cy, radius, color) {
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = radius > 24 ? 12 : 6;
  ctx.shadowOffsetY = radius > 24 ? 4 : 2;

  // Radial gradient for pseudo-3D
  const grad = ctx.createRadialGradient(
    cx - radius * 0.3,
    cy - radius * 0.3,
    radius * 0.1,
    cx,
    cy,
    radius,
  );
  grad.addColorStop(0, rgbCss(lighten(color, 0.25)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Root label renders INSIDE the (largest) root circle, auto-shrunk to fit
// rather than truncated with an ellipsis.
function drawRootLabel(ctx, cx, cy, radius, label) {
  const maxW = radius * 1.7;
  let fontSize = 16;
  const minFs = 10;
  const text = String(label);
  while (fontSize > minFs) {
    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxW) break;
    fontSize--;
  }
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
}

// Branch/leaf labels render OUTSIDE their (small) node circle, radially
// offset along the same angle the node sits at relative to the root, with
// text alignment flipped depending on which side of the diagram the node
// falls on (so labels grow away from the cluster, never overlapping it).
// Auto-shrinks down to a 10px floor instead of truncating.
function drawLabelOutside(ctx, nx, ny, angle, nodeRadius, label, fg, weight, targetFs) {
  const gap = 6;
  const lx = nx + Math.cos(angle) * (nodeRadius + gap);
  const ly = ny + Math.sin(angle) * (nodeRadius + gap);
  const cosA = Math.cos(angle);

  let align = 'center';
  if (cosA > 0.25) align = 'left';
  else if (cosA < -0.25) align = 'right';

  const maxW = 130;
  const minFs = 10;
  const text = String(label);
  let fontSize = targetFs;
  while (fontSize > minFs) {
    ctx.font = `${weight} ${fontSize}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxW) break;
    fontSize--;
  }

  ctx.save();
  ctx.fillStyle = rgbCss(fg);
  ctx.font = `${weight} ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, lx, ly);
  ctx.restore();
}

function drawCurvedConnector(ctx, x0, y0, x1, y1, color) {
  ctx.save();
  ctx.strokeStyle = rgbaCss(color, 0.55);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';

  // Curved connector with slight bow (control point perpendicular to midpoint)
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Perpendicular vector (rotated 90°)
  const perpX = -dy / len;
  const perpY = dx / len;
  const bow = len * 0.12;
  const ctrlX = mx + perpX * bow;
  const ctrlY = my + perpY * bow;

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(ctrlX, ctrlY, x1, y1);
  ctx.stroke();
  ctx.restore();
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
