// =============================================================================
// atoms-2d/charts/diagrams/decision-tree-3-arm.js — Decision / GROW coaching N-arm tree
// -----------------------------------------------------------------------------
// PL signature: central question card with N arms (3-5) radiating downward.
// Used for decision frameworks, GROW coaching model, Yes/No/Maybe forks,
// fork-in-the-road slides.
//
// Args:
//   title?    — optional heading
//   question  — central question text (REQUIRED)
//   arms      — array of { label, sublabel? } (3-5, REQUIRED)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'decision-tree-3-arm',
  category: 'charts/diagrams',
  description:
    'Central question + N branching arms (3-5). Used for decision frameworks, GROW coaching model, Yes/No/Maybe forks, fork-in-the-road slides.',
  args: {
    title: { type: 'string?', example: 'Which path forward?' },
    question: { type: 'string', required: true, example: 'What is the best growth strategy?' },
    arms: {
      type: 'array of { label, sublabel? } (3-5)',
      required: true,
      example: [
        { label: 'Expand Market', sublabel: 'New geographies' },
        { label: 'Deepen Product', sublabel: 'More features' },
        { label: 'Grow Team', sublabel: 'Scale headcount' },
      ],
    },
  },
};

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

function fitFontSize(ctx, text, maxW, target, min, specFn) {
  let fs = target;
  while (fs > min) {
    ctx.font = specFn(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return min;
}

// angle offsets from straight-down (degrees), indexed by arm count
const ARM_ANGLES = {
  3: [-60, 0, 60],
  4: [-60, -20, 20, 60],
  5: [-75, -37, 0, 37, 75],
};

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
    [42, 130, 200],
    [60, 180, 140],
    [200, 120, 60],
    [180, 80, 160],
    [220, 160, 40],
  ];

  const arms = Array.isArray(args.arms) ? args.arms.slice(0, 5) : [];
  const question = args.question || '';

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  let plotTop = y + PAD;

  // Title bar
  if (args.title) {
    const titleFs = Math.round(h * 0.065);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, plotTop);
    plotTop += titleFs + PAD * 0.5;
  }

  // Central question card dimensions
  const cardW = w * 0.42;
  const cardH = h * 0.16;
  const cx = x + w / 2;
  const cy_center = plotTop + (h - (plotTop - y)) * 0.28;

  // Draw central question card
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = rgbCss(accent);
  roundedRectPath(ctx, cx - cardW / 2, cy_center - cardH / 2, cardW, cardH, 10);
  ctx.fill();
  ctx.restore();

  // Question text
  const qMaxW = cardW - 24;
  const qFs = fitFontSize(
    ctx,
    question,
    qMaxW,
    Math.round(h * 0.05),
    10,
    (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
  );
  ctx.font = `700 ${qFs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(question, cx, cy_center);

  // Arm cards layout
  const n = Math.max(3, Math.min(5, arms.length || 3));
  const angles = ARM_ANGLES[n] || ARM_ANGLES[3];
  const r_vertical = h * 0.34;
  const armCardW = Math.min((w - PAD * 2) / (n + 0.5), w * 0.22);
  const armCardH = h * 0.18;

  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    if (!arm) continue;
    const angleDeg = angles[i] ?? 0;
    const angleRad = (angleDeg * Math.PI) / 180;

    // Arm card center
    const acx = cx + Math.sin(angleRad) * (w * 0.36);
    const acy = cy_center + r_vertical;

    // Connecting line from central card bottom to arm card top
    ctx.save();
    ctx.strokeStyle = rgbCss(accent);
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(angleRad) * (cardW * 0.35), cy_center + cardH / 2);
    ctx.lineTo(acx, acy - armCardH / 2);
    ctx.stroke();
    ctx.restore();

    // Arm card background
    const armColor = colors[i % colors.length] ?? accent;
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.13);
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = rgbaCss(armColor, 0.12);
    roundedRectPath(ctx, acx - armCardW / 2, acy - armCardH / 2, armCardW, armCardH, 8);
    ctx.fill();
    ctx.restore();

    // Arm card border
    ctx.strokeStyle = rgbCss(armColor);
    ctx.lineWidth = 2;
    roundedRectPath(ctx, acx - armCardW / 2, acy - armCardH / 2, armCardW, armCardH, 8);
    ctx.stroke();

    // Arm label
    const labelMaxW = armCardW - 16;
    const labelFs = fitFontSize(
      ctx,
      arm.label ?? '',
      labelMaxW,
      Math.round(h * 0.038),
      9,
      (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
    );
    ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelCy = arm.sublabel ? acy - labelFs * 0.4 : acy;
    ctx.fillText(arm.label ?? '', acx, labelCy);

    // Arm sublabel
    if (arm.sublabel) {
      const subFs = Math.max(9, labelFs - 2);
      ctx.font = `500 ${subFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = rgbaCss(fg, 0.58);
      ctx.fillText(arm.sublabel, acx, acy + labelFs * 0.65);
    }
  }
}
