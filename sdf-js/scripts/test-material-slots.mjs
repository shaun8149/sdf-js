// sdf-js/scripts/test-material-slots.mjs — Infinigen 研读第五课产物的契约测试。
// 语义材质槽的不变量:确定性、权重分布、族内参数仍是分布(不是常数)、
// 注册表覆盖(retheme 杠杆)、未知槽 fail loud、工厂端"物种=材质族"贯通。
import { MATERIAL_SLOTS, drawMaterial, censusSlot } from '../src/scene/material-slots.js';
import { makeBoulderFactory } from '../src/scene/boulder-factory.js';
import { makeConiferFactory } from '../src/scene/conifer-factory.js';
import { makeHashRand } from '../src/present/decor/rand.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== material slots (Infinigen lesson 05) ===\n');

// ---- 确定性 + 族内参数是分布 -------------------------------------------------------
{
  const S1 = makeHashRand('species:alpha');
  const S2 = makeHashRand('species:alpha');
  ok(
    JSON.stringify(drawMaterial('rock', S1)) === JSON.stringify(drawMaterial('rock', S2)),
    'same species lanes → same material (deterministic weighted_sample)',
  );
  const a = drawMaterial('rock', makeHashRand('species:a'));
  const b = drawMaterial('rock', makeHashRand('species:b'));
  ok(JSON.stringify(a) !== JSON.stringify(b), 'different species → different draw');
}

// ---- 权重分布:rock 槽的多数派是 granite 冷灰带 -------------------------------------
{
  const counts = censusSlot('rock', 120);
  const total = [...counts.values()].reduce((x, y) => x + y, 0);
  const top = Math.max(...counts.values());
  ok(total === 120 && top > 50, `weights hold: dominant family ${top}/120 species`);
}

// ---- 注册表覆盖 = retheme 杠杆 ------------------------------------------------------
{
  const goldRegistry = {
    rock: [
      [
        (S, l) => ({
          hue: 0.12,
          sat: 0.8,
          value: 0.5,
          metal: 1,
          glow: 0,
          kind: 'normal',
          roughness: S.range(`${l}:r`, 0.2, 0.4),
        }),
        1,
      ],
    ],
  };
  const m = drawMaterial('rock', makeHashRand('species:a'), { registry: goldRegistry });
  ok(
    m.metal === 1 && m.hue === 0.12,
    'registry override rethemes the slot (one table, whole world)',
  );
  let threw = false;
  try {
    drawMaterial('nope', makeHashRand('x'));
  } catch {
    threw = true;
  }
  ok(threw, 'unknown slot fails loud');
}

// ---- 工厂贯通:物种=材质族,同物种双槽配套 -------------------------------------------
{
  const f = makeBoulderFactory('granite-7');
  ok(
    JSON.stringify(
      f.createAsset(0).children ? f.createAsset(0).material : f.createAsset(0).material,
    ) === JSON.stringify(f.createAsset(9).material),
    'boulder species draws ONE rock family for all instances (slot under species seed)',
  );
  const t = makeConiferFactory('stand-1');
  const tree = t.createAsset(0);
  const trunkM = tree.children[0].material;
  const crownM = tree.children[1].material;
  ok(
    trunkM.hue !== crownM.hue,
    'conifer draws bark and foliage from SEPARATE slots (lane-disambiguated)',
  );
  ok(
    JSON.stringify(t.createAsset(5).children[1].material) === JSON.stringify(crownM),
    'both slots stay species-stable across instances',
  );
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
