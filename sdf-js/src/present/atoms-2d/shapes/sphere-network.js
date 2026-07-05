// =============================================================================
// atoms-2d/shapes/sphere-network.js — Hub-and-satellite circle network
// -----------------------------------------------------------------------------
// 2D twin of sphere-network-3d. Central hub circle + N satellite circles
// arranged on a ring, connected by lines. Used for network / mind-map /
// hub-and-spoke patterns.
//
// Args:
//   hub        — optional { label?, color? } — center node
//   satellites — array of { label?, color? } (REQUIRED, 2-12)
//   title      — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'sphere-network',
  category: 'shapes',
  description: 'Hub-and-satellite network — center node + N labeled satellites on a ring.',
  args: {
    hub: { type: '{ label?, color? }?', example: { label: 'Platform' } },
    satellites: {
      type: 'array of { label?, color? } (2-12)',
      required: true,
      example: [{ label: 'API' }, { label: 'Web' }, { label: 'Mobile' }, { label: 'CLI' }],
    },
    title: { type: 'string?', example: 'Product Surface' },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 440;
  const h = opts.h ?? 440;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = palette.colors || [[60, 130, 200]];
  const accent = baseColors[0];

  const sats = Array.isArray(args.satellites) ? args.satellites.slice(0, 12) : [];
  const N = sats.length;
  if (N < 2) return;
  const hub = args.hub || {};

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.12;
  }

  const cx = x + w / 2;
  const cy = plotTop + (y + h - plotTop) / 2;
  const labelInset = sats.some((s) => s.label) ? 40 : 8;
  const orbitR = Math.min(w - PAD * 2, y + h - plotTop - PAD * 2) / 2 - labelInset;
  const hubR = orbitR * 0.18;
  const satR = orbitR * 0.11;

  // Links first (so nodes overlap them)
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    const sx = cx + Math.cos(a) * orbitR;
    const sy = cy + Math.sin(a) * orbitR;
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.3);
    ctx.lineWidth = Math.max(1.5, orbitR * 0.014);
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Trim line ends so they don't poke into nodes
    const tHub = hubR / orbitR;
    const tSat = (orbitR - satR) / orbitR;
    ctx.moveTo(cx + Math.cos(a) * orbitR * tHub, cy + Math.sin(a) * orbitR * tHub);
    ctx.lineTo(cx + Math.cos(a) * orbitR * tSat, cy + Math.sin(a) * orbitR * tSat);
    ctx.stroke();
    ctx.restore();
  }

  // Hub
  drawNode(ctx, cx, cy, hubR, hub.color || accent, hub.label, fg, true);

  // Satellites
  for (let i = 0; i < N; i++) {
    const s = sats[i] || {};
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    const sx = cx + Math.cos(a) * orbitR;
    const sy = cy + Math.sin(a) * orbitR;
    const color = s.color || baseColors[(i + 1) % baseColors.length] || accent;
    drawNode(ctx, sx, sy, satR, color, null, fg, false);

    // Label outside satellite (radial direction) — min 11px for legibility.
    if (s.label) {
      const lr = orbitR + satR + 12;
      const lx = cx + Math.cos(a) * lr;
      const ly = cy + Math.sin(a) * lr;
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `600 ${Math.max(11, Math.round(h * 0.04))}px Inter, system-ui, sans-serif`;
      ctx.textAlign = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
      ctx.textBaseline = Math.sin(a) > 0.3 ? 'top' : Math.sin(a) < -0.3 ? 'bottom' : 'middle';
      ctx.fillText(String(s.label), lx, ly);
    }
  }
}

function drawNode(ctx, cx, cy, r, color, label, fg, isHub) {
  // Ground shadow (soft ellipse, drawn before sphere body)
  ctx.save();
  ctx.filter = 'blur(5px)';
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.9, r * 0.75, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sphere body: full 3D radial gradient — highlight offset upper-left
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.08, cx, cy, r);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.15, rgbCss(lighten(color, 0.35)));
  grad.addColorStop(0.55, rgbCss(color));
  grad.addColorStop(1.0, rgbCss(darken(color, 0.35)));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Specular highlight ellipse (upper-left)
  ctx.save();
  const specCx = cx - r * 0.35;
  const specCy = cy - r * 0.45;
  const specRx = r * 0.35;
  const specRy = r * 0.18;
  const specGrad = ctx.createRadialGradient(specCx, specCy, 0, specCx, specCy, specRx);
  specGrad.addColorStop(0.0, 'rgba(255,255,255,0.85)');
  specGrad.addColorStop(0.45, 'rgba(255,255,255,0.38)');
  specGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.ellipse(specCx, specCy, specRx, specRy, -0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (label && isHub) {
    // On-sphere label: dark fg text + white halo (strokeText under fill)
    // reads reliably regardless of the sphere's own color/lightness —
    // more robust than a fixed white fill, which vanished on light spheres.
    const fontSize = Math.max(11, Math.round(r * 0.62));
    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.strokeText(String(label), cx, cy);
    ctx.fillStyle = rgbCss(fg);
    ctx.fillText(String(label), cx, cy);
  }
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
