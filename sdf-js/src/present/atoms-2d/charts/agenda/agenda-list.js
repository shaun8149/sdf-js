// =============================================================================
// atoms-2d/charts/agenda/agenda-list.js — Numbered agenda list
// -----------------------------------------------------------------------------
// 2D twin of agenda-list-3d. N stacked rows, each a numbered chip + label
// (+ optional sublabel). Used for meeting agendas / table of contents / steps.
//
// Distinct from `bullet-list` (round bullet, no number chip).
//
// Args:
//   items     — array of { label, sublabel? } (REQUIRED, 1-12)
//   title     — optional title (top-left)
//   numbered  — boolean (default true); when false acts like a labeled bullet
//   highlight — optional integer (1-indexed) — row to render in accent color
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'agenda-list',
  category: 'charts/agenda',
  description: 'Numbered agenda list — meeting agenda, table of contents, steps.',
  args: {
    items: {
      type: 'array of { label, sublabel? } (1-12)',
      required: true,
      example: [
        { label: 'Recap last quarter', sublabel: '5 min' },
        { label: 'Goals review', sublabel: '15 min' },
        { label: 'Next-quarter plan', sublabel: '20 min' },
        { label: 'Q&A', sublabel: '10 min' },
      ],
    },
    title: { type: 'string?', example: 'Today’s Agenda' },
    numbered: { type: 'boolean', default: true, example: true },
    highlight: { type: 'integer?', example: 2 },
  },
};

const PAD = 16;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 520;
  const h = opts.h ?? 360;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [60, 130, 200];

  const items = Array.isArray(args.items) ? args.items.slice(0, 12) : [];
  const N = items.length;
  if (N === 0) return;
  const numbered = args.numbered !== false;
  const highlight = typeof args.highlight === 'number' ? args.highlight - 1 : -1;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.075)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.16;
  }

  const plotH = y + h - plotTop - PAD;
  const rowH = plotH / N;
  const chipSize = Math.min(rowH * 0.62, 56);
  const chipX = x + PAD + chipSize / 2;
  const textX = chipX + chipSize / 2 + 18;
  const textRight = x + w - PAD;

  for (let i = 0; i < N; i++) {
    const it = items[i] || {};
    const rowCY = plotTop + rowH * (i + 0.5);
    const isHi = i === highlight;
    const chipColor = isHi ? accent : darken(accent, 0.0);

    // Chip background (gradient + shadow)
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.2);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    const grad = ctx.createLinearGradient(
      chipX - chipSize / 2,
      rowCY - chipSize / 2,
      chipX + chipSize / 2,
      rowCY + chipSize / 2,
    );
    grad.addColorStop(0, rgbCss(lighten(chipColor, 0.18)));
    grad.addColorStop(1, rgbCss(chipColor));
    ctx.fillStyle = grad;
    roundRect(ctx, chipX - chipSize / 2, rowCY - chipSize / 2, chipSize, chipSize, chipSize * 0.18);
    ctx.fill();
    ctx.restore();

    // Chip number
    if (numbered) {
      ctx.fillStyle = 'white';
      ctx.font = `700 ${Math.round(chipSize * 0.5)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), chipX, rowCY);
    }

    // Label
    if (it.label) {
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `${isHi ? '700' : '600'} ${Math.round(rowH * 0.32)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const labelY = it.sublabel ? rowCY - rowH * 0.12 : rowCY;
      ctx.fillText(String(it.label), textX, labelY);
    }

    // Sublabel
    if (it.sublabel) {
      ctx.fillStyle = rgbaCss(fg, 0.6);
      ctx.font = `500 ${Math.round(rowH * 0.22)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(it.sublabel), textX, rowCY + rowH * 0.18);
    }

    // Faint separator (except after last)
    if (i < N - 1) {
      ctx.save();
      ctx.strokeStyle = rgbaCss(fg, 0.08);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(textX, plotTop + rowH * (i + 1));
      ctx.lineTo(textRight, plotTop + rowH * (i + 1));
      ctx.stroke();
      ctx.restore();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
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
