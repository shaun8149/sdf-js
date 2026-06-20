// =============================================================================
// visual-panel.js — Atlas Present Sprint 2 embedded visual + picker + menu
// -----------------------------------------------------------------------------
// One visual = one mounted panel. Manages:
//   - main canvas rendering the selected variant via activeEffect renderer
//   - left-side picker panel (toggleable) showing 6 variant thumbnails
//   - image context menu (4 items: Swap Layout / Effects / Export / Swap Branding)
//
// Menu sub-panels:
//   - Swap Layout: re-opens picker (cached variants, no extra cost)
//   - Effects: cycles renderer (silhouette → lines → crayon → topo)
//   - Export Visual: canvas.toDataURL → download PNG
//   - Swap Branding: cycles palette preset
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6 step 8-13
// =============================================================================

import * as deckModel from './deck-model.js';
import { compileScene, createRendererForId } from '../compositor-api.js';
import { BRANDING_PALETTES, getPalette } from './branding-palettes.js';

const RENDERERS = ['silhouette', 'lines', 'crayon', 'topo'];

/**
 * Mount a visual panel for one visual into the wrapper element.
 *
 * @param {HTMLElement} wrapper
 * @param {object} deck
 * @param {string} visualId
 * @returns {{refresh: Function, destroy: Function}}
 */
export function mountVisualPanel(wrapper, deck, visualId) {
  let pickerOpen = false;
  let menuOpen = false;

  function getVisual() {
    return deck.visuals.find((v) => v.id === visualId);
  }

  function render() {
    const visual = getVisual();
    if (!visual) {
      wrapper.innerHTML = '<div class="visual-panel-error">visual not found</div>';
      return;
    }
    wrapper.innerHTML = `
      <div class="visual-panel">
        ${pickerOpen ? renderPicker(visual) : ''}
        <div class="visual-main">
          ${renderMainArea(visual)}
        </div>
      </div>
      ${menuOpen ? renderMenu(visual) : ''}
    `;
    attachEventHandlers(visual);
    renderActiveVariantCanvas(visual);
  }

  function renderMainArea(visual) {
    if (visual.status === 'pending') {
      return `<div class="visual-placeholder">⏳ pending…</div>`;
    }
    const sel = deckModel.getSelectedVisualVariant(visual);
    if (!sel) return `<div class="visual-placeholder">no variant</div>`;
    if (sel.status === 'lifting') {
      return `<div class="visual-placeholder">⏳ lifting variant ${visual.selectedVariantIndex + 1}/6…</div>`;
    }
    if (sel.status === 'error') {
      return `<div class="visual-placeholder error">⚠ ${escapeHtml(sel.liftError || 'error')}</div>`;
    }
    if (sel.status === 'pending') {
      return `<div class="visual-placeholder">⏳ pending…</div>`;
    }
    return `<canvas class="visual-canvas" width="600" height="360" data-visual-id="${visual.id}"></canvas>`;
  }

  function renderPicker(visual) {
    const readyCount = visual.variants.filter((v) => v.status === 'ready').length;
    return `
      <div class="visual-picker">
        <div class="picker-header">
          <span>Variants (${readyCount}/${visual.variants.length} ready)</span>
          <button class="picker-close" aria-label="Close">✕</button>
        </div>
        <div class="picker-thumbs">
          ${visual.variants
            .map(
              (v, i) => `
                <div class="picker-thumb ${i === visual.selectedVariantIndex ? 'selected' : ''} ${v.status}" data-variant-index="${i}">
                  <canvas class="thumb-canvas" width="120" height="80" data-variant-index="${i}"></canvas>
                  <div class="thumb-label">${escapeHtml(v.archetype || v.status)}</div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    `;
  }

  function renderMenu(visual) {
    return `
      <div class="visual-menu">
        <button data-action="swap-layout">Swap Layout</button>
        <button data-action="effects">Effects (${visual.activeEffect})</button>
        <button data-action="export">Export Visual</button>
        <button data-action="swap-branding">Swap Branding</button>
      </div>
    `;
  }

  function attachEventHandlers(visual) {
    wrapper.querySelector('.visual-canvas')?.addEventListener('click', () => {
      menuOpen = !menuOpen;
      render();
    });
    wrapper.querySelector('.picker-close')?.addEventListener('click', () => {
      pickerOpen = false;
      render();
    });
    wrapper.querySelectorAll('.picker-thumb').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.variantIndex, 10);
        if (visual.variants[idx]?.status === 'ready') {
          deckModel.selectVisualVariant(deck, visualId, idx);
          deckModel.saveDeckToStorage(deck);
          render();
        }
      });
    });
    wrapper.querySelectorAll('.visual-menu button').forEach((el) => {
      el.addEventListener('click', () => {
        handleMenuAction(el.dataset.action, visual);
      });
    });
  }

  function handleMenuAction(action, visual) {
    menuOpen = false;
    switch (action) {
      case 'swap-layout':
        pickerOpen = true;
        render();
        break;
      case 'effects':
        cycleEffect(visual);
        render();
        break;
      case 'export':
        exportPng(visual);
        break;
      case 'swap-branding':
        cycleBranding(visual);
        render();
        break;
    }
  }

  function cycleEffect(visual) {
    const curIdx = RENDERERS.indexOf(visual.activeEffect);
    const next = RENDERERS[(curIdx + 1) % RENDERERS.length];
    deckModel.setActiveEffect(deck, visualId, next);
    deckModel.saveDeckToStorage(deck);
  }

  function cycleBranding(visual) {
    const curIdx = BRANDING_PALETTES.findIndex((p) => p.id === visual.activeBranding);
    const next = BRANDING_PALETTES[(curIdx + 1) % BRANDING_PALETTES.length].id;
    deckModel.setActiveBranding(deck, visualId, next);
    deckModel.saveDeckToStorage(deck);
  }

  function exportPng(visual) {
    const canvas = wrapper.querySelector('.visual-canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(visual.textAnchor.text || 'visual').slice(0, 30).replace(/[^a-z0-9_-]/gi, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function renderActiveVariantCanvas(visual) {
    const canvas = wrapper.querySelector('.visual-canvas');
    if (!canvas) return;
    const sel = deckModel.getSelectedVisualVariant(visual);
    if (!sel || sel.status !== 'ready' || !sel.sceneData) return;
    renderVariantToCanvas(canvas, sel.sceneData, visual.activeEffect, visual.activeBranding);

    // Render thumbnails inside picker
    if (pickerOpen) {
      wrapper.querySelectorAll('.thumb-canvas').forEach((thumb) => {
        const idx = parseInt(thumb.dataset.variantIndex, 10);
        const v = visual.variants[idx];
        if (v?.status === 'ready' && v.sceneData) {
          renderVariantToCanvas(thumb, v.sceneData, visual.activeEffect, visual.activeBranding);
        } else {
          const ctx = thumb.getContext('2d');
          ctx.fillStyle = '#eee';
          ctx.fillRect(0, 0, thumb.width, thumb.height);
          ctx.fillStyle = '#999';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(v?.status || '·', thumb.width / 2, thumb.height / 2);
        }
      });
    }
  }

  function renderVariantToCanvas(canvas, sceneData, effect, brandingId) {
    try {
      const renderer = createRendererForId(effect, canvas);
      const compiled = compileScene(sceneData);
      const palette = getPalette(brandingId);
      const view = computeAutoFitView(sceneData);
      renderer.render([{ sdf: compiled.sdf, color: palette.silhouetteColor }], {
        background: palette.bg,
        view,
      });
    } catch (e) {
      console.error('[visual-panel] render error:', e);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fee';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#a55';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('render error', canvas.width / 2, canvas.height / 2);
    }
  }

  function computeAutoFitView(sceneData) {
    // Inline copy of Sprint 1.5's computeView since linear-layout.js was deleted
    const subjects = sceneData?.subjects ?? [];
    if (subjects.length === 0) return 0.75;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const s of subjects) {
      const t = s.transform?.translate ?? [0, 0, 0];
      if (t[0] < minX) minX = t[0];
      if (t[1] < minY) minY = t[1];
      if (t[0] > maxX) maxX = t[0];
      if (t[1] > maxY) maxY = t[1];
    }
    const halfWidth = Math.max(0.5, (maxX - minX) / 2);
    const halfHeight = Math.max(0.5, (maxY - minY) / 2);
    const raw = Math.max(halfWidth, halfHeight) * 1.5;
    return Math.min(50, Math.max(0.5, raw));
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Initial render
  render();

  return {
    refresh: render,
    destroy: () => {
      wrapper.innerHTML = '';
    },
  };
}
