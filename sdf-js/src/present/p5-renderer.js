// =============================================================================
// p5-renderer.js — Atlas Present Sprint 3: P5 sandbox renderer for visual-panel
// -----------------------------------------------------------------------------
// Wraps iframe sandbox (sandbox=allow-scripts only) + postMessage protocol.
// Provides {refresh, destroy, exportPng} API for visual-panel to drive.
//
// Architecture:
//   visual-panel calls mountP5Renderer(wrapper, sceneData, palette)
//   → creates iframe pointing at /src/present/p5-sandbox-iframe.html
//   → on iframe load, postMessage {type:'init', code, palette}
//   → iframe evaluates user P5 sketch, posts 'ready' or 'error' back
//   → IntersectionObserver: when wrapper leaves viewport, destroy iframe
//      (free memory); on re-enter, recreate
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md §6
// =============================================================================

const IFRAME_SRC = '/src/present/p5-sandbox-iframe.html';
const IFRAME_SANDBOX = 'allow-scripts'; // NOT allow-same-origin (security)
const UNMOUNT_DELAY_MS = 2000;

/**
 * Mount a P5 sandbox iframe inside the wrapper element. Returns control handle.
 *
 * @param {HTMLElement} wrapper — DOM element to mount inside
 * @param {object} sceneData — SceneData with subjects[0].type === 'p5-sketch'
 *   args.code is the P5 sketch source string
 * @param {object} palette — { bg: [r,g,b], silhouetteColor: [r,g,b] } from branding
 * @returns {{refresh: Function, destroy: Function, exportPng: Function}}
 */
export function mountP5Renderer(wrapper, sceneData, palette) {
  if (!wrapper || !sceneData) {
    return {
      refresh() {},
      destroy() {},
      exportPng() {
        return null;
      },
    };
  }

  const subject = sceneData.subjects?.[0];
  if (!subject || subject.type !== 'p5-sketch' || typeof subject.args?.code !== 'string') {
    wrapper.innerHTML = '<div class="visual-placeholder error">invalid p5-sketch data</div>';
    return {
      refresh() {},
      destroy() {},
      exportPng() {
        return null;
      },
    };
  }

  const code = subject.args.code;
  const canvasWidth = subject.args.canvasWidth ?? 600;
  const canvasHeight = subject.args.canvasHeight ?? 360;
  const safePalette = palette ?? { bg: [255, 255, 255], silhouetteColor: [40, 40, 40] };

  let iframe = null;
  let messageListener = null;
  let unmountTimer = null;
  let intersectionObserver = null;
  let exportResolvers = [];

  function createIframe() {
    if (iframe) return; // Already mounted
    iframe = document.createElement('iframe');
    iframe.src = IFRAME_SRC;
    iframe.setAttribute('sandbox', IFRAME_SANDBOX);
    iframe.style.width = canvasWidth + 'px';
    iframe.style.height = canvasHeight + 'px';
    iframe.style.border = '1px solid #e5e7eb';
    iframe.style.borderRadius = '8px';
    iframe.style.background = '#fff';
    iframe.style.display = 'block';

    messageListener = (e) => {
      // Only accept messages from our iframe
      if (!iframe || e.source !== iframe.contentWindow) return;
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'loaded') {
        // Send init payload as soon as iframe announces it's ready to receive
        iframe.contentWindow.postMessage(
          {
            type: 'init',
            code: code,
            palette: safePalette,
          },
          '*',
        );
      } else if (e.data.type === 'ready') {
        // Sketch running; nothing to do (visual-panel observes by polling refresh)
      } else if (e.data.type === 'error') {
        showErrorOverlay(e.data.message, e.data.stack);
      } else if (e.data.type === 'exportResult') {
        // Resolve any pending exportPng() promises
        for (const r of exportResolvers) r(e.data.dataUrl);
        exportResolvers = [];
      }
    };
    window.addEventListener('message', messageListener);

    wrapper.innerHTML = '';
    wrapper.appendChild(iframe);
  }

  function destroyIframe() {
    if (!iframe) return;
    if (messageListener) {
      window.removeEventListener('message', messageListener);
      messageListener = null;
    }
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    iframe = null;
    // Resolve any pending export with null (caller can re-trigger after re-mount)
    for (const r of exportResolvers) r(null);
    exportResolvers = [];
  }

  function showErrorOverlay(message, stack) {
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div class="visual-placeholder error">
        <div>⚠ P5 sketch error</div>
        <div style="font-size: 11px; margin-top: 4px;">${escapeHtml(message || 'unknown')}</div>
      </div>
    `;
  }

  function setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // On-screen: cancel any pending unmount + ensure mounted
            if (unmountTimer) {
              clearTimeout(unmountTimer);
              unmountTimer = null;
            }
            if (!iframe) createIframe();
          } else {
            // Off-screen: schedule unmount after UNMOUNT_DELAY_MS
            if (!unmountTimer && iframe) {
              unmountTimer = setTimeout(() => {
                destroyIframe();
                unmountTimer = null;
              }, UNMOUNT_DELAY_MS);
            }
          }
        }
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(wrapper);
  }

  // Initial mount
  createIframe();
  setupIntersectionObserver();

  return {
    refresh() {
      // Re-mount iframe (re-evaluates sketch with current palette). Useful if
      // palette changed via Swap Branding.
      destroyIframe();
      createIframe();
    },
    destroy() {
      if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
      }
      if (unmountTimer) {
        clearTimeout(unmountTimer);
        unmountTimer = null;
      }
      destroyIframe();
    },
    /**
     * Request PNG snapshot of current sketch. Returns Promise<string|null>.
     * Resolves with data URL on success, null on failure (no iframe, no canvas).
     */
    exportPng() {
      return new Promise((resolve) => {
        if (!iframe || !iframe.contentWindow) {
          resolve(null);
          return;
        }
        exportResolvers.push(resolve);
        iframe.contentWindow.postMessage({ type: 'export' }, '*');
        // Timeout safety: if no exportResult comes back in 3s, resolve null
        setTimeout(() => {
          if (exportResolvers.includes(resolve)) {
            exportResolvers = exportResolvers.filter((r) => r !== resolve);
            resolve(null);
          }
        }, 3000);
      });
    },
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
