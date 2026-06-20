// =============================================================================
// test-linear-layout.mjs — L1 unit tests for Linear archetype region computation
// =============================================================================

import * as ll from '../src/present/linear-layout.js';

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

function approxEq(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

console.log('=== linear-layout smoke test ===\n');

ok(ll.DEFAULT_SPACING === 6, 'DEFAULT_SPACING === 6');

// computeBoundingBox — empty subjects returns zero bbox
{
  const sceneData = { v: 1, name: 'empty', subjects: [] };
  const bbox = ll.computeBoundingBox(sceneData);
  ok(bbox.centerX === 0, 'empty: centerX = 0');
  ok(bbox.centerY === 0, 'empty: centerY = 0');
  ok(bbox.centerZ === 0, 'empty: centerZ = 0');
  ok(bbox.halfWidth === 0.5, 'empty: halfWidth = 0.5 (minimum)');
}

// computeBoundingBox — single subject with translate
{
  const sceneData = {
    v: 1,
    name: 'single',
    subjects: [{ id: 'a', type: 'cube-3d', args: {}, transform: { translate: [2, 0.5, 1] } }],
  };
  const bbox = ll.computeBoundingBox(sceneData);
  ok(approxEq(bbox.centerX, 2), `single: centerX = 2 (got ${bbox.centerX})`);
  ok(approxEq(bbox.centerY, 0.5), `single: centerY = 0.5 (got ${bbox.centerY})`);
  ok(approxEq(bbox.centerZ, 1), `single: centerZ = 1 (got ${bbox.centerZ})`);
}

// computeBoundingBox — multiple subjects, bbox spans them
{
  const sceneData = {
    v: 1,
    name: 'two',
    subjects: [
      { id: 'a', type: 'cube-3d', args: {}, transform: { translate: [-2, 0, 0] } },
      { id: 'b', type: 'cube-3d', args: {}, transform: { translate: [4, 1, 2] } },
    ],
  };
  const bbox = ll.computeBoundingBox(sceneData);
  ok(approxEq(bbox.centerX, 1), `two: centerX = midpoint of -2 and 4 = 1 (got ${bbox.centerX})`);
  ok(approxEq(bbox.centerY, 0.5), `two: centerY = midpoint of 0 and 1 (got ${bbox.centerY})`);
  ok(approxEq(bbox.halfWidth, 3), `two: halfWidth = (4 - (-2)) / 2 = 3 (got ${bbox.halfWidth})`);
}

// computeRegions — empty sections returns empty array
{
  const regions = ll.computeRegions([], 6);
  ok(Array.isArray(regions) && regions.length === 0, 'empty sections: empty regions');
}

// computeRegions — N=1, single section centered at origin (i=0 → centerX=0)
{
  const sections = [{ sceneData: { v: 1, subjects: [] }, title: 'A' }];
  const regions = ll.computeRegions(sections, 6);
  ok(regions.length === 1, 'N=1: 1 region');
  ok(approxEq(regions[0].centerX, 0), 'N=1: centerX = 0');
  ok(regions[0].title === 'A', 'N=1: title carried through');
}

// computeRegions — N=3, spacing 6, centers at 0, 6, 12
{
  const sections = [
    { sceneData: { v: 1, subjects: [] }, title: 'A' },
    { sceneData: { v: 1, subjects: [] }, title: 'B' },
    { sceneData: { v: 1, subjects: [] }, title: 'C' },
  ];
  const regions = ll.computeRegions(sections, 6);
  ok(regions.length === 3, 'N=3: 3 regions');
  ok(approxEq(regions[0].centerX, 0), 'N=3 spacing=6: centerX[0] = 0');
  ok(approxEq(regions[1].centerX, 6), 'N=3 spacing=6: centerX[1] = 6');
  ok(approxEq(regions[2].centerX, 12), 'N=3 spacing=6: centerX[2] = 12');
}

// computeRegions — default spacing applied when omitted
{
  const sections = [
    { sceneData: { v: 1, subjects: [] }, title: 'A' },
    { sceneData: { v: 1, subjects: [] }, title: 'B' },
  ];
  const regions = ll.computeRegions(sections);
  ok(
    approxEq(regions[1].centerX, ll.DEFAULT_SPACING),
    `default spacing: regions[1].centerX = ${ll.DEFAULT_SPACING}`,
  );
}

// computeRegions — region halfWidth derived from sceneData bbox
{
  const sections = [
    {
      sceneData: {
        v: 1,
        subjects: [
          { id: 'a', type: 'cube-3d', args: {}, transform: { translate: [-1, 0, 0] } },
          { id: 'b', type: 'cube-3d', args: {}, transform: { translate: [1, 0, 0] } },
        ],
      },
      title: 'wide',
    },
  ];
  const regions = ll.computeRegions(sections, 6);
  ok(
    approxEq(regions[0].halfWidth, 1),
    `region halfWidth = bbox halfWidth = 1 (got ${regions[0].halfWidth})`,
  );
}

// computeRegions — region.title falls back to Page N+1 if section.title missing
{
  const sections = [
    { sceneData: { v: 1, subjects: [] } }, // no title
    { sceneData: { v: 1, subjects: [] }, title: 'Named' },
  ];
  const regions = ll.computeRegions(sections, 6);
  ok(regions[0].title === 'Page 1', `no title: falls back to "Page 1" (got "${regions[0].title}")`);
  ok(regions[1].title === 'Named', 'with title: preserves');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
