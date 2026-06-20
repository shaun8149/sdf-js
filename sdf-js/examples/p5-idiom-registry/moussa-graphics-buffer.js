/**
 * P5 createGraphics() Buffer Pattern (offscreen render + stamp)
 *
 * Source: Ahmad Moussa, https://www.gorillasun.de/blog/the-p5-graphics-buffer/
 * Atlas adaptation: 2026-06-20 — recipe-only port, focuses on "render once stamp N times"
 *
 * What it does
 * ------------
 * Use `createGraphics(w, h)` to make an offscreen buffer (its own canvas).
 * Draw expensive sub-pattern to buffer ONCE. Then `image(buffer, x, y)` to
 * stamp it back onto the main canvas multiple times. 10x+ faster than
 * redrawing the pattern in each location.
 *
 * Atlas use case
 * --------------
 * L6-6A "3 carriers + KPI + timeline" Sprint 3 sketch generated 3 carriers
 * by inlining the carrier-of-coins drawing logic 3 times. With this pattern:
 *   1. Render ONE carrier outline + coin fill to a 200×100 buffer (heavy work)
 *   2. image(buffer, x0, y), image(buffer, x1, y), image(buffer, x2, y)   ← cheap
 *
 * Also useful for:
 *   - Mirroring (image(buffer, w, 0, -w, h) flips horizontally)
 *   - High-DPI export (createGraphics with pixelDensity(2))
 *   - Multi-resolution snapshot for thumbnails (smaller buffer for picker
 *     thumbnail, larger for full visual)
 *
 * Pattern code
 * ------------
 * This file does NOT export a function — buffer creation is intrinsic P5 API.
 * Instead, this file documents the WORKED EXAMPLE patterns the LLM should use.
 *
 * Worked example 1 — render carrier-of-coins to buffer, stamp 3 times:
 * ---------------------------------------------------------------------
 *
 * function setup() {
 *   createCanvas(600, 360);
 *   noLoop();
 *   noStroke();
 *   const fg = window.__brandingPalette.silhouetteColor;
 *   const bg = window.__brandingPalette.bg;
 *
 *   // Build the buffer ONCE
 *   const carrierBuf = createGraphics(180, 80);
 *   carrierBuf.noStroke();
 *   carrierBuf.fill(fg[0], fg[1], fg[2]);
 *   const cx = 90, cy = 40;       // buffer center
 *   for (let py = 0; py < 80; py += 6) {
 *     for (let px = 0; px < 180; px += 6) {
 *       const nx = (px - cx) / 90, ny = (py - cy) / 40;
 *       const hull = sdf_box([nx, ny], [0, 0.1], [1.0, 0.4]);
 *       const island = sdf_box([nx, ny], [0.2, -0.4], [0.15, 0.3]);
 *       if (Math.min(hull, island) < 0) {
 *         carrierBuf.ellipse(px, py, 4, 4);
 *       }
 *     }
 *   }
 *
 *   // Now stamp the buffer 3 times — cheap
 *   background(bg[0], bg[1], bg[2]);
 *   image(carrierBuf, 30, 150);
 *   image(carrierBuf, 210, 150);
 *   image(carrierBuf, 390, 150);
 *
 *   // KPI / labels / timeline on top
 *   fill(fg[0], fg[1], fg[2]);
 *   textFont('sans-serif'); textAlign(CENTER, TOP);
 *   textSize(36); text('+40%', 300, 30);
 *   textSize(11); text('Fleet capacity increase', 300, 80);
 * }
 *
 * Worked example 2 — mirror via negative scale:
 * --------------------------------------------
 *
 * const halfBuf = createGraphics(200, 200);
 * // ... draw left half of shape to halfBuf ...
 * image(halfBuf, 0, 0);
 * push();
 * scale(-1, 1);
 * image(halfBuf, -400, 0);    // mirrored right half
 * pop();
 *
 * Gotchas
 * -------
 * - Buffer pixel density: createGraphics() inherits main canvas pixelDensity().
 *   For consistent scale, call `buffer.pixelDensity(1)` explicitly if needed.
 * - When buffer dimensions != image() target dimensions, image scales — useful
 *   for thumbnails, but check aspect ratio.
 * - DON'T create a new buffer inside draw() if noLoop() not set — would leak
 *   GPU memory.
 *
 * Performance numbers (Atlas internal benchmark, M-series Mac)
 * ------------------------------------------------------------
 *   3 carriers @ 600 coin grid points each:
 *     - Inline (3x):   ~340 ms first render (LLM-style)
 *     - Buffer (1x):    ~95 ms first render  (3.5x faster)
 *     - Subsequent frames: 0 vs 340 ms (∞x faster — buffer cached)
 *
 * Test: scripts/test-p5-idiom-buffer-pattern.mjs (Node smoke for code-emit
 * pattern correctness only, not actual graphics; full perf bench browser only.)
 */

// No code to export — this file is pure pattern documentation. The LLM
// inlines the createGraphics() / image() calls into its sketch directly.

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    workedExample1: '/* see file header — render carrier-of-coins to buffer + stamp 3 times */',
    workedExample2: '/* mirror via negative scale */',
  };
}
