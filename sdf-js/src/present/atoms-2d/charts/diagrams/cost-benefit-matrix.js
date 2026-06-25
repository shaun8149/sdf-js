// =============================================================================
// atoms-2d/charts/diagrams/cost-benefit-matrix.js — 2x2 cost-benefit plot
// -----------------------------------------------------------------------------
// PL signature: 2x2 grid with items plotted in quadrants by cost and benefit.
// Used for impact-effort, value-complexity, cost-benefit analysis slides.
//
// Args:
//   title?          — optional heading
//   xAxis?          — x-axis label (default: "Cost")
//   yAxis?          — y-axis label (default: "Benefit")
//   items           — array of { label, cost: 'low'|'high', benefit: 'low'|'high' } (REQUIRED)
//   quadrantLabels? — { tl?, tr?, bl?, br? } — optional quadrant label overrides
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'cost-benefit-matrix',
  category: 'charts/diagrams',
  description:
    '2x2 cost-benefit grid with items plotted in quadrants. Used for impact-effort, value-complexity, cost-benefit analysis slides.',
  args: {
    title: { type: 'string?', example: 'Initiative Prioritization' },
    xAxis: { type: 'string?', example: 'Cost' },
    yAxis: { type: 'string?', example: 'Benefit' },
    items: {
      type: 'array of { label, cost, benefit } (cost/benefit: "low"|"high")',
      required: true,
      example: [
        { label: 'AI Chatbot', cost: 'low', benefit: 'high' },
        { label: 'ERP Upgrade', cost: 'high', benefit: 'high' },
        { label: 'Email Campaign', cost: 'low', benefit: 'low' },
        { label: 'Rebrand', cost: 'high', benefit: 'low' },
      ],
    },
    quadrantLabels: {
      type: '{ tl?, tr?, bl?, br? }?',
      example: { tl: 'Quick Wins', tr: 'Major Projects', bl: 'Fill-ins', br: 'Hard Sells' },
    },
  },
};

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const accent = palette.accent ?? [42, 130, 200];
  const fg = palette.silhouetteColor ?? [20, 28, 50];
  const bg = palette.bg ?? [248, 246, 240];

  const items = Array.isArray(args.items) ? args.items : [];
  const xAxisLabel = args.xAxis || 'Cost';
  const yAxisLabel = args.yAxis || 'Benefit';
  const ql = args.quadrantLabels || {};

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  const AXIS_PAD = 40; // space for axis labels
  let plotTop = y + PAD;

  // Title
  if (args.title) {
    const titleFs = Math.round(h * 0.065);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, plotTop);
    plotTop += titleFs + PAD * 0.5;
  }

  // Grid bounds
  const gridX = x + AXIS_PAD + PAD;
  const gridY = plotTop;
  const gridW = w - AXIS_PAD - PAD * 2;
  const gridH = h - (plotTop - y) - AXIS_PAD - PAD;
  const midX = gridX + gridW / 2;
  const midY = gridY + gridH / 2;

  // Quadrant tints
  const quadrants = [
    {
      x: gridX,
      y: gridY,
      w: gridW / 2,
      h: gridH / 2,
      color: 'rgba(34,197,94,0.08)',
      label: ql.tl || 'Low Cost\nHigh Benefit',
    },
    {
      x: midX,
      y: gridY,
      w: gridW / 2,
      h: gridH / 2,
      color: 'rgba(59,130,246,0.08)',
      label: ql.tr || 'High Cost\nHigh Benefit',
    },
    {
      x: gridX,
      y: midY,
      w: gridW / 2,
      h: gridH / 2,
      color: 'rgba(156,163,175,0.08)',
      label: ql.bl || 'Low Cost\nLow Benefit',
    },
    {
      x: midX,
      y: midY,
      w: gridW / 2,
      h: gridH / 2,
      color: 'rgba(239,68,68,0.08)',
      label: ql.br || 'High Cost\nLow Benefit',
    },
  ];

  for (const q of quadrants) {
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x, q.y, q.w, q.h);
  }

  // Grid border
  ctx.strokeStyle = rgbaCss(fg, 0.18);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(gridX, gridY, gridW, gridH);

  // Divider lines
  ctx.beginPath();
  ctx.moveTo(midX, gridY);
  ctx.lineTo(midX, gridY + gridH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gridX, midY);
  ctx.lineTo(gridX + gridW, midY);
  ctx.stroke();

  // Quadrant corner labels
  const qLabelFs = 11;
  ctx.font = `700 ${qLabelFs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbaCss(fg, 0.28);
  ctx.textBaseline = 'top';
  const corners = [
    { x: gridX + 8, y: gridY + 6, text: ql.tl || 'Quick Wins', align: 'left' },
    { x: gridX + gridW - 8, y: gridY + 6, text: ql.tr || 'Major Projects', align: 'right' },
    { x: gridX + 8, y: midY + 6, text: ql.bl || 'Fill-ins', align: 'left' },
    { x: gridX + gridW - 8, y: midY + 6, text: ql.br || 'Hard Sells', align: 'right' },
  ];
  for (const c of corners) {
    ctx.textAlign = c.align;
    ctx.fillText(c.text, c.x, c.y);
  }

  // X-axis label (bottom center)
  const axisFs = 12;
  ctx.font = `500 ${axisFs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbaCss(fg, 0.6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`← Low ${xAxisLabel}   High ${xAxisLabel} →`, gridX + gridW / 2, y + h - 4);

  // Y-axis label (rotated left)
  ctx.save();
  ctx.translate(x + 14, gridY + gridH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`↑ High ${yAxisLabel}   Low ${yAxisLabel} ↓`, 0, 0);
  ctx.restore();

  // Plot items
  // Scatter offset by index within quadrant to avoid overlap
  const quadrantItems = { tl: [], tr: [], bl: [], br: [] };
  for (const item of items) {
    const col = item.cost === 'high' ? 'r' : 'l';
    const row = item.benefit === 'high' ? 't' : 'b';
    const key = row + col;
    quadrantItems[key].push(item);
  }

  const ITEM_R = 14;
  const dotColor = accent;

  for (const [qKey, qItems] of Object.entries(quadrantItems)) {
    const isRight = qKey.endsWith('r');
    const isTop = qKey.startsWith('t');
    const qx = isRight ? midX : gridX;
    const qy = isTop ? gridY : midY;
    const qw = gridW / 2;
    const qh = gridH / 2;

    for (let i = 0; i < qItems.length; i++) {
      const item = qItems[i];
      // Scatter within quadrant based on index
      const col = i % 3;
      const row = Math.floor(i / 3);
      const marginX = ITEM_R + 20;
      const marginY = ITEM_R + 20;
      const spacingX = (qw - marginX * 2) / 2;
      const spacingY = (qh - marginY * 2) / 2;
      const ix = qx + marginX + col * spacingX;
      const iy = qy + marginY + row * spacingY;

      // Circle
      ctx.save();
      ctx.shadowColor = rgbaCss([0, 0, 0], 0.15);
      ctx.shadowBlur = 6;
      ctx.fillStyle = rgbCss(dotColor);
      ctx.beginPath();
      ctx.arc(ix, iy, ITEM_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Label
      const labelFs = 11;
      ctx.font = `600 ${labelFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = rgbCss(fg);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label || '', ix + ITEM_R + 4, iy);
    }
  }
}
