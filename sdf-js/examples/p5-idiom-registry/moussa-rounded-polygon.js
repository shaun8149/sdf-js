/**
 * Polygon with Rounded Corners (arc fitting)
 *
 * Source: Ahmad Moussa, https://www.gorillasun.de/blog/an-algorithm-for-polygons-with-rounded-corners/
 * Atlas adaptation: 2026-06-20 — recipe-only port, simplified to canvas2d arc API
 *
 * What it does
 * ------------
 * Takes a polygon defined by N vertices + per-vertex radius. For each corner,
 * fits the largest circle of that radius tangent to both adjacent edges. Then
 * traces straight edge → arc → straight edge for each vertex. Result is a
 * polygon where each corner is smoothly rounded instead of pointy.
 *
 * Unlike CSS `border-radius` (only rectangles), this works on ANY polygon and
 * supports per-vertex radius (some corners sharp, others smooth).
 *
 * Atlas use case
 * --------------
 * L5-5B org-chart box aesthetics — current SDF rounded_box atom does
 * rectangle-only rounded corners; this idiom enables LLM to draw any-shape
 * hierarchical container (trapezoid, hexagon, pentagonal callout) with
 * uniform smooth corners.
 *
 * Also useful for:
 *   - Speech-bubble shapes (tail + rounded body)
 *   - Stylized arrow shapes (rounded tip, sharp tail)
 *   - Banner/ribbon shapes
 *
 * Signature
 * ---------
 *   roundedPolyPath(ctx, vertices, radius)
 *
 *   ctx: P5 drawingContext (canvas2d native context — `drawingContext` in P5)
 *   vertices: [[x0,y0], [x1,y1], [x2,y2], ...] in CCW or CW order
 *   radius: number OR array of per-vertex radii. If number, uniform radius.
 *
 * Caller does `ctx.fill()` / `ctx.stroke()` after this builds the path.
 *
 * Inside-an-iframe usage:
 *   // Draw a rounded hexagon
 *   const hex = [];
 *   for (let i = 0; i < 6; i++) {
 *     const a = (i / 6) * TAU - HALF_PI;
 *     hex.push([300 + cos(a) * 60, 180 + sin(a) * 60]);
 *   }
 *   drawingContext.beginPath();
 *   roundedPolyPath(drawingContext, hex, 8);
 *   const fg = window.__brandingPalette.silhouetteColor;
 *   drawingContext.fillStyle = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
 *   drawingContext.fill();
 *
 * Test: scripts/test-p5-idiom-rounded-poly.mjs (pure JS, smoke math correctness)
 */

function roundedPolyPath(ctx, vertices, radius) {
  if (vertices.length < 3) return;
  const radii = Array.isArray(radius) ? radius : new Array(vertices.length).fill(radius);

  function vec(a, b) {
    return [b[0] - a[0], b[1] - a[1]];
  }
  function len(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  }
  function normalize(v) {
    const L = len(v) || 1;
    return [v[0] / L, v[1] / L];
  }
  function cross(a, b) {
    return a[0] * b[1] - a[1] * b[0];
  }
  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
  }

  // Compute first point's arc start so we can begin path there
  const N = vertices.length;
  let startX, startY;

  for (let i = 0; i < N; i++) {
    const p0 = vertices[(i - 1 + N) % N];
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % N];

    const rNominal = radii[i];

    // Vectors from corner p1 outward to p0 (back) and p2 (forward)
    const v1 = normalize(vec(p1, p0));
    const v2 = normalize(vec(p1, p2));

    // Half-angle between vectors. dot = cos(angle).
    const dotV = dot(v1, v2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dotV)));
    const halfAngle = angle / 2;

    // Limit radius to edge length / 2 so the arc never overshoots its edge
    const len1 = len(vec(p0, p1));
    const len2 = len(vec(p1, p2));
    const maxR = Math.min(len1, len2) / 2;
    const safeR = Math.min(rNominal, Math.tan(halfAngle) * maxR);

    // Distance from p1 to tangent point along each edge
    const tanDist = safeR / Math.tan(halfAngle);
    const tStart = [p1[0] + v1[0] * tanDist, p1[1] + v1[1] * tanDist]; // tangent on back edge
    const tEnd = [p1[0] + v2[0] * tanDist, p1[1] + v2[1] * tanDist]; // tangent on forward edge

    // The arcTo() canvas API draws an arc tangent to the two lines from
    // current-point→corner→endpoint, with given radius. Use moveTo for first,
    // lineTo for subsequent.
    if (i === 0) {
      ctx.moveTo(tStart[0], tStart[1]);
      startX = tStart[0];
      startY = tStart[1];
    } else {
      ctx.lineTo(tStart[0], tStart[1]);
    }
    ctx.arcTo(p1[0], p1[1], tEnd[0], tEnd[1], safeR);
  }
  ctx.closePath();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { roundedPolyPath };
}
if (typeof window !== 'undefined') {
  window.roundedPolyPath = roundedPolyPath;
}
