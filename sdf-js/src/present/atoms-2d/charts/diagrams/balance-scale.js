// =============================================================================
// atoms-2d/charts/diagrams/balance-scale.js — Trade-off balance scale
// -----------------------------------------------------------------------------
// Pros vs cons / build vs buy / left vs right stylized balance scale. A central
// beam with two pans, items listed under each pan. PL "left vs right" decision
// pattern. Different from swot (4 quadrants) and matrix-grid (2x2 cells).
//
// Args:
//   title       — optional title
//   leftLabel   — label for left pan (e.g. "BUILD")
//   rightLabel  — label for right pan (e.g. "BUY")
//   leftItems   — string[] (2-6)
//   rightItems  — string[] (2-6)
//   leftAccent  — optional rgb css override
//   rightAccent — optional rgb css override
//   verdict     — optional conclusion string
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'balance-scale',
  category: 'charts/diagrams',
  description:
    'Balance scale comparing items on left vs right. PL pros/cons, build vs buy, before/after pattern.',
  args: {
    title: { type: 'string?', example: 'Build vs Buy Analysis' },
    leftLabel: { type: 'string', required: true, example: 'BUILD' },
    rightLabel: { type: 'string', required: true, example: 'BUY' },
    leftItems: {
      type: 'string[] (2-6)',
      required: true,
      example: ['Full control', 'IP retention', 'Custom fit'],
    },
    rightItems: {
      type: 'string[] (2-6)',
      required: true,
      example: ['Faster to market', 'Lower upfront cost', 'Vendor SLA'],
    },
    leftAccent: { type: 'string?', example: null },
    rightAccent: { type: 'string?', example: null },
    verdict: { type: 'string?', example: 'Recommend: Buy for v1' },
  },
};

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor ?? [20, 28, 50];
  const bgColor = palette.bg ?? [248, 246, 240];
  const accent = palette.accent ?? [30, 80, 180];
  const colors = palette.colors ?? [
    [30, 80, 180],
    [200, 80, 60],
    [60, 180, 140],
  ];

  const leftColor = args.leftAccent ? parseCss(args.leftAccent) : colors[0] || [30, 80, 180];
  const rightColor = args.rightAccent ? parseCss(args.rightAccent) : colors[1] || [200, 80, 60];

  const leftItems = Array.isArray(args.leftItems) ? args.leftItems : [];
  const rightItems = Array.isArray(args.rightItems) ? args.rightItems : [];

  ctx.fillStyle = rgbCss(bgColor);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  let plotTop = y + PAD;

  if (args.title) {
    const titleFs = Math.round(h * 0.065);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + w / 2, plotTop);
    plotTop += titleFs + PAD;
  }

  const verdictH = args.verdict ? h * 0.1 : 0;
  const scaleAreaH = h - (plotTop - y) - PAD - verdictH;
  const scaleAreaT = plotTop;

  // Beam geometry
  const beamY = scaleAreaT + scaleAreaH * 0.18;
  const beamH = Math.max(5, scaleAreaH * 0.012);
  const pivotX = x + w / 2;
  const armHalf = w * 0.36;

  // Pivot triangle
  const triH = beamH * 4;
  ctx.save();
  ctx.fillStyle = rgbaCss(fg, 0.3);
  ctx.beginPath();
  ctx.moveTo(pivotX - triH * 0.6, beamY + triH);
  ctx.lineTo(pivotX + triH * 0.6, beamY + triH);
  ctx.lineTo(pivotX, beamY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Beam
  ctx.save();
  ctx.fillStyle = rgbaCss(fg, 0.3);
  ctx.beginPath();
  ctx.roundRect(pivotX - armHalf, beamY - beamH / 2, armHalf * 2, beamH, beamH / 2);
  ctx.fill();
  ctx.restore();

  // Pan vertical lines (chains)
  const panW = armHalf * 0.55;
  const panH = beamH * 1.2;
  const chainH = scaleAreaH * 0.08;
  const leftPanX = pivotX - armHalf;
  const rightPanX = pivotX + armHalf;
  const panY = beamY + chainH;

  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.22);
  ctx.lineWidth = 1.5;
  // Left chain
  ctx.beginPath();
  ctx.moveTo(leftPanX, beamY);
  ctx.lineTo(leftPanX, panY);
  ctx.stroke();
  // Right chain
  ctx.beginPath();
  ctx.moveTo(rightPanX, beamY);
  ctx.lineTo(rightPanX, panY);
  ctx.stroke();
  ctx.restore();

  // Left pan ellipse
  ctx.save();
  ctx.fillStyle = rgbaCss(leftColor, 0.15);
  ctx.strokeStyle = rgbCss(leftColor);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(leftPanX, panY + panH / 2, panW / 2, panH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Right pan ellipse
  ctx.save();
  ctx.fillStyle = rgbaCss(rightColor, 0.15);
  ctx.strokeStyle = rgbCss(rightColor);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(rightPanX, panY + panH / 2, panW / 2, panH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Items area
  const itemsTop = panY + panH + scaleAreaH * 0.03;
  const itemAreaH = scaleAreaT + scaleAreaH - itemsTop;
  const colW = w * 0.38;
  const itemFs = Math.min(Math.round(h * 0.04), 13);
  const bulletR = 4;

  // Left label
  const labelFs = Math.min(Math.round(h * 0.075), 22);
  ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbCss(leftColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(args.leftLabel || '', leftPanX, beamY - labelFs * 0.8);

  // Right label
  ctx.fillStyle = rgbCss(rightColor);
  ctx.fillText(args.rightLabel || '', rightPanX, beamY - labelFs * 0.8);

  // Left items
  const leftColX = x + PAD;
  const rightColX = x + w / 2 + PAD;
  drawItems(
    ctx,
    leftItems,
    leftColX,
    itemsTop,
    colW - PAD,
    itemAreaH,
    leftColor,
    fg,
    itemFs,
    bulletR,
  );
  drawItems(
    ctx,
    rightItems,
    rightColX,
    itemsTop,
    colW - PAD,
    itemAreaH,
    rightColor,
    fg,
    itemFs,
    bulletR,
  );

  // Verdict
  if (args.verdict) {
    const vFs = Math.min(Math.round(h * 0.048), 14);
    const vText = String(args.verdict);
    const vY = scaleAreaT + scaleAreaH + verdictH / 2;
    const vPadH = verdictH * 0.55;
    const vPadW = w * 0.04;

    ctx.save();
    ctx.font = `700 ${vFs}px Inter, system-ui, sans-serif`;
    const vW = ctx.measureText(vText).width + vPadW * 2;
    ctx.fillStyle = rgbaCss(accent, 0.12);
    ctx.beginPath();
    ctx.roundRect(x + w / 2 - vW / 2, vY - vPadH / 2, vW, vPadH, vPadH / 2);
    ctx.fill();
    ctx.fillStyle = rgbCss(accent);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(vText, x + w / 2, vY);
    ctx.restore();
  }
}

function drawItems(ctx, items, colX, itemsTop, colW, availH, color, fg, itemFs, bulletR) {
  const safeItems = items.slice(0, 6);
  if (!safeItems.length) return;
  const rowH = availH / safeItems.length;
  ctx.font = `500 ${itemFs}px Inter, system-ui, sans-serif`;

  for (let i = 0; i < safeItems.length; i++) {
    const rowCY = itemsTop + rowH * (i + 0.5);
    const bulletX = colX + bulletR + 2;
    const textX = bulletX + bulletR + 6;

    ctx.save();
    ctx.fillStyle = rgbaCss(color, 0.8);
    ctx.beginPath();
    ctx.arc(bulletX, rowCY, bulletR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = rgbaCss(fg, 0.85);
    ctx.font = `500 ${itemFs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxTW = colX + colW - textX;
    const text = String(safeItems[i] || '');
    let lineY = rowCY;
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxTW && line) {
        ctx.fillText(line, textX, lineY);
        line = word;
        lineY += itemFs * 1.1;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, textX, lineY);
    ctx.restore();
  }
}

function parseCss(str) {
  // simple rgb(...) parser
  const m = String(str).match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return [30, 80, 180]; // fallback
}
