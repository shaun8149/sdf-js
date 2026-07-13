// sdf-js/src/scene/asset-collection.js — Infinigen 研读第三课的移植产物。
// 配方来源(recipe-only):princeton-vl/infinigen (BSD-3)
//   core/placement/factory.py L175-219 make_asset_collection —— 多工厂按权重
//   混合生成 n 个资产("物种混林"),供给端的复用单元。
// 课文:docs/superpowers/infinigen-study/lesson-03-asset-collection-horizon.md
//
// Infinigen 用 np.random.choice(weights) 逐个选工厂;我们的对应物是确定性
// lane(mint-hash covenant):同 seed 永远同一片林。不借的部分:Blender
// collection 容器 / centered 重定位 / finalize_assets 批处理钩子(v1 无消费者)。
import { makeHashRand } from '../present/decor/rand.js';

/**
 * makeAssetCollection(factories, opts?) → { pick(i), spawn(i, spawnOpts) }
 * @param factories  AssetFactory 数组(如 makeBoulderFactory 的返回值)
 * @param opts.weights  与 factories 等长的权重(默认均匀);逐实例加权抽种
 * @param opts.seed     混林身份(lane 前缀)
 * @param opts.form     'placeholder'(analytic 安全,默认)| 'asset'(raymarch)
 */
export function makeAssetCollection(
  factories,
  { weights = null, seed = 'mix', form = 'placeholder' } = {},
) {
  if (!Array.isArray(factories) || factories.length === 0)
    throw new Error('makeAssetCollection: factories must be a non-empty array');
  const w = weights || factories.map(() => 1);
  if (w.length !== factories.length)
    throw new Error('makeAssetCollection: weights length must match factories');
  const total = w.reduce((a, b) => a + b, 0);
  const R = makeHashRand(`collection:${seed}`);

  /** 第 i 个实例属于哪个物种(确定性加权抽样,np.random.choice 的对应物)。 */
  const pick = (i) => {
    let r = R.range(`pick${i}`, 0, total);
    for (let k = 0; k < factories.length; k++) {
      r -= w[k];
      if (r <= 0) return k;
    }
    return factories.length - 1;
  };

  /** 生成第 i 个实例的 subject(placeholder / asset 由 opts.form 定档)。 */
  const spawn = (i, spawnOpts) => {
    const f = factories[pick(i)];
    return form === 'asset' ? f.createAsset(i, spawnOpts) : f.createPlaceholder(i, spawnOpts);
  };

  return { pick, spawn };
}
