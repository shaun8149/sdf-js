// Pure helpers for gen-deck-ir's per-slide cache. The cache is correctness
// state: stale or shrunk entries silently change the generated deck.
export const SLIDES_CACHE_SCHEMA_VERSION = 2;

export function emptySlidesCache() {
  return { __schemaVersion: SLIDES_CACHE_SCHEMA_VERSION };
}

export function cacheEntryToList(slot) {
  if (Array.isArray(slot)) return slot;
  return slot ? [slot] : null;
}

export function normalizeSlidesCache(raw, { only = null } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptySlidesCache();
  if (raw.__schemaVersion === SLIDES_CACHE_SCHEMA_VERSION) return raw;
  if (only != null) {
    throw new Error(
      'slides cache predates the multi-station schema; rerun without --only once to refresh it',
    );
  }
  return emptySlidesCache();
}

export function assertNoStationShrink({ index, previous, next }) {
  const prev = cacheEntryToList(previous) || [];
  const nextLen = Array.isArray(next) ? next.length : 0;
  if (prev.length > 1 && nextLen < prev.length) {
    throw new Error(
      `[${index}] refusing to overwrite ${prev.length}-station cached page with ${nextLen}-station extraction; run a full --force after checking the source page if this collapse is intentional`,
    );
  }
}

export function storeSlidesCacheEntry(cache, index, list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`[${index}] cannot cache an empty slide IR list`);
  }
  cache[index] = list;
  return cache;
}
