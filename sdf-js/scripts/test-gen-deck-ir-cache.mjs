// test-gen-deck-ir-cache.mjs -- locks the slide IR cache invariants that keep
// multi-chart pages from silently losing stations across generator reruns.
import {
  assertNoStationShrink,
  cacheEntryToList,
  emptySlidesCache,
  normalizeSlidesCache,
  SLIDES_CACHE_SCHEMA_VERSION,
  storeSlidesCacheEntry,
} from './gen-deck-ir-cache.mjs';

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
};

const throws = (fn, re) => {
  try {
    fn();
  } catch (e) {
    return re.test(e.message);
  }
  return false;
};

console.log('=== gen-deck-ir cache invariants ===\n');

{
  const c = emptySlidesCache();
  ok(c.__schemaVersion === SLIDES_CACHE_SCHEMA_VERSION, 'new caches carry schema version');
}

{
  const legacy = { 0: { structure: 'magnitude' } };
  const c = normalizeSlidesCache(legacy);
  ok(c.__schemaVersion === SLIDES_CACHE_SCHEMA_VERSION, 'legacy cache is invalidated on full run');
  ok(!c[0], 'legacy entries are not silently reused after schema upgrade');
  ok(
    throws(() => normalizeSlidesCache(legacy, { only: 0 }), /predates the multi-station schema/),
    'legacy cache with --only fails loud instead of preserving stale pages',
  );
}

{
  ok(cacheEntryToList(null) === null, 'empty cache slot reads as null');
  ok(cacheEntryToList({ structure: 'hold' })?.length === 1, 'old bare-object slot wraps on read');
  ok(
    cacheEntryToList([{ structure: 'magnitude' }, { structure: 'proportion' }])?.length === 2,
    'array slot reads as multi-station list',
  );
}

{
  const c = emptySlidesCache();
  storeSlidesCacheEntry(c, 3, [{ structure: 'magnitude' }]);
  ok(Array.isArray(c[3]) && c[3].length === 1, 'single-station writes still store arrays');
  ok(
    throws(() => storeSlidesCacheEntry(c, 4, []), /cannot cache an empty slide IR list/),
    'empty extraction is never cached',
  );
}

{
  const prev = [{ structure: 'magnitude' }, { structure: 'proportion' }];
  ok(
    !throws(
      () =>
        assertNoStationShrink({
          index: 27,
          previous: prev,
          next: [{ structure: 'magnitude' }, { structure: 'proportion' }],
        }),
      /./,
    ),
    'same station count may overwrite a multi-station slot',
  );
  ok(
    throws(
      () =>
        assertNoStationShrink({
          index: 27,
          previous: prev,
          next: [{ structure: 'magnitude' }],
        }),
      /refusing to overwrite 2-station cached page with 1-station extraction/,
    ),
    'multi-station slot cannot be overwritten by a shorter extraction',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
