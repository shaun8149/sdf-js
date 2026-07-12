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
 * Content pages with a cover/banner surface are promoted to 'section' so
 * every paintable art page carries the banner filmstrip (the mount is the
 * deck's visual identity, not a per-page whim); the strip rotates by slotIdx
 * so no two banners start on the same mint.
 */
export function artMountOpts(mount, slot, baseRole) {
  if (!mount || !mount.cover) return null;
  const subjects = Array.isArray(slot?.sceneData?.subjects) ? slot.sceneData.subjects : [];
  const hasArtSurface = subjects.some((s) => s?.type === 'cover');
  if (!hasArtSurface) return null;
  const role = baseRole === 'cover' || baseRole === 'agenda' ? baseRole : 'section';
  const out = { decorRole: role, decorArt: mount.cover };
  if (Array.isArray(mount.strip) && mount.strip.length) {
    const k = (slot.slotIdx ?? 0) % mount.strip.length;
    out.decorArtStrip = mount.strip.slice(k).concat(mount.strip.slice(0, k));
  }
  return out;
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
  return { id: entry.id, name: entry.name, artist: entry.artist, cover, strip };
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
