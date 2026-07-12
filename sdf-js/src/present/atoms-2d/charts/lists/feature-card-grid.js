// =============================================================================
// atoms-2d/charts/lists/feature-card-grid.js — Feature card grid
// -----------------------------------------------------------------------------
// Grid of feature cards. Each card = icon (top) + bold title (middle) + body (bottom).
// Different from icon-grid (icon+label only, no body paragraph).
//
// Args:
//   title?     — optional heading
//   features   — array of { icon, title, body } (3-9) REQUIRED
//   cols?      — number (auto: 3 for ≤6, else 4)
//   bg?        — 'cards'|'plain' (default 'cards')
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { resolveIcon } from '../../../../icons/index.js';

export const spec = {
  type: 'feature-card-grid',
  category: 'charts/lists',
  description: 'Grid of feature cards — icon + bold title + body paragraph per card.',
  args: {
    title: { type: 'string?', example: 'Platform Features' },
    features: {
      type: 'array of { icon, title, body } (3-9)',
      required: true,
      example: [
        {
          icon: 'shield',
          title: 'Security',
          body: 'End-to-end encryption with zero-knowledge architecture',
        },
        { icon: 'lightning', title: 'Performance', body: 'Sub-100ms response times globally' },
        { icon: 'globe', title: 'Global Reach', body: '150+ countries, 50+ languages supported' },
      ],
    },
    cols: { type: 'number?', default: 'auto (3 for ≤6, else 4)', example: 3 },
    bg: { type: "'cards'|'plain'?", default: "'cards'", example: 'cards' },
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────

function lighten([r, g, b], amount = 0.85) {
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ];
}

// Word-wrap `text` to `maxW`, capped at `maxLines`. Tokenizes on whitespace
// AND after hyphens (so "zero-knowledge" can break to "zero-" / "knowledge"
// like a real typesetter, instead of only ever breaking on spaces). If the
// full text needs more lines than that, the LAST visible line gets an
// ellipsis appended — dropping whole trailing tokens first so we never cut a
// word in half; only falls back to a char-level trim if a single token alone
// is wider than maxW.
function wrapText(ctx, text, maxW, maxLines = 4) {
  const rawTokens = String(text).match(/\S+?-|\S+/g) || [];
  // CJK has no spaces — a whole sentence arrives as ONE token and would
  // never wrap (the pull-quote lesson, Sprint 37). Any token wider than the
  // column breaks at char level first.
  const tokens = [];
  for (const tok of rawTokens) {
    if (ctx.measureText(tok).width <= maxW) {
      tokens.push(tok);
      continue;
    }
    let chunk = '';
    for (const ch of tok) {
      if (chunk && ctx.measureText(chunk + ch).width > maxW) {
        tokens.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    if (chunk) tokens.push(chunk);
  }
  const allLines = [];
  let line = '';
  for (const tok of tokens) {
    const needsSpace = line !== '' && !line.endsWith('-');
    const test = needsSpace ? line + ' ' + tok : line + tok;
    if (line && ctx.measureText(test).width > maxW) {
      allLines.push(line);
      line = tok;
    } else {
      line = test;
    }
  }
  if (line) allLines.push(line);

  if (allLines.length <= maxLines) return allLines;

  const truncated = allLines.slice(0, maxLines);
  let last = truncated[maxLines - 1];
  while (last.length > 0 && ctx.measureText(last + '…').width > maxW) {
    const idx = last.lastIndexOf(' ');
    last = idx > 0 ? last.slice(0, idx) : last.slice(0, -1);
  }
  truncated[maxLines - 1] = last + '…';
  return truncated;
}

// Auto-shrink font size until `text` fits `maxW` (no truncation). Mirrors the
// fitFontSize pattern in charts/lists/numbered-grid.js.
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}

function drawIconCentered(ctx, iconName, cx, cy, size, color) {
  const resolved = resolveIcon(iconName);
  if (!resolved || !resolved.path) return;
  const viewBox = resolved.source === 'brand' ? 24 : 256;
  const scale = size / viewBox;
  try {
    ctx.save();
    ctx.fillStyle = rgbCss(color);
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(scale, scale);
    ctx.fill(resolved.path);
    ctx.restore();
  } catch (_) {
    ctx.restore();
    /* Path2D unavailable (Node) */
  }
}

// ── render ────────────────────────────────────────────────────────────────────

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const features = Array.isArray(args.features) ? args.features : [];
  const bg = args.bg ?? 'cards';
  const accent = palette.accent ?? [30, 80, 180];
  const themeFg = palette.silhouetteColor ?? [20, 28, 50];
  // Sprint 87: cards are WHITE — text ink must be dark regardless of theme
  // (dark themes carry a light fg that ghosts on paper; the kpi lesson)
  const fgLum = (0.2126 * themeFg[0] + 0.7152 * themeFg[1] + 0.0722 * themeFg[2]) / 255;
  const fg = args.bg === 'plain' ? themeFg : fgLum > 0.55 ? [42, 44, 50] : themeFg;
  const bgColor = palette.bg ?? [248, 246, 240];

  // Background
  ctx.fillStyle = rgbCss(bgColor);
  ctx.fillRect(x, y, w, h);

  const PAD = 24;
  let plotTop = y + PAD;

  // Title
  if (args.title) {
    const titleFs = Math.round(h * 0.07);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + w / 2, plotTop);
    plotTop += titleFs + PAD;
  }

  if (!features.length) return;

  const cols = args.cols ?? (features.length <= 6 ? 3 : 4);
  const rows = Math.ceil(features.length / cols);
  const colW = (w - PAD * 2) / cols;
  const availH = h - (plotTop - y) - PAD;
  const rowH = availH / rows;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = x + PAD + col * colW;
    const cellY = plotTop + row * rowH;
    const cardPad = 16;
    const cardMargin = 8;
    const cardX = cellX + cardMargin;
    const cardY = cellY + cardMargin;
    const cardW = colW - cardMargin * 2;
    const cardH = rowH - cardMargin * 2;
    const r = 8;

    // Card background
    if (bg !== 'plain') {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.10)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, r);
      ctx.fill();
      ctx.restore();
    }

    // Icon
    // Sprint 87 (user: 图标做大): anchor, not footnote
    const iconR = Math.min(rowH * 0.19, colW * 0.15, 52);
    const iconCX = cellX + colW / 2;
    const iconCY = cardY + cardPad + iconR;

    if (f.icon) {
      // Accent circle badge
      const badgeR = iconR + 6;
      const badgeBg = lighten(accent, 0.88);
      ctx.fillStyle = rgbCss(badgeBg);
      ctx.beginPath();
      ctx.arc(iconCX, iconCY, badgeR, 0, Math.PI * 2);
      ctx.fill();
      drawIconCentered(ctx, f.icon, iconCX, iconCY, iconR * 1.4, accent);
    }

    let curY = iconCY + iconR + 8;
    const textMaxW = cardW - cardPad * 2;

    // Title — auto-shrink so long titles ("Performance", "Global Reach")
    // never overflow the card into its neighbor.
    if (f.title) {
      const titleTarget = Math.round(rowH * 0.13);
      const titleFs = fitFontSize(
        ctx,
        f.title,
        textMaxW,
        titleTarget,
        12,
        (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
      );
      ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = rgbCss(fg);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(f.title, iconCX, curY);
      curY += titleFs + 6;
    }

    // Body — word-wrap capped by the space actually LEFT in the card
    // (Sprint 84, user: 右侧字体过大超出范围 — a 4-line budget ignored the
    // card bottom and let dense CJK bodies spill past the rounded rect).
    let bodyFs = Math.round(rowH * 0.09);
    const cardBottom = cardY + cardH - cardPad;
    let fitLines = Math.floor((cardBottom - curY) / (bodyFs + 2));
    if (fitLines < 2 && bodyFs > 10) {
      bodyFs = Math.max(10, Math.round(bodyFs * 0.82)); // one shrink step buys a line
      fitLines = Math.floor((cardBottom - curY) / (bodyFs + 2));
    }
    const maxLines = Math.max(1, Math.min(4, fitLines));
    ctx.font = `500 ${bodyFs}px Inter, system-ui`;
    ctx.fillStyle = rgbaCss(fg, 0.55);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (f.body && maxLines > 0) {
      const lines = wrapText(ctx, f.body, textMaxW, maxLines);
      for (const line of lines) {
        ctx.fillText(line, iconCX, curY);
        curY += bodyFs + 2;
      }
    }
  }
}
