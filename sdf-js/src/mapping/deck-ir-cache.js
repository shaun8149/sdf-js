// Helpers for gen-deck-ir's per-slide cache.
//
// The cache is keyed by output deck name on disk, but its contents are only
// valid for one source deck and one extraction mode. Keep the source fingerprint
// in the cache itself so rerunning the same --name against a different PDF or
// slidedata file cannot silently splice old slide IRs into a new deck.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CACHE_SOURCE_VERSION = 1;

export function fileSha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function imageFingerprint(imagesDir, slideCount) {
  if (!imagesDir) return null;
  const dir = resolve(imagesDir);
  const pages = [];
  for (let i = 0; i < slideCount; i++) {
    const file = `${dir}/page-${String(i + 1).padStart(2, '0')}.png`;
    pages.push(
      existsSync(file)
        ? { page: i, bytes: readFileSync(file).byteLength, sha256: fileSha256(file) }
        : { page: i, missing: true },
    );
  }
  return { dir, pages };
}

export function buildSlideCacheSource({ kind, sourcePath, slideCount, imagesDir = null }) {
  const path = resolve(sourcePath);
  return {
    version: CACHE_SOURCE_VERSION,
    kind,
    path,
    slideCount,
    sha256: fileSha256(path),
    extraction: {
      vision: !!imagesDir,
      images: imageFingerprint(imagesDir, slideCount),
    },
  };
}

export function cacheSourceMatches(a, b) {
  return (
    !!a &&
    !!b &&
    a.version === b.version &&
    a.kind === b.kind &&
    a.slideCount === b.slideCount &&
    a.sha256 === b.sha256 &&
    JSON.stringify(a.extraction || null) === JSON.stringify(b.extraction || null)
  );
}

export function readSlideCache(cachePath, source, { wipe = false, log = () => {} } = {}) {
  if (!existsSync(cachePath) || wipe) return { __source: source };

  const parsed = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (!cacheSourceMatches(parsed.__source, source)) {
    const reason = parsed.__source ? 'source changed' : 'legacy cache missing source fingerprint';
    log(`  cache ignored: ${reason}`);
    return { __source: source };
  }
  return parsed;
}
