// =============================================================================
// atoms-2d/charts/typography/callout-banner.js — Inline callout card
// -----------------------------------------------------------------------------
// Centered card with space around it. Key insight / warning / tip / note.
// NOT full-bleed — card floats in the slot with padding.
//
// Args:
//   type_?    — 'insight'|'warning'|'tip'|'note' (default 'insight')
//   heading?  — optional bold heading
//   body      — body text (REQUIRED)
//   icon?     — icon name (optional override)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { resolveIcon } from '../../../../icons/index.js';

export const spec = {
  type: 'callout-banner',
  category: 'charts/typography',
  description:
    'Centered callout card — insight / warning / tip / note variant with colored left border.',
  args: {
    type_: { type: "'insight'|'warning'|'tip'|'note'?", default: "'insight'", example: 'insight' },
    heading: { type: 'string?', example: 'Key Insight' },
    body: {
      type: 'string',
      required: true,
      example: 'Revenue grew 47% YoY driven by enterprise upsells.',
    },
    icon: { type: 'string?', example: null },
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function wrapText(ctx, text, maxW, maxLines = 4) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawIconCentered(ctx, iconName, cx, cy, size, color) {
  const resolved = resolveIcon(iconName);
  if (!resolved || !resolved.path) return;
  const viewBox = resolved.source === 'brand' ? 24 : 256;
  const scale = size / viewBox;
  try {
    ctx.save();
    ctx.fillStyle = Array.isArray(color) ? rgbCss(color) : color;
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(scale, scale);
    ctx.fill(resolved.path);
    ctx.restore();
  } catch (_) {
    ctx.restore();
    /* Path2D unavailable (Node) */
  }
}

// ── type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  insight: {
    iconName: 'lightbulb',
    cardBg: [255, 255, 255],
  },
  warning: {
    leftBorder: [232, 93, 4],
    iconName: 'warning',
    cardBg: [255, 248, 240],
    headingColor: [232, 93, 4],
  },
  tip: {
    leftBorder: [45, 158, 45],
    iconName: 'check-circle',
    cardBg: [240, 255, 240],
    headingColor: [45, 158, 45],
  },
  note: {
    leftBorder: [136, 136, 136],
    iconName: 'info',
    cardBg: [245, 245, 245],
    headingColor: [80, 80, 80],
  },
};

// ── render ────────────────────────────────────────────────────────────────────

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const accent = palette.accent ?? [30, 80, 180];
  const fg = palette.silhouetteColor ?? [20, 28, 50];
  const bgColor = palette.bg ?? [248, 246, 240];
  const typeKey = args.type_ ?? 'insight';
  const cfg = TYPE_CONFIG[typeKey] ?? TYPE_CONFIG.insight;

  const leftBorder = cfg.leftBorder ?? accent;
  const cardBg = cfg.cardBg ?? [255, 255, 255];
  const headingColor = cfg.headingColor ?? accent;
  const iconName = args.icon ?? cfg.iconName;

  // Background
  ctx.fillStyle = rgbCss(bgColor);
  ctx.fillRect(x, y, w, h);

  // Card dimensions
  const cardW = w * 0.7;
  const cardH = h * 0.55;
  const cardX = x + (w - cardW) / 2;
  const cardY = y + (h - cardH) / 2;
  const r = 8;

  // Shadow + card fill
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = rgbCss(cardBg);
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, r);
  ctx.fill();
  ctx.restore();

  // Left border
  const borderW = 8;
  ctx.fillStyle = rgbCss(leftBorder);
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, borderW, cardH, [r, 0, 0, r]);
  ctx.fill();

  // Content area
  const cardPad = 20;
  const contentX = cardX + borderW + cardPad;
  const contentMaxW = cardW - borderW - cardPad * 2;

  let curY = cardY + cardPad;

  // Icon
  const iconSize = 24;
  let iconOffsetX = 0;
  if (iconName) {
    drawIconCentered(
      ctx,
      iconName,
      contentX + iconSize / 2,
      curY + iconSize / 2,
      iconSize,
      headingColor,
    );
    iconOffsetX = iconSize + 8;
  }

  // Heading
  const headingFs = Math.round(cardH * 0.16);
  if (args.heading) {
    ctx.font = `700 ${headingFs}px "Inter Display", Inter, system-ui`;
    ctx.fillStyle = Array.isArray(headingColor) ? rgbCss(headingColor) : headingColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.heading, contentX + iconOffsetX, curY);
    curY += headingFs + 8;
  } else if (iconName) {
    curY += iconSize + 8;
  }

  // Body
  const bodyFs = Math.round(cardH * 0.12);
  ctx.font = `500 ${bodyFs}px Inter, system-ui`;
  ctx.fillStyle = rgbaCss(fg, 0.8);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const bodyLines = wrapText(ctx, args.body ?? '', contentMaxW, 4);
  for (const line of bodyLines) {
    ctx.fillText(line, contentX, curY);
    curY += bodyFs + 4;
  }
}
