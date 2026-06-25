// =============================================================================
// atoms-2d/charts/diagrams/circle-process-cycle.js — Circular PDCA-style process
// -----------------------------------------------------------------------------
// N steps arranged in a circle with clockwise arrows between them.
// Complement to linear process-arrows. PDCA / OODA / continuous improvement.
//
// Args:
//   title?       — optional title bar
//   steps        — array of { label, sublabel? } (3-7) REQUIRED
//   centerLabel? — text in center circle (e.g. 'CONTINUOUS IMPROVEMENT')
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'circle-process-cycle',
  category: 'charts/diagrams',
  description:
    'Circular PDCA-style process — N steps in a circle with clockwise arrows. Complement to process-arrows.',
  args: {
    title: { type: 'string?', example: 'Continuous Improvement' },
    steps: {
      type: 'array of { label, sublabel? } (3-7)',
      required: true,
      example: [{ label: 'Plan' }, { label: 'Do' }, { label: 'Check' }, { label: 'Act' }],
    },
    centerLabel: { type: 'string?', example: 'PDCA' },
  },
};

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];
  const colors = palette.colors || [accent];

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const rawSteps = Array.isArray(args.steps) ? args.steps.slice(0, 7) : [];
  const steps = rawSteps.map((s) => ({
    label: String(s.label || ''),
    sublabel: s.sublabel ? String(s.sublabel) : '',
  }));
  const N = steps.length;
  if (N === 0) return;

  // Title bar
  let plotTop = y;
  if (args.title) {
    const titleFontSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.title), x + 20, y + 16);
    plotTop = y + titleFontSize + 28;
  }

  const availH = h - (plotTop - y);
  const cx = x + w / 2;
  const cy = plotTop + availH / 2;

  // Step circles radius
  const stepR = Math.min(w, availH) * 0.09;
  // Orbit radius where centers live
  const orbitR = Math.min(w * 0.32, availH * 0.38);
  // Center circle radius
  const centerR = args.centerLabel ? orbitR * 0.28 : 0;

  // Compute step center positions (start at top, clockwise)
  const centers = [];
  for (let i = 0; i < N; i++) {
    const angle = (2 * Math.PI * i) / N - Math.PI / 2;
    centers.push({ px: cx + orbitR * Math.cos(angle), py: cy + orbitR * Math.sin(angle), angle });
  }

  // Draw curved arrows between consecutive steps (clockwise)
  for (let i = 0; i < N; i++) {
    const from = centers[i];
    const to = centers[(i + 1) % N];

    // Bezier control point pushed outward (1.3× orbit radius)
    const midAngle = from.angle + Math.PI / N;
    const cpDist = orbitR * 1.35;
    const cpx = cx + cpDist * Math.cos(midAngle);
    const cpy = cy + cpDist * Math.sin(midAngle);

    // Direction vector from control point to destination (for arrow head)
    const dx = to.px - cpx;
    const dy = to.py - cpy;
    const dLen = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dLen;
    const ny = dy / dLen;

    // End point at step circle edge
    const endX = to.px - nx * stepR;
    const endY = to.py - ny * stepR;

    ctx.save();
    ctx.strokeStyle = rgbaCss(accent, 0.55);
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(from.px + nx * stepR * 0.1, from.py + ny * stepR * 0.1);
    ctx.quadraticCurveTo(cpx, cpy, endX, endY);
    ctx.stroke();

    // Arrow head
    const aLen = stepR * 0.45;
    const aW = stepR * 0.28;
    const arrowAngle = Math.atan2(endY - cpy, endX - cpx);
    ctx.fillStyle = rgbaCss(accent, 0.75);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - aLen * Math.cos(arrowAngle) + aW * Math.sin(arrowAngle),
      endY - aLen * Math.sin(arrowAngle) - aW * Math.cos(arrowAngle),
    );
    ctx.lineTo(
      endX - aLen * Math.cos(arrowAngle) - aW * Math.sin(arrowAngle),
      endY - aLen * Math.sin(arrowAngle) + aW * Math.cos(arrowAngle),
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Draw step circles + labels
  for (let i = 0; i < N; i++) {
    const { px, py } = centers[i];
    const color = colors[i % colors.length];

    // Circle fill
    ctx.save();
    ctx.fillStyle = Array.isArray(color) ? rgbCss(color) : rgbCss(accent);
    ctx.beginPath();
    ctx.arc(px, py, stepR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Step label inside circle — auto-shrink
    const labelFontSize = Math.round(stepR * 0.5);
    const maxLabelW = stepR * 1.6;
    let lfs = labelFontSize;
    ctx.font = `700 ${lfs}px Inter, system-ui, sans-serif`;
    while (lfs > 8 && ctx.measureText(steps[i].label).width > maxLabelW) {
      lfs--;
      ctx.font = `700 ${lfs}px Inter, system-ui, sans-serif`;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${lfs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(steps[i].label, px, steps[i].sublabel ? py - lfs * 0.35 : py);
    ctx.restore();

    // Sublabel below circle
    if (steps[i].sublabel) {
      const subFontSize = Math.round(stepR * 0.3);
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.font = `500 ${subFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(steps[i].sublabel, px, py + stepR + 4);
      ctx.restore();
    }
  }

  // Center label circle
  if (args.centerLabel && centerR > 0) {
    ctx.save();
    ctx.fillStyle = rgbaCss(accent, 0.12);
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgbaCss(accent, 0.35);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const centerFontSize = Math.round(centerR * 0.35);
    const centerText = String(args.centerLabel);
    // Word-wrap center label (max 2 lines)
    const maxCenterW = centerR * 1.6;
    ctx.font = `700 ${centerFontSize}px Inter, system-ui, sans-serif`;
    const cLines = wrapText(ctx, centerText, maxCenterW, 2);
    const cLineH = centerFontSize * 1.3;
    cLines.forEach((line, i) => {
      const lineY = cy - ((cLines.length - 1) * cLineH) / 2 + i * cLineH;
      ctx.save();
      ctx.fillStyle = rgbCss(accent);
      ctx.font = `700 ${centerFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(line, cx, lineY);
      ctx.restore();
    });
  }
}

function wrapText(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      if (lines.length >= maxLines) return lines;
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}
