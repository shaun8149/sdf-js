// sdf-js/src/scene/conifer-factory.js — Infinigen 研读第四课的移植产物。
// 配方来源(recipe-only):princeton-vl/infinigen (BSD-3)
//   objects/trees/generate.py    — GenericTreeFactory:genome 注入(工厂是通用
//                                  机器,物种是外部数据)+ 骨架一次两形态共享
//   objects/trees/treeconfigs.py — pine_tree genome:锥形轮廓来自 taper 律
//                                  (枝长随高度线性衰减,L872-882),不是锥体 prim
// 课文:docs/superpowers/infinigen-study/lesson-04-tree-genome.md
//
// 三课的语法继续生效:两级 seed(L01)/ 形态即档位(L01)/ 位移预算(L02)。
// 新增第四课语法:① genome 注入 —— makeConiferFactory(seed, genome) 的第二参,
// 物种形状学是 DATA;② finalizeAssets 批处理钩子 —— 林分级决策(盛行风倾斜)
// 不属于任何单株,只能在"看到整片林"时做(Infinigen finalize_* 的用途)。
import { makeHashRand } from '../present/decor/rand.js';
import { drawMaterial } from './material-slots.js';

const logUniform = (R, lane, a, b) => Math.exp(R.range(lane, Math.log(a), Math.log(b)));

// ---- 默认 genome:pine(treeconfigs pine_tree 的蒸馏)-------------------------
// 数值是"分布"不是常数(Infinigen 全库习语);物种实例化时在 S lane 上坍缩。
export const PINE_GENOME = {
  name: 'pine',
  height: [4.5, 7.5], // log_uniform;tree_ht 20-30 × scale 0.35 的量级
  crownStartFrac: [0.1, 0.3], // L869:裸干占比
  crownRadiusK: [0.18, 0.26], // 冠底半径 / 树高(taper 律的斜率)
  tiers: [3, 5], // 锥层数(taper 律的离散化;越多越平滑越贵)
  trunkRadiusK: [0.02, 0.035], // 干半径 / 树高(skinning Max radius 0.2 @ ht~25)
  // 研读第五课:genome 只指语义槽,不再内嵌颜色分布 —— 材质候选/权重住
  // material-slots 中央注册表(GenericTreeFactory 的 trunk_surface 注入 +
  // material_assignments 槽,两个机制合流)
  foliageSlot: 'foliage',
  trunkSlot: 'bark',
  windMax: 0.06, // 林分盛行风的最大倾角(finalize 用,弧度)
  surfaceAmp: 0.05, // 冠面 sinfold 位移幅度 × 冠底半径(L02 预算内)
};

/**
 * makeConiferFactory(factorySeed, genome?) → { voice, createPlaceholder,
 * createAsset, finalizeAssets }
 * genome 注入 = GenericTreeFactory(factory_seed, genome) 的对应物:同一台工厂,
 * 喂不同 genome 出不同树种(treeconfigs 的 palm/baobab/bamboo 都是这个形状)。
 */
export function makeConiferFactory(factorySeed, genome = PINE_GENOME) {
  const S = makeHashRand(`conifer:${genome.name}:${factorySeed}`);
  const pick2 = (lane, [a, b]) => S.range(lane, a, b);

  // ---- 物种级:genome 分布坍缩成本物种的数(FixedSeed(factory_seed))-----------
  const heightBase = Math.exp(S.range('h', Math.log(genome.height[0]), Math.log(genome.height[1])));
  const crownStart = pick2('cs', genome.crownStartFrac);
  const crownK = pick2('ck', genome.crownRadiusK);
  const tiers = Math.round(pick2('tiers', genome.tiers));
  const trunkK = pick2('tk', genome.trunkRadiusK);
  // 同一工厂抽两个槽,lane 前缀区分(物种内:冠一族、干一族,永远配套)
  const foliage = drawMaterial(genome.foliageSlot ?? 'foliage', S, { lane: 'mat:foliage' });
  const trunkMat = drawMaterial(genome.trunkSlot ?? 'bark', S, { lane: 'mat:bark' });
  // 林分盛行风(物种级——finalize 把它压到整片林上;单株不知道风向)
  const windAz = S.range('wind-az', 0, Math.PI * 2);
  const windLean = S.range('wind-lean', 0.3, 1) * genome.windMax;

  // ---- 实例级(双形态共享,L01 契约)------------------------------------------
  function instance(i, { at = [0, 0, 0], scale = 1 } = {}) {
    const R = makeHashRand(`conifer:${genome.name}:${factorySeed}:${i}`);
    const h = heightBase * logUniform(R, 'hj', 0.8, 1.25) * scale;
    return {
      R,
      h,
      crownBase: h * crownStart, // 裸干顶 = 冠底
      crownR: h * crownK * logUniform(R, 'rj', 0.85, 1.15),
      trunkR: Math.max(0.03, h * trunkK),
      yaw: R.range('yaw', 0, Math.PI * 2),
      at,
    };
  }

  /** analytic 档安全形态:干圆柱 + 双椭球冠(union 子项只平移——analytic 契约)。 */
  function createPlaceholder(i, opts = {}) {
    const { h, crownBase, crownR, trunkR, yaw, at } = instance(i, opts);
    const crownH = h - crownBase;
    return {
      id: `conifer-${factorySeed}-${i}-ph`,
      type: 'union',
      children: [
        {
          id: `conifer-${factorySeed}-${i}-ph-trunk`,
          type: 'cylinder',
          args: { radius: trunkR, height: crownBase + crownH * 0.3 },
          transform: { translate: [0, (crownBase + crownH * 0.3) / 2, 0] },
          material: { ...trunkMat },
        },
        {
          // 冠下段:胖椭球(taper 律的两段近似)
          id: `conifer-${factorySeed}-${i}-ph-c0`,
          type: 'ellipsoid',
          args: { dims: [crownR, crownH * 0.42, crownR] },
          transform: { translate: [0, crownBase + crownH * 0.33, 0] },
          material: { ...foliage },
        },
        {
          // 冠上段:瘦椭球收顶
          id: `conifer-${factorySeed}-${i}-ph-c1`,
          type: 'ellipsoid',
          args: { dims: [crownR * 0.55, crownH * 0.38, crownR * 0.55] },
          transform: { translate: [0, crownBase + crownH * 0.78, 0] },
          material: { ...foliage },
        },
      ],
      transform: { translate: [at[0], at[1], at[2]], rotate: [0, yaw, 0] },
    };
  }

  /** raymarch 档形态:裸干 + displace(taper 律锥层塔)。
   * 结构约束(共面材质限制的近亲):displace 是不透明 leaf,子件材质活不下来
   * ——树干和冠要不同材质,就必须是 union 的两个 SIBLING:干走普通 leaf,
   * 冠的材质挂在 displace wrapper 上。每树仍只 1 个 displaced subject(L02 预算)。 */
  function createAsset(i, opts = {}) {
    const { R, h, crownBase, crownR, trunkR, yaw, at } = instance(i, opts);
    const crownH = h - crownBase;
    const cones = [];
    // taper 律(pine_tree L872-882 的连续版):第 t 层锥的底半径随高度线性衰减。
    // 锥形轮廓从这里涌现——genome 换 taper 律就换树形,锥体只是离散化单元。
    for (let t = 0; t < tiers; t++) {
      const f = t / tiers; // 层底在冠内的归一高度
      const tierR = crownR * (1 - f * 0.78) * logUniform(R, `t${t}r`, 0.9, 1.1);
      const tierH = (crownH / tiers) * 1.65; // 层间重叠,读作一体的冠
      const y = crownBase + crownH * f + tierH * 0.35;
      cones.push({
        id: `conifer-${factorySeed}-${i}-tier${t}`,
        type: 'cone',
        args: { height: tierH, baseRadius: tierR },
        transform: { translate: [0, y, 0] },
      });
    }
    return {
      id: `conifer-${factorySeed}-${i}`,
      type: 'union',
      children: [
        {
          id: `conifer-${factorySeed}-${i}-trunk`,
          type: 'cylinder',
          args: { radius: trunkR, height: h * 0.65 },
          transform: { translate: [0, h * 0.325, 0] },
          material: { ...trunkMat },
        },
        {
          id: `conifer-${factorySeed}-${i}-crown`,
          type: 'displace',
          source: {
            id: `conifer-${factorySeed}-${i}-body`,
            type: 'smoothUnion',
            args: { k: crownR * 0.18 },
            children: cones,
          },
          args: {
            kind: 'sinfold',
            freq: 2.2 / crownR,
            amp: genome.surfaceAmp * crownR,
            offset: [R.range('nx', 0, 100), R.range('ny', 0, 100), R.range('nz', 0, 100)],
          },
          material: { ...foliage },
        },
      ],
      transform: { translate: [at[0], at[1], at[2]], rotate: [0, yaw, 0] },
    };
  }

  /**
   * finalizeAssets(assets) — Infinigen finalize_assets 的对应物:林分级批处理。
   * 盛行风倾斜是"整片林共享一个风向"的决策,单株实例 lane 表达不了(每株
   * 自己抽风向就成了乱风)。只作用于 asset 形态(倾斜是非 yaw 旋转,
   * placeholder 要守 analytic 契约)。原地改写,返回入参便于链式。
   */
  function finalizeAssets(assets) {
    for (const a of assets) {
      if (!a || !a.transform || a.id.endsWith('-ph')) continue;
      const r = a.transform.rotate || [0, 0, 0];
      a.transform.rotate = [
        r[0] + windLean * Math.cos(windAz),
        r[1],
        r[2] + windLean * Math.sin(windAz),
      ];
    }
    return assets;
  }

  return {
    voice: {
      genome: genome.name,
      heightBase,
      crownStart,
      crownK,
      tiers,
      foliage,
      windAz,
      windLean,
    },
    createPlaceholder,
    createAsset,
    finalizeAssets,
  };
}
