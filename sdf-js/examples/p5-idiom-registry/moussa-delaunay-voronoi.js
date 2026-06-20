/**
 * Delaunay Triangulation (Bowyer-Watson) + Voronoi Diagram via dual
 *
 * Source: Ahmad Moussa,
 *   https://www.gorillasun.de/blog/bowyer-watson-algorithm-for-delaunay-triangulation/
 *   https://www.gorillasun.de/blog/delaunay-triangulation-and-voronoi-diagrams/
 * Atlas adaptation: 2026-06-20 — recipe-only port, both algorithms combined
 *
 * What it does
 * ------------
 * Given N input points, computes:
 *   delaunayTriangles(points) → array of {a, b, c, circumcenter, circumradius}
 *     (Bowyer-Watson incremental insertion; super-triangle bootstrap)
 *   voronoiCells(triangles, points) → array of {site, polygon}
 *     (each input point gets a polygon = its Voronoi cell, constructed by
 *      connecting circumcenters of incident triangles)
 *
 * Atlas use case
 * --------------
 * Organic region partitioning that no fixed grid can match:
 *   - "Market share by region" — 50 city points → 50 organic territories
 *   - "Population density / heat" — Voronoi cells colored by metric
 *   - Comparison/competition layouts where regions aren't rectangular
 *
 * Signatures
 * ----------
 *   delaunayTriangles(points, bounds) → triangles
 *     points: [[x, y], ...]
 *     bounds: {minX, maxX, minY, maxY} — used to build the super-triangle
 *     returns: array of {a, b, c, circumcenter:{x,y}, circumradius}
 *
 *   voronoiCells(triangles, points) → cells
 *     returns: array of {site:[x,y], polygon: [[x,y], ...]}
 *     polygon vertices = circumcenters of triangles touching that site,
 *     ordered CCW. Unbounded cells (on convex hull) get truncated; caller
 *     should clip against the canvas rect for display.
 *
 * Inside-iframe usage:
 *   const sites = [];
 *   for (let i = 0; i < 30; i++) sites.push([random(600), random(360)]);
 *   const tris = delaunayTriangles(sites, {minX:-50, maxX:650, minY:-50, maxY:410});
 *   const cells = voronoiCells(tris, sites);
 *   for (const c of cells) {
 *     fill(...);
 *     beginShape();
 *     for (const v of c.polygon) vertex(v[0], v[1]);
 *     endShape(CLOSE);
 *   }
 *
 * Test: scripts/test-p5-idiom-registry.mjs covers basic correctness.
 */

function _circumcenter(a, b, c) {
  // Solve perpendicular bisectors of AB and AC
  const ax = a[0],
    ay = a[1],
    bx = b[0],
    by = b[1],
    cx = c[0],
    cy = c[1];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return null; // collinear
  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    d;
  const dx = ux - ax,
    dy = uy - ay;
  return { x: ux, y: uy, r: Math.sqrt(dx * dx + dy * dy) };
}

function _inCircumcircle(p, tri) {
  if (!tri.circumcenter) return false;
  const dx = p[0] - tri.circumcenter.x;
  const dy = p[1] - tri.circumcenter.y;
  // Use squared distances + small epsilon to avoid floating-point ties
  return dx * dx + dy * dy < tri.circumradius * tri.circumradius - 1e-9;
}

function _makeTriangle(a, b, c) {
  const cc = _circumcenter(a, b, c);
  return { a, b, c, circumcenter: cc, circumradius: cc ? cc.r : 0 };
}

function _edgeKey(p, q) {
  // Order-independent key for an edge (so opposite directions collapse)
  return p[0] < q[0] || (p[0] === q[0] && p[1] < q[1])
    ? `${p[0]},${p[1]}|${q[0]},${q[1]}`
    : `${q[0]},${q[1]}|${p[0]},${p[1]}`;
}

function delaunayTriangles(points, bounds) {
  const b = bounds || { minX: 0, maxX: 600, minY: 0, maxY: 360 };
  const dx = b.maxX - b.minX,
    dy = b.maxY - b.minY;
  const cx = (b.minX + b.maxX) / 2,
    cy = (b.minY + b.maxY) / 2;
  const m = Math.max(dx, dy) * 20; // super-triangle big enough to contain all
  const sa = [cx - m, cy + m * 0.5];
  const sb = [cx + m, cy + m * 0.5];
  const sc = [cx, cy - m];
  let tris = [_makeTriangle(sa, sb, sc)];

  for (const p of points) {
    // Find triangles whose circumcircle contains p; collect their edges, remove them
    const bad = [];
    const edges = new Map();
    tris = tris.filter((t) => {
      if (_inCircumcircle(p, t)) {
        bad.push(t);
        // Collect edges (a-b, b-c, c-a) with count
        for (const [u, v] of [
          [t.a, t.b],
          [t.b, t.c],
          [t.c, t.a],
        ]) {
          const k = _edgeKey(u, v);
          edges.set(k, (edges.get(k) || 0) + 1);
        }
        return false;
      }
      return true;
    });
    // Boundary edges = edges with count 1 (interior edges have count 2)
    for (const t of bad) {
      for (const [u, v] of [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ]) {
        if (edges.get(_edgeKey(u, v)) === 1) {
          tris.push(_makeTriangle(u, v, p));
        }
      }
    }
  }
  // Remove triangles touching the super-triangle vertices
  const supers = [sa, sb, sc];
  return tris.filter((t) => {
    for (const v of [t.a, t.b, t.c]) {
      for (const s of supers) {
        if (v[0] === s[0] && v[1] === s[1]) return false;
      }
    }
    return true;
  });
}

function voronoiCells(triangles, sites) {
  // For each site, gather circumcenters of triangles where the site is a vertex
  const cells = [];
  for (const site of sites) {
    const incident = triangles.filter(
      (t) =>
        (t.a[0] === site[0] && t.a[1] === site[1]) ||
        (t.b[0] === site[0] && t.b[1] === site[1]) ||
        (t.c[0] === site[0] && t.c[1] === site[1]),
    );
    if (incident.length === 0) {
      cells.push({ site, polygon: [] });
      continue;
    }
    // Sort circumcenters by angle around the site (CCW)
    const centers = incident
      .map((t) => t.circumcenter)
      .filter((c) => c !== null)
      .map((c) => ({ x: c.x, y: c.y, angle: Math.atan2(c.y - site[1], c.x - site[0]) }))
      .sort((a, b) => a.angle - b.angle);
    cells.push({
      site,
      polygon: centers.map((c) => [c.x, c.y]),
    });
  }
  return cells;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { delaunayTriangles, voronoiCells };
}
if (typeof window !== 'undefined') {
  window.delaunayTriangles = delaunayTriangles;
  window.voronoiCells = voronoiCells;
}
