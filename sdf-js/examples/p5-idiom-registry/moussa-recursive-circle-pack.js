/**
 * Recursive Circle Packing (organic growth pattern)
 *
 * Source: Ahmad Moussa, https://www.gorillasun.de/blog/a-recursive-circle-packing-strategy-for-organic-growth-patterns/
 * Concept credited by Moussa: Kevin Workman (2021 Genuary)
 * Atlas adaptation: 2026-06-20 — recipe-only port, simplified for SDF-bounded variant
 *
 * What it does
 * ------------
 * Starting from one or more root nodes, recursively attempts to attach child
 * circles in random direction + distance around parent. If placement collides
 * with existing circles, recurses into one of the children to try from there.
 * Decreasing child radius (factor 0.8-0.95 of parent) creates branching
 * organic structure resembling dendrites / coral / branching tissue.
 *
 * Atlas use case
 * --------------
 * Replaces Sprint 3's uniform-grid coin fill (used in L2-2A carrier-from-coins)
 * with **variable-size organic packing**. Wedge upgrade: gives "carrier of
 * coins" a denser, more visually rich appearance. Constrain packing region
 * to an SDF (e.g., carrier outline via sdf_box union) → coins fill ONLY
 * inside the SDF.
 *
 * Signature
 * ---------
 *   packCirclesInSDF(sdfFn, opts) → Array<{x, y, r}>
 *
 *   sdfFn(x, y) → number   // negative = inside the region to pack
 *   opts = {
 *     bounds: {minX, maxX, minY, maxY},
 *     rootCount: 1-5 (default 1),
 *     maxNodes: 500 (default),
 *     maxAttempts: 5000 (safety bound),
 *     minBranchLen: 8 (default), maxBranchLen: 30 (default),
 *     rootR: 18 (default starting radius),
 *     decay: 0.92 (default — multiply by this each generation),
 *     minR: 2, maxR: 80,
 *     pad: 1 (gap between circles)
 *   }
 *
 * Returns array of {x, y, r} to be drawn in caller's P5 sketch.
 *
 * Inside-an-iframe usage (LLM-generated sketch):
 *   const circles = packCirclesInSDF(
 *     (x, y) => sdf_box([x, y], [0, 0], [1.6, 0.6]),   // carrier outline SDF
 *     {bounds: {minX:-1.6, maxX:1.6, minY:-0.6, maxY:0.6}, maxNodes: 800, rootR: 0.06, decay: 0.93}
 *   );
 *   // Convert SDF-space (~unit cube) to canvas px (600×360)
 *   for (const c of circles) {
 *     const px = (c.x + 1) * 300, py = 180 - c.y * 180;
 *     ellipse(px, py, c.r * 200, c.r * 200);
 *   }
 *
 * Test: scripts/test-p5-idiom-circle-pack.mjs (pure JS, runs in Node)
 */

function packCirclesInSDF(sdfFn, opts = {}) {
  const bounds = opts.bounds || { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const rootCount = opts.rootCount ?? 1;
  const maxNodes = opts.maxNodes ?? 500;
  const maxAttempts = opts.maxAttempts ?? 5000;
  const minBranchLen = opts.minBranchLen ?? 0.04;
  const maxBranchLen = opts.maxBranchLen ?? 0.15;
  const rootR = opts.rootR ?? 0.05;
  const decay = opts.decay ?? 0.92;
  const minR = opts.minR ?? 0.008;
  const maxR = opts.maxR ?? 0.3;
  const pad = opts.pad ?? 0.005;

  const TAU = Math.PI * 2;
  const nodes = []; // {x, y, r, depth, parentIdx}

  function isInsideSDF(x, y) {
    return sdfFn(x, y) < 0;
  }
  function inBounds(x, y, r) {
    return (
      x - r >= bounds.minX && x + r <= bounds.maxX && y - r >= bounds.minY && y + r <= bounds.maxY
    );
  }
  function collides(cx, cy, cr) {
    for (let i = 0; i < nodes.length; i++) {
      const dx = nodes[i].x - cx,
        dy = nodes[i].y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nodes[i].r + cr + pad) return true;
    }
    return false;
  }

  // Seed root nodes inside the SDF region. Reject candidates that aren't inside.
  for (let r = 0, attempts = 0; r < rootCount && attempts < 200; attempts++) {
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    if (!isInsideSDF(x, y) || !inBounds(x, y, rootR)) continue;
    if (collides(x, y, rootR)) continue;
    nodes.push({ x, y, r: rootR, depth: 12, parentIdx: -1 });
    r++;
  }
  if (nodes.length === 0) return [];

  // Iterative growth — keep trying to attach children up to maxAttempts.
  let attempts = 0;
  while (nodes.length < maxNodes && attempts < maxAttempts) {
    attempts++;
    // Pick a random parent (favor older / lower-depth nodes to expand outward)
    const parentIdx = Math.floor(Math.random() * nodes.length);
    const parent = nodes[parentIdx];
    if (parent.depth <= 0) continue;

    // Try to attach a child
    const angle = Math.random() * TAU;
    const dist = minBranchLen + Math.random() * (maxBranchLen - minBranchLen);
    const childR = Math.max(minR, Math.min(maxR, parent.r * (0.8 + Math.random() * 0.15)));
    const cx = parent.x + Math.cos(angle) * (parent.r + dist + childR);
    const cy = parent.y + Math.sin(angle) * (parent.r + dist + childR);

    if (!isInsideSDF(cx, cy)) continue;
    if (!inBounds(cx, cy, childR)) continue;
    if (collides(cx, cy, childR)) continue;

    nodes.push({ x: cx, y: cy, r: childR, depth: parent.depth - 1, parentIdx });
  }

  return nodes.map((n) => ({ x: n.x, y: n.y, r: n.r }));
}

// CommonJS export for Node-side tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { packCirclesInSDF };
}
// Browser global (for iframe sandbox sketches that wanted to call it directly,
// though typical usage is INLINING this into args.code)
if (typeof window !== 'undefined') {
  window.packCirclesInSDF = packCirclesInSDF;
}
