// =============================================================================
// decor/registry.js — Sprint 41: the 2D DECORATION layer (修饰能力).
//
// The style-layer thesis, 2D side: P5-generative-art idioms are to the 2D end
// what shader idioms are to the 3D end — two independent "empirical domain"
// supply lines (they deliberately do NOT need twins; decoration is not
// semantic content and is exempt from the X-gap closure rule).
//
// Contract (mirrors the two-track lock):
//   - Every decoration is a PURE function (ctx, {palette, seed, x, y, w, h,
//     intensity}) — theme-palette-constrained, SFC32-seeded deterministic
//     (same seed → same pixels, reproducible across re-renders and exports).
//   - The LLM neither writes nor selects decoration code. Assignment is
//     deterministic: theme macroCluster → family affinity + seeded pick.
//   - Legibility guard: intensity presets cap stroke alpha ('subtle' for
//     content backdrops, 'bold' only over cover gradients).
//
// Generators are ADAPTED COPIES from the P5 idiom registry corpus
// (sdf-js/examples/p5-idiom-registry/ — the established src convention, same
// as icon-badge and chromotome-palettes-data):
//   flow-streams — after moussa-perlin-flow-field (Amin Moussa recipes) +
//                  kgolid p5ycho flow tradition, MIT-implicit
//   weave-dashes — after kgolid-weave-flow-dashes (Kjetil Golid, p5ycho/weave)
//   circle-pack  — after moussa-shape-pack-grid-collision / Gorilla Sun
//                  packing essays (recipe-only)
//   shard-mesh   — after moussa-delaunay-voronoi (recipe-only: jittered-grid
//                  triangulation approximation, no delaunay dependency)
// =============================================================================

import { makeHashRand } from './rand.js';

// --- deterministic primitives (value noise + rng, per idiom-registry style) --
function seededRand(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 9) & 0x7fffff) / 0x800000;
  };
}

function noise2D(seed) {
  const hash = (ix, iy) => {
    let h = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1103515245;
    return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = fade(x - ix);
    const fy = fade(y - iy);
    return lerp(
      lerp(hash(ix, iy), hash(ix + 1, iy), fx),
      lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx),
      fy,
    );
  };
}

const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;

// intensity presets — the legibility guard. Content backdrops stay whisper-
// quiet; 'bold' is reserved for cover/divider slides over their gradient.
const INTENSITY = {
  subtle: { alpha: 0.07, alphaFill: 0.05, lineWidth: 1 },
  medium: { alpha: 0.14, alphaFill: 0.1, lineWidth: 1.2 },
  bold: { alpha: 0.26, alphaFill: 0.18, lineWidth: 1.6 },
};

// --- families ---------------------------------------------------------------

// flow-streams: long noise-driven streamlines (wind / fluid feel)
function drawFlowStreams(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const rand = seededRand(seed * 7 + 1);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const lines = Math.round((w * h) / 18000);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < lines; i++) {
    let px = x + rand() * w;
    let py = y + rand() * h;
    const color = colors[i % colors.length];
    ctx.strokeStyle = rgba(color, P.alpha);
    ctx.lineWidth = P.lineWidth;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let s = 0; s < 60; s++) {
      const a = noise(px * 0.004, py * 0.004) * Math.PI * 4;
      px += Math.cos(a) * 6;
      py += Math.sin(a) * 6;
      if (px < x || px > x + w || py < y || py > y + h) break;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// weave-dashes: dense short dashes along local gradient (iron-filings weave)
function drawWeaveDashes(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean).slice(0, 3);
  ctx.save();
  ctx.lineCap = 'round';
  const cell = 26;
  for (let layer = 0; layer < colors.length; layer++) {
    const noise = noise2D(seed + layer * 101);
    ctx.strokeStyle = rgba(colors[layer], P.alpha);
    ctx.lineWidth = P.lineWidth;
    for (let gy = y + cell / 2; gy < y + h; gy += cell) {
      for (let gx = x + cell / 2 + (layer * cell) / 3; gx < x + w; gx += cell) {
        const a = noise(gx * 0.006, gy * 0.006) * Math.PI * 2;
        const len = cell * 0.42;
        ctx.beginPath();
        ctx.moveTo(gx - Math.cos(a) * len, gy - Math.sin(a) * len);
        ctx.lineTo(gx + Math.cos(a) * len, gy + Math.sin(a) * len);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// circle-pack: collision-free circles, corner-weighted so slide centers stay clear
function drawCirclePack(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const rand = seededRand(seed * 13 + 5);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const placed = [];
  const tries = 260;
  ctx.save();
  for (let i = 0; i < tries; i++) {
    // corner-weighted position (square the unit coords toward edges)
    const u = rand();
    const v = rand();
    const cx = x + (u < 0.5 ? u * u * 2 : 1 - (1 - u) * (1 - u) * 2) * w;
    const cy = y + (v < 0.5 ? v * v * 2 : 1 - (1 - v) * (1 - v) * 2) * h;
    const r = 6 + rand() * Math.min(w, h) * 0.06;
    let ok = true;
    for (const c of placed) {
      const d = Math.hypot(cx - c.x, cy - c.y);
      if (d < r + c.r + 4) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    placed.push({ x: cx, y: cy, r });
    const color = colors[placed.length % colors.length];
    if (placed.length % 3 === 0) {
      ctx.fillStyle = rgba(color, P.alphaFill);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = rgba(color, P.alpha);
      ctx.lineWidth = P.lineWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (placed.length > 40) break;
  }
  ctx.restore();
}

// shard-mesh: jittered-grid triangulation outlines (delaunay-recipe look)
function drawShardMesh(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const rand = seededRand(seed * 31 + 7);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const cols = 8;
  const rows = 5;
  const pts = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      pts.push([
        x + (i / cols) * w + (i > 0 && i < cols ? (rand() - 0.5) * (w / cols) * 0.9 : 0),
        y + (j / rows) * h + (j > 0 && j < rows ? (rand() - 0.5) * (h / rows) * 0.9 : 0),
      ]);
    }
  }
  const at = (i, j) => pts[j * (cols + 1) + i];
  ctx.save();
  ctx.lineWidth = P.lineWidth;
  let k = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const quad = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const diag = rand() < 0.5;
      const tris = diag
        ? [
            [quad[0], quad[1], quad[2]],
            [quad[0], quad[2], quad[3]],
          ]
        : [
            [quad[0], quad[1], quad[3]],
            [quad[1], quad[2], quad[3]],
          ];
      for (const tri of tris) {
        k++;
        const color = colors[k % colors.length];
        ctx.strokeStyle = rgba(color, P.alpha * 0.8);
        if (k % 7 === 0) ctx.fillStyle = rgba(color, P.alphaFill * 0.6);
        ctx.beginPath();
        ctx.moveTo(tri[0][0], tri[0][1]);
        ctx.lineTo(tri[1][0], tri[1][1]);
        ctx.lineTo(tri[2][0], tri[2][1]);
        ctx.closePath();
        ctx.stroke();
        if (k % 7 === 0) ctx.fill();
      }
    }
  }
  ctx.restore();
}

// meadow-streaks: anisotropic noise-rotated ellipse field (grass-blade
// streaks). CODE PORT from "Fragments of an Infinite Field" (Monica
// Rizzolli, Art Blocks Curated #159, licensed CC BY 4.0 — attribution
// required and hereby given; see docs/superpowers/artblocks-study/
// 01-fragments-rizzolli.md). Three of her idioms combined:
//   - anisotropic ellipses (1×10 aspect) rotated by a noise field
//   - noise-GATED density (a2 < chance → organic patches, not uniform grain)
//   - noise-INDEXED palette (color chosen by the same spatial field →
//     neighboring blades share color, coherent drifts instead of confetti)
function drawMeadowStreaks(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const noiseGate = noise2D(seed + 7919);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const cellW = 14;
  const cellH = 30;
  const bladeW = 3;
  ctx.save();
  for (let gy = y; gy < y + h; gy += cellH * 0.6) {
    for (let gx = x; gx < x + w; gx += cellW) {
      const a = noise(gx * 0.004, gy * 0.004);
      const gate = noiseGate(gx * 0.006, gy * 0.006);
      if (gate > 0.46) continue; // noise-gated density → patches
      const color = colors[Math.floor(a * colors.length) % colors.length];
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate((a - 0.5) * Math.PI * 1.6);
      ctx.strokeStyle = rgba(color, P.alpha);
      ctx.lineWidth = P.lineWidth;
      ctx.beginPath();
      ctx.ellipse(0, 0, bladeW, cellH * (0.5 + a), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// --- registry ----------------------------------------------------------------

export const DECOR_FAMILIES = {
  'flow-streams': drawFlowStreams,
  'weave-dashes': drawWeaveDashes,
  'circle-pack': drawCirclePack,
  'shard-mesh': drawShardMesh,
  'meadow-streaks': drawMeadowStreaks,
};

// theme macroCluster → family affinity (seeded pick between two candidates so
// different decks in the same theme still vary)
const CLUSTER_AFFINITY = {
  editorial: ['flow-streams', 'shard-mesh', 'meadow-streaks'],
  pitch: ['weave-dashes', 'circle-pack'],
  organic: ['meadow-streaks', 'flow-streams', 'circle-pack'],
  consulting: ['weave-dashes', 'shard-mesh'],
  financial: ['shard-mesh', 'weave-dashes'],
  hr: ['circle-pack', 'meadow-streaks'],
};

/**
 * pickDecorFor(theme, seed) → { family, seed } — deterministic per
 * (theme, seed); the LLM is never involved.
 */
export function pickDecorFor(theme, seed = 1) {
  const cluster = String(theme?.macroCluster || theme?.id || '').split('-')[0];
  const candidates = CLUSTER_AFFINITY[cluster] || ['flow-streams', 'weave-dashes'];
  const rand = seededRand(seed);
  return { family: candidates[Math.floor(rand() * candidates.length)], seed };
}

/**
 * drawDecor(ctx, decor, opts) — paint one decoration region.
 * decor: { family, seed }; opts: { palette, x, y, w, h, intensity }.
 * Unknown family is a silent no-op (decks stay renderable across versions).
 */
export function drawDecor(ctx, decor, { palette, x = 0, y = 0, w, h, intensity = 'subtle' } = {}) {
  const fn = DECOR_FAMILIES[decor?.family];
  if (!fn || !palette || !w || !h) return false;
  fn(ctx, { palette, seed: decor.seed ?? 1, x, y, w, h, intensity });
  return true;
}

// --- mint-hash provenance (Sprint 41, user's core insight) -------------------
// The decoration seed is NOT derived from the content. It is MINTED —
// crypto-random at generation time, fxhash/ArtBlocks style. Consequences:
//   - The seed space is astronomically large; a deck's generative identity
//     is one unguessable point in it.
//   - The OWNER (who holds the hash) can re-derive their exact artifact
//     forever (determinism = proof of authorship).
//   - An imitator with the same text and the same tool still cannot mint
//     the same artifact — the visual identity is unforgeable without the
//     hash. Provenance, not DRM: pixels can be screenshotted, but the
//     original can always be distinguished and re-proven.
export function mintDecorHash() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// hash (hex string) → 31-bit seed for the generators
export function seedFromHash(hash) {
  let h = 2166136261;
  const str = String(hash);
  for (let i = 0; i < str.length; i++) h = ((h ^ str.charCodeAt(i)) * 16777619) | 0;
  return (Math.abs(h) % 0x7fffffff) + 1;
}

/**
 * decorFromHash(theme, hash) → { family, seed, hash } — the full provenance
 * bundle. Same (theme, hash) always yields the same decoration everywhere
 * (screen, PPTX, PDF, re-render).
 *
 * Sprint 43 (fxhash lesson, version-stable variant): decisions consume NAMED
 * LANES from the hash (rand.js) — 'family' and 'seed' lanes are independent,
 * and future features (density, variant, accent…) get their own lanes
 * without disturbing existing decks' decoration.
 */
export function decorFromHash(theme, hash) {
  const R = makeHashRand(hash);
  const cluster = String(theme?.macroCluster || theme?.id || '').split('-')[0];
  const candidates = CLUSTER_AFFINITY[cluster] || ['flow-streams', 'weave-dashes'];
  return {
    family: R.pick('family', candidates),
    seed: R.int('seed', 1, 0x7ffffffe),
    hash,
  };
}
