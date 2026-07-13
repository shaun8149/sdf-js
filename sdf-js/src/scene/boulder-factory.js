// sdf-js/src/scene/boulder-factory.js — Infinigen 研读第一课的移植产物。
// 配方来源(recipe-only,重写不抄码):princeton-vl/infinigen (BSD-3)
//   src/infinigen/core/placement/factory.py   — AssetFactory 两级 seed + 双形态契约
//   src/infinigen/assets/objects/rocks/boulder.py — 石头配方(凸包/log_uniform/姿态/物种材质)
// 课文:docs/superpowers/infinigen-study/lesson-01-asset-factory-boulder.md
//
// 形态即档位:Infinigen 用相机距离折算 face_size 做 LOD;Atlas 的"距离"是渲染档 —
//   createPlaceholder(i) → analytic 档安全的单 rounded_box(剪影真,零 march)
//   createAsset(i)       → raymarch 档的块融合 blob(凸包的 SDF 近似)
// 两形态共享同一实例 lane(Infinigen spawn_placeholder/spawn_asset 用同一个
// int_hash((factory_seed, i)) 的对应物)—— 同 footprint 同 yaw,剪影永远一致。
// 已知偏差:analytic 契约只支持 yaw 旋转,placeholder 不带 ±7.5° 倾斜(asset 带)。
//
// 纯数据工厂:输出 SceneData subject,复用现有 prim,零新 GLSL。
import { makeHashRand } from '../present/decor/rand.js';

// 乘性量一律 log_uniform(Infinigen 全库习语)
const logUniform = (R, lane, a, b) => Math.exp(R.range(lane, Math.log(a), Math.log(b)));

/**
 * makeBoulderFactory(factorySeed) → { voice, createPlaceholder, createAsset }
 * 物种级决策(形态权重 / 材质 / blob 温度)锁在 factorySeed;实例级抖动锁在
 * `${factorySeed}:${i}`。同 seed 永远同石头(mint-hash covenant)。
 */
export function makeBoulderFactory(factorySeed) {
  const S = makeHashRand(`boulder:${factorySeed}`);

  // ---- 物种级(FixedSeed(factory_seed) 的对应物)-----------------------------
  const isSlab = S.range('morph', 0, 1) >= 0.8; // boulder 0.8 / slab 0.2(boulder.py L55)
  const material = {
    hue: S.range('hue', 0.55, 0.68), // 冷灰-蓝灰带,与 horizon/massing 同族
    sat: S.range('sat', 0.06, 0.22),
    value: S.range('value', 0.18, 0.34),
    metal: 0,
    glow: 0,
    kind: 'normal',
    roughness: S.range('rough', 0.7, 0.95),
  };
  const blobN = 4 + Math.floor(S.range('blobs', 0, 3)); // 32 点凸包的 SDF 近似:4-6 块
  // 岩性(物种级):angular = 小姿态差 rounded_box 块互切(精确 min-union)——凸包棱面感,
  // boulder.py sharp remesh 的 SDF 对应物;weathered = 椭球 + smoothUnion——风化圆石,少数派。
  const lithology = S.range('lithology', 0, 1) < 0.7 ? 'angular' : 'weathered';
  const fuseK = S.range('fuse', 0.12, 0.28); // weathered 的融合半径(物种级"包紧"程度)
  // 表面(物种级,研读第二课):单层 sinfold 节理位移(boulder.py 双层 VORONOI
  // DISPLACE 的对应物,收缩到一层 + 最便宜的场——D3D fxc 成本 ∝ displaced
  // subject 数,每 studio 场景 ≤4-6 个,预算取证见 lesson-02 课文)。
  // 幅度相对石头尺寸,保 Lipschitz 冗余。
  const voroScaleK = logUniform(S, 'voro-scale', 0.25, 0.5); // 节理尺度 × meanHalf
  const voroAmpK = S.range('voro-amp', 0.03, 0.06); // × minHalf

  // ---- 实例级(int_hash((factory_seed, i)) 的对应物;双形态共享)---------------
  function instance(i, { at = [0, 0, 0], scale = 1 } = {}) {
    const R = makeHashRand(`boulder:${factorySeed}:${i}`);
    // log_uniform 非均匀缩放(boulder.py L75-78;数值 = 半尺寸,基约 1 世界单位)
    const sx = isSlab ? logUniform(R, 'sx', 0.5, 2.0) : logUniform(R, 'sx', 0.4, 1.2);
    const sz = isSlab ? logUniform(R, 'sz', 0.5, 2.0) : logUniform(R, 'sz', 0.4, 1.2);
    const sy = isSlab ? logUniform(R, 'sy', 0.1, 0.15) : logUniform(R, 'sy', 0.4, 0.8);
    const half = [sx * scale, sy * scale, sz * scale];
    return {
      R,
      half,
      tilt: R.range('tilt', -Math.PI / 24, Math.PI / 24), // L82:x 倾 ±7.5°
      yaw: R.range('yaw', 0, Math.PI * 2), // L84:自由朝向
      // 站姿:略沉——中心在 42% 高度,与 horizon slab 同约定("planted, not parked")
      pos: [at[0], half[1] * 2 * 0.42 + at[1], at[2]],
    };
  }

  /** analytic 档安全形态:单 rounded_box,同 footprint 同 yaw(无 tilt——analytic 契约)。 */
  function createPlaceholder(i, opts = {}) {
    const { half, yaw, pos } = instance(i, opts);
    const dims = [half[0] * 2, half[1] * 2, half[2] * 2];
    return {
      id: `boulder-${factorySeed}-${i}-ph`,
      type: 'rounded_box',
      args: { dims, cornerR: Math.min(...half) * 0.35 },
      transform: { translate: pos, rotate: [0, yaw, 0] },
      material: { ...material },
    };
  }

  /** raymarch 档形态:块状 blob 融合——凸包的 SDF 近似(骨),层理/位移是第二课。 */
  function createAsset(i, opts = {}) {
    const { R, half, tilt, yaw, pos } = instance(i, opts);
    const angular = lithology === 'angular';
    const children = [];
    for (let b = 0; b < blobN; b++) {
      // 凸包直觉:块要大而挤——中心抖动小、块占基体大半,重叠成一体,
      // 只有外露的部分变成棱面;散开就成碎瓷片(第一次视觉验证的教训)
      const cx = R.range(`b${b}x`, -0.22, 0.22) * half[0];
      // slab 形态:块沿 y 微错层(石板是"叠",不是"交叉"——第二次视觉验证的教训)
      const cy = isSlab
        ? (b / Math.max(1, blobN - 1) - 0.5) * 0.9 * half[1] +
          R.range(`b${b}y`, -0.1, 0.1) * half[1]
        : R.range(`b${b}y`, -0.18, 0.08) * half[1];
      const cz = R.range(`b${b}z`, -0.22, 0.22) * half[2];
      const dims = [
        half[0] * logUniform(R, `b${b}rx`, 0.7, 1.0),
        half[1] * logUniform(R, `b${b}ry`, 0.7, 1.0),
        half[2] * logUniform(R, `b${b}rz`, 0.7, 1.0),
      ];
      children.push(
        angular
          ? {
              // 小角度姿态差的圆角块:互切的棱面 = 凸包的面
              id: `boulder-${factorySeed}-${i}-b${b}`,
              type: 'rounded_box',
              args: { dims, cornerR: Math.min(...dims) * R.range(`b${b}cr`, 0.04, 0.12) },
              transform: {
                translate: [cx, cy, cz],
                rotate: [
                  R.range(`b${b}rotx`, -0.18, 0.18),
                  // slab:块共享朝向(层理);boulder:自由朝向(乱石)
                  isSlab ? R.range(`b${b}roty`, -0.12, 0.12) : R.range(`b${b}roty`, 0, Math.PI),
                  R.range(`b${b}rotz`, -0.18, 0.18),
                ],
              },
            }
          : {
              id: `boulder-${factorySeed}-${i}-b${b}`,
              type: 'ellipsoid',
              args: { dims },
              transform: { translate: [cx, cy, cz] },
            },
      );
    }
    // angular 用精确 min-union:棱面感来自块的互切,接缝是硬折痕(岩石本该如此);
    // chamfer/round 家族不是精确距离场,sphere-tracing 过冲出黑斑(视觉验证抓到)。
    // weathered 用 smoothUnion(k 小,融合处保持温和)。
    const blob = {
      id: `boulder-${factorySeed}-${i}-blob`,
      type: angular ? 'union' : 'smoothUnion',
      ...(angular ? {} : { args: { k: fuseK * Math.min(...half) } }),
      children,
    };
    // 表面位移(局部坐标——位移场随石头一起转):单层 sinfold 节理。
    // 原方是双层(vfbm 鼓胀 + 节理);D3D 取证:fxc 成本主导项是 displaced
    // subject 数(8 个=分钟级黑屏,与场 ALU 无关),鼓胀层砍、场用最便宜档。
    // 每实例独立 offset lane,同一物种的噪声图不相互复读。
    const minHalf = Math.min(...half);
    const meanHalf = (half[0] + half[1] + half[2]) / 3;
    return {
      id: `boulder-${factorySeed}-${i}`,
      type: 'displace',
      source: blob,
      args: {
        kind: 'sinfold',
        freq: 1 / (voroScaleK * meanHalf),
        amp: voroAmpK * minHalf,
        offset: [R.range('vox', 0, 100), R.range('voy', 0, 100), R.range('voz', 0, 100)],
      },
      transform: { translate: pos, rotate: [tilt, yaw, 0] },
      material: { ...material },
    };
  }

  return {
    voice: { isSlab, material, blobN, fuseK, lithology, voroScaleK, voroAmpK },
    createPlaceholder,
    createAsset,
  };
}
