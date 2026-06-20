// =============================================================================
// p5-renderer.js — Atlas Present Sprint 3: P5 sandbox renderer for visual-panel
// -----------------------------------------------------------------------------
// Wraps iframe sandbox (sandbox=allow-scripts only) + postMessage protocol.
// Provides {refresh, destroy, exportPng} API for visual-panel to drive.
//
// Architecture:
//   visual-panel calls mountP5Renderer(wrapper, sceneData, palette)
//   →  creates iframe pointing at /src/present/p5-sandbox-iframe.html
//   →  on iframe load, postMessage {type:'init', code, palette}
//   →  iframe evaluates user P5 sketch, posts 'ready' or 'error' back
//   →  IntersectionObserver: when wrapper leaves viewport, destroy iframe
//      (free memory); on re-enter, recreate
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md §6
// =============================================================================

const IFRAME_SRC = '/src/present/p5-sandbox-iframe.html';
const IFRAME_SANDBOX = 'allow-scripts'; // NOT allow-same-origin (security: prevents reading main page localStorage)
const UNMOUNT_DELAY_MS = 2000; // off-screen > 2s → unmount; on-screen → mount

/**
 * Mount a P5 sandbox iframe inside the wrapper element. Returns control handle.
 *
 * @param {HTMLElement} wrapper — DOM element to mount inside
 * @param {object} sceneData — SceneData with subjects[0].type === 'p5-sketch'
 * @param {object} palette — { bg: [r,g,b], silhouetteColor: [r,g,b] } from branding
 * @returns {{refresh: Function, destroy: Function, exportPng: Function}}
 */
export function mountP5Renderer(wrapper, sceneData, palette) {
  // Implementation in Task 2.2-2.4
  return {
    refresh() {},
    destroy() {},
    exportPng() {
      return null;
    },
  };
}
