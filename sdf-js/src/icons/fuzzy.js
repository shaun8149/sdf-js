// =============================================================================
// sdf-js/src/icons/fuzzy.js — Levenshtein distance for icon-name fallback
// -----------------------------------------------------------------------------
// Sprint 18: when an LLM emits an icon name we don't have (e.g. typo
// "brifcase" instead of "briefcase"), we find the closest match in the
// baked library and use that. Distance threshold ≤ 2 to avoid wild swaps.
// =============================================================================

/**
 * Compute the Levenshtein edit distance between two strings.
 * Iterative DP, O(n*m) time, O(min(n,m)) space.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Single-row DP
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Find the closest name in candidates list. Returns {name, distance} or null
 * if best distance exceeds maxDistance.
 *
 * @param {string} query
 * @param {string[]} candidates
 * @param {number} [maxDistance=2]
 * @returns {{name: string, distance: number}|null}
 */
export function closestMatch(query, candidates, maxDistance = 2) {
  let bestName = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(query, c);
    if (d < bestDist) {
      bestDist = d;
      bestName = c;
      if (d === 0) break;
    }
  }
  if (bestName === null || bestDist > maxDistance) return null;
  return { name: bestName, distance: bestDist };
}
