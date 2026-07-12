// sdf-js/scripts/spike-w0.mjs — Wave 0 gate-week spike scene generator.
// NOT a test. Produces three throwaway scenes under scenes/spikes/ for the
// courtyard-vs-landscape 选边 screenshots (spec §4 three spikes):
//   w0-massing-radial.json    — radial deck + 4 zone-massing clusters (spike 1)
//   w0-monument-radial.json   — radial deck + central monument, ~9 leaves (spike 2)
//   w0-landscape-terraced.json— line deck on alpine terrain, stations terraced
//                               by chapter elevation (spike 3)
// Zone annotation is HAND-MADE for the Phase-1 corpus (bytedance-bp, 13 slides)
// at the IR level — deliberately NOT a contract field (debate synthesis 决策②).
// Everything here post-processes assembleDeck output; the engine is untouched.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assembleDeck, shiftBuildInExpr } from '../src/scene/assemble-deck.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../scenes/spikes');
mkdirSync(OUT, { recursive: true });
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

// bytedance-bp chapters (hand annotation): 开场 / 市场 / 产品 / 团队与计划
const ZONES = [
  [0, 1],
  [2, 3, 4, 5, 6],
  [7, 8, 9],
  [10, 11, 12],
];
const zoneOf = (k) => ZONES.findIndex((z) => z.includes(k));

// Station origins come from the assembled scene's own window timeline (station
// windows carry `origin`) — no duplication of stationOrigins' math.
const stationOriginsOf = (scene) => {
  const m = new Map();
  for (const w of scene.deckWindows) if (w.kind === 'station') m.set(w.stations[0], w.origin);
  return m;
};
const centroid = (pts) => {
  const c = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
  return c.map((v) => v / pts.length);
};

// Massing silhouette material: horizon-slab family (debate constraint — the
// readability channel is silhouette/skyline/clustering, NEVER brightness).
const MASSING_MAT = {
  hue: 0.62,
  sat: 0.28,
  value: 0.32,
  metal: 0,
  glow: 0,
  kind: 'normal',
  roughness: 0.85,
};

// ---- Spike 1: zone massing on the radial ring ---------------------------------
{
  const scene = assembleDeck(DECK, { layout: 'radial' });
  const origins = stationOriginsOf(scene);
  const center = centroid([...origins.values()]);
  const massing = [];
  // Fixed placement band: ring radius + 34. A multiplicative push (centroid ×
  // 1.75) fails on wide-arc zones — their centroid pulls toward the ring
  // center, landing massing 12-22 units behind stations, INSIDE the crane
  // shots' near field (first spike round proved it: foreground blur blobs).
  const ringR = Math.max(
    ...[...origins.values()].map((o) => Math.hypot(o[0] - center[0], o[2] - center[2])),
  );
  const bandR = ringR + 34;
  ZONES.forEach((members, z) => {
    const c = centroid(members.map((k) => origins.get(k)));
    const dir = [c[0] - center[0], 0, c[2] - center[2]];
    const len = Math.hypot(dir[0], dir[2]) || 1;
    const base = [center[0] + (dir[0] / len) * bandR, 0, center[2] + (dir[2] / len) * bandR];
    const W = 7 + members.length * 1.4; // chapter weight → cluster width
    const H = 4.2 + members.length * 1.1; // chapter weight → skyline height
    massing.push({
      id: `massing-z${z}-hull`,
      type: 'ellipsoid',
      args: { dims: [W, H, W * 0.55] },
      transform: { translate: [base[0], -H * 0.45, base[2]] }, // crest only — a ridge, not a dome
      material: MASSING_MAT,
    });
    massing.push({
      id: `massing-z${z}-tower`,
      type: 'box',
      args: { dims: [W * 0.22, H * 1.6, W * 0.22] },
      transform: { translate: [base[0] + W * 0.28, H * 0.4, base[2] - W * 0.1] },
      material: MASSING_MAT,
    });
  });
  scene.subjects = [...scene.subjects, ...massing];
  scene.name = '(spike W0.2) zone massing · radial';
  writeFileSync(resolve(OUT, 'w0-massing-radial.json'), JSON.stringify(scene, null, 1) + '\n');
  console.log(`w0-massing-radial: +${massing.length} massing subjects (${ZONES.length} zones)`);
}

// ---- Spike 2: central monument (leaf pricing) ----------------------------------
{
  const scene = assembleDeck(DECK, { layout: 'radial' });
  const center = centroid([...stationOriginsOf(scene).values()]);
  const [cx, , cz] = center;
  const M = {
    hue: 0.58,
    sat: 0.12,
    value: 0.5,
    metal: 0,
    glow: 0,
    kind: 'normal',
    roughness: 0.5,
    clearcoat: 0.3,
  };
  const monument = [
    {
      id: 'monument-base',
      type: 'cylinder',
      args: { radius: 4.4, height: 0.5 },
      transform: { translate: [cx, 0.25, cz] },
      material: M,
    },
    {
      id: 'monument-tier',
      type: 'cylinder',
      args: { radius: 3.1, height: 0.45 },
      transform: { translate: [cx, 0.72, cz] },
      material: M,
    },
    {
      id: 'monument-plinth',
      type: 'box',
      args: { dims: [1.6, 1.1, 1.6] },
      transform: { translate: [cx, 1.5, cz] },
      material: M,
    },
    {
      id: 'monument-spire',
      type: 'box',
      args: { dims: [0.7, 5.2, 0.7] },
      transform: { translate: [cx, 4.6, cz] },
      material: { ...M, value: 0.62 },
    },
    {
      id: 'monument-cap',
      type: 'sphere',
      args: { radius: 0.55 },
      transform: { translate: [cx, 7.5, cz] },
      material: { ...M, value: 0.72 },
    },
  ];
  // four columns ringing the plinth
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    monument.push({
      id: `monument-col-${i}`,
      type: 'capsule',
      args: { radius: 0.28, height: 2.6 },
      transform: { translate: [cx + Math.sin(a) * 3.6, 1.55, cz + Math.cos(a) * 3.6] },
      material: M,
    });
  }
  scene.subjects = [...scene.subjects, ...monument];
  scene.name = `(spike W0.3) central monument · ${monument.length} leaves`;
  writeFileSync(resolve(OUT, 'w0-monument-radial.json'), JSON.stringify(scene, null, 1) + '\n');
  console.log(`w0-monument-radial: +${monument.length} monument leaves`);
}

// ---- Spike 3: landscape terraces (line deck on alpine, chapter = elevation) ----
{
  const scene = assembleDeck(DECK, { layout: 'line', env: 'alpine', stage: true });
  const STEP = 3.2; // chapter elevation step — the promenade CLIMBS toward the close
  const dyOfStation = (k) => zoneOf(k) * STEP;

  // subjects: station prefix → its chapter elevation; breadcrumbs interpolate
  for (const s of scene.subjects) {
    const st = /^s(\d+)-/.exec(s.id || '');
    const path = /^path-(\d+)-(\d+)$/.exec(s.id || '');
    let dy = 0;
    if (st) dy = dyOfStation(Number(st[1]));
    else if (path) {
      const k = Number(path[1]);
      const f = Number(path[2]) / 6; // dots=5, f = d/(dots+1)
      dy = dyOfStation(k) * (1 - f) + dyOfStation(k + 1) * f;
    } else continue;
    if (!dy) continue;
    s.transform.translate[1] += dy;
    if (Array.isArray(s.animation)) {
      s.animation = s.animation.map((a) =>
        a.channel === 'transform.translate.y' ? { ...a, expr: shiftBuildInExpr(a.expr, dy, 0) } : a,
      );
    }
  }

  // shots: assign each to its deck window by midpoint time, lift by the
  // window's station elevation (transit = blend of its two endpoints)
  const dyOfWindow = (w) =>
    w.kind === 'finale'
      ? Math.max(...ZONES.map((_, z) => z)) * STEP * 0.5
      : w.stations.map(dyOfStation).reduce((a, b) => a + b, 0) / w.stations.length;
  let t = 0;
  for (const sh of scene.cameraSequence.shots) {
    const mid = t + (sh.duration || 0) / 2;
    const win =
      scene.deckWindows.find((w) => mid >= w.start && mid < w.end) || scene.deckWindows.at(-1);
    const dy = dyOfWindow(win);
    if (dy) {
      sh.pos[1] += dy;
      sh.target[1] += dy;
    }
    t += sh.duration || 0;
  }

  // overlay: reveal time → owning station window → elevation
  for (const o of scene.overlay) {
    if (o.revealAt == null) continue;
    const win = scene.deckWindows.find(
      (w) => w.kind === 'station' && o.revealAt >= w.start - 1e-6 && o.revealAt < w.end,
    );
    if (win) o.anchor[1] += dyOfStation(win.stations[0]);
  }

  scene.name = '(spike W0.4) landscape terraces · alpine · chapter elevation';
  writeFileSync(resolve(OUT, 'w0-landscape-terraced.json'), JSON.stringify(scene, null, 1) + '\n');
  console.log('w0-landscape-terraced: 4 chapter terraces, step', STEP);
}

// ---- Spike 3b: MINI landscape (one station per chapter) ------------------------
// Spike finding forced this variant: the full 13-station deck + alpine terrain
// in ONE shader never finished compiling on D3D (5+ min, super-linear leaf
// cost), and per-window switching recompiles the terrain into every window
// shader (26×). A 5-station cut keeps the LOOK verifiable at the compile
// cost of a shipped env figure.
{
  const PICK = [0, 3, 7, 10, 12]; // cover / 市场 / 产品 / 团队 / 目标
  const MINI_ZONE = [0, 1, 2, 3, 3]; // chapter per picked station
  const mini = { title: DECK.title + ' · mini', slides: PICK.map((i) => DECK.slides[i]) };
  const scene = assembleDeck(mini, { layout: 'line', env: 'alpine', stage: true });
  const STEP = 3.2;
  const dyOfStation = (k) => MINI_ZONE[k] * STEP;
  for (const s of scene.subjects) {
    const st = /^s(\d+)-/.exec(s.id || '');
    const path = /^path-(\d+)-(\d+)$/.exec(s.id || '');
    let dy = 0;
    if (st) dy = dyOfStation(Number(st[1]));
    else if (path) {
      const k = Number(path[1]);
      const f = Number(path[2]) / 6;
      dy = dyOfStation(k) * (1 - f) + dyOfStation(k + 1) * f;
    } else continue;
    if (!dy) continue;
    s.transform.translate[1] += dy;
    if (Array.isArray(s.animation)) {
      s.animation = s.animation.map((a) =>
        a.channel === 'transform.translate.y' ? { ...a, expr: shiftBuildInExpr(a.expr, dy, 0) } : a,
      );
    }
  }
  const dyOfWindow = (w) =>
    w.kind === 'finale'
      ? Math.max(...MINI_ZONE) * STEP * 0.5
      : w.stations.map(dyOfStation).reduce((a, b) => a + b, 0) / w.stations.length;
  let t = 0;
  for (const sh of scene.cameraSequence.shots) {
    const mid = t + (sh.duration || 0) / 2;
    const win =
      scene.deckWindows.find((w) => mid >= w.start && mid < w.end) || scene.deckWindows.at(-1);
    const dy = dyOfWindow(win);
    if (dy) {
      sh.pos[1] += dy;
      sh.target[1] += dy;
    }
    t += sh.duration || 0;
  }
  for (const o of scene.overlay) {
    if (o.revealAt == null) continue;
    const win = scene.deckWindows.find(
      (w) => w.kind === 'station' && o.revealAt >= w.start - 1e-6 && o.revealAt < w.end,
    );
    if (win) o.anchor[1] += dyOfStation(win.stations[0]);
  }
  scene.name = '(spike W0.4b) landscape terraces MINI · 5 stations';
  writeFileSync(resolve(OUT, 'w0-landscape-mini.json'), JSON.stringify(scene, null, 1) + '\n');
  console.log('w0-landscape-mini: 5 stations / 4 terraces');
}

console.log('\nspike scenes written to scenes/spikes/. View: apps/present/spike.html?scene=<name>');
