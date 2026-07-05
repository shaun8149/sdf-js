// =============================================================================
// atoms-2d/charts/diagrams/org-vs-org-matrix.js — Competitive Positioning Matrix
// -----------------------------------------------------------------------------
// 2x2 competitive positioning grid (Magic Quadrant style). Each org plotted
// as a sized bubble on two dimensions. PL competitive analysis signature.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'org-vs-org-matrix',
  category: 'charts/diagrams',
  description:
    'Competitive positioning 2x2 grid (Magic Quadrant style). Each org plotted on 2 dimensions with sized bubble.',
  args: {
    title: { type: 'string?', example: 'Competitive Positioning' },
    xAxis: { type: 'string', required: true, example: 'Completeness of Vision' },
    yAxis: { type: 'string', required: true, example: 'Ability to Execute' },
    orgs: {
      type: 'array',
      required: true,
      example: [
        { name: 'Acme (us)', x: 0.7, y: 0.8, isUs: true },
        { name: 'Competitor A', x: 0.5, y: 0.5 },
        { name: 'Competitor B', x: 0.8, y: 0.3 },
      ],
    },
    quadrantLabels: {
      type: 'object?',
      example: { tl: 'Visionaries', tr: 'Leaders', bl: 'Niche Players', br: 'Challengers' },
    },
  },
};

const TITLE_H_FRAC = 0.1;
const PAD = 20;
const AXIS_MARGIN = 40;

const FALLBACK_COLORS = [
  [80, 130, 200],
  [60, 170, 120],
  [200, 100, 60],
  [170, 80, 160],
  [200, 160, 40],
  [120, 160, 200],
  [200, 130, 130],
  [100, 180, 160],
  [180, 130, 80],
];

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.colors?.[0] || [42, 130, 200];
  const colors = palette.colors || FALLBACK_COLORS;

  const title = args.title;
  const xAxisLabel = args.xAxis || 'X Axis';
  const yAxisLabel = args.yAxis || 'Y Axis';
  const orgs = Array.isArray(args.orgs) ? args.orgs.slice(0, 9) : [];
  const ql = args.quadrantLabels || {};

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  // Title
  let plotTop = y + PAD;
  if (title) {
    const titleH = Math.round(h * TITLE_H_FRAC);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(titleH * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + PAD, y + titleH / 2);
    plotTop = y + titleH;
  }

  // Grid area
  const gridX = x + AXIS_MARGIN + PAD;
  const gridY = plotTop + PAD;
  const gridW = w - AXIS_MARGIN - PAD * 2;
  const gridH = h - (plotTop - y) - AXIS_MARGIN - PAD * 2;
  const midX = gridX + gridW / 2;
  const midY = gridY + gridH / 2;

  // Quadrant tints
  const tl = [gridX, gridY, gridW / 2, gridH / 2];
  const tr = [midX, gridY, gridW / 2, gridH / 2];
  const bl = [gridX, midY, gridW / 2, gridH / 2];
  const br = [midX, midY, gridW / 2, gridH / 2];

  // Quadrant tints — distinct hues per quadrant (previously top-right got a
  // faint accent tint and the other three were an identical neutral 0.04
  // grey, so the "4 quadrants" read as barely-differentiated background
  // noise). Kept subtle (0.06-0.1 alpha) but now each quadrant is visibly
  // its own region.
  ctx.fillStyle = rgbaCss([90, 140, 210], 0.07); // top-left — cool blue
  ctx.fillRect(...tl);
  ctx.fillStyle = rgbaCss([70, 170, 120], 0.09); // top-right — green (leaders)
  ctx.fillRect(...tr);
  ctx.fillStyle = rgbaCss([150, 150, 160], 0.06); // bottom-left — neutral
  ctx.fillRect(...bl);
  ctx.fillStyle = rgbaCss([210, 150, 70], 0.08); // bottom-right — amber
  ctx.fillRect(...br);

  // Grid border
  ctx.strokeStyle = rgbaCss(fg, 0.2);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(gridX, gridY, gridW, gridH);

  // Crosshair lines
  ctx.strokeStyle = rgbaCss(fg, 0.25);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(midX, gridY);
  ctx.lineTo(midX, gridY + gridH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gridX, midY);
  ctx.lineTo(gridX + gridW, midY);
  ctx.stroke();

  // Quadrant labels
  const qlSize = Math.min(11, Math.round(gridW * 0.03));
  ctx.font = `700 ${qlSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbaCss(accent, 0.55);
  ctx.textBaseline = 'top';
  if (ql.tl) {
    ctx.textAlign = 'left';
    ctx.fillText(ql.tl, gridX + 6, gridY + 6);
  }
  if (ql.tr) {
    ctx.textAlign = 'right';
    ctx.fillText(ql.tr, gridX + gridW - 6, gridY + 6);
  }
  if (ql.bl) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(ql.bl, gridX + 6, gridY + gridH - 6);
  }
  if (ql.br) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(ql.br, gridX + gridW - 6, gridY + gridH - 6);
  }

  // Axis labels
  const axisSize = Math.min(12, Math.round(h * 0.032));
  ctx.fillStyle = rgbCss(fg);
  ctx.font = `700 ${axisSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(xAxisLabel, gridX + gridW / 2, gridY + gridH + 8);

  ctx.save();
  ctx.translate(x + PAD, gridY + gridH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(yAxisLabel, 0, 0);
  ctx.restore();

  // Plot orgs
  const baseR = Math.min(20, Math.round(Math.min(gridW, gridH) * 0.055));
  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    const ox = Math.max(0, Math.min(1, Number(org.x) || 0));
    const oy = Math.max(0, Math.min(1, Number(org.y) || 0));
    const bx = gridX + ox * gridW;
    const by = gridY + (1 - oy) * gridH;
    const r = org.isUs ? Math.round(baseR * 1.35) : baseR;
    const color = org.isUs ? accent : colors[i % colors.length];

    // Circle
    ctx.save();
    if (org.isUs) {
      ctx.strokeStyle = rgbCss([255, 255, 255]);
      ctx.lineWidth = 2.5;
    }
    ctx.fillStyle = rgbaCss(color, org.isUs ? 0.95 : 0.78);
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    if (org.isUs) ctx.stroke();
    ctx.restore();

    // Name label — ALWAYS outside the bubble (offset right, or left when too
    // close to the right edge), min 12px, and always dark text. The isUs
    // bubble previously used white label text on the assumption it sat ON
    // the (accent-filled) bubble, but the offset math already placed it
    // OUTSIDE the bubble against the light quadrant tint — white-on-light
    // was nearly invisible ("Acme (us)" unreadable).
    if (org.name) {
      const labelSize = Math.max(12, Math.round(r * 0.7));
      ctx.fillStyle = rgbaCss(fg, 0.9);
      ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
      const onRight = ox < 0.75;
      ctx.textAlign = onRight ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const lx = bx + (onRight ? r + 4 : -r - 4);
      let label = String(org.name);
      const maxLW = gridW * 0.3;
      while (label.length > 3 && ctx.measureText(label).width > maxLW) label = label.slice(0, -1);
      if (label !== org.name) label += '…';
      ctx.fillText(label, lx, by);
    }
  }
}
