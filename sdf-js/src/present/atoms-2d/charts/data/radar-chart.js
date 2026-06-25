// =============================================================================
// atoms-2d/charts/data/radar-chart.js — Multi-axis radar / spider chart
// -----------------------------------------------------------------------------
// N-axis spider plot. Each series polygon filled at 0.3 alpha + stroked.
// Grid rings optional. Axis labels at outer edge.
//
// Args:
//   title?    — optional heading
//   axes      — string[] (3-9, REQUIRED)
//   series    — array of { label, values: number[] (0-1 each) } (1-3, REQUIRED)
//   showGrid? — boolean (default true)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'radar-chart',
  category: 'charts/data',
  description:
    'Multi-axis radar/spider chart — N capability axes from center, polygon visualizes scores (0-1 per axis).',
  args: {
    title: { type: 'string?', example: 'AI Capability Assessment' },
    axes: {
      type: 'array of string (3-9)',
      required: true,
      example: ['Speed', 'Quality', 'Cost', 'Scalability', 'UX', 'Security'],
    },
    series: {
      type: 'array of { label, values: number[] (0-1) } (1-3)',
      required: true,
      example: [
        { label: 'Current', values: [0.7, 0.4, 0.6, 0.3, 0.8, 0.5] },
        { label: 'Target Q4', values: [0.9, 0.7, 0.8, 0.7, 0.9, 0.8] },
      ],
    },
    showGrid: { type: 'boolean?', default: true },
  },
};

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

function legendFontSize(h) {
  return Math.max(10, Math.round(h * 0.032));
}

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const accent = palette.accent ?? [42, 130, 200];
  const fg = palette.silhouetteColor ?? [20, 28, 50];
  const bg = palette.bg ?? [248, 246, 240];
  const colors = palette.colors || [accent, [200, 120, 60], [80, 160, 80]];
  const axes = Array.isArray(args.axes) ? args.axes : [];
  const series = Array.isArray(args.series) ? args.series : [];
  const showGrid = args.showGrid !== false;
  const N = clamp(axes.length, 3, 9);
  if (N === 0 || series.length === 0) return;

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  let plotTop = y + PAD;

  // Title
  if (args.title) {
    const titleFs = Math.round(h * 0.07);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, plotTop);
    plotTop += titleFs + PAD * 0.5;
  }

  // Reserve space for legend (right side)
  const legendW = series.length > 1 ? Math.round(w * 0.18) : 0;
  const plotW = w - PAD * 2 - legendW;
  const plotH = y + h - plotTop - PAD;
  const labelInset = 44;
  const r = Math.min(plotW, plotH) / 2 - labelInset;
  const cx = x + PAD + plotW / 2;
  const cy = plotTop + plotH / 2;

  // Angle helper: axis 0 points up
  const axisAngle = (i) => -Math.PI / 2 + (i / N) * Math.PI * 2;

  // Grid rings
  if (showGrid) {
    for (const frac of [0.25, 0.5, 0.75, 1.0]) {
      ctx.save();
      ctx.strokeStyle = rgbaCss(fg, 0.1);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = axisAngle(i % N);
        const px = cx + Math.cos(a) * r * frac;
        const py = cy + Math.sin(a) * r * frac;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Axis lines
  for (let i = 0; i < N; i++) {
    const a = axisAngle(i);
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
    ctx.restore();
  }

  // Series polygons
  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const color = colors[si % colors.length];
    const vals = Array.isArray(s.values) ? s.values : [];

    // Filled polygon
    ctx.save();
    ctx.fillStyle = rgbaCss(lighten(color, 0.2), 0.3);
    ctx.strokeStyle = rgbCss(color);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const v = clamp(Number(vals[i]) || 0, 0, 1);
      const a = axisAngle(i);
      const px = cx + Math.cos(a) * r * v;
      const py = cy + Math.sin(a) * r * v;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Vertex dots
    for (let i = 0; i < N; i++) {
      const v = clamp(Number(vals[i]) || 0, 0, 1);
      const a = axisAngle(i);
      const px = cx + Math.cos(a) * r * v;
      const py = cy + Math.sin(a) * r * v;
      ctx.save();
      ctx.fillStyle = rgbCss(color);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Axis labels
  const labelFs = Math.round(Math.min(h * 0.038, 13));
  for (let i = 0; i < N; i++) {
    const a = axisAngle(i);
    const labelR = r + 20;
    const lx = cx + Math.cos(a) * labelR;
    const ly = cy + Math.sin(a) * labelR;
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${labelFs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
    ctx.textBaseline = Math.sin(a) > 0.3 ? 'top' : Math.sin(a) < -0.3 ? 'bottom' : 'middle';
    ctx.fillText(String(axes[i] ?? ''), lx, ly);
  }

  // Legend (right side)
  if (series.length > 1 && legendW > 0) {
    const legendX = x + PAD + plotW + PAD * 0.5;
    const legendGap = 22;
    const legendTop = cy - ((series.length - 1) * legendGap) / 2;
    const lfs = legendFontSize(h);
    for (let si = 0; si < series.length; si++) {
      const color = colors[si % colors.length];
      const ly = legendTop + si * legendGap;
      ctx.fillStyle = rgbCss(color);
      ctx.fillRect(legendX, ly - 5, 14, 10);
      ctx.font = `500 ${lfs}px Inter, system-ui`;
      ctx.fillStyle = rgbCss(fg);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(series[si].label ?? ''), legendX + 18, ly);
    }
  }
}
