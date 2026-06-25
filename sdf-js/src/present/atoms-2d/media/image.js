// =============================================================================
// atoms-2d/media/image.js — Image atom (URL src, cover/contain/fill fit)
// -----------------------------------------------------------------------------
// Sprint 18 Tier 3 C — closes structural gap vs PL D3180 reference benchmark.
//
// Semantic: renders an image from a URL with fit math. Supports optional caption
// overlay and border radius. In Node (bake CLI) emits a placeholder rect — the
// real rendering happens browser-side in the viewer.
//
// Args:
//   src             — URL (required)
//   fit             — 'cover'|'contain'|'fill' (default 'cover')
//   caption         — optional caption string (renders as semi-opaque bar)
//   captionPosition — 'bottom'|'top' (default 'bottom')
//   borderRadius    — number in px (default 0)
//
// Render strategy:
//   In browser: loads image via Image API, draws with fit math + caption overlay.
//   In Node:    draws placeholder rect with "IMG" label + URL snippet (no crash).
// =============================================================================

export const spec = {
  type: 'image',
  category: 'media',
  description:
    'Render an image already present in the source document. src MUST be a data: URI or relative path the parser emitted from embedded media. Do NOT use internet URLs or generated/stock images.',
  args: {
    src: {
      type: 'string (data: URI or parser-emitted relative path)',
      required: true,
      example:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWNgIBb8BwABKAEBwGDOlAAAAABJRU5ErkJggg==',
    },
    fit: { type: "'cover'|'contain'|'fill'?", default: "'cover'", example: 'cover' },
    caption: { type: 'string?', example: 'Slide 3 photo' },
    captionPosition: { type: "'bottom'|'top'?", default: "'bottom'", example: 'bottom' },
    borderRadius: { type: 'number?', default: 0, example: 12 },
  },
};

// In-browser image cache: URL → HTMLImageElement (fully loaded)
const _imgCache = new Map();

/**
 * Load an image from URL. Returns a Promise<HTMLImageElement>.
 * Caches loaded images so re-renders are instant.
 */
function loadImage(url) {
  if (_imgCache.has(url)) {
    const cached = _imgCache.get(url);
    if (cached.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      _imgCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      // Store a sentinel so we don't retry on every frame
      _imgCache.set(url, { failed: true, complete: true, naturalWidth: 0 });
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Apply clipping path for borderRadius before drawing image.
 */
function clipRoundRect(ctx, x, y, w, h, r) {
  if (!r || r <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.clip();
}

/**
 * Draw placeholder rect (Node env or failed load).
 */
function drawPlaceholder(ctx, x, y, w, h, url) {
  ctx.save();
  ctx.fillStyle = 'rgba(120,120,140,0.25)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(80,80,100,0.5)';
  ctx.font = `bold ${Math.min(24, h * 0.12)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('IMG', x + w / 2, y + h / 2 - 14);
  if (url) {
    ctx.font = `${Math.min(11, h * 0.06)}px Inter, monospace`;
    ctx.fillStyle = 'rgba(80,80,100,0.4)';
    const snippet = url.length > 40 ? url.slice(0, 37) + '...' : url;
    ctx.fillText(snippet, x + w / 2, y + h / 2 + 14);
  }
  ctx.restore();
}

/**
 * Draw a caption bar (semi-opaque gradient + white text).
 */
function drawCaption(ctx, x, y, w, h, caption, position) {
  if (!caption) return;
  const barH = Math.min(44, h * 0.15);
  const barY = position === 'top' ? y : y + h - barH;

  ctx.save();
  const grad = ctx.createLinearGradient(x, barY, x, barY + barH);
  if (position === 'top') {
    grad.addColorStop(0, 'rgba(0,0,0,0.65)');
    grad.addColorStop(1, 'rgba(0,0,0,0.0)');
  } else {
    grad.addColorStop(0, 'rgba(0,0,0,0.0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.65)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x, barY, w, barH);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `500 ${Math.max(10, Math.min(14, barH * 0.55))}px Inter, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, x + 12, barY + barH / 2);
  ctx.restore();
}

/**
 * Compute drawImage params for cover/contain/fill fit.
 */
function fitRect(imgW, imgH, dstX, dstY, dstW, dstH, fit) {
  if (fit === 'fill') {
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx: dstX, dy: dstY, dw: dstW, dh: dstH };
  }
  const scaleX = dstW / imgW;
  const scaleY = dstH / imgH;
  let scale;
  if (fit === 'contain') {
    scale = Math.min(scaleX, scaleY);
  } else {
    // cover (default)
    scale = Math.max(scaleX, scaleY);
  }
  const rendW = imgW * scale;
  const rendH = imgH * scale;
  const offX = (dstW - rendW) / 2;
  const offY = (dstH - rendH) / 2;
  return {
    sx: 0,
    sy: 0,
    sw: imgW,
    sh: imgH,
    dx: dstX + offX,
    dy: dstY + offY,
    dw: rendW,
    dh: rendH,
  };
}

/**
 * Async render. Awaits image load in browser; in Node draws placeholder.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} args — see spec.args
 * @param {object} [opts]
 */
export async function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 640;
  const h = opts.h ?? 360;
  const src = args.src || '';
  const fit = args.fit || 'cover';
  const caption = args.caption || null;
  const captionPosition = args.captionPosition || 'bottom';
  const borderRadius = args.borderRadius ?? 0;

  ctx.save();

  if (borderRadius > 0) {
    clipRoundRect(ctx, x, y, w, h, borderRadius);
  }

  // Node env: no Image constructor → draw placeholder
  if (typeof Image === 'undefined') {
    if (src) console.warn(`[image atom] Node env — skipping fetch of ${src}`);
    drawPlaceholder(ctx, x, y, w, h, src);
    ctx.restore();
    return;
  }

  // Browser: load + draw
  const img = await loadImage(src);
  if (!img || img.failed || img.naturalWidth === 0) {
    drawPlaceholder(ctx, x, y, w, h, src);
  } else {
    const { sx, sy, sw, sh, dx, dy, dw, dh } = fitRect(
      img.naturalWidth,
      img.naturalHeight,
      x,
      y,
      w,
      h,
      fit,
    );
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  drawCaption(ctx, x, y, w, h, caption, captionPosition);
  ctx.restore();
}
