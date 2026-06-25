// =============================================================================
// atoms-2d/charts/diagrams/process-arrows.js — Sequential process chevron row
// -----------------------------------------------------------------------------
// N horizontal labeled arrow (chevron) boxes showing a sequential process.
// PL "Discover → Define → Design → Develop → Deploy" pattern.
//
// Args:
//   title?  — optional title bar
//   steps   — array of { label, sublabel? } (3-7) REQUIRED
//   color   — 'accent'|'gradient'? (default 'gradient')
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'process-arrows',
  category: 'charts/diagrams',
  description:
    'Sequential process chevron row — N labeled arrow boxes, gradient fill, label + optional sublabel.',
  args: {
    title: { type: 'string?', example: 'Our Process' },
    steps: {
      type: 'array of { label, sublabel? } (3-7)',
      required: true,
      example: [
        { label: 'Discover' },
        { label: 'Define' },
        { label: 'Design' },
        { label: 'Develop' },
        { label: 'Deploy' },
      ],
    },
    color: { type: "'accent'|'gradient'?", default: "'gradient'", example: 'gradient' },
  },
};

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];
  const colors = palette.colors || [accent];

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const rawSteps = Array.isArray(args.steps) ? args.steps.slice(0, 7) : [];
  const steps = rawSteps.map((s) => {
    if (typeof s === 'string') return { label: s };
    return { label: s.label || '', sublabel: s.sublabel || '' };
  });
  const N = steps.length;
  if (N === 0) return;

  // Title bar
  let plotTop = y;
  if (args.title) {
    const titleFontSize = Math.round(h * 0.08);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.title), x + 24, y + 16);
    plotTop = y + titleFontSize + 28;
  }

  const arrowH = Math.min(h * 0.55, h - (plotTop - y) - 20);
  const arrowY = plotTop + (h - (plotTop - y) - arrowH) / 2;
  const notch = arrowH * 0.18;
  const gap = 4;
  const totalW = w - 32;
  const stepW = totalW / N;

  for (let i = 0; i < N; i++) {
    const sx = x + 16 + i * stepW;
    const isFirst = i === 0;
    const isLast = i === N - 1;

    // Pick fill color
    let fillColor;
    if (args.color === 'accent') {
      fillColor = accent;
    } else {
      // gradient: interpolate across colors palette
      const t = N === 1 ? 0 : i / (N - 1);
      const c1 = colors[0] || accent;
      const c2 = colors[Math.min(colors.length - 1, 2)] || accent;
      fillColor = [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t),
      ];
    }

    // Draw chevron path
    const shapeX = sx + (i === 0 ? 0 : gap / 2);
    const shapeW = stepW - (i === 0 ? gap / 2 : gap);

    ctx.save();
    ctx.fillStyle = rgbCss(fillColor);
    ctx.beginPath();

    if (isFirst) {
      // Rounded left, arrow right
      const r = 6;
      ctx.moveTo(shapeX + r, arrowY);
      ctx.lineTo(shapeX + shapeW - notch, arrowY);
      if (!isLast) {
        ctx.lineTo(shapeX + shapeW, arrowY + arrowH / 2);
        ctx.lineTo(shapeX + shapeW - notch, arrowY + arrowH);
      } else {
        ctx.lineTo(shapeX + shapeW, arrowY + arrowH);
      }
      ctx.lineTo(shapeX + r, arrowY + arrowH);
      ctx.quadraticCurveTo(shapeX, arrowY + arrowH, shapeX, arrowY + arrowH - r);
      ctx.lineTo(shapeX, arrowY + r);
      ctx.quadraticCurveTo(shapeX, arrowY, shapeX + r, arrowY);
    } else if (isLast) {
      // Left notch, rounded right
      const r = 6;
      ctx.moveTo(shapeX, arrowY);
      ctx.lineTo(shapeX + shapeW - r, arrowY);
      ctx.quadraticCurveTo(shapeX + shapeW, arrowY, shapeX + shapeW, arrowY + r);
      ctx.lineTo(shapeX + shapeW, arrowY + arrowH - r);
      ctx.quadraticCurveTo(shapeX + shapeW, arrowY + arrowH, shapeX + shapeW - r, arrowY + arrowH);
      ctx.lineTo(shapeX, arrowY + arrowH);
      ctx.lineTo(shapeX + notch, arrowY + arrowH / 2);
    } else {
      // Left notch, arrow right
      ctx.moveTo(shapeX, arrowY);
      ctx.lineTo(shapeX + shapeW - notch, arrowY);
      ctx.lineTo(shapeX + shapeW, arrowY + arrowH / 2);
      ctx.lineTo(shapeX + shapeW - notch, arrowY + arrowH);
      ctx.lineTo(shapeX, arrowY + arrowH);
      ctx.lineTo(shapeX + notch, arrowY + arrowH / 2);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Label text — auto-shrink to fit chevron width
    const targetFontSize = Math.min(Math.round(arrowH * 0.2), Math.round(stepW * 0.16));
    const subFontSize = Math.round(targetFontSize * 0.72);
    const hasSub = Boolean(steps[i].sublabel);
    const centerX = shapeX + shapeW / 2;
    const centerY = arrowY + arrowH / 2;
    const maxLabelW = shapeW - notch * 2 - 8;

    // Auto-shrink: find largest font where label fits without ellipsis
    let labelFontSize = targetFontSize;
    ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
    while (labelFontSize > 10 && ctx.measureText(String(steps[i].label)).width > maxLabelW * 0.85) {
      labelFontSize--;
      ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
    }
    const labelY = hasSub ? centerY - labelFontSize * 0.6 : centerY;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(steps[i].label), centerX, labelY);
    ctx.restore();

    if (hasSub) {
      const subFont = Math.round(labelFontSize * 0.72);
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `500 ${subFont}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(steps[i].sublabel), centerX, centerY + labelFontSize * 0.75);
      ctx.restore();
    }
  }
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
