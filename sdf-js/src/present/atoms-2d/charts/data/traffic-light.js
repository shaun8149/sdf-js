// =============================================================================
// atoms-2d/charts/data/traffic-light.js — RAG / status indicator
// -----------------------------------------------------------------------------
// 2D twin of traffic-light-3d. Housing rectangle + N stacked light circles,
// each marked active (lit) or dim. Used for status / RAG / health / go-no-go.
//
// Args:
//   lights — array of { color, active?, label? } where color is one of
//            'red'|'amber'|'green'|'blue' OR [r,g,b]; active marks which one is
//            currently lit (default first is active if any are active). REQUIRED.
//   title  — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

const NAMED_COLORS = {
  red: [230, 80, 80],
  amber: [245, 175, 55],
  yellow: [230, 200, 50],
  green: [80, 175, 110],
  blue: [80, 130, 220],
  grey: [140, 140, 140],
};

export const spec = {
  type: 'traffic-light',
  category: 'charts/data',
  description: 'Traffic-light / RAG status indicator — housing + N stacked lights.',
  args: {
    lights: {
      type: "array of { color: 'red'|'amber'|'green'|'blue'|[r,g,b], active?, label? }",
      required: true,
      example: [
        { color: 'red', active: false, label: 'Stop' },
        { color: 'amber', active: false, label: 'Slow' },
        { color: 'green', active: true, label: 'Go' },
      ],
    },
    title: { type: 'string?', example: 'Project Status' },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 240;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];

  const lights = Array.isArray(args.lights) ? args.lights : [];
  const N = lights.length;
  if (N === 0) return;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    // Title sized proportional to canvas h (Inter 700)
    ctx.font = `700 ${Math.round(h * 0.055)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.1;
  }

  // Layout — housing takes left ~55% of width if labels present, else center
  const hasLabels = lights.some((l) => l && l.label);
  const housingW = hasLabels ? w * 0.42 : Math.min(w - PAD * 2, h * 0.4);
  const housingX = hasLabels ? x + PAD : x + (w - housingW) / 2;
  const housingTop = plotTop + PAD * 0.3;
  const housingBottom = y + h - PAD;
  const housingH = housingBottom - housingTop;

  const lightSlot = housingH / N;
  const lightR = Math.min(housingW * 0.36, lightSlot * 0.38);
  const housingCX = housingX + housingW / 2;

  // Housing rectangle (rounded) — near-black fg alpha 0.85 with subtle gradient
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  // Near-black housing: palette.fg alpha 0.85 from top-left slightly lighter
  const housingBase = fg.map((c) => Math.round(c * 0.22)); // very dark version of fg
  const housingGrad = ctx.createLinearGradient(
    housingX,
    housingTop,
    housingX + housingW,
    housingTop + housingH,
  );
  housingGrad.addColorStop(0, rgbCss(lighten(housingBase, 0.12)));
  housingGrad.addColorStop(1, rgbCss(housingBase));
  ctx.fillStyle = housingGrad;
  ctx.globalAlpha = 0.87;
  roundRect(ctx, housingX, housingTop, housingW, housingH, lightR * 0.5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Lights
  for (let i = 0; i < N; i++) {
    const lt = lights[i] || {};
    const cy = housingTop + lightSlot * (i + 0.5);
    const color = resolveColor(lt.color, palette);
    const isOn = lt.active === true;

    // Dim recessed background socket
    ctx.save();
    ctx.fillStyle = rgbaCss([0, 0, 0], 0.4);
    ctx.beginPath();
    ctx.arc(housingCX, cy, lightR * 1.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Light body
    ctx.save();
    if (isOn) {
      // Outer glow: radial gradient for bloom effect
      const glow = ctx.createRadialGradient(
        housingCX,
        cy,
        lightR * 0.6,
        housingCX,
        cy,
        lightR * 1.8,
      );
      glow.addColorStop(0, rgbaCss(color, 0.55));
      glow.addColorStop(1, rgbaCss(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(housingCX, cy, lightR * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Bloom: shadow same color, alpha 0.3
      ctx.shadowColor = rgbaCss(color, 0.3);
      ctx.shadowBlur = 10;
    }
    // Active: lighter at center radial gradient; Inactive: dim (alpha 0.35)
    const grad = ctx.createRadialGradient(
      housingCX - lightR * 0.3,
      cy - lightR * 0.3,
      0,
      housingCX,
      cy,
      lightR,
    );
    if (isOn) {
      grad.addColorStop(0, rgbCss(lighten(color, 0.5)));
      grad.addColorStop(1, rgbCss(color));
      ctx.fillStyle = grad;
    } else {
      grad.addColorStop(0, rgbaCss(darken(color, 0.25), 0.35));
      grad.addColorStop(1, rgbaCss(darken(color, 0.5), 0.35));
      ctx.fillStyle = grad;
    }
    ctx.beginPath();
    ctx.arc(housingCX, cy, lightR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Specular highlight (active only)
    if (isOn) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(housingCX - lightR * 0.35, cy - lightR * 0.35, lightR * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Label to right of housing — Inter 600 small, palette.fg
    if (lt.label) {
      ctx.fillStyle = isOn ? rgbCss(fg) : rgbaCss(fg, 0.55);
      ctx.font = `600 ${Math.round(h * 0.042)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(lt.label), housingX + housingW + 14, cy);
    }
  }
}

function resolveColor(c, palette) {
  if (!c) return palette.colors?.[0] || [140, 140, 140];
  if (Array.isArray(c) && c.length === 3) return c;
  if (typeof c === 'string') {
    const named = NAMED_COLORS[c.toLowerCase()];
    if (named) return named;
  }
  return palette.colors?.[0] || [140, 140, 140];
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

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
