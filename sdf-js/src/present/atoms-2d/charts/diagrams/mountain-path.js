// =============================================================================
// atoms-2d/charts/diagrams/mountain-path.js — Goal climb / milestone mountain
// -----------------------------------------------------------------------------
// PL "Mountain Path Graphics" signature: N goals as a climb up a stylized peak.
// Title bar at top; mountain silhouette with switchback path; flag markers.
//
// Args:
//   title?      — optional heading
//   summit      — text at the peak (REQUIRED)
//   milestones  — array of { label, sublabel? } (3-6, REQUIRED)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'mountain-path',
  category: 'charts/diagrams',
  description:
    'Hero goal-progression visualization — N milestones as climb up a stylized mountain peak.',
  args: {
    title: { type: 'string?', example: 'Q4 Climb to Series A' },
    summit: { type: 'string', required: true, example: 'Series A · $15M' },
    milestones: {
      type: 'array of { label, sublabel? } (3-6)',
      required: true,
      example: [
        { label: '$1M ARR', sublabel: 'Mar' },
        { label: '10K users', sublabel: 'Jun' },
        { label: 'PMF', sublabel: 'Sep' },
        { label: 'Term sheet', sublabel: 'Dec' },
      ],
    },
  },
};

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function fitFontSize(ctx, text, maxW, target, min, spec) {
  let fs = target;
  while (fs > min) {
    ctx.font = spec(fs);
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
  const milestones = Array.isArray(args.milestones) ? args.milestones : [];
  const summit = args.summit || '';

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  let plotTop = y + PAD;

  // Title
  if (args.title) {
    const titleFs = Math.round(h * 0.07);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, plotTop);
    plotTop += titleFs + PAD * 0.5;
  }

  const plotH = y + h - plotTop - PAD;
  const cx = x + w / 2;
  const peakY = plotTop + plotH * 0.08;
  const baseY = plotTop + plotH * 0.95;
  const baseLeft = x + w * 0.08;
  const baseRight = x + w * 0.92;

  // Mountain silhouette
  const gradient = ctx.createLinearGradient(cx, peakY, cx, baseY);
  gradient.addColorStop(0, rgbCss(lighten(accent, 0.1)));
  gradient.addColorStop(1, rgbCss(lighten(accent, 0.45)));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(baseLeft, baseY);
  ctx.lineTo(cx - w * 0.12, peakY + plotH * 0.28);
  ctx.lineTo(cx, peakY);
  ctx.lineTo(cx + w * 0.12, peakY + plotH * 0.25);
  ctx.lineTo(baseRight, baseY);
  ctx.closePath();
  ctx.fill();

  // Mountain border
  ctx.strokeStyle = rgbaCss(accent, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Build switchback waypoints from base to summit
  const N = milestones.length;
  const waypoints = [];
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N; // 0..1 from base to peak
    const wy = baseY - t * (baseY - peakY);
    const xOffset = (i % 2 === 0 ? 1 : -1) * w * 0.16 * (1 - t * 0.6);
    waypoints.push({ wx: cx + xOffset, wy });
  }

  // Path line
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  if (waypoints.length) {
    for (const wp of waypoints) {
      ctx.lineTo(wp.wx, wp.wy);
    }
    ctx.lineTo(cx, peakY + 4);
  }
  ctx.strokeStyle = rgbCss([255, 255, 255]);
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.setLineDash([]);

  // Milestone markers + labels
  for (let i = 0; i < waypoints.length; i++) {
    const { wx, wy } = waypoints[i];
    const m = milestones[i];
    if (!m) continue;
    const onRight = i % 2 === 0;

    // Circle marker
    ctx.save();
    ctx.fillStyle = rgbCss([255, 255, 255]);
    ctx.strokeStyle = rgbCss(accent);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, wy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Label
    const labelMaxW = w * 0.22;
    const labelFs = fitFontSize(
      ctx,
      m.label ?? '',
      labelMaxW,
      Math.round(h * 0.032),
      9,
      (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
    );
    ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = onRight ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    const labelX = onRight ? wx + 12 : wx - 12;
    ctx.fillText(m.label ?? '', labelX, wy - (m.sublabel ? labelFs * 0.5 : 0));

    if (m.sublabel) {
      const subFs = Math.max(9, labelFs - 2);
      ctx.font = `500 ${subFs}px Inter, system-ui`;
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.fillText(m.sublabel, labelX, wy + labelFs * 0.6);
    }
  }

  // Summit marker
  const summitR = 12;
  ctx.save();
  ctx.fillStyle = rgbCss(accent);
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.3);
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, peakY, summitR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Summit label
  const summitFs = fitFontSize(
    ctx,
    summit,
    w * 0.5,
    Math.round(h * 0.052),
    10,
    (fs) => `900 ${fs}px "Inter Display", Inter, system-ui`,
  );
  ctx.font = `900 ${summitFs}px "Inter Display", Inter, system-ui`;
  ctx.fillStyle = rgbCss(fg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(summit, cx, peakY - summitR - 4);
}
