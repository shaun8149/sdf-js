// =============================================================================
// atoms-2d/shapes/device-mockup-frame.js — Single device UI mockup frame
// -----------------------------------------------------------------------------
// UI mockup container showing a single device frame: phone, tablet, laptop, or
// watch — with optional title above and content text overlaid on the screen.
//
// Primary use: product showcases, UI previews, feature announcement slides,
// mobile-first design walkthroughs.
//
// Args:
//   device  — 'phone' | 'tablet' | 'laptop' | 'watch'  (REQUIRED)
//   title   — optional label rendered above the device frame
//   content — optional text overlaid on the device screen
//   color   — optional [r,g,b] accent for the screen area
//
// Render: pseudo-3D
//   - Dark gray chrome (#2a2a2a) device body with rounded corners
//   - Accent-colored screen area with content text (Inter 700, white)
//   - Device-specific details: notch/speaker for phone, base for laptop, etc.
//   - Subtle drop shadow under device; highlight gradient on chrome top-left
//   - Title text above in Inter 700 fg color
//
// Export: drawDevice(ctx, kind, x, y, w, h, accentColor, content, opts) helper
// for reuse in device-mockup-row.js.
//
// Per [[atlas-sprint15b-idiom-atoms-plan]] — Sprint 15b Batch B2.
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'device-mockup-frame',
  category: 'shapes',
  description:
    'UI mockup container — single device frame (phone/tablet/laptop/watch) with optional content overlay.',
  args: {
    device: { type: "'phone'|'tablet'|'laptop'|'watch'", required: true, example: 'phone' },
    title: { type: 'string?', example: 'iPhone preview' },
    content: { type: 'string?', example: 'Atlas Present' },
    color: { type: '[r,g,b]?', example: [60, 100, 200] },
  },
};

const PAD = 20;
const TITLE_FRAC = 0.12;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 360;
  const h = opts.h ?? 420;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accentColor = args.color || palette.colors?.[0] || [60, 100, 200];
  const kind = args.device || 'phone';
  const title = args.title;
  const content = args.content;

  // ---- Title ----
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.max(14, Math.round(h * 0.05));
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(title), x + w / 2, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  const plotH = h - (plotTop - y) - PAD;
  const plotW = w - PAD * 2;
  const deviceX = x + PAD;
  const deviceY = plotTop;

  drawDevice(ctx, kind, deviceX, deviceY, plotW, plotH, accentColor, content);
}

// ---------------------------------------------------------------------------
// drawDevice — exported helper used by device-mockup-row.js
//   ctx        — Canvas2D context
//   kind       — 'phone' | 'tablet' | 'laptop' | 'watch'
//   x, y       — top-left of available bounding box
//   w, h       — bounding box dimensions
//   accentColor— [r, g, b] for screen fill
//   content    — optional content text on screen
//   opts       — { shadowAlpha?, labelBelow? }
// ---------------------------------------------------------------------------
export function drawDevice(ctx, kind, x, y, w, h, accentColor, content, opts = {}) {
  switch (kind) {
    case 'tablet':
      _drawTablet(ctx, x, y, w, h, accentColor, content, opts);
      break;
    case 'laptop':
      _drawLaptop(ctx, x, y, w, h, accentColor, content, opts);
      break;
    case 'watch':
      _drawWatch(ctx, x, y, w, h, accentColor, content, opts);
      break;
    case 'phone':
    default:
      _drawPhone(ctx, x, y, w, h, accentColor, content, opts);
      break;
  }
}

// ---------------------------------------------------------------------------
// Internal device renderers
// ---------------------------------------------------------------------------

const CHROME_COLOR = [42, 42, 42]; // #2a2a2a
const CHROME_DARK = [26, 26, 26]; // #1a1a1a (inner bezel)

function _drawPhone(ctx, bx, by, bw, bh, accent, content) {
  // Phone is 9:19 — fit inside bounding box keeping ratio
  const ratio = 9 / 19;
  let dw, dh;
  if (bw / bh < ratio) {
    dw = bw;
    dh = dw / ratio;
  } else {
    dh = bh;
    dw = dh * ratio;
  }
  const x = bx + (bw - dw) / 2;
  const y = by + (bh - dh) / 2;
  const r = dw * 0.12; // corner radius

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.14)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  _roundRect(ctx, x, y, dw, dh, r, rgbCss(CHROME_COLOR));
  ctx.restore();

  // Chrome body
  _roundRect(ctx, x, y, dw, dh, r, rgbCss(CHROME_COLOR));

  // Top-left highlight
  _addHighlight(ctx, x, y, dw, r);

  // Notch / dynamic island — dark pill at top center
  const notchW = dw * 0.32;
  const notchH = dh * 0.018;
  const notchX = x + (dw - notchW) / 2;
  const notchY = y + dh * 0.025;
  _roundRect(ctx, notchX, notchY, notchW, notchH, notchH / 2, rgbCss(CHROME_DARK));

  // Speaker dot (left of notch)
  const speakerR = dh * 0.006;
  ctx.save();
  ctx.fillStyle = rgbCss(CHROME_DARK);
  ctx.beginPath();
  ctx.arc(notchX - speakerR * 3, notchY + notchH / 2, speakerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Screen area (slightly inset from chrome)
  const bezel = dw * 0.055;
  const topBezel = dh * 0.06;
  const bottomBezel = dh * 0.1;
  const screenX = x + bezel;
  const screenY = y + topBezel;
  const screenW = dw - bezel * 2;
  const screenH = dh - topBezel - bottomBezel;
  const screenR = r * 0.6;
  _roundRect(ctx, screenX, screenY, screenW, screenH, screenR, rgbCss(darken(accent, 0.15)));

  // Screen gradient overlay (subtle)
  _addScreenGlow(ctx, screenX, screenY, screenW, screenH, accent, screenR);

  // Content text
  if (content) {
    _drawScreenText(ctx, content, screenX + screenW / 2, screenY + screenH / 2, screenW * 0.85, 14);
  }

  // Home indicator bar
  const indW = dw * 0.3;
  const indH = dh * 0.006;
  const indX = x + (dw - indW) / 2;
  const indY = y + dh - bottomBezel * 0.45;
  ctx.save();
  ctx.fillStyle = rgbaCss([255, 255, 255], 0.35);
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(indX, indY, indW, indH, indH / 2)
    : ctx.rect(indX, indY, indW, indH);
  ctx.fill();
  ctx.restore();
}

function _drawTablet(ctx, bx, by, bw, bh, accent, content) {
  // Tablet: 4:3 landscape ratio
  const ratio = 4 / 3;
  let dw, dh;
  if (bw / bh < ratio) {
    dw = bw;
    dh = dw / ratio;
  } else {
    dh = bh;
    dw = dh * ratio;
  }
  const x = bx + (bw - dw) / 2;
  const y = by + (bh - dh) / 2;
  const r = dw * 0.04;

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.14)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  _roundRect(ctx, x, y, dw, dh, r, rgbCss(CHROME_COLOR));
  ctx.restore();

  // Chrome body
  _roundRect(ctx, x, y, dw, dh, r, rgbCss(CHROME_COLOR));

  // Highlight
  _addHighlight(ctx, x, y, dw, r);

  // Screen area (slim bezels)
  const bezelH = dh * 0.06;
  const bezelW = dw * 0.035;
  const screenX = x + bezelW;
  const screenY = y + bezelH;
  const screenW = dw - bezelW * 2;
  const screenH = dh - bezelH * 2;
  const screenR = r * 0.5;
  _roundRect(ctx, screenX, screenY, screenW, screenH, screenR, rgbCss(darken(accent, 0.15)));
  _addScreenGlow(ctx, screenX, screenY, screenW, screenH, accent, screenR);

  // Content
  if (content) {
    _drawScreenText(ctx, content, screenX + screenW / 2, screenY + screenH / 2, screenW * 0.85, 16);
  }

  // Home button bottom-center
  const btnR = dh * 0.028;
  const btnCX = x + dw / 2;
  const btnCY = y + dh - bezelH * 0.48;
  ctx.save();
  ctx.strokeStyle = rgbaCss([255, 255, 255], 0.22);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(btnCX, btnCY, btnR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function _drawLaptop(ctx, bx, by, bw, bh, accent, content) {
  // Laptop: screen 16:9, then base bar below
  const screenRatio = 16 / 9;
  const baseBarFrac = 0.12; // fraction of total height taken by base
  const screenH = bh * (1 - baseBarFrac);
  let screenW = screenH * screenRatio;
  if (screenW > bw) {
    screenW = bw;
  }

  const x = bx + (bw - screenW) / 2;
  const y = by;
  const r = screenW * 0.02;

  // Drop shadow under body
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.14)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  _roundRect(ctx, x, y, screenW, screenH, r, rgbCss(CHROME_COLOR));
  ctx.restore();

  // Lid (chrome)
  _roundRect(ctx, x, y, screenW, screenH, r, rgbCss(CHROME_COLOR));
  _addHighlight(ctx, x, y, screenW, r);

  // Screen bezel (thin)
  const bezelW = screenW * 0.025;
  const bezelH = screenH * 0.05;
  const sX = x + bezelW;
  const sY = y + bezelH;
  const sW = screenW - bezelW * 2;
  const sH = screenH - bezelH * 1.5;
  const sR = r * 0.5;
  _roundRect(ctx, sX, sY, sW, sH, sR, rgbCss(darken(accent, 0.15)));
  _addScreenGlow(ctx, sX, sY, sW, sH, accent, sR);

  // Content
  if (content) {
    _drawScreenText(ctx, content, sX + sW / 2, sY + sH / 2, sW * 0.85, 18);
  }

  // Camera notch (top center of lid)
  const camR = screenH * 0.015;
  ctx.save();
  ctx.fillStyle = rgbCss(CHROME_DARK);
  ctx.beginPath();
  ctx.arc(x + screenW / 2, y + bezelH * 0.55, camR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Base bar (hinge + keyboard area)
  const baseH = bh * baseBarFrac;
  const baseW = screenW * 0.4;
  const baseX = x + (screenW - baseW) / 2;
  const baseY = y + screenH;
  ctx.save();
  ctx.fillStyle = rgbCss(darken(CHROME_COLOR, 0.1));
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(baseX, baseY, baseW, baseH * 0.5, [0, 0, 2, 2]);
  } else {
    ctx.rect(baseX, baseY, baseW, baseH * 0.5);
  }
  ctx.fill();
  ctx.restore();
}

function _drawWatch(ctx, bx, by, bw, bh, accent, content) {
  // Watch: ~1:1 rounded square
  const size = Math.min(bw, bh * 0.88);
  const x = bx + (bw - size) / 2;
  const y = by + (bh - size * 1.12) / 2;
  const r = size * 0.24;

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.14)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  _roundRect(ctx, x, y, size, size, r, rgbCss(CHROME_COLOR));
  ctx.restore();

  // Chrome body
  _roundRect(ctx, x, y, size, size, r, rgbCss(CHROME_COLOR));
  _addHighlight(ctx, x, y, size, r);

  // Side button (right edge)
  const btnW = size * 0.06;
  const btnH = size * 0.22;
  const btnX = x + size;
  const btnY = y + size * 0.32;
  ctx.save();
  ctx.fillStyle = rgbCss(darken(CHROME_COLOR, 0.15));
  if (ctx.roundRect) {
    ctx.roundRect ? ctx.beginPath() : null;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, [0, btnW / 2, btnW / 2, 0]);
  } else {
    ctx.beginPath();
    ctx.rect(btnX, btnY, btnW, btnH);
  }
  ctx.fill();
  ctx.restore();

  // Crown (digital crown below side button)
  const crownW = size * 0.06;
  const crownH = size * 0.12;
  const crownX = x + size;
  const crownY = btnY + btnH + size * 0.04;
  ctx.save();
  ctx.fillStyle = rgbCss(darken(CHROME_COLOR, 0.2));
  ctx.beginPath();
  ctx.rect(crownX, crownY, crownW, crownH);
  ctx.fill();
  ctx.restore();

  // Watch band stubs (top and bottom)
  const bandW = size * 0.52;
  const bandH = size * 0.08;
  const bandX = x + (size - bandW) / 2;
  ctx.save();
  ctx.fillStyle = rgbCss(darken(CHROME_COLOR, 0.05));
  ctx.fillRect(bandX, y - bandH, bandW, bandH + 2);
  ctx.fillRect(bandX, y + size - 2, bandW, bandH + 2);
  ctx.restore();

  // Screen area
  const bezel = size * 0.07;
  const sX = x + bezel;
  const sY = y + bezel;
  const sW = size - bezel * 2;
  const sH = size - bezel * 2;
  const sR = r * 0.65;
  _roundRect(ctx, sX, sY, sW, sH, sR, rgbCss(darken(accent, 0.15)));
  _addScreenGlow(ctx, sX, sY, sW, sH, accent, sR);

  // Content
  if (content) {
    _drawScreenText(ctx, content, sX + sW / 2, sY + sH / 2, sW * 0.82, 11);
  }
}

// ---------------------------------------------------------------------------
// Shared drawing helpers
// ---------------------------------------------------------------------------

function _roundRect(ctx, x, y, w, h, r, fillStyle) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    // Polyfill for environments without roundRect
    const rx = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rx, y);
    ctx.lineTo(x + w - rx, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rx);
    ctx.lineTo(x + w, y + h - rx);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
    ctx.lineTo(x + rx, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rx);
    ctx.lineTo(x, y + rx);
    ctx.quadraticCurveTo(x, y, x + rx, y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

function _addHighlight(ctx, x, y, w, r) {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + w * 0.5, y + w * 0.3);
  grad.addColorStop(0, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w * 0.55, w * 0.35, r);
  } else {
    ctx.rect(x, y, w * 0.55, w * 0.35);
  }
  ctx.fill();
  ctx.restore();
}

function _addScreenGlow(ctx, sx, sy, sw, sh, accent, r) {
  ctx.save();
  const grad = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.4);
  grad.addColorStop(0, rgbaCss(lighten(accent, 0.25), 0.35));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(sx, sy, sw, sh, r);
  } else {
    ctx.rect(sx, sy, sw, sh);
  }
  ctx.fill();
  ctx.restore();
}

function _drawScreenText(ctx, text, cx, cy, maxW, baseFontSize) {
  ctx.save();
  const fontSize = Math.max(10, Math.min(baseFontSize, maxW * 0.12));
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const s = String(text);
  const measured = ctx.measureText(s).width;
  if (measured > maxW) {
    let out = s;
    while (out.length > 1 && ctx.measureText(out + '…').width > maxW) {
      out = out.slice(0, -1);
    }
    ctx.fillText(out + '…', cx, cy);
  } else {
    ctx.fillText(s, cx, cy);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
