// =============================================================================
// align.js — Sprint 83: deterministic layout hygiene (user: 页面元素对齐
// 再优化一下, 现在画面有一点脏).
//
// LLM-lifted slots carry near-miss geometry: three cards at x=40/43/38, a
// column edge that wanders 6px, gaps of 22/26/23. Individually invisible,
// together they read as dirt. This pass cleans a slot's subjects without
// any aesthetic opinion:
//   1. EDGE CLUSTERING — left / right / top / bottom edges within `tol`
//      of each other collapse to their cluster median (things that were
//      meant to align, align);
//   2. GRID SNAP — every resulting edge lands on an `grid`-px lattice
//      (margins and gaps become multiples of one rhythm).
//
// View-level: the renderer applies it at paint time; deck.json (the
// machine contract, twin source for the 3D end) keeps the raw lift
// geometry. Banner 'cover' atoms are exempt — they own full-width bands.
// =============================================================================

function clusterMedians(values, tol) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  let group = [];
  const flush = () => {
    if (!group.length) return;
    const median = group[Math.floor(group.length / 2)][0];
    for (const [, i] of group) out[i] = median;
    group = [];
  };
  for (const pair of idx) {
    if (group.length && pair[0] - group[group.length - 1][0] > tol) flush();
    group.push(pair);
  }
  flush();
  return out;
}

/**
 * alignSceneData(sceneData, {grid, tol}) → a NEW sceneData with cleaned
 * subject geometry. Pure; the input is never mutated.
 */
export function alignSceneData(sceneData, { grid = 8, tol = 14 } = {}) {
  const subjects = Array.isArray(sceneData?.subjects) ? sceneData.subjects : [];
  const snap = (v) => Math.round(v / grid) * grid;
  const movable = [];
  for (let i = 0; i < subjects.length; i++) {
    const s = subjects[i];
    if (
      s &&
      s.type !== 'cover' &&
      typeof s.x === 'number' &&
      typeof s.y === 'number' &&
      typeof s.w === 'number' &&
      typeof s.h === 'number'
    ) {
      movable.push(i);
    }
  }
  if (!movable.length) return sceneData;
  const lefts = clusterMedians(
    movable.map((i) => subjects[i].x),
    tol,
  );
  const rights = clusterMedians(
    movable.map((i) => subjects[i].x + subjects[i].w),
    tol,
  );
  const tops = clusterMedians(
    movable.map((i) => subjects[i].y),
    tol,
  );
  const bottoms = clusterMedians(
    movable.map((i) => subjects[i].y + subjects[i].h),
    tol,
  );
  const next = subjects.slice();
  for (let k = 0; k < movable.length; k++) {
    const s = subjects[movable[k]];
    const x = snap(lefts[k]);
    const y = snap(tops[k]);
    next[movable[k]] = {
      ...s,
      x,
      y,
      w: Math.max(16, snap(rights[k]) - x),
      h: Math.max(16, snap(bottoms[k]) - y),
    };
  }
  return { ...sceneData, subjects: next };
}
