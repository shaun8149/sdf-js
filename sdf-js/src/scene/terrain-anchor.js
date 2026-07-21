// sdf-js/src/scene/terrain-anchor.js — Infinigen 研读第七课的移植产物。
// 配方来源(recipe-only):princeton-vl/infinigen (BSD-3)
//   core/placement/placement.py L87 — "ray_cast 向下落点":资产的 y 不是作者
//     给的,是世界表面决定的
//   core/nodes/node_utils.py facing_mask — 坡度门 = dot(normal, up) > thresh
//   core/placement/density.py altitude_range — 海拔门
// 课文:docs/superpowers/infinigen-study/lesson-07-terrain-anchor.md
//
// 交付 L06 诚实清单里欠的两个门(坡度/海拔)—— 它们的前提是"知道表面在哪"。
// 高度场 = sdf3.glsl.js atlasTerrainElevated(9 octave)的逐字 CPU 镜像
// (terrain-elevated 的 CPU f() 是正弦桩,GPU-only;这里是这张曲面的第一个
// 真 CPU 求值)。镜像即规格:同 hash21(Hoskins)、同 cubic 插值、同导数
// 衰减 fbm、同 ridge pow、同 mountain mask、同 lowland 挖洞。
// 不支持 cliffInject / canopyBumps(默认关;开了会 warn —— 锚定会有偏差)。
import { makeHashRand } from '../present/decor/rand.js';

// ---- GLSL 逐字镜像 -----------------------------------------------------------
// hash21(noise.glsl.js L58-62,Hoskins "Hash without Sine")
const hash21 = (x, y) => {
  const fract = (v) => v - Math.floor(v);
  let px = fract(x * 0.1031),
    py = fract(y * 0.1031),
    pz = fract(x * 0.1031);
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d;
  py += d;
  pz += d;
  return fract((px + py) * pz);
};

// atlasNoised(sdf3.glsl.js L691-703):值噪声 + 解析导数,cubic 插值
const atlasNoised = (x, y) => {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = hash21(ix, iy),
    b = hash21(ix + 1, iy),
    c = hash21(ix, iy + 1),
    d = hash21(ix + 1, iy + 1);
  return [
    a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy,
    6 * fx * (1 - fx) * (b - a + (a - b - c + d) * uy),
    6 * fy * (1 - fy) * (c - a + (a - b - c + d) * ux),
  ];
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// atlasTerrainElevated(sdf3.glsl.js L756-793),octaves=9(sdTerrainElevated L902)
function terrainElevatedHeight(x, z, { maxHeight, scale, ridgePower, mountainness }) {
  const px = x * scale,
    pz = z * scale;
  const f0 = atlasNoised(px, pz)[0];
  let a = 0,
    b = 0.5,
    dx = 0,
    dz = 0;
  let qx = px * 2,
    qz = pz * 2;
  for (let i = 0; i < 9; i++) {
    const n = atlasNoised(qx, qz);
    dx += n[1];
    dz += n[2];
    a += (b * n[0]) / (1 + dx * dx + dz * dz);
    b *= 0.5;
    // GLSL mat2(1.6,-1.2,1.2,1.6) 是列主序:列0=(1.6,-1.2) 列1=(1.2,1.6),
    // m*p = [1.6x + 1.2y, -1.2x + 1.6y] —— 写成行主序转置会让高 octave 全错
    // (第一版树悬空 1-2 个单位,浏览器 parity 测试抓到)
    const nx = 1.6 * qx + 1.2 * qz;
    const nz = -1.2 * qx + 1.6 * qz;
    qx = nx;
    qz = nz;
  }
  const f = Math.pow(clamp(a, 0.001, 1), ridgePower);
  const k = smoothstep(mountainness, 1, f0);
  let h = (0.05 + 0.95 * k) * f * maxHeight;
  const flatK = 1 - smoothstep(0, 0.5, k);
  h -= flatK * Math.abs(a * 2 - 1) * maxHeight * 0.12;
  return h;
}

/**
 * makeTerrainHeightFn(subject) → heightFn(x, z)(世界坐标 → 世界高度)
 * subject = terrain-elevated 的 SceneData subject(读 args + transform.translate,
 * 与 compile.js 同一套默认值)。cliffJump/canopyAmount 非零会 warn:锚定不含
 * 这两层,资产会相对悬崖/树冠面漂移。
 */
export function makeTerrainHeightFn(subject) {
  const a = subject.args || {};
  const t = (subject.transform && subject.transform.translate) || [0, 0, 0];
  if ((a.cliffJump ?? 0) !== 0 || (a.canopyAmount ?? 0) !== 0) {
    console.warn(
      '[terrain-anchor] cliffInject/canopyBumps not mirrored — anchoring will drift on those features',
    );
  }
  const params = {
    maxHeight: a.maxHeight ?? 60.0,
    scale: a.scale ?? 0.012,
    ridgePower: a.ridgePower ?? 2.4,
    mountainness: a.mountainness ?? 0.4,
  };
  return (x, z) => t[1] + terrainElevatedHeight(x - t[0], z - t[2], params);
}

/**
 * anchorSpots(spots, heightFn, opts) → 锚定 + 过滤后的 spots
 * 每个点:y 落到表面(- sink,坐进土里一点,"planted, not parked"),算法线,
 * 过坡度门(facing_mask 的对应物:normalY = dot(normal, up))和海拔门。
 * 门丢掉的点直接消失 —— L06 的语义:预算是上限不是承诺。
 *
 * @param opts.normalRange   [lo, hi] — 保留 normalY ∈ 区间(1=平地,0=竖崖;
 *                           Infinigen normal_thresh / normal_thresh_high 的合体)
 * @param opts.altitudeRange [min, max] — 保留表面高度 ∈ 区间(世界 y)
 * @param opts.sink          下沉量(默认 0.12)
 * @param opts.eps           法线有限差分步长(默认 0.35)
 */
export function anchorSpots(spots, heightFn, opts = {}) {
  const { normalRange = null, altitudeRange = null, sink = 0.12, eps = 0.35 } = opts;
  const out = [];
  for (const s of spots) {
    const [x, , z] = s.at;
    const h = heightFn(x, z);
    // 有限差分法线(placement 只需要 facing 判定,不追解析导数)
    const gx = (heightFn(x + eps, z) - heightFn(x - eps, z)) / (2 * eps);
    const gz = (heightFn(x, z + eps) - heightFn(x, z - eps)) / (2 * eps);
    const normalY = 1 / Math.sqrt(1 + gx * gx + gz * gz);
    if (normalRange && (normalY < normalRange[0] || normalY > normalRange[1])) continue;
    if (altitudeRange && (h < altitudeRange[0] || h > altitudeRange[1])) continue;
    out.push({ ...s, at: [x, h - sink, z], surfaceY: h, normalY });
  }
  return out;
}

// 供测试/巡检:场地上按 seed 采一批点,报告高度/坡度分布
export function surveyTerrain(subject, { region, n = 64, seed = 'survey' } = {}) {
  const heightFn = makeTerrainHeightFn(subject);
  const R = makeHashRand(`survey:${seed}`);
  const stats = [];
  for (let i = 0; i < n; i++) {
    const x = R.range(`x${i}`, region.min[0], region.max[0]);
    const z = R.range(`z${i}`, region.min[1], region.max[1]);
    const h = heightFn(x, z);
    stats.push(h);
  }
  return {
    min: Math.min(...stats),
    max: Math.max(...stats),
    mean: stats.reduce((a, b) => a + b, 0) / stats.length,
  };
}
