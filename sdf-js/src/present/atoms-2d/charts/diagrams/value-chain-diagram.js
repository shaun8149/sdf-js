// atoms-2d/charts/diagrams/value-chain-diagram.js — Porter's Value Chain
// Primary activities row + support activity stripes + optional outcome box.
// Args: title?, primary[] (req), support[] (req), outcome?

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'value-chain-diagram',
  category: 'charts/diagrams',
  description:
    "Porter's Value Chain — primary activities row + support activities stipes + outcome.",
  args: {
    title: { type: 'string?', example: 'Value Chain Analysis' },
    primary: {
      type: 'array',
      required: true,
      example: ['Inbound Logistics', 'Operations', 'Outbound Logistics', 'Marketing', 'Service'],
    },
    support: {
      type: 'array',
      required: true,
      example: ['Firm Infrastructure', 'HR Management', 'Technology', 'Procurement'],
    },
    outcome: { type: 'string?', example: 'Margin' },
  },
};

const PAD = 16;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];

  const primary = Array.isArray(args.primary) ? args.primary.slice(0, 8) : [];
  const support = Array.isArray(args.support) ? args.support.slice(0, 4) : [];
  const outcome = args.outcome ? String(args.outcome) : '';

  if (primary.length === 0) return;

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  // Title
  let plotTop = y + PAD;
  if (args.title) {
    const titleH = Math.round(h * 0.1);
    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(titleH * 0.65)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(args.title), x + PAD, y + titleH / 2);
    ctx.restore();
    plotTop = y + titleH;
  }

  const plotH = h - (plotTop - y) - PAD;

  // Outcome box width (right side)
  const outcomeW = outcome ? Math.min(w * 0.12, 80) : 0;

  // Area widths
  const mainW = w - PAD * 2 - outcomeW;

  // Support activities: top portion (60% of height)
  const supportH = plotH * 0.55;
  // Primary activities: bottom portion (40% of height)
  const primaryH = plotH * 0.4;
  const gap = plotH * 0.05;

  const supportTop = plotTop;
  const primaryTop = plotTop + supportH + gap;

  // Support activity stripes
  if (support.length > 0) {
    const stripeH = supportH / support.length;
    for (let i = 0; i < support.length; i++) {
      const sy = supportTop + i * stripeH;
      const alpha = 0.12 + (i / support.length) * 0.15;

      // Stripe background
      ctx.save();
      ctx.fillStyle = rgbaCss(accent, alpha);
      ctx.fillRect(x + PAD, sy, mainW, stripeH - 2);
      ctx.restore();

      // Stripe border
      ctx.save();
      ctx.strokeStyle = rgbaCss(accent, 0.25);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + PAD, sy, mainW, stripeH - 2);
      ctx.restore();

      // Stripe label
      const labelFontSize = Math.min(Math.round(stripeH * 0.38), 13);
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.8);
      ctx.font = `600 ${labelFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(support[i] || ''), x + PAD + 10, sy + stripeH / 2 - 1);
      ctx.restore();
    }
  }

  // Primary activities row
  const N = primary.length;
  const arrowW = Math.round(primaryH * 0.18);
  const boxTotalW = mainW;
  const boxUnitW = boxTotalW / N;
  const boxContentW = boxUnitW - arrowW;

  for (let i = 0; i < N; i++) {
    const bx = x + PAD + i * boxUnitW;
    const by = primaryTop;
    const bw = boxContentW;
    const bh = primaryH;

    // Box background
    const colorIdx = i % Math.max(1, palette.colors?.length || 1);
    const boxColor = palette.colors?.[colorIdx] || accent;
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.1);
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = rgbCss(lighten(boxColor, 0.1));
    roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fill();
    ctx.restore();

    // Arrow connecting to next box (not on last)
    if (i < N - 1) {
      const ax = bx + bw;
      const ay = by + bh / 2;
      const arrowTip = ax + arrowW;
      ctx.save();
      ctx.fillStyle = rgbaCss(boxColor, 0.5);
      ctx.beginPath();
      ctx.moveTo(ax, by + 4);
      ctx.lineTo(arrowTip, ay);
      ctx.lineTo(ax, by + bh - 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Label text
    const labelFontSize = Math.min(
      Math.round(bh * 0.18),
      Math.round(bw / Math.max(8, primary[i].length * 0.55)),
      13,
    );
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, String(primary[i] || ''), bw - 8, 2);
    const lineH = labelFontSize * 1.3;
    const startY = by + bh / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, li) => {
      ctx.fillText(line, bx + bw / 2, startY + li * lineH);
    });
    ctx.restore();
  }

  // Outcome box (right side, full height of plotH)
  if (outcome) {
    const ox = x + PAD + mainW + 4;
    const oy = plotTop;
    const oh = plotH;
    const ow = outcomeW - 4;

    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = rgbCss(accent);
    roundRect(ctx, ox, oy, ow, oh, 4);
    ctx.fill();
    ctx.restore();

    // Rotated label
    ctx.save();
    ctx.translate(ox + ow / 2, oy + oh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${Math.round(ow * 0.38)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(outcome, 0, 0);
    ctx.restore();
  }
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

function wrapText(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      if (lines.length >= maxLines) break;
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
