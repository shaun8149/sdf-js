// =============================================================================
// atoms-2d/charts/lists/bullet-list.js — Bulleted list
// -----------------------------------------------------------------------------
// 2D twin of bullet-list-3d. N stacked rows, each a round bullet + label +
// optional sublabel. Used for key points / features / checklist / takeaways.
//
// Distinct from `agenda-list` (numbered chip, agenda use).
//
// Args:
//   items — array of { label, sublabel?, status?:'done'|'todo'|'highlight' }
//           (REQUIRED, 1-12)
//   title — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'bullet-list',
  category: 'charts/lists',
  description: 'Bulleted list — key points, features, checklist, takeaways.',
  args: {
    items: {
      type: "array of { label, sublabel?, status?:'done'|'todo'|'highlight' } (1-12)",
      required: true,
      example: [
        { label: 'Faster onboarding' },
        { label: 'Better defaults' },
        { label: 'Edge-case fixes', status: 'highlight' },
        { label: 'Docs refresh', status: 'todo' },
      ],
    },
    title: { type: 'string?', example: 'Key Improvements' },
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
  const bulletR = Math.min(rowH * 0.18, 14);
  const bulletX = x + PAD + bulletR + 4;
  const textX = bulletX + bulletR + 16;

  for (let i = 0; i < N; i++) {
    const it = items[i] || {};
    const rowCY = plotTop + rowH * (i + 0.5);
    const status = it.status || 'todo';
    const bulletColor =
      status === 'highlight' ? accent : status === 'done' ? darken(accent, 0.2) : [200, 200, 205];
    const isFilled = status !== 'todo';

    // Bullet
    ctx.save();
    if (isFilled) {
      ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1.5;
      const grad = ctx.createRadialGradient(
        bulletX - bulletR * 0.3,
        rowCY - bulletR * 0.3,
        0,
        bulletX,
        rowCY,
        bulletR,
      );
      grad.addColorStop(0, rgbCss(lighten(bulletColor, 0.3)));
      grad.addColorStop(1, rgbCss(bulletColor));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bulletX, rowCY, bulletR, 0, Math.PI * 2);
      ctx.fill();
      // Checkmark for done
      if (status === 'done') {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = Math.max(1.5, bulletR * 0.2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(bulletX - bulletR * 0.4, rowCY);
        ctx.lineTo(bulletX - bulletR * 0.1, rowCY + bulletR * 0.35);
        ctx.lineTo(bulletX + bulletR * 0.45, rowCY - bulletR * 0.3);
        ctx.stroke();
      }
    } else {
      // Open ring for 'todo'
      ctx.strokeStyle = rgbaCss(fg, 0.4);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(bulletX, rowCY, bulletR * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Label — wrap if too long for container width
    if (it.label) {
      const labelColor = status === 'todo' ? rgbaCss(fg, 0.55) : rgbCss(fg);
      const labelWeight = status === 'highlight' ? '700' : '600';
      const labelFontSize = Math.min(
        Math.round(rowH * 0.34),
        // Cap font: long text in narrow containers shouldn't dominate row height
        Math.round((x + w - textX - PAD) / Math.max(8, String(it.label).length * 0.45)),
      );
      ctx.fillStyle = labelColor;
      ctx.font = `${labelWeight} ${labelFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const maxW = x + w - textX - PAD;
      const lineH = labelFontSize * 1.2;
      const words = String(it.label).split(' ');
      const lines = [];
      let cur = '';
      for (const word of words) {
        const test = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(test).width > maxW && cur) {
          lines.push(cur);
          cur = word;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      // Vertical center: cap lines so they fit in rowH
      const maxLines = Math.max(1, Math.floor((rowH - 8) / lineH));
      const usedLines = lines.slice(0, maxLines);
      const startY = rowCY - ((usedLines.length - 1) * lineH) / 2 - (it.sublabel ? rowH * 0.1 : 0);
      usedLines.forEach((line, li) => {
        ctx.fillText(line, textX, startY + li * lineH);
      });
    }

    // Sublabel
    if (it.sublabel) {
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.font = `500 ${Math.round(rowH * 0.22)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(it.sublabel), textX, rowCY + rowH * 0.18);
    }
  }
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
