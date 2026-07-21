// =============================================================================
// atoms-2d/charts/diagrams/seven-s-model.js — McKinsey 7S Framework
// -----------------------------------------------------------------------------
// Renders the McKinsey 7S Framework: a central hexagon (Shared Values) with
// 6 satellite hexagons (Strategy, Structure, Systems, Style, Staff, Skills)
// arranged in a hexagonal ring.
//
// Connections:
//   • Spoke lines: center → each satellite
//   • Ring lines: adjacent satellites → adjacent satellites (6 edges)
//
// Render: pseudo-3D
//   - Hexagons with radial gradient (lighter top-left) + drop shadow
//   - Center hex: larger + stronger accent color
//   - Satellite hexes: palette.colors cycled
//   - Labels: Inter 600, centered; optional sub-label in smaller text
//
// Per [[atlas-atom-taxonomy]] — charts/diagrams family.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'seven-s-model',
  category: 'charts/diagrams',
  description:
    'McKinsey 7S Framework — Shared Values center + 6 satellites (Strategy, Structure, Systems, Style, Staff, Skills).',
  args: {
    center: { type: 'string', default: 'Shared Values' },
    satellites: {
      type: 'array of 6 { label: string, description?: string }',
      required: true,
      example: [
        { label: 'Strategy' },
        { label: 'Structure' },
        { label: 'Systems' },
        { label: 'Style' },
        { label: 'Staff' },
        { label: 'Skills' },
      ],
    },
    title: { type: 'string?', example: '7S Framework' },
  },
};

const PAD = 14;
const TITLE_FRAC = 0.09;

// ---------------------------------------------------------------------------
// Hex geometry helper — pointy-top orientation
// ---------------------------------------------------------------------------
function drawHexagon(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6; // pointy-top
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Draw a single hexagon with pseudo-3D gradient + shadow + label(s)
// ---------------------------------------------------------------------------
function drawHex(ctx, cx, cy, r, label, subLabel, color, fg, isCenter) {
  ctx.save();

  // Shadow
  ctx.shadowColor = rgbaCss([0, 0, 0], isCenter ? 0.28 : 0.18);
  ctx.shadowBlur = isCenter ? 10 : 6;
  ctx.shadowOffsetY = isCenter ? 3 : 2;

  // Radial gradient — lighter top-left to base color
  const gx = cx - r * 0.35;
  const gy = cy - r * 0.35;
  const grad = ctx.createRadialGradient(gx, gy, r * 0.05, cx, cy, r * 1.05);
  grad.addColorStop(0, rgbCss(lighten(color, isCenter ? 0.32 : 0.22)));
  grad.addColorStop(1, rgbCss(color));

  drawHexagon(ctx, cx, cy, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle border
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  drawHexagon(ctx, cx, cy, r);
  ctx.strokeStyle = rgbaCss(darken(color, 0.15), 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  // Label — auto-shrink to fit the hexagon width (min 9px); if it still
  // doesn't fit at the minimum size, fall back to a 2-line wrap instead of
  // truncating with an ellipsis (truncate() is now a last-resort-only path
  // for a single unbreakable word).
  const labelColor = 'rgba(255,255,255,1)';
  const targetFs = isCenter ? Math.min(16, r * 0.4) : Math.min(14, r * 0.4);
  const minFs = 9;
  const maxW = r * 1.5;

  ctx.fillStyle = labelColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (subLabel) {
    // Two lines: label above, subLabel below — each independently shrunk.
    const main = fitLabelLines(ctx, label, maxW, targetFs, minFs, isCenter ? 700 : 600);
    const sub = fitLabelLines(ctx, subLabel, r * 1.3, targetFs * 0.8, minFs - 1, 500);
    const gap = main.fontSize * 0.65;
    ctx.font = `${isCenter ? 700 : 600} ${main.fontSize}px Inter, system-ui, sans-serif`;
    ctx.fillText(main.lines[0], cx, cy - gap * 0.5);
    ctx.font = `500 ${sub.fontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(sub.lines[0], cx, cy + gap * 0.7);
  } else {
    const fit = fitLabelLines(ctx, label, maxW, targetFs, minFs, isCenter ? 700 : 600);
    ctx.font = `${isCenter ? 700 : 600} ${fit.fontSize}px Inter, system-ui, sans-serif`;
    if (fit.lines.length === 2) {
      const lineH = fit.fontSize * 1.15;
      ctx.fillText(fit.lines[0], cx, cy - lineH * 0.5);
      ctx.fillText(fit.lines[1], cx, cy + lineH * 0.5);
    } else {
      ctx.fillText(fit.lines[0], cx, cy + 1);
    }
  }
}

// Fit `text` inside `maxW`: try a single line shrinking font from targetFs
// down to minFs; if it never fits, try a 2-line word-wrap (also shrinking
// font); if even that can't fit at minFs, truncate the single unbreakable
// remainder with an ellipsis as a last resort.
function fitLabelLines(ctx, text, maxW, targetFs, minFs, weight) {
  const t0 = Math.max(minFs, Math.round(targetFs));
  for (let fs = t0; fs >= minFs; fs--) {
    ctx.font = `${weight} ${fs}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxW) return { lines: [text], fontSize: fs };
  }

  const words = String(text).split(' ');
  if (words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    for (let fs = t0; fs >= minFs; fs--) {
      ctx.font = `${weight} ${fs}px Inter, system-ui, sans-serif`;
      if (ctx.measureText(line1).width <= maxW && ctx.measureText(line2).width <= maxW) {
        return { lines: [line1, line2], fontSize: fs };
      }
    }
    ctx.font = `${weight} ${minFs}px Inter, system-ui, sans-serif`;
    return { lines: [line1, line2], fontSize: minFs };
  }

  // Single unbreakable word (e.g. "Structure") — hyphenate a 2-line wrap
  // rather than dropping straight to an ellipsis, so the full label reads.
  if (words[0].length > 3) {
    const word = words[0];
    const mid = Math.ceil(word.length / 2);
    const line1 = word.slice(0, mid) + '-';
    const line2 = word.slice(mid);
    for (let fs = t0; fs >= minFs; fs--) {
      ctx.font = `${weight} ${fs}px Inter, system-ui, sans-serif`;
      if (ctx.measureText(line1).width <= maxW && ctx.measureText(line2).width <= maxW) {
        return { lines: [line1, line2], fontSize: fs };
      }
    }
    ctx.font = `${weight} ${minFs}px Inter, system-ui, sans-serif`;
    return { lines: [line1, line2], fontSize: minFs };
  }

  ctx.font = `${weight} ${minFs}px Inter, system-ui, sans-serif`;
  return { lines: [truncate(text, maxW, ctx)], fontSize: minFs };
}

// ---------------------------------------------------------------------------
// Draw a connector line between two points
// ---------------------------------------------------------------------------
function drawConnector(ctx, x0, y0, x1, y1, color, alpha, lineWidth) {
  ctx.save();
  ctx.strokeStyle = rgbaCss(color, alpha);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 600;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [60, 100, 200];
  const groupColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
    [60, 160, 180],
  ];

  const centerLabel = typeof args.center === 'string' ? args.center : 'Shared Values';
  const satellites = Array.isArray(args.satellites) ? args.satellites.slice(0, 6) : [];
  const title = args.title;

  // ---- Title ----
  let plotTop = y;
  if (title) {
    const titleSize = Math.round(h * 0.058);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  // ---- Layout parameters ----
  const plotH = y + h - plotTop;
  const cx = x + w / 2;
  const cy = plotTop + plotH / 2;
  // Outer radius of the arrangement (center to satellite centers). Sized so
  // the full cluster (orbit + satellite hex) fills ~75% of the available
  // space — previously R was ~0.31 * min(w,h), leaving the cluster
  // occupying well under a third of the canvas.
  const ORBIT_FRAC = 0.56; // orbitR / R
  const SAT_HEX_FRAC = 0.16; // satHexR / R
  const FILL_FRAC = 0.75; // fraction of min(w, plotH) the cluster diameter should fill
  const R = (Math.min(w, plotH) * FILL_FRAC) / 2 / (ORBIT_FRAC + SAT_HEX_FRAC);

  const centerHexR = R * 0.19; // center hex radius
  const satHexR = R * SAT_HEX_FRAC; // satellite hex radius
  const orbitR = R * ORBIT_FRAC; // distance from center to satellite centers

  // ---- Satellite positions (0° = top-right, 60° steps, pointy-top hex ring) ----
  // We use 30°, 90°, 150°, 210°, 270°, 330° so satellites sit at flat-edge midpoints
  const satPositions = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 30 + 60 * i;
    const angle = (angleDeg * Math.PI) / 180;
    satPositions.push({
      x: cx + orbitR * Math.cos(angle),
      y: cy + orbitR * Math.sin(angle),
    });
  }

  // ---- Draw ring connectors (adjacent satellites) — behind everything ----
  for (let i = 0; i < 6; i++) {
    const a = satPositions[i];
    const b = satPositions[(i + 1) % 6];
    drawConnector(ctx, a.x, a.y, b.x, b.y, accent, 0.22, 1);
  }

  // ---- Draw spoke connectors (center → satellite) ----
  for (let i = 0; i < satPositions.length; i++) {
    const sp = satPositions[i];
    drawConnector(ctx, cx, cy, sp.x, sp.y, accent, 0.55, 1.5);
  }

  // ---- Draw satellite hexagons ----
  for (let i = 0; i < satPositions.length; i++) {
    const sp = satPositions[i];
    const sat = satellites[i] || { label: '' };
    const color = groupColors[i % groupColors.length];
    drawHex(ctx, sp.x, sp.y, satHexR, sat.label || '', sat.description || null, color, fg, false);
  }

  // ---- Draw center hexagon (on top) ----
  drawHex(ctx, cx, cy, centerHexR, centerLabel, null, accent, fg, true);
}

// ---------------------------------------------------------------------------
// Utilities
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

function truncate(text, maxWidth, ctx) {
  const s = String(text);
  if (ctx.measureText(s).width <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + '…';
}
