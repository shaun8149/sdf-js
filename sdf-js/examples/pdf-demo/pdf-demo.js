// =============================================================================
// pdf-demo.js — Step 2a: 20-slide grid, each panel rendered as 2D SDF
// -----------------------------------------------------------------------------
// Loads the pre-baked SlideData JSON, runs the deterministic emitter
// (src/mapping/slide-to-2d-code.js) per slide, then executes the emitted JS
// in a per-panel Blob URL. The emitted code's render.silhouette(...) call
// draws into THIS panel's canvas (we string-replace the 'c' canvas id with
// a per-panel unique id before blob-importing).
//
// This is Step 2a of the M1.5 lift-integration plan (spicy-sniffing-sketch.md).
// No LLM in this view — that's Step 2b (Lift to 3D button + 8 swappable
// renderers, opens as detail view per panel).
//
// Architecture: the SAME code2d that drives this 2D preview will feed
// callLiftLLM in Step 2b. The grid is the visible audit trail of what the
// lift LLM will see.
// =============================================================================

import { emitSlide2dCode } from '../../src/mapping/slide-to-2d-code.js';

const GRID = document.getElementById('grid');
const W = 256;
const H = 144; // 16:9

// ---- Code rewriter (cribbed from examples/mvp/text-to-sdf.js) --------------
//
// The emitted code uses relative imports like '../../src/index.js' and a hard-
// coded canvas id 'c'. Blob URLs have no base, so we resolve imports to
// absolute URLs against this page's location, and swap the canvas id per
// panel so each blob renders into its own slot.

function rewriteImports(code, baseUrl) {
  // Matches both `from '../...'` and `import('../...')`. Identical to MVP's
  // regex — proven pattern, don't reinvent.
  return code.replace(/(\bfrom\s+|^import\s*\(?\s*)['"](\.[^'"]*)['"]/gm, (m, prefix, rel) => {
    const abs = new URL(rel, baseUrl).href;
    return `${prefix}'${abs}'`;
  });
}

function rewriteCanvasId(code, panelId) {
  return code.replace(
    /document\.getElementById\(['"]c['"]\)/g,
    `document.getElementById('${panelId}')`,
  );
}

// ---- Per-slide renderer -----------------------------------------------------

async function renderSlide(slide, idx) {
  const { code2d, prompt, pattern, confidence } = emitSlide2dCode(slide);

  // Build the DOM first so the canvas exists when the blob executes
  const panel = document.createElement('div');
  panel.className = 'panel';
  const panelId = `panel-${idx}-canvas`;
  const titleEsc = (slide.title || '(untitled)').replace(/</g, '&lt;');
  panel.innerHTML = `
    <h2>Slide ${idx}: ${titleEsc}</h2>
    <span class="pattern-tag tag-${pattern}">${pattern} ${(confidence * 100).toFixed(0)}%</span>
    <canvas id="${panelId}" width="${W}" height="${H}"></canvas>
    <div class="prompt-line">${prompt.replace(/</g, '&lt;')}</div>
  `;
  GRID.appendChild(panel);

  // Yield so the canvas is laid out before we draw to it
  await new Promise((r) => requestAnimationFrame(r));

  const baseUrl = new URL('./', window.location.href).href;
  let code = code2d;
  code = rewriteImports(code, baseUrl);
  code = rewriteCanvasId(code, panelId);

  const blob = new Blob([code], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    await import(/* @vite-ignore */ url);
  } catch (e) {
    console.error(`[pdf-demo] slide ${idx} failed:`, e);
    const ctx = document.getElementById(panelId).getContext('2d');
    ctx.fillStyle = '#fee';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#a00';
    ctx.font = '10px monospace';
    ctx.fillText(`render error: ${e.message.slice(0, 28)}`, 6, 18);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- Main -------------------------------------------------------------------

const slides = await fetch('./slidedata.json').then((r) => r.json());
console.log(`[pdf-demo] loaded ${slides.length} slides`);

// Render sequentially — text2dSDF is heavy per call (many segments + arcs),
// and 20 simultaneous render passes can swamp the main thread. Sequential
// with a RAF yield between each keeps the page interactive.
for (let i = 0; i < slides.length; i++) {
  await renderSlide(slides[i], i);
}
console.log('[pdf-demo] all slides rendered');
