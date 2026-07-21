// =============================================================================
// atoms-2d/charts/data/stat-with-icon.js — Vertical hero metric with icon
// -----------------------------------------------------------------------------
// Full-canvas vertical-center stack: large icon → value → label → sublabel → trend.
//
// Args:
//   value          — primary metric e.g. "$3.4M" (REQUIRED)
//   label          — descriptor e.g. "Annual Revenue" (REQUIRED)
//   sublabel?      — small gray caption
//   icon?          — atlas icon name
//   iconColor?     — override icon color [r,g,b]
//   trend?         — trend text e.g. "+22%"
//   trendDirection? — 'up'|'down'|'flat' (default 'up')
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { semanticColor } from '../../color.js';
import { resolveIcon } from '../../../../icons/index.js';

export const spec = {
  type: 'stat-with-icon',
  category: 'charts/data',
  description:
    'Vertical hero metric with large icon — icon + value + label + sublabel + optional trend chip.',
  args: {
    value: { type: 'string', required: true, example: '$3.4M' },
    label: { type: 'string', required: true, example: 'Annual Revenue' },
    sublabel: { type: 'string?', example: 'vs last year' },
    icon: { type: 'string?', example: 'chart-bar' },
    iconColor: { type: 'string?', example: null },
    trend: { type: 'string?', example: '+22%' },
    trendDirection: { type: "'up'|'down'|'flat'?", default: "'up'", example: 'up' },
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function lighten([r, g, b], amount = 0.85) {
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ];
}

function drawIconCentered(ctx, iconName, cx, cy, size, color) {
  const resolved = resolveIcon(iconName);
  if (!resolved || !resolved.path) return;
  const viewBox = resolved.source === 'brand' ? 24 : 256;
  const scale = size / viewBox;
  try {
    ctx.save();
    ctx.fillStyle = rgbCss(color);
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(scale, scale);
    ctx.fill(resolved.path);
    ctx.restore();
  } catch (_) {
    ctx.restore();
    /* Path2D unavailable (Node) */
  }
}

// ── render ────────────────────────────────────────────────────────────────────

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const accent = palette.accent ?? [30, 80, 180];
  const themeFg = palette.silhouetteColor ?? [20, 28, 50];
  const fgLum = (0.2126 * themeFg[0] + 0.7152 * themeFg[1] + 0.0722 * themeFg[2]) / 255;
  const fg = fgLum > 0.55 ? [42, 44, 50] : themeFg; // Sprint 87: 白卡钉深墨

  const bgColor = palette.bg ?? [248, 246, 240];
  const iconColor = Array.isArray(args.iconColor) ? args.iconColor : accent;

  // Background
  ctx.fillStyle = rgbCss(bgColor);
  ctx.fillRect(x, y, w, h);

  // Measure total content height
  const hasIcon = !!args.icon;
  const hasTrend = !!args.trend;
  const hasSublabel = !!args.sublabel;

  const iconSize = h * 0.24; // Sprint 87 (user: 图标做大)
  const iconBadgeR = iconSize / 2 + 8;

  // Auto-shrink value font
  let valueFontSize = h * 0.32;
  ctx.font = `900 ${valueFontSize}px "Inter Display", Inter, system-ui`;
  while (valueFontSize > 24 && ctx.measureText(args.value ?? '').width > w * 0.85) {
    valueFontSize -= 2;
    ctx.font = `900 ${valueFontSize}px "Inter Display", Inter, system-ui`;
  }

  const labelFs = h * 0.07;
  const sublabelFs = h * 0.04;
  const chipH = h * 0.05;

  // Compute total height of content block
  let totalH = 0;
  if (hasIcon) totalH += iconBadgeR * 2;
  if (hasIcon) totalH += h * 0.04; // gap icon→value
  totalH += valueFontSize;
  totalH += h * 0.03; // gap value→label
  totalH += labelFs;
  if (hasSublabel) {
    totalH += h * 0.015;
    totalH += sublabelFs;
  }
  if (hasTrend) {
    totalH += h * 0.02;
    totalH += chipH;
  }

  let curY = y + (h - totalH) / 2;
  const cx = x + w / 2;

  // Icon
  if (hasIcon) {
    const badgeY = curY + iconBadgeR;
    const badgeBg = lighten(accent, 0.88);
    const grad = ctx.createRadialGradient(cx, badgeY - iconBadgeR * 0.2, 0, cx, badgeY, iconBadgeR);
    grad.addColorStop(0, rgbCss(lighten(accent, 0.93)));
    grad.addColorStop(1, rgbCss(badgeBg));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, badgeY, iconBadgeR, 0, Math.PI * 2);
    ctx.fill();
    drawIconCentered(ctx, args.icon, cx, badgeY, iconSize * 0.75, iconColor);
    curY += iconBadgeR * 2 + h * 0.04;
  }

  // Value
  ctx.font = `900 ${valueFontSize}px "Inter Display", Inter, system-ui`;
  ctx.fillStyle = rgbCss(accent);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(args.value ?? '', cx, curY);
  curY += valueFontSize + h * 0.03;

  // Label
  ctx.font = `700 ${Math.round(labelFs)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbCss(fg);
  ctx.fillText(args.label ?? '', cx, curY);
  curY += labelFs + h * 0.015;

  // Sublabel
  if (hasSublabel) {
    ctx.font = `500 ${Math.round(sublabelFs)}px Inter, system-ui`;
    ctx.fillStyle = rgbaCss(fg, 0.5);
    ctx.fillText(args.sublabel, cx, curY);
    curY += sublabelFs + h * 0.02;
  }

  // Trend chip
  if (hasTrend) {
    if (!hasSublabel) curY += h * 0.02;
    const dir = args.trendDirection ?? 'up';
    const chipColor =
      dir === 'up'
        ? semanticColor(palette, 'positive')
        : dir === 'down'
          ? semanticColor(palette, 'negative')
          : semanticColor(palette, 'neutral');
    const chipText = args.trend;
    const chipFontSize = Math.round(chipH * 0.6);
    ctx.font = `700 ${chipFontSize}px Inter, system-ui`;
    const chipW = Math.max(ctx.measureText(chipText).width + chipH, chipH * 2.5);
    const chipX = cx - chipW / 2;
    const chipR = chipH / 2;

    ctx.beginPath();
    ctx.roundRect(chipX, curY, chipW, chipH, chipR);
    ctx.fillStyle = rgbCss(chipColor);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chipText, cx, curY + chipH / 2);
  }
}
