// sdf-js/scripts/test-weathering.mjs — Infinigen 研读第八课产物的契约测试。
// 年龄轴的不变量:weatherMaterial 纯函数 + age=0 恒等 + 单调(越老越糙越淡)、
// wear_tear_prob 语义(约半数物种带磨损)、几何面 = cornerR/k 旋钮真在转、
// 确定性不破(同 seed 同石头,包括它的年龄)。
import { weatherMaterial, WEAR_PROB } from '../src/scene/weathering.js';
import { makeBoulderFactory } from '../src/scene/boulder-factory.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== weathering / wear axis (Infinigen lesson 08) ===\n');

const BASE = { hue: 0.6, sat: 0.2, value: 0.28, metal: 0, glow: 0, kind: 'normal', roughness: 0.8 };

// ---- weatherMaterial:恒等 / 单调 / 纯函数 ------------------------------------------
{
  ok(JSON.stringify(weatherMaterial(BASE, 0)) === JSON.stringify(BASE), 'age 0 → identity');
  const mid = weatherMaterial(BASE, 0.5);
  const old = weatherMaterial(BASE, 1);
  ok(old.roughness > mid.roughness && mid.roughness > BASE.roughness, 'older → rougher (monotone)');
  ok(old.sat < mid.sat && mid.sat < BASE.sat, 'older → bleached (sat falls)');
  ok(Math.abs(old.hue - 0.09) < Math.abs(BASE.hue - 0.09), 'hue drifts toward the dust band');
  ok(old.roughness <= 1, 'roughness clamped to 1');
  ok(
    JSON.stringify(weatherMaterial(BASE, 0.5)) === JSON.stringify(mid),
    'pure function (no hidden state)',
  );
}

// ---- wear_tear_prob 语义:约半数物种带磨损 ------------------------------------------
{
  let worn = 0;
  const N = 80;
  for (let i = 0; i < N; i++) if (makeBoulderFactory(`wear-census-${i}`).voice.age > 0) worn++;
  ok(
    worn > N * (WEAR_PROB - 0.22) && worn < N * (WEAR_PROB + 0.22),
    `wear is a probabilistic overlay (${worn}/${N} species worn, prob ${WEAR_PROB})`,
  );
}

// ---- 几何面:age 真在转 cornerR / fuse k 的旋钮 --------------------------------------
{
  // 从人口里找一个高龄 angular 物种和一个 age=0 angular 物种对比
  let oldF = null,
    newF = null;
  for (let i = 0; i < 200 && !(oldF && newF); i++) {
    const f = makeBoulderFactory(`geo-census-${i}`);
    if (f.voice.lithology !== 'angular') continue;
    if (f.voice.age > 0.8 && !oldF) oldF = f;
    if (f.voice.age === 0 && !newF) newF = f;
  }
  ok(!!oldF && !!newF, 'census found both an old and a fresh angular species');
  // 对比余量要吃掉块级 base 抖动(0.04-0.12):age>0.8 的增量 ≥0.16,
  // 最坏情形 old(base 0.04)+0.16 = 0.20 vs fresh(base 0.12)= 0.12
  const cornerRatio = (f) => {
    const blob = f.createAsset(0).source.children[0];
    return blob.args.cornerR / Math.min(...blob.args.dims);
  };
  ok(
    cornerRatio(oldF) > cornerRatio(newF) + 0.05,
    `age turns the cornerR knob (old ${cornerRatio(oldF).toFixed(2)} vs fresh ${cornerRatio(newF).toFixed(2)}) — no edge detector needed`,
  );
  ok(
    oldF.voice.material.roughness > newF.voice.material.roughness - 0.25 &&
      oldF.voice.material.sat < 0.25,
    'worn species material is bleached+roughened via weatherMaterial',
  );
}

// ---- 确定性:年龄是物种身份的一部分 --------------------------------------------------
{
  const a = makeBoulderFactory('granite-7');
  const b = makeBoulderFactory('granite-7');
  ok(a.voice.age === b.voice.age, 'same seed → same age (age is part of species identity)');
  ok(
    JSON.stringify(a.createAsset(3)) === JSON.stringify(b.createAsset(3)),
    'byte-determinism survives the wear axis',
  );
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
