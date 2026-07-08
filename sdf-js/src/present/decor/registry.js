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

// --- registry ----------------------------------------------------------------

// FREEZE DISCIPLINE (Sprint 43, the complete fxhash lesson): fxhash's
// "hash = artwork" holds because of fxrand AND immutable on-chain code.
// Off-chain we adapt it as version pinning: DECOR_V is stamped into every
// minted decoration, and a family implementation, once shipped under a
// version, is FROZEN — never edit its pixels; behavioral changes ship as a
// new versioned function and drawDecor dispatches on the artifact's own v.
// Named lanes protect DECISIONS across versions; the freeze protects PIXELS.
export const DECOR_V = 1;

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
};

// theme macroCluster → family affinity (seeded pick between two candidates so
// different decks in the same theme still vary)
const CLUSTER_AFFINITY = {
  editorial: [
    'flow-ribbons',
    'wash-flow',
    'ink-scribble',
    'flow-streams',
    'shard-mesh',
    'meadow-streaks',
  ],
  pitch: ['block-mosaic', 'light-edges', 'weave-dashes', 'circle-pack', 'flow-ribbons'],
  organic: ['wash-flow', 'sediment-layers', 'meadow-streaks', 'flow-ribbons', 'circle-pack'],
  consulting: ['block-mosaic', 'strata-lines', 'light-edges', 'weave-dashes', 'shard-mesh'],
  financial: ['strata-lines', 'sediment-layers', 'shard-mesh', 'weave-dashes'],
  hr: ['nib-flourish', 'ink-scribble', 'circle-pack', 'meadow-streaks'],
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
  fn(ctx, {
    palette,
    seed: decor.seed ?? 1,
    x,
    y,
    w,
    h,
    intensity,
    personality: decor.personality,
  });
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
    v: DECOR_V,
  };
}
