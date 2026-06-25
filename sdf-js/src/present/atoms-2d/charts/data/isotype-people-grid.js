// =============================================================================
// atoms-2d/charts/data/isotype-people-grid.js — Isotype people grid atom
// -----------------------------------------------------------------------------
// N×M grid of tiny person silhouettes where first `highlighted` are filled
// with accent color and the rest are muted. Classic infographic pattern for
// showing proportions of a population (e.g. "73 of 100 customers satisfied").
//
// Args:
//   total       — total number of person icons to draw (4-200)
//   highlighted — number of people to fill with accent color (0..total)
//   personIcon  — 'simple' | 'business' | 'casual' (default: 'simple')
//   label       — optional text label below the grid
//   title       — optional title above the grid
//
// Per [[atlas-pl-observation-pool-v3]] Batch 3 Finding B — THE missing
// infographic idiom. Sprint 15b B3.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'isotype-people-grid',
  category: 'charts/data',
  description:
    'N×M grid of tiny people silhouettes — first `highlighted` filled with accent, rest muted.',
  args: {
    total: { type: 'number 4-200', required: true, example: 100 },
    highlighted: { type: 'number 0..total', required: true, example: 73 },
    personIcon: { type: "'simple'|'business'|'casual'?", default: 'simple', example: 'simple' },
    label: { type: 'string?', example: '73 of 100 customers are highly satisfied' },
    title: { type: 'string?', example: 'Customer Satisfaction' },
  },
};

// SAMPLES for browser demo / gallery
export const SAMPLES = [
  {
    args: {
      total: 100,
      highlighted: 73,
      personIcon: 'simple',
      title: 'Customer Satisfaction',
      label: '73 of 100 customers are highly satisfied',
    },
  },
  {
    args: {
      total: 50,
      highlighted: 12,
      personIcon: 'business',
      title: 'Employee Engagement',
      label: '12 out of 50 employees actively engaged',
    },
  },
];

const PAD = 20;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 360;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  const accent = palette.colors?.[0] || [60, 130, 200];

  const total = Math.max(1, Math.min(200, Math.round(args.total ?? 100)));
  const highlighted = Math.max(0, Math.min(total, Math.round(args.highlighted ?? 0)));
  const personIcon = args.personIcon || 'simple';
  const title = args.title;
  const label = args.label;

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Title
  let contentY = y + PAD;
  if (title) {
    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.065)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, contentY);
    contentY += Math.round(h * 0.09);
    ctx.restore();
  }

  // Hero stat above grid: "73/100"
  const heroStatH = Math.round(h * 0.13);
  ctx.save();
  ctx.fillStyle = rgbCss(accent);
  ctx.font = `900 ${heroStatH}px "Inter Display", Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${highlighted}/${total}`, x + PAD, contentY);
  contentY += heroStatH + 10;
  ctx.restore();

  // Reserve space for label at bottom
  const labelH = label ? Math.round(h * 0.09) : 0;
  const gridBottom = y + h - PAD - labelH;
  const gridH = gridBottom - contentY;
  const gridW = w - PAD * 2;

  // Auto-compute grid dims: aim for aspect ratio ~1.5:1 (cols:rows)
  const cols = Math.ceil(Math.sqrt(total * 1.5));
  const rows = Math.ceil(total / cols);

  // Person size to fit in grid
  const personW = Math.floor(gridW / cols);
  const personH = Math.floor(gridH / rows);
  const personSize = Math.min(personW, personH) * 0.88;

  // Draw each person
  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const px = x + PAD + col * personW + personW / 2;
    const py = contentY + row * personH + personH / 2;
    const isAccent = i < highlighted;

    drawPerson(ctx, px, py, personSize, personIcon, isAccent ? accent : fg, isAccent ? 1.0 : 0.22);
  }

  // Label below grid
  if (label) {
    ctx.save();
    ctx.fillStyle = rgbaCss(fg, 0.75);
    ctx.font = `600 ${Math.round(h * 0.055)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x + PAD, y + h - PAD);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Person silhouette drawing helpers
// ---------------------------------------------------------------------------

function drawPerson(ctx, cx, cy, size, variant, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const headR = size * 0.18;
  const bodyH = size * 0.38;
  const bodyW = size * 0.32;
  const headCy = cy - size * 0.22;
  const bodyCy = headCy + headR + bodyH * 0.5;

  // Drop shadow for accented icons
  if (alpha > 0.5) {
    ctx.save();
    ctx.shadowColor = rgbaCss(color, 0.18);
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
  }

  // Subtle gradient fill
  const grad = ctx.createLinearGradient(cx, cy - size * 0.4, cx, cy + size * 0.25);
  grad.addColorStop(0, rgbaCss(lighten(color, 0.1), 1));
  grad.addColorStop(1, rgbaCss(darken(color, 0.08), 1));
  ctx.fillStyle = grad;

  if (variant === 'business') {
    drawBusinessPerson(ctx, cx, cy, size, headR, bodyH, bodyW, headCy, bodyCy, grad);
  } else if (variant === 'casual') {
    drawCasualPerson(ctx, cx, cy, size, headR, bodyH * 0.75, bodyW * 0.85, headCy, bodyCy, grad);
  } else {
    drawSimplePerson(ctx, cx, cy, size, headR, bodyH, bodyW, headCy, bodyCy, grad);
  }

  if (alpha > 0.5) {
    ctx.restore();
  }
  ctx.restore();
}

function drawSimplePerson(ctx, cx, cy, size, headR, bodyH, bodyW, headCy, bodyCy) {
  // Head circle
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();

  // Body: trapezoid (wider at bottom)
  const topW = bodyW * 0.7;
  const botW = bodyW;
  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, bodyCy - bodyH / 2);
  ctx.lineTo(cx + topW / 2, bodyCy - bodyH / 2);
  ctx.lineTo(cx + botW / 2, bodyCy + bodyH / 2);
  ctx.lineTo(cx - botW / 2, bodyCy + bodyH / 2);
  ctx.closePath();
  ctx.fill();
}

function drawBusinessPerson(ctx, cx, cy, size, headR, bodyH, bodyW, headCy, bodyCy) {
  // Head circle
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();

  // Body: straight-sided rectangle (suit jacket silhouette)
  const w = bodyW * 0.9;
  const h = bodyH;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, bodyCy - h / 2);
  ctx.lineTo(cx + w / 2, bodyCy - h / 2);
  ctx.lineTo(cx + w / 2, bodyCy + h / 2);
  ctx.lineTo(cx - w / 2, bodyCy + h / 2);
  ctx.closePath();
  ctx.fill();

  // Tie: small triangle center
  ctx.save();
  ctx.globalAlpha = ctx.globalAlpha * 0.6;
  ctx.beginPath();
  const tieW = size * 0.06;
  const tieH = bodyH * 0.55;
  ctx.moveTo(cx, bodyCy - h / 2 + size * 0.04);
  ctx.lineTo(cx + tieW, bodyCy - h / 2 + tieH * 0.5);
  ctx.lineTo(cx, bodyCy - h / 2 + tieH);
  ctx.lineTo(cx - tieW, bodyCy - h / 2 + tieH * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCasualPerson(ctx, cx, cy, size, headR, bodyH, bodyW, headCy, bodyCy) {
  // Head: slightly larger
  ctx.beginPath();
  ctx.arc(cx, headCy, headR * 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Body: rounded trapezoid, shorter height = casual/shorter person feel
  const topW = bodyW;
  const botW = bodyW * 1.15;
  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, bodyCy - bodyH / 2);
  ctx.lineTo(cx + topW / 2, bodyCy - bodyH / 2);
  ctx.lineTo(cx + botW / 2, bodyCy + bodyH / 2);
  ctx.lineTo(cx - botW / 2, bodyCy + bodyH / 2);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Color helpers
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
