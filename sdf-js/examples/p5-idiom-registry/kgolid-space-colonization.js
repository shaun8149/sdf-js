/**
 * Space Colonization (organic branching growth via source attraction + pruning)
 *
 * Source: Kjetil Midtgarden Golid (kgolid),
 *   https://github.com/kgolid/p5ycho/tree/master/colonization — MIT-implicit
 * Atlas adaptation: 2026-06-21 — recipe-only port, STATIC version (run all
 *   iterations in one call) for noLoop() iframe use. Original is animated per-frame.
 *
 * What it does
 * ------------
 * Generate N "source" points (attractors) + K "root" nodes. Each iteration:
 *   1. Each living source finds its nearest node; if too close (< killRange),
 *      source dies; otherwise it registers as that node's attractor
 *   2. Each node with attractors computes mean direction toward them, spawns
 *      a new child node `growth` units away in that direction
 *   3. Repeat until no more growth or maxIterations hit
 *
 * Result: branching tree-like structure that ORGANICALLY navigates toward
 * the source cloud. Different aesthetic from packCirclesInSDF (which packs)
 * — this BRANCHES.
 *
 * Atlas use case
 * --------------
 * Organic tree / dendrite / branch structures where the topology IS the
 * message:
 *   - Process flow trees ("decision branches")
 *   - Dependency graphs (each child = downstream artifact)
 *   - Neural network diagrams (organic, not grid)
 *   - "Reach" / "expansion" visualizations (root → branches → leaves)
 *
 * Pairs with kgolid-chromotome-palettes (color each branch level) and
 * moussa-hooke-brush-stroke (hand-drawn branches instead of straight lines).
 *
 * Signature
 * ---------
 *   spaceColonization(opts) → { edges: Array<{x1,y1,x2,y2}>, nodes: Array<{x,y}> }
 *
 *   opts = {
 *     width: 600, height: 360,            — bounding canvas
 *     sourceCount: 400,                   — N attractors
 *     sourceMode: 'gaussian' | 'uniform', — distribution shape
 *     gaussianSpread: 80,                 — for gaussian mode (std deviation)
 *     rootCount: 3,                       — K starting nodes
 *     rootMode: 'circumference' | 'random', — where to seed roots
 *     rootRadius: 180,                    — for circumference mode
 *     killRange: 12,
 *     growth: 4,                          — child node distance from parent
 *     maxIterations: 200,
 *     seed: 1,
 *   }
 *
 * Inside-iframe usage:
 *   const { edges, nodes } = spaceColonization({
 *     width: 600, height: 360,
 *     sourceCount: 300, gaussianSpread: 100,
 *     rootCount: 3, rootRadius: 150,
 *     killRange: 10, growth: 5, maxIterations: 150,
 *   });
 *   const fg = window.__brandingPalette.silhouetteColor;
 *   stroke(fg[0], fg[1], fg[2]); strokeWeight(1);
 *   for (const e of edges) line(e.x1, e.y1, e.x2, e.y2);
 *
 * Test: scripts/test-p5-idiom-registry.mjs
 */

function _seededRand(seed) {
  let s = seed | 0 || 1;
  return function () {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function _seededGaussian(rand) {
  // Box-Muller transform
  let spare = null;
  return function (mean, sd) {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return mean + sd * v;
    }
    let u, v, s;
    do {
      u = rand() * 2 - 1;
      v = rand() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * m;
    return mean + sd * u * m;
  };
}

function spaceColonization(opts = {}) {
  const width = opts.width ?? 600;
  const height = opts.height ?? 360;
  const sourceCount = opts.sourceCount ?? 400;
  const sourceMode = opts.sourceMode ?? 'gaussian';
  const gaussianSpread = opts.gaussianSpread ?? 80;
  const rootCount = opts.rootCount ?? 3;
  const rootMode = opts.rootMode ?? 'circumference';
  const rootRadius = opts.rootRadius ?? 180;
  const killRange = opts.killRange ?? 12;
  const growth = opts.growth ?? 4;
  const maxIterations = opts.maxIterations ?? 200;
  const seed = opts.seed ?? 1;

  const rand = _seededRand(seed);
  const gauss = _seededGaussian(rand);

  // Generate sources
  const sources = [];
  for (let i = 0; i < sourceCount; i++) {
    let x, y;
    if (sourceMode === 'gaussian') {
      x = gauss(width / 2, gaussianSpread);
      y = gauss(height / 2, gaussianSpread);
    } else {
      x = rand() * width;
      y = rand() * height;
    }
    sources.push({ x, y, alive: true });
  }

  // Generate root nodes
  const nodes = [];
  for (let i = 0; i < rootCount; i++) {
    if (rootMode === 'circumference') {
      const angle = rand() * Math.PI * 2;
      nodes.push({
        x: width / 2 + Math.cos(angle) * rootRadius,
        y: height / 2 + Math.sin(angle) * rootRadius,
        parentIdx: -1,
        attractors: [],
      });
    } else {
      nodes.push({ x: rand() * width, y: rand() * height, parentIdx: -1, attractors: [] });
    }
  }

  // Iterative growth
  for (let iter = 0; iter < maxIterations; iter++) {
    // Reset attractors
    for (const n of nodes) n.attractors = [];

    // Each living source registers with closest node
    let anyAlive = false;
    for (const s of sources) {
      if (!s.alive) continue;
      anyAlive = true;
      // Find closest node
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const dx = nodes[i].x - s.x;
        const dy = nodes[i].y - s.y;
        const d = dx * dx + dy * dy;
        if (d < closestDist) {
          closestDist = d;
          closestIdx = i;
        }
      }
      if (Math.sqrt(closestDist) < killRange) {
        s.alive = false;
      } else {
        nodes[closestIdx].attractors.push(s);
      }
    }

    if (!anyAlive) break;

    // Grow new nodes
    const newNodes = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.attractors.length === 0) continue;
      // Compute mean direction
      let dx = 0,
        dy = 0;
      for (const s of n.attractors) {
        const vx = s.x - n.x;
        const vy = s.y - n.y;
        const len = Math.sqrt(vx * vx + vy * vy) || 1;
        dx += vx / len;
        dy += vy / len;
      }
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= len;
      dy /= len;
      newNodes.push({
        x: n.x + dx * growth,
        y: n.y + dy * growth,
        parentIdx: i,
        attractors: [],
      });
    }
    if (newNodes.length === 0) break;
    nodes.push(...newNodes);
  }

  // Build edges from parent links
  const edges = [];
  for (const n of nodes) {
    if (n.parentIdx >= 0) {
      const p = nodes[n.parentIdx];
      edges.push({ x1: p.x, y1: p.y, x2: n.x, y2: n.y });
    }
  }

  return {
    edges,
    nodes: nodes.map((n) => ({ x: n.x, y: n.y })),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { spaceColonization };
}
if (typeof window !== 'undefined') {
  window.spaceColonization = spaceColonization;
}
