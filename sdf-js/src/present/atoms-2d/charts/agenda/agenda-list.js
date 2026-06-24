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
import { resolveIcon } from '../../../../icons/index.js';

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
    style: {
      type: "'compact'|'showcase'?",
      default: "'auto' — showcase when w≥800 or items≥5",
      example: 'showcase',
    },
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

  // Tolerate LLM-emitted alternate item shapes (plain strings / text/name/title keys)
  // — Sprint 17 quality fix mirrors bullet-list.
  const rawItems = Array.isArray(args.items) ? args.items.slice(0, 12) : [];
  const items = rawItems.map((it) => {
    if (typeof it === 'string') return { label: it };
    if (!it || typeof it !== 'object') return { label: '' };
    return {
      ...it,
      label: it.label || it.text || it.name || it.title || it.value || '',
      sublabel: it.sublabel || it.subtitle || it.caption || it.description || it.duration || '',
    };
  });
  const N = items.length;
  if (N === 0) return;
  const numbered = args.numbered !== false;
  const highlight = typeof args.highlight === 'number' ? args.highlight - 1 : -1;

  // Sprint 17: PL-style showcase mode (HUGE light-gray numbers + bold label).
  // Auto-pick when explicit style not set: showcase when canvas is wide
  // (w ≥ 800) OR there are 5+ items. Showcase becomes 2-col when items ≥ 6.
  const styleArg = args.style;
  const isShowcase = styleArg === 'showcase' || (styleArg !== 'compact' && (w >= 800 || N >= 5));
  if (isShowcase) {
    return drawShowcase(ctx, items, args, opts, palette, {
      fg,
      accent,
      x,
      y,
      w,
      h,
      numbered,
      highlight,
    });
  }

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

    // Chip: icon (Sprint 18) OR number (original)
    if (it.icon) {
      const resolved = resolveIcon(it.icon);
      const viewBox = resolved.source === 'brand' ? 24 : 256;
      const iconSize = chipSize * 0.62;
      ctx.save();
      try {
        ctx.translate(chipX - iconSize / 2, rowCY - iconSize / 2);
        ctx.scale(iconSize / viewBox, iconSize / viewBox);
        ctx.fillStyle = 'rgba(255,255,255,0.97)';
        if (resolved.path) ctx.fill(resolved.path);
      } catch (_) {
        /* Path2D unavailable (Node) */
      }
      ctx.restore();
    } else if (numbered) {
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

// Sprint 17: PL-style showcase layout — HUGE numbers + bold label + optional sublabel.
// 2-col grid when items ≥ 6, else single column.
function drawShowcase(
  ctx,
  items,
  args,
  _opts,
  _palette,
  { fg, accent, x, y, w, h, numbered, highlight },
) {
  const N = items.length;
  const PAD = 28;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.085)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.title).toUpperCase(), x + PAD, y + PAD);
    plotTop = y + PAD + Math.round(h * 0.085) + 8;

    if (args.subtitle) {
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.font = `400 ${Math.round(h * 0.045)}px Inter, system-ui, sans-serif`;
      ctx.fillText(String(args.subtitle), x + PAD, plotTop);
      plotTop += Math.round(h * 0.045) + 12;
    } else {
      plotTop += 6;
    }
  }

  const useTwoCol = N >= 6 && w >= 700;
  const cols = useTwoCol ? 2 : 1;
  const rows = Math.ceil(N / cols);
  const colW = (w - PAD * 2) / cols;
  const rowH = (y + h - plotTop - PAD) / rows;

  const numSize = Math.min(rowH * 0.55, (w / cols) * 0.16, 88);
  const labelSize = Math.min(rowH * 0.22, 28);
  const subSize = Math.min(rowH * 0.16, 18);

  for (let i = 0; i < N; i++) {
    const it = items[i] || {};
    const col = useTwoCol ? Math.floor(i / rows) : 0;
    const row = useTwoCol ? i % rows : i;
    const cellX = x + PAD + col * colW;
    const cellY = plotTop + row * rowH;
    const isHi = i === highlight;

    // Big number (PL signature)
    if (numbered) {
      ctx.fillStyle = isHi ? rgbCss(accent) : rgbaCss(fg, 0.18);
      ctx.font = `900 ${Math.round(numSize)}px "Inter Display", Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const numText = String(i + 1).padStart(2, '0');
      ctx.fillText(numText, cellX, cellY);
    }

    // Sprint 18: small icon badge to the left of label (alongside large number)
    if (it.icon) {
      const resolved = resolveIcon(it.icon);
      const viewBox = resolved.source === 'brand' ? 24 : 256;
      const iconSize = Math.min(numSize * 0.38, 32);
      const iconCx =
        cellX +
        (numbered ? ctx.measureText(String(i + 1).padStart(2, '0')).width + 16 : 0) +
        iconSize / 2;
      const iconCy = cellY + Math.round(numSize * 0.18) + iconSize / 2;
      ctx.save();
      try {
        ctx.translate(iconCx - iconSize / 2, iconCy - iconSize / 2);
        ctx.scale(iconSize / viewBox, iconSize / viewBox);
        ctx.fillStyle = isHi ? rgbCss(accent) : rgbaCss(fg, 0.7);
        if (resolved.path) ctx.fill(resolved.path);
      } catch (_) {
        /* Path2D unavailable (Node) */
      }
      ctx.restore();
    }

    // Label position: right of number (compute number width)
    ctx.font = `900 ${Math.round(numSize)}px "Inter Display", Inter, system-ui, sans-serif`;
    const numW = numbered ? ctx.measureText(String(i + 1).padStart(2, '0')).width + 16 : 0;
    const iconExtraW = it.icon ? Math.min(numSize * 0.38, 32) + 8 : 0;
    const labelX = cellX + numW + iconExtraW;
    const labelMaxW = colW - numW - iconExtraW - 12;

    // Item label (bold, dark)
    if (it.label) {
      ctx.fillStyle = isHi ? rgbCss(accent) : rgbCss(fg);
      ctx.font = `700 ${Math.round(labelSize)}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(
        fitText(ctx, String(it.label), labelMaxW),
        labelX,
        cellY + Math.round(numSize * 0.18),
      );
    }

    // Sublabel below label
    if (it.sublabel) {
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.font = `400 ${Math.round(subSize)}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(
        fitText(ctx, String(it.sublabel), labelMaxW),
        labelX,
        cellY + Math.round(numSize * 0.18) + Math.round(labelSize) + 4,
      );
    }
  }
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
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
