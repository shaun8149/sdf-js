// =============================================================================
// atoms-2d/charts/lists/bullet-list.js — Bulleted list
// -----------------------------------------------------------------------------
// 2D twin of bullet-list-3d. N stacked rows, each a round bullet + label +
// optional sublabel. Used for key points / features / checklist / takeaways.
//
// Distinct from `agenda-list` (numbered chip, agenda use).
//
// Args:
//   items — array of { label, sublabel?, status?:'done'|'todo'|'highlight' }
//           (REQUIRED, 1-12)
//   title — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { resolveIcon } from '../../../../icons/index.js';

export const spec = {
  type: 'bullet-list',
  category: 'charts/lists',
  description: 'Bulleted list — key points, features, checklist, takeaways.',
  args: {
    items: {
      type: "array of { label, sublabel?, status?:'done'|'todo'|'highlight' } (1-12)",
      required: true,
      example: [
        { label: 'Faster onboarding' },
        { label: 'Better defaults' },
        { label: 'Edge-case fixes', status: 'highlight' },
        { label: 'Docs refresh', status: 'todo' },
      ],
    },
    title: { type: 'string?', example: 'Key Improvements' },
  },
};

const PAD = 16;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 520;
  const h = opts.h ?? 360;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [60, 130, 200];

  // Normalize items: tolerate LLM emitting plain strings OR objects with
  // alternate label keys (text / name / title / value) instead of the spec's
  // canonical `label`. Sprint 17 quality fix — was 50% of slots rendered
  // empty bullets when LLM picked the wrong key.
  const rawItems = Array.isArray(args.items) ? args.items.slice(0, 12) : [];
  const items = rawItems.map((it) => {
    if (typeof it === 'string') return { label: it };
    if (!it || typeof it !== 'object') return { label: '' };
    return {
      ...it,
      label: it.label || it.text || it.name || it.title || it.value || '',
      sublabel: it.sublabel || it.subtitle || it.caption || it.description || '',
    };
  });
  const N = items.length;
  if (N === 0) return;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.075)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.16;
  }

  const plotH = y + h - plotTop - PAD;
  const rowH = plotH / N;
  const bulletR = Math.min(rowH * 0.18, 14);
  const bulletX = x + PAD + bulletR + 4;
  const textX = bulletX + bulletR + 16;

  for (let i = 0; i < N; i++) {
    const it = items[i] || {};
    const rowCY = plotTop + rowH * (i + 0.5);
    const status = it.status || 'todo';
    const bulletColor =
      status === 'highlight' ? accent : status === 'done' ? darken(accent, 0.2) : [200, 200, 205];
    const isFilled = status !== 'todo';

    // Bullet OR icon (Sprint 18: icon → small filled badge like PL style)
    ctx.save();
    if (it.icon) {
      // Badge color by status: todo = lighter accent (60% opacity via lighter color),
      // done = accent darkened 20%, highlight = full accent
      const badgeColor =
        status === 'todo' ? lighten(accent, 0.4) : status === 'done' ? darken(accent, 0.2) : accent;
      const badgeR = Math.min(bulletR * 1.3, 14); // ~22-28px diameter
      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      // Badge circle
      const badgeGrad = ctx.createRadialGradient(
        bulletX - badgeR * 0.3,
        rowCY - badgeR * 0.3,
        0,
        bulletX,
        rowCY,
        badgeR,
      );
      badgeGrad.addColorStop(0, rgbCss(lighten(badgeColor, 0.22)));
      badgeGrad.addColorStop(1, rgbCss(badgeColor));
      ctx.fillStyle = badgeGrad;
      ctx.beginPath();
      ctx.arc(bulletX, rowCY, badgeR, 0, Math.PI * 2);
      ctx.fill();
      // Specular
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.beginPath();
      ctx.ellipse(
        bulletX - badgeR * 0.25,
        rowCY - badgeR * 0.35,
        badgeR * 0.55,
        badgeR * 0.28,
        -0.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // Icon glyph (white) centered on badge
      ctx.shadowColor = 'transparent';
      const resolved = resolveIcon(it.icon);
      const viewBox = resolved.source === 'brand' ? 24 : 256;
      const iconSize = badgeR * 1.1;
      try {
        ctx.save();
        ctx.translate(bulletX - iconSize / 2, rowCY - iconSize / 2);
        ctx.scale(iconSize / viewBox, iconSize / viewBox);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        if (resolved.path) ctx.fill(resolved.path);
        ctx.restore();
      } catch (_) {
        /* Path2D unavailable (Node) */
      }
    } else if (isFilled) {
      ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1.5;
      const grad = ctx.createRadialGradient(
        bulletX - bulletR * 0.3,
        rowCY - bulletR * 0.3,
        0,
        bulletX,
        rowCY,
        bulletR,
      );
      grad.addColorStop(0, rgbCss(lighten(bulletColor, 0.3)));
      grad.addColorStop(1, rgbCss(bulletColor));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bulletX, rowCY, bulletR, 0, Math.PI * 2);
      ctx.fill();
      // Checkmark for done
      if (status === 'done') {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = Math.max(1.5, bulletR * 0.2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(bulletX - bulletR * 0.4, rowCY);
        ctx.lineTo(bulletX - bulletR * 0.1, rowCY + bulletR * 0.35);
        ctx.lineTo(bulletX + bulletR * 0.45, rowCY - bulletR * 0.3);
        ctx.stroke();
      }
    } else {
      // Open ring for 'todo'
      ctx.strokeStyle = rgbaCss(fg, 0.4);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(bulletX, rowCY, bulletR * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Label — wrap if too long for container width
    if (it.label) {
      const labelColor = status === 'todo' ? rgbaCss(fg, 0.55) : rgbCss(fg);
      const labelWeight = status === 'highlight' ? '700' : '600';
      const labelFontSize = Math.min(
        Math.round(rowH * 0.34),
        // Cap font: long text in narrow containers shouldn't dominate row height
        Math.round((x + w - textX - PAD) / Math.max(8, String(it.label).length * 0.45)),
      );
      ctx.fillStyle = labelColor;
      ctx.font = `${labelWeight} ${labelFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const maxW = x + w - textX - PAD;
      const lineH = labelFontSize * 1.2;
      const words = String(it.label).split(' ');
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
      // Vertical center: cap lines so they fit in rowH
      const maxLines = Math.max(1, Math.floor((rowH - 8) / lineH));
      const usedLines = lines.slice(0, maxLines);
      const startY = rowCY - ((usedLines.length - 1) * lineH) / 2 - (it.sublabel ? rowH * 0.1 : 0);
      usedLines.forEach((line, li) => {
        ctx.fillText(line, textX, startY + li * lineH);
      });
    }

    // Sublabel
    if (it.sublabel) {
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.font = `500 ${Math.round(rowH * 0.22)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(it.sublabel), textX, rowCY + rowH * 0.18);
    }
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
