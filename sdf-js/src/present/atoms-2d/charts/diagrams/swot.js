// =============================================================================
// atoms-2d/charts/diagrams/swot.js — SWOT Analysis 2×2 quadrant
// -----------------------------------------------------------------------------
// Classic SWOT Analysis: four quadrants (Strengths / Weaknesses /
// Opportunities / Threats) each with a colored header and bullet items.
// Used for strategic planning, business case, analysis report slides.
//
// Args:
//   title         — optional title bar text (default: "SWOT Analysis")
//   strengths     — array of strings (REQUIRED)
//   weaknesses    — array of strings (REQUIRED)
//   opportunities — array of strings (REQUIRED)
//   threats       — array of strings (REQUIRED)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'swot',
  category: 'charts/diagrams',
  description:
    'SWOT Analysis — 2×2 quadrant with Strengths / Weaknesses / Opportunities / Threats.',
  args: {
    title: { type: 'string?', example: 'SWOT Analysis — Q3 2026' },
    strengths: {
      type: 'string[]',
      required: true,
      example: ['Strong brand', 'High retention', 'Proprietary tech'],
    },
    weaknesses: {
      type: 'string[]',
      required: true,
      example: ['Limited distribution', 'High burn rate'],
    },
    opportunities: {
      type: 'string[]',
      required: true,
      example: ['Asia market entry', 'New regulatory window'],
    },
    threats: {
      type: 'string[]',
      required: true,
      example: ['Well-funded competitor', 'Macro slowdown'],
    },
  },
};

// Quadrant color definitions
const Q_COLORS = {
  strengths: [80, 160, 80], // green
  weaknesses: [200, 80, 60], // red/orange
  opportunities: [60, 140, 200], // blue/teal
  threats: [120, 100, 80], // warm gray/dark
};

const Q_LABELS = {
  strengths: 'Strengths',
  weaknesses: 'Weaknesses',
  opportunities: 'Opportunities',
  threats: 'Threats',
};

const PAD = 12;
const TITLE_H_FRAC = 0.1;
const CELL_PAD = 12;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];

  const title = args.title || 'SWOT Analysis';

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  // Title bar
  const titleH = Math.round(h * TITLE_H_FRAC);
  ctx.save();
  ctx.fillStyle = rgbCss(fg);
  ctx.font = `700 ${Math.round(titleH * 0.6)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x + PAD, y + titleH / 2);
  ctx.restore();

  // Grid area
  const gridT = y + titleH;
  const gridH = h - titleH;
  const halfW = w / 2;
  const halfH = gridH / 2;

  // Draw 4 quadrants
  const quadrants = [
    { key: 'strengths', col: 0, row: 0, items: args.strengths },
    { key: 'weaknesses', col: 1, row: 0, items: args.weaknesses },
    { key: 'opportunities', col: 0, row: 1, items: args.opportunities },
    { key: 'threats', col: 1, row: 1, items: args.threats },
  ];

  for (const q of quadrants) {
    const qx = x + q.col * halfW;
    const qy = gridT + q.row * halfH;
    drawQuadrant(ctx, qx, qy, halfW, halfH, q.key, q.items, fg);
  }

  // Border lines between quadrants
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.2);
  ctx.lineWidth = 1.5;

  // Vertical center line
  ctx.beginPath();
  ctx.moveTo(x + halfW, gridT);
  ctx.lineTo(x + halfW, y + h);
  ctx.stroke();

  // Horizontal center line
  ctx.beginPath();
  ctx.moveTo(x, gridT + halfH);
  ctx.lineTo(x + w, gridT + halfH);
  ctx.stroke();

  // Outer border
  ctx.strokeStyle = rgbaCss(fg, 0.12);
  ctx.strokeRect(x, gridT, w, gridH);

  ctx.restore();
}

function drawQuadrant(ctx, qx, qy, qw, qh, key, items, fg) {
  const color = Q_COLORS[key] || [100, 100, 100];
  const label = Q_LABELS[key] || key;
  const safeItems = Array.isArray(items) ? items.slice(0, 4) : [];

  // Cell background — very light tint of cell color
  ctx.save();
  ctx.fillStyle = rgbaCss(color, 0.08);
  ctx.fillRect(qx, qy, qw, qh);
  ctx.restore();

  // Header strip
  const headerH = Math.round(qh * 0.22);
  ctx.save();
  ctx.fillStyle = rgbCss(color);
  ctx.fillRect(qx, qy, qw, headerH);
  ctx.restore();

  // Header label
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = `700 ${Math.round(headerH * 0.5)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, qx + CELL_PAD, qy + headerH / 2);
  ctx.restore();

  // Bullet items
  if (safeItems.length > 0) {
    const itemAreaT = qy + headerH + CELL_PAD;
    const itemAreaH = qh - headerH - CELL_PAD * 2;
    const rowH = itemAreaH / safeItems.length;
    const fontSize = Math.min(Math.round(rowH * 0.38), Math.round(qw * 0.042), 14);
    const bulletR = Math.max(3, Math.round(fontSize * 0.3));
    const bulletX = qx + CELL_PAD + bulletR + 2;
    const textX = bulletX + bulletR + 8;

    for (let i = 0; i < safeItems.length; i++) {
      const rowCY = itemAreaT + rowH * (i + 0.5);

      // Bullet dot
      ctx.save();
      ctx.fillStyle = rgbaCss(color, 0.8);
      ctx.beginPath();
      ctx.arc(bulletX, rowCY, bulletR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Item text with word wrap
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.85);
      ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const maxTW = qx + qw - textX - CELL_PAD;
      const text = String(safeItems[i] || '');
      const words = text.split(' ');
      let line = '';
      let lineY = rowCY - fontSize * 0.3;
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxTW && line) {
          ctx.fillText(line, textX, lineY);
          line = word;
          lineY += fontSize * 1.2;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, textX, lineY);
      ctx.restore();
    }
  }
}
