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
import { mountP5Renderer } from './p5-renderer.js';
import { renderSceneDataToCanvas } from './atoms-2d/renderer.js';
import { isAtom2DType } from './atoms-2d/registry.js';

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

  function isP5SketchVariant(variant) {
    return variant?.sceneData?.subjects?.[0]?.type === 'p5-sketch';
  }

  function isAtom2DVariant(variant) {
    // True when ALL subjects in the scene are 2D atoms (registered in atoms-2d).
    // Renders via main-page Canvas2D path (atoms-2d/renderer), bypassing the
    // SDF compile + silhouette pipeline.
    const subs = variant?.sceneData?.subjects;
    if (!Array.isArray(subs) || subs.length === 0) return false;
    return subs.every((s) => s && isAtom2DType(s.type));
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
    // Sprint 3: p5-sketch variants render via iframe (mounted in p5-mount div)
    if (isP5SketchVariant(sel)) {
      return `<div class="p5-mount" style="width: 600px; height: 360px;" data-visual-id="${visual.id}"></div>`;
    }
    // Sprint 14a: atom-2d variants render via main-page Canvas2D (same canvas
    // element as traditional, but renderActiveVariantCanvas dispatches differently)
    // Traditional sceneData renders via canvas
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
    const sel = deckModel.getSelectedVisualVariant(visual);
    const isP5 = isP5SketchVariant(sel);
    return `
      <div class="visual-menu">
        <button data-action="swap-layout">Swap Layout</button>
        <button data-action="effects" ${isP5 ? 'disabled title="Effects N/A for P5 sketch variants"' : ''}>${isP5 ? 'Effects (n/a)' : 'Effects (' + visual.activeEffect + ')'}</button>
        <button data-action="export">Export Visual</button>
        <button data-action="swap-branding">Swap Branding</button>
      </div>
    `;
  }

  function attachEventHandlers(visual) {
    // Menu opens on click — either canvas (traditional variant) or p5-mount (p5-sketch variant)
    const toggleMenu = () => {
      menuOpen = !menuOpen;
      render();
    };
    wrapper.querySelector('.visual-canvas')?.addEventListener('click', toggleMenu);
    wrapper.querySelector('.p5-mount')?.addEventListener('click', toggleMenu);
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

  async function exportPng(visual) {
    const sel = deckModel.getSelectedVisualVariant(visual);
    let dataUrl = null;
    if (isP5SketchVariant(sel) && p5Handle) {
      dataUrl = await p5Handle.exportPng();
    } else {
      const canvas = wrapper.querySelector('.visual-canvas');
      if (canvas) dataUrl = canvas.toDataURL('image/png');
    }
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(visual.textAnchor.text || 'visual').slice(0, 30).replace(/[^a-z0-9_-]/gi, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  let p5Handle = null; // Per-instance handle for current p5 renderer (Sprint 3)

  function renderActiveVariantCanvas(visual) {
    const sel = deckModel.getSelectedVisualVariant(visual);
    if (!sel || sel.status !== 'ready' || !sel.sceneData) return;

    // Sprint 3: route to p5 renderer if variant is p5-sketch
    if (isP5SketchVariant(sel)) {
      // Destroy any prior p5 handle (in case we switched variants)
      if (p5Handle) {
        p5Handle.destroy();
        p5Handle = null;
      }
      // Find or create p5 mount container inside the main visual area
      let p5Mount = wrapper.querySelector('.visual-main .p5-mount');
      if (!p5Mount) {
        // The renderMainArea() output gave us a canvas; replace it with a p5-mount div
        const visualMain = wrapper.querySelector('.visual-main');
        if (visualMain) {
          visualMain.innerHTML =
            '<div class="p5-mount" style="width: 600px; height: 360px;"></div>';
          p5Mount = visualMain.querySelector('.p5-mount');
        }
      }
      if (p5Mount) {
        const palette = getPalette(visual.activeBranding);
        p5Handle = mountP5Renderer(p5Mount, sel.sceneData, palette);
      }
    } else if (isAtom2DVariant(sel)) {
      // Sprint 14a: atom-2d variants → main-page Canvas2D via atoms-2d/renderer
      if (p5Handle) {
        p5Handle.destroy();
        p5Handle = null;
      }
      const canvas = wrapper.querySelector('.visual-canvas');
      if (!canvas) return;
      renderAtom2DToCanvas(canvas, sel.sceneData, visual.activeBranding);
    } else {
      // Traditional sceneData → render via active CPU effect
      if (p5Handle) {
        p5Handle.destroy();
        p5Handle = null;
      }
      const canvas = wrapper.querySelector('.visual-canvas');
      if (!canvas) return;
      renderVariantToCanvas(canvas, sel.sceneData, visual.activeEffect, visual.activeBranding);
    }

    // Render picker thumbnails — for p5-sketch variants, show placeholder
    // (rendering 6 iframes simultaneously is expensive; only mount the selected
    // variant via iframe. Thumbnails show static info.)
    if (pickerOpen) {
      wrapper.querySelectorAll('.thumb-canvas').forEach((thumb) => {
        const idx = parseInt(thumb.dataset.variantIndex, 10);
        const v = visual.variants[idx];
        if (v?.status === 'ready' && v.sceneData) {
          if (isP5SketchVariant(v)) {
            // Render placeholder for p5-sketch thumbnails
            const ctx = thumb.getContext('2d');
            const palette = getPalette(visual.activeBranding);
            ctx.fillStyle = `rgb(${palette.bg.join(',')})`;
            ctx.fillRect(0, 0, thumb.width, thumb.height);
            ctx.fillStyle = `rgb(${palette.silhouetteColor.join(',')})`;
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('P5 sketch', thumb.width / 2, thumb.height / 2 - 6);
            ctx.fillText(`(${v.archetype || 'fallback'})`, thumb.width / 2, thumb.height / 2 + 8);
          } else if (isAtom2DVariant(v)) {
            // Sprint 14a: atom-2d thumb via atoms-2d/renderer
            renderAtom2DToCanvas(thumb, v.sceneData, visual.activeBranding);
          } else {
            renderVariantToCanvas(thumb, v.sceneData, visual.activeEffect, visual.activeBranding);
          }
        } else {
          // pending/lifting/error placeholder (existing logic)
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

  function renderAtom2DToCanvas(canvas, sceneData, brandingId) {
    try {
      const palette = getPalette(brandingId);
      // Inject full palette so atoms can read .colors[i] for multi-color rendering
      const injectedPalette = {
        bg: palette.bg,
        silhouetteColor: palette.silhouetteColor,
        colors: palette.colors || null,
        stroke: palette.stroke || palette.silhouetteColor,
      };
      // Fire-and-forget; renderSceneDataToCanvas is async (dynamic-import atoms)
      // but UI doesn't need to await — canvas updates as soon as render completes.
      renderSceneDataToCanvas(canvas, sceneData, { palette: injectedPalette }).catch((e) => {
        console.error('[visual-panel] atom-2d render error:', e);
      });
    } catch (e) {
      console.error('[visual-panel] atom-2d render error:', e);
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
      if (p5Handle) {
        p5Handle.destroy();
        p5Handle = null;
      }
      wrapper.innerHTML = '';
    },
  };
}
