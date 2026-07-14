// sdf-js/scripts/test-terrain-anchor.mjs — Infinigen 研读第七课产物的契约测试。
// 地形锚定的不变量:高度场确定性 + 有起伏、锚定点贴表面(- sink)、坡度门
// 真在滤陡坡、海拔门真在滤高度、与 L06 密度放置的贯通(全链:撒点→锚定→过滤)。
import { makeTerrainHeightFn, anchorSpots, surveyTerrain } from '../src/scene/terrain-anchor.js';
import { densityScatter } from '../src/scene/density-scatter.js';
import { makeConiferFactory } from '../src/scene/conifer-factory.js';
import { validate } from '../src/scene/spec.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== terrain anchor (Infinigen lesson 07) ===\n');

const TERRAIN = {
  id: 'env-terrain',
  type: 'terrain-elevated',
  args: { maxHeight: 35.0, scale: 0.035, ridgePower: 2.0, mountainness: 0.3 },
  transform: { translate: [0, -8, 0] }, // alpine env 同款
};
const REGION = { kind: 'box', min: [-40, -40], max: [40, 40] };

// ---- 高度场:确定性 + 真起伏 + transform 生效 ---------------------------------------
{
  const h = makeTerrainHeightFn(TERRAIN);
  ok(h(3.7, -12.2) === h(3.7, -12.2), 'height field is a pure function');
  const sv = surveyTerrain(TERRAIN, { region: { min: [-40, -40], max: [40, 40] } });
  ok(sv.max - sv.min > 3, `surface actually undulates (range ${(sv.max - sv.min).toFixed(1)})`);
  const flat = makeTerrainHeightFn({ ...TERRAIN, transform: { translate: [0, 100, 0] } });
  ok(
    Math.abs(flat(3.7, -12.2) - h(3.7, -12.2) - 108) < 1e-9,
    'terrain transform.translate rides the height field',
  );
}

// ---- 锚定:贴表面 - sink -----------------------------------------------------------
{
  const h = makeTerrainHeightFn(TERRAIN);
  const spots = densityScatter({ region: REGION, count: 20, seed: 'anchor' });
  const anchored = anchorSpots(spots, h, { sink: 0.12 });
  ok(anchored.length === spots.length, 'no gates → every spot anchors');
  ok(
    anchored.every((s) => Math.abs(s.at[1] - (h(s.at[0], s.at[2]) - 0.12)) < 1e-9),
    'anchored y = surface - sink (planted, not parked)',
  );
}

// ---- 坡度门 + 海拔门 ---------------------------------------------------------------
{
  const h = makeTerrainHeightFn(TERRAIN);
  const spots = densityScatter({
    region: REGION,
    count: 80,
    seed: 'gates',
    mask: { threshold: -1 },
  });
  const flats = anchorSpots(spots, h, { normalRange: [0.9, 1] });
  const steeps = anchorSpots(spots, h, { normalRange: [0, 0.7] });
  ok(
    flats.length > 0 && flats.every((s) => s.normalY >= 0.9),
    `slope gate keeps flats only (${flats.length} pass)`,
  );
  ok(
    steeps.every((s) => s.normalY <= 0.7),
    `inverse gate keeps steeps only (${steeps.length} pass)`,
  );
  ok(
    flats.length + steeps.length < spots.length,
    'the two gates split the terrain (neither is everything)',
  );
  const low = anchorSpots(spots, h, { altitudeRange: [-8, -5] });
  ok(
    low.length > 0 && low.every((s) => s.surfaceY >= -8 && s.surfaceY <= -5),
    `altitude gate keeps the valley floor band (${low.length} pass)`,
  );
}

// ---- 全链贯通:密度撒点 → 锚定 → 工厂 → 场景 validate --------------------------------
{
  const h = makeTerrainHeightFn(TERRAIN);
  const stand = makeConiferFactory('alpine-stand');
  const spots = anchorSpots(
    densityScatter({ region: REGION, count: 30, seed: 'forest', minDist: 3 }),
    h,
    { normalRange: [0.85, 1] }, // 树只长平地(Infinigen 组合原味)
  );
  const trees = spots.slice(0, 3).map((s, i) => stand.createAsset(i, { at: s.at }));
  stand.finalizeAssets(trees);
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0, pitch: -0.2, distance: 30, focal: 1.2, targetX: 0, targetY: 2, targetZ: 0 },
      light: { azimuth: 0.5, altitude: 0.6, distance: 60, intensity: 1.1 },
    },
    subjects: [TERRAIN, ...trees],
  };
  const v = validate(scene);
  ok(v.ok, `anchored alpine scene validates (${v.errors[0] || 'no errors'})`);
  ok(
    trees.every((t) => t.transform.translate[1] < 30 && Number.isFinite(t.transform.translate[1])),
    'trees carry terrain-decided y (the author never wrote it)',
  );
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
