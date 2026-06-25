// =============================================================================
// atoms-2d/charts/diagrams/okr-tree.js — OKR: Objective + Key Results
// -----------------------------------------------------------------------------
// 1 top Objective (accent pill, full width) + N Key Result cards in a row,
// each with a progress bar.
//
// Args:
//   objective  — string (REQUIRED)
//   keyResults — array of { label, progress: 0-1, sublabel? } (2-6, REQUIRED)
//   quarter?   — string (displayed in objective card, e.g. "Q3 2026")
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'okr-tree',
  category: 'charts/diagrams',
  description:
    'OKR (Objective + Key Results) hierarchical visualization. 1 top objective + N child KRs with progress bars.',
  args: {
    objective: {
      type: 'string',
      required: true,
      example: 'Become market leader in self-custodial trading',
    },
    keyResults: {
      type: 'array of { label, progress: number (0-1), sublabel? } (2-6)',
      required: true,
      example: [
        { label: 'Cross $50M ARR', progress: 0.48, sublabel: '$24M / $50M' },
        { label: 'NPS > 70', progress: 0.86, sublabel: 'Current: 68' },
        { label: '24/7 support SLA', progress: 0.65, sublabel: '4h avg vs 2h target' },
      ],
    },
    quarter: { type: 'string?', example: 'Q3 2026' },
  },
};

function fitFontSize(ctx, text, maxW, target, min, specFn) {
  let fs = target;
  while (fs > min) {
    ctx.font = specFn(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return min;
}

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const accent = palette.accent ?? [42, 130, 200];
  const fg = palette.silhouetteColor ?? [20, 28, 50];
  const bg = palette.bg ?? [248, 246, 240];
  const krs = Array.isArray(args.keyResults) ? args.keyResults.slice(0, 6) : [];
  const objective = args.objective || '';
  const quarter = args.quarter || '';

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  const OBJ_H = Math.round(h * 0.16);
  const OBJ_RADIUS = 8;
  const objY = y + PAD;
  const objX = x + PAD;
  const objW = w - PAD * 2;

  // ── Objective pill ──
  ctx.save();
  ctx.fillStyle = rgbCss(accent);
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.roundRect(objX, objY, objW, OBJ_H, OBJ_RADIUS);
  ctx.fill();
  ctx.restore();

  // Objective text
  const objTextMaxW = objW - (quarter ? objW * 0.22 : PAD * 4);
  const objFs = fitFontSize(
    ctx,
    objective,
    objTextMaxW,
    Math.round(OBJ_H * 0.34),
    10,
    (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
  );
  ctx.font = `700 ${objFs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbCss([255, 255, 255]);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(objective, objX + PAD, objY + OBJ_H / 2);

  // Quarter badge (top-right of objective)
  if (quarter) {
    ctx.font = `600 ${Math.max(10, Math.round(OBJ_H * 0.24))}px Inter, system-ui`;
    ctx.fillStyle = rgbaCss([255, 255, 255], 0.7);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(quarter, objX + objW - PAD, objY + OBJ_H / 2);
  }

  if (!krs.length) return;

  // ── Connector lines from objective bottom to each KR top ──
  const krAreaTop = objY + OBJ_H + PAD;
  const krH = y + h - krAreaTop - PAD;
  const krGap = 12;
  const krW = (w - PAD * 2 - krGap * (krs.length - 1)) / krs.length;
  const BAR_H = 6;
  const BAR_R = BAR_H / 2;
  const CARD_R = 6;

  for (let ki = 0; ki < krs.length; ki++) {
    const kx = x + PAD + ki * (krW + krGap);
    const topCX = kx + krW / 2;

    // Connector
    ctx.save();
    ctx.strokeStyle = rgbaCss(accent, 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(kx + krW / 2, objY + OBJ_H);
    ctx.lineTo(topCX, krAreaTop);
    ctx.stroke();
    ctx.restore();
  }

  // ── KR cards ──
  for (let ki = 0; ki < krs.length; ki++) {
    const kr = krs[ki];
    const kx = x + PAD + ki * (krW + krGap);
    const progress = Math.max(0, Math.min(1, Number(kr.progress) || 0));

    // Card background
    ctx.save();
    ctx.fillStyle = rgbCss([255, 255, 255]);
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.1);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.roundRect(kx, krAreaTop, krW, krH, CARD_R);
    ctx.fill();
    ctx.restore();

    // Left accent border
    ctx.fillStyle = rgbCss(accent);
    ctx.fillRect(kx, krAreaTop, 4, krH);

    // KR label
    const INNER_PAD = 10;
    const labelMaxW = krW - INNER_PAD * 2 - 4;
    const labelFs = fitFontSize(
      ctx,
      kr.label ?? '',
      labelMaxW,
      Math.round(krH * 0.14),
      9,
      (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
    );
    ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(kr.label ?? '', kx + 4 + INNER_PAD, krAreaTop + INNER_PAD);

    // Sublabel
    if (kr.sublabel) {
      const subFs = Math.max(9, Math.round(labelFs * 0.85));
      ctx.font = `500 ${subFs}px Inter, system-ui`;
      ctx.fillStyle = rgbaCss(fg, 0.5);
      ctx.fillText(kr.sublabel, kx + 4 + INNER_PAD, krAreaTop + INNER_PAD + labelFs + 4);
    }

    // Progress bar (near bottom of card)
    const barY = krAreaTop + krH - INNER_PAD - BAR_H;
    const barX = kx + 4 + INNER_PAD;
    const barW = krW - 4 - INNER_PAD * 2;

    // Track
    ctx.fillStyle = rgbaCss(fg, 0.1);
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, BAR_H, BAR_R);
    ctx.fill();

    // Fill
    if (progress > 0) {
      ctx.fillStyle = rgbCss(accent);
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(BAR_H, barW * progress), BAR_H, BAR_R);
      ctx.fill();
    }

    // Progress %
    const pctFs = Math.max(9, Math.round(krH * 0.1));
    ctx.font = `700 ${pctFs}px Inter, system-ui`;
    ctx.fillStyle = rgbCss(accent);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(progress * 100)}%`, kx + krW - INNER_PAD, barY - pctFs * 0.6);
  }
}
