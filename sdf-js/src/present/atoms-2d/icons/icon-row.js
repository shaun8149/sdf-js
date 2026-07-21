// =============================================================================
// atoms-2d/icons/icon-row.js — N icons horizontally with labels
// -----------------------------------------------------------------------------
// Sprint 18: PL D3180 Vision/Mission/Values/Contact pattern. Items distribute
// evenly across canvas width. Each item: pseudo-3D circular badge + label
// below + optional sublabel. Auto-wraps to 2 rows when ≥7 items.
//
// Color routing:
//   - args.colorMode='auto' (default): brand icons → brand color; phosphor → palette.accent
//   - 'brand' forces brand color (Phosphor falls back to accent)
//   - 'theme' forces palette.accent for all
//
// iconStyle variants:
//   - 'circle' (default): pseudo-3D circular badge
//   - 'square': rounded-square badge
//   - 'plain': icon only, no badge background
//   - 'card': each item is a white rounded-rect card with top accent bar,
//             icon centered-top, label + sublabel below (PL services 4-up pattern)
//
// Per docs/superpowers/specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md §4.1
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';
import { resolveIcon } from '../../../icons/index.js';

export const spec = {
  type: 'icon-row',
  category: 'icons',
  description: 'N icons (2-8) horizontally with labels — vision/values/contact pattern.',
  args: {
    items: {
      type: 'array of { icon, label, sublabel?, color? } (2-8)',
      required: true,
      example: [
        { icon: 'shield', label: 'Trust' },
        { icon: 'sparkle', label: 'Quality' },
        { icon: 'lightning', label: 'Speed' },
        { icon: 'heart', label: 'Customer Focus' },
      ],
    },
    title: { type: 'string?', example: 'Our Values' },
    subtitle: { type: 'string?', example: 'How we work' },
    colorMode: {
      type: "'auto'|'brand'|'theme'?",
      default: "'auto'",
      example: 'auto',
    },
    iconStyle: {
      type: "'circle'|'square'|'plain'|'card'?",
      default: "'circle'",
      example: 'card',
    },
    iconSize: {
      type: "'small'|'medium'|'large'?",
      default: "'medium'",
      example: 'large',
    },
  },
};

const PAD = 24;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 1200;
  const h = opts.h ?? 360;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || palette.accent || [60, 130, 200];
  const colorMode = args.colorMode || 'auto';
  const iconStyle = args.iconStyle || 'circle';
  const iconSizeMode = args.iconSize || 'medium';
  const iconSizeMultiplier = iconSizeMode === 'small' ? 0.7 : iconSizeMode === 'large' ? 1.4 : 1.0;

  const items = Array.isArray(args.items) ? args.items.slice(0, 8) : [];
  if (items.length === 0) return;

  // ---- Title block ----
  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.085)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + PAD + Math.round(h * 0.085) + 6;
    if (args.subtitle) {
      ctx.fillStyle = rgbaCss(fg, 0.6);
      ctx.font = `500 ${Math.round(h * 0.045)}px Inter, system-ui, sans-serif`;
      ctx.fillText(args.subtitle, x + PAD, plotTop);
      plotTop += Math.round(h * 0.045) + 12;
    } else {
      plotTop += 8;
    }
  }

  // ---- Layout ----
  const N = items.length;
  const useTwoRows = N >= 7;
  const cols = useTwoRows ? Math.ceil(N / 2) : N;
  const rows = useTwoRows ? 2 : 1;
  const colW = (w - PAD * 2) / cols;
  const rowH = (y + h - plotTop - PAD) / rows;
  const baseIconR = Math.min(rowH * 0.38, colW * 0.36, 76); // Sprint 87 图标做大
  // Auto-boost on large hero slots (h ≥ 360 = BIG slot)
  const heroBoost = h >= 360 ? 1.3 : 1.0;
  const iconR = baseIconR * iconSizeMultiplier * heroBoost;

  for (let i = 0; i < N; i++) {
    const it = items[i] || {};
    const col = useTwoRows ? i % cols : i;
    const row = useTwoRows ? Math.floor(i / cols) : 0;
    const cellCx = x + PAD + col * colW + colW / 2;
    const cellTopY = plotTop + row * rowH;

    // Resolve icon — resolveIcon never returns null; on miss returns placeholder
    const resolved = resolveIcon(it.icon || '');
    const isBrand = resolved.source === 'brand';
    const brandColor = isBrand ? hexToRgb(resolved.color) : null;
    const iconColor =
      colorMode === 'theme'
        ? accent
        : colorMode === 'brand'
          ? (brandColor ?? accent)
          : /* auto */ (brandColor ?? accent);

    // Optional per-item color override
    const badgeColor = Array.isArray(it.color) ? it.color : iconColor;

    if (iconStyle === 'card') {
      // ---- Card variant: white rounded-rect with top accent bar ----
      const cardGap = Math.max(6, colW * 0.04);
      const cardX = x + PAD + col * colW + cardGap / 2;
      const cardY = cellTopY + 4;
      const cardW = colW - cardGap;
      const cardH = rowH - 8;
      drawCardFrame(ctx, cardX, cardY, cardW, cardH, palette);

      // Icon: centered at top third of card (smaller than circle mode: 32-48px radius)
      const cardIconR = Math.min(cardH * 0.2, cardW * 0.2, 28);
      const cardIconCy = cardY + cardH * 0.35;
      drawIconCentered(ctx, resolved, cellCx, cardIconCy, cardIconR * 1.6, badgeColor);

      // Label: centered bold below icon
      if (it.label) {
        const labelFontSizeTarget = Math.min(Math.round(cardH * 0.13), Math.round(rowH * 0.13));
        const cardLabelFs = fitFontSize(
          ctx,
          String(it.label),
          cardW - 16,
          labelFontSizeTarget,
          Math.max(9, Math.round(labelFontSizeTarget * 0.6)),
          (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
        );
        ctx.fillStyle = rgbCss(fg);
        ctx.font = `700 ${cardLabelFs}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelY = cardIconCy + cardIconR + 10;
        ctx.fillText(String(it.label), cellCx, labelY);

        // Sublabel: below label
        if (it.sublabel) {
          const cardSubTarget = Math.min(Math.round(cardH * 0.09), Math.round(rowH * 0.085));
          const cardSubFs = fitFontSize(
            ctx,
            String(it.sublabel),
            cardW - 16,
            cardSubTarget,
            Math.max(8, Math.round(cardSubTarget * 0.65)),
            (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
          );
          ctx.fillStyle = rgbaCss(fg, 0.55);
          ctx.font = `500 ${cardSubFs}px Inter, system-ui, sans-serif`;
          ctx.fillText(String(it.sublabel), cellCx, labelY + cardLabelFs + 4);
        }
      }
    } else {
      // ---- Standard circle / square / plain modes ----
      const iconCy = cellTopY + iconR + 16;
      if (iconStyle === 'circle') {
        drawCircleBadge(ctx, cellCx, iconCy, iconR, badgeColor);
      } else if (iconStyle === 'square') {
        drawSquareBadge(ctx, cellCx, iconCy, iconR, badgeColor);
      }
      // plain: no badge

      // ---- Icon path (white on circle/square; badge-color on plain) ----
      drawIconCentered(
        ctx,
        resolved,
        cellCx,
        iconCy,
        iconR * 0.85,
        iconStyle === 'plain' ? badgeColor : [255, 255, 255],
      );

      // ---- Label below ----
      if (it.label) {
        const stdLabelFs = fitFontSize(
          ctx,
          String(it.label),
          colW - 20,
          Math.round(rowH * 0.13),
          Math.max(9, Math.round(rowH * 0.08)),
          (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
        );
        ctx.fillStyle = rgbCss(fg);
        ctx.font = `700 ${stdLabelFs}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelY = iconCy + iconR + 14;
        ctx.fillText(String(it.label), cellCx, labelY);

        if (it.sublabel) {
          const stdSubFs = fitFontSize(
            ctx,
            String(it.sublabel),
            colW - 20,
            Math.round(rowH * 0.085),
            Math.max(8, Math.round(rowH * 0.055)),
            (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
          );
          ctx.fillStyle = rgbaCss(fg, 0.55);
          ctx.font = `500 ${stdSubFs}px Inter, system-ui, sans-serif`;
          ctx.fillText(String(it.sublabel), cellCx, labelY + stdLabelFs + 4);
        }
      }
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Draw a white rounded-rect card with soft drop shadow + thin top accent bar.
 * Used by iconStyle === 'card'.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  card left edge
 * @param {number} y  card top edge
 * @param {number} w  card width
 * @param {number} h  card height
 * @param {object} palette  theme palette (for accent color)
 */
function drawCardFrame(ctx, x, y, w, h, palette) {
  const accent = palette.colors?.[0] || palette.accent || [60, 130, 200];
  const cardRadius = Math.min(w, h) * 0.06;
  const accentBarH = 3;

  // White card body with drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundedRectPath(ctx, x, y, w, h, cardRadius);
  ctx.fill();
  ctx.restore();

  // Thin top accent bar (palette.accent, 3px, rounded top corners only)
  ctx.save();
  ctx.fillStyle = rgbCss(accent);
  roundedRectPath(ctx, x, y, w, accentBarH, cardRadius);
  ctx.fill();
  ctx.restore();
}

function roundedRectPath(ctx, x, y, w, h, r) {
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

function drawCircleBadge(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  grad.addColorStop(0, rgbCss(lighten(color, 0.22)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Specular highlight (brighter + slightly larger ellipse)
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.25, cy - r * 0.35, r * 0.55, r * 0.28, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSquareBadge(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, rgbCss(lighten(color, 0.2)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  const rr = r * 0.18;
  ctx.moveTo(cx - r + rr, cy - r);
  ctx.arcTo(cx + r, cy - r, cx + r, cy + r, rr);
  ctx.arcTo(cx + r, cy + r, cx - r, cy + r, rr);
  ctx.arcTo(cx - r, cy + r, cx - r, cy - r, rr);
  ctx.arcTo(cx - r, cy - r, cx + r, cy - r, rr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Phosphor icons use a 256-unit viewBox and are filled glyphs.
// We scale them to fit within [size × size] and fill (not stroke).
function drawIconCentered(ctx, resolved, cx, cy, size, color) {
  if (!resolved || resolved.path === null) return;
  // Determine viewBox: Phosphor = 256, placeholder (filled-square) also 256-ish
  // We treat brand icons (Simple Icons) as 24-unit viewBox SVG paths since they
  // are authored at that scale; Phosphor/placeholder at 256.
  // Simple Icons ship at 24×24 SVG viewBox; Phosphor at 256×256.
  const viewBox = resolved.source === 'brand' ? 24 : 256;
  const scale = size / viewBox;
  try {
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = rgbCss(color);
    ctx.strokeStyle = rgbCss(color);
    ctx.lineWidth = 2 / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Brand icons (Simple Icons) may be stroke or fill — use fill as default
    // since they are closed vector glyphs. Phosphor = fill.
    ctx.fill(resolved.path);
    ctx.restore();
  } catch (e) {
    // Path2D unavailable (Node test env) — silently skip icon glyph
  }
}

// Auto-shrink font size until text fits in maxW (no truncation).
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = hex.replace('#', '');
  if (m.length !== 6) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
