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

const nodeMatN = (deg, maxDeg, emphasized) => {
  if (emphasized)
    return { hue: 0.11, sat: 0.78, value: 0.95, kind: 'normal', roughness: 0.22, clearcoat: 0.6 };
  const k = maxDeg > 0 ? deg / maxDeg : 0; // hubs lighter, leaves deeper
  return {
    hue: 0.64 - 0.09 * k,
    sat: 0.78 - 0.16 * k,
    value: 0.55 + 0.3 * k,
    kind: 'normal',
    roughness: 0.3,
    clearcoat: 0.45,
  };
};

const EDGE_MAT = {
  hue: 0.58,
  sat: 0.25,
  value: 0.8,
  kind: 'normal',
  roughness: 0.35,
  clearcoat: 0.3,
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

  const nodeR = (i) => 0.16 + 0.18 * Math.sqrt((Number(mag[i]) || 1) / mMax);

  // Assembly: nodes cascade in a quick wave, then edges land in waves — the
  // network wires itself while the camera orbits.
  const drop = 1.1;
  const nodeT0 = (i) => 0.25 + i * 0.12;
  const edgesStart = 0.25 + N * 0.12 + 0.2;
  const subjects = [];
  for (let i = 0; i < N; i++) {
    const p = pos[i];
    const t0 = nodeT0(i);
    subjects.push({
      id: `net-node-${i}`,
      type: 'sphere',
      args: { radius: nodeR(i) },
      transform: { translate: p },
      material: nodeMatN(degree[i], maxDeg, emphasis.has(i)),
      animation: [
        {
          channel: 'transform.translate.y',
          expr: `${(p[1] + drop).toFixed(3)} - ${drop} * smoothstep(${t0.toFixed(2)}, ${(t0 + 0.5).toFixed(2)}, t)`,
        },
      ],
    });
  }
  ir.relations.forEach(([a, b], e) => {
    const pa = pos[a];
    const t0 = edgesStart + e * 0.14;
    subjects.push({
      id: `net-edge-${e}`,
      type: 'capsule',
      args: {
        a: [0, 0, 0],
        b: [pos[b][0] - pa[0], pos[b][1] - pa[1], pos[b][2] - pa[2]],
        radius: 0.035,
      },
      transform: { translate: pa },
      material: EDGE_MAT,
      animation: [
        {
          channel: 'transform.translate.y',
          expr: `${(pa[1] + drop).toFixed(3)} - ${drop} * smoothstep(${t0.toFixed(2)}, ${(t0 + 0.45).toFixed(2)}, t)`,
        },
      ],
    });
  });

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
    const dist = cloudR * 1.9;
    shots.push({
      duration: orbitDur,
      pos: [Math.sin(theta) * dist, midY + 0.9 - k * 0.25, Math.cos(theta) * dist],
      target: [0, midY, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.25,
      focalDistance: dist,
      shake: 0.05,
      ease: 'smooth',
    });
  }
  // 4 — the super: hard cut punch-in on the hub/emphasis node
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0); // presentation time of the impact
  shots.push({
    duration: 1.0,
    pos: [gp[0] + 0.5, Math.max(gp[1] - 0.1, 0.14), gp[2] + 1.5],
    target: [gp[0], gp[1] + 0.06, gp[2]],
    fov: 40,
    transition: 'cut',
    aperture: [0.9, 0.45], // rack focus: the world falls away, the subject stays
    focalDistance: 1.6,
    shake: [0.5, 0.06], // impact-then-settle
    exposure: [1.45, 1.0],
    ease: 'out',
  });
  // 5 — payoff pull-back
  const payoffDist = (cloudR * 2.6 + 1.5) * (env ? env.payoffZoom : 1);
  shots.push({
    duration: 2.4,
    pos: [1.4, midY + 1.2 + (env ? 0.5 : 0), payoffDist],
    target: [0, midY, 0],
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
      anchor: [p[0] + nodeR(i) + 0.3, p[1], p[2]],
      role: 'card',
      align: 'left',
      revealAt: nodeT0(i) + 0.6,
    });
  }

  return {
    v: 1,
    name: `(network) ${ir.title || nodes[hub]}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env ? env.defaults : { stage: { size: [16, 12, 12] } },
  };
}
