// =============================================================================
// atoms-2d/charts/data/gantt.js — Gantt project timeline
// -----------------------------------------------------------------------------
// 2D pseudo-3D equivalent of gantt-3d. Gantt chart (Henry Gantt 1910s, public
// domain). Horizontal bars showing project tasks across time.
//
// Args:
//   tasks  — array of { label, start, end, color?, complete? } where start/end
//            are normalized 0..1 across timeline
//   periods — optional X-axis labels (e.g. ['Q1','Q2','Q3','Q4'])
//   title   — optional title
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'gantt',
  category: 'charts/data',
  description: 'Gantt project timeline. Tasks on Y axis, time across X.',
  args: {
    tasks: {
      type: 'array of { label, start, end, color?, complete? }',
      required: true,
      example: [
        { label: 'Research', start: 0, end: 0.25 },
        { label: 'Design', start: 0.15, end: 0.5 },
        { label: 'Build', start: 0.4, end: 0.85 },
        { label: 'Launch', start: 0.8, end: 1 },
      ],
    },
    periods: { type: 'string[]?', example: ['Q1', 'Q2', 'Q3', 'Q4'] },
    title: { type: 'string?', example: 'Project Plan' },
  },
};

const PAD = 14;
const LABEL_WIDTH_FRAC = 0.22;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 600;
  const h = opts.h ?? 320;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const colors = palette.colors || [[60, 130, 200]];

  const tasks = Array.isArray(args.tasks) ? args.tasks : [];
  const periods = Array.isArray(args.periods) ? args.periods : null;
  const n = tasks.length;
  if (n === 0) return;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.07)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  const labelCol = (w - PAD * 2) * LABEL_WIDTH_FRAC;
  const periodH = periods ? h * 0.07 : 0;
  const trackLeft = x + PAD + labelCol;
  const trackRight = x + w - PAD;
  const trackW = trackRight - trackLeft;
  const trackTop = plotTop + periodH;
  const trackBottom = y + h - PAD;
  const trackH = trackBottom - trackTop;
  const rowH = trackH / n;
  const barH = Math.min(28, rowH * 0.6);

  // Period axis grid + labels
  if (periods) {
    const p = periods.length;
    for (let i = 0; i <= p; i++) {
      const gx = trackLeft + (trackW * i) / p;
      ctx.save();
      ctx.strokeStyle = rgbaCss(fg, 0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, plotTop + periodH * 0.5);
      ctx.lineTo(gx, trackBottom);
      ctx.stroke();
      ctx.restore();
      if (i < p) {
        ctx.fillStyle = rgbaCss(fg, 0.65);
        ctx.font = `600 ${Math.round(h * 0.038)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(periods[i], trackLeft + (trackW * (i + 0.5)) / p, plotTop + periodH * 0.4);
      }
    }
  }

  // Tasks
  for (let i = 0; i < n; i++) {
    const t = tasks[i];
    const cy = trackTop + rowH * (i + 0.5);
    // Task label (left column)
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${Math.min(13, rowH * 0.32)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.label || '', trackLeft - 8, cy);

    // Task bar
    const start = clamp(Number(t.start || 0), 0, 1);
    const end = clamp(Number(t.end || 1), start + 0.02, 1);
    const bx = trackLeft + start * trackW;
    const bw = (end - start) * trackW;
    const color = t.color || colors[i % colors.length];
    drawBar(ctx, bx, cy - barH / 2, bw, barH, color, t.complete);
  }
}

function drawBar(ctx, x, y, w, h, color, complete) {
  const radius = h / 2;
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, rgbCss(lighten(color, 0.18)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  pillPath(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  // Top iso accent
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.38), 0.55);
  pillPath(ctx, x, y, w, 2, radius);
  ctx.fill();
  ctx.restore();

  // Completion overlay (darker fill from left to %)
  if (typeof complete === 'number' && complete > 0) {
    const cw = w * clamp(complete, 0, 1);
    ctx.save();
    ctx.beginPath();
    pillPath(ctx, x, y, cw, h, radius);
    ctx.clip();
    ctx.fillStyle = rgbaCss(darken(color, 0.25), 0.6);
    ctx.fillRect(x, y, cw, h);
    ctx.restore();
  }
}

function pillPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
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
