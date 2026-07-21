// =============================================================================
// _tree-layout.js — shared layout kernel for tree-diagram + org-chart atoms
// -----------------------------------------------------------------------------
// Both atoms render a top-down hierarchical tree. Layout is the same; the
// node + connector styles differ. This module computes layout positions;
// each atom owns its own draw logic for the visual style.
//
// Layout algorithm: Reingold-Tilford-inspired tidy tree.
//   - Leaf x-positions assigned in left-to-right traversal order
//   - Parent x = average of children x
//   - Y = depth * levelHeight
//
// Input: nested object { label, children?: [{ label, ... }] }
// Output: flat array of { node, x, y, depth, parentX, parentY, nodeWidth, levelHeight }
// =============================================================================

/**
 * Compute tree layout positions for a nested tree, including parent x/y refs.
 *
 * @param {object} root — { label: string, children?: array, ...arbitrary node fields }
 * @param {object} opts
 * @param {number} opts.x — left edge of layout area
 * @param {number} opts.y — top edge of layout area
 * @param {number} opts.w — total width
 * @param {number} opts.h — total height
 * @param {number} [opts.minNodeWidth=80] — minimum node width to enforce
 * @param {number} [opts.maxNodeWidth=180] — max node width cap
 *
 * @returns {Array<{node, x, y, depth, parentX, parentY, nodeWidth, levelHeight}>}
 *   — flat list, each entry positioned absolutely. parentX/Y are null for root.
 */
export function computeTreeLayout(root, opts) {
  if (!root || typeof root !== 'object') return [];
  const { x = 0, y = 0, w = 600, h = 400, minNodeWidth = 80, maxNodeWidth = 180 } = opts || {};
  const minLeafGap = 12;

  const flat = [];
  let leafCursor = 0;

  function walk(node, depth, parentEntry) {
    const entry = { node, depth, parent: parentEntry || null, x: 0, y: 0, children: [] };
    flat.push(entry);
    if (parentEntry) parentEntry.children.push(entry);

    const kids = Array.isArray(node.children) ? node.children : [];
    if (kids.length === 0) {
      entry.x = leafCursor++;
    } else {
      for (const k of kids) walk(k, depth + 1, entry);
      entry.x = entry.children.reduce((a, c) => a + c.x, 0) / entry.children.length;
    }
  }

  walk(root, 0, null);
  if (flat.length === 0) return [];

  const minX = Math.min(...flat.map((e) => e.x));
  const maxX = Math.max(...flat.map((e) => e.x));
  const xRange = maxX - minX || 1;
  const nLeaves = leafCursor || 1;
  const availPerLeaf = w / nLeaves;
  const nodeW = Math.max(minNodeWidth, Math.min(maxNodeWidth, availPerLeaf - minLeafGap));
  const maxDepth = Math.max(...flat.map((e) => e.depth));
  const levelHeight = maxDepth > 0 ? h / (maxDepth + 1) : h;

  // Compute abs positions
  for (const e of flat) {
    const normX = (e.x - minX) / xRange;
    e.absX = x + nodeW / 2 + normX * (w - nodeW);
    e.absY = y + e.depth * levelHeight + levelHeight / 2;
  }

  return flat.map((e) => ({
    node: e.node,
    depth: e.depth,
    x: e.absX,
    y: e.absY,
    parentX: e.parent ? e.parent.absX : null,
    parentY: e.parent ? e.parent.absY : null,
    nodeWidth: nodeW,
    levelHeight,
  }));
}
