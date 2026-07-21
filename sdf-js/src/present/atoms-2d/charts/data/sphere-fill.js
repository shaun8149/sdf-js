// =============================================================================
// atoms-2d/charts/data/sphere-fill.js — Glass sphere with liquid fill level
// -----------------------------------------------------------------------------
// 16th atom in 2D vector library.
//
// Semantic: a glass sphere (translucent outer shell) containing colored
// "liquid" filled to a percentage level. Pattern is established skeuomorphic
// data-viz vocabulary (Mac OS X Aqua / Vista Glass era, ~2001+) — generic
// CG technique vocabulary (Phong specular + rim light + cap segment).
//
// Use case: percentage progress, capacity/utilization metrics, KPI dashboards
// where you want a "container filling up" visual metaphor.
//
// Args:
//   value      — number 0-100 (fill percentage)
//   label      — optional display text (default: `${value}%`)
//   color      — liquid fill color (rgb tuple); else palette.colors[0]
//   background — 'dark' | 'light' (default 'dark' — affects glass rim contrast)
//
// Render technique (general CG, not specific to any vendor's templates):
//   1. Soft elliptical floor shadow under sphere
//   2. Glass sphere shell: faint translucent radial gradient (NOT dark fill)
//   3. Liquid body: cap segment from bottom up to fill height, with
//      vertical liquid gradient (lighter top, darker bottom) + wavy surface
//   4. Liquid top surface: thin perspective ellipse at fill level
//   5. Glass rim overlay: thin circular stroke (subtle)
//   6. Specular highlight: bright white spot upper-left (Phong reflection)
//   7. Label BELOW sphere (KPI card style), not overlaid on sphere center
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'sphere-fill',
  category: 'charts/data',
  description:
    'Glass sphere with colored liquid filled to a percentage level. Skeuomorphic % visualization.',
  args: {
    value: { type: 'number (0-100)', required: true, example: 60 },
    label: { type: 'string?', example: '60%' },
    caption: { type: 'string?', example: 'Description 1' },
    color: { type: '[r,g,b]?', example: [60, 130, 200] },
    background: { type: "'dark'|'light'", default: 'dark', example: 'dark' },
    style: { type: "'2d'|'3d'", default: '3d', example: '3d' },
  },
};

const PAD = 14;
// Reserve bottom 22% of height for label (value text below sphere)
const LABEL_FRAC = 0.22;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 280;
  const h = opts.h ?? 280;
  const palette = opts.palette || {};
  const color = args.color || palette.colors?.[0] || [60, 130, 200];
  const value = clamp(Number(args.value ?? 0), 0, 100);
  const label = args.label != null ? String(args.label) : `${Math.round(value)}%`;
  const style = args.style === '2d' ? '2d' : '3d';

  // Layout: sphere occupies top 78%, label region below
  const labelAreaH = h * LABEL_FRAC;
  const sphereAreaH = h - labelAreaH - PAD * 2;
  const sphereAreaW = w - PAD * 2;
  const radius = Math.min(sphereAreaW, sphereAreaH) / 2;
  const cx = x + w / 2;
  const cy = y + PAD + sphereAreaH / 2;

  // ---- 2D mode: flat circle with bottom-up fill (early return) ----
  if (style === '2d') {
    return draw2D(ctx, {
      cx,
      cy,
      radius,
      color,
      value,
      label,
      args,
      w,
      h,
      x,
      y,
      palette,
      labelAreaH,
    });
  }

  // ---- 1) Ground shadow (elliptical, blurred) ----
  const floorY = cy + radius * 0.93;
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, floorY, radius * 0.8, radius * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- 2) Glass sphere shell: faint translucent body (liquid shows through) ----
  ctx.save();
  const glassGrad = ctx.createRadialGradient(
    cx - radius * 0.35,
    cy - radius * 0.4,
    radius * 0.05,
    cx,
    cy,
    radius,
  );
  glassGrad.addColorStop(0.0, 'rgba(255,255,255,0.08)');
  glassGrad.addColorStop(0.55, rgbaCss(color, 0.05));
  glassGrad.addColorStop(1.0, rgbaCss(darken(color, 0.18), 0.2));
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- 3) Liquid fill clipped to sphere (with wavy surface) ----
  if (value > 0) {
    const fillRatio = value / 100;
    const fillTopY = cy + radius - 2 * radius * fillRatio;
    const crossDy = fillTopY - cy;
    const crossR = Math.sqrt(Math.max(0, radius * radius - crossDy * crossDy));

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
    ctx.clip();

    // Liquid vertical gradient: lighter near surface, richer at bottom
    const grad = ctx.createLinearGradient(0, fillTopY, 0, cy + radius);
    grad.addColorStop(0, rgbCss(lighten(color, 0.28)));
    grad.addColorStop(0.25, rgbCss(lighten(color, 0.12)));
    grad.addColorStop(1, rgbCss(darken(color, 0.25)));
    ctx.fillStyle = grad;

    // Draw liquid body with wavy top edge
    ctx.beginPath();
    const waveAmp = Math.min(3.5, radius * 0.028);
    const waveCount = 4;
    const leftX = cx - crossR;
    const rightX = cx + crossR;
    ctx.moveTo(leftX, fillTopY);
    const waveStep = (rightX - leftX) / (waveCount * 2);
    for (let i = 0; i < waveCount * 2; i++) {
      const wx1 = leftX + i * waveStep;
      const wx2 = leftX + (i + 1) * waveStep;
      const wmidX = (wx1 + wx2) / 2;
      const sign = i % 2 === 0 ? -1 : 1;
      ctx.quadraticCurveTo(wmidX, fillTopY + sign * waveAmp, wx2, fillTopY);
    }
    // Arc around bottom of sphere
    const angleRight = Math.acos(clamp(crossDy / radius, -1, 1));
    ctx.arc(cx, cy, radius - 1.5, -angleRight + Math.PI * 0.5, angleRight + Math.PI * 0.5, false);
    ctx.closePath();
    ctx.fill();

    // Inner side specular highlight on right wall of liquid
    const sideGrad = ctx.createLinearGradient(cx - radius * 0.5, 0, cx + radius * 0.75, 0);
    sideGrad.addColorStop(0.0, rgbaCss(lighten(color, 0.4), 0));
    sideGrad.addColorStop(0.82, rgbaCss(lighten(color, 0.4), 0));
    sideGrad.addColorStop(1.0, rgbaCss(lighten(color, 0.4), 0.28));
    ctx.fillStyle = sideGrad;
    ctx.fillRect(cx - radius, fillTopY, radius * 2, radius * 2);

    ctx.restore();

    // ---- 4) Liquid surface ellipse (perspective top of liquid) ----
    if (crossR > 3) {
      ctx.save();
      ctx.strokeStyle = rgbaCss(darken(color, 0.3), 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, fillTopY, crossR, crossR * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
      const surfGrad = ctx.createLinearGradient(
        0,
        fillTopY - crossR * 0.15,
        0,
        fillTopY + crossR * 0.15,
      );
      surfGrad.addColorStop(0, rgbaCss(darken(color, 0.1), 0.55));
      surfGrad.addColorStop(1, rgbaCss(lighten(color, 0.12), 0.28));
      ctx.fillStyle = surfGrad;
      ctx.beginPath();
      ctx.ellipse(cx, fillTopY, crossR, crossR * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- 5) Glass rim (white outer stroke + subtle inner darkening) ----
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgbaCss(darken(color, 0.25), 0.1);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // ---- 6) Specular highlight (Phong-style, upper-left) ----
  ctx.save();
  const specCx = cx - radius * 0.35;
  const specCy = cy - radius * 0.45;
  const specRx = radius * 0.34;
  const specRy = radius * 0.17;
  const specGrad = ctx.createRadialGradient(specCx, specCy, 0, specCx, specCy, specRx);
  specGrad.addColorStop(0.0, 'rgba(255,255,255,0.92)');
  specGrad.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  specGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.ellipse(specCx, specCy, specRx, specRy, -0.52, 0, Math.PI * 2);
  ctx.fill();
  // Tiny pin-prick highlight
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.18, cy - radius * 0.58, radius * 0.038, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- 7) Label BELOW sphere (KPI card style) ----
  if (label) {
    const labelY = cy + radius + labelAreaH * 0.35;
    const valueSize = Math.round(Math.min(radius * 0.42, labelAreaH * 0.42));
    ctx.font = `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgbCss(palette.silhouetteColor || [30, 27, 30]);
    ctx.fillText(label, cx, labelY);
  }
  // ---- 7b) Optional caption (smaller, below label) — for body description text ----
  const caption = args.caption;
  if (caption) {
    const capY = cy + radius + labelAreaH * 0.75;
    const capSize = Math.round(Math.min(radius * 0.18, labelAreaH * 0.22));
    ctx.font = `500 ${capSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgbaCss(palette.silhouetteColor || [30, 27, 30], 0.7);
    // Wrap caption if too long — simple word-break approach
    const maxW = w - PAD * 2;
    const words = String(caption).split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = word;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    lines.slice(0, 3).forEach((line, i) => {
      ctx.fillText(line, cx, capY + i * (capSize * 1.25));
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

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

// 2D variant: flat circle outline + bottom-up colored fill — for "2D SPHERES" PL slides
// (slide-12/13/15/19). Mirrors PL's flat infographic aesthetic — no specular, no
// glass effect, no drop shadow, just a clean filled circle.
function draw2D(ctx, p) {
  const { cx, cy, radius, color, value, label, args, w, h, x, y, palette, labelAreaH } = p;
  const gray = [220, 222, 226];

  // 1) Gray ring outline (the "empty" sphere look)
  ctx.save();
  ctx.fillStyle = rgbCss(gray);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2) Colored fill clipped to circle, from bottom up to value%
  if (value > 0) {
    const fillRatio = value / 100;
    const fillTopY = cy + radius - 2 * radius * fillRatio;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = rgbCss(color);
    ctx.fillRect(cx - radius, fillTopY, radius * 2, radius * 2);
    ctx.restore();
  }

  // 3) Hairline border (very subtle ring around the circle)
  ctx.save();
  ctx.strokeStyle = rgbaCss(darken(gray, 0.1), 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 4) Value label below
  if (label) {
    const labelY = cy + radius + labelAreaH * 0.35;
    const valueSize = Math.round(Math.min(radius * 0.42, labelAreaH * 0.42));
    ctx.font = `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgbCss(palette.silhouetteColor || [30, 27, 30]);
    ctx.fillText(label, cx, labelY);
  }

  // 5) Optional caption below value (wrapped Inter 500)
  const caption = args.caption;
  if (caption) {
    const capY = cy + radius + labelAreaH * 0.75;
    const capSize = Math.round(Math.min(radius * 0.18, labelAreaH * 0.22));
    ctx.font = `500 ${capSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgbaCss(palette.silhouetteColor || [30, 27, 30], 0.7);
    const maxW = w - PAD * 2;
    const words = String(caption).split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = word;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    lines.slice(0, 3).forEach((line, i) => {
      ctx.fillText(line, cx, capY + i * (capSize * 1.25));
    });
  }
}
