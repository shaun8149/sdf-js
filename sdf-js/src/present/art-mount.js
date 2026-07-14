// =============================================================================
// art-mount.js — Sprint 82: 真迹装裱 (authentic-artwork mount) as a product
// surface.
//
// A "mount" is an externally rendered generative artwork set (one large
// cover piece + a strip of SMALL-canvas mints) that takes the decor
// engine's place on a deck's art surfaces — cover full-bleed, title
// banners as a gallery filmstrip (renderer opts decorArt / decorArtStrip,
// Sprint 80-81). Mints come from running the ORIGINAL on-chain scripts
// verbatim (non-commercial; see examples/original-mints/README.md) and
// live in examples/original-mints/cache/ (gitignored) with a manifest.
//
// This module is the single place that turns a mount into render opts, so
// author-2d, the exporters and any future surface stay in lockstep.
// =============================================================================

import { pickDistinct, ensureContrast } from './atoms-2d/color.js';

/**
 * artMountOpts(mount, slot, baseRole) → partial renderSceneDataToCanvas opts.
 * Content pages are promoted to 'section' so EVERY page carries the banner
 * filmstrip (the mount is the deck's visual identity, not a per-page whim);
 * the strip rotates by slotIdx so no two banners start on the same mint.
 * Sprint 84 (user: 内页丢了生成艺术是负优化): every promoted page also asks
 * the renderer for the SUBTLE decor underlay (decorUnder) — the decor
 * engine keeps painting the body, in the MOUNT's palette, so the artwork's
 * voice runs through every page instead of stopping at the banner.
 */
export function artMountOpts(mount, slot, baseRole) {
  if (!mount || !mount.cover) return null;
  // Sprint 97 (批量产品化): 转场页 (insertTransitions 合成) = 封面式纯
  // cover — 全幅变体真迹, 无横带无 underlay。此前只有临场脚本知道这条
  // 规则; 收进中枢后 author-2d / pdf / pptx 自动同律。
  if (slot?._transition) {
    return { decorRole: 'cover', decorArt: transitionArt(mount, slot) };
  }
  const role = baseRole === 'cover' || baseRole === 'agenda' ? baseRole : 'section';
  const out = { decorRole: role, decorArt: mount.cover };
  if (role === 'section') out.decorUnder = true;
  if (Array.isArray(mount.strip) && mount.strip.length) {
    const k = (slot.slotIdx ?? 0) % mount.strip.length;
    out.decorArtStrip = mount.strip.slice(k).concat(mount.strip.slice(0, k));
  }
  return out;
}

/**
 * mountProvenance(entry) — deck.json 契约的 artMount 溯源块 (Sprint 97)。
 * manifest entry → 可序列化的最小出处: 3D 端 (吃 deck.json) 由此知道装裱
 * 的存在 — id 可回查 cache, palette 预烘焙可直接 re-voice, license 随行。
 * 图像本体不进契约 (deck.json 是机器契约不是资产包)。
 */
export function mountProvenance(entry) {
  if (!entry?.id) return undefined;
  const out = {
    id: entry.id,
    name: entry.name,
    artist: entry.artist,
    license: entry.license,
  };
  if (entry.hash) out.hash = entry.hash;
  if (entry.palette) out.palette = entry.palette;
  return out;
}

/**
 * extractMountPalette(img) → {accent, colors[]} — the artwork's dominant
 * voice, quantized from a downsampled read of the piece. Near-white and
 * near-black pixels are skipped (paper/ink grounds would always win);
 * candidates are ranked by frequency × saturation and deduped by RGB
 * distance, and the most saturated survivor becomes the accent (Sprint 84,
 * user: 数字应统一用彩色, 从生成艺术中提取主色调).
 */
export function extractMountPalette(img, { maxColors = 6 } = {}) {
  try {
    const S = 48;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data;
    const buckets = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const gg = d[i + 1];
      const b = d[i + 2];
      const lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      if (lum > 235 || lum < 18) continue;
      const key = ((r >> 4) << 8) | ((gg >> 4) << 4) | (b >> 4);
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, sat: 0 };
      e.n++;
      e.r += r;
      e.g += gg;
      e.b += b;
      e.sat += Math.max(r, gg, b) - Math.min(r, gg, b);
      buckets.set(key, e);
    }
    const cands = [...buckets.values()]
      .map((e) => ({
        rgb: [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)],
        score: e.n * (1 + e.sat / e.n / 128),
      }))
      .sort((a, b) => b.score - a.score);
    // Sprint 96 (提色 v2): 去重从 RGB 欧氏距离换 OKLab ΔE — 感知均匀,
    // 图表相邻 series 色保证可区分 (RGB 距离在暗区/绿区严重失真)
    const picked = pickDistinct(
      cands.map((c2) => c2.rgb),
      maxColors,
    );
    if (!picked.length) return null;
    const satOf = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
    // accent: most saturated pick with enough presence (top half of ranking)
    const top = picked.slice(0, Math.max(2, Math.ceil(picked.length / 2) + 1));
    const accent = [...top].sort((a, b) => satOf(b) - satOf(a))[0];
    return { accent, colors: [accent, ...picked.filter((p) => p !== accent)] };
  } catch {
    return null; // tainted canvas / no DOM — mount still works, without a palette
  }
}

/**
 * mountPaletteOverride(basePalette, mount) → the deck palette re-voiced in
 * the artwork's colors. Accent AND colors[] are replaced (atoms read either);
 * ink/bg/silhouette stay with the theme so text contrast is untouched.
 * Sprint 96 (色彩语义化):
 *   - palette.semantic (涨跌红绿/警示/中性) 随 basePalette 原样透传, 艺术
 *     色永不覆盖 — 语义色是「含义」不是「装饰」。
 *   - accent 过 ensureContrast: 提出的主色对纸底明度差不足时压暗/提亮,
 *     数字与标题永远可读 (「给角色找对比度达标的槽位」)。
 */
export function mountPaletteOverride(basePalette, mount) {
  if (!mount?.palette?.accent) return basePalette;
  const bg = basePalette?.bg || [248, 246, 240];
  // Round 2 (灰度装裱对抗, 2026-07-14): accent 承载标题级数字, 对比地板
  // 提到 ΔL 0.34 — 灰阶 mount 的浅灰 accent 压到可读深度; 彩色 mount
  // 的中深色 accent 天然 ≥0.34, 不受影响
  const accent = ensureContrast(mount.palette.accent, bg, 0.34);
  const colors = Array.isArray(mount.palette.colors)
    ? [accent, ...mount.palette.colors.slice(1)]
    : mount.palette.colors;
  return { ...basePalette, accent, colors };
}

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`art-mount: failed to load ${url}`));
    im.src = url;
  });

/**
 * loadArtMount(entry, base) — load a manifest entry's images.
 * `base` is the URL prefix of the cache dir (trailing slash). Prefers the
 * GL-sweep triple smalls (<id>-small-0/1/2.png), falls back to the single
 * legacy small, then to the cover itself.
 */
export async function loadArtMount(entry, base) {
  if (!entry || entry.status !== 'ok' || !entry.files?.large) {
    throw new Error(`art-mount: ${entry?.id || '?'} has no usable large mint`);
  }
  const cover = await loadImage(base + entry.files.large);
  // Sprint 90 (user: 转场页用另一个 hash 的另一张图): large VARIANTS —
  // extra mints of the same artwork under different hashes, cached as
  // <id>-large-t<k>.png. Absent variants are fine; transitions fall back
  // to the cover itself.
  const variants = [];
  for (let k = 0; k < 8; k++) {
    try {
      variants.push(await loadImage(`${base}${entry.id}-large-t${k}.png`));
    } catch {
      break; // contiguous t0..tn convention
    }
  }
  const strip = [];
  for (let k = 0; k < 3; k++) {
    try {
      strip.push(await loadImage(`${base}${entry.id}-small-${k}.png`));
    } catch {
      /* variant absent — fine */
    }
  }
  if (!strip.length && entry.files.small) {
    try {
      strip.push(await loadImage(base + entry.files.small));
    } catch {
      /* fall through to cover-only mount */
    }
  }
  return {
    id: entry.id,
    name: entry.name,
    artist: entry.artist,
    cover,
    strip,
    variants,
    // Sprint 87: prebaked palette from the manifest wins (bake once, render
    // anywhere — the gallery shows the same swatches the deck will wear)
    palette: entry.palette || extractMountPalette(cover),
  };
}

// ── Sprint 85: 内页纹样 — 异源为默认 (user A/B 裁定: 同源异源都好于无, 保留异源) ──
// Each mount gets a DETERMINISTIC underlay family that is deliberately NOT
// the family ported from the same artwork — the wall art and the wallpaper
// speak the same palette but different forms. Stable per mount id.
const MOUNT_FAMILY_OF = {
  L01: 'meadow-streaks',
  L02: 'banded-ribbons',
  L03: 'block-mosaic',
  L04: 'wash-flow',
  L05: 'strata-lines',
  L06: 'sediment-layers',
  L07: 'ink-scribble',
  L08: 'light-edges',
  L10: 'hex-lattice',
  L13: 'drift-web',
  L17: 'cargo-dashes',
  L19: 'folded-screens',
  L21: 'scan-tides',
  L22: 'paper-folds',
  L26: 'growth-loops',
  L28: 'street-grid',
  L33: 'torn-paper',
  L38: 'peg-wraps',
  L41: 'river-courses',
};
const UNDERLAY_FAMILIES = [
  'flow-streams',
  'weave-dashes',
  'circle-pack',
  'shard-mesh',
  'meadow-streaks',
  'flow-ribbons',
  'banded-ribbons',
  'block-mosaic',
  'wash-flow',
  'strata-lines',
  'sediment-layers',
  'ink-scribble',
  'light-edges',
  'nib-flourish',
  'hex-lattice',
  'drift-web',
  'cargo-dashes',
  'folded-screens',
  'halftone-fade',
  'scan-tides',
  'paper-folds',
  'growth-loops',
  'street-grid',
  'torn-paper',
  'peg-wraps',
  'river-courses',
];

function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = ((h ^ str.charCodeAt(i)) * 16777619) | 0;
  return h >>> 0;
}

/**
 * underlayFamilyFor(mountId) → a stable decor family ≠ the mount's own
 * port. Pure derived pick (S89: user ruled — 随机就很好, 同作者优先与
 * 推荐逻辑均未产生可感知增益, 回退保持系统简单; 曾试过的两版见 git
 * history #326/#321)。
 */
export function underlayFamilyFor(mountId) {
  const own = MOUNT_FAMILY_OF[mountId];
  const pool = UNDERLAY_FAMILIES.filter((f) => f !== own);
  return pool[fnv1a('underlay:' + mountId) % pool.length];
}

/**
 * mountUnderlayDecor(baseDecor, mount, mode) → decor re-familied for this
 * mount. mode 'hetero' (default — user A/B ruling) picks a stable family
 * DIFFERENT from the mount's own port; 'homo' uses the same-artwork family
 * where one exists (user: Naïve×drift-web 做到了颜色和设计的和谐).
 */
export function mountUnderlayDecor(baseDecor, mount, mode = 'hetero') {
  if (!baseDecor || !mount?.id) return baseDecor;
  const homo = MOUNT_FAMILY_OF[mount.id];
  const family = mode === 'homo' && homo ? homo : underlayFamilyFor(mount.id);
  return { ...baseDecor, family };
}

/**
 * insertTransitions(slots, mount) — Sprint 90 (user: 6 个子目录就有 6 个
 * 转场页, 封面式排版突出生成艺术, 另一个 hash 另一张图)。
 * A transition page is synthesized BEFORE each section-boundary slot
 * (slotName ending in "-lead", plus the risk/summary boundary when the
 * agenda promises more sections than leads). It is a pure-cover slot:
 * full-bleed artwork (a different mint VARIANT per transition) + the
 * section title, centered like the deck cover. Returns a NEW slot list;
 * synthetic slots carry _transition: {index} so renderers can pick art.
 */
/** agendaLabelsOf(slots) — deck 目录条目 (转场页与 theme 页题的共同来源)。 */
export function agendaLabelsOf(slots) {
  const agenda = (slots || []).find((s) => s.slotName === 'agenda');
  const labels = [];
  if (agenda?.sceneData?.subjects) {
    for (const sub of agenda.sceneData.subjects) {
      if (sub?.type === 'agenda-list' && Array.isArray(sub.args?.items)) {
        for (const it of sub.args.items) if (it?.label) labels.push(String(it.label));
      }
    }
  }
  return labels;
}

/**
 * themeSlotBannerTitle(slot, agendaLabels) → string | null — 对抗 R4:
 * 管线烤出的 "Theme N — Lead/Detail" 占位符不配上横带; theme 页的真页题
 * 是 agenda 第 N 条 (与转场页同源同律)。非 theme 槽位返回 null。
 */
export function themeSlotBannerTitle(slot, agendaLabels) {
  const m = /^theme-(\d+)-(lead|detail)$/.exec(String(slot?.slotName || ''));
  if (!m) return null;
  // 只救占位符 — 手工修好的真页题 (ANTFUN 范本) 不许被 agenda 覆盖
  const cover = (slot?.sceneData?.subjects || []).find((s2) => s2?.type === 'cover');
  const cur = String(cover?.args?.title || '').trim();
  const isPlaceholder = !cur || /^(theme\s*\d+\s*[—–-]+\s*(lead|detail)|slide\s*\d+)$/i.test(cur);
  if (!isPlaceholder) return null;
  return agendaLabels[Number(m[1]) - 1] || null;
}

export function insertTransitions(slots, mount) {
  if (!mount) return slots;
  const labels = agendaLabelsOf(slots);
  const isBoundary = (s, i) =>
    /-lead$/.test(s.slotName || '') || ((s.slotName || '') === 'risk-matrix' && labels.length > 5);
  const out = [];
  let t = 0;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (isBoundary(s, i) && t < Math.max(labels.length, 6)) {
      const title = labels[t] || s.slotTitle || '';
      out.push({
        slotIdx: s.slotIdx - 0.5,
        slotName: `transition-${t + 1}`,
        slotTitle: title,
        _transition: { index: t },
        sceneData: {
          subjects: [
            {
              type: 'cover',
              x: 0,
              y: 0,
              w: 1280,
              h: 720,
              args: { title }, // Sprint 91: 页码字样删除 (user)
            },
          ],
        },
      });
      t++;
    }
    out.push(s);
  }
  return out;
}

/** transitionArt(mount, slot) → the variant image for a synthetic slot. */
export function transitionArt(mount, slot) {
  if (!slot?._transition || !mount) return null;
  const pool = mount.variants?.length ? mount.variants : [mount.cover];
  return pool[slot._transition.index % pool.length];
}

/** fetchMintManifest(base) → manifest array, or null when the cache is absent. */
export async function fetchMintManifest(base) {
  try {
    const res = await fetch(base + 'manifest.json');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
