// sdf-js/src/scene/render-network.js
// Structure renderer #3: network → CONSTELLATION. Reads the IR ONLY (never 2D x/y).
//
// Why a constellation is the native 3D form for a graph: 2D force layouts fight
// edge crossings — in a dense graph the hairball is unreadable. In 3D the graph
// gets a whole extra axis to untangle in; hubs sit deep in the cloud, leaves at
// the shell, and an ORBITING camera turns parallax into structure (nodes that
// are far apart in the graph visibly separate as the view swings).
//
// Layout is deterministic (no randomness, resume-safe): nodes start on a golden-
// angle sphere (radius shrinks with degree — hubs pulled toward the center),
// then a fixed number of spring-relaxation iterations (attract along edges,
// repel all pairs). Same IR → same constellation, always.
//
// Fighting-game grammar, network variation:
//   1. hero — inside the cloud, looking through it at the hub (in the arena)
//   2. crane — pull up and out: the whole constellation revealed
//   3. orbit tour — the camera circles while the network WIRES ITSELF:
//      nodes cascade in first, then edges land in waves (assembly = spectacle)
//   4. the SUPER — hard cut punch-in on the hub + shake + exposure pop
//   5. payoff pull-back — the settled constellation in one frame
import { validateIR } from './ir.js';
import { calloutOverlay } from './insights.js';
import { getEnvironment } from './environments.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

/**
 * Deterministic 3D constellation layout. Returns { pos, degree, hub }.
 *
 * ir.form === 'cycle' → THE FLYWHEEL: the hub sits at the centre and every
 * other node rides an even RING around it, upright in the picture plane. A
 * flywheel page (engine drives 创作→分发→互动, source p22) is a CYCLE, and
 * the generic golden-angle + spring layout scatters that ring into a random
 * 3D cloud — the structure the page exists to show is destroyed. Reusable:
 * any deck emitting form:'cycle' gets the ring.
 */
export function constellationLayout(ir, opts = {}) {
  const N = ir.nodes.length;
  const radius = opts.radius ?? 2.0;
  const iterations = opts.iterations ?? 60;

  const degree = new Array(N).fill(0);
  for (const [a, b] of ir.relations) {
    degree[a]++;
    degree[b]++;
  }
  const maxDeg = Math.max(...degree, 1);
  let hub = 0;
  for (let i = 1; i < N; i++) if (degree[i] > degree[hub]) hub = i;

  if (ir.form === 'cycle') {
    // hub centred; the rest evenly around a ring in the XY plane (facing the
    // camera), first ring node at 12 o'clock, going clockwise ON SCREEN
    // (+x renders screen-left, so screen-clockwise is -cos).
    const ring = [];
    for (let i = 0; i < N; i++) if (i !== hub) ring.push(i);
    const RR = radius * 1.05;
    const CY = radius * 1.15; // float the wheel off the floor
    const pos = new Array(N);
    pos[hub] = [0, CY, 0];
    ring.forEach((i, k) => {
      const a = Math.PI / 2 - (k / ring.length) * 2 * Math.PI;
      pos[i] = [-Math.cos(a) * RR, CY + Math.sin(a) * RR, 0];
    });
    return { pos, degree, hub };
  }

  // Golden-angle sphere seed: well-spread, deterministic. Hubs start closer in.
  const GA = Math.PI * (3 - Math.sqrt(5));
  const pos = [];
  for (let i = 0; i < N; i++) {
    const t = N > 1 ? i / (N - 1) : 0.5;
    const y = 1 - 2 * t;
    const rXZ = Math.sqrt(Math.max(0, 1 - y * y));
    const a = GA * i;
    const shell = radius * (1.05 - 0.55 * (degree[i] / maxDeg)); // hubs inward
    pos.push([Math.cos(a) * rXZ * shell, y * shell * 0.8, Math.sin(a) * rXZ * shell]);
  }

  // Spring relaxation: attract along edges toward restLen, repel all pairs.
  const restLen = radius * 0.85;
  for (let it = 0; it < iterations; it++) {
    const force = pos.map(() => [0, 0, 0]);
    for (const [a, b] of ir.relations) {
      const d = [pos[b][0] - pos[a][0], pos[b][1] - pos[a][1], pos[b][2] - pos[a][2]];
      const len = Math.hypot(d[0], d[1], d[2]) || 1e-6;
      const f = (len - restLen) * 0.02;
      for (let k = 0; k < 3; k++) {
        force[a][k] += (d[k] / len) * f;
        force[b][k] -= (d[k] / len) * f;
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const d = [pos[j][0] - pos[i][0], pos[j][1] - pos[i][1], pos[j][2] - pos[i][2]];
        const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1e-6;
        const f = Math.min(0.06, 0.12 / len2);
        const len = Math.sqrt(len2);
        for (let k = 0; k < 3; k++) {
          force[i][k] -= (d[k] / len) * f;
          force[j][k] += (d[k] / len) * f;
        }
      }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) pos[i][k] += force[i][k];
  }

  // Recenter on the hub and clamp the cloud above the floor.
  const c = pos[hub];
  for (let i = 0; i < N; i++) {
    pos[i] = [pos[i][0] - c[0], pos[i][1] - c[1], pos[i][2] - c[2]];
  }
  let minY = Infinity;
  for (const p of pos) minY = Math.min(minY, p[1]);
  const lift = 1.6 - Math.min(0, minY + 1.0); // keep lowest node ≥ ~0.6
  for (const p of pos) p[1] += lift;

  return { pos, degree, hub };
}

const nodeMatN = (deg, maxDeg, emphasized, accent) => {
  if (emphasized)
    return {
      hue: 0.11,
      sat: 0.78,
      value: 0.95,
      metal: 0,
      glow: 0.1,
      kind: 'normal',
      roughness: 0.22,
      clearcoat: 0.6,
    };
  const k = maxDeg > 0 ? deg / maxDeg : 0; // hubs lighter, leaves deeper
  if (accent)
    return {
      hue: accent.h,
      sat: Math.min(1, accent.s * (0.95 - 0.2 * k)),
      value: Math.max(0.3, accent.v * (0.72 + 0.28 * k)),
      kind: 'normal',
      roughness: 0.55,
      clearcoat: 0.2,
    };
  return {
    hue: 0.64 - 0.09 * k,
    sat: 0.78 - 0.16 * k,
    value: 0.55 + 0.3 * k,
    kind: 'normal',
    // rough enough that grazing pixels fall under the reflection-skip
    // threshold — a constellation in deep space reflects nothing anyway,
    // and every sphere silhouette pixel was paying the retrace
    roughness: 0.55,
    clearcoat: 0.2,
  };
};

const EDGE_MAT = {
  hue: 0.58,
  sat: 0.25,
  value: 0.55, // R1: wiring must never outshine the stars
  glow: 0.08, // faint circuit glow — the wiring reads as live
  kind: 'normal',
  roughness: 0.6, // thin pipes: silhouette-heavy, reflection-invisible
  clearcoat: 0.15,
};

export function renderNetwork(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderNetwork: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'network')
    throw new Error(`renderNetwork: expected structure 'network', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);

  const nodes = ir.nodes.map(label);
  const N = nodes.length;
  const mag = ir.magnitude || nodes.map(() => 1);
  const mMax = Math.max(...mag.map((x) => Number(x) || 0), 1);
  const { pos, degree, hub } = constellationLayout(ir);
  const maxDeg = Math.max(...degree, 1);
  const emphasisIdx = ir.emphasis && ir.emphasis.length ? ir.emphasis[0] : hub;
  const emphasis = new Set(ir.emphasis && ir.emphasis.length ? ir.emphasis : [hub]);

  // A flywheel's ring nodes are PEERS — the source page draws them the same
  // size, so magnitude-scaling them (the generic graph behaviour) makes the
  // cycle read as a ranking it is not. Only the hub is bigger: it drives.
  const cycle = ir.form === 'cycle';
  const nodeR = cycle
    ? (i) => (i === hub ? 0.62 : 0.5)
    : (i) => 0.24 + 0.26 * Math.sqrt((Number(mag[i]) || 1) / mMax);

  // STATIC (user-locked 2026-07-15): only the CAMERA animates — the graph is
  // fully wired from frame one, so it matches its source diagram at every
  // moment and the camera owns all the motion. The beat CLOCK survives: label
  // reveals and camera timing still ride these (text syncs to the camera; only
  // GEOMETRY stopped moving).
  const nodeT0 = (i) => 0.25 + i * 0.12;
  const edgesStart = 0.25 + N * 0.12 + 0.2;
  const subjects = [];
  for (let i = 0; i < N; i++) {
    const p = pos[i];
    subjects.push({
      id: `net-node-${i}`,
      type: 'sphere',
      args: { radius: nodeR(i) },
      transform: { translate: p },
      material: nodeMatN(degree[i], maxDeg, emphasis.has(i), opts.accent),
    });
  }
  ir.relations.forEach(([a, b], e) => {
    const pa = pos[a];
    subjects.push({
      id: `net-edge-${e}`,
      type: 'capsule',
      args: {
        a: [0, 0, 0],
        b: [pos[b][0] - pa[0], pos[b][1] - pa[1], pos[b][2] - pa[2]],
        radius: 0.045, // R1: thinner — the stars own the frame
      },
      transform: { translate: pa },
      material: EDGE_MAT,
    });
  });

  // Stardust: a shell of tiny dark chips floating around the constellation —
  // the "big graph in a bigger universe" read. Deterministic golden-angle
  // layout; proxies are too small for the occlusion set, so they cost one
  // analytic intersect each and nothing else.
  {
    const GA2 = Math.PI * (3 - Math.sqrt(5));
    for (let d = 0; d < 22; d++) {
      const t = (d + 0.5) / 22;
      const y = 1 - 2 * t;
      const rXZ = Math.sqrt(Math.max(0, 1 - y * y));
      const a = GA2 * d * 7.3;
      const shell = 4.2 + 1.8 * Math.sin(d * 2.9);
      const sz = 0.09 + 0.06 * Math.sin(d * 1.7) ** 2;
      subjects.push({
        id: `dust-${d}`,
        type: 'box',
        args: { dims: [sz * 2.2, sz, sz] },
        transform: {
          translate: [Math.cos(a) * rXZ * shell, 2.2 + y * shell * 0.55, Math.sin(a) * rXZ * shell],
          rotate: [0, (d * 0.9) % 3.1, 0],
        },
        material: { hue: 0.62, sat: 0.2, value: 0.18, kind: 'normal', roughness: 0.5 }, // R1: near-black dust, not floating bricks
      });
    }
  }

  // ---- camera: five beats, network variation ---------------------------------
  const hubP = pos[hub];
  const gp = pos[emphasisIdx];
  const cloudR = Math.max(...pos.map((p) => Math.hypot(p[0], p[2]))) + 0.6;
  const midY = pos.reduce((s, p) => s + p[1], 0) / N;
  const wireDone = edgesStart + ir.relations.length * 0.14 + 0.45;
  // A CYCLE is a flat wheel standing in the picture plane — orbiting it edge-on
  // destroys the ring the page exists to show. Frontal beats instead: meet the
  // wheel square, drift across it, punch the hub. (The generic constellation
  // keeps its orbit tour — a 3D cloud has no face to respect.)
  const wheelR = cycle ? Math.max(...pos.map((p) => Math.hypot(p[0], p[1] - midY))) + 0.7 : 0;
  const wheelD = cycle ? Math.max(7, wheelR * 2.6) : 0;
  const shots = cycle
    ? [
        {
          duration: 1.0,
          pos: [0.5, midY + 0.2, wheelD + 1.2],
          target: [0, midY, 0],
          fov: 48,
          aperture: 0.22,
          focalDistance: wheelD + 1.2,
          ease: 'out',
        },
        {
          duration: 1.3,
          pos: [-0.8, midY + 0.1, wheelD],
          target: [0.1, midY, 0],
          fov: 46,
          transition: 'blend',
          aperture: 0.2,
          focalDistance: wheelD,
          ease: 'inout',
        },
      ]
    : [
        // 1 — hero: inside the cloud, looking at the hub
        {
          duration: 1.0,
          pos: [hubP[0] + cloudR * 0.5, Math.max(hubP[1] - 0.6, 0.4), hubP[2] + cloudR * 0.55],
          target: [hubP[0], hubP[1], hubP[2]],
          fov: 56,
          aperture: 0.55, // hero: shallow focus on the hub
          focalDistance: cloudR * 0.7,
          ease: 'out',
        },
        // 2 — crane up and out: the whole constellation
        {
          duration: 1.3,
          pos: [1.0, midY + cloudR * 1.2, cloudR * 1.7],
          target: [0, midY, 0],
          fov: 48,
          transition: 'blend',
          aperture: 0.3,
          focalDistance: cloudR * 1.9,
          ease: 'inout',
        },
      ];
  // 3 — tour while the eye reads the graph (duration covers the label reveals)
  const orbitBeats = 3;
  const orbitDur = Math.max(1.2, (wireDone - 2.3) / orbitBeats);
  for (let k = 0; k < orbitBeats; k++) {
    if (cycle) {
      // stay frontal; drift a little around the wheel's face
      const a = Math.PI / 2 - (k / orbitBeats) * 2 * Math.PI;
      shots.push({
        duration: orbitDur,
        pos: [-Math.cos(a) * wheelR * 0.35, midY + Math.sin(a) * wheelR * 0.3, wheelD * 0.8],
        target: [-Math.cos(a) * wheelR * 0.5, midY + Math.sin(a) * wheelR * 0.45, 0],
        fov: 45,
        transition: 'blend',
        aperture: 0.2,
        focalDistance: wheelD * 0.8,
        shake: 0.04,
        ease: 'smooth',
      });
      continue;
    }
    const theta = 1.5 + k * 1.4;
    const dist = cloudR * 1.6;
    shots.push({
      duration: orbitDur,
      // HIGH orbit (~35° down): eye-level orbits point every ray THROUGH the
      // whole cloud — each near-miss of a sphere collapses the march step and
      // the frame drowns in iterations. Looking down, rays exit the cloud
      // into the floor after a short traversal. Same tour, half the steps.
      pos: [Math.sin(theta) * dist, midY + cloudR * 1.15 - k * 0.15, Math.cos(theta) * dist],
      target: [0, midY - 0.3, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.25,
      focalDistance: dist,
      shake: 0.05,
      ease: 'smooth',
    });
  }
  // 4 — the super: hard cut punch-in on the hub/emphasis node. Distance scales
  // with the node's RADIUS — a degree-7 hub is a big ball, and the old fixed
  // 1.5 offset filled the whole frame with it (2015-deck fidelity round 1).
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0); // presentation time of the impact
  const pr = nodeR(emphasisIdx);
  shots.push({
    duration: 1.0,
    pos: [gp[0] + 0.5 + pr, Math.max(gp[1] - 0.1, 0.14), gp[2] + 1.5 + pr * 3.6],
    target: [gp[0], gp[1] + 0.06, gp[2]],
    fov: 40,
    transition: 'cut',
    beat: 'super',
    aperture: [0.9, 0.45], // rack focus: the world falls away, the subject stays
    focalDistance: 1.6 + pr * 3.6,
    shake: [0.5, 0.06], // impact-then-settle
    ambient: [0.15, 1.0], // spotlight crash: surroundings collapse on the hit, then recover
    exposure: [1.2, 1.0],
    ease: 'out',
  });
  // 5 — payoff pull-back. A cycle's money frame is SQUARE ON: the wheel is a
  // flat diagram and the crane angle would read it as a skewed triangle.
  const payoffDist = cycle
    ? (wheelD + 1.6) * (env ? env.payoffZoom : 1)
    : (cloudR * 2.6 + 1.5) * (env ? env.payoffZoom : 1);
  shots.push({
    duration: 2.4,
    // generic constellation: payoff at a MID crane angle (~25° down) —
    // eye-level rays run the length of the whole cloud (11fps even in stone
    // mode); steep overhead fills the frame with floor (which in RICH mode
    // pays the wet-floor retrace). The middle angle grounds most rays quickly
    // without floor-filling the frame.
    pos: cycle
      ? [0.3, midY + 0.3, payoffDist]
      : [1.4, midY + payoffDist * 0.42 + (env ? 0.5 : 0), payoffDist * 0.92],
    target: cycle ? [0, midY, 0] : [0, midY - 0.1, 0],
    fov: 44,
    transition: 'blend',
    aperture: 0.12, // deep focus: the whole story stays sharp
    focalDistance: payoffDist,
    ease: 'out',
  });

  // labels: reveal with each node's landing
  const topYLabel = Math.max(...pos.map((p) => p[1]));
  const overlay = [
    {
      text: String(ir.title || nodes[hub]).toUpperCase(),
      anchor: [0, topYLabel + 1.2, 0],
      role: 'title',
    },
  ];
  for (let i = 0; i < N; i++) {
    const p = pos[i];
    overlay.push({
      text: nodes[i],
      // below the sphere, matching the hierarchy fix — never on the highlight
      anchor: [p[0], p[1] - nodeR(i) - 0.26, p[2]],
      role: 'card',
      revealAt: nodeT0(i) + 0.6,
    });
  }
  const co = calloutOverlay(ir, superAt);
  if (co) overlay.push(co);

  return {
    v: 1,
    name: `(network) ${ir.title || nodes[hub]}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env ? env.defaults : { stage: { size: [16, 12, 12] } },
  };
}
