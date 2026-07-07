// =============================================================================
// decor/rand.js — Sprint 42: hash → deterministic randomness, done right.
//
// Three generations of the idea, and what we take from each:
//   - ArtBlocks/Rizzolli (Fragments #159): hash sliced into 32 fixed decision
//     digits — version-stable per decision, but capped and manual.
//   - fxhash: fxrand() — one sfc32 PRNG seeded from the token hash, every
//     feature just consumes the stream. Beautiful API, but determinism
//     depends on CALL ORDER: insert one rand() upstream and every downstream
//     decision shifts. fxhash freezes code on-chain; our decks re-render
//     across code versions, and the mint-hash provenance claim ("the owner
//     re-derives the exact artifact forever") requires version stability.
//   - Ours: NAMED LANES — rand streams derived from fnv1a(hash + ':' + label).
//     fxrand ergonomics inside a lane, slot-stability across lanes: adding a
//     new lane (new feature) never disturbs existing ones. Unlimited
//     decisions, no ordering coupling between features.
//
// sfc32 per the repo's established PRNG convention (see
// reference_sfc32_prng: same hash → same scene).
// =============================================================================

function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = ((h ^ str.charCodeAt(i)) * 16777619) | 0;
  return h >>> 0;
}

export function sfc32(a, b, c, d) {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * makeHashRand(hash) — the fxrand-style wrapper over a minted hash, with
 * named lanes for version stability.
 *
 *   const R = makeHashRand(deck.decor.hash);
 *   R.pick('family', candidates)      — lane 'family', never disturbed by
 *   R.range('density', 0.3, 0.7)        other lanes gaining/losing calls
 *   R.chance('over-pass', 0.5)
 *   R.int('slide-3', 1, 1e9)          — per-slide generator seeds
 *
 * Within one lane, successive calls advance that lane's own sfc32 stream
 * (fxrand semantics); different lanes are fully independent.
 */
export function makeHashRand(hash) {
  const lanes = new Map();
  const laneRand = (label) => {
    let r = lanes.get(label);
    if (!r) {
      const h1 = fnv1a(`${hash}:${label}`);
      const h2 = fnv1a(`${label}:${hash}`);
      const h3 = fnv1a(`${hash}#${label}#lane`);
      const h4 = fnv1a(`${label}@${hash}@lane`);
      r = sfc32(h1, h2, h3, h4);
      // sfc32 warm-up: first few outputs correlate with seeds
      for (let i = 0; i < 8; i++) r();
      lanes.set(label, r);
    }
    return r;
  };
  return {
    rand: (label) => laneRand(label)(),
    range: (label, min, max) => min + laneRand(label)() * (max - min),
    int: (label, min, max) => Math.floor(min + laneRand(label)() * (max - min + 1)),
    pick: (label, arr) => arr[Math.floor(laneRand(label)() * arr.length)],
    chance: (label, p) => laneRand(label)() < p,
    weighted: (label, pairs) => {
      // pairs: [[value, weight], ...]
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let t = laneRand(label)() * total;
      for (const [v, w] of pairs) {
        t -= w;
        if (t <= 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
  };
}
