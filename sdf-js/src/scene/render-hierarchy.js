// sdf-js/src/scene/render-hierarchy.js
// Structure renderer #2: hierarchy → CONE TREE. Reads the IR ONLY (never 2D x/y).
//
// Why a cone tree is the native 3D form for hierarchy (the "3D earns its
// existence" move): a 2D org chart crams every level onto one line — wide
// levels collide, deep trees squash. In 3D each node is the apex of a cone and
// its children fan out on a CIRCLE beneath it; sibling crowds spread around
// the azimuth instead of fighting for x-axis room, and depth reads as literal
// depth. (Robertson/Mackinlay/Card's classic Cone Tree, recast in Atlas atoms.)
//
// Fighting-game grammar (the house style), hierarchy variation:
//   1. hero low-angle at the ROOT (the boss intro)
//   2. crane over the crown
//   3. orbit descent LEVEL BY LEVEL (each level = one camera beat; nodes of
//      that level cascade in as the camera arrives — arena assembles per floor)
//   4. the SUPER: hard cut punch-in on the emphasis node + shake + exposure pop
//   5. payoff pull-back — the whole tree in one frame
//
// Build-in staging differs from the funnel on purpose: the funnel assembles its
// WHOLE form during the intro (a monument), while the tree grows floor by floor
// with the tour — hierarchy IS the narration, so geometry and narration land
// together, level by level.
import { validateIR } from './ir.js';
import { calloutOverlay } from './insights.js';
import { getEnvironment } from './environments.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

/**
 * Cone-tree layout from IR relations. Returns per-node {pos, level, parent}.
 * Root at the top; each node's children distributed on a circle beneath it,
 * child cone radius shrinking with depth. Deterministic (no randomness).
 */
export function coneTreeLayout(ir, opts = {}) {
  const N = ir.nodes.length;
  const levelHeight = opts.levelHeight ?? 1.15;
  const rootRadius = opts.rootRadius ?? 1.9;
  const parent = new Array(N).fill(-1);
  const children = Array.from({ length: N }, () => []);
  for (const [p, c] of ir.relations) {
    parent[c] = p;
    children[p].push(c);
  }
  const root = parent.indexOf(-1);

  const level = new Array(N).fill(0);
  const pos = new Array(N);
  const maxLevel = { v: 0 };

  // Recursive placement: node at (x, z), children on a circle of radius r
  // beneath it. Each child's own cone shrinks; the child circle is rotated by
  // the parent's azimuth so sub-trees interleave instead of stacking.
  const place = (i, x, z, lvl, r, baseAngle) => {
    level[i] = lvl;
    maxLevel.v = Math.max(maxLevel.v, lvl);
    pos[i] = [x, 0, z]; // y assigned after depth known
    const kids = children[i];
    if (!kids.length) return;
    const step = (2 * Math.PI) / kids.length;
    // The child circle must FIT its children: a big sibling crowd on a small
    // circle collapses into a blob (caught on p23's 战术级 fan of 6 — balls
    // nearly touching, labels stacked). Grow the circle so adjacent children
    // keep at least ~minSpacing of arc between centres.
    const minSpacing = opts.minSpacing ?? 1.15;
    const rEff = Math.max(r, (kids.length * minSpacing) / (2 * Math.PI));
    kids.forEach((c, k) => {
      const a = baseAngle + step * k + (kids.length > 1 ? 0 : Math.PI / 5);
      place(
        c,
        x + Math.cos(a) * rEff,
        z + Math.sin(a) * rEff,
        lvl + 1,
        rEff * 0.45,
        a + Math.PI / 3,
      );
    });
  };
  place(root, 0, 0, 0, rootRadius, -Math.PI / 2);

  const topY = 1.4 + maxLevel.v * levelHeight * 0.5 + 0.6;
  for (let i = 0; i < N; i++) pos[i][1] = topY - level[i] * levelHeight;

  return { pos, level, parent, root, maxLevel: maxLevel.v, topY, levelHeight };
}

// Cool cyan→indigo by depth (matches the funnel family), emphasis in warm gold.
const nodeMat = (lvl, maxLvl, emphasized) => {
  if (emphasized)
    return {
      hue: 0.11,
      sat: 0.78,
      value: 0.95,
      metal: 0,
      glow: 0.04, // R3: root glow + bloom blew into a featureless sun
      kind: 'normal',
      roughness: 0.22,
      clearcoat: 0.6,
    };
  const k = maxLvl > 0 ? lvl / maxLvl : 0;
  return {
    hue: 0.55 + 0.09 * k,
    sat: 0.62 + 0.16 * k,
    value: 0.85 - 0.28 * k,
    kind: 'normal',
    roughness: 0.3,
    clearcoat: 0.45,
  };
};

export function renderHierarchy(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderHierarchy: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'hierarchy')
    throw new Error(`renderHierarchy: expected structure 'hierarchy', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);

  const nodes = ir.nodes.map(label);
  const N = nodes.length;
  const mag = ir.magnitude || nodes.map(() => 1);
  const mMax = Math.max(...mag.map((x) => Number(x) || 0), 1);
  const emphasis = new Set(ir.emphasis || []);
  const layout = coneTreeLayout(ir);
  const { pos, level, parent, root, maxLevel, topY, levelHeight } = layout;

  // Node size: magnitude-scaled sphere (root reads as the crown by position,
  // not just size). Edges: capsules parent→child, owned by the CHILD subject so
  // node + its up-link build in as one piece.
  const nodeR = (i) => 0.28 + 0.26 * Math.sqrt((Number(mag[i]) || 1) / mMax);

  // Per-level reveal: level l lands as the camera's level-l beat begins.
  const introLead = 2.1; // hero 0.9 + crane 1.2
  const holdEach = 1.5; // seconds per level beat
  const levelRevealStart = (l) => introLead + l * holdEach - 0.55; // land slightly before the beat
  const drop = 1.0;

  const subjects = [];
  for (let i = 0; i < N; i++) {
    const p = pos[i];
    const t0 = Math.max(0.2, levelRevealStart(level[i]));
    const t1 = t0 + 0.55;
    const children = [
      {
        id: `node-ball-${i}`,
        type: 'sphere',
        args: { radius: nodeR(i) },
        transform: { translate: [0, 0, 0] },
      },
    ];
    if (parent[i] >= 0) {
      // Up-link capsule in the CHILD's local frame (subject origin = node pos):
      // from the node to its parent's position.
      const pp = pos[parent[i]];
      children.push({
        id: `node-link-${i}`,
        type: 'capsule',
        args: { a: [0, 0, 0], b: [pp[0] - p[0], pp[1] - p[1], pp[2] - p[2]], radius: 0.045 },
        transform: { translate: [0, 0, 0] },
      });
    }
    subjects.push({
      id: `node-${i}`,
      type: 'union',
      children,
      transform: { translate: p },
      material: nodeMat(level[i], maxLevel, emphasis.has(i)),
      // STATIC (user-locked 2026-07-15): only the CAMERA animates.
    });
  }

  // ---- camera: five beats, hierarchy variation -------------------------------
  const treeSpan = 1.9 * 2.4; // rough crown diameter for framing
  const midY = topY - (maxLevel * levelHeight) / 2;
  const emphasisIdx = ir.emphasis && ir.emphasis.length ? ir.emphasis[0] : root;
  const gp = pos[emphasisIdx];
  const shots = [
    // 1 — hero low angle at the root (boss intro)
    {
      duration: 0.9,
      pos: [2.1, Math.max(topY - 2.2, 0.5), 4.8],
      target: [0, topY, 0],
      fov: 52,
      aperture: 0.55, // hero: shallow focus on the subject
      focalDistance: 5,
      ease: 'out',
    },
    // 2 — crane over the crown
    {
      duration: 1.2,
      pos: [0.8, topY + 2.4, 3.8],
      target: [0, topY - 0.4, 0],
      fov: 48,
      transition: 'blend',
      aperture: 0.3,
      focalDistance: 4.4,
      ease: 'inout',
    },
  ];
  // 3 — orbit descent, one beat per level
  for (let l = 0; l <= maxLevel; l++) {
    const y = topY - l * levelHeight;
    const theta = 1.1 * (l + 1);
    const dist = 3.2 + l * 1.1; // lower levels are wider — back off as we descend
    shots.push({
      duration: holdEach,
      pos: [Math.sin(theta) * dist, y + 0.9, Math.cos(theta) * dist],
      target: [0, y, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.25,
      focalDistance: dist,
      shake: 0.05,
      ease: 'smooth',
    });
  }
  // 4 — the super: punch-in on the emphasis node. R5: the old 1.6-unit punch
  // landed INSIDE the crown — the root smeared across the frame top and the
  // camera stared at empty floor. Back off with the node's own radius so the
  // subject (sphere + its card below) composes as a subject.
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0); // presentation time of the impact
  const superDist = 2.6 + nodeR(emphasisIdx) * 2.2;
  shots.push({
    duration: 1.0,
    pos: [gp[0] + 0.7, Math.max(gp[1] - 0.35, 0.14), gp[2] + superDist],
    target: [gp[0], gp[1] - 0.1, gp[2]],
    fov: 42,
    transition: 'cut',
    beat: 'super',
    aperture: [0.9, 0.45], // rack focus: the world falls away, the subject stays
    focalDistance: superDist,
    shake: [0.5, 0.06], // impact-then-settle
    ambient: [0.15, 1.0], // spotlight crash: surroundings collapse on the hit, then recover
    exposure: [1.2, 1.0],
    ease: 'out',
  });
  // 5 — payoff pull-back: the whole tree
  const payoffDist =
    (treeSpan + maxLevel * 1.6 + 4.5) /* R3: 3.4 cropped the leaf tier */ *
    (env ? env.payoffZoom : 1);
  shots.push({
    duration: 2.4,
    pos: [1.6, midY + 1.4 + (env ? 0.5 : 0), payoffDist],
    target: [0, midY, 0],
    fov: 44,
    transition: 'blend',
    aperture: 0.12, // deep focus: the whole story stays sharp
    focalDistance: payoffDist,
    ease: 'out',
  });

  // labels: node name cards revealed with their level's beat
  const overlay = [
    {
      text: String(ir.title || nodes[root]).toUpperCase(),
      anchor: [0, topY + 1.3, 0],
      role: 'title',
    },
  ];
  for (let i = 0; i < N; i++) {
    const p = pos[i];
    overlay.push({
      text: nodes[i],
      // R3: BELOW the node, never beside it — the side anchor projected the
      // card straight onto the sphere's specular highlight
      anchor: [p[0], p[1] - nodeR(i) - 0.28, p[2]],
      role: 'card',
      revealAt: introLead + level[i] * holdEach + 0.35,
    });
  }
  const co = calloutOverlay(ir, superAt);
  if (co) overlay.push(co);

  return {
    v: 1,
    name: `(hierarchy) ${ir.title || nodes[root]}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env ? env.defaults : { stage: { size: [16, 12, 12] } },
  };
}
