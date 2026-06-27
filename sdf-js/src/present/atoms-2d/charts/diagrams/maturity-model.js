// =============================================================================
// atoms-2d/charts/diagrams/maturity-model.js — 5-stage capability maturity ladder
// -----------------------------------------------------------------------------
// PL signature: horizontal step-ladder ascending left to right.
// CMMI / digital maturity / AI maturity. Stages rise in height left to right.
//
// Args:
//   title?        — optional heading
//   stages        — array of { label, description? } (3-7, REQUIRED)
//   currentLevel? — 1-based index of current stage (draws marker)
//   label?        — optional footer label (e.g. "Current: Level 3")
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'maturity-model',
  category: 'charts/diagrams',
  description:
    '5-stage capability maturity ladder (CMMI / digital maturity). Horizontal step-ladder ascending left to right.',
  args: {
    title: { type: 'string?', example: 'AI Maturity Assessment' },
    stages: {
      type: 'array of { label, description? } (3-7)',
      required: true,
      example: [
        { label: 'Initial', description: 'Ad hoc processes' },
        { label: 'Managed', description: 'Basic tracking' },
        { label: 'Defined', description: 'Standardized' },
        { label: 'Quantitative', description: 'Data-driven' },
        { label: 'Optimizing', description: 'Continuous improvement' },
      ],
    },
    currentLevel: { type: 'number?', example: 3 },
    label: { type: 'string?', example: 'Current: Level 3 — Defined' },
  },
};

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function wrapText(ctx, text, maxW) {
  const words = String(text || '').split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
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
  const colors = palette.colors ?? [
    [100, 160, 220],
    [60, 180, 140],
    [220, 160, 40],
    [200, 100, 60],
    [160, 80, 200],
    [80, 200, 160],
    [200, 80, 120],
  ];

  const stages = Array.isArray(args.stages) ? args.stages.slice(0, 7) : [];
  const currentLevel = typeof args.currentLevel === 'number' ? args.currentLevel : null;

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  let plotTop = y + PAD;

  // Title
  if (args.title) {
    const titleFs = Math.round(h * 0.065);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, plotTop);
    plotTop += titleFs + PAD * 0.6;
  }

  const n = stages.length;
  if (n === 0) return;

  // Footer label area
  const footerH = args.label ? Math.round(h * 0.08) : 0;
  const plotH = y + h - plotTop - PAD - footerH;

  // Step ladder: each step fills a column, height increases left to right
  const stepW = (w - PAD * 2) / n;
  const minStepH = plotH * 0.22;
  const maxStepH = plotH * 0.82;

  for (let i = 0; i < n; i++) {
    const stage = stages[i];
    if (!stage) continue;

    // Step height rises linearly from min to max
    const t = n > 1 ? i / (n - 1) : 0.5;
    const stepH = minStepH + t * (maxStepH - minStepH);
    const stepX = x + PAD + i * stepW;
    const stepY = plotTop + plotH - stepH;
    const stepColor = colors[i % colors.length] ?? accent;

    // Shadow
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    // Step fill with gradient
    const gradient = ctx.createLinearGradient(stepX, stepY, stepX, stepY + stepH);
    gradient.addColorStop(0, rgbCss(lighten(stepColor, 0.18)));
    gradient.addColorStop(1, rgbCss(stepColor));
    ctx.fillStyle = gradient;

    // Rounded top corners only
    ctx.beginPath();
    const r = 6;
    ctx.moveTo(stepX + r, stepY);
    ctx.lineTo(stepX + stepW - r, stepY);
    ctx.quadraticCurveTo(stepX + stepW, stepY, stepX + stepW, stepY + r);
    ctx.lineTo(stepX + stepW, stepY + stepH);
    ctx.lineTo(stepX, stepY + stepH);
    ctx.lineTo(stepX, stepY + r);
    ctx.quadraticCurveTo(stepX, stepY, stepX + r, stepY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Current level marker: downward triangle above step
    if (currentLevel === i + 1) {
      const markerX = stepX + stepW / 2;
      const markerY = stepY - 6;
      const triSize = 10;
      ctx.save();
      ctx.fillStyle = rgbCss(accent);
      ctx.beginPath();
      ctx.moveTo(markerX - triSize, markerY - triSize * 1.2);
      ctx.lineTo(markerX + triSize, markerY - triSize * 1.2);
      ctx.lineTo(markerX, markerY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Stage label (inside step, near top, white Inter 700)
    const labelFs = Math.min(Math.round(stepW * 0.16), 14);
    ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelMaxW = stepW - 10;
    const labelText = stage.label ?? '';
    ctx.fillText(labelText, stepX + stepW / 2, stepY + 10);

    // Description (word-wrapped, smaller, below label)
    if (stage.description && stepH > 70) {
      const descFs = Math.max(9, labelFs - 3);
      ctx.font = `500 ${descFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      const descLines = wrapText(ctx, stage.description, labelMaxW);
      const descTop = stepY + 10 + labelFs + 4;
      for (let li = 0; li < Math.min(descLines.length, 2); li++) {
        ctx.fillText(descLines[li], stepX + stepW / 2, descTop + li * (descFs * 1.3));
      }
    }

    // Step number below baseline
    const numFs = Math.max(9, labelFs - 2);
    ctx.font = `600 ${numFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbaCss(fg, 0.45);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${i + 1}`, stepX + stepW / 2, plotTop + plotH + 4);
  }

  // Footer label
  if (args.label) {
    const lFs = Math.round(h * 0.042);
    ctx.font = `500 ${lFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbaCss(accent, 0.9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(args.label), x + w / 2, y + h - 6);
  }
}
