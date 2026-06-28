// =============================================================================
// atoms-2d/charts/lists/pillar-3up.js — Three Pillars / Three Principles hero
// -----------------------------------------------------------------------------
// 2-4 vertical pillar cards side by side. Each pillar: top accent rule +
// icon badge + bold heading + body paragraph. PL "three pillars" hero pattern.
// Different from feature-card-grid: taller hero cards, less items, bold accent.
//
// Args:
//   title      — optional heading
//   pillars    — array of { icon, heading, body, accent? } (2-4) REQUIRED
//   accentLine — show top color rule (default true)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { resolveIcon } from '../../../../icons/index.js';

export const spec = {
  type: 'pillar-3up',
  category: 'charts/lists',
  description:
    'Three vertical pillar cards side-by-side. Hero "three pillars" / "three principles" / "three steps" pattern.',
  args: {
    title: { type: 'string?', example: 'Our Three Pillars' },
    pillars: {
      type: 'array of { icon, heading, body, accent? } (2-4)',
      required: true,
      example: [
        {
          icon: 'lightning',
          heading: 'Speed',
          body: 'Sub-100ms response across all queries, globally distributed edge.',
        },
        {
          icon: 'shield-check',
          heading: 'Security',
          body: 'SOC 2 Type II + zero-trust + encryption at rest and in transit.',
        },
        {
          icon: 'globe',
          heading: 'Scale',
          body: '100+ regions, auto-scaling infrastructure, no operational burden.',
        },
      ],
    },
    accentLine: { type: 'boolean?', default: true },
  },
};

function lighten([r, g, b], amount = 0.88) {
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ];
}

function wrapText(ctx, text, maxW, maxLines = 4) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawIconCentered(ctx, iconName, cx, cy, size, color) {
  const resolved = resolveIcon(iconName);
  if (!resolved || !resolved.path) return;
  const viewBox = resolved.source === 'brand' ? 24 : 256;
  const scale = size / viewBox;
  try {
    ctx.save();
    ctx.fillStyle = rgbCss(color);
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(scale, scale);
    ctx.fill(resolved.path);
    ctx.restore();
  } catch (_) {
    ctx.restore();
  }
}

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
    [60, 180, 140],
    [200, 120, 60],
    [160, 80, 200],
  ];
  const pillars = Array.isArray(args.pillars) ? args.pillars : [];
  const accentLine = args.accentLine !== false;

  ctx.fillStyle = rgbCss(bgColor);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  let plotTop = y + PAD;

  if (args.title) {
    const titleFs = Math.round(h * 0.07);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + w / 2, plotTop);
    plotTop += titleFs + PAD;
  }

  if (!pillars.length) return;

  const n = Math.min(4, Math.max(2, pillars.length));
  const GAP = 16;
  const colW = (w - PAD * 2 - GAP * (n - 1)) / n;
  const availH = h - (plotTop - y) - PAD;
  const CARD_PAD = 18;

  for (let i = 0; i < n; i++) {
    const p = pillars[i] || {};
    const colX = x + PAD + i * (colW + GAP);
    const colY = plotTop;
    const pillarColor = colors[i % colors.length] || accent;

    // Card background
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(colX, colY, colW, availH, 10);
    ctx.fill();
    ctx.restore();

    let curY = colY;

    // Top accent rule
    if (accentLine) {
      ctx.save();
      ctx.fillStyle = rgbCss(pillarColor);
      ctx.beginPath();
      ctx.roundRect(colX, colY, colW, 5, [5, 5, 0, 0]);
      ctx.fill();
      ctx.restore();
      curY += 5;
    }

    curY += CARD_PAD;

    // Icon
    const iconSize = Math.min(availH * 0.14, colW * 0.3, 42);
    const iconCX = colX + colW / 2;
    const iconCY = curY + iconSize / 2;

    if (p.icon) {
      const badgeBg = lighten(pillarColor, 0.88);
      ctx.fillStyle = rgbCss(badgeBg);
      ctx.beginPath();
      ctx.arc(iconCX, iconCY, iconSize / 2 + 6, 0, Math.PI * 2);
      ctx.fill();
      drawIconCentered(ctx, p.icon, iconCX, iconCY, iconSize, pillarColor);
    }
    curY += iconSize + CARD_PAD;

    // Heading
    const headingFs = Math.min(Math.round(availH * 0.085), 22);
    ctx.font = `700 ${headingFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (p.heading) {
      ctx.fillText(p.heading, iconCX, curY);
      curY += headingFs + 8;
    }

    // Body
    const bodyFs = Math.min(Math.round(availH * 0.048), 14);
    ctx.font = `500 ${bodyFs}px Inter, system-ui`;
    ctx.fillStyle = rgbaCss(fg, 0.55);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (p.body) {
      const lines = wrapText(ctx, p.body, colW - CARD_PAD * 2, 4);
      for (const line of lines) {
        ctx.fillText(line, iconCX, curY);
        curY += bodyFs + 3;
      }
    }
  }
}
