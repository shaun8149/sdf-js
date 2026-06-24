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
// Each text block sits on a dark, semi-transparent, frosted CHIP so it stays
// legible over ANY background (the light studio stage AND the dark cinema cover)
// — the chip provides its own contrast instead of relying on the scene behind.
//
// Projection reuses studio.project(world) → {x, y, visible} (x,y ∈ [0,1],
// top-left origin), the camera the renderer ACTUALLY drew with last frame — no
// camera-convention duplication outside the renderer.
//
// Scene contract:  scene.overlay = [ ...blocks, ...spokes ]
//   block: { text, anchor:[x,y,z], role?, align? }
//     role  = 'title' | 'head' | 'body' | 'kpi'  (default 'body')
//     align = 'center' (default) | 'left' | 'right'  — horizontal anchoring
//   spoke: { from:[x,y,z], to:[x,y,z], role:'spoke' }  — dotted connector line
//
// Layer-2 only: imports nothing from src/ or examples/; talks to the studio via
// its public project() method.
// =============================================================================

const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
// Dark frosted chip — the "black transparent rectangle" the text rides on.
const CHIP =
  'background:rgba(9,12,20,0.52);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);' +
  'border:1px solid rgba(255,255,255,0.08);border-radius:9px;box-shadow:0 6px 20px rgba(0,0,0,0.28);';

const ROLE_CSS = {
  title: `font:700 28px/1.2 ${FONT};letter-spacing:-0.01em;color:#f4f7fc;padding:10px 22px;`,
  head: `font:700 13px/1.2 ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:#d4deee;padding:7px 14px;`,
  body: `font:400 12.5px/1.5 ${FONT};color:#aeb9cd;max-width:210px;padding:8px 13px;`,
  kpi: `font:800 34px/1 ${FONT};color:#ffffff;padding:8px 18px;`,
};

const SVG_NS = 'http://www.w3.org/2000/svg';

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
  // One SVG behind the chips carries the dotted spoke connectors.
  const svg = document.createElementNS(SVG_NS, 'svg');
  Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  layer.appendChild(svg);
  wrap.appendChild(layer);

  let blocks = []; // { el, anchor }
  let spokes = []; // { line, from, to }
  let raf = 0;

  function clear() {
    for (const b of blocks) b.el.remove();
    for (const s of spokes) s.line.remove();
    blocks = [];
    spokes = [];
  }

  function set(list) {
    clear();
    for (const o of Array.isArray(list) ? list : []) {
      if (!o) continue;
      if (o.role === 'spoke' && Array.isArray(o.from) && Array.isArray(o.to)) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('stroke', 'rgba(64,84,124,0.85)');
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-dasharray', '2 8');
        line.setAttribute('stroke-linecap', 'round');
        line.style.opacity = '0';
        svg.appendChild(line);
        spokes.push({ line, from: o.from, to: o.to });
        continue;
      }
      if (!Array.isArray(o.anchor) || o.anchor.length < 3) continue;
      const el = document.createElement('div');
      el.textContent = o.text || '';
      // anchor maps to the block's reference point; center by default.
      const tx = o.align === 'left' ? '0' : o.align === 'right' ? '-100%' : '-50%';
      const textAlign = o.align || 'center';
      el.style.cssText =
        `position:absolute;transform:translate(${tx},-50%);text-align:${textAlign};white-space:pre-line;` +
        `opacity:0;transition:opacity 0.25s ease;will-change:left,top;${CHIP}` +
        (ROLE_CSS[o.role] || ROLE_CSS.body);
      layer.appendChild(el);
      blocks.push({ el, anchor: o.anchor });
    }
    if (!raf) tick();
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    if (!blocks.length && !spokes.length) return;
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
    for (const s of spokes) {
      const a = studio.project(s.from);
      const b = studio.project(s.to);
      if (!a || !b || !a.visible || !b.visible) {
        s.line.style.opacity = '0';
        continue;
      }
      s.line.setAttribute('x1', (a.x * W).toFixed(1));
      s.line.setAttribute('y1', (a.y * H).toFixed(1));
      s.line.setAttribute('x2', (b.x * W).toFixed(1));
      s.line.setAttribute('y2', (b.y * H).toFixed(1));
      s.line.style.opacity = '1';
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
