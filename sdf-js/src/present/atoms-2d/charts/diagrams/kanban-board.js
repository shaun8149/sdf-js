// =============================================================================
// atoms-2d/charts/diagrams/kanban-board.js — Kanban Board
// -----------------------------------------------------------------------------
// N status columns (Backlog / In Progress / Done) with task cards in each.
// Project management / sprint planning template signature.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'kanban-board',
  category: 'charts/diagrams',
  description:
    'Kanban board — N status columns each containing task cards. Project status / sprint planning signature.',
  args: {
    title: { type: 'string?', example: 'Sprint 22 Board' },
    columns: {
      type: 'array',
      required: true,
      example: [
        { label: 'Backlog', cards: [{ label: 'API design' }, { label: 'User research' }] },
        {
          label: 'In Progress',
          accent: 'warning',
          cards: [
            { label: 'Auth module', sublabel: 'Alice' },
            { label: 'Dashboard', sublabel: 'Bob' },
          ],
        },
        { label: 'Review', cards: [{ label: 'Onboarding flow' }] },
        {
          label: 'Done',
          accent: 'success',
          cards: [{ label: 'CI setup', sublabel: 'shipped' }, { label: 'Logo refresh' }],
        },
      ],
    },
  },
};

const TITLE_H_FRAC = 0.1;
const PAD = 12;
const COL_GAP = 12;
const HEADER_H_FRAC = 0.09;
const CARD_RADIUS = 6;
const CARD_PAD = 8;

function accentColor(accent, paletteAccent) {
  if (accent === 'warning') return [230, 140, 40];
  if (accent === 'success') return [60, 170, 100];
  return paletteAccent || [80, 130, 200];
}

function roundedRectPath(ctx, x, y, w, h, r, topOnly = false) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  if (topOnly) {
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
  } else {
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  }
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const paletteAccent = palette.colors?.[0] || [80, 130, 200];

  const title = args.title;
  const columns = Array.isArray(args.columns) ? args.columns.slice(0, 5) : [];
  if (columns.length === 0) return;

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

  const boardH = h - (plotTop - y) - PAD;
  const n = columns.length;
  const colW = (w - PAD * 2 - COL_GAP * (n - 1)) / n;
  const headerH = Math.round(boardH * HEADER_H_FRAC);

  for (let ci = 0; ci < n; ci++) {
    const col = columns[ci];
    const colX = x + PAD + ci * (colW + COL_GAP);
    const colY = plotTop + PAD;
    const cards = Array.isArray(col.cards) ? col.cards.slice(0, 8) : [];
    const color = accentColor(col.accent, paletteAccent);

    // Column background (subtle)
    ctx.fillStyle = rgbaCss(fg, 0.04);
    ctx.beginPath();
    roundedRectPath(ctx, colX, colY, colW, boardH - PAD, 8);
    ctx.fill();

    // Header strip
    ctx.fillStyle = rgbaCss(color, 0.85);
    ctx.beginPath();
    roundedRectPath(ctx, colX, colY, colW, headerH, 8, true);
    ctx.fill();

    // Column label
    const headerFontSize = Math.min(14, Math.round(headerH * 0.45));
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${headerFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(col.label || ''), colX + CARD_PAD, colY + headerH / 2);

    // Card count chip
    const chipText = String(cards.length);
    const chipSize = Math.min(12, headerFontSize * 0.8);
    ctx.font = `700 ${chipSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(chipText, colX + colW - CARD_PAD, colY + headerH / 2);

    // Cards
    const cardAreaTop = colY + headerH + CARD_PAD;
    const cardAreaH = boardH - PAD - headerH - CARD_PAD * 2;
    const maxCards = Math.max(1, cards.length);
    const cardH = Math.min(56, Math.max(32, (cardAreaH - (maxCards - 1) * 6) / maxCards));
    const cardW = colW - CARD_PAD * 2;
    const cardLabelSize = Math.min(13, Math.round(cardH * 0.28));
    const cardSubSize = Math.min(11, Math.round(cardH * 0.22));

    for (let ri = 0; ri < cards.length; ri++) {
      const card = cards[ri];
      const cardX = colX + CARD_PAD;
      const cardY = cardAreaTop + ri * (cardH + 6);
      if (cardY + cardH > colY + boardH - PAD) break; // clip if overflow

      // Card shadow + body
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      roundedRectPath(ctx, cardX, cardY, cardW, cardH, CARD_RADIUS);
      ctx.fill();
      ctx.restore();

      // Card label
      ctx.fillStyle = rgbaCss(fg, 0.9);
      ctx.font = `700 ${cardLabelSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = card.sublabel ? 'bottom' : 'middle';
      const midY = cardY + cardH / 2;
      let labelText = String(card.label || '');
      while (labelText.length > 2 && ctx.measureText(labelText).width > cardW - CARD_PAD * 2) {
        labelText = labelText.slice(0, -1);
      }
      if (labelText !== String(card.label || '')) labelText += '…';
      ctx.fillText(labelText, cardX + CARD_PAD, card.sublabel ? midY - 1 : midY);

      if (card.sublabel) {
        ctx.fillStyle = rgbaCss(fg, 0.5);
        ctx.font = `500 ${cardSubSize}px Inter, system-ui, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(String(card.sublabel), cardX + CARD_PAD, midY + 2);
      }
    }
  }
}
