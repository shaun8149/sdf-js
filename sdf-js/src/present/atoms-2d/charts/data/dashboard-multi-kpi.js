// =============================================================================
// atoms-2d/charts/data/dashboard-multi-kpi.js — Multi-KPI dashboard composite
// -----------------------------------------------------------------------------
// A tile grid of N KPI mini-cards auto-laid out based on KPI count:
//   2 kpis  → 1×2 row
//   3 kpis  → 1×3 row
//   4 kpis  → 2×2 grid
//   6 kpis  → 2×3 grid
//   other   → nearest rectangle (rows × cols ≈ √N)
//
// Each tile renders a mini kpi-card:
//   - Rounded rect + subtle gradient + soft drop shadow
//   - Hero value (Inter 900, scales to tile)
//   - Label (Inter 600)
//   - Optional sublabel (Inter 400, faded)
//   - Optional trend pill (up/down/neutral with arrow + trendValue)
//
// Args:
//   kpis  — array of 2-6 { value, label, sublabel?, trend?: 'up'|'down'|'neutral', trendValue?, color? }
//   title — optional
//
// Per [[atlas-sprint15b-idiom-atoms-plan]] — Sprint 15b Batch B1.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'dashboard-multi-kpi-composite',
  category: 'charts/data',
  description:
    'Multi-KPI dashboard — N tiles of KPI mini-cards (2×2, 1×3, 2×3, etc). Auto-layout by count.',
  args: {
    kpis: {
      type: 'array of 2-6 { value, label, sublabel?, trend?: "up"|"down"|"neutral", trendValue?, color? }',
      required: true,
      example: [
        { value: '$3.4M', label: 'Revenue', trend: 'up', trendValue: '+27%' },
        { value: '12,450', label: 'MAU', trend: 'up', trendValue: '+10%' },
        { value: '2.1%', label: 'Churn', trend: 'down', trendValue: '-1.3pt' },
        { value: '68', label: 'NPS', trend: 'neutral' },
      ],
    },
    title: { type: 'string?', example: 'Q3 Dashboard' },
  },
};

const PAD = 20;
const TITLE_FRAC = 0.1;
const TILE_GAP = 12;
const TILE_RADIUS_FRAC = 0.06;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 620;
  const h = opts.h ?? 420;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [250, 250, 248];
  const groupColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
    [60, 160, 180],
  ];

  const kpis = Array.isArray(args.kpis) ? args.kpis.slice(0, 6) : [];
  const title = args.title;
  const N = kpis.length;
  if (N === 0) return;

  // ---- Title ----
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.058);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  // ---- Auto-layout ----
  const { rows, cols } = computeLayout(N);

  const plotW = w - PAD * 2;
  const plotH = y + h - plotTop - PAD;
  const tileW = (plotW - TILE_GAP * (cols - 1)) / cols;
  const tileH = (plotH - TILE_GAP * (rows - 1)) / rows;

  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const tx = x + PAD + col * (tileW + TILE_GAP);
    const ty = plotTop + row * (tileH + TILE_GAP);
    const kpi = kpis[i];
    const color = kpi.color || groupColors[i % groupColors.length];
    drawKpiTile(ctx, tx, ty, tileW, tileH, kpi, color, fg, bg);
  }
}

// ---------------------------------------------------------------------------
// Auto layout: pick (rows, cols) for N tiles
// ---------------------------------------------------------------------------
function computeLayout(N) {
  if (N <= 1) return { rows: 1, cols: 1 };
  if (N === 2) return { rows: 1, cols: 2 };
  if (N === 3) return { rows: 1, cols: 3 };
  if (N === 4) return { rows: 2, cols: 2 };
  if (N === 5) return { rows: 2, cols: 3 }; // 5 in 2×3 grid (last cell empty)
  if (N === 6) return { rows: 2, cols: 3 };
  // Fallback: square-ish
  const cols = Math.ceil(Math.sqrt(N));
  const rows = Math.ceil(N / cols);
  return { rows, cols };
}

// ---------------------------------------------------------------------------
// Draw one KPI mini-card tile
// ---------------------------------------------------------------------------
function drawKpiTile(ctx, x, y, w, h, kpi, accentColor, fg, bg) {
  const radius = Math.min(w, h) * TILE_RADIUS_FRAC;

  // ---- Card background with drop shadow ----
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // Subtle dark gradient (matching kpi-card style)
  const cardGrad = ctx.createLinearGradient(x, y, x, y + h);
  cardGrad.addColorStop(0, rgbaCss(lighten(fg, 0.08), 1));
  cardGrad.addColorStop(1, rgbCss(darken(fg, 0.04)));
  ctx.fillStyle = cardGrad;
  roundedRectPath(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  // ---- Accent left edge stripe ----
  ctx.save();
  ctx.fillStyle = rgbCss(accentColor);
  const stripeW = Math.max(3, w * 0.025);
  ctx.beginPath();
  ctx.moveTo(x, y + radius);
  ctx.lineTo(x, y + h - radius);
  ctx.quadraticCurveTo(x, y + h, x + radius, y + h);
  ctx.lineTo(x + stripeW, y + h);
  ctx.lineTo(x + stripeW, y);
  ctx.lineTo(x + radius, y);
  ctx.quadraticCurveTo(x, y, x, y + radius);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ---- Trend pill (top-right) ----
  const hasTrend = kpi.trend && kpi.trendValue;
  let pillBottom = y + 10;
  if (hasTrend) {
    pillBottom = drawTrendPill(ctx, kpi.trend, kpi.trendValue, x + w - 10, y + 10);
  }

  // ---- Hero value ----
  const innerLeft = x + stripeW * 2 + 8;
  const valueStr = String(kpi.value ?? '');
  const valueSize = clamp(Math.round(h * 0.3), 14, 44);
  ctx.fillStyle = rgbCss(lighten(fg, 0.85));
  ctx.font = `900 ${valueSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const valueY = y + h * 0.58;
  ctx.fillText(valueStr, innerLeft, valueY);

  // ---- Label (Inter 700) ----
  const labelSize = clamp(Math.round(h * 0.11), 9, 14);
  ctx.fillStyle = rgbaCss(lighten(fg, 0.85), 0.85);
  ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  ctx.fillText(String(kpi.label || ''), innerLeft, valueY + Math.round(h * 0.17));

  // ---- Sublabel (Inter 400, faded) ----
  if (kpi.sublabel) {
    const subSize = clamp(Math.round(h * 0.088), 8, 12);
    ctx.fillStyle = rgbaCss(lighten(fg, 0.85), 0.55);
    ctx.font = `400 ${subSize}px Inter, system-ui, sans-serif`;
    ctx.fillText(String(kpi.sublabel), innerLeft, valueY + Math.round(h * 0.29));
  }
}

// ---------------------------------------------------------------------------
// Trend pill helper
// ---------------------------------------------------------------------------
function drawTrendPill(ctx, trend, value, rightX, topY) {
  const text = String(value);
  ctx.font = '700 11px Inter, system-ui, sans-serif';
  const textW = ctx.measureText(text).width;
  const pillW = textW + 22;
  const pillH = 18;
  const left = rightX - pillW;

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

  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.1);
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = rgbaCss(pillColor, 0.9);
  roundedRectPath(ctx, left, topY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 11px Inter, system-ui, sans-serif';
  ctx.fillText(arrowChar, left + 6, topY + pillH / 2);
  ctx.font = '700 10px Inter, system-ui, sans-serif';
  ctx.fillText(text, left + 16, topY + pillH / 2 + 1);

  return topY + pillH;
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
