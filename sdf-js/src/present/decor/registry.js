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
    ctx.fillStyle = rgba(col, P.alphaFill * (0.6 + 0.5 * tone));
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
      const g = ctx.createLinearGradient(x + rx, 0, x + rx + segW, 0);
      g.addColorStop(0, rgba(lerpColorOklab(cA, cB, t0), P.alphaFill));
      g.addColorStop(1, rgba(lerpColorOklab(cA, cB, t1), P.alphaFill));
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
  'hex-lattice': drawHexLattice,
  'drift-web': drawDriftWeb,
  'cargo-dashes': drawCargoDashes,
  'folded-screens': drawFoldedScreens,
  'halftone-fade': drawHalftoneFade,
  'scan-tides': drawScanTides,
  'paper-folds': drawPaperFolds,
  'growth-loops': drawGrowthLoops,
  'street-grid': drawStreetGrid,
};

// theme macroCluster → family affinity (seeded pick between two candidates so
// different decks in the same theme still vary)
const CLUSTER_AFFINITY = {
  editorial: [
    'folded-screens',
    'scan-tides',
    'flow-ribbons',
    'wash-flow',
    'ink-scribble',
    'cargo-dashes',
    'flow-streams',
    'shard-mesh',
    'meadow-streaks',
  ],
  pitch: [
    'halftone-fade',
    'scan-tides',
    'street-grid',
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
    'halftone-fade',
    'sediment-layers',
    'meadow-streaks',
    'flow-ribbons',
    'circle-pack',
  ],
  consulting: [
    'street-grid',
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
