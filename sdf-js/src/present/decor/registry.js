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
  // Sprint 73 (三级页面体系): hero — the family stops being a wash and
  // becomes the ARTWORK. Covers / agenda / section openers only; big white
  // 900-weight titles stay legible over it, body text would not.
  hero: { alpha: 0.42, alphaFill: 0.3, lineWidth: 2.2 },
  // Sprint 74 (user: 封面美感不足, 还是大部分蓝色): artwork — ArtBlocks-
  // grade opacity for the COVER CANVAS pipeline only (ink ground + painting
  // + overlay-style title with its own scrim; never over body text).
  artwork: { alpha: 0.9, alphaFill: 0.8, lineWidth: 2.6 },
};

// --- families ---------------------------------------------------------------

// flow-streams: long noise-driven streamlines (wind / fluid feel)
function drawFlowStreams(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const rand = seededRand(seed * 7 + 1);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const lines = Math.max(14, Math.round((w * h) / 18000));
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

// flow-ribbons: collision-respecting flow-field ribbons. RECIPE-ONLY port
// after Tyler Hobbs' "Fidenza" (Art Blocks Curated #78, CC BY-NC 4.0 — NC
// blocks code reuse, so this is an independent implementation of the
// published ideas; see docs/superpowers/artblocks-study/02-fidenza-hobbs.md).
// The three load-bearing idioms, reimplemented from the recipe:
//   - SEGMENT visibility: a ribbon blocked by another doesn't stop — it
//     goes invisible and re-emerges past the blocker (weaving illusion)
//   - sector-grid collision with curve-id exemption (self never collides)
//   - look-ahead minimum-segment precheck (no stubby fragments)
// plus a probability-weighted width spectrum (rare-thick, common-thin).
// Personality bundles (Sprint 49, the Golid lesson): parameters are picked
// as COHERENT SETS, not independently — calm/balanced/wild per family.
// FREEZE CONTRACT: 'balanced' is verbatim the pre-personality constants, and
// an absent personality resolves to 'balanced', so every existing mint
// renders pixel-identical.
const RIBBON_PERSONALITIES = {
  calm: {
    rows: 7,
    cols: 20,
    steps: 34,
    widths: [
      [8, 0.05],
      [5, 0.25],
      [3, 0.7],
    ],
  },
  balanced: {
    rows: 9,
    cols: 26,
    steps: 42,
    widths: [
      [10, 0.08],
      [6, 0.22],
      [3, 0.7],
    ],
  },
  wild: {
    rows: 12,
    cols: 34,
    steps: 56,
    widths: [
      [14, 0.12],
      [7, 0.3],
      [2, 0.58],
    ],
  },
};

function drawFlowRibbons(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const rand = seededRand(seed * 17 + 3);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const SECT = 12;
  const grid = Array.from({ length: SECT }, () => Array.from({ length: SECT }, () => []));
  const sectorsOf = (px, py, r) => {
    const out = [];
    const s0x = Math.max(0, Math.floor(((px - r - x) / w) * SECT));
    const s1x = Math.min(SECT - 1, Math.floor(((px + r - x) / w) * SECT));
    const s0y = Math.max(0, Math.floor(((py - r - y) / h) * SECT));
    const s1y = Math.min(SECT - 1, Math.floor(((py + r - y) / h) * SECT));
    for (let sy = s0y; sy <= s1y; sy++) for (let sx = s0x; sx <= s1x; sx++) out.push([sx, sy]);
    return out;
  };
  const collides = (px, py, r, id) => {
    for (const [sx, sy] of sectorsOf(px, py, r)) {
      for (const [qx, qy, qr, qid] of grid[sy][sx]) {
        if (qid !== id && Math.hypot(px - qx, py - qy) < r + qr + 2) return true;
      }
    }
    return false;
  };
  const inBounds = (px, py) => px >= x && px <= x + w && py >= y && py <= y + h;

  // gaussian-ish jitter via sum of uniforms
  const jitter = (amp) => (rand() + rand() - 1) * amp;
  const B = RIBBON_PERSONALITIES[personality] || RIBBON_PERSONALITIES.balanced;
  // probability-weighted width spectrum: rare thick, common thin
  const widthOf = () => {
    const t = rand();
    let acc = 0;
    for (const [width, p] of B.widths) {
      acc += p;
      if (t < acc) return width;
    }
    return B.widths[B.widths.length - 1][0];
  };

  // start points: rows + jitter, then shuffle
  const starts = [];
  for (let ry = y; ry <= y + h; ry += h / B.rows) {
    for (let rx = x - w * 0.1; rx <= x + w * 1.1; rx += w / B.cols) {
      starts.push([rx + jitter(w / 40), ry + jitter(h / 14)]);
    }
  }
  for (let i = starts.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [starts[i], starts[j]] = [starts[j], starts[i]];
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const STEP = 7;
  const LOOKAHEAD = 5;
  for (let id = 0; id < starts.length; id++) {
    const width = widthOf();
    const color = colors[id % colors.length];
    let [px, py] = starts[id];
    let segment = [];
    const flushSegment = () => {
      if (segment.length >= 2) {
        ctx.strokeStyle = rgba(color, P.alpha);
        ctx.lineWidth = width * P.lineWidth;
        ctx.beginPath();
        ctx.moveTo(segment[0][0], segment[0][1]);
        for (let k = 1; k < segment.length; k++) ctx.lineTo(segment[k][0], segment[k][1]);
        ctx.stroke();
      }
      segment = [];
    };
    for (let step = 0; step < B.steps; step++) {
      const ok = inBounds(px, py) && !collides(px, py, width, id);
      if (ok) {
        if (segment.length === 0) {
          // look-ahead: only open a segment if the next few steps are clear
          let lx = px;
          let ly = py;
          let clear = true;
          for (let a = 0; a < LOOKAHEAD; a++) {
            const ang = noise(lx * 0.0035, ly * 0.0035) * Math.PI * 4;
            lx += Math.cos(ang) * STEP;
            ly += Math.sin(ang) * STEP;
            if (!inBounds(lx, ly) || collides(lx, ly, width, id)) {
              clear = false;
              break;
            }
          }
          if (!clear) {
            const ang = noise(px * 0.0035, py * 0.0035) * Math.PI * 4;
            px += Math.cos(ang) * STEP;
            py += Math.sin(ang) * STEP;
            continue;
          }
        }
        segment.push([px, py]);
        for (const [sx, sy] of sectorsOf(px, py, width)) grid[sy][sx].push([px, py, width, id]);
      } else {
        flushSegment(); // blocked → close this visible segment, keep walking
      }
      const ang = noise(px * 0.0035, py * 0.0035) * Math.PI * 4;
      px += Math.cos(ang) * STEP;
      py += Math.sin(ang) * STEP;
    }
    flushSegment();
  }
  ctx.restore();
}

// block-mosaic: cellular-growth rectangle packing with neighbor-inherited
// color groups. RECIPE-ONLY port after Kjetil Golid's "Archetype" (Art
// Blocks Curated #23, CC BY-NC 4.0 — independent reimplementation of the
// published ideas; see docs/superpowers/artblocks-study/03-archetype-golid.md).
// Two idioms, rewritten from the recipe:
//   - apparatus-style growth: blocks EXTEND horizontally/vertically or
//     start fresh, probability-driven — packed-but-irregular panels grown
//     from a state machine, not sliced from the canvas
//   - group color mode: a new block inherits its neighbor's color with
//     probability → contiguous color patches with crisp borders
function drawBlockMosaic(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const rand = seededRand(seed * 23 + 11);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const COLS = 16;
  const ROWS = 9;
  const cw = w / COLS;
  const chh = h / ROWS;
  // cell ownership grid: growth state machine
  const owner = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
  const blockColor = [];
  let nextId = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (owner[r][c] !== -1) continue;
      const left = c > 0 ? owner[r][c - 1] : -1;
      const up = r > 0 ? owner[r - 1][c] : -1;
      const t = rand();
      if (left !== -1 && t < 0.42) {
        owner[r][c] = left; // extend horizontally
      } else if (up !== -1 && t < 0.72) {
        owner[r][c] = up; // extend vertically
      } else {
        const id = nextId++;
        owner[r][c] = id;
        // group color mode: inherit a neighbor's color with probability
        const inheritFrom = rand() < 0.55 ? (left !== -1 ? left : up) : -1;
        blockColor[id] =
          inheritFrom !== -1 ? blockColor[inheritFrom] : colors[Math.floor(rand() * colors.length)];
      }
    }
  }
  // draw per-cell (merged visually by shared color + hairline borders)
  ctx.save();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = owner[r][c];
      const color = blockColor[id];
      // sparse fill: only a fraction of blocks get filled, id-hashed so a
      // whole block fills or not together
      const fillGate = (id * 2654435761) % 100;
      if (fillGate < 34) {
        ctx.fillStyle = rgba(color, P.alphaFill);
        ctx.fillRect(x + c * cw, y + r * chh, cw + 0.5, chh + 0.5);
      }
      ctx.strokeStyle = rgba(color, P.alpha * 0.9);
      ctx.lineWidth = P.lineWidth * 0.8;
      ctx.strokeRect(x + c * cw, y + r * chh, cw, chh);
    }
  }
  ctx.restore();
}

// wash-flow: shape-anchored flow advection ("watercolor"). RECIPE-ONLY port
// after "Watercolor Dreams" (NumbersInMotion, Art Blocks Curated #59,
// CC BY-NC 4.0 — independent reimplementation; see docs/superpowers/
// artblocks-study/04-watercolor-dreams.md). Two idioms, rewritten:
//   - nodes sampled on a SOURCE SHAPE (a band across the slide) are
//     advected through a noise flow field, drawing a faint stroke each
//     step — the wash is the accumulated smear of a shape that remembers
//     its origin ("有出身的雾")
//   - color sampled from a CONTINUOUS interpolation over the theme colors
//     (recipe-adaptation of the cosine-palette idea) → seamless gradients
function lerpColor3(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}
function continuousPalette(colors, t) {
  if (colors.length === 1) return colors[0];
  const x = Math.min(0.9999, Math.max(0, t)) * (colors.length - 1);
  const i = Math.floor(x);
  return lerpColor3(colors[i], colors[i + 1], x - i);
}

const WASH_PERSONALITIES = {
  calm: { nodes: 70, steps: 20, step: 5 },
  balanced: { nodes: 90, steps: 26, step: 6 },
  wild: { nodes: 130, steps: 36, step: 7 },
};

function drawWashFlow(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const rand = seededRand(seed * 29 + 13);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  // source shape: a gently sloped band across the slide (seeded position)
  const bandY = y + h * (0.25 + rand() * 0.5);
  const slope = (rand() - 0.5) * h * 0.4;
  const B = WASH_PERSONALITIES[personality] || WASH_PERSONALITIES.balanced;
  const NODES = B.nodes;
  const STEPS = B.steps;
  const STEP = B.step;
  ctx.save();
  ctx.lineCap = 'round';
  const nodes = [];
  for (let i = 0; i < NODES; i++) {
    const t = i / (NODES - 1);
    nodes.push({
      px: x + t * w,
      py: bandY + slope * (t - 0.5) * 2 + (rand() - 0.5) * 8,
      t,
    });
  }
  const washAlpha = P.alpha * 0.55; // accumulation does the work
  for (let s = 0; s < STEPS; s++) {
    for (const n of nodes) {
      const ang = noise(n.px * 0.003, n.py * 0.003) * Math.PI * 2 + Math.PI * 0.25;
      const nx = n.px + Math.cos(ang) * STEP;
      const ny = n.py + Math.sin(ang) * STEP;
      if (nx >= x && nx <= x + w && ny >= y && ny <= y + h) {
        const c = continuousPalette(colors, n.t);
        ctx.strokeStyle = rgba(c, washAlpha);
        ctx.lineWidth = P.lineWidth * (5 - (4 * s) / STEPS); // thick → thin as it dries
        ctx.beginPath();
        ctx.moveTo(n.px, n.py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
      n.px = nx;
      n.py = ny;
    }
  }
  ctx.restore();
}

// strata-lines: noise-displaced parallel line bundles (cloud bands / strata).
// RECIPE-ONLY port after Aaron Penne's "Apparitions" (Art Blocks Curated
// #28, CC BY-NC 4.0 — independent reimplementation; see docs/superpowers/
// artblocks-study/05-apparitions-penne.md). Three idioms, rewritten:
//   - a bundle of horizontal curves, each vertically displaced by a noise
//     field (band vs wave personalities via sampling mode)
//   - banded color: every N rows re-pick a color pair, lerp INSIDE the
//     band, jump BETWEEN bands — the color anatomy of cloud layers
//   - shadow stroke: a faint dark offset understroke → cheap depth
function drawStrataLines(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const rand = seededRand(seed * 41 + 19);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const ROWSN = 34;
  const COLS = 26;
  const AMP = h * (0.06 + rand() * 0.08);
  const FREQ = 0.004 + rand() * 0.004;
  const BAND = 4 + Math.floor(rand() * 5);
  let c1 = colors[Math.floor(rand() * colors.length)];
  let c2 = colors[Math.floor(rand() * colors.length)];
  ctx.save();
  ctx.lineCap = 'round';
  for (let r = 0; r < ROWSN; r++) {
    if (r % BAND === 0) {
      c1 = colors[Math.floor(rand() * colors.length)];
      c2 = colors[Math.floor(rand() * colors.length)];
    }
    const t = (r % BAND) / BAND;
    const col = lerpColor3(c1, c2, t);
    const ry = y + (r / (ROWSN - 1)) * h;
    const pts = [];
    for (let ci = 0; ci <= COLS; ci++) {
      const px = x + (ci / COLS) * w;
      const dy = (noise(px * FREQ, r * 0.09) - 0.5) * 2 * AMP;
      pts.push([px, ry + dy]);
    }
    // shadow understroke (cheap depth), then the main stroke
    for (const [style, width, off] of [
      [rgba(palette.silhouetteColor || [20, 20, 20], P.alpha * 0.35), P.lineWidth, 2.5],
      [rgba(col, P.alpha), P.lineWidth * 1.4, 0],
    ]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1] + off);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1] + off);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// sediment-layers: stacked noise horizons with front-occludes-back filling
// (geological cross-section / mountain silhouettes). RECIPE-ONLY port after
// Eko33's "Neural Sediments" (Art Blocks Curated #418, CC BY-NC 4.0 —
// independent lightweight reimplementation: painter-order + bg-blended
// fills stand in for its polygon-boolean occlusion; see docs/superpowers/
// artblocks-study/06-neural-sediments-eko33.md). The fill/line dual of
// strata-lines.
const SEDIMENT_PERSONALITIES = {
  calm: { minLayers: 4, layerSpan: 2 },
  balanced: { minLayers: 5, layerSpan: 3 },
  wild: { minLayers: 7, layerSpan: 3 },
};

function drawSedimentLayers(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const rand = seededRand(seed * 53 + 29);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const bg = palette.bg || [248, 246, 240];
  const SB = SEDIMENT_PERSONALITIES[personality] || SEDIMENT_PERSONALITIES.balanced;
  const LAYERS = SB.minLayers + Math.floor(rand() * SB.layerSpan);
  const COLS = 40;
  ctx.save();
  // back → front; each layer's fill is the theme color heavily blended
  // toward bg (opaque-ish wash) so front layers occlude back ones
  for (let li = 0; li < LAYERS; li++) {
    const t = li / (LAYERS - 1);
    const baseY = y + h * (0.35 + 0.6 * t);
    const amp = h * (0.1 + 0.12 * (1 - t));
    const color = colors[li % colors.length];
    // blend factor: subtle keeps fills faint; front layers slightly stronger
    const mix = (P.alphaFill + t * P.alphaFill) * 1.6;
    const fill = lerpColor3(bg, color, Math.min(0.55, mix * 2.2));
    ctx.fillStyle = rgba(fill, 0.92); // near-opaque wash → occlusion
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, baseY);
    for (let ci = 0; ci <= COLS; ci++) {
      const px = x + (ci / COLS) * w;
      const dy = (noise(px * 0.0045, li * 3.7) - 0.5) * 2 * amp;
      ctx.lineTo(px, baseY + dy);
    }
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    // hairline ridge on top of each layer
    ctx.strokeStyle = rgba(color, P.alpha);
    ctx.lineWidth = P.lineWidth;
    ctx.beginPath();
    for (let ci = 0; ci <= COLS; ci++) {
      const px = x + (ci / COLS) * w;
      const dy = (noise(px * 0.0045, li * 3.7) - 0.5) * 2 * amp;
      if (ci === 0) ctx.moveTo(px, baseY + dy);
      else ctx.lineTo(px, baseY + dy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ink-scribble: noise-Lissajous closed scribbles with multi-pass vertex
// jitter (hand-drawn ink feel). RECIPE-ONLY port after Iskra Velitchkova's
// "INK" (Art Blocks Curated #497, CC BY-NC-SA 4.0 — independent
// reimplementation at deck-friendly density; see docs/superpowers/
// artblocks-study/07-ink-velitchkova.md). Two idioms, rewritten:
//   - a closed parametric loop whose radius is noise-modulated on two
//     phases (sin/cos) — the hand-drawn degeneration of a circle
//   - the ink "rough edge": the SAME curve drawn twice with independent
//     per-vertex jitter — simulating a hand by simulating error statistics
function drawInkScribble(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const rand = seededRand(seed * 61 + 37);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const COUNT = 8 + Math.floor(rand() * 7);
  const STEP = 0.02; // ~314 vertices per pass — deck-budget density
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < COUNT; i++) {
    // corner-weighted placement (keep slide centers clear)
    const u = rand();
    const v = rand();
    const cx = x + (u < 0.5 ? u * u * 2 : 1 - (1 - u) * (1 - u) * 2) * w;
    const cy = y + (v < 0.5 ? v * v * 2 : 1 - (1 - v) * (1 - v) * 2) * h;
    const ampX = 20 + rand() * Math.min(w, h) * 0.11;
    const ampY = 20 + rand() * Math.min(w, h) * 0.11;
    const freq = 0.6 + rand() * 1.8;
    const phase = rand() * 100;
    const color = colors[i % colors.length];
    ctx.strokeStyle = rgba(color, P.alpha);
    ctx.lineWidth = P.lineWidth * 0.9;
    for (let pass = 0; pass < 2; pass++) {
      const jitterAmp = pass === 0 ? 1.5 : 4;
      ctx.beginPath();
      let first = true;
      for (let e = 0; e <= Math.PI * 2 + 1e-9; e += STEP) {
        const rx = noise(phase + Math.sin(e) * freq, phase) * ampX;
        const ry = noise(phase, phase + Math.cos(e) * freq) * ampY;
        const px = cx + rx * 2 - ampX + (rand() - 0.5) * jitterAmp;
        const py = cy + ry * 2 - ampY + (rand() - 0.5) * jitterAmp;
        if (first) {
          ctx.moveTo(px, py);
          first = false;
        } else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

// light-edges: box edges as glowing gradient lines. RECIPE-ONLY port (2D
// canvas approximation) after Zach Lieberman's "Box Light Studies" (Art
// Blocks Curated #499, CC BY-NC 4.0). The original's soft light lives in a
// GPU jump-flood distance field — that recipe belongs to the 3D end's
// shader corpus (see docs/superpowers/artblocks-study/
// 08-box-light-studies-lieberman.md); here we take the COMPOSITION (edges
// as light sources) and fake the glow with layered strokes:
//   wide × faint → narrow × brighter, per edge, two colors interpolated
//   along the segment.
function drawLightEdges(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const rand = seededRand(seed * 67 + 41);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const BOXES = 4 + Math.floor(rand() * 3);
  ctx.save();
  ctx.lineCap = 'round';
  for (let b = 0; b < BOXES; b++) {
    const cx = x + rand() * w;
    const cy = y + rand() * h;
    const size = Math.min(w, h) * (0.1 + rand() * 0.16);
    const ang = rand() * Math.PI;
    const depth = size * (0.4 + rand() * 0.4);
    const dx = Math.cos(ang + Math.PI / 5) * depth;
    const dy = Math.sin(ang + Math.PI / 5) * depth * 0.5;
    // front face corners (rotated square)
    const corners = [];
    for (let k = 0; k < 4; k++) {
      const a = ang + (k * Math.PI) / 2;
      corners.push([cx + Math.cos(a) * size, cy + Math.sin(a) * size]);
    }
    const edges = [];
    for (let k = 0; k < 4; k++) {
      edges.push([corners[k], corners[(k + 1) % 4]]); // front face
      edges.push([corners[k], [corners[k][0] + dx, corners[k][1] + dy]]); // depth edge
      edges.push([
        [corners[k][0] + dx, corners[k][1] + dy],
        [corners[(k + 1) % 4][0] + dx, corners[(k + 1) % 4][1] + dy],
      ]); // back face
    }
    const cA = colors[b % colors.length];
    const cB = colors[(b + 1) % colors.length];
    for (const [[x1, y1], [x2, y2]] of edges) {
      // two-color edge: draw as two halves meeting at the midpoint
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      for (const [color, sx, sy, ex, ey] of [
        [cA, x1, y1, mx, my],
        [cB, mx, my, x2, y2],
      ]) {
        // layered glow: wide-faint → narrow-brighter
        for (const [width, alpha] of [
          [P.lineWidth * 6, P.alpha * 0.25],
          [P.lineWidth * 3, P.alpha * 0.5],
          [P.lineWidth * 1.2, P.alpha],
        ]) {
          ctx.strokeStyle = rgba(color, alpha);
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }
    }
  }
  ctx.restore();
}

// nib-flourish: calligraphic flourish curves — stroke width modulated by
// direction-vs-nib-angle and a travelling noise "breath", rendered as
// filled ribbon polygons. RECIPE-ONLY port after the StyledPolyline nib
// renderer in Golan Levin's "Cytographia" (Art Blocks Curated #487,
// CC BY-NC 4.0 — independent reimplementation; see docs/superpowers/
// artblocks-study/09-cytographia-levin.md). Calligraphy is not the shape
// of the curve — it is the FUNCTION OF WIDTH.
function drawNibFlourish(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const rand = seededRand(seed * 71 + 47);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const COUNT = 5 + Math.floor(rand() * 4);
  const nibAngle = rand() * Math.PI; // one pen per artwork
  ctx.save();
  for (let i = 0; i < COUNT; i++) {
    // corner/edge-weighted anchor
    const u = rand();
    const v = rand();
    const cx = x + (u < 0.5 ? u * u * 2 : 1 - (1 - u) * (1 - u) * 2) * w;
    const cy = y + (v < 0.5 ? v * v * 2 : 1 - (1 - v) * (1 - v) * 2) * h;
    const len = 80 + rand() * Math.min(w, h) * 0.55;
    const baseW = 5 + rand() * 8;
    const phase = rand() * 100;
    const color = colors[i % colors.length];
    // trace the flourish path
    const pts = [];
    let px = cx;
    let py = cy;
    let ang = rand() * Math.PI * 2;
    const steps = 26;
    for (let sIdx = 0; sIdx <= steps; sIdx++) {
      pts.push([px, py, ang]);
      ang += (noise(phase + sIdx * 0.18, phase) - 0.5) * 1.1;
      px += Math.cos(ang) * (len / steps);
      py += Math.sin(ang) * (len / steps);
    }
    // width per point: nib factor × noise breath × taper at both ends
    const left = [];
    const right = [];
    for (let k = 0; k < pts.length; k++) {
      const [qx, qy, qa] = pts[k];
      const t = k / (pts.length - 1);
      const taper = Math.sin(Math.PI * t); // pointed ends
      const nib = 0.25 + 0.75 * Math.abs(Math.sin(qa - nibAngle));
      const breath = 0.6 + 0.4 * noise(phase + k * 0.3, phase + 50);
      const half = (baseW * nib * breath * taper) / 2;
      const nx = Math.cos(qa + Math.PI / 2);
      const ny = Math.sin(qa + Math.PI / 2);
      left.push([qx + nx * half, qy + ny * half]);
      right.push([qx - nx * half, qy - ny * half]);
    }
    ctx.fillStyle = rgba(color, Math.min(0.22, P.alpha * 2.2));
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let k = 1; k < left.length; k++) ctx.lineTo(left[k][0], left[k][1]);
    for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k][0], right[k][1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// --- OKLab color space (Sprint 53, the while-true lesson) --------------------
// RGB-space lerp passes through muddy midtones; OKLab lerp is perceptually
// uniform. Available to NEW families (frozen families keep their RGB lerp
// per the freeze discipline). Conversion after Björn Ottosson's reference.
function srgbToLinear(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linearToSrgb(x) {
  const v = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
}
function rgbToOklab([r, g, b]) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s2 = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2,
  ];
}
function oklabToRgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s2 = s_ * s_ * s_;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2),
  ];
}
export function lerpColorOklab(c1, c2, t) {
  const a = rgbToOklab(c1);
  const b = rgbToOklab(c2);
  return oklabToRgb([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

// hex-lattice: hexagonal tiling with OKLab-graded sparse fills. RECIPE-ONLY
// port after Lars Wander's "while true" (Art Blocks Curated #498,
// CC BY-NC-SA 4.0 — independent reimplementation; see docs/superpowers/
// artblocks-study/10-while-true-wander.md). Two idioms: cubic→cartesian
// hex math (x' = √3(q + r/2), y' = 1.5r) and perceptually-uniform OKLab
// gradients across the lattice.
function drawHexLattice(ctx, { palette, seed, x, y, w, h, intensity }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const noise = noise2D(seed);
  const rand = seededRand(seed * 83 + 59);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const cA = colors[Math.floor(rand() * colors.length)];
  const cB = colors[(Math.floor(rand() * colors.length) + 1) % colors.length];
  const R = 16 + rand() * 10; // hex radius
  const RT3 = Math.sqrt(3);
  const gradAngle = rand() * Math.PI;
  const cosG = Math.cos(gradAngle);
  const sinG = Math.sin(gradAngle);
  const diag = Math.hypot(w, h);
  ctx.save();
  ctx.lineWidth = P.lineWidth * 0.8;
  const qMax = Math.ceil(w / (RT3 * R)) + 2;
  const rMax = Math.ceil(h / (1.5 * R)) + 2;
  for (let rr = -1; rr <= rMax; rr++) {
    for (let q = -1; q <= qMax; q++) {
      const cx = x + RT3 * R * (q + (rr % 2 === 0 ? 0 : 0.5));
      const cy = y + 1.5 * R * rr;
      const gate = noise(cx * 0.004, cy * 0.004);
      if (gate > 0.52) continue; // sparse patches
      // OKLab gradient along a seeded direction
      const t = Math.max(
        0,
        Math.min(1, ((cx - x) * cosG + (cy - y) * sinG) / diag + 0.5 - 0.5 * (cosG + sinG) * 0.5),
      );
      const col = lerpColorOklab(cA, cB, t);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const px = cx + Math.cos(a) * R * 0.92;
        const py = cy + Math.sin(a) * R * 0.92;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if ((q + rr * 3) % 4 === 0) {
        ctx.fillStyle = rgba(col, P.alphaFill);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(col, P.alpha);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// drift-web: noise-drifted particles leave faint trail dots, then a second
// pass connects near neighbors inside a distance BAND. RECIPE-ONLY port after
// Olga Fradina's "Naïve" (Art Blocks Curated #483, CC BY-NC 4.0 — independent
// reimplementation; see docs/superpowers/artblocks-study/13-naive-fradina.md).
// Idioms taken as ideas: asymmetric twin noise (nX from noise(x,y), nY from
// the SWAPPED noise(y,x) — decorrelated axes from one field); a noise
// OPERATOR zoo applied to the field (two-scale max, quantize); connection
// rule with BOTH minDist and maxDist (the min bound is what keeps the web
// airy instead of clumped); probabilistic per-node visibility.
const WEB_PERSONALITIES = {
  calm: {
    area: 5800,
    noiseScale: 0.004,
    speed: 5,
    steps: 24,
    quantize: 0,
    maxOfNoises: false,
    minDist: 18,
    maxDist: 68,
    visible: 0.6,
  },
  balanced: {
    area: 5200,
    noiseScale: 0.006,
    speed: 6,
    steps: 30,
    quantize: 0,
    maxOfNoises: true,
    minDist: 14,
    maxDist: 74,
    visible: 0.62,
  },
  wild: {
    area: 4200,
    noiseScale: 0.009,
    speed: 8,
    steps: 36,
    quantize: 5,
    maxOfNoises: true,
    minDist: 10,
    maxDist: 92,
    visible: 0.85,
  },
};

function drawDriftWeb(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = WEB_PERSONALITIES[personality] || WEB_PERSONALITIES.balanced;
  const rand = seededRand(seed * 31 + 7);
  const nA = noise2D(seed);
  const nB = noise2D(seed + 999);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const count = Math.max(24, Math.round((w * h) / B.area));
  const pts = [];
  for (let i = 0; i < count; i++) pts.push([x + rand() * w, y + rand() * h]);
  const sc = B.noiseScale;
  const field = (px, py) => {
    let nx = nA(px * sc, py * sc);
    let ny = nA(py * sc, px * sc); // swapped-coordinate twin (Naïve idiom)
    if (B.maxOfNoises) {
      nx = Math.max(nx, nB(px * sc * 3, py * sc * 3));
      ny = Math.max(ny, nB(py * sc * 3, px * sc * 3));
    }
    if (B.quantize) {
      nx = Math.round(nx * B.quantize) / B.quantize;
      ny = Math.round(ny * B.quantize) / B.quantize;
    }
    return [(nx - 0.5) * 2, (ny - 0.5) * 2];
  };
  ctx.save();
  ctx.lineCap = 'round';
  // phase 1: drift, depositing a faint dotted trail (the paper-grain bed)
  for (let s = 0; s < B.steps; s++) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const v = field(p[0], p[1]);
      p[0] += v[0] * B.speed;
      p[1] += v[1] * B.speed;
      if (p[0] < x) p[0] += w;
      if (p[0] > x + w) p[0] -= w;
      if (p[1] < y) p[1] += h;
      if (p[1] > y + h) p[1] -= h;
      if (s % 2 === 0) {
        ctx.fillStyle = rgba(colors[i % colors.length], P.alphaFill * 0.6);
        ctx.fillRect(p[0], p[1], 1.2, 1.2);
      }
    }
  }
  // phase 2: distance-band web over the settled positions
  ctx.lineWidth = P.lineWidth * 0.8;
  for (let i = 0; i < pts.length; i++) {
    if (rand() > B.visible) continue;
    let linked = false;
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d > B.minDist && d < B.maxDist) {
        // gallery-instrument tune (Sprint 54): web lines carried too little
        // contrast next to sibling whisper families — full P.alpha, wider band
        ctx.strokeStyle = rgba(colors[i % colors.length], P.alpha * 1.15);
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.stroke();
        linked = true;
      }
    }
    if (linked) {
      ctx.fillStyle = rgba(colors[i % colors.length], P.alpha * 1.3);
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// cargo-dashes: stacked rectangular blocks, each textured by one painter from
// a small dictionary of dashed-line fills. RECIPE-ONLY port after Kim
// Asendorf's "Cargo" (Art Blocks Curated #426, CC BY-NC 4.0 — independent
// reimplementation; see docs/superpowers/artblocks-study/17-cargo-asendorf.md).
// Idioms taken as ideas: a PAINTER DICTIONARY (each entry fills a rect with
// one dash discipline), power-of-two line spacing (yStep = 2^k keeps mixed
// blocks rhythmically compatible), integer dash patterns [a, b] with a,b in
// 1..8 (container-marking feel). The GPU motion pass of the original is not
// ported — static composition only.
const CARGO_PERSONALITIES = {
  calm: { rows: 3, minBlocks: 2, maxBlocks: 3, painters: 2 },
  balanced: { rows: 4, minBlocks: 2, maxBlocks: 4, painters: 3 },
  wild: { rows: 5, minBlocks: 3, maxBlocks: 6, painters: 4 },
};

function drawCargoDashes(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = CARGO_PERSONALITIES[personality] || CARGO_PERSONALITIES.balanced;
  const rand = seededRand(seed * 53 + 11);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const painters = [
    // horizontal dashed lines, power-of-two spacing
    (bx, by, bw, bh, col) => {
      const yStep = Math.pow(2, 1 + Math.floor(rand() * 3)) * 2;
      const dash = [1 + Math.floor(rand() * 8), 1 + Math.floor(rand() * 8)];
      ctx.setLineDash(dash);
      for (let ly = by + yStep / 2; ly < by + bh; ly += yStep) {
        ctx.strokeStyle = rgba(col, P.alpha);
        ctx.beginPath();
        ctx.moveTo(bx, ly);
        ctx.lineTo(bx + bw, ly);
        ctx.stroke();
      }
    },
    // vertical dashed lines
    (bx, by, bw, bh, col) => {
      const xStep = Math.pow(2, 1 + Math.floor(rand() * 3)) * 2;
      const dash = [1 + Math.floor(rand() * 8), 1 + Math.floor(rand() * 8)];
      ctx.setLineDash(dash);
      for (let lx = bx + xStep / 2; lx < bx + bw; lx += xStep) {
        ctx.strokeStyle = rgba(col, P.alpha);
        ctx.beginPath();
        ctx.moveTo(lx, by);
        ctx.lineTo(lx, by + bh);
        ctx.stroke();
      }
    },
    // sparse dotted rows (long gaps)
    (bx, by, bw, bh, col) => {
      const yStep = Math.pow(2, 2 + Math.floor(rand() * 2)) * 2;
      const dot = 1 + Math.floor(rand() * 2);
      ctx.setLineDash([dot, dot * (3 + Math.floor(rand() * 4))]);
      for (let ly = by + yStep / 2; ly < by + bh; ly += yStep) {
        ctx.strokeStyle = rgba(col, P.alpha);
        ctx.beginPath();
        ctx.moveTo(bx, ly);
        ctx.lineTo(bx + bw, ly);
        ctx.stroke();
      }
    },
    // faint solid fill + frame (container face)
    (bx, by, bw, bh, col) => {
      ctx.setLineDash([]);
      ctx.fillStyle = rgba(col, P.alphaFill * 0.7);
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = rgba(col, P.alpha);
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    },
  ].slice(0, B.painters);
  ctx.save();
  ctx.lineWidth = P.lineWidth * 0.9;
  const rowH = h / B.rows;
  for (let r = 0; r < B.rows; r++) {
    const by = y + r * rowH;
    const nBlocks = B.minBlocks + Math.floor(rand() * (B.maxBlocks - B.minBlocks + 1));
    // random split of the row width into nBlocks with gaps
    const cuts = [0];
    for (let i = 1; i < nBlocks; i++) cuts.push(rand());
    cuts.sort((a, b) => a - b);
    cuts.push(1);
    for (let i = 0; i < nBlocks; i++) {
      const bx = x + cuts[i] * w + 4;
      const bw = (cuts[i + 1] - cuts[i]) * w - 8;
      if (bw < 12) continue;
      const painter = painters[Math.floor(rand() * painters.length)];
      const col = colors[Math.floor(rand() * colors.length)];
      painter(bx, by + 5, bw, rowH - 10, col);
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

// folded-screens: layered screens of dense parallel lines, each screen broken
// by a few vertical creases where direction and tone shift — the fold reads
// as pseudo-3D facets. RECIPE-ONLY port after Thomas Lin Pedersen's "Screens"
// (Art Blocks Curated #255, CC BY-NC 4.0 — independent reimplementation; see
// docs/superpowers/artblocks-study/19-screens-pedersen.md). Idioms taken as
// ideas: a screen = one dense line raster treated as a single object; creases
// segment it into facets, each facet gets its own slope and brightness (the
// fold illusion is per-facet shading, not perspective math); 2-3 translucent
// screens layered → interference where they cross.
const SCREEN_PERSONALITIES = {
  calm: { screens: 2, lineGap: 7, creases: 1, slopeMax: 0.12, toneSpread: 0.35 },
  balanced: { screens: 2, lineGap: 5.5, creases: 2, slopeMax: 0.2, toneSpread: 0.5 },
  wild: { screens: 3, lineGap: 4.5, creases: 3, slopeMax: 0.32, toneSpread: 0.7 },
};

function drawFoldedScreens(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = SCREEN_PERSONALITIES[personality] || SCREEN_PERSONALITIES.balanced;
  const rand = seededRand(seed * 71 + 29);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  ctx.save();
  ctx.lineCap = 'butt';
  for (let sIdx = 0; sIdx < B.screens; sIdx++) {
    const col = colors[sIdx % colors.length];
    // creases split [0,1] into facets; each facet has slope + tone
    const cuts = [0];
    for (let i = 0; i < B.creases; i++) cuts.push(0.15 + rand() * 0.7);
    cuts.sort((a, b) => a - b);
    cuts.push(1);
    const facets = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      facets.push({
        x0: cuts[i],
        x1: cuts[i + 1],
        slope: (rand() * 2 - 1) * B.slopeMax,
        tone: 1 - B.toneSpread * rand(),
      });
    }
    const gap = B.lineGap * (0.9 + rand() * 0.4);
    const phase = rand() * gap;
    // each screen-line is a polyline: y offset accumulates per facet slope
    for (let ly = y - h * 0.3 + phase; ly < y + h * 1.3; ly += gap) {
      let py = ly;
      for (const f of facets) {
        const fx0 = x + f.x0 * w;
        const fx1 = x + f.x1 * w;
        const fy = py + (fx1 - fx0) * f.slope;
        ctx.strokeStyle = rgba(col, P.alpha * f.tone);
        ctx.lineWidth = P.lineWidth * 0.7;
        ctx.beginPath();
        ctx.moveTo(fx0, py);
        ctx.lineTo(fx1, fy);
        ctx.stroke();
        py = fy;
      }
    }
  }
  ctx.restore();
}

// river-courses: a meandering river migrating across the region — bends
// amplify by local curvature, loops that pinch shut are CUT OFF as oxbow
// lakes, and abandoned channels stay as a faint history. RECIPE-ONLY port
// after Robert Hodgin's "Ancient Courses of Fictional Rivers" (Art Blocks
// Curated #284, CC BY-NC 4.0 — independent reimplementation; see docs/
// superpowers/artblocks-study/41-ancient-courses-hodgin.md). Idioms taken
// as ideas: meandering = curvature-proportional normal migration + uniform
// resampling; the oxbow cutoff (splice the loop when two distant-in-index
// points touch) is what makes it a river, not a wiggle; drawing the CHANNEL
// HISTORY (faded ancient courses) tells geological time.
const RIVER_PERSONALITIES = {
  calm: { iters: 90, migrate: 2.2, snapEvery: 30, cutoff: 14 },
  balanced: { iters: 150, migrate: 3.0, snapEvery: 40, cutoff: 12 },
  wild: { iters: 220, migrate: 3.8, snapEvery: 55, cutoff: 10 },
};

function drawRiverCourses(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = RIVER_PERSONALITIES[personality] || RIVER_PERSONALITIES.balanced;
  const rand = seededRand(seed * 59 + 3);
  const noise = noise2D(seed + 17);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const col = colors[Math.floor(rand() * colors.length)];
  const oxCol = colors[(Math.floor(rand() * colors.length) + 1) % colors.length];
  // the river crosses horizontally with a gentle seeded set
  const y0 = y + (0.3 + rand() * 0.4) * h;
  const amp0 = h * (0.05 + rand() * 0.1);
  const phase = rand() * 10;
  let pts = [];
  const N0 = Math.max(24, Math.round(w / 14));
  for (let i = 0; i < N0; i++) {
    const t = i / (N0 - 1);
    pts.push([x + t * w, y0 + Math.sin(phase + t * Math.PI * (2 + rand())) * amp0]);
  }
  const seg = 11;
  const history = [];
  const oxbows = [];
  const MAX_PTS = 700; // meanders lengthen exponentially — hard budget
  for (let it = 0; it < B.iters && pts.length < MAX_PTS; it++) {
    // curvature migration on the LOW frequency: direction away from the
    // ±L-window chord midpoint. (First attempt used the immediate-neighbor
    // midpoint — that amplifies the highest frequency and yields sawtooth
    // tangles, not meanders. Rivers bend at reach scale, not point scale.)
    const L2 = 5;
    const next = [pts[0]];
    for (let i = 1; i + 1 < pts.length; i++) {
      const [px, py] = pts[i];
      const a2 = pts[Math.max(0, i - L2)];
      const b2 = pts[Math.min(pts.length - 1, i + L2)];
      let dx = px - (a2[0] + b2[0]) / 2;
      let dy = py - (a2[1] + b2[1]) / 2;
      const d = Math.hypot(dx, dy);
      if (d > 0.01) {
        dx /= d;
        dy /= d;
      } else {
        // straight reach: nudge from the noise field so meanders can seed
        const a = noise(px * 0.006, py * 0.006) * Math.PI * 2;
        dx = Math.cos(a);
        dy = Math.sin(a);
      }
      const k = Math.min(1, d / (seg * L2 * 0.4));
      const margin = h * 0.06; // soft valley walls, not a 6px cliff
      next.push([
        px + dx * B.migrate * (0.15 + k),
        Math.max(y + margin, Math.min(y + h - margin, py + dy * B.migrate * (0.15 + k))),
      ]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    // curvature diffusion: a light 3-point kernel keeps the channel smooth
    for (let i = 1; i + 1 < pts.length; i++) {
      pts[i] = [
        0.25 * pts[i - 1][0] + 0.5 * pts[i][0] + 0.25 * pts[i + 1][0],
        0.25 * pts[i - 1][1] + 0.5 * pts[i][1] + 0.25 * pts[i + 1][1],
      ];
    }
    // uniform resample
    const res = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const last = res[res.length - 1];
      const d = Math.hypot(pts[i][0] - last[0], pts[i][1] - last[1]);
      if (d > seg * 1.5) res.push([(last[0] + pts[i][0]) / 2, (last[1] + pts[i][1]) / 2]);
      if (d > seg * 0.5) res.push(pts[i]);
    }
    pts = res;
    // oxbow cutoff: index-distant points that pinch together (windowed —
    // a pinch is always a local loop, no need to scan the far bank)
    for (let i = 0; i + 8 < pts.length; i++) {
      const jMax = Math.min(pts.length, i + 90);
      for (let j = i + 8; j < jMax; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        if (d < B.cutoff) {
          oxbows.push(pts.slice(i, j + 1));
          pts = pts.slice(0, i + 1).concat(pts.slice(j));
          i = pts.length; // one cutoff per iteration is plenty
          break;
        }
      }
    }
    if (it % B.snapEvery === B.snapEvery - 1 && it < B.iters - 1) {
      history.push(pts.map((p2) => [p2[0], p2[1]]));
    }
  }
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const trace = (line) => {
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (let i = 1; i < line.length; i++) ctx.lineTo(line[i][0], line[i][1]);
  };
  // ancient courses: older = fainter (geological time)
  for (let hIdx = 0; hIdx < history.length; hIdx++) {
    ctx.strokeStyle = rgba(col, P.alpha * (0.25 + (0.35 * hIdx) / history.length));
    ctx.lineWidth = P.lineWidth * 0.6;
    trace(history[hIdx]);
    ctx.stroke();
  }
  // oxbow lakes: the abandoned loops, in the second color
  for (const ox of oxbows) {
    ctx.strokeStyle = rgba(oxCol, P.alpha * 0.9);
    ctx.lineWidth = P.lineWidth * 0.8;
    trace(ox);
    ctx.stroke();
  }
  // the living river: twin banks
  const bank = (off) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const nxt = pts[Math.min(pts.length - 1, i + 1)];
      const dx = nxt[0] - prev[0];
      const dy = nxt[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      const px2 = pts[i][0] + (-dy / len) * off;
      const py2 = pts[i][1] + (dx / len) * off;
      if (i === 0) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.stroke();
  };
  ctx.strokeStyle = rgba(col, P.alpha * 1.4);
  ctx.lineWidth = P.lineWidth;
  bank(2.2);
  bank(-2.2);
  ctx.restore();
}

// peg-wraps: a grid of pegs and one string wrapped around a subset of them
// — tangent lines between pegs, arcs where the string bends around a peg.
// RECIPE-ONLY port after Dmitri Cherniak's "Ringers" (Art Blocks Curated
// #13, CC BY-NC 4.0 — independent reimplementation; see docs/superpowers/
// artblocks-study/38-ringers-cherniak.md). Idioms taken as ideas: the
// composition IS the wrap order (a permutation of pegs); alternating the
// wrap side per visited peg weaves the string; pegs are drawn as plain
// dots so the string carries all the drama.
const PEG_PERSONALITIES = {
  calm: { cols: 4, rows: 3, visits: 6, weave: false, pegR: 10 },
  balanced: { cols: 5, rows: 4, visits: 9, weave: true, pegR: 9 },
  wild: { cols: 7, rows: 5, visits: 14, weave: true, pegR: 7 },
};

function drawPegWraps(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = PEG_PERSONALITIES[personality] || PEG_PERSONALITIES.balanced;
  const rand = seededRand(seed * 67 + 19);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const stringCol = colors[Math.floor(rand() * colors.length)];
  const pegCol = colors[(Math.floor(rand() * colors.length) + 1) % colors.length];
  const mx = w * 0.12;
  const my = h * 0.14;
  const pegs = [];
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < B.cols; c++) {
      pegs.push([
        x + mx + (c / (B.cols - 1)) * (w - 2 * mx),
        y + my + (r / (B.rows - 1)) * (h - 2 * my),
      ]);
    }
  }
  // wrap order: a random non-repeating walk over the peg grid
  const order = [];
  const used = new Set();
  let cur = Math.floor(rand() * pegs.length);
  for (let v = 0; v < Math.min(B.visits, pegs.length); v++) {
    order.push(cur);
    used.add(cur);
    const candidates = pegs.map((_, i) => i).filter((i) => !used.has(i));
    if (!candidates.length) break;
    cur = candidates[Math.floor(rand() * candidates.length)];
  }
  const R = B.pegR;
  ctx.save();
  // pegs first: quiet dots
  for (const [px, py] of pegs) {
    ctx.fillStyle = rgba(pegCol, P.alphaFill * 1.4);
    ctx.beginPath();
    ctx.arc(px, py, R * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // the string: tangent segments + bending arcs, side alternates per peg
  // when weaving. Same-radius circles → the outer tangent is the segment
  // between centers offset perpendicular by ±R.
  ctx.strokeStyle = rgba(stringCol, P.alpha * 1.3);
  ctx.lineWidth = P.lineWidth * 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  let prevEnd = null;
  for (let i = 0; i + 1 < order.length; i++) {
    const [ax, ay] = pegs[order[i]];
    const [bx, by] = pegs[order[i + 1]];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const side = B.weave ? (i % 2 === 0 ? 1 : -1) : 1;
    const nx = (-dy / len) * R * side;
    const ny = (dx / len) * R * side;
    const sx = ax + nx;
    const sy = ay + ny;
    const ex = bx + nx;
    const ey = by + ny;
    if (prevEnd === null) {
      ctx.moveTo(sx, sy);
    } else {
      // bend around the current peg from the previous tangent point
      const a0 = Math.atan2(prevEnd[1] - ay, prevEnd[0] - ax);
      const a1 = Math.atan2(sy - ay, sx - ax);
      ctx.arc(ax, ay, R, a0, a1, side < 0);
    }
    ctx.lineTo(ex, ey);
    prevEnd = [ex, ey];
  }
  ctx.stroke();
  // highlight the visited pegs: the string chose them
  for (const idx of order) {
    const [px, py] = pegs[idx];
    ctx.fillStyle = rgba(stringCol, P.alpha * 1.2);
    ctx.beginPath();
    ctx.arc(px, py, R * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// torn-paper: layered patches of "paper" with noise-roughened deckle edges
// and occasional sharp tear notches. RECIPE-ONLY port after Emily Xie's
// "Memories of Qilin" (Art Blocks Curated #282, CC BY-NC 4.0 — independent
// reimplementation; see docs/superpowers/artblocks-study/33-qilin-xie.md).
// Idioms taken as ideas: collage patch = radial blob whose edge radius is
// noise-modulated at two scales (slow undulation + fine deckle fuzz);
// a rare sharp inward NOTCH sells the tear; colors picked by WEIGHT
// (Xie's palettes attach a weight to every color, biasing without banning).
const TORN_PERSONALITIES = {
  calm: { patches: 3, notchChance: 0.15, rough: 0.05, fuzz: 0.02 },
  balanced: { patches: 5, notchChance: 0.35, rough: 0.09, fuzz: 0.035 },
  wild: { patches: 8, notchChance: 0.6, rough: 0.16, fuzz: 0.06 },
};

function drawTornPaper(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = TORN_PERSONALITIES[personality] || TORN_PERSONALITIES.balanced;
  const rand = seededRand(seed * 89 + 41);
  const noise = noise2D(seed + 31);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  // weighted pick: accent carries triple weight (Xie's weighted palettes)
  const weighted = colors.flatMap((c, i) => (i === 0 ? [c, c, c] : [c]));
  ctx.save();
  ctx.lineJoin = 'round';
  for (let pi = 0; pi < B.patches; pi++) {
    const col = weighted[Math.floor(rand() * weighted.length)];
    const cx = x + (0.12 + rand() * 0.76) * w;
    const cy = y + (0.12 + rand() * 0.76) * h;
    const rBase = (0.12 + rand() * 0.22) * Math.min(w, h);
    const squash = 0.55 + rand() * 0.7; // paper scraps are rarely round
    const rot = rand() * Math.PI;
    const K = 46;
    const phase = rand() * 100;
    const notchAt = rand() < B.notchChance ? Math.floor(rand() * K) : -1;
    const pts = [];
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2;
      // two-scale edge: slow undulation + fine deckle fuzz
      let r =
        rBase *
        (1 +
          (noise(phase + Math.cos(a) * 1.3, phase + Math.sin(a) * 1.3) - 0.5) * 2 * B.rough +
          (noise(phase + Math.cos(a) * 6, phase + Math.sin(a) * 6) - 0.5) *
            2 *
            B.fuzz *
            rBase *
            0.08);
      if (notchAt >= 0) {
        const d = Math.min(Math.abs(k - notchAt), K - Math.abs(k - notchAt));
        if (d < 3) r *= 0.55 + 0.15 * d; // the tear bites in sharply
      }
      const ex = Math.cos(a) * r;
      const ey = Math.sin(a) * r * squash;
      pts.push([
        cx + ex * Math.cos(rot) - ey * Math.sin(rot),
        cy + ex * Math.sin(rot) + ey * Math.cos(rot),
      ]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < K; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(col, P.alphaFill * 1.3);
    ctx.fill();
    // deckle edge: the fibrous rim reads as a slightly stronger outline
    ctx.strokeStyle = rgba(col, P.alpha * 1.1);
    ctx.lineWidth = P.lineWidth * 0.8;
    ctx.stroke();
  }
  ctx.restore();
}

// street-grid: a sparse road network — lanes drawn as parallel double rails,
// quarter-arc corners where a horizontal lane turns into a vertical one,
// dashed center lines on the widest roads. RECIPE-ONLY port after James
// Merrill's "BUSY"/"BUSIEST" (Art Blocks Curated #504/#503, CC BY-NC 4.0 —
// independent reimplementation; see docs/superpowers/artblocks-study/
// 28-busy-busiest-merrill.md). Idioms taken as ideas: the artwork is the
// NETWORK, traffic only reveals it (we keep the network, drop the agents);
// road vocabulary as a typed catalog (straight/corner/intersection/railroad)
// rather than free curves; corners are quarter arcs with a fixed radius so
// every turn reads as engineered, not organic.
const STREET_PERSONALITIES = {
  calm: { hLanes: 3, vLanes: 3, cornerChance: 0.35, railChance: 0.2, gaugeMax: 7 },
  balanced: { hLanes: 4, vLanes: 5, cornerChance: 0.5, railChance: 0.3, gaugeMax: 9 },
  wild: { hLanes: 6, vLanes: 7, cornerChance: 0.7, railChance: 0.45, gaugeMax: 12 },
};

function drawStreetGrid(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = STREET_PERSONALITIES[personality] || STREET_PERSONALITIES.balanced;
  const rand = seededRand(seed * 37 + 23);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const lane = (frac, span) => (0.08 + 0.84 * frac) * span + (rand() - 0.5) * span * 0.06;
  const hs = [];
  const vs = [];
  for (let i = 0; i < B.hLanes; i++)
    hs.push({ pos: y + lane((i + 0.5) / B.hLanes, h), gauge: 3 + rand() * B.gaugeMax });
  for (let i = 0; i < B.vLanes; i++)
    vs.push({ pos: x + lane((i + 0.5) / B.vLanes, w), gauge: 3 + rand() * B.gaugeMax });
  ctx.save();
  ctx.lineCap = 'butt';
  const rail = (x1, y1, x2, y2, gauge, col, isRail) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (gauge / 2);
    const ny = (dx / len) * (gauge / 2);
    ctx.strokeStyle = rgba(col, P.alpha);
    ctx.lineWidth = P.lineWidth * 0.8;
    ctx.setLineDash([]);
    for (const s2 of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(x1 + nx * s2, y1 + ny * s2);
      ctx.lineTo(x2 + nx * s2, y2 + ny * s2);
      ctx.stroke();
    }
    if (isRail) {
      // railroad ties across the gauge
      ctx.lineWidth = P.lineWidth * 0.7;
      const step = gauge * 2.2;
      for (let t = step; t < len; t += step) {
        const px = x1 + (dx / len) * t;
        const py = y1 + (dy / len) * t;
        ctx.beginPath();
        ctx.moveTo(px + nx * 1.3, py + ny * 1.3);
        ctx.lineTo(px - nx * 1.3, py - ny * 1.3);
        ctx.stroke();
      }
    } else if (gauge > 7) {
      // dashed center line on wide roads
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = P.lineWidth * 0.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };
  for (const hl of hs) {
    const col = colors[Math.floor(rand() * colors.length)];
    rail(x, hl.pos, x + w, hl.pos, hl.gauge, col, rand() < B.railChance);
  }
  for (const vl of vs) {
    const col = colors[Math.floor(rand() * colors.length)];
    rail(vl.pos, y, vl.pos, y + h, vl.gauge, col, rand() < B.railChance);
  }
  // quarter-arc corners at a random subset of crossings
  ctx.setLineDash([]);
  for (const hl of hs) {
    for (const vl of vs) {
      if (rand() > B.cornerChance) continue;
      const r = 14 + rand() * 18;
      const sx = rand() < 0.5 ? 1 : -1;
      const sy = rand() < 0.5 ? 1 : -1;
      const col = colors[Math.floor(rand() * colors.length)];
      ctx.strokeStyle = rgba(col, P.alpha * 1.1);
      ctx.lineWidth = P.lineWidth * 0.9;
      const a0 = sx > 0 ? (sy > 0 ? Math.PI : Math.PI / 2) : sy > 0 ? -Math.PI / 2 : 0;
      ctx.beginPath();
      ctx.arc(vl.pos + sx * r, hl.pos + sy * r, r, a0, a0 + Math.PI / 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// growth-loops: a closed loop grown by differential growth — points attract
// their neighbors, repel everything nearby, and the path resamples as it
// stretches; intermediate outlines are kept as faint growth rings.
// RECIPE-ONLY port after Joshua Bagley's "Spaghetti Bones" (Art Blocks
// Curated #456, CC BY-NC 4.0 — independent reimplementation; see docs/
// superpowers/artblocks-study/26-spaghetti-bones-bagley.md). Idioms taken
// as ideas: differential growth = cohesion + separation + resample (the
// whole organism in three rules); a spatial grid stands in for the
// original's quadtree; drawing the HISTORY (snapshots) not just the final
// curve gives the coral/bone depth.
const GROWTH_PERSONALITIES = {
  calm: { iters: 90, maxPts: 260, repelR: 26, snapEvery: 30, drift: 0.2 },
  balanced: { iters: 140, maxPts: 420, repelR: 22, snapEvery: 35, drift: 0.45 },
  wild: { iters: 200, maxPts: 620, repelR: 17, snapEvery: 40, drift: 0.9 },
};

function drawGrowthLoops(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = GROWTH_PERSONALITIES[personality] || GROWTH_PERSONALITIES.balanced;
  const rand = seededRand(seed * 29 + 5);
  const noise = noise2D(seed + 7);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const col = colors[Math.floor(rand() * colors.length)];
  const cx = x + (0.3 + rand() * 0.4) * w;
  const cy = y + (0.3 + rand() * 0.4) * h;
  const r0 = Math.min(w, h) * 0.12;
  let pts = [];
  const N0 = 26;
  for (let i = 0; i < N0; i++) {
    const a = (i / N0) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0]);
  }
  const segMax = 9;
  const repelR = B.repelR;
  const snapshots = [];
  for (let it = 0; it < B.iters; it++) {
    // resample: split any stretched segment
    if (pts.length < B.maxPts) {
      const next = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        next.push(a);
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > segMax && next.length < B.maxPts) {
          next.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        }
      }
      pts = next;
    }
    // spatial grid for separation
    const cell = repelR;
    const grid = new Map();
    for (let i = 0; i < pts.length; i++) {
      const key = `${Math.floor(pts[i][0] / cell)},${Math.floor(pts[i][1] / cell)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
    const moved = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const next2 = pts[(i + 1) % pts.length];
      // cohesion toward neighbor midpoint
      let fx = (prev[0] + next2[0]) / 2 - p[0];
      let fy = (prev[1] + next2[1]) / 2 - p[1];
      fx *= 0.12;
      fy *= 0.12;
      // separation from everything nearby (grid neighborhood)
      const gx = Math.floor(p[0] / cell);
      const gy = Math.floor(p[1] / cell);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = grid.get(`${gx + ox},${gy + oy}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j === i) continue;
            const dx = p[0] - pts[j][0];
            const dy = p[1] - pts[j][1];
            const d = Math.hypot(dx, dy);
            if (d > 0.001 && d < repelR) {
              const push2 = ((repelR - d) / repelR) * 0.55;
              fx += (dx / d) * push2;
              fy += (dy / d) * push2;
            }
          }
        }
      }
      // noise drift keeps the growth directional, not a plain blob
      const a = noise(p[0] * 0.008, p[1] * 0.008) * Math.PI * 4;
      fx += Math.cos(a) * B.drift;
      fy += Math.sin(a) * B.drift;
      moved.push([
        Math.max(x + 4, Math.min(x + w - 4, p[0] + fx)),
        Math.max(y + 4, Math.min(y + h - 4, p[1] + fy)),
      ]);
    }
    pts = moved;
    if (it % B.snapEvery === B.snapEvery - 1 && it < B.iters - 1) {
      snapshots.push(pts.map((p) => [p[0], p[1]]));
    }
  }
  ctx.save();
  ctx.lineJoin = 'round';
  const trace = (loop) => {
    ctx.beginPath();
    ctx.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i++) ctx.lineTo(loop[i][0], loop[i][1]);
    ctx.closePath();
  };
  // growth rings: the history, whisper-faint
  for (let sIdx = 0; sIdx < snapshots.length; sIdx++) {
    ctx.strokeStyle = rgba(col, P.alpha * (0.35 + (0.3 * sIdx) / snapshots.length));
    ctx.lineWidth = P.lineWidth * 0.6;
    trace(snapshots[sIdx]);
    ctx.stroke();
  }
  // the organism itself
  ctx.strokeStyle = rgba(col, P.alpha * 1.4);
  ctx.lineWidth = P.lineWidth;
  trace(pts);
  ctx.stroke();
  ctx.fillStyle = rgba(col, P.alphaFill * 0.5);
  ctx.fill();
  ctx.restore();
}

// paper-folds: the region treated as a sheet of paper, recursively split
// along fold chords into a few LARGE facets, each shaded by fold depth —
// origami-flat collage. RECIPE-ONLY port after James Merrill's "ORI" (Art
// Blocks Curated #379, CC BY-NC 4.0 — independent reimplementation; see
// docs/superpowers/artblocks-study/22-ori-merrill.md). Idioms taken as
// ideas: folding is line-vs-polygon SPLITTING (classify vertices by side,
// insert the two edge intersections, emit both halves); depth-graded facet
// shading sells the fold without any 3D; always split the LARGEST facet so
// the composition stays balanced.
const FOLD_PERSONALITIES = {
  calm: { splits: 3, angleJitter: 0.25, toneSpread: 0.5 },
  balanced: { splits: 5, angleJitter: 0.6, toneSpread: 0.65 },
  wild: { splits: 8, angleJitter: 1.2, toneSpread: 0.85 },
};

// split a convex-ish polygon by the line through (px,py) at angle a —
// returns [left, right] vertex lists (either may be empty)
function splitPolyByLine(poly, px, py, ang) {
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const sideOf = ([qx, qy]) => (qx - px) * nx + (qy - py) * ny;
  const left = [];
  const right = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = sideOf(a);
    const sb = sideOf(b);
    (sa >= 0 ? left : right).push(a);
    if ((sa >= 0 && sb < 0) || (sa < 0 && sb >= 0)) {
      const t = sa / (sa - sb);
      const ix = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      left.push(ix);
      right.push(ix);
    }
  }
  return [left, right];
}

function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function drawPaperFolds(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = FOLD_PERSONALITIES[personality] || FOLD_PERSONALITIES.balanced;
  const rand = seededRand(seed * 43 + 13);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const cA = colors[Math.floor(rand() * colors.length)];
  const cB = colors[(Math.floor(rand() * colors.length) + 1) % colors.length];
  let facets = [
    {
      poly: [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      depth: 0,
    },
  ];
  for (let k = 0; k < B.splits; k++) {
    // always fold the largest facet (ORI's balance rule)
    let bi = 0;
    let bArea = -1;
    for (let i = 0; i < facets.length; i++) {
      const ar = polyArea(facets[i].poly);
      if (ar > bArea) {
        bArea = ar;
        bi = i;
      }
    }
    const f = facets[bi];
    const cx = f.poly.reduce((s2, p2) => s2 + p2[0], 0) / f.poly.length;
    const cy = f.poly.reduce((s2, p2) => s2 + p2[1], 0) / f.poly.length;
    const baseAng = rand() < 0.5 ? 0 : Math.PI / 2; // fold axes lean axis-aligned
    const ang = baseAng + (rand() - 0.5) * 2 * B.angleJitter;
    const [la, ra] = splitPolyByLine(
      f.poly,
      cx + (rand() - 0.5) * 30,
      cy + (rand() - 0.5) * 30,
      ang,
    );
    if (la.length < 3 || ra.length < 3) continue;
    facets.splice(bi, 1, { poly: la, depth: f.depth + 1 }, { poly: ra, depth: f.depth });
  }
  ctx.save();
  ctx.lineWidth = P.lineWidth * 0.8;
  for (const f of facets) {
    const tone = Math.min(1, (f.depth / Math.max(1, B.splits)) * B.toneSpread + rand() * 0.15);
    const col = lerpColorOklab(cA, cB, tone);
    // gallery-instrument tune (Sprint 55): wider alpha spread so facets read
    ctx.fillStyle = rgba(col, P.alphaFill * (0.5 + 1.4 * tone));
    ctx.beginPath();
    ctx.moveTo(f.poly[0][0], f.poly[0][1]);
    for (let i = 1; i < f.poly.length; i++) ctx.lineTo(f.poly[i][0], f.poly[i][1]);
    ctx.closePath();
    ctx.fill();
    // fold-line edge: the crease highlight
    ctx.strokeStyle = rgba(col, P.alpha);
    ctx.stroke();
  }
  ctx.restore();
}

// scan-tides: horizontal scanlines carrying palette-blended triangle waves
// whose period drifts row to row — the beat/sync-slip look of analog video.
// RECIPE-ONLY port after LoVid's "Tide Predictor" (Art Blocks Curated #376,
// CC BY-NC-ND 4.0 — independent reimplementation, strictly no code reuse;
// see docs/superpowers/artblocks-study/21-tide-predictor-lovid.md). Idioms
// taken as ideas: the image is ONE 1D SCAN (index i wraps to rows — spatial
// structure is an artifact of the wrap); each channel is a triangle wave
// 255-|255-(i%p)·k| with its own period; periods RANDOM-WALK and re-sync
// with a minted probability, so bands slip diagonally then lock again.
// Palette adaptation: channels become two theme colors blended in OKLab.
const TIDE_PERSONALITIES = {
  calm: { rowH: 7, basePeriod: 220, drift: 0, resync: 0, second: 0.5 },
  balanced: { rowH: 6, basePeriod: 150, drift: 2.5, resync: 0.04, second: 0.75 },
  wild: { rowH: 5, basePeriod: 90, drift: 6, resync: 0.12, second: 1 },
};

function drawScanTides(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = TIDE_PERSONALITIES[personality] || TIDE_PERSONALITIES.balanced;
  const rand = seededRand(seed * 61 + 17);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  const cA = colors[Math.floor(rand() * colors.length)];
  const cB = colors[(Math.floor(rand() * colors.length) + 1) % colors.length];
  const periodReset = B.basePeriod * (0.8 + rand() * 0.5);
  let period = periodReset;
  let periodB = periodReset * (1.13 + rand() * 0.2); // detuned second channel
  const tri = (t) => 1 - Math.abs(1 - 2 * (t - Math.floor(t))); // 0..1..0
  ctx.save();
  let scan = rand() * period; // 1D scan cursor, carried across rows
  for (let ry = y; ry < y + h; ry += B.rowH) {
    // channel A: one gradient segment per period across the row
    for (let rx = 0; rx < w; ) {
      const phase = (scan + rx) / period;
      const segW = Math.min(w - rx, period * (1 - (phase - Math.floor(phase))) + 1);
      const t0 = tri(phase);
      const t1 = tri((scan + rx + segW) / period);
      // wave modulates ALPHA too — hue alone is invisible at wash levels.
      // Segments break AT phase zeros, so the tri-wave peak sits mid-segment:
      // without the middle stop the 0→0 gradient erases the wave entirely
      // (gallery-instrument catch, Sprint 55)
      const tm = tri((scan + rx + segW / 2) / period);
      const g = ctx.createLinearGradient(x + rx, 0, x + rx + segW, 0);
      g.addColorStop(0, rgba(lerpColorOklab(cA, cB, t0), P.alphaFill * (0.35 + 1.3 * t0)));
      g.addColorStop(0.5, rgba(lerpColorOklab(cA, cB, tm), P.alphaFill * (0.35 + 1.3 * tm)));
      g.addColorStop(1, rgba(lerpColorOklab(cA, cB, t1), P.alphaFill * (0.35 + 1.3 * t1)));
      ctx.fillStyle = g;
      ctx.fillRect(x + rx, ry, segW, B.rowH);
      rx += segW;
    }
    // channel B: sparse ticks where the detuned wave peaks (the beat trace)
    if (B.second) {
      const tB = tri((scan % periodB) / periodB);
      if (tB > 0.82) {
        ctx.fillStyle = rgba(cB, P.alpha * B.second);
        ctx.fillRect(x, ry, w, 1);
      }
    }
    scan += w; // the wrap: next row continues the same 1D scan
    // period random-walk (sync slip) + minted re-sync (the lock)
    if (B.drift) period = Math.max(40, period + (rand() - 0.5) * B.drift);
    if (B.resync && rand() < B.resync) {
      period = periodReset;
      periodB = periodReset * 1.17;
    }
  }
  ctx.restore();
}

// halftone-fade: a halftone dot screen sampling a soft brush field — dot
// radius encodes field intensity, the print-raster look. RECIPE-ONLY port
// after itsgalo's "RASTER" (Art Blocks Curated #341, CC BY-NC 4.0 —
// independent reimplementation; see docs/superpowers/artblocks-study/
// 20-raster-itsgalo.md). Idioms taken as ideas: the image is a FIELD (soft
// radial brush stamps accumulated into a buffer) and the STYLE is a sampling
// screen over it (dot size = local field value) — separating the content
// field from the raster screen is the whole architecture. The GPU feedback
// pass of the original is not ported — static screen only.
const HALFTONE_PERSONALITIES = {
  calm: { cell: 15, blobs: 2, gamma: 1.5, jitter: 0 },
  balanced: { cell: 12, blobs: 3, gamma: 1.15, jitter: 0.12 },
  wild: { cell: 9, blobs: 5, gamma: 0.85, jitter: 0.3 },
};

function drawHalftoneFade(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = HALFTONE_PERSONALITIES[personality] || HALFTONE_PERSONALITIES.balanced;
  const rand = seededRand(seed * 97 + 3);
  const colors = [palette.accent, ...(palette.colors || [])].filter(Boolean);
  // brush field: a few soft radial stamps (alpha falls off with squared
  // linear distance from the center, like RASTER's drawBrush buffer)
  const blobs = [];
  for (let i = 0; i < B.blobs; i++) {
    // gallery-instrument tune (Sprint 54): unconstrained centers let calm
    // mints land mostly off-canvas (0.6% ink) — keep centers in the middle
    // 70% and floor the radius so every mint carries a visible screen
    blobs.push({
      cx: x + (0.15 + rand() * 0.7) * w,
      cy: y + (0.15 + rand() * 0.7) * h,
      r: (0.32 + rand() * 0.42) * Math.min(w, h),
      amp: 0.6 + rand() * 0.4,
      col: colors[Math.floor(rand() * colors.length)],
    });
  }
  const field = (px, py) => {
    let v = 0;
    let nearest = blobs[0];
    let best = Infinity;
    for (const bl of blobs) {
      const d = Math.hypot(px - bl.cx, py - bl.cy);
      const t = Math.max(0, 1 - d / bl.r);
      v += bl.amp * t * t;
      if (d < best) {
        best = d;
        nearest = bl;
      }
    }
    return [Math.min(1, v), nearest.col];
  };
  ctx.save();
  const cell = B.cell;
  let row = 0;
  for (let gy = y + cell / 2; gy < y + h; gy += cell, row++) {
    const off = row % 2 === 0 ? 0 : cell / 2; // offset rows = print-rosette feel
    for (let gx = x + cell / 2 + off; gx < x + w; gx += cell) {
      const jx = B.jitter ? (rand() - 0.5) * cell * B.jitter : 0;
      const jy = B.jitter ? (rand() - 0.5) * cell * B.jitter : 0;
      const [v, col] = field(gx, gy);
      const radius = cell * 0.46 * Math.pow(v, B.gamma);
      if (radius < 0.4) continue;
      ctx.fillStyle = rgba(col, P.alphaFill * 1.6);
      ctx.beginPath();
      ctx.arc(gx + jx, gy + jy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// banded-ribbons: FAT flow-field ribbons whose bodies are divided into
// short color BANDS — each band an independent weighted palette draw.
// RECIPE-ONLY port after Tyler Hobbs' "Fidenza" (Art Blocks Curated #78,
// CC BY-NC 4.0 — independent reimplementation; second-generation study
// after flow-ribbons/L2, this time taking the RENDERING idioms the first
// port skipped; see docs/superpowers/artblocks-study/02+75). Idioms taken
// as ideas: a ribbon is a SPINE walked through the field, then FATTENED
// into top/bottom offset edges and closed (never a stroked polyline);
// thickness comes from a few DISCRETE levels under a weighted choice —
// mixed scales, never a continuum; the body is cut into short arc-length
// segments, EACH segment re-drawing its color from a weighted pool where
// pale/neutral tints dominate and saturated hues punctuate; ribbons stop
// at collisions (mutual respect makes the composition read as woven).
const BANDED_PERSONALITIES = {
  calm: { attempts: 90, levels: [4, 9, 18], weights: [0.3, 0.5, 0.2], seg: [24, 48, 96], step: 7 },
  balanced: {
    attempts: 150,
    levels: [4, 9, 18, 36, 68],
    weights: [0.12, 0.25, 0.3, 0.25, 0.08],
    seg: [10, 20, 40, 80],
    step: 6,
  },
  wild: {
    attempts: 210,
    levels: [9, 18, 36, 68, 110],
    weights: [0.1, 0.2, 0.3, 0.3, 0.1],
    seg: [8, 16, 32],
    step: 6,
  },
};

function drawBandedRibbons(ctx, { palette, seed, x, y, w, h, intensity, personality }) {
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const B = BANDED_PERSONALITIES[personality] || BANDED_PERSONALITIES.balanced;
  const rand = seededRand(seed * 101 + 47);
  const noise = noise2D(seed + 13);
  // Sprint 76 (user: 颜色去学习一下): the LUXE pool itself — Fidenza's
  // dominant palette studied from source (HSB → RGB conversion of the
  // published color table; weights are the published facts, colors are
  // facts, no code copied). Newsprint / pale-green / browns CARRY (~56%),
  // reds / yellows / blues punctuate. This family deliberately speaks
  // Fidenza's voice rather than the deck theme's (documented palette
  // exemption, same class as the rare-trait metallics).
  const pool = [
    [[219, 79, 84], 0.05], // dRed
    [[209, 42, 47], 0.03], // red
    [[224, 215, 197], 0.12], // newsprint
    [[230, 125, 50], 0.02], // orange
    [[252, 210, 101], 0.06], // pale yellow
    [[252, 188, 25], 0.06], // yellow
    [[247, 177, 161], 0.03], // pink
    [[41, 166, 145], 0.04], // green
    [[184, 217, 206], 0.18], // pale pale green
    [[18, 26, 51], 0.02], // dd blue
    [[31, 51, 89], 0.05], // d blue
    [[49, 95, 140], 0.05], // blue
    [[124, 169, 191], 0.03], // pale blue
    [[84, 62, 46], 0.17], // brown
    [[59, 43, 32], 0.09], // d brown
    [[33, 24, 18], 0.03], // dd brown
  ];
  const poolTotal = pool.reduce((t, [, wgt]) => t + wgt, 0);
  const pickColor = () => {
    let t = rand() * poolTotal;
    for (const [c, wgt] of pool) {
      t -= wgt;
      if (t <= 0) return c;
    }
    return pool[0][0];
  };
  const pickLevel = () => {
    let t = rand();
    for (let i = 0; i < B.levels.length; i++) {
      t -= B.weights[i];
      if (t <= 0) return B.levels[i];
    }
    return B.levels[0];
  };

  // coarse occupancy grid — collision keeps ribbons from crossing
  const CELL = 14;
  const occupied = new Set();
  const cellsFor = (px, py, r) => {
    const out = [];
    for (let gx = Math.floor((px - r) / CELL); gx <= Math.floor((px + r) / CELL); gx++)
      for (let gy = Math.floor((py - r) / CELL); gy <= Math.floor((py + r) / CELL); gy++)
        out.push(gx + ':' + gy);
    return out;
  };
  const collides = (px, py, r) => cellsFor(px, py, r).some((k) => occupied.has(k));

  const baseAngle = rand() * Math.PI * 2;
  ctx.save();
  ctx.lineJoin = 'round';
  for (let a = 0; a < B.attempts; a++) {
    const thick = pickLevel();
    const half = thick / 2;
    let px = x + rand() * w;
    let py = y + rand() * h;
    const spine = [];
    // walk the field; low curvature (Fidenza fields bend gently)
    for (let sIdx = 0; sIdx < 200; sIdx++) {
      if (px < x - half || px > x + w + half || py < y - half || py > y + h + half) break;
      if (collides(px, py, half * 0.8)) break;
      spine.push([px, py]);
      const ang = baseAngle + (noise(px * 0.0022, py * 0.0022) - 0.5) * 2.6;
      px += Math.cos(ang) * B.step;
      py += Math.sin(ang) * B.step;
    }
    // minimum-length gate: a ribbon shorter than ~2× its width reads as a blob
    if (spine.length * B.step < thick * 2.2 || spine.length < 4) continue;
    for (const [sx, sy] of spine) for (const k of cellsFor(sx, sy, half)) occupied.add(k);

    // fatten: per-point normals → top/bottom edges
    const top = [];
    const bot = [];
    for (let i = 0; i < spine.length; i++) {
      const p0 = spine[Math.max(0, i - 1)];
      const p1 = spine[Math.min(spine.length - 1, i + 1)];
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const len = Math.hypot(dx, dy) || 1;
      top.push([spine[i][0] - (dy / len) * half, spine[i][1] + (dx / len) * half]);
      bot.push([spine[i][0] + (dy / len) * half, spine[i][1] - (dx / len) * half]);
    }

    // color BANDS along the arc — the signature. Each band re-draws its
    // color; band length is a weighted pick per ribbon.
    const segLen = B.seg[Math.floor(rand() * B.seg.length)];
    const ptsPerSeg = Math.max(1, Math.round(segLen / B.step));
    const alpha = Math.min(0.96, P.alphaFill * 1.9); // subtle stays whisper, artwork goes opaque
    for (let i0 = 0; i0 < spine.length - 1; i0 += ptsPerSeg) {
      const i1 = Math.min(spine.length - 1, i0 + ptsPerSeg);
      ctx.fillStyle = rgba(pickColor(), alpha);
      ctx.beginPath();
      ctx.moveTo(top[i0][0], top[i0][1]);
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(top[i][0], top[i][1]);
      for (let i = i1; i >= i0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    // ends stay FLAT — Fidenza's fat() simply closes the offset edges
    // (Sprint 76: the semicircle caps of the first cut were an invention)
    // hairline outline holds the ribbon together (Fidenza stroke mode)
    ctx.strokeStyle = rgba(palette.silhouetteColor || [30, 30, 34], Math.min(0.5, P.alpha * 1.4));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

// --- v2 pipeline (Sprint 59) ------------------------------------------------
// DECOR_V 2 adds two stages AROUND the (still frozen) family draws:
//   pre:  WCAG luminance guard — palette colors too close to the theme bg
//         get pushed apart in OKLab L until a perceptual floor is met
//         (Frammenti lesson, study/36: accessibility math as free QA).
//   post: event flourish — on calendar events a tiny hash-deterministic
//         ornament joins the corner. The DATE only gates; every random
//         decision comes from the mint hash's own lanes, so the owner can
//         re-render any event look forever via the ?at= view param
//         (clock-trait tier model, study/50: ambience < composition < event).
// v1 artifacts bypass both stages — their pixels are covered byte-for-byte
// by scripts/decor-freeze-v1.json + the freeze block in test-decor.mjs.

function relLuminance([r, g, b]) {
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a, b) {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

// decor is a whisper layer — it needs perceptual EXISTENCE, not text-grade
// contrast. 1.35 is the floor where 640×360 thumbnails stop reading blank.
const DECOR_MIN_CONTRAST = 1.35;

export function guardPalette(palette) {
  const bg = palette?.bg || [248, 246, 240];
  // light themes push colors darker, dark themes lighter — always AWAY
  const dir = relLuminance(bg) > 0.5 ? -1 : 1;
  const fix = (c) => {
    if (!Array.isArray(c)) return c;
    let col = c;
    for (let i = 0; i < 12 && contrastRatio(col, bg) < DECOR_MIN_CONTRAST; i++) {
      const lab = rgbToOklab(col);
      lab[0] += dir * 0.035;
      col = oklabToRgb(lab);
    }
    return col;
  };
  return {
    ...palette,
    accent: fix(palette.accent),
    colors: (palette.colors || []).map(fix),
  };
}

// --- rare traits (Sprint 60, v2 pipeline) -------------------------------------
// ~3% of mints carry a SIGNATURE ELEMENT drawn over the (frozen) family in
// its own visual language — the collectible hook (Fidenza rare-palette /
// Watercolor rarity-ladder lesson). Two deliberate rule-breaks, both scoped
// to rares only: they may use the two METALLIC constants below (off the
// theme palette — preciousness needs a foreign material), and their alpha
// runs hotter than the whisper cap (thread-thin area affords it, same
// argument as nib-flourish). The rare gate lives on its own hash lane, so
// it is an ARTIFACT-level property: a rare deck is rare on every slide.
const RARE_GOLD = [212, 175, 55];
const RARE_CRIMSON = [178, 34, 52];

const RARE_TRAITS = {
  // one long gilded streamline weaving through the ribbons
  'flow-ribbons': (ctx, R, { x, y, w, h }) => {
    const noise = noise2D(R.int('gild-seed', 1, 1e9));
    let px = x + R.range('gild-x', 0.05, 0.2) * w;
    let py = y + R.range('gild-y', 0.2, 0.8) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.5);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let i = 0; i < 110; i++) {
      const a = noise(px * 0.003, py * 0.003) * Math.PI * 4;
      px += Math.cos(a) * 7;
      py += Math.sin(a) * 7;
      if (px < x || px > x + w || py < y || py > y + h) break;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  },
  // the red string of fate: a crimson thread visiting three pegs
  'peg-wraps': (ctx, R, { x, y, w, h }) => {
    ctx.strokeStyle = rgba(RARE_CRIMSON, 0.55);
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let px = x + R.range('red-x0', 0.1, 0.9) * w;
    let py = y + R.range('red-y0', 0.1, 0.9) * h;
    ctx.moveTo(px, py);
    for (let k = 1; k <= 3; k++) {
      const nx = x + R.range(`red-x${k}`, 0.1, 0.9) * w;
      const ny = y + R.range(`red-y${k}`, 0.1, 0.9) * h;
      // slack in the thread: a soft quadratic sag toward the floor
      ctx.quadraticCurveTo((px + nx) / 2, Math.max(py, ny) + h * 0.06, nx, ny);
      px = nx;
      py = ny;
    }
    ctx.stroke();
  },
  // one growth ring gilded
  'growth-loops': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('ring-x', 0.25, 0.75) * w;
    const cy = y + R.range('ring-y', 0.25, 0.75) * h;
    const r0 = Math.min(w, h) * R.range('ring-r', 0.08, 0.16);
    const noise = noise2D(R.int('ring-seed', 1, 1e9));
    ctx.strokeStyle = rgba(RARE_GOLD, 0.5);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const K = 60;
    for (let k = 0; k <= K; k++) {
      const a = (k / K) * Math.PI * 2;
      const r = r0 * (1 + (noise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5) - 0.5) * 0.35);
      const qx = cx + Math.cos(a) * r;
      const qy = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(qx, qy);
      else ctx.lineTo(qx, qy);
    }
    ctx.closePath();
    ctx.stroke();
  },
  // a golden tributary meandering across one band of the region
  'river-courses': (ctx, R, { x, y, w, h }) => {
    const noise = noise2D(R.int('trib-seed', 1, 1e9));
    const y0 = y + R.range('trib-y', 0.15, 0.85) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let py = y0;
    ctx.moveTo(x, py);
    const step = w / 60;
    for (let k = 1; k <= 60; k++) {
      py += (noise(k * 0.15, y0 * 0.01) - 0.5) * h * 0.06;
      ctx.lineTo(x + k * step, py);
    }
    ctx.stroke();
  },
  // one golden comet-streamline with a bright head
  'flow-streams': (ctx, R, { x, y, w, h }) => {
    const noise = noise2D(R.int('comet-seed', 1, 1e9));
    let px = x + R.range('comet-x', 0.1, 0.6) * w;
    let py = y + R.range('comet-y', 0.2, 0.8) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.45);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    let lx = px;
    let ly = py;
    for (let i = 0; i < 70; i++) {
      const a = noise(px * 0.004, py * 0.004) * Math.PI * 4;
      px += Math.cos(a) * 6;
      py += Math.sin(a) * 6;
      if (px < x || px > x + w || py < y || py > y + h) break;
      ctx.lineTo(px, py);
      lx = px;
      ly = py;
    }
    ctx.stroke();
    ctx.fillStyle = rgba(RARE_GOLD, 0.7);
    ctx.beginPath();
    ctx.arc(lx, ly, 2.4, 0, Math.PI * 2);
    ctx.fill();
  },
  // one golden weft row running against the weave
  'weave-dashes': (ctx, R, { x, y, w, h }) => {
    const gy = y + R.range('weft-y', 0.15, 0.85) * h;
    const noise = noise2D(R.int('weft-seed', 1, 1e9));
    ctx.strokeStyle = rgba(RARE_GOLD, 0.5);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for (let gx = x + 10; gx < x + w - 10; gx += 26) {
      const a = noise(gx * 0.006, gy * 0.006) * 0.8 - 0.4;
      ctx.beginPath();
      ctx.moveTo(gx - Math.cos(a) * 9, gy - Math.sin(a) * 9);
      ctx.lineTo(gx + Math.cos(a) * 9, gy + Math.sin(a) * 9);
      ctx.stroke();
    }
  },
  // one circle becomes a gold ring with a still center
  'circle-pack': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('ring-x', 0.2, 0.8) * w;
    const cy = y + R.range('ring-y', 0.2, 0.8) * h;
    const r = Math.min(w, h) * R.range('ring-r', 0.05, 0.1);
    ctx.strokeStyle = rgba(RARE_GOLD, 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = rgba(RARE_GOLD, 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  },
  // one gilded shard
  'shard-mesh': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('shard-x', 0.2, 0.8) * w;
    const cy = y + R.range('shard-y', 0.2, 0.8) * h;
    const r = Math.min(w, h) * 0.05;
    ctx.fillStyle = rgba(RARE_GOLD, 0.35);
    ctx.strokeStyle = rgba(RARE_GOLD, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = R.range(`sa${k}`, 0, Math.PI * 2);
      const rr = r * R.range(`sr${k}`, 0.7, 1.3);
      const qx = cx + Math.cos(a) * rr;
      const qy = cy + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(qx, qy);
      else ctx.lineTo(qx, qy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },
  // a golden wheat-ear: five streaks fanning from one root
  'meadow-streaks': (ctx, R, { x, y, w, h }) => {
    const rx = x + R.range('ear-x', 0.2, 0.8) * w;
    const ry = y + R.range('ear-y', 0.4, 0.85) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.5);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.22 + R.range(`ea${k}`, -0.05, 0.05);
      const len = h * R.range(`el${k}`, 0.08, 0.14);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(
        rx + Math.cos(a) * len * 0.5 + 4,
        ry + Math.sin(a) * len * 0.5,
        rx + Math.cos(a) * len,
        ry + Math.sin(a) * len,
      );
      ctx.stroke();
    }
  },
  // one cell gilded
  'block-mosaic': (ctx, R, { x, y, w, h }) => {
    const cell = 24;
    const gx = x + Math.floor(R.range('cell-x', 0.1, 0.9) * (w / cell)) * cell;
    const gy = y + Math.floor(R.range('cell-y', 0.1, 0.9) * (h / cell)) * cell;
    ctx.fillStyle = rgba(RARE_GOLD, 0.35);
    ctx.fillRect(gx + 1, gy + 1, cell - 2, cell - 2);
    ctx.strokeStyle = rgba(RARE_GOLD, 0.6);
    ctx.lineWidth = 1;
    ctx.strokeRect(gx + 0.5, gy + 0.5, cell - 1, cell - 1);
  },
  // a golden halo wash — one thin crescent
  'wash-flow': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('halo-x', 0.25, 0.75) * w;
    const cy = y + R.range('halo-y', 0.25, 0.75) * h;
    const r = Math.min(w, h) * R.range('halo-r', 0.08, 0.14);
    const a0 = R.range('halo-a', 0, Math.PI * 2);
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = rgba(RARE_GOLD, 0.28);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r + k * 1.6, a0, a0 + Math.PI * 0.9);
      ctx.stroke();
    }
  },
  // a gold vein following the strata's own displacement language
  'strata-lines': (ctx, R, { x, y, w, h }) => {
    const noise = noise2D(R.int('vein-seed', 1, 1e9));
    const y0 = y + R.range('vein-y', 0.2, 0.8) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.5);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let k = 0; k <= 80; k++) {
      const px = x + (k / 80) * w;
      const py = y0 + (noise(px * 0.008, y0 * 0.01) - 0.5) * h * 0.1;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  },
  // one horizon line gilded
  'sediment-layers': (ctx, R, { x, y, w, h }) => {
    const noise = noise2D(R.int('gild-seed', 1, 1e9));
    const y0 = y + R.range('gild-y', 0.25, 0.75) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.55);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let k = 0; k <= 64; k++) {
      const px = x + (k / 64) * w;
      const py = y0 + (noise(px * 0.004, 3) - 0.5) * h * 0.16;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  },
  // a cinnabar seal-knot: one tight crimson scribble
  'ink-scribble': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('seal-x', 0.2, 0.8) * w;
    const cy = y + R.range('seal-y', 0.2, 0.8) * h;
    const r = Math.min(w, h) * 0.03;
    ctx.strokeStyle = rgba(RARE_CRIMSON, 0.55);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    let a = R.range('seal-a', 0, Math.PI * 2);
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    for (let k = 0; k < 26; k++) {
      a += R.range(`sk${k}`, 0.5, 1.4);
      const rr = r * R.range(`sr${k}`, 0.5, 1.15);
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.stroke();
  },
  // one gold-edged frame among the drifting boxes
  'light-edges': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('frame-x', 0.2, 0.8) * w;
    const cy = y + R.range('frame-y', 0.2, 0.8) * h;
    const sz = Math.min(w, h) * R.range('frame-s', 0.07, 0.12);
    const rot = R.range('frame-a', 0, Math.PI / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.strokeStyle = rgba(RARE_GOLD, 0.55);
    ctx.lineWidth = 1.3;
    ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  },
  // one golden nib stroke
  'nib-flourish': (ctx, R, { x, y, w, h }) => {
    const px0 = x + R.range('nib-x', 0.2, 0.7) * w;
    const py0 = y + R.range('nib-y', 0.2, 0.8) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.5);
    ctx.lineCap = 'round';
    let px = px0;
    let py = py0;
    let ang = R.range('nib-a', -0.6, 0.6);
    for (let k = 0; k < 18; k++) {
      ctx.lineWidth = 0.6 + 1.8 * Math.sin((Math.PI * k) / 18);
      const nx = px + Math.cos(ang) * 5;
      const ny = py + Math.sin(ang) * 5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ang += R.range(`na${k}`, -0.25, 0.25);
      px = nx;
      py = ny;
    }
  },
  // one honeycomb cell filled with gold
  'hex-lattice': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('hex-x', 0.2, 0.8) * w;
    const cy = y + R.range('hex-y', 0.2, 0.8) * h;
    const r = 13;
    ctx.fillStyle = rgba(RARE_GOLD, 0.4);
    ctx.strokeStyle = rgba(RARE_GOLD, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      const qx = cx + Math.cos(a) * r;
      const qy = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(qx, qy);
      else ctx.lineTo(qx, qy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },
  // the spider's prize: a gold node with radiating links
  'drift-web': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('node-x', 0.2, 0.8) * w;
    const cy = y + R.range('node-y', 0.2, 0.8) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.45);
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const a = R.range(`la${k}`, 0, Math.PI * 2);
      const len = R.range(`ll${k}`, 20, 55);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(RARE_GOLD, 0.65);
    ctx.beginPath();
    ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  },
  // a crimson customs seal-band across one lane
  'cargo-dashes': (ctx, R, { x, y, w, h }) => {
    const gy = y + R.range('seal-y', 0.15, 0.85) * h;
    ctx.strokeStyle = rgba(RARE_CRIMSON, 0.5);
    ctx.lineWidth = 2.2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.06, gy);
    ctx.lineTo(x + w * 0.94, gy);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  // one crease caught in gold light
  'folded-screens': (ctx, R, { x, y, w, h }) => {
    const px = x + R.range('crease-x', 0.2, 0.8) * w;
    const slope = R.range('crease-s', -0.15, 0.15);
    ctx.strokeStyle = rgba(RARE_GOLD, 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + slope * h, y + h);
    ctx.stroke();
  },
  // a golden rosette in the dot screen
  'halftone-fade': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('rose-x', 0.2, 0.8) * w;
    const cy = y + R.range('rose-y', 0.2, 0.8) * h;
    for (let ring = 0; ring < 3; ring++) {
      const n = ring === 0 ? 1 : ring * 6;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const d = ring * 9;
        ctx.fillStyle = rgba(RARE_GOLD, 0.5 - ring * 0.12);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3 - ring * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  // one golden scanline with its beat ticks
  'scan-tides': (ctx, R, { x, y, w, h }) => {
    const gy = y + R.range('line-y', 0.15, 0.85) * h;
    ctx.fillStyle = rgba(RARE_GOLD, 0.45);
    ctx.fillRect(x, gy, w, 1.2);
    const period = R.range('line-p', 60, 120);
    for (let px = x + period / 2; px < x + w; px += period) {
      ctx.fillRect(px, gy - 3, 1.2, 7);
    }
  },
  // one fold-line gilded
  'paper-folds': (ctx, R, { x, y, w, h }) => {
    const ax = x + R.range('fold-x0', 0.05, 0.4) * w;
    const ay = y + R.range('fold-y0', 0.05, 0.95) * h;
    const bx = x + R.range('fold-x1', 0.6, 0.95) * w;
    const by = y + R.range('fold-y1', 0.05, 0.95) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.5);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  },
  // one intersection ringed gold — the roundabout
  'street-grid': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('hub-x', 0.2, 0.8) * w;
    const cy = y + R.range('hub-y', 0.2, 0.8) * h;
    ctx.strokeStyle = rgba(RARE_GOLD, 0.55);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();
  },
  // a small gold-leaf scrap among the torn paper
  'torn-paper': (ctx, R, { x, y, w, h }) => {
    const cx = x + R.range('leaf-x', 0.2, 0.8) * w;
    const cy = y + R.range('leaf-y', 0.2, 0.8) * h;
    const rBase = Math.min(w, h) * R.range('leaf-r', 0.04, 0.07);
    const noise = noise2D(R.int('leaf-seed', 1, 1e9));
    ctx.fillStyle = rgba(RARE_GOLD, 0.4);
    ctx.beginPath();
    const K = 26;
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2;
      const r = rBase * (1 + (noise(Math.cos(a) * 3 + 9, Math.sin(a) * 3 + 9) - 0.5) * 0.5);
      const qx = cx + Math.cos(a) * r;
      const qy = cy + Math.sin(a) * r * 0.75;
      if (k === 0) ctx.moveTo(qx, qy);
      else ctx.lineTo(qx, qy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(RARE_GOLD, 0.55);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  },
};

export const RARE_TRAIT_FAMILIES = Object.keys(RARE_TRAITS);
// v2 shipped with exactly these five eligible; v3 opens all 25. Eligibility
// is decided at MINT time per the artifact's version (decisions must be
// reproducible under the version they were minted with).
const RARE_FIVE = ['flow-ribbons', 'peg-wraps', 'growth-loops', 'river-courses', 'torn-paper'];
const RARE_CHANCE = 0.03;

// --- v3 stages (Sprint 61) ----------------------------------------------------
// janky plate (L48 CENTURY): deliberate imperfection as an engineered,
// MINTED switch — the family layer prints through a slightly mis-set plate
// (sub-degree rotation + a few px offset). Overlays stay straight: only the
// plate is drunk, the pressroom is sober.
function jankyTransform(ctx, decor, { x, y, w, h }) {
  const R = makeHashRand(`${decor.hash ?? decor.seed}:janky`);
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.translate(cx, cy);
  // ±1.4° + a few px: visibly hand-set, still respectable
  ctx.rotate(R.range('rot', -0.025, 0.025));
  ctx.translate(-cx + R.range('dx', -5, 5), -cy + R.range('dy', -5, 5));
}

// grain pass (L43 Entretiempos): the print-batch feel — a deterministic
// speckle field whose STRENGTH is minted per artifact (some batches run
// grainy, some clean). Dark and light specks alternate so grain reads on
// any theme.
function drawGrain(ctx, decor, { x, y, w, h, intensity }) {
  const strength = decor.grain ?? 0;
  if (!strength) return;
  const P = INTENSITY[intensity] || INTENSITY.subtle;
  const R = makeHashRand(`${decor.hash ?? decor.seed}:grain`);
  // gallery-tuned (Sprint 61): 1px specks vanish below ~900 count — the
  // batch feel needs density, the legibility guard stays in the alpha
  const count = Math.round(((w * h) / 250) * strength);
  for (let i = 0; i < count; i++) {
    const px = x + R.rand(`x${i & 63}`) * w;
    const py = y + R.rand(`y${i & 63}`) * h;
    const dark = i % 3 !== 0;
    ctx.fillStyle = dark
      ? rgba([60, 52, 40], P.alphaFill * 0.8 * strength)
      : rgba([255, 255, 255], P.alphaFill * strength);
    ctx.fillRect(px, py, 1.2, 1.2);
  }
}

// serial edition mark (L23 Pre-Process): the OTHER trait axis — the mint
// SEQUENCE number, giving a collection its structure (hash names the
// individual, the serial names its place in the run). Eight tiny ornament
// stamps rotate with serial % 8.
function drawSerialMark(ctx, decor, { palette, x, y, h }) {
  const n = decor.serial;
  if (n == null) return;
  const col = palette.accent || [100, 100, 100];
  const bx = x + 10;
  const by = y + h - 8;
  ctx.save();
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgba(col, 0.35);
  ctx.fillText(`N\u00ba ${n}`, bx + 10, by);
  const kind = (n - 1) % 8;
  ctx.strokeStyle = rgba(col, 0.4);
  ctx.fillStyle = rgba(col, 0.4);
  ctx.lineWidth = 1;
  const cx = bx + 3;
  const cy = by - 3.5;
  ctx.beginPath();
  if (kind === 0) ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
  else if (kind === 1) ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
  else if (kind === 2) ctx.rect(cx - 2.2, cy - 2.2, 4.4, 4.4);
  else if (kind === 3) {
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx - 3, cy);
    ctx.closePath();
  } else if (kind === 4) {
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx + 2.8, cy + 2.4);
    ctx.lineTo(cx - 2.8, cy + 2.4);
    ctx.closePath();
  } else if (kind === 5) {
    ctx.moveTo(cx - 3, cy);
    ctx.lineTo(cx + 3, cy);
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx, cy + 3);
  } else if (kind === 6) {
    ctx.moveTo(cx - 2.5, cy + 2.5);
    ctx.lineTo(cx + 2.5, cy - 2.5);
  } else {
    ctx.moveTo(cx - 3, cy);
    ctx.quadraticCurveTo(cx - 1.5, cy - 3, cx, cy);
    ctx.quadraticCurveTo(cx + 1.5, cy + 3, cx + 3, cy);
  }
  if (kind === 0) ctx.fill();
  else ctx.stroke();
  ctx.restore();
}

const DECOR_EVENTS = [
  // New Year's Day: the deck wears a small gold-confetti corner burst
  { id: 'new-year', match: (d) => d.getMonth() === 0 && d.getDate() === 1 },
];

function activeDecorEvent(at) {
  const d = at != null ? new Date(at) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  return DECOR_EVENTS.find((e) => e.match(d)) || null;
}

function drawEventFlourish(ctx, decor, ev, { palette, x, y, w, h }) {
  const R = makeHashRand(`${decor.hash ?? decor.seed}:${ev.id}`);
  const accent = palette.accent || [220, 170, 60];
  const cx = x + w * (0.88 + R.range('corner-x', 0, 0.06));
  const cy = y + h * (0.08 + R.range('corner-y', 0, 0.05));
  const burst = R.int('count', 12, 18);
  ctx.save();
  for (let i = 0; i < burst; i++) {
    const a = R.range(`a${i}`, 0, Math.PI * 2);
    const dist = R.range(`d${i}`, 6, Math.min(w, h) * 0.07);
    const px = cx + Math.cos(a) * dist;
    const py = cy + Math.sin(a) * dist * 0.8;
    const sz = R.range(`s${i}`, 1.5, 3.5);
    ctx.fillStyle = rgba(accent, 0.3 + R.range(`al${i}`, 0, 0.15));
    ctx.beginPath();
    if (R.chance(`dot${i}`, 0.5)) {
      ctx.arc(px, py, sz / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(px - sz / 2, py - sz / 2, sz, sz * 0.6);
    }
    ctx.fill();
  }
  // three thin streamers falling from the burst
  ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = rgba(accent, 0.25);
    ctx.beginPath();
    let px = cx + R.range(`kx${k}`, -20, 20);
    let py = cy;
    ctx.moveTo(px, py);
    for (let s2 = 0; s2 < 5; s2++) {
      px += R.range(`kxx${k}${s2}`, -6, 6);
      py += R.range(`kyy${k}${s2}`, 6, 12);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// --- registry ----------------------------------------------------------------

// FREEZE DISCIPLINE (Sprint 43, the complete fxhash lesson): fxhash's
// "hash = artwork" holds because of fxrand AND immutable on-chain code.
// Off-chain we adapt it as version pinning: DECOR_V is stamped into every
// minted decoration, and a family implementation, once shipped under a
// version, is FROZEN — never edit its pixels; behavioral changes ship as a
// new versioned function and drawDecor dispatches on the artifact's own v.
// Named lanes protect DECISIONS across versions; the freeze protects PIXELS.
// v1 (Sprints 41-57): the 25 frozen families, bare.
// v2 (Sprints 59-60): + WCAG palette guard + event flourish + rare five.
// v3 (Sprint 61): + rare eligibility for all 25 + janky plate + grain pass
//                 + serial edition mark. v1/v2 pixels are CI-locked by
//                 decor-freeze-v1.json / decor-freeze-v2.json.
export const DECOR_V = 3;

export const DECOR_FAMILIES = {
  'flow-streams': drawFlowStreams,
  'weave-dashes': drawWeaveDashes,
  'circle-pack': drawCirclePack,
  'shard-mesh': drawShardMesh,
  'meadow-streaks': drawMeadowStreaks,
  'flow-ribbons': drawFlowRibbons,
  'block-mosaic': drawBlockMosaic,
  'wash-flow': drawWashFlow,
  'strata-lines': drawStrataLines,
  'sediment-layers': drawSedimentLayers,
  'ink-scribble': drawInkScribble,
  'light-edges': drawLightEdges,
  'nib-flourish': drawNibFlourish,
  'hex-lattice': drawHexLattice,
  'drift-web': drawDriftWeb,
  'cargo-dashes': drawCargoDashes,
  'folded-screens': drawFoldedScreens,
  'halftone-fade': drawHalftoneFade,
  'scan-tides': drawScanTides,
  'paper-folds': drawPaperFolds,
  'growth-loops': drawGrowthLoops,
  'street-grid': drawStreetGrid,
  'torn-paper': drawTornPaper,
  'peg-wraps': drawPegWraps,
  'river-courses': drawRiverCourses,
  'banded-ribbons': drawBandedRibbons,
};

// theme macroCluster → family affinity (seeded pick between two candidates so
// different decks in the same theme still vary)
export const CLUSTER_AFFINITY = {
  editorial: [
    'banded-ribbons',
    'folded-screens',
    'scan-tides',
    'river-courses',
    'flow-ribbons',
    'wash-flow',
    'ink-scribble',
    'cargo-dashes',
    'flow-streams',
    'shard-mesh',
    'meadow-streaks',
  ],
  pitch: [
    'banded-ribbons',
    'halftone-fade',
    'scan-tides',
    'street-grid',
    'peg-wraps',
    'block-mosaic',
    'hex-lattice',
    'drift-web',
    'light-edges',
    'weave-dashes',
    'circle-pack',
    'flow-ribbons',
  ],
  organic: [
    'wash-flow',
    'river-courses',
    'torn-paper',
    'growth-loops',
    'paper-folds',
    'halftone-fade',
    'sediment-layers',
    'meadow-streaks',
    'flow-ribbons',
    'circle-pack',
  ],
  consulting: [
    'street-grid',
    'peg-wraps',
    'block-mosaic',
    'hex-lattice',
    'strata-lines',
    'light-edges',
    'drift-web',
    'weave-dashes',
    'shard-mesh',
  ],
  financial: ['strata-lines', 'folded-screens', 'sediment-layers', 'shard-mesh', 'weave-dashes'],
  hr: [
    'nib-flourish',
    'torn-paper',
    'growth-loops',
    'paper-folds',
    'ink-scribble',
    'circle-pack',
    'meadow-streaks',
  ],
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
  // version dispatch (the freeze discipline, mechanized): the artifact's own
  // v decides the pipeline. v1 = bare frozen family, byte-covered by the
  // freeze fixture; v2 adds the palette guard + event flourish around it.
  const v = decor.v ?? 1;
  const pal = v >= 2 ? guardPalette(palette) : palette;
  const janky = v >= 3 && decor.janky;
  if (janky) {
    ctx.save();
    jankyTransform(ctx, decor, { x, y, w, h });
  }
  fn(ctx, {
    palette: pal,
    seed: decor.seed ?? 1,
    x,
    y,
    w,
    h,
    intensity,
    personality: decor.personality,
  });
  if (janky) ctx.restore(); // only the family plate is mis-set; overlays stay straight
  if (v >= 2) {
    if (decor.rare && RARE_TRAITS[decor.family]) {
      // rare signature element: lanes off the artifact hash, so every
      // slide of a rare deck carries the same signature deterministically
      const R = makeHashRand(`${decor.hash ?? decor.seed}:rare`);
      RARE_TRAITS[decor.family](ctx, R, { x, y, w, h });
    }
    const ev = activeDecorEvent(decor.at);
    if (ev) drawEventFlourish(ctx, decor, ev, { palette: pal, x, y, w, h });
  }
  if (v >= 3) {
    drawGrain(ctx, decor, { x, y, w, h, intensity });
    drawSerialMark(ctx, decor, { palette: pal, x, y, h });
  }
  return true;
}

// --- credits (Sprint 59, showcase/attribution data) ---------------------------
// Every family's lineage, structured. RECIPE-ONLY families are independent
// reimplementations of ideas — zero code copied — with attribution offered
// as goodwill beyond what the recipe-port pattern requires. meadow-streaks
// descends from the corpus's single CC BY (code-portable) work.
export const DECOR_CREDITS = {
  'flow-streams': {
    after: 'perlin-flow tradition',
    by: 'Amin Moussa / Kjetil Golid recipes',
    src: 'P5 idiom registry',
  },
  'weave-dashes': { after: 'weave', by: 'Kjetil Golid', src: 'p5ycho/weave (recipe)' },
  'circle-pack': { after: 'shape packing essays', by: 'Gorilla Sun / Amin Moussa', src: 'recipe' },
  'shard-mesh': {
    after: 'delaunay–voronoi recipes',
    by: 'Amin Moussa',
    src: 'recipe (jittered-grid approx.)',
  },
  'meadow-streaks': {
    after: 'Fragments of an Infinite Field',
    by: 'Monica Rizzolli',
    src: 'Art Blocks #159 · CC BY',
  },
  'flow-ribbons': { after: 'Fidenza', by: 'Tyler Hobbs', src: 'Art Blocks #78 · recipe-only' },
  'banded-ribbons': {
    after: 'Fidenza (二代研读: fat ribbon + 分段色块)',
    by: 'Tyler Hobbs',
    src: 'Art Blocks #78 · recipe-only',
  },
  'block-mosaic': { after: 'Archetype', by: 'Kjetil Golid', src: 'Art Blocks #23 · recipe-only' },
  'wash-flow': {
    after: 'Watercolor Dreams',
    by: 'NumbersInMotion',
    src: 'Art Blocks #59 · recipe-only',
  },
  'strata-lines': { after: 'Apparitions', by: 'Aaron Penne', src: 'Art Blocks #28 · recipe-only' },
  'sediment-layers': {
    after: 'Neural Sediments',
    by: 'Eko33',
    src: 'Art Blocks #418 · recipe-only',
  },
  'ink-scribble': { after: 'INK', by: 'Iskra Velitchkova', src: 'Art Blocks #497 · recipe-only' },
  'light-edges': {
    after: 'Box Light Studies',
    by: 'Zach Lieberman',
    src: 'Art Blocks #499 · recipe-only',
  },
  'nib-flourish': { after: 'Cytographia', by: 'Golan Levin', src: 'Art Blocks #487 · recipe-only' },
  'hex-lattice': { after: 'while true', by: 'Lars Wander', src: 'Art Blocks #498 · recipe-only' },
  'drift-web': { after: 'Naïve', by: 'Olga Fradina', src: 'Art Blocks #483 · recipe-only' },
  'cargo-dashes': { after: 'Cargo', by: 'Kim Asendorf', src: 'Art Blocks #426 · recipe-only' },
  'folded-screens': {
    after: 'Screens',
    by: 'Thomas Lin Pedersen',
    src: 'Art Blocks #255 · recipe-only',
  },
  'halftone-fade': { after: 'RASTER', by: 'itsgalo', src: 'Art Blocks #341 · recipe-only' },
  'scan-tides': {
    after: 'Tide Predictor',
    by: 'LoVid',
    src: 'Art Blocks #376 · recipe-only (ND, strict)',
  },
  'paper-folds': { after: 'ORI', by: 'James Merrill', src: 'Art Blocks #379 · recipe-only' },
  'growth-loops': {
    after: 'Spaghetti Bones',
    by: 'Joshua Bagley',
    src: 'Art Blocks #456 · recipe-only',
  },
  'street-grid': {
    after: 'BUSY / BUSIEST',
    by: 'James Merrill',
    src: 'Art Blocks #504/#503 · recipe-only',
  },
  'torn-paper': {
    after: 'Memories of Qilin',
    by: 'Emily Xie',
    src: 'Art Blocks #282 · recipe-only',
  },
  'peg-wraps': { after: 'Ringers', by: 'Dmitri Cherniak', src: 'Art Blocks #13 · recipe-only' },
  'river-courses': {
    after: 'Ancient Courses of Fictional Rivers',
    by: 'Robert Hodgin',
    src: 'Art Blocks #284 · recipe-only',
  },
};

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
export function decorFromHash(theme, hash, { v, serial } = {}) {
  const R = makeHashRand(hash);
  const cluster = String(theme?.macroCluster || theme?.id || '').split('-')[0];
  const candidates = CLUSTER_AFFINITY[cluster] || ['flow-streams', 'weave-dashes'];
  const family = R.pick('family', candidates);
  const ver = v ?? DECOR_V;
  // Sprint 60/61: the collectible gate — its own lane, artifact-level.
  // Eligibility follows the MINT version: v2 opened five families, v3 all.
  const rareEligible = ver >= 3 ? family in RARE_TRAITS : RARE_FIVE.includes(family);
  return {
    family,
    rare: rareEligible && R.chance('rare-trait', RARE_CHANCE),
    // v3 lanes (older pins simply never read them):
    ...(ver >= 3
      ? {
          janky: R.chance('janky', 0.12),
          grain: R.chance('grainy-batch', 0.3) ? R.range('grain', 0.4, 1) : 0,
        }
      : {}),
    ...(serial != null ? { serial } : {}),
    seed: R.int('seed', 1, 0x7ffffffe),
    // Sprint 49 (Golid personality bundles + Watercolor rarity ladder):
    // most mints are 'balanced', a weighted minority carry a distinct
    // temperament. New lane — old mints (no personality field) resolve to
    // 'balanced' in the families, keeping their pixels frozen.
    personality: R.weighted('personality', [
      ['calm', 2],
      ['balanced', 5],
      ['wild', 2],
    ]),
    hash,
    // new mints get the current engine version; re-opens pass the v the
    // artifact was minted under so its pixels never drift (freeze contract)
    v: ver,
  };
}
