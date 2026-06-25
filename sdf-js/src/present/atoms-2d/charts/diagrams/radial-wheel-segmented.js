// =============================================================================
// atoms-2d/charts/diagrams/radial-wheel-segmented.js
// Concentric ring diagram: inner hub + outer ring divided into N labeled segments.
// Used for HR Activity Wheel, Competency Wheel, Ecosystem Map.
//
// Args:
//   title?        — optional title bar text
//   hub           — central hub label (REQUIRED)
//   segments      — array of { label, sublabel? } 3-8 items (REQUIRED)
//   segmentColors? — optional color overrides array
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'radial-wheel-segmented',
  category: 'charts/diagrams',
  description:
    'Concentric ring diagram — inner hub label + outer ring of N labeled segments. HR wheel / competency wheel / ecosystem map.',
  args: {
    title: { type: 'string?', example: 'HR Activities' },
    hub: { type: 'string', required: true, example: 'HR Core' },
    segments: {
      type: 'array',
      required: true,
      example: [
        { label: 'Recruit', sublabel: 'Talent acquisition' },
        { label: 'Develop', sublabel: 'L&D programs' },
        { label: 'Retain', sublabel: 'Engagement' },
        { label: 'Organize', sublabel: 'Structure & roles' },
        { label: 'Reward', sublabel: 'Compensation' },
        { label: 'Comply', sublabel: 'Policy & law' },
      ],
    },
    segmentColors: { type: 'array?', example: [] },
  },
};

const PAD = 16;
const TITLE_H_FRAC = 0.1;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 140, 200];
  const paletteColors = palette.colors || [
    [60, 140, 200],
    [80, 160, 80],
    [200, 120, 60],
    [160, 60, 160],
    [60, 180, 180],
    [200, 80, 80],
    [100, 160, 80],
  ];

  const segments = Array.isArray(args.segments) ? args.segments.slice(0, 8) : [];
  const hub = String(args.hub || 'Hub');
  const title = args.title ? String(args.title) : '';
  const segmentColors =
    Array.isArray(args.segmentColors) && args.segmentColors.length > 0
      ? args.segmentColors
      : paletteColors;

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  let drawY = y;

  // Title bar
  if (title) {
    const titleH = Math.round(h * TITLE_H_FRAC);
    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(titleH * 0.5)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + PAD, drawY + titleH / 2);
    ctx.restore();
    drawY += titleH;
  }

  const chartH = h - (drawY - y);
  const cx = x + w / 2;
  const cy = drawY + chartH / 2;
  const maxR = Math.min(w, chartH) * 0.42;

  const hubR = maxR * 0.28; // inner hub radius
  const outerR = maxR * 0.88; // outer ring outer edge
  const innerR = hubR + maxR * 0.08; // gap between hub and outer ring

  const n = segments.length;
  if (n === 0) return;

  const TWO_PI = Math.PI * 2;
  const startAngle = -Math.PI / 2; // start at top

  // Draw outer ring segments
  for (let i = 0; i < n; i++) {
    const a0 = startAngle + (i / n) * TWO_PI;
    const a1 = startAngle + ((i + 1) / n) * TWO_PI;
    const color = segmentColors[i % segmentColors.length] || accent;

    // Segment fill
    ctx.save();
    ctx.fillStyle = rgbaCss(color, 0.82);
    ctx.beginPath();
    ctx.moveTo(cx + innerR * Math.cos(a0), cy + innerR * Math.sin(a0));
    ctx.arc(cx, cy, outerR, a0, a1);
    ctx.arc(cx, cy, innerR, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Segment border
    ctx.save();
    ctx.strokeStyle = rgbaCss(bg, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + innerR * Math.cos(a0), cy + innerR * Math.sin(a0));
    ctx.arc(cx, cy, outerR, a0, a1);
    ctx.arc(cx, cy, innerR, a1, a0, true);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Segment label at midpoint of outer ring
    const midA = (a0 + a1) / 2;
    const labelR = (innerR + outerR) / 2;
    const lx = cx + labelR * Math.cos(midA);
    const ly = cy + labelR * Math.sin(midA);

    const seg = segments[i] || {};
    const labelText = String(seg.label || '');
    const sublabelText = seg.sublabel ? String(seg.sublabel) : '';

    const fontSize = Math.max(9, Math.round(maxR * 0.085));
    const subFontSize = Math.max(7, Math.round(fontSize * 0.72));

    ctx.save();
    ctx.translate(lx, ly);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = sublabelText ? 'bottom' : 'middle';
    ctx.fillText(labelText, 0, sublabelText ? -1 : 0);
    if (sublabelText) {
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.font = `400 ${subFontSize}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(sublabelText, 0, 2);
    }
    ctx.restore();
  }

  // Hub circle fill
  ctx.save();
  ctx.fillStyle = rgbCss(accent);
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, TWO_PI);
  ctx.fill();
  ctx.restore();

  // Hub label
  const hubFontSize = Math.max(10, Math.round(hubR * 0.38));
  const hubLines = hub.split('\n');
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = `700 ${hubFontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineH = hubFontSize * 1.25;
  const startTextY = cy - ((hubLines.length - 1) * lineH) / 2;
  for (let i = 0; i < hubLines.length; i++) {
    ctx.fillText(hubLines[i], cx, startTextY + i * lineH);
  }
  ctx.restore();
}
