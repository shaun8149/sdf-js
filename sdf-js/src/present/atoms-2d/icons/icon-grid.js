// =============================================================================
// atoms-2d/icons/icon-grid.js — M×N icon grid with labels
// -----------------------------------------------------------------------------
// Sprint 18: PL "Core Values" / "Services" pattern with more items than fit
// in a single row. Auto-picks column count from item count, or accept explicit
// `args.cols`. Card-cell rendering for visual structure.
//
// Color routing:
//   - args.colorMode='auto' (default): brand icons → brand color; phosphor → palette.accent
//   - 'brand' forces brand color (Phosphor falls back to accent)
//   - 'theme' forces palette.accent for all
//
// Per docs/superpowers/specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md §4.1
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';
import { resolveIcon } from '../../../icons/index.js';

export const spec = {
  type: 'icon-grid',
  category: 'icons',
  description: 'M×N icon grid with labels — services / values / features.',
  args: {
    items: {
      type: 'array of { icon, label, sublabel?, color? } (4-16)',
      required: true,
      example: [
        { icon: 'shield', label: 'Security', sublabel: 'End-to-end' },
        { icon: 'lightning', label: 'Speed', sublabel: 'Sub-second' },
        { icon: 'globe', label: 'Global', sublabel: '50+ countries' },
        { icon: 'heart', label: 'Care', sublabel: '24/7 support' },
      ],
    },
    cols: {
      type: "'auto'|number?",
      default: "'auto' — 4→2×2, 6→2×3, 9→3×3, 12→4×3, ≥16→4×4",
      example: 3,
    },
    title: { type: 'string?', example: 'Core Values' },
    colorMode: { type: "'auto'|'brand'|'theme'?", default: "'auto'", example: 'auto' },
    iconStyle: { type: "'circle'|'square'|'plain'?", default: "'circle'", example: 'circle' },
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
  const h = opts.h ?? 600;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || palette.accent || [60, 130, 200];
  const colorMode = args.colorMode || 'auto';
  const iconStyle = args.iconStyle || 'circle';
  const iconSizeMode = args.iconSize || 'medium';
  const iconSizeMultiplier = iconSizeMode === 'small' ? 0.7 : iconSizeMode === 'large' ? 1.4 : 1.0;

  const items = Array.isArray(args.items) ? args.items.slice(0, 16) : [];
  if (items.length === 0) return;
  const N = items.length;

  // ---- Title ----
  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.075)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + PAD + Math.round(h * 0.075) + 12;
  }

  // ---- Column count ----
  let cols = args.cols;
  if (cols === 'auto' || cols === undefined) {
    if (N <= 4) cols = 2;
    else if (N <= 6) cols = 3;
    else if (N <= 9) cols = 3;
    else if (N <= 12) cols = 4;
    else cols = 4;
  }
  const rows = Math.ceil(N / cols);
  const colW = (w - PAD * 2) / cols;

  // Icon radius + label font targets are based on column width, NOT row
  // height — the old rowH*0.25 icon radius created a circular dependency
  // where a naive availH/rows division could shrink the row pitch below
  // what the label text actually needed, so row-2 icons overlapped row-1
  // labels (e.g. 4 items wrapping 3+1: "Security" hidden behind "Care").
  const heroBoost = h >= 360 ? 1.3 : 1.0; // Auto-boost on large hero slots (h ≥ 360 = BIG slot)
  const baseIconR = Math.min(colW * 0.22, 48);
  let iconR = baseIconR * iconSizeMultiplier * heroBoost;
  let labelFsTarget = Math.max(11, Math.min(18, Math.round(colW * 0.085)));
  const labelFsMin = 9;
  let subFsTarget = Math.max(9, Math.min(14, Math.round(colW * 0.06)));
  const subFsMin = 8;
  const hasAnySublabel = items.some((it) => it && it.sublabel);

  // Row pitch reserves the full measured label(+sublabel) block height below
  // each icon, then takes whichever is larger: that reserved content height,
  // or an even division of the available space (so rows still spread out
  // nicely when there's plenty of room).
  let iconTopGap = 12;
  let iconLabelGap = 10;
  let labelSubGap = 4;
  let bottomPad = 10;
  const contentHeightOf = () =>
    iconTopGap +
    iconR * 2 +
    iconLabelGap +
    labelFsTarget * 1.2 +
    (hasAnySublabel ? labelSubGap + subFsTarget * 1.2 : 0) +
    bottomPad;

  const availH = y + h - plotTop - PAD;
  let contentH = contentHeightOf();

  // If reserving the full content height for every row would overflow the
  // canvas (many rows / large icons), scale icon radius + fonts + gaps down
  // uniformly so rows*contentH fits — reserving space is only useful if the
  // grid still renders inside its bounds instead of clipping the last row.
  if (rows * contentH > availH) {
    const scale = Math.max(0.4, availH / (rows * contentH));
    iconR *= scale;
    labelFsTarget = Math.max(labelFsMin, Math.round(labelFsTarget * scale));
    subFsTarget = Math.max(subFsMin, Math.round(subFsTarget * scale));
    iconTopGap *= scale;
    iconLabelGap *= scale;
    labelSubGap *= scale;
    bottomPad *= scale;
    contentH = contentHeightOf();
  }

  const evenRowH = availH / rows;
  const rowH = Math.max(evenRowH, contentH);

  for (let i = 0; i < N; i++) {
    const it = items[i] || {};
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = x + PAD + col * colW;
    const cellCx = cellX + colW / 2;
    const cellY = plotTop + row * rowH;

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

    // ---- Badge (circle/square/plain) ----
    const iconCy = cellY + iconR + iconTopGap;
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
      const gridLabelFs = fitFontSize(
        ctx,
        String(it.label),
        colW - 16,
        labelFsTarget,
        labelFsMin,
        (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
      );
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `700 ${gridLabelFs}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = iconCy + iconR + iconLabelGap;
      ctx.fillText(String(it.label), cellCx, labelY);

      if (it.sublabel) {
        const gridSubFs = fitFontSize(
          ctx,
          String(it.sublabel),
          colW - 16,
          subFsTarget,
          subFsMin,
          (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
        );
        ctx.fillStyle = rgbaCss(fg, 0.55);
        ctx.font = `500 ${gridSubFs}px Inter, system-ui, sans-serif`;
        ctx.fillText(String(it.sublabel), cellCx, labelY + gridLabelFs + labelSubGap);
      }
    }
  }
}

// ============================================================================
// Helpers (duplicated from icon-row to keep atoms self-contained;
// extract to shared if a 3rd consumer appears)
// ============================================================================

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
  const rr = r * 0.18;
  ctx.beginPath();
  ctx.moveTo(cx - r + rr, cy - r);
  ctx.arcTo(cx + r, cy - r, cx + r, cy + r, rr);
  ctx.arcTo(cx + r, cy + r, cx - r, cy + r, rr);
  ctx.arcTo(cx - r, cy + r, cx - r, cy - r, rr);
  ctx.arcTo(cx - r, cy - r, cx + r, cy - r, rr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Phosphor icons use a 256-unit viewBox; Simple Icons (brand) use 24-unit.
function drawIconCentered(ctx, resolved, cx, cy, size, color) {
  if (!resolved || resolved.path === null) return;
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
