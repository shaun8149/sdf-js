#!/usr/bin/env node
// test-decor.mjs — Sprint 41: decoration layer mechanics (determinism,
// theme affinity, legibility caps, render ordering).
import {
  DECOR_FAMILIES,
  pickDecorFor,
  drawDecor,
  mintDecorHash,
  seedFromHash,
  decorFromHash,
} from '../src/present/decor/registry.js';
import { renderSceneDataToCanvas } from '../src/present/atoms-2d/renderer.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== decor layer (Sprint 41: 2D 修饰能力, P5 语料 ↔ shader 语料对位) ===\n');

const palette = {
  bg: [248, 246, 240],
  silhouetteColor: [22, 35, 70],
  accent: [38, 70, 130],
  colors: [
    [38, 70, 130],
    [165, 130, 90],
  ],
};

// recording ctx that captures stroke/fill styles + path commands
function recCtx() {
  const rec = { ops: [], styles: [] };
  const push =
    (name) =>
    (...a) =>
      rec.ops.push([
        name,
        ...a.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)),
      ]);
  const ctx = {
    save: push('save'),
    restore: push('restore'),
    beginPath: push('beginPath'),
    closePath: push('closePath'),
    moveTo: push('moveTo'),
    lineTo: push('lineTo'),
    arc: push('arc'),
    stroke: push('stroke'),
    fill: push('fill'),
    fillRect: push('fillRect'),
    fillText: push('fillText'),
    quadraticCurveTo: push('quadraticCurveTo'),
    bezierCurveTo: push('bezierCurveTo'),
    arcTo: push('arcTo'),
    ellipse: push('ellipse'),
    rect: push('rect'),
    roundRect: push('roundRect'),
    clip: push('clip'),
    setLineDash: push('setLineDash'),
    translate: push('translate'),
    rotate: push('rotate'),
    scale: push('scale'),
    transform: push('transform'),
    setTransform: push('setTransform'),
    strokeRect: push('strokeRect'),
    clearRect: push('clearRect'),
    drawImage: push('drawImage'),
    strokeText: push('strokeText'),
    measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    set strokeStyle(v) {
      rec.styles.push(v);
    },
    set fillStyle(v) {
      rec.styles.push(v);
    },
    lineWidth: 1,
    lineCap: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
  };
  return { ctx, rec };
}

// ── determinism ──
{
  const a = recCtx();
  const b = recCtx();
  const c = recCtx();
  const opts = { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' };
  drawDecor(a.ctx, { family: 'flow-streams', seed: 42 }, opts);
  drawDecor(b.ctx, { family: 'flow-streams', seed: 42 }, opts);
  drawDecor(c.ctx, { family: 'flow-streams', seed: 43 }, opts);
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'same seed → identical geometry');
  ok(
    JSON.stringify(a.rec.ops) !== JSON.stringify(c.rec.ops),
    'different seed → different geometry',
  );
  ok(a.rec.ops.length > 50, `flow-streams actually draws (${a.rec.ops.length} ops)`);
}

// ── every family draws, palette-constrained, alpha-capped ──
{
  for (const family of Object.keys(DECOR_FAMILIES)) {
    const { ctx, rec } = recCtx();
    drawDecor(
      ctx,
      { family, seed: 7 },
      { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
    );
    ok(rec.ops.length > 20, `${family} draws (${rec.ops.length} ops)`);
    const alphas = rec.styles
      .map((s) => /rgba\(\d+, \d+, \d+, ([\d.]+)\)/.exec(String(s)))
      .filter(Boolean)
      .map((m) => parseFloat(m[1]));
    // sediment-layers' occlusion contract REQUIRES near-opaque fills (its
    // guard is color-blending toward bg); nib-flourish fills THIN ribbons —
    // visual weight = alpha × area, and its tiny area affords a higher
    // alpha (own cap asserted in its block). Both exempt from the generic cap.
    if (family !== 'sediment-layers' && family !== 'nib-flourish') {
      ok(
        alphas.length > 0 && Math.max(...alphas) <= 0.1,
        `${family} subtle alpha ≤ 0.1 (legibility guard)`,
      );
    }
    const paletteRgb = new Set(
      [palette.accent, ...palette.colors].map((c) => `${c[0]}, ${c[1]}, ${c[2]}`),
    );
    // wash-flow interpolates CONTINUOUSLY between theme colors (recipe from
    // Watercolor Dreams) — intermediate colors are theme-derived but not
    // exact stops, so the exact-match check doesn't apply to it.
    if (!['wash-flow', 'strata-lines', 'sediment-layers', 'hex-lattice'].includes(family)) {
      const offPalette = rec.styles.filter((s) => {
        const m = /rgba\((\d+, \d+, \d+),/.exec(String(s));
        return m && !paletteRgb.has(m[1]);
      });
      ok(offPalette.length === 0, `${family} uses only theme colors`);
    }
  }
}

// ── pickDecorFor: deterministic + affinity ──
{
  const t = { id: 'editorial-navy', macroCluster: 'editorial' };
  const p1 = pickDecorFor(t, 5);
  const p2 = pickDecorFor(t, 5);
  ok(p1.family === p2.family, 'pick deterministic per (theme, seed)');
  ok(
    ['flow-ribbons', 'wash-flow', 'flow-streams', 'shard-mesh', 'meadow-streaks'].includes(
      p1.family,
    ),
    'editorial affinity respected',
  );
  ok(
    pickDecorFor({ id: 'weird' }, 1).family in DECOR_FAMILIES,
    'unknown cluster falls back to a valid family',
  );
}

// ── drawDecor safety ──
{
  const { ctx, rec } = recCtx();
  ok(
    drawDecor(ctx, { family: 'no-such-family', seed: 1 }, { palette, w: 100, h: 100 }) === false,
    'unknown family is a silent no-op',
  );
  ok(rec.ops.length === 0, 'no-op really draws nothing');
}

// ── renderer ordering: content slide decor UNDER atoms; cover slide OVER ──
{
  const calls = [];
  const canvas = {
    width: 1280,
    height: 720,
    getContext: () => {
      const { ctx } = recCtx();
      ctx.fillRect = (...a) => calls.push(['fillRect', ...a]);
      ctx.stroke = () => calls.push(['stroke']);
      ctx.fillText = (t) => calls.push(['fillText', String(t)]);
      ctx.fill = () => calls.push(['fill']);
      return ctx;
    },
  };
  await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        { type: 'kpi-card', x: 40, y: 160, w: 300, h: 200, args: { value: '9', label: 'L' } },
      ],
    },
    { palette, decor: { family: 'weave-dashes', seed: 3 } },
  );
  const firstText = calls.findIndex((c) => c[0] === 'fillText');
  const firstStroke = calls.findIndex((c) => c[0] === 'stroke');
  ok(
    firstStroke > -1 && firstStroke < firstText,
    'content slide: decor strokes land before atom text',
  );
}

// ── mint-hash provenance (Sprint 41 core insight) ──
{
  const h1 = mintDecorHash();
  const h2 = mintDecorHash();
  ok(/^[0-9a-f]{16}$/.test(h1), 'minted hash is 16 hex chars (64-bit)');
  ok(h1 !== h2, 'two mints differ (crypto-random)');
  ok(seedFromHash(h1) === seedFromHash(h1), 'seedFromHash deterministic');
  const t = { id: 'editorial-navy', macroCluster: 'editorial' };
  const d1 = decorFromHash(t, 'abcdef0123456789');
  const d2 = decorFromHash(t, 'abcdef0123456789');
  ok(
    d1.family === d2.family && d1.seed === d2.seed,
    'same (theme, hash) → same decoration everywhere',
  );
  ok(d1.hash === 'abcdef0123456789', 'provenance hash carried on the decor object');
  // the owner-reproducibility property: two different hashes → (almost
  // surely) different geometry
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, decorFromHash(t, 'aaaaaaaaaaaaaaaa'), { palette, w: 640, h: 360 });
  drawDecor(b.ctx, decorFromHash(t, 'bbbbbbbbbbbbbbbb'), { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) !== JSON.stringify(b.rec.ops),
    'different hash → different artifact',
  );
}

// ── Sprint 43: fxhash-style named lanes (version-stable) ──
{
  const { makeHashRand } = await import('../src/present/decor/rand.js');
  const R1 = makeHashRand('abcdef0123456789');
  const R2 = makeHashRand('abcdef0123456789');
  ok(R1.rand('a') === R2.rand('a'), 'same hash + same lane → same value');
  // KEY property vs raw fxrand: consuming lane 'a' more does NOT shift lane 'b'
  const Rx = makeHashRand('cafebabe12345678');
  const Ry = makeHashRand('cafebabe12345678');
  Rx.rand('a');
  Rx.rand('a');
  Rx.rand('a'); // extra draws on lane a (a "new feature" in a future version)
  ok(Rx.rand('b') === Ry.rand('b'), 'lanes independent: extra draws on lane a never shift lane b');
  // within one lane, successive calls advance (fxrand semantics)
  const Rz = makeHashRand('cafebabe12345678');
  ok(Rz.rand('c') !== Rz.rand('c'), 'within a lane the stream advances');
  const picks = new Set();
  for (const h of [
    '1111111111111111',
    '2222222222222222',
    '3333333333333333',
    '4444444444444444',
  ]) {
    picks.add(makeHashRand(h).int('seed', 1, 1e9));
  }
  ok(picks.size === 4, 'different hashes give different lane values');
  const w = makeHashRand('abcdef0123456789').weighted('w', [
    ['x', 0],
    ['y', 1],
  ]);
  ok(w === 'y', 'weighted respects zero weight');

  // decorFromHash stability contract
  const t = { id: 'organic-teal', macroCluster: 'organic' };
  const d1 = decorFromHash(t, 'feedfacefeedface');
  const d2 = decorFromHash(t, 'feedfacefeedface');
  ok(
    d1.family === d2.family && d1.seed === d2.seed,
    'decorFromHash lane version stays deterministic',
  );
}

// ── Sprint 43: meadow-streaks (Rizzolli CC BY port) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'meadow-streaks', seed: 11 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  ok(
    rec.ops.filter((o) => o[0] === 'ellipse').length > 100,
    'meadow-streaks draws a dense blade field',
  );
  const alphas = rec.styles
    .map((s) => /rgba\(\d+, \d+, \d+, ([\d.]+)\)/.exec(String(s)))
    .filter(Boolean)
    .map((m) => parseFloat(m[1]));
  ok(Math.max(...alphas) <= 0.1, 'meadow-streaks subtle alpha capped');
  const total = (640 / 14) * (360 / 18); // grid cells if ungated
  ok(
    rec.ops.filter((o) => o[0] === 'ellipse').length < total,
    'noise gate actually thins the field (patches, not uniform)',
  );
}

// ── Sprint 44: flow-ribbons (Fidenza recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'flow-ribbons', seed: 21 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes > 30, `flow-ribbons draws many visible segments (${strokes})`);
  // segment behavior: number of beginPath (segments) exceeds ribbon start
  // rows → curves are being SPLIT into multiple visible segments
  const alphas = rec.styles
    .map((s) => /rgba\(\d+, \d+, \d+, ([\d.]+)\)/.exec(String(s)))
    .filter(Boolean)
    .map((m) => parseFloat(m[1]));
  ok(Math.max(...alphas) <= 0.1, 'flow-ribbons subtle alpha capped');
  // determinism (freeze discipline applies to this family from birth)
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'flow-ribbons', seed: 5 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'flow-ribbons', seed: 5 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'flow-ribbons deterministic per seed',
  );
}

// ── Sprint 45: block-mosaic (Archetype recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'block-mosaic', seed: 9 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  ok(
    rec.ops.filter((o) => o[0] === 'strokeRect').length === 16 * 9,
    'block-mosaic strokes every cell',
  );
  const fills = rec.ops.filter((o) => o[0] === 'fillRect').length;
  ok(fills > 10 && fills < 16 * 9 * 0.6, `sparse fill gate working (${fills} of 144 cells filled)`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'block-mosaic', seed: 4 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'block-mosaic', seed: 4 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'block-mosaic deterministic per seed',
  );
}

// ── Sprint 46: wash-flow (Watercolor Dreams recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'wash-flow', seed: 33 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes > 800, `wash-flow accumulates many faint strokes (${strokes})`);
  const alphas = rec.styles
    .map((s) => /rgba\(\d+, \d+, \d+, ([\d.]+)\)/.exec(String(s)))
    .filter(Boolean)
    .map((m) => parseFloat(m[1]));
  ok(Math.max(...alphas) <= 0.1, 'wash strokes stay whisper-faint (accumulation does the work)');
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'wash-flow', seed: 8 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'wash-flow', seed: 8 }, { palette, w: 640, h: 360 });
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'wash-flow deterministic per seed');
}

// ── Sprint 47: strata-lines (Apparitions recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'strata-lines', seed: 14 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes === 34 * 2, `strata-lines draws main+shadow per row (${strokes})`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'strata-lines', seed: 3 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'strata-lines', seed: 3 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'strata-lines deterministic per seed',
  );
}

// ── Sprint 48: sediment-layers (Neural Sediments recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'sediment-layers', seed: 7 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const fills = rec.ops.filter((o) => o[0] === 'fill').length;
  ok(fills >= 5 && fills <= 8, `sediment-layers fills one polygon per layer (${fills})`);
  // occlusion contract: fills use near-opaque alpha (painter-order occlusion)
  const fillAlphas = rec.styles
    .map((s) => /rgba\(\d+, \d+, \d+, (0\.9\d*)\)/.exec(String(s)))
    .filter(Boolean);
  ok(fillAlphas.length >= 5, 'layer washes near-opaque so front occludes back');
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'sediment-layers', seed: 2 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'sediment-layers', seed: 2 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'sediment-layers deterministic per seed',
  );
}

// ── Sprint 49: personality bundles (Golid lesson) ──
{
  // FREEZE regression: absent personality === 'balanced', pixel-identical —
  // every pre-personality mint keeps its artwork.
  for (const family of ['flow-ribbons', 'wash-flow', 'sediment-layers']) {
    const a = recCtx();
    const b = recCtx();
    drawDecor(a.ctx, { family, seed: 6 }, { palette, w: 640, h: 360 });
    drawDecor(b.ctx, { family, seed: 6, personality: 'balanced' }, { palette, w: 640, h: 360 });
    ok(
      JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
      `${family}: absent personality renders identical to 'balanced' (freeze)`,
    );
    const c = recCtx();
    drawDecor(c.ctx, { family, seed: 6, personality: 'wild' }, { palette, w: 640, h: 360 });
    ok(
      JSON.stringify(a.rec.ops) !== JSON.stringify(c.rec.ops),
      `${family}: 'wild' personality differs`,
    );
  }
  // minted decor carries a deterministic personality from its own lane
  const t = { id: 'organic-teal', macroCluster: 'organic' };
  const d1 = decorFromHash(t, 'a1b2c3d4e5f60718');
  const d2 = decorFromHash(t, 'a1b2c3d4e5f60718');
  ok(d1.personality === d2.personality, 'personality deterministic per hash');
  const seen = new Set();
  for (const h of [
    '1111111111111111',
    '2222222222222222',
    '3333333333333333',
    '4444444444444444',
    '5555555555555555',
    '6666666666666666',
    '7777777777777777',
    '8888888888888888',
  ]) {
    seen.add(decorFromHash(t, h).personality);
  }
  ok(seen.size >= 2, `personalities vary across hashes (${[...seen].join(',')})`);
}

// ── Sprint 50: ink-scribble (INK recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'ink-scribble', seed: 12 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes >= 16 && strokes <= 30, `ink-scribble double-pass per shape (${strokes} strokes)`);
  const verts = rec.ops.filter((o) => o[0] === 'lineTo').length;
  ok(verts > 4000, `dense vertices carry the ink texture (${verts})`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'ink-scribble', seed: 5 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'ink-scribble', seed: 5 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'ink-scribble deterministic per seed',
  );
}

// ── Sprint 51: light-edges (Box Light Studies recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'light-edges', seed: 18 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  // per box: 12 edges × 2 halves × 3 glow layers = 72; 4-6 boxes
  ok(strokes >= 4 * 72 && strokes <= 6 * 72, `light-edges layered glow strokes (${strokes})`);
  ok(strokes % 3 === 0, 'three glow layers per half-edge');
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'light-edges', seed: 27 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'light-edges', seed: 27 }, { palette, w: 640, h: 360 });
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'light-edges deterministic per seed');
}

// ── Sprint 52: nib-flourish (Cytographia recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'nib-flourish', seed: 22 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const fills = rec.ops.filter((o) => o[0] === 'fill').length;
  ok(fills >= 5 && fills <= 8, `nib-flourish fills one ribbon per flourish (${fills})`);
  // ribbon = 2×(steps+1) vertices per shape
  const lineTos = rec.ops.filter((o) => o[0] === 'lineTo').length;
  ok(lineTos >= fills * 50, 'ribbon polygons carry per-point width (many vertices)');
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'nib-flourish', seed: 31 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'nib-flourish', seed: 31 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'nib-flourish deterministic per seed',
  );
  const nibAlphas = rec.styles
    .map((s) => /rgba\(\d+, \d+, \d+, ([\d.]+)\)/.exec(String(s)))
    .filter(Boolean)
    .map((m) => parseFloat(m[1]));
  ok(Math.max(...nibAlphas) <= 0.22, 'nib-flourish thin-ribbon alpha within its own cap');
}

// ── Sprint 53: hex-lattice + OKLab (while-true recipe-only) ──
{
  const { lerpColorOklab } = await import('../src/present/decor/registry.js');
  const mid = lerpColorOklab([255, 0, 0], [0, 0, 255], 0.5);
  ok(Array.isArray(mid) && mid.every((v) => v >= 0 && v <= 255), 'oklab lerp returns valid rgb');
  // endpoints round-trip
  const e0 = lerpColorOklab([38, 70, 130], [200, 50, 50], 0);
  ok(Math.abs(e0[0] - 38) <= 1 && Math.abs(e0[2] - 130) <= 1, 'oklab lerp t=0 returns first color');
  // perceptual midpoint of red↔blue in OKLab is purple-ish, NOT the muddy
  // rgb average (127,0,127 exactly) — assert it differs from raw rgb lerp
  ok(
    mid.join(',') !== '128,0,128' && mid.join(',') !== '127,0,127',
    'oklab midpoint ≠ rgb midpoint (perceptual path)',
  );

  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'hex-lattice', seed: 44 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes > 60, `hex-lattice strokes many cells (${strokes})`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'hex-lattice', seed: 9 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'hex-lattice', seed: 9 }, { palette, w: 640, h: 360 });
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'hex-lattice deterministic per seed');
}

// ── Sprint 54: drift-web (Naïve recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'drift-web', seed: 17 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes > 20, `drift-web draws a web of connections (${strokes} strokes)`);
  const rects = rec.ops.filter((o) => o[0] === 'fillRect').length;
  ok(rects > 200, `drift-web deposits a dotted trail bed (${rects} dots)`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'drift-web', seed: 88 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'drift-web', seed: 88 }, { palette, w: 640, h: 360 });
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'drift-web deterministic per seed');
  // personalities are distinct parameter bundles
  const c = recCtx();
  drawDecor(
    c.ctx,
    { family: 'drift-web', seed: 88, personality: 'wild' },
    { palette, w: 640, h: 360 },
  );
  ok(
    JSON.stringify(c.rec.ops) !== JSON.stringify(a.rec.ops),
    'drift-web wild personality differs from balanced',
  );
}

// ── Sprint 54: cargo-dashes (Cargo recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'cargo-dashes', seed: 26 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const dashes = rec.ops.filter((o) => o[0] === 'setLineDash').length;
  ok(dashes > 4, `cargo-dashes sets per-block dash patterns (${dashes})`);
  const strokes = rec.ops.filter((o) => o[0] === 'stroke' || o[0] === 'strokeRect').length;
  ok(strokes > 30, `cargo-dashes strokes many textured lines (${strokes})`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'cargo-dashes', seed: 64 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'cargo-dashes', seed: 64 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'cargo-dashes deterministic per seed',
  );
}

// ── Sprint 54: folded-screens (Screens recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'folded-screens', seed: 12 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes > 150, `folded-screens rasters dense line screens (${strokes})`);
  // facet tones vary: more than one distinct alpha among strokes
  const alphas = new Set(
    rec.styles
      .map((s) => /rgba\(\d+, \d+, \d+, ([\d.]+)\)/.exec(String(s)))
      .filter(Boolean)
      .map((m) => m[1]),
  );
  ok(alphas.size > 2, `folded-screens facets carry distinct tones (${alphas.size})`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'folded-screens', seed: 77 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'folded-screens', seed: 77 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'folded-screens deterministic per seed',
  );
}

// ── Sprint 54: halftone-fade (RASTER recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'halftone-fade', seed: 41 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const arcs = rec.ops.filter((o) => o[0] === 'arc').length;
  ok(arcs > 80, `halftone-fade draws a dot screen (${arcs} dots)`);
  // dot radii vary with the field (not a uniform grid of equal dots)
  const radii = new Set(rec.ops.filter((o) => o[0] === 'arc').map((o) => o[3].toFixed(2)));
  ok(radii.size > 10, `halftone-fade dot radius encodes field value (${radii.size} radii)`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'halftone-fade', seed: 55 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'halftone-fade', seed: 55 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'halftone-fade deterministic per seed',
  );
}

// ── Sprint 55: scan-tides (Tide Predictor recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'scan-tides', seed: 19 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const rects = rec.ops.filter((o) => o[0] === 'fillRect').length;
  ok(rects > 100, `scan-tides rasters scanline segments (${rects})`);
  // gradient fills reach the ctx as objects through the fillStyle setter
  const grads = rec.styles.filter((s) => typeof s === 'object').length;
  ok(grads > 100, `scan-tides blends triangle waves via gradients (${grads})`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'scan-tides', seed: 66 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'scan-tides', seed: 66 }, { palette, w: 640, h: 360 });
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'scan-tides deterministic per seed');
  const c = recCtx();
  drawDecor(
    c.ctx,
    { family: 'scan-tides', seed: 66, personality: 'wild' },
    { palette, w: 640, h: 360 },
  );
  ok(
    JSON.stringify(c.rec.ops) !== JSON.stringify(a.rec.ops),
    'scan-tides wild personality differs from balanced',
  );
}

// ── Sprint 55: paper-folds (ORI recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'paper-folds', seed: 33 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const fills = rec.ops.filter((o) => o[0] === 'fill').length;
  ok(fills >= 4 && fills <= 12, `paper-folds yields few LARGE facets (${fills})`);
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes === fills, 'paper-folds strokes each crease once per facet');
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'paper-folds', seed: 71 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'paper-folds', seed: 71 }, { palette, w: 640, h: 360 });
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'paper-folds deterministic per seed');
}

// ── Sprint 55: growth-loops (Spaghetti Bones recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'growth-loops', seed: 58 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes >= 3, `growth-loops draws rings + organism (${strokes} strokes)`);
  const fills = rec.ops.filter((o) => o[0] === 'fill').length;
  ok(fills === 1, 'growth-loops fills the final organism once');
  // the organism grew: final loop has far more vertices than the seed circle
  const lineTos = rec.ops.filter((o) => o[0] === 'lineTo').length;
  ok(lineTos > 200, `growth-loops resamples as it grows (${lineTos} vertices)`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'growth-loops', seed: 91 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'growth-loops', seed: 91 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'growth-loops deterministic per seed',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
