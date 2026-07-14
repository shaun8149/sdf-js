// sdf-js/src/scene/deck-decor.js — Wave 2: the 3D twin of the 2D decor engine, v1.
//
// Two parametric families dress the deck world. The 2D end's three hard-won
// disciplines are HARDCODED here, not conventions:
//   seeded — one hash is the deck's art identity (makeHashRand named lanes,
//     shared with the 2D decor engine: same hash → same world, and adding a
//     lane later never disturbs existing decisions);
//   subtle — a brightness ceiling (DECOR_VALUE_CAP) and voids-and-shells
//     placement only: an annulus OUTSIDE each station's arena, and the flanks
//     of transit paths. Data atoms own the focal zone, always;
//   family — accumulation fields (many small elements), never single props
//     (the second-reading audit law: mass comes from filling, not outlines).
//
// Budget by construction: decor rides the window-slicing id conventions —
//   station decor  `s${k}-decor-*`   → exists only in station k's windows;
//   transit decor  `path-${k}-decor-*` → exists only in that transit's windows.
// So unlike world dressing (kept in EVERY window), decor never leaks across
// windows and the per-window leaf cost is a hard local cap, not deck-scaled.
//
// Analytic-renderer safe: box / cylinder only, yaw-only rotation — the whole
// family stays inside the zero-march default's SUPPORTED set.
//
// Infinigen 八课收官后的 nature 语汇(2026-07-14, OPT-IN style='nature'):
// 抽象石碑换成资产工厂的产物 —— 密度聚簇的风化石群(L01 工厂 + L06 聚簇 +
// L08 年龄轴)+ 背风侧针叶树小林分(L04 genome)。全部 placeholder 形态
// (analytic 契约:单 prim / union 子项只平移 / yaw-only),预算按 LEAF 数
// 记账(树的 placeholder = 3 leaf/棵),同一套 caps 同一套 collection 路由。
import { makeHashRand } from '../present/decor/rand.js';
import { makeBoulderFactory } from './boulder-factory.js';
import { makeConiferFactory } from './conifer-factory.js';
import { makeAssetCollection } from './asset-collection.js';
import { densityScatter } from './density-scatter.js';

export const DECOR_VALUE_CAP = 0.5; // brightness ceiling — decor never outshines data
export const STATION_DECOR_MAX = 8; // per-station leaf cap (window budget guard)
export const SEGMENT_DECOR_MAX = 6; // per-transit leaf cap

// Stelae ring band: outside every fitted stage platform (radius ≤ ~7 across
// the shipped renderers), inside the breadcrumb corridor (stride 16).
const BAND_MIN = 8.2;
const BAND_MAX = 11.5;

/**
 * makeDeckDecor(seed, opts?) → { station(k, origin), segment(k, a, b) } | null
 * One instance per assembled deck; the seed string is the deck's art identity.
 * Family-level decisions (element vocabulary, palette tilt, density) come from
 * deck-wide lanes; per-station/segment jitter comes from indexed lanes, so
 * every station shares one voice but no two stations are stamped copies.
 * opts.style — 'stelae'(默认,抽象石碑)| 'nature'(石群+林分,OPT-IN)。
 */
export function makeDeckDecor(seed, { style = 'stelae' } = {}) {
  if (!seed) return null;
  if (style === 'nature') return makeNatureDecor(seed);
  const R = makeHashRand(String(seed));

  // ---- deck-wide family voice (one decision each, own lane) -------------------
  const vocab = R.pick('vocab', ['slab', 'column', 'mixed']); // stelae element vocabulary
  const hue = R.range('hue', 0.52, 0.68); // cool band only — accents stay the data's
  const sat = R.range('sat', 0.08, 0.3);
  const density = R.range('density', 0.55, 1.0); // scales counts inside the caps
  const arcStyle = R.pick('arc', ['ring', 'crescent', 'pair']); // scatter macro-shape
  const inlayStyle = R.pick('inlay', ['dashes', 'plates']);

  const stelaType = (lane) =>
    vocab === 'mixed' ? R.pick(lane, ['box', 'cylinder']) : vocab === 'column' ? 'cylinder' : 'box';

  function station(k, origin) {
    const out = [];
    const n = Math.min(
      STATION_DECOR_MAX,
      Math.max(3, Math.round(R.range(`st${k}-n`, 3, STATION_DECOR_MAX) * density)),
    );
    // macro-shape: full ring / leeward crescent (leaves the camera side open —
    // hero shots come from +z) / two flanking clusters
    const arc =
      arcStyle === 'ring'
        ? [0, 2 * Math.PI]
        : arcStyle === 'crescent'
          ? [Math.PI * 0.55, Math.PI * 1.45]
          : null;
    for (let i = 0; i < n; i++) {
      const th = arc
        ? arc[0] + ((i + 0.5) / n) * (arc[1] - arc[0]) + R.range(`st${k}-j${i}`, -0.12, 0.12)
        : (i % 2 ? Math.PI * 0.85 : Math.PI * 1.15) + R.range(`st${k}-j${i}`, -0.35, 0.35);
      const r = R.range(`st${k}-r${i}`, BAND_MIN, BAND_MAX);
      const h = R.range(`st${k}-h${i}`, 0.35, 1.15);
      const w = R.range(`st${k}-w${i}`, 0.16, 0.42);
      const type = stelaType(`st${k}-t${i}`);
      out.push({
        id: `s${k}-decor-stela-${i}`,
        type,
        args:
          type === 'box'
            ? { dims: [w, h, w * R.range(`st${k}-d${i}`, 0.4, 1)] }
            : { radius: w * 0.55, height: h },
        transform: {
          translate: [origin[0] + Math.sin(th) * r, h / 2, origin[2] + Math.cos(th) * r],
          rotate: [0, R.range(`st${k}-y${i}`, 0, Math.PI), 0],
        },
        material: {
          hue,
          sat,
          value: R.range(`st${k}-v${i}`, 0.3, DECOR_VALUE_CAP),
          metal: 0,
          glow: 0,
          kind: 'normal',
          roughness: 0.8,
        },
      });
    }
    return out;
  }

  function segment(k, a, b) {
    const out = [];
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dz) || 1;
    const yaw = Math.atan2(dz, dx);
    const px = -dz / len; // perpendicular — the flanks, never the path itself
    const pz = dx / len;
    // SEGMENT_DECOR_MAX is a per-WINDOW budget, and a transit window carries
    // BOTH segments it touches (sliceDeckWindow keeps path-k and path-(k+1)),
    // so each segment may only emit half the window cap.
    const n = Math.min(SEGMENT_DECOR_MAX / 2, Math.max(2, Math.round(3 * density)));
    for (let i = 0; i < n; i++) {
      const f = (i + 1) / (n + 1);
      const side = i % 2 ? 1 : -1;
      const off = R.range(`seg${k}-o${i}`, 1.4, 2.4) * side;
      const long = inlayStyle === 'dashes' ? R.range(`seg${k}-l${i}`, 0.5, 1.1) : 0.34;
      out.push({
        id: `path-${k}-decor-${i}`,
        type: 'box',
        args: { dims: [long, 0.05, inlayStyle === 'dashes' ? 0.12 : 0.34] },
        transform: {
          translate: [a[0] + dx * f + px * off, 0.025, a[2] + dz * f + pz * off],
          rotate: [0, -yaw, 0],
        },
        material: {
          hue,
          sat: sat * 0.7,
          value: R.range(`seg${k}-v${i}`, 0.34, DECOR_VALUE_CAP),
          metal: 0,
          glow: 0,
          kind: 'normal',
          roughness: 0.7,
        },
      });
    }
    return out;
  }

  return { station, segment, voice: { vocab, arcStyle, inlayStyle, hue, density } };
}

// ---- nature 语汇(Infinigen 全链的 deck 消费端)--------------------------------
// 站台环带:密度聚簇石群(簇心大簇缘小)+ 背风半环针叶树(hero 机位从 +z 来,
// 树只长 [0.5π, 1.5π] 的背风侧,视线永不被冠层挡)。transit:沿线小石阵。
// 纪律不变:亮度 ≤ DECOR_VALUE_CAP、绿色降饱和(decor 不与数据 accent 争)、
// leaf 预算 ≤ 同一套 caps(树 = 3 leaf)。
function makeNatureDecor(seed) {
  const R = makeHashRand(`${seed}:nature`);
  const density = R.range('density', 0.6, 1.0);
  // 物种混林(L03):两族石头 + 一族针叶树,全 deck 一个生态
  const rocks = makeAssetCollection(
    [makeBoulderFactory(`${seed}-rk-a`), makeBoulderFactory(`${seed}-rk-b`)],
    { weights: [0.7, 0.3], seed: `${seed}:rocks`, form: 'placeholder' },
  );
  const stand = makeConiferFactory(`${seed}-stand`);
  const treeShare = R.range('trees', 0.2, 0.45); // 树在环带里的占比(物种声音)

  // decor 纪律:压亮度、绿降饱和(树的物种材质本为主体设计,做背景要收敛)
  const subdue = (m) => ({
    ...m,
    sat: Math.min(m.sat, 0.4) * 0.8,
    value: Math.min(m.value, DECOR_VALUE_CAP),
  });
  const subdueTree = (t) => ({
    ...t,
    children: t.children.map((c) => ({ ...c, material: subdue(c.material) })),
  });

  function station(k, origin) {
    const spots = densityScatter({
      region: {
        kind: 'annulus',
        center: [origin[0], origin[2]],
        rMin: BAND_MIN,
        rMax: BAND_MAX,
      },
      count: STATION_DECOR_MAX,
      seed: `${seed}:st${k}`,
      mask: { noiseScale: 0.07, threshold: 0.5 },
      minDist: 1.4,
    });
    const out = [];
    let leaves = 0; // 预算按 leaf 记账:rock=1, tree(placeholder)=3
    spots.forEach((s, i) => {
      const th = Math.atan2(s.at[0] - origin[0], s.at[2] - origin[2]); // 站台系方位
      const leeward = Math.abs(th) > Math.PI * 0.5; // 背风半环(hero 从 +z 看进来)
      const wantTree = leeward && R.range(`st${k}-sp${i}`, 0, 1) < treeShare;
      const cost = wantTree ? 3 : 1;
      if (leaves + cost > STATION_DECOR_MAX) return;
      leaves += cost;
      if (wantTree) {
        const t = subdueTree(
          stand.createPlaceholder(k * 16 + i, { at: s.at, scale: 0.55 + s.density * 0.35 }),
        );
        t.id = `s${k}-decor-tree-${i}`;
        out.push(t);
      } else {
        const b = rocks.spawn(k * 16 + i, { at: s.at, scale: (0.3 + s.density * 0.55) * density });
        b.id = `s${k}-decor-rock-${i}`;
        b.material = subdue(b.material);
        out.push(b);
      }
    });
    return out;
  }

  function segment(k, a, b) {
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len;
    const pz = dx / len;
    const n = Math.min(SEGMENT_DECOR_MAX / 2, Math.max(2, Math.round(3 * density)));
    const out = [];
    for (let i = 0; i < n; i++) {
      const f = (i + 1) / (n + 1);
      const side = i % 2 ? 1 : -1;
      const off = R.range(`seg${k}-o${i}`, 1.6, 2.6) * side;
      const rock = rocks.spawn(64 + k * 8 + i, {
        at: [a[0] + dx * f + px * off, 0, a[2] + dz * f + pz * off],
        scale: R.range(`seg${k}-s${i}`, 0.18, 0.34),
      });
      rock.id = `path-${k}-decor-${i}`;
      rock.material = subdue(rock.material);
      out.push(rock);
    }
    return out;
  }

  return { station, segment, voice: { style: 'nature', density, treeShare } };
}
