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
    if (
      !['wash-flow', 'strata-lines', 'sediment-layers', 'hex-lattice', 'banded-ribbons'].includes(
        family,
      )
    ) {
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
    [
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
    ].includes(p1.family),
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

// ── Sprint 55: street-grid (BUSY/BUSIEST recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'street-grid', seed: 14 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes > 15, `street-grid draws rails, ties and corners (${strokes})`);
  const arcs = rec.ops.filter((o) => o[0] === 'arc').length;
  ok(arcs >= 1, `street-grid rounds some corners with quarter arcs (${arcs})`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'street-grid', seed: 82 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'street-grid', seed: 82 }, { palette, w: 640, h: 360 });
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'street-grid deterministic per seed');
}

// ── Sprint 56: torn-paper (Qilin recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'torn-paper', seed: 24 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const fills = rec.ops.filter((o) => o[0] === 'fill').length;
  ok(fills >= 3 && fills <= 9, `torn-paper layers a few patches (${fills})`);
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes === fills, 'torn-paper rims every patch with a deckle edge');
  const lineTos = rec.ops.filter((o) => o[0] === 'lineTo').length;
  ok(lineTos >= fills * 40, 'torn-paper edges carry the 46-point roughness');
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'torn-paper', seed: 93 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'torn-paper', seed: 93 }, { palette, w: 640, h: 360 });
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'torn-paper deterministic per seed');
}

// ── Sprint 56: peg-wraps (Ringers recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'peg-wraps', seed: 37 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const pegDots = rec.ops.filter((o) => o[0] === 'arc').length;
  ok(pegDots > 20, `peg-wraps draws the peg grid + bends + visit marks (${pegDots} arcs)`);
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes === 1, 'peg-wraps draws the string as ONE continuous path');
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'peg-wraps', seed: 46 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'peg-wraps', seed: 46 }, { palette, w: 640, h: 360 });
  ok(JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops), 'peg-wraps deterministic per seed');
  const c = recCtx();
  drawDecor(
    c.ctx,
    { family: 'peg-wraps', seed: 46, personality: 'calm' },
    { palette, w: 640, h: 360 },
  );
  ok(
    JSON.stringify(c.rec.ops) !== JSON.stringify(a.rec.ops),
    'peg-wraps calm personality differs from balanced',
  );
}

// ── Sprint 57: river-courses (Ancient Courses recipe-only) ──
{
  const { ctx, rec } = recCtx();
  drawDecor(
    ctx,
    { family: 'river-courses', seed: 44 },
    { palette, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
  );
  const strokes = rec.ops.filter((o) => o[0] === 'stroke').length;
  ok(strokes >= 4, `river-courses draws history + banks (${strokes} strokes)`);
  const lineTos = rec.ops.filter((o) => o[0] === 'lineTo').length;
  ok(lineTos > 150, `river-courses carries a meandered polyline (${lineTos} vertices)`);
  const a = recCtx();
  const b = recCtx();
  drawDecor(a.ctx, { family: 'river-courses', seed: 61 }, { palette, w: 640, h: 360 });
  drawDecor(b.ctx, { family: 'river-courses', seed: 61 }, { palette, w: 640, h: 360 });
  ok(
    JSON.stringify(a.rec.ops) === JSON.stringify(b.rec.ops),
    'river-courses deterministic per seed',
  );
}

// ── Sprint 59: DECOR_V=2 — freeze invariant + guard + event layer ──
{
  // 1. THE FREEZE INVARIANT: every v1 artifact must reproduce the digests
  // baked before the v2 engine existed. A mismatch here = frozen pixels
  // drifted = provenance broken. Do NOT "fix" by re-baking.
  const { bakeFreezeMap } = await import('./bake-decor-freeze.mjs');
  const { readFileSync } = await import('node:fs');
  const baked = JSON.parse(
    new TextDecoder().decode(readFileSync(new URL('./decor-freeze-v1.json', import.meta.url))),
  );
  const now2 = bakeFreezeMap();
  const missing = Object.keys(baked).filter((k) => !(k in now2));
  const drifted = Object.keys(baked).filter((k) => k in now2 && now2[k] !== baked[k]);
  ok(missing.length === 0, `freeze fixture keys all present (${missing.length} missing)`);
  ok(
    drifted.length === 0,
    `v1 pixels frozen byte-for-byte (${drifted.length} drifted: ${drifted.slice(0, 3).join(', ')})`,
  );

  // 2. new mints carry v2; re-opens can pin v1
  const t = { id: 'editorial-navy', macroCluster: 'editorial' };
  const { DECOR_V } = await import('../src/present/decor/registry.js');
  const m2 = decorFromHash(t, 'aabbccdd11223344');
  ok(m2.v === DECOR_V, `new mints stamped current version (v${DECOR_V})`);
  const m1 = decorFromHash(t, 'aabbccdd11223344', { v: 1 });
  ok(
    m1.v === 1 && m1.family === m2.family && m1.seed === m2.seed,
    'v override pins version, decisions unchanged',
  );

  // 3. WCAG guard: a bg-colored palette gets pushed to the contrast floor
  const { guardPalette } = await import('../src/present/decor/registry.js');
  const muddy = { accent: [244, 242, 236], colors: [[250, 248, 242]], bg: [248, 246, 240] };
  const guarded = guardPalette(muddy);
  ok(
    JSON.stringify(guarded.accent) !== JSON.stringify(muddy.accent),
    'guard moves a near-bg accent',
  );
  // and a healthy palette passes through untouched
  const healthy = guardPalette(palette);
  ok(
    JSON.stringify(healthy.accent) === JSON.stringify(palette.accent),
    'guard leaves healthy colors alone',
  );

  // 4. same hash, v1 vs v2 on a muddy theme → different ops (guard active)
  const mud = { accent: [244, 242, 236], colors: [[250, 248, 242]], bg: [248, 246, 240] };
  const a1 = recCtx();
  drawDecor(a1.ctx, { family: 'peg-wraps', seed: 5, v: 1 }, { palette: mud, w: 640, h: 360 });
  const a2 = recCtx();
  drawDecor(a2.ctx, { family: 'peg-wraps', seed: 5, v: 2 }, { palette: mud, w: 640, h: 360 });
  ok(
    JSON.stringify(a1.rec.styles) !== JSON.stringify(a2.rec.styles),
    'v2 guard changes colors on a muddy theme, v1 untouched',
  );

  // 5. event flourish: New Year adds ops; ordinary day does not; the look
  // is deterministic per hash and re-derivable via at
  const plain = recCtx();
  drawDecor(
    plain.ctx,
    { family: 'peg-wraps', seed: 5, hash: 'ffee', v: 2, at: '2027-03-14' },
    { palette, w: 640, h: 360 },
  );
  const ny1 = recCtx();
  drawDecor(
    ny1.ctx,
    { family: 'peg-wraps', seed: 5, hash: 'ffee', v: 2, at: '2027-01-01' },
    { palette, w: 640, h: 360 },
  );
  const ny2 = recCtx();
  drawDecor(
    ny2.ctx,
    { family: 'peg-wraps', seed: 5, hash: 'ffee', v: 2, at: '2027-01-01' },
    { palette, w: 640, h: 360 },
  );
  ok(ny1.rec.ops.length > plain.rec.ops.length, 'new-year flourish adds ornament ops');
  ok(
    JSON.stringify(ny1.rec.ops) === JSON.stringify(ny2.rec.ops),
    'event look deterministic per hash (re-derivable forever via at)',
  );
  // v1 artifacts never get the event layer
  const v1ny = recCtx();
  drawDecor(
    v1ny.ctx,
    { family: 'peg-wraps', seed: 5, hash: 'ffee', v: 1, at: '2027-01-01' },
    { palette, w: 640, h: 360 },
  );
  const v1plain = recCtx();
  drawDecor(
    v1plain.ctx,
    { family: 'peg-wraps', seed: 5, hash: 'ffee', v: 1, at: '2027-03-14' },
    { palette, w: 640, h: 360 },
  );
  ok(
    JSON.stringify(v1ny.rec.ops) === JSON.stringify(v1plain.rec.ops),
    'v1 artifacts ignore the calendar entirely',
  );
}

// ── Sprint 60: rare traits (collectible gate) ──
{
  const { RARE_TRAIT_FAMILIES } = await import('../src/present/decor/registry.js');
  ok(
    RARE_TRAIT_FAMILIES.length === 25,
    `all 25 families carry signature elements (${RARE_TRAIT_FAMILIES.length})`,
  );
  // gate statistics: ~3% of mints, artifact-level, deterministic per hash
  const t = { id: 'pitch-bold', macroCluster: 'pitch' };
  let rares = 0;
  let eligible = 0;
  for (let i = 0; i < 600; i++) {
    const d = decorFromHash(t, `stat-${i}`);
    if (RARE_TRAIT_FAMILIES.includes(d.family)) {
      eligible++;
      if (d.rare) rares++;
    } else {
      ok2: if (d.rare) {
        ok(false, 'non-flagship family minted rare');
        break ok2;
      }
    }
  }
  ok(eligible > 50, `flagship families appear in mints (${eligible}/600)`);
  ok(rares >= 1 && rares <= eligible * 0.12, `rare gate ~3% (${rares}/${eligible})`);
  const again = decorFromHash(t, 'stat-7');
  ok(again.rare === decorFromHash(t, 'stat-7').rare, 'rare gate deterministic per hash');

  // rare adds signature ops over the same family/seed; deterministic
  const base = recCtx();
  drawDecor(
    base.ctx,
    { family: 'peg-wraps', seed: 9, hash: 'raretest', v: 2 },
    { palette, w: 640, h: 360 },
  );
  const rare1 = recCtx();
  drawDecor(
    rare1.ctx,
    { family: 'peg-wraps', seed: 9, hash: 'raretest', v: 2, rare: true },
    { palette, w: 640, h: 360 },
  );
  const rare2 = recCtx();
  drawDecor(
    rare2.ctx,
    { family: 'peg-wraps', seed: 9, hash: 'raretest', v: 2, rare: true },
    { palette, w: 640, h: 360 },
  );
  ok(rare1.rec.ops.length > base.rec.ops.length, 'rare signature adds ops');
  ok(
    JSON.stringify(rare1.rec.ops) === JSON.stringify(rare2.rec.ops),
    'rare signature deterministic per hash',
  );
  // the signature speaks metal: a non-palette gold/crimson appears
  const metals = rare1.rec.styles.filter((st) =>
    /rgba\(212, 175, 55|rgba\(178, 34, 52/.test(String(st)),
  );
  ok(metals.length > 0, 'rare signature uses a metallic constant');
  // v1 artifacts ignore the rare flag entirely
  const v1rare = recCtx();
  drawDecor(
    v1rare.ctx,
    { family: 'peg-wraps', seed: 9, hash: 'raretest', v: 1, rare: true },
    { palette, w: 640, h: 360 },
  );
  const v1base = recCtx();
  drawDecor(
    v1base.ctx,
    { family: 'peg-wraps', seed: 9, hash: 'raretest', v: 1 },
    { palette, w: 640, h: 360 },
  );
  ok(
    JSON.stringify(v1rare.rec.ops) === JSON.stringify(v1base.rec.ops),
    'v1 artifacts ignore the rare flag',
  );
}

// ── Sprint 60: affinity coverage invariant ──
// Sprint 56-57 silently DROPPED families from CLUSTER_AFFINITY (a prettier-
// reformat made string replaces no-op) — torn-paper ended up reachable in
// NO cluster. This invariant makes that class of bug impossible to ship.
{
  const { CLUSTER_AFFINITY, DECOR_FAMILIES } = await import('../src/present/decor/registry.js');
  const reachable = new Set(Object.values(CLUSTER_AFFINITY).flat());
  const orphans = Object.keys(DECOR_FAMILIES).filter((f) => !reachable.has(f));
  ok(
    orphans.length === 0,
    `every family reachable in ≥1 cluster (orphans: ${orphans.join(', ') || 'none'})`,
  );
  const ghosts = [...reachable].filter((f) => !(f in DECOR_FAMILIES));
  ok(
    ghosts.length === 0,
    `affinity references only real families (ghosts: ${ghosts.join(', ') || 'none'})`,
  );
}

// ── Sprint 61: v2 freeze invariant + v3 (janky / grain / serial / eligibility) ──
{
  const { bakeFreezeMapV2 } = await import('./bake-decor-freeze.mjs');
  const { readFileSync } = await import('node:fs');
  const baked = JSON.parse(
    new TextDecoder().decode(readFileSync(new URL('./decor-freeze-v2.json', import.meta.url))),
  );
  const now2 = bakeFreezeMapV2();
  const drifted = Object.keys(baked).filter((k) => now2[k] !== baked[k]);
  ok(
    drifted.length === 0,
    `v2 pixels frozen byte-for-byte (${drifted.length} drifted: ${drifted.slice(0, 3).join(', ')})`,
  );

  const t = { id: 'editorial-navy', macroCluster: 'editorial' };
  // versioned rare eligibility: same hash+family, v2 pin vs v3
  let flip = null;
  for (let i = 0; i < 3000 && !flip; i++) {
    const d3 = decorFromHash(t, `elig-${i}`);
    const d2 = decorFromHash(t, `elig-${i}`, { v: 2 });
    if (d3.rare && !d2.rare) flip = d3.family;
  }
  ok(!!flip, `a v3-only-eligible family mints rare under v3 but not v2 pin (${flip})`);

  // v3 lanes exist on new mints, absent on v2 pins
  const m3 = decorFromHash(t, 'lane-check');
  const m2p = decorFromHash(t, 'lane-check', { v: 2 });
  ok(
    typeof m3.janky === 'boolean' && typeof m3.grain === 'number',
    'v3 mints carry janky/grain lanes',
  );
  ok(!('janky' in m2p) && !('grain' in m2p), 'v2 pins carry no v3 lanes');

  // janky wraps ONLY the family plate in a transform
  const j1 = recCtx();
  drawDecor(
    j1.ctx,
    { family: 'peg-wraps', seed: 3, hash: 'jk', v: 3, janky: true },
    { palette, w: 640, h: 360 },
  );
  const j0 = recCtx();
  drawDecor(
    j0.ctx,
    { family: 'peg-wraps', seed: 3, hash: 'jk', v: 3, janky: false },
    { palette, w: 640, h: 360 },
  );
  const rotOps = j1.rec.ops.filter((o) => o[0] === 'rotate').length;
  ok(rotOps === 1, `janky mis-sets the plate exactly once (${rotOps} rotates)`);
  ok(
    j0.rec.ops.filter((o) => o[0] === 'rotate').length === 0,
    'non-janky mints draw dead straight',
  );

  // grain: minted strength adds speckle ops; zero-grain batches stay clean
  const g1 = recCtx();
  drawDecor(
    g1.ctx,
    { family: 'peg-wraps', seed: 3, hash: 'gr', v: 3, grain: 0.8 },
    { palette, w: 640, h: 360 },
  );
  const g0 = recCtx();
  drawDecor(
    g0.ctx,
    { family: 'peg-wraps', seed: 3, hash: 'gr', v: 3, grain: 0 },
    { palette, w: 640, h: 360 },
  );
  ok(
    g1.rec.ops.filter((o) => o[0] === 'fillRect').length >
      g0.rec.ops.filter((o) => o[0] === 'fillRect').length + 100,
    'grain batch deposits its speckle field',
  );

  // serial edition mark: Nº text + one of eight stamps, only when provided
  const s1 = recCtx();
  drawDecor(
    s1.ctx,
    { family: 'peg-wraps', seed: 3, hash: 'sn', v: 3, serial: 12 },
    { palette, w: 640, h: 360 },
  );
  const marks = s1.rec.ops.filter((o) => o[0] === 'fillText');
  ok(marks.length === 1 && String(marks[0][1]).includes('12'), 'serial mark prints Nº 12');
  const s0 = recCtx();
  drawDecor(
    s0.ctx,
    { family: 'peg-wraps', seed: 3, hash: 'sn', v: 3 },
    { palette, w: 640, h: 360 },
  );
  ok(s0.rec.ops.filter((o) => o[0] === 'fillText').length === 0, 'no serial → no mark');
  // serial % 8 rotates the stamp: two serials differ beyond the text
  const s2 = recCtx();
  drawDecor(
    s2.ctx,
    { family: 'peg-wraps', seed: 3, hash: 'sn', v: 3, serial: 13 },
    { palette, w: 640, h: 360 },
  );
  ok(
    JSON.stringify(s1.rec.ops) !== JSON.stringify(s2.rec.ops),
    'serial stamp rotates with the run',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
