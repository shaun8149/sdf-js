// =============================================================================
// relationship-graph-3d.js — node-link relationship graph (Atlas chart atom).
// -----------------------------------------------------------------------------
// N sphere nodes on a ring + capsule edges (ring connectivity + a couple of
// chords by default, or a caller-supplied adjacency list). Covers
// PresentationLoad "Relationship Charts". Composite atom (sphere + capsule +
// union) — same family as sphere-network-3d, but peer nodes rather than a hub.
// =============================================================================

import { sphere, capsule } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

function defaultEdges(n) {
  const e = [];
  for (let i = 0; i < n; i++) e.push([i, (i + 1) % n]); // ring
  if (n >= 4) e.push([0, 2]); // a non-diameter chord → reads as a graph, not a polygon
  if (n >= 6) e.push([3, 5]);
  return e;
}

/**
 * @param {object} opts
 * @param {number} [opts.count=6]          number of nodes
 * @param {number} [opts.radius=1.3]       ring layout radius
 * @param {number} [opts.nodeRadius=0.26]  node sphere radius
 * @param {number} [opts.linkThickness=0.05] edge capsule radius
 * @param {number[][]} [opts.edges=null]   adjacency [[i,j],…] (default ring+chords)
 * @returns {SDF3}
 */
export function relationshipGraph3dSDF({
  count = 6,
  radius = 1.3,
  nodeRadius = 0.26,
  linkThickness = 0.05,
  edges = null,
} = {}) {
  const N = Math.max(2, Math.floor(count));
  const pos = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pos.push([radius * Math.cos(a), 0, radius * Math.sin(a)]);
  }
  const E = edges || defaultEdges(N);
  const parts = [];
  for (const [i, j] of E) {
    if (pos[i] && pos[j]) parts.push(capsule(pos[i], pos[j], linkThickness));
  }
  for (let i = 0; i < N; i++) parts.push(sphere(nodeRadius).translate(pos[i]));
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const relationshipGraph3dSpec = {
  type: 'relationship-graph-3d',
  category: 'charts/relationship',
  args: {
    count: { type: 'number', default: 6, doc: 'Number of nodes' },
    radius: { type: 'number', default: 1.3, doc: 'Ring layout radius' },
    nodeRadius: { type: 'number', default: 0.26, doc: 'Node sphere radius' },
    linkThickness: { type: 'number', default: 0.05, doc: 'Edge capsule radius' },
    edges: { type: 'array', default: null, doc: 'Adjacency [[i,j],…] (default ring+chords)' },
  },
  examples: [
    { name: 'Relationship ring', args: { count: 6 } },
    {
      name: 'Star edges',
      args: {
        count: 5,
        edges: [
          [0, 1],
          [0, 2],
          [0, 3],
          [0, 4],
        ],
      },
    },
    { name: 'Dense web', args: { count: 8 } },
  ],
  description: 'Node-link relationship graph (peer nodes + edges) — networks, associations',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 4 node-edge charts — taxonomy charts/relationship/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
