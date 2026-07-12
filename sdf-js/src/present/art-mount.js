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
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const picked = [];
    for (const cnd of cands) {
      if (picked.every((p) => dist(p, cnd.rgb) > 60)) picked.push(cnd.rgb);
      if (picked.length >= maxColors) break;
    }
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
 */
export function mountPaletteOverride(basePalette, mount) {
  if (!mount?.palette?.accent) return basePalette;
  return { ...basePalette, accent: mount.palette.accent, colors: mount.palette.colors };
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

// families by ARTIST — Sprint 88 (user: 异源纹样尽量选同一作者, 同频的
// 形语言; 装裱2 批的惊艳度对照实验结论)。key = manifest artist 名。
const ARTIST_FAMILIES = {
  'Monica Rizzolli': ['meadow-streaks'],
  'Tyler Hobbs': ['banded-ribbons', 'flow-ribbons'],
  'Kjetil Golid': ['block-mosaic', 'weave-dashes'],
  NumbersInMotion: ['wash-flow'],
  'Aaron Penne': ['strata-lines'],
  Eko33: ['sediment-layers'],
  'Iskra Velitchkova': ['ink-scribble'],
  'Zach Lieberman': ['light-edges'],
  'Golan Levin': ['nib-flourish'],
  'Lars Wander': ['hex-lattice'],
  'Olga Fradina': ['drift-web'],
  'Kim Asendorf': ['cargo-dashes'],
  'Thomas Lin Pedersen': ['folded-screens'],
  itsgalo: ['halftone-fade'],
  LoVid: ['scan-tides'],
  'James Merrill': ['paper-folds', 'street-grid'],
  'Joshua Bagley': ['growth-loops'],
  'Emily Xie': ['torn-paper'],
  'Dmitri Cherniak': ['peg-wraps'],
  'Robert Hodgin': ['river-courses'],
};

/**
 * underlayFamilyFor(mountId, artist) → a stable decor family for the body.
 * Preference order (Sprint 88): ① a family ported from the SAME ARTIST's
 * OTHER work (同作者异作品 — the artist's formal language stays coherent)
 * ② deterministic pick from the full pool. The mount's own port is always
 * excluded (异源 = different work, 保持).
 */
export function underlayFamilyFor(mountId, artist) {
  const own = MOUNT_FAMILY_OF[mountId];
  const sameArtist = (ARTIST_FAMILIES[artist] || []).filter((f) => f !== own);
  if (sameArtist.length) {
    return sameArtist[fnv1a('underlay:' + mountId) % sameArtist.length];
  }
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
  const family = mode === 'homo' && homo ? homo : underlayFamilyFor(mount.id, mount.artist);
  return { ...baseDecor, family };
}

// ── Sprint 87: 装裱推荐 — score mounts against the deck theme ───────────────
function hueOf([r, g, b]) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  let h;
  if (mx === r) h = ((g - b) / (mx - mn)) % 6;
  else if (mx === g) h = (b - r) / (mx - mn) + 2;
  else h = (r - g) / (mx - mn) + 4;
  return (h * 60 + 360) % 360;
}

/**
 * rankMounts(entries, themeAccent) → entries sorted best-first with _score.
 * Scoring, all heuristics: hue RELATIONSHIP to the theme accent (analogous /
 * complementary / triadic read as designed, arbitrary angles as noise),
 * accent saturation (vivid accents carry the numerals), palette richness,
 * curation tier. Needs prebaked entry.palette (bake step) — unbaked entries
 * sink to the bottom rather than erroring.
 */
export function rankMounts(entries, themeAccent) {
  const themeHue = hueOf(themeAccent || [60, 100, 200]);
  const scored = entries.map((m) => {
    if (m.status !== 'ok' || !m.palette?.accent) return { ...m, _score: -1 };
    const [r, g, b] = m.palette.accent;
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const dh = Math.abs(((hueOf(m.palette.accent) - themeHue + 540) % 360) - 180); // 0..180
    const rel = Math.min(
      Math.abs(180 - dh), // analogous (dh≈180 means same hue after the fold above)
      Math.abs(dh), // complementary
      Math.abs(60 - dh), // triadic-ish
    );
    const harmony = Math.exp(-(rel * rel) / (2 * 28 * 28)); // σ 28°
    const richness = Math.min(1, (m.palette.colors?.length || 0) / 5);
    const tier = m.curation === 'curated' ? 1 : m.curation === 'playground' ? 0.6 : 0.4;
    return { ...m, _score: harmony * 2 + sat * 1.4 + richness * 0.6 + tier * 0.5 };
  });
  return scored.sort((a2, b2) => b2._score - a2._score);
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
