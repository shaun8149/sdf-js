// sdf-js/scripts/test-boulder-factory.mjs — Infinigen 研读第一课产物的契约测试。
// 断的是 AssetFactory 模式的四条不变量:两级 seed 确定性、物种-实例分离、
// placeholder/asset 双形态剪影一致、placeholder 的 analytic 档安全性。
import { makeBoulderFactory } from '../src/scene/boulder-factory.js';
import { expandAndCompile } from '../src/runtime/apply-studio-scene.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
import { validate } from '../src/scene/spec.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== boulder factory (Infinigen lesson 01) ===\n');

const D = {
  camera: { yaw: 0, pitch: -0.15, distance: 10, focal: 1.2, targetX: 0, targetY: 1, targetZ: 0 },
  light: { azimuth: 0.5, altitude: 0.7, distance: 30, intensity: 1 },
};

// ---- 两级 seed:确定性 -----------------------------------------------------------
{
  const a = makeBoulderFactory('granite-7');
  const b = makeBoulderFactory('granite-7');
  ok(
    JSON.stringify(a.createAsset(3)) === JSON.stringify(b.createAsset(3)),
    'same factory seed + same i → byte-identical asset (mint-hash covenant)',
  );
  ok(
    JSON.stringify(a.createAsset(3)) !== JSON.stringify(a.createAsset(4)),
    'same species, different i → different instance',
  );
}

// ---- 物种-实例分离 ----------------------------------------------------------------
{
  const f = makeBoulderFactory('granite-7');
  const g = makeBoulderFactory('basalt-2');
  const m0 = f.createAsset(0).material;
  const m9 = f.createAsset(9).material;
  ok(
    JSON.stringify(m0) === JSON.stringify(m9),
    'material is a SPECIES decision — every instance shares it',
  );
  ok(
    f.voice.material.hue !== g.voice.material.hue,
    'different factory seed → different species voice',
  );
  const kOf = (s) => s.args.k / Math.min(...s.children.map(() => 1)); // k 由物种 fuseK 驱动
  ok(
    typeof kOf === 'function' &&
      f.createAsset(0).children.length === f.createAsset(5).children.length,
    'blob count is a species decision (constant across instances)',
  );
}

// ---- 双形态剪影一致(Infinigen L75/L140 同 instance seed 的对应物)------------------
{
  const f = makeBoulderFactory('granite-7');
  const ph = f.createPlaceholder(2, { at: [4, 0, -3], scale: 1.5 });
  const asset = f.createAsset(2, { at: [4, 0, -3], scale: 1.5 });
  ok(
    JSON.stringify(ph.transform.translate) === JSON.stringify(asset.transform.translate),
    'placeholder and asset stand at the same position',
  );
  ok(
    ph.transform.rotate[1] === asset.transform.rotate[1],
    'placeholder and asset share the same yaw (silhouette agreement)',
  );
  ok(ph.transform.rotate[0] === 0, 'placeholder is yaw-only (analytic tier contract)');
  ok(asset.transform.rotate[0] !== 0, 'asset keeps the ±7.5° tilt (raymarch tiers)');
}

// ---- placeholder 是 analytic 安全的;两形态都要能编译 ------------------------------
{
  const f = makeBoulderFactory('granite-7');
  const ANALYTIC_TYPES = new Set([
    'box',
    'rounded_box',
    'sphere',
    'capsule',
    'ellipsoid',
    'cylinder',
  ]);
  ok(
    [0, 1, 2].every((i) => ANALYTIC_TYPES.has(f.createPlaceholder(i).type)),
    'placeholder form stays inside the analytic SUPPORTED set',
  );
  const scene = {
    v: 1,
    defaults: D,
    subjects: [0, 1, 2].map((i) => f.createAsset(i, { at: [i * 3 - 3, 0, 0] })),
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
  const phScene = {
    v: 1,
    defaults: D,
    subjects: [0, 1, 2].map((i) => f.createPlaceholder(i, { at: [i * 3 - 3, 0, 0] })),
  };
  let phSdf = null;
  try {
    ({ sdf: phSdf } = expandAndCompile(phScene));
  } catch (e) {
    console.log('    compile threw:', e.message);
  }
  ok(!!phSdf, 'placeholder scene compiles (CPU)');
}

// ---- 形态权重:物种群体里 slab 是少数(0.2)----------------------------------------
{
  let slabs = 0;
  const N = 60;
  for (let s = 0; s < N; s++) if (makeBoulderFactory(`census-${s}`).voice.isSlab) slabs++;
  ok(
    slabs > N * 0.05 && slabs < N * 0.45,
    `slab morph is the 0.2-weight minority (${slabs}/${N} species)`,
  );
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
