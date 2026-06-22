// =============================================================================
// atoms-2d/charts/diagrams/fishbone.js — Ishikawa / fishbone diagram
// -----------------------------------------------------------------------------
// 2D twin of fishbone-3d. Horizontal spine with effect box on the right, +
// diagonal ribs alternating top/bottom representing cause categories, +
// optional leaf causes per rib. Used for root-cause analysis.
//
// Args:
//   effect   — string (the problem / effect, REQUIRED, displayed in head box)
//   branches — array of { label, causes?:string[] } (REQUIRED, 2-8)
//   title    — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'fishbone',
  category: 'charts/diagrams',
  description: 'Ishikawa / fishbone diagram — root-cause analysis with branches and sub-causes.',
  args: {
    effect: { type: 'string', required: true, example: 'Low Conversion' },
    branches: {
      type: 'array of { label, causes?:string[] } (2-8)',
      required: true,
      example: [
        { label: 'Marketing', causes: ['Targeting', 'Channel mix'] },
        { label: 'Product', causes: ['Onboarding', 'Feature gaps'] },
        { label: 'Pricing', causes: ['Tier confusion'] },
        { label: 'Support', causes: ['Slow response'] },
      ],
    },
    title: { type: 'string?', example: 'Q3 Conversion Drop' },
  },
};

const PAD = 22;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [60, 130, 200];

  const effect = args.effect || '';
  const branches = Array.isArray(args.branches) ? args.branches.slice(0, 8) : [];
  const N = branches.length;
  if (N === 0) return;

  // Warm off-white background
  ctx.save();
  ctx.fillStyle = 'rgba(252, 250, 245, 0.95)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.restore();

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.07)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  // Layout: spine from left → right (with arrow head into effect box)
  const headBoxW = Math.min(w * 0.22, 200);
  const headBoxH = Math.min(h * 0.22, 90);
  const spineCY = plotTop + (y + h - plotTop) / 2;
  const spineL = x + PAD + 24;
  const spineR = x + w - PAD - headBoxW - 14;
  const spineLen = spineR - spineL;

  // Spine line + arrow — 2.5px, fg color
  ctx.save();
  ctx.strokeStyle = rgbCss(fg);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(spineL, spineCY);
  ctx.lineTo(spineR, spineCY);
  ctx.stroke();
  // Arrowhead
  ctx.fillStyle = rgbCss(fg);
  ctx.beginPath();
  const arrowH = h * 0.04;
  ctx.moveTo(spineR, spineCY - arrowH);
  ctx.lineTo(spineR + 14, spineCY);
  ctx.lineTo(spineR, spineCY + arrowH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Head (effect) box on right — drop shadow + accent gradient
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
  ctx.shadowBlur = 11;
  ctx.shadowOffsetY = 4;
  const headBoxX = spineR + 24;
  const headBoxY = spineCY - headBoxH / 2;
  const headGrad = ctx.createLinearGradient(headBoxX, headBoxY, headBoxX, headBoxY + headBoxH);
  headGrad.addColorStop(0, rgbCss(lighten(accent, 0.1)));
  headGrad.addColorStop(1, rgbCss(accent));
  ctx.fillStyle = headGrad;
  roundRect(ctx, headBoxX, headBoxY, headBoxW, headBoxH, headBoxH * 0.18);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'white';
  ctx.font = `700 ${Math.round(headBoxH * 0.3)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Wrap roughly: split on space if too long
  const headLines = wrapText(ctx, effect, headBoxW - 16);
  headLines.forEach((line, idx) => {
    ctx.fillText(
      line,
      headBoxX + headBoxW / 2,
      spineCY + (idx - (headLines.length - 1) / 2) * headBoxH * 0.32,
    );
  });

  // Ribs — alternating top/bottom along spine
  // Each rib goes from a point on the spine UP/DOWN-LEFT at ~30° diagonal
  const ribAngle = (Math.PI / 6) * 1.0; // 30° from horizontal
  const ribLen = Math.min(h * 0.34, spineLen * 0.18);

  // Use a single accent color (or up to 4 desaturated palette colors, not rainbow)
  const ribColors =
    palette.colors && palette.colors.length >= 2
      ? palette.colors.slice(0, 4).map((c) => desaturate(c, 0.5))
      : [accent];

  for (let i = 0; i < N; i++) {
    const b = branches[i] || {};
    const t = (i + 0.6) / (N + 0.6); // distribute along spine
    const baseX = spineL + t * spineLen;
    const up = i % 2 === 0;
    const ribEndX = baseX - Math.cos(ribAngle) * ribLen;
    const ribEndY = spineCY + (up ? -1 : 1) * Math.sin(ribAngle) * ribLen;

    // Rib line — accent color, 1.5-2px
    const ribColor = ribColors[i % ribColors.length];
    ctx.save();
    ctx.strokeStyle = rgbCss(ribColor);
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX, spineCY);
    ctx.lineTo(ribEndX, ribEndY);
    ctx.stroke();
    ctx.restore();

    // Branch label at rib end — Inter 700, slightly larger
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.046)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = up ? 'bottom' : 'top';
    ctx.fillText(String(b.label || ''), ribEndX - 12, ribEndY + (up ? -8 : 8));

    // Sub-causes — short stems off the rib with better spacing
    const causes = Array.isArray(b.causes) ? b.causes.slice(0, 4) : [];
    if (causes.length > 0) {
      for (let j = 0; j < causes.length; j++) {
        const ct = (j + 1) / (causes.length + 1);
        const stemBaseX = baseX - Math.cos(ribAngle) * ribLen * ct;
        const stemBaseY = spineCY + (up ? -1 : 1) * Math.sin(ribAngle) * ribLen * ct;
        const stemLen = ribLen * 0.32;
        // Stem goes outward (perpendicular to rib in the up direction)
        const stemEndX = stemBaseX - Math.sin(ribAngle) * stemLen * (up ? 1 : -1);
        const stemEndY = stemBaseY - Math.cos(ribAngle) * stemLen * (up ? 1 : 1) * 0.4; // mostly horizontal

        // Sub-cause stem — hairline 1px alpha 0.35
        ctx.save();
        ctx.strokeStyle = rgbaCss(fg, 0.35);
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(stemBaseX, stemBaseY);
        ctx.lineTo(stemEndX, stemEndY);
        ctx.stroke();
        ctx.restore();

        // Sub-cause text — Inter 500, small, with gap from stem
        ctx.fillStyle = rgbaCss(fg, 0.72);
        ctx.font = `500 ${Math.round(h * 0.032)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(causes[j]), stemEndX - 6, stemEndY);
      }
    }
  }
}

function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
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

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

// eslint-disable-next-line no-unused-vars
function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}

function desaturate(rgb, amt) {
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return [
    Math.round(rgb[0] + (lum - rgb[0]) * amt),
    Math.round(rgb[1] + (lum - rgb[1]) * amt),
    Math.round(rgb[2] + (lum - rgb[2]) * amt),
  ];
}
