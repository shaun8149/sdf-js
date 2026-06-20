/**
 * Hooke's Law Spring-Physics Brush Stroke (hand-drawn line aesthetic)
 *
 * Source: Ahmad Moussa,
 *   https://www.gorillasun.de/blog/simulating-brush-strokes-with-hookes-law-in-p5js-and-processing/
 *   (Moussa credits BUN's Processing tutorial as upstream)
 * Atlas adaptation: 2026-06-20 — recipe-only port, STATIC version for noLoop()
 *
 * What it does
 * ------------
 * Original Moussa pattern is animated: brush trails the cursor via a virtual
 * spring (Hooke's Law F = k·displacement) with friction damping. Slow cursor →
 * heavy line, fast cursor → tapered line. The lag + overshoot mimics real
 * brush physics → "hand-painted" calligraphy aesthetic.
 *
 * Atlas Present sketches use noLoop() (static frame). So this port applies
 * the spring chain to a STATIC input polyline:
 *   Input:  list of waypoints [[x, y], ...] (what straight lines you'd want)
 *   Output: list of (x, y, thickness) — wobbly hand-drawn version
 *
 * The "cursor" walks the input path at fixed step size; the "brush" follows
 * via spring; record brush position + speed at each step → output polyline
 * with thickness modulation. Result: input rigid path → output wobbly path
 * with thickness inversely related to local speed (slow corners = thick,
 * fast straights = thin).
 *
 * Atlas use case
 * --------------
 * Connector lines / arrows / annotations that look hand-drawn instead of
 * vector-perfect. Particularly nice for:
 *   - Org chart connecting lines (L5-5B better aesthetic)
 *   - Process flow arrows
 *   - Annotation arrows pointing at KPI cards
 *   - Underlines beneath labels (sketch-note look)
 *
 * Pair with Atlas crayon renderer aesthetic — both fight "AI sterile vector"
 * appearance.
 *
 * Signature
 * ---------
 *   springBrushStroke(waypoints, opts) → Array<{x, y, thickness}>
 *
 *   waypoints: [[x, y], ...] (≥ 2 points)
 *   opts = {
 *     springK: 0.4 (spring constant, higher = brush snaps closer to cursor),
 *     friction: 0.55 (velocity damping, lower = more wobble),
 *     stepSize: 2 (how far cursor walks per iteration along input path),
 *     brushSize: 8 (max thickness, modulated down by speed),
 *     speedToThicknessFactor: 0.8 (subtract speed × this from brushSize),
 *     minThickness: 1
 *   }
 *
 * Inside-iframe usage:
 *   const arrowPath = [[100, 100], [300, 200], [500, 100]];
 *   const stroke = springBrushStroke(arrowPath, {brushSize: 6, springK: 0.35});
 *   const fg = window.__brandingPalette.silhouetteColor;
 *   noFill();
 *   for (let i = 1; i < stroke.length; i++) {
 *     stroke(fg[0], fg[1], fg[2]);
 *     strokeWeight(stroke[i].thickness);
 *     line(stroke[i-1].x, stroke[i-1].y, stroke[i].x, stroke[i].y);
 *   }
 *
 * Test: scripts/test-p5-idiom-registry.mjs covers spring convergence + output shape.
 */

function springBrushStroke(waypoints, opts = {}) {
  if (waypoints.length < 2)
    return waypoints.map(([x, y]) => ({ x, y, thickness: opts.brushSize ?? 8 }));

  const springK = opts.springK ?? 0.4;
  const friction = opts.friction ?? 0.55;
  const stepSize = opts.stepSize ?? 2;
  const brushSize = opts.brushSize ?? 8;
  const speedToThicknessFactor = opts.speedToThicknessFactor ?? 0.8;
  const minThickness = opts.minThickness ?? 1;

  // Pre-compute total path length + cumulative arc lengths per segment
  const segments = [];
  let totalLen = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const [x0, y0] = waypoints[i - 1];
    const [x1, y1] = waypoints[i];
    const dx = x1 - x0,
      dy = y1 - y0;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    segments.push({ x0, y0, x1, y1, dx, dy, segLen, t0: totalLen });
    totalLen += segLen;
  }
  if (totalLen === 0) return [{ x: waypoints[0][0], y: waypoints[0][1], thickness: brushSize }];

  // Walk cursor along path at fixed stepSize; brush follows via spring
  let brushX = waypoints[0][0];
  let brushY = waypoints[0][1];
  let vx = 0,
    vy = 0;
  const out = [];

  for (let dist = 0; dist <= totalLen; dist += stepSize) {
    // Find cursor position at this arc length
    let seg = segments[0];
    for (let i = 0; i < segments.length; i++) {
      if (dist >= segments[i].t0 && dist <= segments[i].t0 + segments[i].segLen) {
        seg = segments[i];
        break;
      }
    }
    if (!seg) seg = segments[segments.length - 1];
    const localT = seg.segLen > 0 ? (dist - seg.t0) / seg.segLen : 0;
    const cx = seg.x0 + seg.dx * localT;
    const cy = seg.y0 + seg.dy * localT;

    // Spring force (Hooke: F = k * displacement)
    vx += (cx - brushX) * springK;
    vy += (cy - brushY) * springK;
    vx *= friction;
    vy *= friction;
    brushX += vx;
    brushY += vy;

    // Thickness modulated by current brush speed
    const speed = Math.sqrt(vx * vx + vy * vy);
    const thickness = Math.max(minThickness, brushSize - speed * speedToThicknessFactor);
    out.push({ x: brushX, y: brushY, thickness });
  }
  // Snap final brush position to last waypoint for clean endpoint
  const last = waypoints[waypoints.length - 1];
  if (out.length > 0) {
    out[out.length - 1].x = last[0];
    out[out.length - 1].y = last[1];
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { springBrushStroke };
}
if (typeof window !== 'undefined') {
  window.springBrushStroke = springBrushStroke;
}
