// =============================================================================
// streamlineRenderer — Topo: pen-stroke streamlines flowing downhill (Sprint 12-3c)
// -----------------------------------------------------------------------------
// 4th sibling renderer (alongside FLY 3D / BOB GPU / Blueprint / Crayon).
// Canvas2D-based; reuses crayonRenderer's pen-physics + camera + heightmap
// helpers. Each scribble is a streamline traced DOWNHILL across the heightmap
// in world XZ, projected to screen, drawn as a SketchyShape pen path.
//
// Two visual modes selected per token-hash:
//   • mono : single mid-value palette color; varying alpha gives "etched" feel
//   • multi: color by start altitude (sky→water→sand→grass→snow stack)
//
// User decisions (D1/D2/B-series):
//   B1=c: independent renderer pill "Topo"
//   B2=a: Canvas2D (reuse crayon architecture)
//   B3=b: stroke direction = along gradient (downhill, raindrops on a hill)
//   B4=c: shared crayon hash-palette (FLY 3D / Crayon / Topo all coherent)
// =============================================================================

import {
  SketchyShape, buildPalette, sampleStroke,
  sampleHeightmap, buildCameraRay, projectWorldToScreen,
} from './crayonRenderer.js';
import { Random } from '../util/random.js';

// ---------------------------------------------------------------------------
// Trace a single streamline from (startX, startZ) walking downhill in world
// XZ (negative heightmap gradient). Stops at water, flat areas, or box edge.
// Returns array of world points [x, y, z] (y = surface height at each step).
// ---------------------------------------------------------------------------
function traceStreamlineDownhill(baked, boxSize, startX, startZ, opts = {}) {
  const {
    waterHeight = 0.23,
    stepLen     = 0.008,
    maxSteps    = 90,
    gradEps     = 0.012,    // finite-difference epsilon for gradient
    minSlope    = 0.05,     // stop if surface too flat
  } = opts;
  const path = [];
  let x = startX, z = startZ;
  for (let i = 0; i < maxSteps; i++) {
    if (Math.abs(x) > boxSize[0] || Math.abs(z) > boxSize[2]) break;
    const h = sampleHeightmap(baked, boxSize, x, z);
    if (h <= waterHeight) {
      // Add one final point at water surface for clean termination
      path.push([x, waterHeight * boxSize[1] / boxSize[1], z]);
      break;
    }
    path.push([x, h, z]);
    // Sample neighbors for gradient (descend = negative grad)
    const hxp = sampleHeightmap(baked, boxSize, x + gradEps, z);
    const hzp = sampleHeightmap(baked, boxSize, x, z + gradEps);
    const dhdx = (hxp - h) / gradEps;
    const dhdz = (hzp - h) / gradEps;
    const mag = Math.hypot(dhdx, dhdz);
    if (mag < minSlope) break;
    x -= (dhdx / mag) * stepLen;
    z -= (dhdz / mag) * stepLen;
  }
  return path;
}

// ---------------------------------------------------------------------------
// Internal canvas — own sibling so crayon's canvas and ours stay separate
// (so the user can re-enter either renderer and pick up clean state).
// ---------------------------------------------------------------------------
function getOrCreateTopoCanvas() {
  let cv = document.getElementById('c-topo');
  if (cv) return cv;
  const ref = document.getElementById('c-gpu');
  if (!ref) throw new Error('[topo] #c-gpu not found — cannot create sibling');
  cv = document.createElement('canvas');
  cv.id = 'c-topo';
  cv.style.cssText = ref.style.cssText || '';
  cv.style.display = 'none';
  cv.width = ref.width;
  cv.height = ref.height;
  if (ref.parentNode) ref.parentNode.insertBefore(cv, ref.nextSibling);
  return cv;
}

// ---------------------------------------------------------------------------
// createStreamlineRenderer — matches other renderer factory signatures.
// ---------------------------------------------------------------------------
export function createStreamlineRenderer({ canvas, getControls, onFps }) {
  const topoCanvas = getOrCreateTopoCanvas();
  const ctx = topoCanvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('[topo] Canvas2D context unavailable');

  let baked = null;
  let camState = { position: [0, 0.5, -3], yaw: 0, pitch: 0 };
  let palette = null;
  let paletteOpts = {};   // Phase 2: external buildPalette override
  let isMono = false;
  let specQueue = [];
  let currentScribble = null;
  let drawnCount = 0;
  let rafId = null;
  let runRng = null;
  let fpsLast = performance.now();
  let frameCount = 0;
  let boxSize = [0.5, 1.0, 0.5];
  let waterHeight = 0.23;

  const STREAMS_TOTAL = 900;     // fewer than crayon since each is a curve
  const TICKS_PER_FRAME = 1500;

  function resizeIfNeeded() {
    const ref = document.getElementById('c-gpu');
    if (ref && (topoCanvas.width !== ref.width || topoCanvas.height !== ref.height)) {
      topoCanvas.width = ref.width;
      topoCanvas.height = ref.height;
    }
  }

  function paintBackground() {
    const c = palette.paper;
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(0, 0, topoCanvas.width, topoCanvas.height);
  }

  // Build one streamline spec: pick random world XZ start in box footprint,
  // trace downhill, project all points to screen, decide color from altitude.
  function buildSpec(focal, w, h) {
    // Bias starts toward peaks so streams begin high (more streamline length).
    // Try a few times; if heightmap value too low at start, pick again.
    let x = 0, z = 0, startH = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      x = runRng.random_num(-boxSize[0] * 0.92, boxSize[0] * 0.92);
      z = runRng.random_num(-boxSize[2] * 0.92, boxSize[2] * 0.92);
      startH = sampleHeightmap(baked, boxSize, x, z);
      if (startH > waterHeight + 0.02) break;
    }
    if (startH <= waterHeight + 0.02) return null;

    const worldPath = traceStreamlineDownhill(baked, boxSize, x, z, {
      waterHeight, stepLen: 0.008, maxSteps: 80,
    });
    if (worldPath.length < 3) return null;

    // Project to screen, drop points behind camera or off-screen
    const screenPath = [];
    let avgDepth = 0; let nDepth = 0;
    const w2 = w + 80, h2 = h + 80;   // slight off-screen margin
    for (const wp of worldPath) {
      const proj = projectWorldToScreen(wp, camState, focal, w, h);
      if (!proj) continue;
      const [sx, sy, sz] = proj;
      if (sx < -80 || sx > w2 || sy < -80 || sy > h2) continue;
      screenPath.push([sx, sy]);
      avgDepth += sz;
      nDepth++;
    }
    if (screenPath.length < 3) return null;
    const depth = avgDepth / nDepth;

    // Color: mono → single mid stroke; multi → altitude-bucketed.
    let stroke, alpha;
    if (isMono) {
      stroke = sampleStroke(palette, 0.40);
      alpha = 0.20 + runRng.random_num(-0.04, 0.04);
    } else {
      // Map start altitude [waterHeight, ~peak] to lightValue [0.2, 0.95]
      const altNorm = Math.max(0, Math.min(1, (startH - waterHeight) / 0.55));
      stroke = sampleStroke(palette, 0.20 + altNorm * 0.75);
      alpha = 0.22 + runRng.random_num(-0.03, 0.05);
    }

    return {
      screenPath, stroke, alpha,
      wt: 1.6 + runRng.random_num(-0.3, 0.6),
      depth,
    };
  }

  function makeScribbleFromSpec(spec) {
    // Re-base path so all points are relative to first (so SketchyShape's
    // x/y is the anchor, the rest are local-coordinate target points).
    const sk = new SketchyShape();
    sk.x = spec.screenPath[0][0];
    sk.y = spec.screenPath[0][1];
    sk.points = spec.screenPath.map(p => [p[0] - sk.x, p[1] - sk.y]);
    sk.pen = [...sk.points[0]];
    sk.penV = [0, 0];
    sk.penTargetIndex = 1;
    sk.wt = spec.wt;
    sk.maxV = 2.2;
    sk.acc = 0.04;
    sk.density = 2;
    sk.wobble = 0.18;
    sk.angle = 0;     // screen-space points already encode direction
    const c = spec.stroke;
    sk.color = [c[0], c[1], c[2], spec.alpha];
    return sk;
  }

  function prebakeSpecs() {
    const w = topoCanvas.width, h = topoCanvas.height;
    const focal = (getControls && getControls().fov) || 1.5;
    const specs = [];
    let attempts = 0;
    const maxAttempts = STREAMS_TOTAL * 4;
    while (specs.length < STREAMS_TOTAL && attempts < maxAttempts) {
      attempts++;
      const spec = buildSpec(focal, w, h);
      if (spec) specs.push(spec);
    }
    // Painter's algo — high depth (far) first when popped from end.
    specs.sort((a, b) => a.depth - b.depth);
    return specs;
  }

  function tick() {
    resizeIfNeeded();
    const rngRaw = () => runRng.random_dec();
    let budget = TICKS_PER_FRAME;
    while (budget-- > 0) {
      if (!currentScribble) {
        if (specQueue.length === 0) break;
        currentScribble = makeScribbleFromSpec(specQueue.pop());
      }
      const r = currentScribble.step(ctx, rngRaw);
      if (r === 'done') {
        currentScribble = null;
        drawnCount++;
      }
    }
    frameCount++;
    const now = performance.now();
    if (now - fpsLast > 500) {
      const fps = frameCount / ((now - fpsLast) / 1000);
      if (onFps) onFps(fps);
      frameCount = 0;
      fpsLast = now;
    }
    if (!currentScribble && specQueue.length === 0) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  return {
    render(sdfArg, compiled) {
      // Camera
      if (compiled && compiled.cameraStatic) {
        const cs = compiled.cameraStatic;
        camState = {
          position: [
            cs.targetX - cs.distance * Math.sin(cs.yaw) * Math.cos(cs.pitch),
            cs.targetY + cs.distance * Math.sin(cs.pitch),
            cs.targetZ - cs.distance * Math.cos(cs.yaw) * Math.cos(cs.pitch),
          ],
          yaw: cs.yaw, pitch: cs.pitch,
        };
      }
      // Hash → palette + mode
      const urlHash = (() => {
        try { return new URLSearchParams(window.location.search).get('tokenHash'); }
        catch (_) { return null; }
      })();
      const seedHash = urlHash
        || (compiled && compiled.meta && compiled.meta.hash)
        || '0x' + 'a3f1c92b48d6e077152834f9b62d8e1c93a4f7b528e6c1d09f3b475a682c9e1d';
      runRng = new Random(seedHash);
      palette = buildPalette(runRng, paletteOpts);
      isMono = runRng.random_dec() < 0.5;
      topoCanvas.style.display = 'block';
      resizeIfNeeded();
      paintBackground();
      currentScribble = null;
      drawnCount = 0;
      // Pre-bake all streamlines (raymarch + trace + project + sort)
      if (!baked) {
        // No heightmap → nothing to trace. Just leave the paper-color canvas.
        return { bytes: 0 };
      }
      specQueue = prebakeSpecs();
      fpsLast = performance.now();
      frameCount = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
      return { bytes: 0 };
    },
    unmount() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      topoCanvas.style.display = 'none';
      currentScribble = null;
      specQueue = [];
    },
    canRender(_sdf) { return true; },
    setRuneHeightmap(b) { baked = b; if (b) boxSize = [0.5, 1.0, 0.5]; },
    /** Phase 2: palette family bias — same shape as crayon's setPaletteOpts. */
    setPaletteOpts(opts) { paletteOpts = opts || {}; },
    setCamState(patch) {
      if (patch.position) camState.position = [...patch.position];
      if (patch.yaw != null) camState.yaw = patch.yaw;
      if (patch.pitch != null) camState.pitch = patch.pitch;
    },
    getCamState() { return { ...camState, position: [...camState.position] }; },
  };
}
