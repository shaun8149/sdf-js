// sdf-js/src/scene/material-slots.js — Infinigen 研读第五课的移植产物。
// 配方来源(recipe-only):princeton-vl/infinigen (BSD-3)
//   assets/composition/material_assignments.py — 语义材质槽的中央注册表
//     (rock = [(Mountain,5),(Stone,1)] 这种"什么东西 → 加权候选"的一张表)
//   core/util/random.py weighted_sample     — 物种 seed 下的加权抽取
//   assets/materials/terrain/stone.py       — 材质实现自身也是参数采样器
// 课文:docs/superpowers/infinigen-study/lesson-05-material-slots.md
//
// 三层分离(作者注释原话 "separate materials from implementations"):
//   工厂说"我是 rock" → 槽注册表说"rock 有哪些候选、什么权重" → 配方说
//   "这种材质的参数分布"。改一行注册表 = 全世界换材质族(retheme 杠杆)。
// 与 Wave A scene.materials 的关系:那是"场景内实例去重"(编译期),这是
// "资产库的语义供给"(生成期)—— 上下游,不重叠。
import { makeHashRand } from '../present/decor/rand.js';

// ---- 材质配方:每个配方是 (S, lane) => material,参数是分布不是常数 -----------
// (stone.py 在 FixedSeed 里 uniform 采 bump/crack 参数的对应物)
const graniteCool = (S, l) => ({
  hue: S.range(`${l}:h`, 0.55, 0.68),
  sat: S.range(`${l}:s`, 0.06, 0.22),
  value: S.range(`${l}:v`, 0.18, 0.34),
  metal: 0,
  glow: 0,
  kind: 'normal',
  roughness: S.range(`${l}:r`, 0.7, 0.95),
});
const basaltDeep = (S, l) => ({
  hue: S.range(`${l}:h`, 0.6, 0.72),
  sat: S.range(`${l}:s`, 0.12, 0.3),
  value: S.range(`${l}:v`, 0.1, 0.2),
  metal: 0,
  glow: 0,
  kind: 'normal',
  roughness: S.range(`${l}:r`, 0.8, 0.95),
});
const sandstoneWarm = (S, l) => ({
  hue: S.range(`${l}:h`, 0.06, 0.1),
  sat: S.range(`${l}:s`, 0.25, 0.45),
  value: S.range(`${l}:v`, 0.3, 0.45),
  metal: 0,
  glow: 0,
  kind: 'normal',
  roughness: S.range(`${l}:r`, 0.75, 0.9),
});
const barkBrown = (S, l) => ({
  hue: S.range(`${l}:h`, 0.06, 0.09),
  sat: S.range(`${l}:s`, 0.3, 0.45),
  value: S.range(`${l}:v`, 0.22, 0.3),
  metal: 0,
  glow: 0,
  kind: 'normal',
  roughness: 0.9,
});
const barkAsh = (S, l) => ({
  hue: S.range(`${l}:h`, 0.08, 0.12),
  sat: S.range(`${l}:s`, 0.08, 0.18),
  value: S.range(`${l}:v`, 0.35, 0.5),
  metal: 0,
  glow: 0,
  kind: 'normal',
  roughness: 0.9,
});
const pineGreen = (S, l) => ({
  hue: S.range(`${l}:h`, 0.3, 0.42),
  sat: S.range(`${l}:s`, 0.35, 0.55),
  value: S.range(`${l}:v`, 0.2, 0.34),
  metal: 0,
  glow: 0,
  kind: 'normal',
  roughness: 0.85,
});
const autumnRust = (S, l) => ({
  hue: S.range(`${l}:h`, 0.05, 0.1),
  sat: S.range(`${l}:s`, 0.5, 0.7),
  value: S.range(`${l}:v`, 0.3, 0.42),
  metal: 0,
  glow: 0,
  kind: 'normal',
  roughness: 0.85,
});

// ---- 语义槽注册表(material_assignments.py 的对应物)---------------------------
// 权重语义与原文一致:rock = [(Mountain, 5), (Stone, 1)] → 多数派 + 少数派。
export const MATERIAL_SLOTS = {
  rock: [
    [graniteCool, 5],
    [basaltDeep, 1],
    [sandstoneWarm, 0.5],
  ],
  bark: [
    [barkBrown, 3],
    [barkAsh, 1],
  ],
  foliage: [
    [pineGreen, 4],
    [autumnRust, 1],
  ],
};

/**
 * drawMaterial(slot, S, opts?) → material
 * weighted_sample(material_assignments[slot])() 的对应物:在调用方的物种 lane
 * 系(S)里加权抽配方并实例化 —— 同物种永远同材质族同参数。
 * @param opts.lane      lane 前缀(默认 `mat:${slot}`;同一工厂抽两个槽要区分)
 * @param opts.registry  注册表覆盖(retheme 杠杆:换一张表,全世界换风格)
 */
export function drawMaterial(slot, S, { lane = `mat:${slot}`, registry = MATERIAL_SLOTS } = {}) {
  const reg = registry[slot];
  if (!reg || !reg.length) throw new Error(`drawMaterial: unknown slot "${slot}"`);
  const total = reg.reduce((a, [, w]) => a + w, 0);
  let r = S.range(`${lane}:pick`, 0, total);
  for (const [recipe, w] of reg) {
    r -= w;
    if (r <= 0) return recipe(S, lane);
  }
  return reg[reg.length - 1][0](S, lane);
}

// 供测试/巡检:某个槽在大量物种下的族分布(权重是否成立)
export function censusSlot(slot, n = 100, registry = MATERIAL_SLOTS) {
  const counts = new Map();
  for (let i = 0; i < n; i++) {
    const S = makeHashRand(`census:${slot}:${i}`);
    const m = drawMaterial(slot, S, { registry });
    const key = m.hue.toFixed(1); // 粗分族
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}
