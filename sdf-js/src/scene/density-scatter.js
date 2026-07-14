// sdf-js/src/scene/density-scatter.js — Infinigen 研读第六课的移植产物。
// 配方来源(recipe-only):princeton-vl/infinigen (BSD-3)
//   core/placement/density.py placement_mask — 密度掩膜 = 一串独立门的乘积
//     (噪声门 → 自然聚簇;坡度门;语义 tag 门;海拔门;return_scalar 梯度)
//   core/placement/placement.py placeholder_locs — POISSON 分布(Distance Min)
//     × 掩膜选点 + 逐点均匀 yaw
// 课文:docs/superpowers/infinigen-study/lesson-06-density-placement.md
//
// 借:噪声门(资产出现在噪声场超阈值处 —— 聚簇是场的性质,不是逐点骰子)、
//     Poisson 最小间距(自然间隔,不重叠)、密度标量梯度(簇边缘实例更小)、
//     阈值抖动 ±0.025(每片场地的簇疏密不同)。
// 不借(诚实清单):坡度/法线门与语义 tag 门(我们的地面是平面,等 terrain
//     锚定的 deck);相机邻域放置(deck 端已有窗口切片管"相机看什么")。
import { makeHashRand } from '../present/decor/rand.js';

// 2D 值噪声(xz 平面),与 GLSL 端 nfValue 同一条 sin-fract hash 公式
const dsHash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const dsValue = (px, pz) => {
  const ix = Math.floor(px),
    iz = Math.floor(pz);
  const fx = px - ix,
    fz = pz - iz;
  const u = fx * fx * (3 - 2 * fx),
    w = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(
    lerp(dsHash(ix, iz), dsHash(ix + 1, iz), u),
    lerp(dsHash(ix, iz + 1), dsHash(ix + 1, iz + 1), u),
    w,
  );
};
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * densityScatter(opts) → [{ at:[x,0,z], yaw, density }]
 * 确定性密度放置:在 region 内撒候选点,噪声门筛掉簇外的,Poisson 最小间距
 * 去挤,最多收 count 个。density ∈ (0,1] 是簇内深度(placement_mask
 * return_scalar 的 MapRange 对应物)—— 调用方拿去调实例 scale,簇心大簇缘小。
 *
 * @param opts.region   {kind:'annulus', center?, rMin, rMax} | {kind:'box', min:[x,z], max:[x,z]}
 * @param opts.count    预算上限(达不到不硬凑 —— placement.py 的 warning 语义)
 * @param opts.seed     场地身份(mint-hash covenant)
 * @param opts.mask     {noiseScale=0.05, threshold=0.55} — 噪声门;threshold
 *                      带 ±0.025 的场地级抖动(density.py L71-73)
 * @param opts.minDist  Poisson 最小间距(默认 0 = 不限)
 */
export function densityScatter({ region, count, seed = 'field', mask = {}, minDist = 0 } = {}) {
  if (!region || !count) throw new Error('densityScatter: region and count are required');
  const R = makeHashRand(`density:${seed}`);
  const noiseScale = mask.noiseScale ?? 0.05;
  // 阈值场地级抖动:同一配置的两片场地,簇的疏密不同(density.py normal(t, .025))
  const threshold = (mask.threshold ?? 0.55) + R.range('thresh-jitter', -0.05, 0.05) * 0.5;
  const noiseOff = [R.range('nox', 0, 100), R.range('noz', 0, 100)];

  const sample = (i) => {
    if (region.kind === 'annulus') {
      const [cx, cz] = region.center || [0, 0];
      const th = R.range(`a${i}`, 0, 2 * Math.PI);
      // sqrt 均匀盘采样,再夹进环
      const r = Math.sqrt(R.range(`r${i}`, region.rMin ** 2, region.rMax ** 2));
      return [cx + Math.sin(th) * r, cz + Math.cos(th) * r];
    }
    return [
      R.range(`x${i}`, region.min[0], region.max[0]),
      R.range(`z${i}`, region.min[1], region.max[1]),
    ];
  };

  const out = [];
  const OVERSAMPLE = 14; // 噪声门 + Poisson 都会丢点;预算达不到就少给,不硬凑
  for (let i = 0; i < count * OVERSAMPLE && out.length < count; i++) {
    const [x, z] = sample(i);
    // 噪声门:场的性质决定聚簇,不是逐点骰子(density.py noise > thresh)
    const n = dsValue((x + noiseOff[0]) * noiseScale * 10, (z + noiseOff[1]) * noiseScale * 10);
    if (n <= threshold) continue;
    // Poisson 最小间距(placeholder_locs 的 Distance Min):贪心掷镖
    if (minDist > 0 && out.some((p) => Math.hypot(p.at[0] - x, p.at[2] - z) < minDist)) continue;
    out.push({
      at: [x, 0, z],
      yaw: R.range(`yaw${i}`, 0, 2 * Math.PI), // scatter_placeholders L123
      // 簇内深度:阈值处 0 → 0.75 处饱和(placement_mask return_scalar 的 MapRange)
      density: smoothstep(threshold, 0.75, n),
    });
  }
  return out;
}
