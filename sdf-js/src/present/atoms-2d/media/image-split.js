// =============================================================================
// atoms-2d/media/image-split.js — Hero image-text split atom (PL pattern)
// -----------------------------------------------------------------------------
// Sprint 18 Tier 3 C — closes structural gap vs PL D3180 reference benchmark.
//
// Semantic: PL hero split — image on one side, title + body + bullets on the
// other. Used for "Our Mission" / "About Us" / "Why Now" hero slides.
//
// Args:
//   src            — image URL (required)
//   title          — heading (required)
//   body           — optional body paragraph
//   bullets        — optional bullets[]
//   imageSide      — 'left'|'right' (default 'left')
//   imageWidthPct  — 0-1 fraction of slot width for image (default 0.5)
// =============================================================================

import { drawPseudo3D as drawImage } from './image.js';

export const spec = {
  type: 'image-split',
  category: 'media',
  description:
    'Hero split: image on one side, text + bullets on the other. PL hero pattern. src MUST be a data: URI or parser-emitted relative path from an embedded image in the source — never an internet URL or generated photo.',
  args: {
    src: {
      type: 'string (data: URI or parser-emitted relative path)',
      required: true,
      example:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWNgIBb8BwABKAEBwGDOlAAAAABJRU5ErkJggg==',
    },
    title: { type: 'string', required: true, example: 'Our Mission' },
    body: { type: 'string?', example: 'Make on-chain trading natural.' },
    bullets: {
      type: 'string[]?',
      example: ['Self-custodial', 'Multi-chain', '24/7 support'],
    },
    imageSide: { type: "'left'|'right'?", default: "'left'", example: 'left' },
    imageWidthPct: { type: 'number? (0-1)', default: 0.5, example: 0.5 },
  },
};

const PAD = 28;

function drawTextSide(ctx, x, y, w, h, args, palette) {
  const accent = palette.accent || [60, 100, 200];
  const accentCss = `rgb(${Math.round(accent[0])},${Math.round(accent[1])},${Math.round(accent[2])})`;

  const titleSize = Math.max(20, Math.min(Math.round(h * 0.11), 44));
  const bodySize = Math.max(12, Math.min(Math.round(h * 0.055), 18));
  const bulletSize = Math.max(11, Math.min(Math.round(h * 0.045), 15));

  let cy = y + PAD;

  // Title
  ctx.fillStyle = 'rgba(20,20,30,0.92)';
  ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(String(args.title || ''), x + PAD, cy);
  cy += titleSize + 12;

  // Accent rule under title
  ctx.fillStyle = accentCss;
  ctx.fillRect(x + PAD, cy, 48, 3);
  cy += 14;

  // Body
  if (args.body) {
    ctx.fillStyle = 'rgba(40,40,50,0.75)';
    ctx.font = `500 ${bodySize}px Inter, system-ui, sans-serif`;
    // Simple word-wrap
    const words = String(args.body).split(/\s+/);
    const maxW = w - PAD * 2;
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x + PAD, cy);
        cy += bodySize + 4;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x + PAD, cy);
      cy += bodySize + 4;
    }
    cy += 8;
  }

  // Bullets
  if (Array.isArray(args.bullets) && args.bullets.length > 0) {
    ctx.font = `600 ${bulletSize}px Inter, system-ui, sans-serif`;
    const rowH = bulletSize + 10;
    const bulletDotR = Math.max(3, bulletSize * 0.28);
    for (const bullet of args.bullets) {
      if (cy + rowH > y + h - PAD) break;
      // accent dot
      ctx.fillStyle = accentCss;
      ctx.beginPath();
      ctx.arc(x + PAD + bulletDotR, cy + bulletSize / 2, bulletDotR, 0, Math.PI * 2);
      ctx.fill();
      // label
      ctx.fillStyle = 'rgba(30,30,40,0.88)';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(bullet), x + PAD + bulletDotR * 2 + 10, cy + bulletSize / 2 + 1);
      cy += rowH;
    }
  }
}

export async function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 1280;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};

  const imageSide = args.imageSide || 'left';
  const imageWidthPct = Math.max(0.25, Math.min(0.75, args.imageWidthPct ?? 0.5));

  const imgW = Math.round(w * imageWidthPct);
  const textW = w - imgW;

  const imgX = imageSide === 'left' ? x : x + textW;
  const textX = imageSide === 'left' ? x + imgW : x;

  // Text-side background (subtle off-white panel)
  ctx.fillStyle = 'rgba(248,248,251,1)';
  ctx.fillRect(textX, y, textW, h);

  // Render image side
  await drawImage(ctx, { src: args.src, fit: 'cover' }, { x: imgX, y, w: imgW, h, palette });

  // Render text side on top of panel
  drawTextSide(ctx, textX, y, textW, h, args, palette);
}
