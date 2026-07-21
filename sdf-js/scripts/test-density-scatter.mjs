// sdf-js/scripts/test-density-scatter.mjs — Infinigen 研读第六课产物的契约测试。
// 密度放置的不变量:确定性、噪声门真在聚簇(vs 均匀)、Poisson 最小间距、
// 密度标量在簇内递增、预算语义(达不到不硬凑)、与工厂/混林的贯通。
import { densityScatter } from '../src/scene/density-scatter.js';
import { makeBoulderFactory } from '../src/scene/boulder-factory.js';
import { makeAssetCollection } from '../src/scene/asset-collection.js';
import { validate } from '../src/scene/spec.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== density scatter (Infinigen lesson 06) ===\n');

const BOX = { kind: 'box', min: [-20, -20], max: [20, 20] };

// ---- 确定性 -----------------------------------------------------------------------
{
  const a = densityScatter({ region: BOX, count: 30, seed: 'f1' });
  const b = densityScatter({ region: BOX, count: 30, seed: 'f1' });
  ok(JSON.stringify(a) === JSON.stringify(b), 'same seed → same field (mint-hash covenant)');
  const c = densityScatter({ region: BOX, count: 30, seed: 'f2' });
  ok(JSON.stringify(a) !== JSON.stringify(c), 'different seed → different field');
}

// ---- 噪声门在聚簇:平均最近邻距离显著小于均匀撒点 -----------------------------------
{
  const nnMean = (pts) => {
    let s = 0;
    for (const p of pts) {
      let best = Infinity;
      for (const q of pts) {
        if (q === p) continue;
        best = Math.min(best, Math.hypot(p.at[0] - q.at[0], p.at[2] - q.at[2]));
      }
      s += best;
    }
    return s / pts.length;
  };
  const clustered = densityScatter({
    region: BOX,
    count: 40,
    seed: 'cluster-demo',
    mask: { noiseScale: 0.03, threshold: 0.62 },
  });
  // 均匀对照:阈值 0 → 噪声门全开
  const uniform = densityScatter({
    region: BOX,
    count: 40,
    seed: 'cluster-demo',
    mask: { threshold: -1 },
  });
  ok(clustered.length > 10, `clustered field yields enough points (${clustered.length})`);
  ok(
    nnMean(clustered) < nnMean(uniform) * 0.85,
    `noise gate clusters: NN ${nnMean(clustered).toFixed(2)} < uniform ${nnMean(uniform).toFixed(2)} × 0.85`,
  );
}

// ---- Poisson 最小间距 + 预算语义 ---------------------------------------------------
{
  const pts = densityScatter({ region: BOX, count: 60, seed: 'poisson', minDist: 4 });
  let violated = false;
  for (const p of pts)
    for (const q of pts) {
      if (q === p) continue;
      if (Math.hypot(p.at[0] - q.at[0], p.at[2] - q.at[2]) < 4 - 1e-9) violated = true;
    }
  ok(!violated, `minDist honored across ${pts.length} points`);
  const tight = densityScatter({
    region: { kind: 'box', min: [-5, -5], max: [5, 5] },
    count: 100,
    seed: 'tight',
    minDist: 3,
  });
  ok(tight.length < 100, `budget is a CAP, not a promise (${tight.length}/100 — no cramming)`);
}

// ---- 密度标量:簇心比簇缘大 --------------------------------------------------------
{
  const pts = densityScatter({ region: BOX, count: 50, seed: 'grad' });
  ok(
    pts.every((p) => p.density >= 0 && p.density <= 1),
    'density scalar ∈ [0,1]',
  );
  ok(
    new Set(pts.map((p) => p.density.toFixed(3))).size > 5,
    'density varies across the cluster (a gradient, not a flag)',
  );
}

// ---- 贯通:spots → 混林工厂,density 调 scale --------------------------------------
{
  const mix = makeAssetCollection([makeBoulderFactory('field-a'), makeBoulderFactory('field-b')], {
    weights: [0.7, 0.3],
    seed: 'rockfield',
    form: 'placeholder',
  });
  const spots = densityScatter({
    region: { kind: 'annulus', rMin: 6, rMax: 18 },
    count: 12,
    seed: 'rockfield',
    minDist: 2.5,
  });
  const subjects = spots.map((s, i) => mix.spawn(i, { at: s.at, scale: 0.5 + s.density * 0.8 }));
  ok(subjects.length === spots.length, 'field spots feed the species mix 1:1');
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0, pitch: -0.3, distance: 30, focal: 1.2, targetX: 0, targetY: 1, targetZ: 0 },
      light: { azimuth: 0.5, altitude: 0.7, distance: 60, intensity: 1 },
    },
    subjects,
  };
  const v = validate(scene);
  ok(v.ok, `rock field scene validates (${v.errors[0] || 'no errors'})`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
