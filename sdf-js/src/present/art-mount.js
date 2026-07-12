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
    palette: extractMountPalette(cover),
  };
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
