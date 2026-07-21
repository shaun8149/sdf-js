// =============================================================================
// atoms-2d/charts/typography/section-number-divider.js
// Mid-deck section divider: large bold number + section title + optional subtitle.
// Full-bleed dark background — text-only, no photo.
//
// Args:
//   number      — section number string e.g. "01" (REQUIRED)
//   title       — section title text (REQUIRED)
//   subtitle?   — optional subtitle / description
//   bg?         — override background color [r,g,b]
//   numberColor? — override number color [r,g,b]
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'section-number-divider',
  category: 'charts/typography',
  description:
    'Mid-deck section divider — large bold number, section title, optional subtitle on dark full-bleed background.',
  args: {
    number: { type: 'string', required: true, example: '01' },
    title: { type: 'string', required: true, example: 'Financial Highlights' },
    subtitle: { type: 'string?', example: 'Key metrics for the reporting period' },
    bg: { type: 'array?', example: [13, 26, 40] },
    numberColor: { type: 'array?', example: [42, 184, 168] },
  },
};

const PAD = 40;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const paletteAccent = palette.accent || palette.colors?.[0] || [42, 184, 168];
  const paletteStdBg = palette.bg || [248, 246, 240];

  // Resolve colors — prefer explicit args, then palette, then hard default
  const bgColor = Array.isArray(args.bg)
    ? args.bg
    : // Use dark bg from palette if it looks dark (all channels < 80), else use pitch black
      Array.isArray(paletteStdBg) &&
        paletteStdBg[0] < 80 &&
        paletteStdBg[1] < 80 &&
        paletteStdBg[2] < 80
      ? paletteStdBg
      : [20, 30, 44];
  const numberColor = Array.isArray(args.numberColor) ? args.numberColor : paletteAccent;
  const titleColor = [255, 255, 255];
  const subtitleColor = [200, 215, 220];

  const num = String(args.number || '01');
  const title = String(args.title || '');
  const subtitle = args.subtitle ? String(args.subtitle) : '';

  // Full-bleed background
  ctx.fillStyle = rgbCss(bgColor);
  ctx.fillRect(x, y, w, h);

  // Large number — positioned in upper-left quadrant, very large
  const numFontSize = Math.round(h * 0.38);
  ctx.save();
  ctx.fillStyle = rgbaCss(numberColor, 0.92);
  ctx.font = `900 ${numFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(num, x + PAD, y + h * 0.08);
  ctx.restore();

  // Accent rule
  const ruleY = y + h * 0.08 + numFontSize * 0.6;
  ctx.save();
  ctx.fillStyle = rgbCss(numberColor);
  ctx.fillRect(x + PAD, ruleY, 80, 3.5);
  ctx.restore();

  // Section title
  const titleFontSize = Math.round(h * 0.1);
  ctx.save();
  ctx.fillStyle = rgbCss(titleColor);
  ctx.font = `700 ${titleFontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, x + PAD, ruleY + 16);
  ctx.restore();

  // Subtitle
  if (subtitle) {
    const subFontSize = Math.round(h * 0.045);
    ctx.save();
    ctx.fillStyle = rgbCss(subtitleColor);
    ctx.font = `500 ${subFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(subtitle, x + PAD, ruleY + 16 + titleFontSize * 1.4);
    ctx.restore();
  }
}
