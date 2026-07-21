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
  // 对抗 R1 (2026-07-14): summit 标签画在 peakY - 0.09*plotH - 6, 落点在
  // plotTop 之上 — 与标题行相撞 (Partnership Path Forward × 峰顶标签)。
  // summit 非空时预留一条独立行带, 山体整体下移。
  if (summit) plotTop += Math.round(h * 0.052) + 10;

  const plotH = y + h - plotTop - PAD;
  const cx = x + w / 2;
  const peakY = plotTop + plotH * 0.1;
  const baseY = plotTop + plotH * 0.95;
  const baseLeft = x + w * 0.06;
  const baseRight = x + w * 0.94;
  const hues = (palette.colors || []).filter(Array.isArray);

  // ── Sprint 74 redesign (user: 三角形不够美观) ──
  // Depth from layered ridges; the peak is a CURVED profile, not a triangle;
  // the trail is a smooth switchback; the summit carries a pennant.

  // Back ridges — two soft distant silhouettes in faint hue tints
  const ridge = (px, py, spread, tint) => {
    ctx.fillStyle = rgbaCss(tint, 0.16);
    ctx.beginPath();
    ctx.moveTo(px - spread, baseY);
    ctx.quadraticCurveTo(px - spread * 0.35, py + (baseY - py) * 0.25, px, py);
    ctx.quadraticCurveTo(px + spread * 0.4, py + (baseY - py) * 0.35, px + spread, baseY);
    ctx.closePath();
    ctx.fill();
  };
  ridge(cx - w * 0.26, peakY + plotH * 0.3, w * 0.34, hues[1] || accent);
  ridge(cx + w * 0.3, peakY + plotH * 0.22, w * 0.38, hues[2] || accent);

  // Main peak — curved concave flanks (a mountain, not a triangle)
  const grad = ctx.createLinearGradient(cx, peakY, cx, baseY);
  grad.addColorStop(0, rgbCss(lighten(accent, 0.05)));
  grad.addColorStop(0.55, rgbCss(lighten(accent, 0.3)));
  grad.addColorStop(1, rgbCss(lighten(accent, 0.55)));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(baseLeft, baseY);
  ctx.quadraticCurveTo(cx - w * 0.16, peakY + plotH * 0.42, cx - w * 0.025, peakY + plotH * 0.02);
  ctx.quadraticCurveTo(cx, peakY - plotH * 0.015, cx + w * 0.03, peakY + plotH * 0.03);
  ctx.quadraticCurveTo(cx + w * 0.18, peakY + plotH * 0.48, baseRight, baseY);
  ctx.closePath();
  ctx.fill();

  // Face ridge-line — a subtle lit edge falling from the summit
  ctx.strokeStyle = rgbaCss([255, 255, 255], 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, peakY);
  ctx.quadraticCurveTo(cx - w * 0.03, peakY + plotH * 0.35, cx - w * 0.09, baseY);
  ctx.stroke();

  // Switchback waypoints
  const N = milestones.length;
  const waypoints = [];
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const wy = baseY - t * (baseY - peakY) * 0.92;
    const xOffset = (i % 2 === 0 ? 1 : -1) * w * 0.15 * (1 - t * 0.55);
    waypoints.push({ wx: cx + xOffset, wy });
  }

  // Trail — one smooth curve through the switchbacks, soft glow underneath
  const trail = () => {
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.02, baseY);
    let prev = { wx: cx - w * 0.02, wy: baseY };
    for (const wp of waypoints) {
      ctx.quadraticCurveTo(prev.wx, (prev.wy + wp.wy) / 2, wp.wx, wp.wy);
      prev = wp;
    }
    ctx.quadraticCurveTo(prev.wx, (prev.wy + peakY) / 2 + 6, cx, peakY + 6);
  };
  ctx.save();
  ctx.strokeStyle = rgbaCss([255, 255, 255], 0.25);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  trail();
  ctx.stroke();
  ctx.strokeStyle = rgbCss([255, 255, 255]);
  ctx.lineWidth = 2.2;
  ctx.setLineDash([7, 5]);
  trail();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Milestone markers — hue-rotated dots with white ring + halo, labels as before
  for (let i = 0; i < waypoints.length; i++) {
    const { wx, wy } = waypoints[i];
    const m = milestones[i];
    if (!m) continue;
    const onRight = i % 2 === 0;
    const hue = hues.length > 1 ? hues[(i + 1) % hues.length] : accent;

    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
    ctx.shadowBlur = 6;
    ctx.fillStyle = rgbCss([255, 255, 255]);
    ctx.beginPath();
    ctx.arc(wx, wy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = rgbCss(hue);
    ctx.beginPath();
    ctx.arc(wx, wy, 5.5, 0, Math.PI * 2);
    ctx.fill();

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
    const labelX = onRight ? wx + 14 : wx - 14;
    ctx.fillText(m.label ?? '', labelX, wy - (m.sublabel ? labelFs * 0.5 : 0));

    if (m.sublabel) {
      const subFs = Math.max(9, labelFs - 2);
      ctx.font = `500 ${subFs}px Inter, system-ui`;
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.fillText(m.sublabel, labelX, wy + labelFs * 0.6);
    }
  }

  // Summit pennant — pole + flag, the climb has a destination
  ctx.save();
  ctx.strokeStyle = rgbCss(fg);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, peakY + 4);
  ctx.lineTo(cx, peakY - plotH * 0.09);
  ctx.stroke();
  const flagH = plotH * 0.05;
  ctx.fillStyle = rgbCss(hues[1] || accent);
  ctx.beginPath();
  ctx.moveTo(cx, peakY - plotH * 0.09);
  ctx.lineTo(cx + w * 0.05, peakY - plotH * 0.09 + flagH / 2);
  ctx.lineTo(cx, peakY - plotH * 0.09 + flagH);
  ctx.closePath();
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
  ctx.fillText(summit, cx, peakY - plotH * 0.09 - 6);
}
