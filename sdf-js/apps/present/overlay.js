// =============================================================================
// overlay.js — Layer-2 screen-text overlay (Atlas Present).
// -----------------------------------------------------------------------------
// Implements the locked text policy (see deck-player.js): narrative / title /
// descriptive text → DOM overlay; only data labels bound to geometry → in-scene
// SDF. This is the overlay half: flat DOM text blocks that DON'T live in the SDF
// tree but ARE anchored to 3D world points and PROJECTED to the screen each
// frame, so a label tracks its object as the authored camera flies between
// stations.
//
// Projection reuses studio.project(world) → {x, y, visible} (x,y ∈ [0,1],
// top-left origin), the camera the renderer ACTUALLY drew with last frame — no
// camera-convention duplication outside the renderer.
//
// Scene contract:  scene.overlay = [{ text, anchor:[x,y,z], role?, align? }]
//   role  = 'title' | 'head' | 'body' | 'kpi'  (default 'body')
//   align = 'center' (default) | 'left' | 'right'  — horizontal anchoring
//
// Layer-2 only: imports nothing from src/ or examples/; talks to the studio via
// its public project() method.
// =============================================================================

const ROLE_CSS = {
  // dark-on-light by default (the chart archetypes render on the light studio
  // stage); a soft light halo keeps text legible over busier areas too.
  title:
    'font:700 30px/1.15 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-0.01em;color:#0e1726;',
  head: 'font:700 14px/1.2 -apple-system,sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:#1b2433;',
  body: 'font:400 13px/1.45 -apple-system,sans-serif;color:#3a4656;max-width:210px;',
  kpi: 'font:800 36px/1 -apple-system,sans-serif;color:#f4f8ff;text-shadow:0 2px 10px rgba(0,0,0,0.45);',
};

/**
 * Create a screen-text overlay layer over the studio canvas.
 * @param {HTMLElement} wrap   the canvas wrapper (positioned container)
 * @param {{project:(w:number[])=>{x:number,y:number,visible:boolean}}} studio
 * @returns {{ set:(list:object[])=>void, clear:()=>void, destroy:()=>void }}
 */
export function makeOverlay(wrap, studio) {
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  const layer = document.createElement('div');
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: '30',
  });
  wrap.appendChild(layer);

  let blocks = []; // { el, anchor }
  let raf = 0;

  function clear() {
    for (const b of blocks) b.el.remove();
    blocks = [];
  }

  function set(list) {
    clear();
    for (const o of Array.isArray(list) ? list : []) {
      if (!o || !Array.isArray(o.anchor) || o.anchor.length < 3) continue;
      const el = document.createElement('div');
      el.textContent = o.text || '';
      const halo =
        o.role === 'kpi'
          ? ''
          : 'text-shadow:0 1px 2px rgba(255,255,255,0.55),0 1px 6px rgba(255,255,255,0.35);';
      // anchor maps to the block's reference point; center by default.
      const tx = o.align === 'left' ? '0' : o.align === 'right' ? '-100%' : '-50%';
      const textAlign = o.align || 'center';
      el.style.cssText =
        `position:absolute;transform:translate(${tx},-50%);text-align:${textAlign};white-space:pre-line;` +
        `opacity:0;transition:opacity 0.25s ease;will-change:left,top;${halo}` +
        (ROLE_CSS[o.role] || ROLE_CSS.body);
      layer.appendChild(el);
      blocks.push({ el, anchor: o.anchor });
    }
    if (!raf) tick();
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    if (!blocks.length) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    for (const b of blocks) {
      const p = studio.project(b.anchor);
      if (!p || !p.visible) {
        b.el.style.opacity = '0';
        continue;
      }
      b.el.style.left = (p.x * W).toFixed(1) + 'px';
      b.el.style.top = (p.y * H).toFixed(1) + 'px';
      b.el.style.opacity = '1';
    }
  }

  return {
    set,
    clear,
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      layer.remove();
    },
  };
}
