// =============================================================================
// atoms-2d/charts/diagrams/vertical-timeline.js — Vertical stacked timeline
// -----------------------------------------------------------------------------
// Date/event pairs stacked vertically with a left axis line + dots.
// Complement to horizontal `timeline` atom.
//
// Args:
//   title?     — optional title bar
//   events     — array of { date, label, sublabel? } (3-8) REQUIRED
//   axisLabel? — optional label above the axis
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'vertical-timeline',
  category: 'charts/diagrams',
  description:
    'Vertical stacked timeline — date/event pairs with left axis line + filled dots. Complement to horizontal timeline.',
  args: {
    title: { type: 'string?', example: 'Company Milestones' },
    events: {
      type: 'array of { date, label, sublabel? } (3-8)',
      required: true,
      example: [
        { date: 'Q1 2026', label: 'Launch' },
        { date: 'Q2 2026', label: 'Series A', sublabel: '$8M raised' },
        { date: 'Q3 2026', label: '10K users' },
      ],
    },
    axisLabel: { type: 'string?', example: '2026 Roadmap' },
  },
};

const PAD = 20;
const AXIS_X_FRAC = 0.22; // axis line at 22% of width
const DOT_RADIUS = 7;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const rawEvents = Array.isArray(args.events) ? args.events.slice(0, 8) : [];
  const events = rawEvents.map((e) => ({
    date: String(e.date || ''),
    label: String(e.label || ''),
    sublabel: e.sublabel ? String(e.sublabel) : '',
  }));
  const N = events.length;
  if (N === 0) return;

  // Title bar
  let plotTop = y + PAD;
  if (args.title) {
    const titleFontSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.title), x + PAD, plotTop);
    plotTop += titleFontSize + 16;
  }

  // Axis label
  if (args.axisLabel) {
    const axLabelSize = Math.round(h * 0.038);
    ctx.fillStyle = rgbaCss(accent, 0.75);
    ctx.font = `600 ${axLabelSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.axisLabel), x + PAD, plotTop);
    plotTop += axLabelSize + 10;
  }

  const availH = h - (plotTop - y) - PAD;
  const rowH = availH / N;
  const axisX = x + w * AXIS_X_FRAC;

  // Draw vertical axis line
  ctx.save();
  ctx.strokeStyle = rgbaCss(accent, 0.5);
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(axisX, plotTop);
  ctx.lineTo(axisX, plotTop + availH);
  ctx.stroke();
  ctx.restore();

  // Per-event layout
  for (let i = 0; i < N; i++) {
    const ev = events[i];
    const rowMidY = plotTop + i * rowH + rowH / 2;

    // Dot on axis
    ctx.save();
    ctx.fillStyle = rgbCss(accent);
    ctx.beginPath();
    ctx.arc(axisX, rowMidY, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // White center
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(axisX, rowMidY, DOT_RADIUS * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Date — right-aligned to LEFT of axis
    const dateFontSize = Math.round(rowH * 0.28);
    if (ev.date) {
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.45);
      ctx.font = `700 ${dateFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(ev.date, axisX - DOT_RADIUS - 10, rowMidY);
      ctx.restore();
    }

    // Label — left-aligned to RIGHT of axis
    const labelFontSize = Math.round(rowH * 0.32);
    if (ev.label) {
      const labelX = axisX + DOT_RADIUS + 12;
      const maxLabelW = x + w - PAD - labelX;

      // Auto-shrink
      let lfs = labelFontSize;
      ctx.font = `700 ${lfs}px Inter, system-ui, sans-serif`;
      while (lfs > 10 && ctx.measureText(ev.label).width > maxLabelW) {
        lfs--;
        ctx.font = `700 ${lfs}px Inter, system-ui, sans-serif`;
      }
      const labelY = ev.sublabel ? rowMidY - lfs * 0.35 : rowMidY;

      ctx.save();
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `700 ${lfs}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ev.label, labelX, labelY);
      ctx.restore();

      // Sublabel
      if (ev.sublabel) {
        const subFontSize = Math.round(rowH * 0.22);
        ctx.save();
        ctx.fillStyle = rgbaCss(fg, 0.5);
        ctx.font = `500 ${subFontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(ev.sublabel, labelX, rowMidY + lfs * 0.5);
        ctx.restore();
      }
    }

    // Subtle horizontal separator between rows (not after last)
    if (i < N - 1) {
      ctx.save();
      ctx.strokeStyle = rgbaCss(fg, 0.07);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + PAD, plotTop + (i + 1) * rowH);
      ctx.lineTo(x + w - PAD, plotTop + (i + 1) * rowH);
      ctx.stroke();
      ctx.restore();
    }
  }
}
