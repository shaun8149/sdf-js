// =============================================================================
// renderer-registry.js — single source of truth for renderer ids, aliases, and
// the id→factory mapping. Resolves the split that let Present's effect cycle
// (silhouette → lines → crayon → topo) throw: createRendererForId only knew
// silhouette|studio|fly3d, so `lines`/`crayon`/`topo` hit the "unknown renderer
// id" throw the moment visual-panel re-rendered a variant with them.
//
// Two renderer families:
//   • CPU 2D (Present effects + compositor 2D pills) — fn(ctx, layers, opts),
//     no getControls. silhouette / hatch / bobStipple.
//   • GPU 3D (compositor) — createXxxRenderer({canvas, getControls, onFps}).
//     studio / fly3d here; the compositor owns the rest via its own ensure*().
// =============================================================================

import { silhouette } from './silhouette.js';
import { hatch } from './hatch.js';
import { bobStipple } from './bobStipple.js';
import { createStudioRenderer } from './studio.js';
import { createFly3DRenderer } from './flyLambert.js';

// The four CPU effects Present cycles through (visual-panel + deck-model).
export const PRESENT_EFFECTS = ['silhouette', 'lines', 'crayon', 'topo'];

// Renderers that need a WebGL canvas + getControls (drive a per-frame loop).
// Used by the compositor to pick canvas + lifecycle. crayon/topo are GPU here
// (the compositor's 3D streamline/crayon renderers); Present's 2D crayon/topo
// go through createRendererForId below (CPU), never this set.
export const GPU_RENDERER_IDS = new Set([
  'fly3d',
  'bob-gpu',
  'blueprint',
  'crayon',
  'topo',
  'studio',
]);

// Pill / effect id → canonical CPU-renderer key. (Compositor uses 'bob' for the
// stipple pill; Present uses 'lines' for hatch.) Unlisted ids pass through.
export const RENDERER_ALIASES = {
  lines: 'hatch',
  hatch: 'hatch',
  bob: 'bobStipple',
};

export function normalizeRendererId(id) {
  return RENDERER_ALIASES[id] || id;
}

export function isGpuRenderer(id) {
  return GPU_RENDERER_IDS.has(normalizeRendererId(id));
}

// Wrap a CPU 2D renderer fn(ctx, layers, opts) into the {render, unmount} shape.
// layerPatch (optional) is merged into every layer — e.g. hatch's `pasmaStyle`.
function cpu2dRenderer(canvas, fn, layerPatch) {
  return {
    render(layers, renderOpts = {}) {
      const ctx = canvas.getContext('2d');
      const ls = layerPatch ? layers.map((l) => ({ ...l, ...layerPatch })) : layers;
      fn(ctx, ls, renderOpts);
    },
    unmount() {
      // CPU renderers hold no GL/raf resources.
    },
  };
}

/**
 * Create a renderer instance for an id. Returns { render, unmount }.
 *
 * Present effects (CPU 2D, no getControls needed):
 *   silhouette → silhouette · lines → hatch · crayon → bobStipple ·
 *   topo → hatch(pasmaStyle) — flowing contour look.
 * Compositor 3D (need opts.getControls / opts.onFps): studio / fly3d.
 * (Other GPU renderers — bob-gpu / blueprint / 3D crayon / 3D topo — are
 *  created by the compositor's own ensure*() lazy singletons, not here.)
 */
export function createRendererForId(rendererId, canvas, opts = {}) {
  switch (rendererId) {
    case 'silhouette':
      return cpu2dRenderer(canvas, silhouette);
    case 'lines':
      return cpu2dRenderer(canvas, hatch, { pasmaStyle: false });
    case 'crayon':
      return cpu2dRenderer(canvas, bobStipple);
    case 'topo':
      return cpu2dRenderer(canvas, hatch, { pasmaStyle: true });
    case 'studio':
      return createStudioRenderer({
        canvas,
        getControls: opts.getControls || (() => ({})),
        onFps: opts.onFps || (() => {}),
      });
    case 'fly3d':
      return createFly3DRenderer({
        canvas,
        getControls: opts.getControls || (() => ({})),
        onFps: opts.onFps || (() => {}),
      });
    default:
      throw new Error(`[renderer-registry] unknown renderer id: ${rendererId}`);
  }
}
