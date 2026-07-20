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

// ---- flywheel form ---------------------------------------------------------------
// A cycle network (form:'cycle') is not a constellation — it's an ENGINE. The
// native 3D form is a FLYWHEEL: the cycle members sit on a horizontal ring,
// directed flow arcs run along the rim with arrowheads, and the non-cycle
// feeder (the 2015 BP p22's 推荐引擎) stands at the hub driving it. The camera
// orbits IN the flow direction — the wheel "spins" through parallax while the
// geometry stays put (STATIC rule, user-locked 2026-07-15).

/** Nodes that can reach themselves = the cycle members (tiny graphs, DFS). */
export function cycleMembers(ir) {
  const N = ir.nodes.length;
  const adj = Array.from({ length: N }, () => []);
  for (const [a, b] of ir.relations || []) if (a !== b) adj[a].push(b);
  const reaches = (from, goal) => {
    const seen = new Set();
    const stack = [...adj[from]];
    while (stack.length) {
      const n = stack.pop();
      if (n === goal) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(...adj[n]);
    }
    return false;
  };
  return ir.nodes.map((_, i) => reaches(i, i));
}

/** Ring order: start at the lowest-index member, follow cycle edges. */
export function flywheelLayout(ir) {
  const inCycle = cycleMembers(ir);
  const members = ir.nodes.map((_, i) => i).filter((i) => inCycle[i]);
  const centers = ir.nodes.map((_, i) => i).filter((i) => !inCycle[i]);
  const adj = Array.from({ length: ir.nodes.length }, () => []);
  for (const [a, b] of ir.relations || []) adj[a].push(b);
  const ring = [];
  if (members.length) {
    const seen = new Set();
    let cur = members[0];
    while (cur != null && !seen.has(cur)) {
      ring.push(cur);
      seen.add(cur);
      cur = adj[cur].find((n) => inCycle[n] && !seen.has(n));
    }
    for (const m of members) if (!seen.has(m)) ring.push(m); // stragglers
  }
  return { ring, centers };
}

function renderFlywheelForm(ir, env, opts) {
  const nodes = ir.nodes.map(label);
  const { ring, centers } = flywheelLayout(ir);
  const M = ring.length;
  const R = 2.5;
  const RING_Y = 1.9;
  const emphasis = new Set(
    ir.emphasis && ir.emphasis.length ? ir.emphasis : centers.length ? [centers[0]] : [ring[0]],
  );
  // ring node angles: index k → around the wheel; -θ so the flow reads
  // clockwise from the standard high-orbit view (+x is screen-LEFT)
  const angle = (k) => Math.PI / 2 - (k * 2 * Math.PI) / Math.max(M, 1);
  const ringPos = ring.map((_, k) => [Math.cos(angle(k)) * R, RING_Y, Math.sin(angle(k)) * R]);
  const centerPos = centers.map((_, j) => [0, RING_Y + j * 1.3, 0]);

  const pos = new Array(ir.nodes.length);
  ring.forEach((i, k) => (pos[i] = ringPos[k]));
  centers.forEach((i, j) => (pos[i] = centerPos[j]));

  const subjects = [];
  // hub engine(s): bigger, brighter — the thing that drives the wheel
  centers.forEach((i, j) => {
    subjects.push({
      id: `fly-hub-${j}`,
      type: 'sphere',
      args: { radius: 0.62 },
      transform: { translate: centerPos[j] },
      material: nodeMatN(1, 1, emphasis.has(i), opts.accent),
    });
  });
  ring.forEach((i, k) => {
    subjects.push({
      id: `fly-node-${k}`,
      type: 'sphere',
      args: { radius: emphasis.has(i) ? 0.5 : 0.42 },
      transform: { translate: ringPos[k] },
      material: nodeMatN(2, 2, emphasis.has(i), opts.accent),
    });
  });
  // rim arcs with arrowheads: one directed arc per consecutive ring pair.
  // Arc = short capsule segments along the circle; arrowhead = 3 shrinking
  // spheres at the arc's end (analytic tier: no cone primitive, no z-rotation).
  const SEGS = 6;
  const arcMat = { ...EDGE_MAT, value: 0.7, glow: 0.14 };
  for (let k = 0; k < M; k++) {
    const a0 = angle(k);
    const a1 = angle(k + 1); // wraps: angle() is linear in k
    const pad = 0.55 / R; // radians of clearance around each node
    const from = a0 - pad;
    const to = a1 + pad;
    for (let s = 0; s < SEGS; s++) {
      const t0 = from + ((to - from) * s) / SEGS;
      const t1 = from + ((to - from) * (s + 1)) / SEGS;
      const p0 = [Math.cos(t0) * R, RING_Y, Math.sin(t0) * R];
      const p1 = [Math.cos(t1) * R, RING_Y, Math.sin(t1) * R];
      subjects.push({
        id: `fly-arc-${k}-${s}`,
        type: 'capsule',
        args: { a: [0, 0, 0], b: [p1[0] - p0[0], 0, p1[2] - p0[2]], radius: 0.055 },
        transform: { translate: p0 },
        material: arcMat,
      });
    }
    // arrowhead: 3 shrinking spheres continuing PAST the arc end toward the
    // destination node (flow direction = decreasing angle)
    for (let h = 0; h < 3; h++) {
      const th = to - ((h + 1) * 0.55 * pad) / 3;
      subjects.push({
        id: `fly-tip-${k}-${h}`,
        type: 'sphere',
        args: { radius: 0.13 - h * 0.035 },
        transform: { translate: [Math.cos(th) * R, RING_Y, Math.sin(th) * R] },
        material: arcMat,
      });
    }
  }
  // spokes: hub → ring relations (thin, faint)
  const ringSet = new Set(ring);
  (ir.relations || []).forEach(([a, b], e) => {
    const hubEnd = !ringSet.has(a) || !ringSet.has(b);
    if (!hubEnd) return; // rim traffic is already the arcs
    const pa = pos[a];
    const pb = pos[b];
    if (!pa || !pb) return;
    subjects.push({
      id: `fly-spoke-${e}`,
      type: 'capsule',
      args: { a: [0, 0, 0], b: [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], radius: 0.04 },
      transform: { translate: pa },
      material: EDGE_MAT,
    });
  });

  // ---- camera: five beats, flywheel variation — the orbit FOLLOWS the flow ----
  const eIdx = [...emphasis][0];
  const ep = pos[eIdx] || [0, RING_Y, 0];
  const shots = [
    // 1 — hero: low at rim level, looking across the wheel at the hub
    {
      duration: 1.1,
      pos: [ringPos[0][0] * 1.5, RING_Y - 0.5, ringPos[0][2] * 1.5 + 1.2],
      target: [0, RING_Y + 0.2, 0],
      fov: 54,
      aperture: 0.5,
      focalDistance: R * 1.4,
      ease: 'out',
    },
    // 2 — crane out: the whole wheel
    {
      duration: 1.3,
      pos: [0.8, RING_Y + R * 1.5, R * 2.3],
      target: [0, RING_Y, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.25,
      focalDistance: R * 2.6,
      ease: 'inout',
    },
  ];
  // 3 — flow orbit: circle in the direction the arrows point (θ decreasing),
  // one beat per ring node — the wheel spins via parallax
  for (let k = 0; k < Math.max(M, 3); k++) {
    const th = Math.PI / 2 - ((k + 1) * 2 * Math.PI) / Math.max(M, 3);
    const dist = R * 2.2;
    shots.push({
      duration: 1.15,
      pos: [Math.cos(th) * dist, RING_Y + R * 1.05, Math.sin(th) * dist],
      target: [0, RING_Y - 0.15, 0],
      fov: 45,
      transition: 'blend',
      aperture: 0.22,
      focalDistance: dist,
      ease: 'smooth',
    });
  }
  // 4 — the super: hard cut punch-in on the engine/emphasis
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0);
  shots.push({
    duration: 1.0,
    pos: [ep[0] + 0.6, Math.max(ep[1] - 0.05, 0.4), ep[2] + 2.1],
    target: [ep[0], ep[1] + 0.05, ep[2]],
    fov: 42,
    transition: 'cut',
    beat: 'super',
    aperture: [0.9, 0.45],
    focalDistance: 2.2,
    shake: [0.5, 0.06],
    ambient: [0.15, 1.0],
    exposure: [1.2, 1.0],
    ease: 'out',
  });
  // 5 — payoff pull-back: mid crane, the whole engine turning in one frame
  const payoffDist = (R * 2.9 + 1.2) * (env ? env.payoffZoom : 1);
  shots.push({
    duration: 2.4,
    pos: [1.2, RING_Y + payoffDist * 0.5, payoffDist * 0.9],
    target: [0, RING_Y - 0.1, 0],
    fov: 45,
    transition: 'blend',
    aperture: 0.12,
    focalDistance: payoffDist,
    ease: 'out',
  });

  const overlay = [
    {
      text: String(ir.title || 'Flywheel').toUpperCase(),
      anchor: [0, RING_Y + R * 1.15 + 0.9, 0],
      role: 'title',
    },
  ];
  centers.forEach((i, j) => {
    overlay.push({
      text: nodes[i],
      anchor: [0, centerPos[j][1] + 0.95, 0],
      role: 'card',
      align: 'center',
      revealAt: 0.4,
    });
  });
  ring.forEach((i, k) => {
    const p = ringPos[k];
    overlay.push({
      text: nodes[i],
      anchor: [p[0] * 1.18, p[1] - 0.72, p[2] * 1.18],
      role: 'card',
      align: 'center',
      revealAt: 0.7 + k * 0.25,
    });
  });
  const co = calloutOverlay(ir, superAt);
  if (co) overlay.push(co);

  return {
    v: 1,
    name: `(network·flywheel) ${ir.title || 'cycle'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env ? env.defaults : { stage: { size: [16, 12, 12] } },
  };
}

export function renderNetwork(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderNetwork: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'network')
    throw new Error(`renderNetwork: expected structure 'network', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);
  if (ir.form === 'cycle' && (ir.relations || []).length >= 3) {
    const { ring } = flywheelLayout(ir);
    if (ring.length >= 3) return renderFlywheelForm(ir, env, opts);
  }

  const nodes = ir.nodes.map(label);
  const N = nodes.length;
  const mag = ir.magnitude || nodes.map(() => 1);
  const mMax = Math.max(...mag.map((x) => Number(x) || 0), 1);
  const { pos, degree, hub } = constellationLayout(ir);
  const maxDeg = Math.max(...degree, 1);
  const emphasisIdx = ir.emphasis && ir.emphasis.length ? ir.emphasis[0] : hub;
  const emphasis = new Set(ir.emphasis && ir.emphasis.length ? ir.emphasis : [hub]);

  const nodeR = (i) => 0.24 + 0.26 * Math.sqrt((Number(mag[i]) || 1) / mMax);

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
  const shots = [
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
  // 3 — orbit tour while the network wires itself (duration covers the waves)
  const orbitBeats = 3;
  const orbitDur = Math.max(1.2, (wireDone - 2.3) / orbitBeats);
  for (let k = 0; k < orbitBeats; k++) {
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
  // 5 — payoff pull-back
  const payoffDist = (cloudR * 2.6 + 1.5) * (env ? env.payoffZoom : 1);
  shots.push({
    duration: 2.4,
    // payoff at a MID crane angle (~25° down): eye-level rays run the length
    // of the whole cloud (11fps even in stone mode); steep overhead fills the
    // frame with floor (which in RICH mode pays the wet-floor retrace). The
    // middle angle grounds most rays quickly without floor-filling the frame.
    pos: [1.4, midY + payoffDist * 0.42 + (env ? 0.5 : 0), payoffDist * 0.92],
    target: [0, midY - 0.1, 0],
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
