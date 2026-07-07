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
    ok(
      alphas.length > 0 && Math.max(...alphas) <= 0.1,
      `${family} subtle alpha ≤ 0.1 (legibility guard)`,
    );
    const paletteRgb = new Set(
      [palette.accent, ...palette.colors].map((c) => `${c[0]}, ${c[1]}, ${c[2]}`),
    );
    // wash-flow interpolates CONTINUOUSLY between theme colors (recipe from
    // Watercolor Dreams) — intermediate colors are theme-derived but not
    // exact stops, so the exact-match check doesn't apply to it.
    if (family !== 'wash-flow' && family !== 'strata-lines') {
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
