// =============================================================================
// info-graphic-render.js — Atlas Present Sprint 1 v4 2D Info Graphic renderer
// -----------------------------------------------------------------------------
// Compose 2D info graphic via Canvas2D + system fonts (chrome) + Atlas
// silhouette CPU renderer (slide thumbnails inside section frames).
//
// Per spec Rule 9 + memory hard rule 5 (Atlas IP boundary):
//   - Atlas SDF: ONLY for slide thumbnails (silhouette CPU renderer)
//   - Canvas2D + system fonts: everything else (header / borders / arrows /
//     numbers / titles / page#)
//
// Layout (Linear archetype timeline form):
//   Header (top): deck title + meta
//   Each section: [num] [thumbnail box 150×150] [title] [page#], arranged
//                 left-to-right with arrows between
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-v4-design.md §5.2
// =============================================================================

import { compileScene, createRendererForId } from '../compositor-api.js';
import { computeView } from './linear-layout.js';
import { getSelectedVariant } from './deck-model.js';

const SECTION_WIDTH = 200;
const SECTION_HEIGHT = 300;
const THUMBNAIL_SIZE = 150;
const HEADER_HEIGHT = 80;
const PADDING = 40;

/**
 * Compute canvas dimensions needed for a deck.
 *
 * @param {Deck} deck
 * @returns {{width:number, height:number}}
 */
export function computeCanvasSize(deck) {
  const sectionCount = deck.sections.length;
  const width = Math.max(600, sectionCount * SECTION_WIDTH + PADDING * 2);
  const height = HEADER_HEIGHT + SECTION_HEIGHT + PADDING * 2;
  return { width, height };
}

/**
 * Render an info graphic for a deck onto a Canvas2D context. Deterministic
 * given same deck + same canvas dimensions.
 *
 * @param {Deck} deck
 * @param {HTMLCanvasElement} canvas
 */
export function renderInfoGraphic(deck, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Clear + background
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, W, H);

  // Header
  drawHeader(ctx, deck, W);

  // Sections (only render ready ones; pending/lifting/error shown as placeholder)
  const sectionTop = HEADER_HEIGHT + PADDING;
  for (let i = 0; i < deck.sections.length; i++) {
    const section = deck.sections[i];
    const x = PADDING + i * SECTION_WIDTH + (SECTION_WIDTH - THUMBNAIL_SIZE) / 2;
    drawSection(ctx, section, i, x, sectionTop);

    // Arrow between this section and next
    if (i < deck.sections.length - 1) {
      drawArrow(
        ctx,
        x + THUMBNAIL_SIZE,
        sectionTop + 20 + THUMBNAIL_SIZE / 2,
        x + SECTION_WIDTH,
        sectionTop + 20 + THUMBNAIL_SIZE / 2,
      );
    }
  }
}

/**
 * Header: deck title + source info.
 *
 * @private
 */
function drawHeader(ctx, deck, W) {
  ctx.fillStyle = '#111';
  ctx.font = 'bold 20px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(deck.title, PADDING, PADDING - 20);

  ctx.fillStyle = '#666';
  ctx.font = '12px -apple-system, system-ui, sans-serif';
  const meta = `${deck.source.type.toUpperCase()}: ${deck.source.fileName} · ${deck.sections.length} sections · ${deck.layout.archetype}`;
  ctx.fillText(meta, PADDING, PADDING + 6);

  // Divider line
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, HEADER_HEIGHT);
  ctx.lineTo(W - PADDING, HEADER_HEIGHT);
  ctx.stroke();
}

/**
 * One section: number, thumbnail (silhouette of sceneData OR placeholder),
 * title, page#.
 *
 * @private
 */
function drawSection(ctx, section, index, x, y) {
  // Number (above thumbnail)
  ctx.fillStyle = '#888';
  ctx.font = 'bold 24px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(String(index + 1), x, y - 8);

  // Thumbnail frame
  const thumbY = y + 24;
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, thumbY, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

  // Thumbnail content — read from selected variant (Sprint 1.5 v4 schema)
  const variant = getSelectedVariant(section);
  if (section.status === 'ready' && variant?.sceneData) {
    drawSliceThumbnail(ctx, variant.sceneData, x, thumbY, THUMBNAIL_SIZE);
  } else {
    drawPlaceholder(ctx, x, thumbY, THUMBNAIL_SIZE, section.status, variant?.liftError);
  }

  // Title (below thumbnail)
  const titleY = thumbY + THUMBNAIL_SIZE + 12;
  ctx.fillStyle = '#222';
  ctx.font = '13px -apple-system, system-ui, sans-serif';
  const title = variant?.region?.title || section.prompt || `Page ${index + 1}`;
  const truncated = truncateText(ctx, title, THUMBNAIL_SIZE);
  ctx.fillText(truncated, x, titleY);

  // Page #
  ctx.fillStyle = '#999';
  ctx.font = '11px -apple-system, system-ui, sans-serif';
  ctx.fillText(`Page ${section.pageIndex + 1}`, x, titleY + 20);
}

/**
 * Render slide sceneData as silhouette into a sub-region of ctx.
 *
 * Uses Atlas silhouette CPU renderer on a temporary canvas, then drawImage
 * to composite. Per Atlas IP boundary rule: SDF render only inside section
 * thumbnail frame.
 *
 * @private
 */
function drawSliceThumbnail(ctx, sceneData, x, y, size) {
  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const renderer = createRendererForId('silhouette', tempCanvas);
    const compiled = compileScene(sceneData);
    const view = computeView(sceneData);
    renderer.render([{ sdf: compiled.sdf, color: [60, 60, 60] }], {
      background: [245, 245, 245],
      view,
    });
    ctx.drawImage(tempCanvas, x, y);
  } catch (e) {
    // Fallback: render an error placeholder
    drawPlaceholder(ctx, x, y, size, 'error', e.message);
  }
}

/**
 * Placeholder for pending / lifting / error sections.
 *
 * @private
 */
function drawPlaceholder(ctx, x, y, size, status, errorMsg) {
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = '#888';
  ctx.font = '12px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = status === 'error' ? '⚠ Error' : status === 'lifting' ? '⏳ Lifting...' : '· · ·';
  ctx.fillText(label, x + size / 2, y + size / 2);
  if (status === 'error' && errorMsg) {
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    const truncated = truncateText(ctx, errorMsg, size - 16);
    ctx.fillText(truncated, x + size / 2, y + size / 2 + 18);
  }
  // Reset textAlign to default
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

/**
 * Draw arrow from (x1,y1) to (x2,y2).
 *
 * @private
 */
function drawArrow(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = '#aaa';
  ctx.fillStyle = '#aaa';
  ctx.lineWidth = 2;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - 6, y2);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8, y2 - 4);
  ctx.lineTo(x2 - 8, y2 + 4);
  ctx.closePath();
  ctx.fill();
}

/**
 * Truncate text with ellipsis to fit maxWidth.
 *
 * @private
 */
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}
