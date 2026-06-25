// =============================================================================
// atoms-2d/charts/data/kpi-card.js — KPI hero card atom
// -----------------------------------------------------------------------------
// First atom in the 2D vector library (Phase 0 hello-world).
//
// Semantic: a single rectangular tile carrying ONE big number + label +
// optional trend indicator + optional icon. The bread-and-butter of any
// dashboard, pitch deck, or quarterly report.
//
// Args (matches think-cell agenda block + PresentationLoad KPI tile):
//   value         — primary number (e.g. "$3.4M", "127%", "1,250")
//   label         — primary label (e.g. "Q3 Revenue")
//   sublabel      — optional small caption (e.g. "vs Q2 2024")
//   trend         — 'up' | 'down' | 'neutral' (arrow direction)
//   trendValue    — optional delta (e.g. "+127%", "-12pt")
//   icon          — optional atlas-icon name (e.g. 'chart-bar')
//   style         — 'dark' (default) | 'light' | 'accent-border'
//
// Style variants:
//   dark          — dark bg + white text + isometric edge (current default, hero metrics)
//   light         — white card bg, dark text, keep accent drop shadow (dashboard tiles)
//   accent-border — white card bg, dark text, thick left accent border (sidebar callout)
//
// Render strategies:
//   drawPseudo3D — gradient bg + drop shadow + isometric edge + bold typo (this PR)
//   drawFlat     — TBD (later batch)
//   draw3D       — TBD (3D presentation mode, per atlas-present-spatial-narrative-thesis
//                  Lock 4: card = floating 3D plate with text-3d glyphs)
//
// Per [[atlas-sprint14-finance-preset-plan]] Lock 4 + B answer (浮空板 + text-3d 字).
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { resolveIcon } from '../../../../icons/index.js';

export const spec = {
  type: 'kpi-card',
  category: 'charts/data',
  description:
    'Hero KPI tile — big number + label + optional trend + icon. Bread-and-butter of dashboards.',
  args: {
    value: { type: 'string|number', required: true, example: '$3.4M' },
    label: { type: 'string', required: true, example: 'Q3 Revenue' },
    sublabel: { type: 'string?', example: 'vs Q2 2024' },
    trend: { type: "'up'|'down'|'neutral'?", example: 'up' },
    trendValue: { type: 'string?', example: '+127%' },
    icon: { type: 'string? (atlas-icon name)', example: 'chart-bar' },
    style: {
      type: "'dark'|'light'|'accent-border'?",
      default: "'dark'",
      example: 'dark',
    },
  },
};

/**
 * Pseudo-3D KPI card render. Routes to style-specific helper.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} args — see spec.args
 * @param {object} opts — { x, y, w, h, palette }
 */
export function drawPseudo3D(ctx, args, opts = {}) {
  const style = args.style || 'dark';
  switch (style) {
    case 'dark':
      return _drawDark(ctx, args, opts);
    case 'light':
      return _drawLight(ctx, args, opts);
    case 'accent-border':
      return _drawAccentBorder(ctx, args, opts);
    default:
      return _drawDark(ctx, args, opts);
  }
}

// ============================================================================
// Style helpers
// ============================================================================

/**
 * Dark variant (original behavior) — dark bg + white text + isometric edge.
 * Best for hero metrics on slide.
 */
function _drawDark(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 280;
  const h = opts.h ?? 160;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];

  // ---- Drop shadow (softer: 10px blur, alpha 0.12) ----
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // ---- Rounded gradient body (subtle 8% lighten only) ----
  const cardRadius = Math.min(w, h) * 0.06;
  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, rgbaCss(lighten(fg, 0.08), 1));
  gradient.addColorStop(1, rgbCss(darken(fg, 0.04)));
  ctx.fillStyle = gradient;
  roundedRectPath(ctx, x, y, w, h, cardRadius);
  ctx.fill();
  ctx.restore(); // drop shadow off

  // ---- Isometric edge accent (right side) ----
  const edgeDepth = Math.max(4, w * 0.012);
  ctx.save();
  ctx.fillStyle = rgbaCss(darken(fg, 0.15), 0.9);
  ctx.beginPath();
  ctx.moveTo(x + w, y + cardRadius);
  ctx.lineTo(x + w + edgeDepth, y + cardRadius + edgeDepth);
  ctx.lineTo(x + w + edgeDepth, y + h);
  ctx.lineTo(x + w, y + h - cardRadius);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ---- Trend pill (top-right) ----
  if (args.trend && args.trendValue) {
    drawTrendPill(ctx, args.trend, args.trendValue, x + w - 20, y + 20, palette);
  }

  // ---- Icon (top-left) ----
  if (args.icon) {
    drawIconStub(ctx, args.icon, x + 22, y + 26, 22, rgbCss(bg));
  }

  // ---- Hero value ----
  ctx.fillStyle = rgbCss(bg);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const availW = w - 44;
  const valueText = String(args.value ?? '');
  let valueSize = Math.round(h * 0.34);
  const minValueSize = Math.round(h * 0.14);
  ctx.font = `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`;
  while (ctx.measureText(valueText).width > availW && valueSize > minValueSize) {
    valueSize -= 2;
    ctx.font = `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`;
  }
  const valueY = y + h * 0.56;
  ctx.fillText(valueText, x + 22, valueY);

  // ---- Label ----
  ctx.fillStyle = rgbaCss(bg, 0.85);
  let labelSize = Math.round(h * 0.11);
  const minLabelSize = Math.round(h * 0.07);
  const labelText = String(args.label ?? '');
  ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  while (ctx.measureText(labelText).width > availW && labelSize > minLabelSize) {
    labelSize -= 1;
    ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  }
  ctx.fillText(fitText(ctx, labelText, availW), x + 22, valueY + Math.round(h * 0.17));

  // ---- Sublabel (Inter 500, faded, proper breathing room) ----
  if (args.sublabel) {
    ctx.fillStyle = rgbaCss(bg, 0.55);
    const subFs = fitFontSize(
      ctx,
      String(args.sublabel),
      availW,
      Math.round(h * 0.085),
      Math.max(8, Math.round(h * 0.055)),
      (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
    );
    ctx.font = `500 ${subFs}px Inter, system-ui, sans-serif`;
    ctx.fillText(String(args.sublabel), x + 22, valueY + Math.round(h * 0.29));
  }
}

/**
 * Light variant — white card bg, dark text, keep accent drop shadow.
 * Best for 4-up dashboard grids.
 */
function _drawLight(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 280;
  const h = opts.h ?? 160;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const accent = palette.colors?.[0] || palette.accent || [60, 100, 200];
  // Light card background — lighten the theme bg significantly
  const cardBg = lighten(bg, 0.5);

  // ---- Drop shadow ----
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  const cardRadius = Math.min(w, h) * 0.06;
  ctx.fillStyle = rgbCss(cardBg);
  roundedRectPath(ctx, x, y, w, h, cardRadius);
  ctx.fill();
  ctx.restore();

  // ---- Accent edge (right side, using palette accent color) ----
  const edgeDepth = Math.max(4, w * 0.012);
  ctx.save();
  ctx.fillStyle = rgbaCss(accent, 0.7);
  ctx.beginPath();
  ctx.moveTo(x + w, y + cardRadius);
  ctx.lineTo(x + w + edgeDepth, y + cardRadius + edgeDepth);
  ctx.lineTo(x + w + edgeDepth, y + h);
  ctx.lineTo(x + w, y + h - cardRadius);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ---- Trend pill (top-right) ----
  if (args.trend && args.trendValue) {
    drawTrendPill(ctx, args.trend, args.trendValue, x + w - 20, y + 20, palette);
  }

  // ---- Icon (top-left) ----
  if (args.icon) {
    drawIconStub(ctx, args.icon, x + 22, y + 26, 22, rgbCss(accent));
  }

  // ---- Hero value (dark text) ----
  ctx.fillStyle = rgbCss(fg);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const availW = w - 44;
  const valueText = String(args.value ?? '');
  let valueSize = Math.round(h * 0.34);
  const minValueSize = Math.round(h * 0.14);
  ctx.font = `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`;
  while (ctx.measureText(valueText).width > availW && valueSize > minValueSize) {
    valueSize -= 2;
    ctx.font = `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`;
  }
  const valueY = y + h * 0.56;
  ctx.fillText(valueText, x + 22, valueY);

  // ---- Label (dark text) ----
  ctx.fillStyle = rgbaCss(fg, 0.75);
  let labelSize = Math.round(h * 0.11);
  const minLabelSize = Math.round(h * 0.07);
  const labelText = String(args.label ?? '');
  ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  while (ctx.measureText(labelText).width > availW && labelSize > minLabelSize) {
    labelSize -= 1;
    ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  }
  ctx.fillText(fitText(ctx, labelText, availW), x + 22, valueY + Math.round(h * 0.17));

  // ---- Sublabel ----
  if (args.sublabel) {
    ctx.fillStyle = rgbaCss(fg, 0.45);
    const subFs = fitFontSize(
      ctx,
      String(args.sublabel),
      availW,
      Math.round(h * 0.085),
      Math.max(8, Math.round(h * 0.055)),
      (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
    );
    ctx.font = `500 ${subFs}px Inter, system-ui, sans-serif`;
    ctx.fillText(String(args.sublabel), x + 22, valueY + Math.round(h * 0.29));
  }
}

/**
 * Accent-border variant — white card bg, dark text, thick left accent border.
 * Magazine-style sidebar callout. No isometric edge, minimal drop shadow.
 */
function _drawAccentBorder(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 280;
  const h = opts.h ?? 160;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const accent = palette.colors?.[0] || palette.accent || [60, 100, 200];
  const cardBg = lighten(bg, 0.5);

  const borderW = Math.max(8, Math.min(12, w * 0.035));
  const cardRadius = Math.min(w, h) * 0.06;

  // ---- Minimal drop shadow ----
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.08);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = rgbCss(cardBg);
  roundedRectPath(ctx, x, y, w, h, cardRadius);
  ctx.fill();
  ctx.restore();

  // ---- Left accent border (thick, full height, accent color) ----
  ctx.save();
  ctx.fillStyle = rgbCss(accent);
  ctx.beginPath();
  // Rounded left edge: top-left + bottom-left corners rounded, right edge square
  ctx.moveTo(x + cardRadius, y);
  ctx.lineTo(x + borderW, y);
  ctx.lineTo(x + borderW, y + h);
  ctx.lineTo(x + cardRadius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - cardRadius);
  ctx.lineTo(x, y + cardRadius);
  ctx.quadraticCurveTo(x, y, x + cardRadius, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ---- Trend pill (top-right) ----
  if (args.trend && args.trendValue) {
    drawTrendPill(ctx, args.trend, args.trendValue, x + w - 20, y + 20, palette);
  }

  // ---- Icon (top-left, after border) ----
  const textLeft = x + borderW + 14;
  if (args.icon) {
    drawIconStub(ctx, args.icon, textLeft + 11, y + 26, 22, rgbCss(accent));
  }

  // ---- Hero value (dark text, offset past border) ----
  ctx.fillStyle = rgbCss(fg);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const availW = w - borderW - 28;
  const valueText = String(args.value ?? '');
  let valueSize = Math.round(h * 0.34);
  const minValueSize = Math.round(h * 0.14);
  ctx.font = `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`;
  while (ctx.measureText(valueText).width > availW && valueSize > minValueSize) {
    valueSize -= 2;
    ctx.font = `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`;
  }
  const valueY = y + h * 0.56;
  ctx.fillText(valueText, textLeft, valueY);

  // ---- Label ----
  ctx.fillStyle = rgbaCss(fg, 0.75);
  let labelSize = Math.round(h * 0.11);
  const minLabelSize = Math.round(h * 0.07);
  const labelText = String(args.label ?? '');
  ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  while (ctx.measureText(labelText).width > availW && labelSize > minLabelSize) {
    labelSize -= 1;
    ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  }
  ctx.fillText(fitText(ctx, labelText, availW), textLeft, valueY + Math.round(h * 0.17));

  // ---- Sublabel ----
  if (args.sublabel) {
    ctx.fillStyle = rgbaCss(fg, 0.45);
    const subFs = fitFontSize(
      ctx,
      String(args.sublabel),
      availW,
      Math.round(h * 0.085),
      Math.max(8, Math.round(h * 0.055)),
      (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
    );
    ctx.font = `500 ${subFs}px Inter, system-ui, sans-serif`;
    ctx.fillText(String(args.sublabel), textLeft, valueY + Math.round(h * 0.29));
  }
}

// Truncate with ellipsis if even after font-scale it overflows.
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) {
    s = s.slice(0, -1);
  }
  return s + '…';
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

// ============================================================================
// Private helpers (file-local). Kept simple — not factored to a shared
// "pseudo3d-toolkit" yet, do that when 2nd+3rd atom share these.
// ============================================================================

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTrendPill(ctx, trend, value, rightX, topY, palette) {
  const text = String(value);
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  const textW = ctx.measureText(text).width;
  const pillW = textW + 28;
  const pillH = 22;
  const left = rightX - pillW;

  // pill colors by trend semantics
  let pillColor;
  let arrowChar;
  if (trend === 'up') {
    pillColor = [40, 160, 100];
    arrowChar = '↑';
  } else if (trend === 'down') {
    pillColor = [200, 80, 80];
    arrowChar = '↓';
  } else {
    pillColor = [150, 150, 150];
    arrowChar = '→';
  }

  // Softer shadow on trend pill (reduced blur + alpha)
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.1);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = rgbaCss(pillColor, 0.88);
  roundedRectPath(ctx, left, topY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.fillText(arrowChar, left + 8, topY + pillH / 2);
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  ctx.fillText(text, left + 20, topY + pillH / 2 + 1);
}

// Sprint 18: wired to icon library. cx/cy = top-left corner of the icon area.
function drawIconStub(ctx, name, cx, cy, size, color) {
  const resolved = resolveIcon(name);
  if (!resolved.path) return;
  const viewBox = resolved.source === 'brand' ? 24 : 256;
  const scale = size / viewBox;
  ctx.save();
  try {
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fill(resolved.path);
  } catch (_) {
    /* Path2D unavailable (Node) */
  }
  ctx.restore();
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
