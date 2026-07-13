// sdf-js/scripts/test-conifer-factory.mjs — Infinigen 研读第四课产物的契约测试。
// 第四课语法的不变量:genome 注入(物种形状学是数据)、两级 seed、双形态
// 剪影一致、placeholder 的 analytic 安全、finalizeAssets 林分级批处理
// (盛行风:物种内共享、物种间不同、placeholder 不受染)。
import { makeConiferFactory, PINE_GENOME } from '../src/scene/conifer-factory.js';
import { makeAssetCollection } from '../src/scene/asset-collection.js';
import { expandAndCompile } from '../src/runtime/apply-studio-scene.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
import { validate } from '../src/scene/spec.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== conifer factory (Infinigen lesson 04) ===\n');

const D = {
  camera: { yaw: 0, pitch: -0.15, distance: 14, focal: 1.2, targetX: 0, targetY: 2, targetZ: 0 },
  light: { azimuth: 0.5, altitude: 0.7, distance: 30, intensity: 1 },
};

// ---- genome 注入:物种形状学是数据 --------------------------------------------------
{
  const pine = makeConiferFactory('stand-1');
  const dwarf = makeConiferFactory('stand-1', {
    ...PINE_GENOME,
    name: 'dwarf',
    height: [1.5, 2.2],
    crownRadiusK: [0.3, 0.4],
  });
  ok(
    pine.voice.heightBase > 3 && dwarf.voice.heightBase < 3,
    'same factory machinery, different genome → different species morphology',
  );
  ok(
    JSON.stringify(makeConiferFactory('stand-1').createAsset(2)) ===
      JSON.stringify(makeConiferFactory('stand-1').createAsset(2)),
    'same seed + genome → byte-identical tree (mint-hash covenant)',
  );
}

// ---- taper 律:锥层半径随高度衰减 --------------------------------------------------
{
  const f = makeConiferFactory('stand-1');
  const tiersOf = (a) => a.children[1].source.children.filter((c) => c.type === 'cone');
  const tiers = tiersOf(f.createAsset(0));
  ok(tiers.length >= 3, `crown discretizes into ${tiers.length} cone tiers`);
  const radii = tiers.map((c) => c.args.baseRadius);
  ok(
    radii.every((r, k) => k === 0 || r < radii[k - 1] * 1.15),
    'tier radii follow the taper law (cone silhouette emerges from the law, not a prim)',
  );
}

// ---- 双形态:剪影一致 + placeholder analytic 安全 -----------------------------------
{
  const f = makeConiferFactory('stand-1');
  const ph = f.createPlaceholder(3, { at: [2, 0, -1] });
  const asset = f.createAsset(3, { at: [2, 0, -1] });
  ok(
    JSON.stringify(ph.transform.translate) === JSON.stringify(asset.transform.translate) &&
      ph.transform.rotate[1] === asset.transform.rotate[1],
    'placeholder and asset agree on position + yaw (L01 contract)',
  );
  const ANALYTIC = new Set(['box', 'rounded_box', 'sphere', 'capsule', 'ellipsoid', 'cylinder']);
  ok(
    ph.type === 'union' && ph.children.every((c) => ANALYTIC.has(c.type) && !c.transform.rotate),
    'placeholder = union of analytic prims, children translate-only (analytic contract)',
  );
}

// ---- finalizeAssets:林分级盛行风 ---------------------------------------------------
{
  const f = makeConiferFactory('stand-1');
  const g = makeConiferFactory('stand-2');
  const a = [f.createAsset(0), f.createAsset(1), f.createAsset(2)];
  f.finalizeAssets(a);
  const leanOf = (s) => [s.transform.rotate[0], s.transform.rotate[2]];
  ok(
    JSON.stringify(leanOf(a[0])) === JSON.stringify(leanOf(a[1])) &&
      JSON.stringify(leanOf(a[1])) === JSON.stringify(leanOf(a[2])),
    'one stand shares ONE prevailing wind (a decision no single tree can make)',
  );
  ok(
    leanOf(a[0]).some((v) => v !== 0),
    'the wind actually leans the trees',
  );
  const b = [g.createAsset(0)];
  g.finalizeAssets(b);
  ok(
    JSON.stringify(leanOf(a[0])) !== JSON.stringify(leanOf(b[0])),
    'different stand → different wind',
  );
  const ph = f.createPlaceholder(0);
  f.finalizeAssets([ph]);
  ok(
    ph.transform.rotate[0] === 0,
    'placeholders stay upright (analytic contract survives finalize)',
  );
}

// ---- spawnAll:混林 + 按物种 finalize 链路 -------------------------------------------
{
  const mix = makeAssetCollection([makeConiferFactory('stand-1'), makeConiferFactory('stand-2')], {
    weights: [0.7, 0.3],
    seed: 'forest',
    form: 'asset',
  });
  const trees = mix.spawnAll(8, (i) => ({ at: [i * 3, 0, 0] }));
  ok(trees.length === 8, 'spawnAll spawns the full stand');
  ok(
    trees.every((t) => t.transform.rotate[0] !== 0 || t.transform.rotate[2] !== 0),
    'every tree got its species wind (per-factory finalize ran)',
  );
}

// ---- 编译:CPU + GLSL(asset 是 1 个 displaced subject,L02 预算内)-----------------
{
  const f = makeConiferFactory('stand-1');
  const scene = {
    v: 1,
    defaults: D,
    subjects: [0, 1, 2].map((i) => f.createAsset(i, { at: [i * 4 - 4, 0, 0] })),
  };
  const v = validate(scene);
  ok(v.ok, `asset scene validates (${v.errors[0] || 'no errors'})`);
  let sdf = null;
  try {
    ({ sdf } = expandAndCompile(scene));
  } catch (e) {
    console.log('    compile threw:', e.message);
  }
  ok(!!sdf, 'asset scene compiles (CPU)');
  const r = sdf ? compileSDF3ToGLSL(sdf, { emitObjectIndex: true }) : { error: 'no sdf' };
  ok(!r.error, `asset scene compiles to GLSL (${r.error || `${r.glsl.length} chars`})`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
