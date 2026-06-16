// =============================================================================
// test-generator-s.mjs — unit tests for Generator-S Phase 2 (Track 5.2)
// -----------------------------------------------------------------------------
// Coverage:
//   - scatter (Phase 1 regression — still works)
//   - array  (new): count / spacing / origin=center vs start / scale jitter
//   - mirror (new): plane=yz / xz / xy / phaseFlip on animation
//   - id rewriting: child ids get -${i} suffix (validator requires uniqueness)
//   - determinism: same hash → same expansion
//
// Run:  node sdf-js/scripts/test-generator-s.mjs
// =============================================================================

import { expandVariants } from '../src/scene/generator-s.js';
import { Random } from '../src/util/random.js';

const HASH = '0x' + 'a'.repeat(64);

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

// ---------------------------------------------------------------------------
// scatter regression
// ---------------------------------------------------------------------------
console.log('\n[scatter] Phase 1 regression:');
{
  const scene = {
    subjects: [
      {
        id: 'tree',
        type: 'sphere',
        args: { radius: 0.5 },
        transform: { translate: [0, 0, 0] },
        variants: [
          {
            op: 'scatter',
            count: 5,
            region: { type: 'rectXZ', size: [10, 10] },
          },
        ],
      },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  ok(out.subjects.length === 5, 'expanded to 5 subjects');
  ok(
    out.subjects.every((s) => s.id.startsWith('tree-')),
    'ids suffix tree-0..4',
  );
  ok(
    out.subjects.every((s) => !s.variants),
    'variants field stripped',
  );
  ok(
    out.subjects.every((s) => Array.isArray(s.transform.translate)),
    'each has translate',
  );
}

// ---------------------------------------------------------------------------
// array op
// ---------------------------------------------------------------------------
console.log('\n[array] equispaced along x, origin=center:');
{
  const scene = {
    subjects: [
      {
        id: 'pillar',
        type: 'box',
        args: { dims: [0.4, 3, 0.4] },
        transform: { translate: [0, 1.5, 0] },
        variants: [
          {
            op: 'array',
            count: 5,
            axis: 'x',
            spacing: 2.0,
            origin: 'center',
          },
        ],
      },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  ok(out.subjects.length === 5, 'expanded to 5');
  // origin=center, count=5, spacing=2 → offsets -4, -2, 0, 2, 4
  const xs = out.subjects.map((s) => s.transform.translate[0]);
  ok(Math.abs(xs[0] - -4) < 1e-9, `xs[0]=-4 (got ${xs[0]})`);
  ok(Math.abs(xs[2] - 0) < 1e-9, `xs[2]=0 (got ${xs[2]})`);
  ok(Math.abs(xs[4] - 4) < 1e-9, `xs[4]=4 (got ${xs[4]})`);
  // Y unchanged (proto Y=1.5)
  ok(
    out.subjects.every((s) => Math.abs(s.transform.translate[1] - 1.5) < 1e-9),
    'y preserved at 1.5',
  );
  // Z unchanged
  ok(
    out.subjects.every((s) => s.transform.translate[2] === 0),
    'z preserved at 0',
  );
}

console.log('\n[array] origin=start, count=3, axis=z:');
{
  const scene = {
    subjects: [
      {
        id: 'step',
        type: 'box',
        args: { dims: [1, 0.2, 1] },
        transform: { translate: [0, 0, 0] },
        variants: [{ op: 'array', count: 3, axis: 'z', spacing: 1.0, origin: 'start' }],
      },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  const zs = out.subjects.map((s) => s.transform.translate[2]);
  ok(
    zs[0] === 0 && zs[1] === 1 && zs[2] === 2,
    `start mode zs=[0,1,2] (got ${JSON.stringify(zs)})`,
  );
}

console.log('\n[array] custom axis vector + scale jitter:');
{
  const scene = {
    subjects: [
      {
        id: 'beam',
        type: 'sphere',
        args: { radius: 0.3 },
        transform: { translate: [0, 0, 0], scale: 1.0 },
        variants: [
          {
            op: 'array',
            count: 4,
            axis: [1, 1, 0],
            spacing: 1.414,
            scale: { jitter: 0.1 },
          },
        ],
      },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  ok(out.subjects.length === 4, '4 copies');
  // axis [1,1,0]/√2 → x and y move same amount per copy
  // count=4, origin=center → offsets -1.5, -0.5, 0.5, 1.5 × spacing(1.414)
  // step in x = step in y (both 1.414 × 1/√2 = 1.0)
  const dx = out.subjects[1].transform.translate[0] - out.subjects[0].transform.translate[0];
  const dy = out.subjects[1].transform.translate[1] - out.subjects[0].transform.translate[1];
  ok(Math.abs(dx - dy) < 1e-3, `dx=dy on diagonal axis (dx=${dx.toFixed(3)}, dy=${dy.toFixed(3)})`);
  ok(
    out.subjects.every((s) => typeof s.transform.scale === 'number'),
    'scale is number per copy',
  );
  ok(
    out.subjects.every((s) => s.transform.scale > 0.85 && s.transform.scale < 1.15),
    'scale within jitter band',
  );
}

// ---------------------------------------------------------------------------
// mirror op
// ---------------------------------------------------------------------------
console.log('\n[mirror] yz plane (default), flip X:');
{
  const scene = {
    subjects: [
      {
        id: 'wing',
        type: 'box',
        args: { dims: [2, 0.1, 0.5] },
        transform: { translate: [1.5, 0.5, 0], rotate: [0, 0.2, 0] },
        variants: [{ op: 'mirror', plane: 'yz' }],
      },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  ok(out.subjects.length === 2, '2 subjects (orig + mirror)');
  ok(out.subjects[0].id === 'wing-0', 'orig id wing-0');
  ok(out.subjects[1].id === 'wing-1', 'mirror id wing-1');
  ok(out.subjects[0].transform.translate[0] === 1.5, 'orig x=1.5');
  ok(out.subjects[1].transform.translate[0] === -1.5, 'mirror x=-1.5');
  ok(out.subjects[0].transform.rotate[1] === 0.2, 'orig rotY=0.2');
  ok(Math.abs(out.subjects[1].transform.rotate[1] - -0.2) < 1e-9, 'mirror rotY=-0.2');
}

console.log('\n[mirror] phaseFlip applies to animation channels (v1 value form):');
{
  const scene = {
    subjects: [
      {
        id: 'flapper',
        type: 'box',
        args: { dims: [1, 0.1, 0.3] },
        transform: { translate: [1, 0, 0] },
        animation: [
          {
            channel: 'transform.rotate.z',
            value: { kind: 'time', form: 'sin', amp: 0.3, freq: 2, phase: 0 },
          },
        ],
        variants: [{ op: 'mirror', plane: 'yz', phaseFlip: Math.PI }],
      },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  ok(out.subjects[0].animation[0].value.phase === 0, 'orig value.phase=0');
  ok(Math.abs(out.subjects[1].animation[0].value.phase - Math.PI) < 1e-9, 'mirror value.phase=π');
}

console.log('\n[mirror] phaseFlip on legacy flat-phase form (back-compat):');
{
  const scene = {
    subjects: [
      {
        id: 'legacy',
        type: 'box',
        args: { dims: [1, 0.1, 0.3] },
        transform: { translate: [1, 0, 0] },
        animation: [{ phase: 0 }],
        variants: [{ op: 'mirror', plane: 'yz', phaseFlip: Math.PI }],
      },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  ok(out.subjects[1].animation[0].phase === Math.PI, 'legacy flat phase flipped');
}

console.log('\n[mirror] xz plane flips Y:');
{
  const scene = {
    subjects: [
      {
        id: 'cloud',
        type: 'sphere',
        args: { radius: 0.5 },
        transform: { translate: [0, 2, 0] },
        variants: [{ op: 'mirror', plane: 'xz' }],
      },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  ok(
    out.subjects[1].transform.translate[1] === -2,
    `xz mirror y=-2 (got ${out.subjects[1].transform.translate[1]})`,
  );
}

// ---------------------------------------------------------------------------
// id rewriting (children must get suffix)
// ---------------------------------------------------------------------------
console.log('\n[id rewrite] children get -${i} suffix:');
{
  const scene = {
    subjects: [
      {
        id: 'group',
        type: 'union',
        children: [
          { id: 'piece-a', type: 'sphere', args: { radius: 0.5 } },
          { id: 'piece-b', type: 'box', args: { dims: [1, 1, 1] } },
        ],
        transform: { translate: [0, 0, 0] },
        variants: [{ op: 'array', count: 3, axis: 'x', spacing: 2.0 }],
      },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  ok(out.subjects.length === 3, '3 copies of group');
  ok(out.subjects[0].id === 'group-0', 'group id group-0');
  ok(
    out.subjects[0].children[0].id === 'piece-a-0',
    `child piece-a-0 (got ${out.subjects[0].children[0].id})`,
  );
  ok(
    out.subjects[2].children[1].id === 'piece-b-2',
    `child piece-b-2 (got ${out.subjects[2].children[1].id})`,
  );
}

// ---------------------------------------------------------------------------
// determinism
// ---------------------------------------------------------------------------
console.log('\n[determinism] same hash → same expansion:');
{
  const sceneTpl = () => ({
    subjects: [
      {
        id: 'bird',
        type: 'sphere',
        args: { radius: 0.2 },
        transform: { translate: [0, 5, 0] },
        variants: [{ op: 'scatter', count: 7, region: { type: 'box3', size: [10, 5, 10] } }],
      },
    ],
  });
  const a = expandVariants(sceneTpl(), new Random(HASH));
  const b = expandVariants(sceneTpl(), new Random(HASH));
  const sameLen = a.subjects.length === b.subjects.length;
  const sameXs = a.subjects.every(
    (s, i) => s.transform.translate[0] === b.subjects[i].transform.translate[0],
  );
  ok(sameLen && sameXs, `deterministic (len=${a.subjects.length}, sameXs=${sameXs})`);
}

// ---------------------------------------------------------------------------
// no variants → pass-through
// ---------------------------------------------------------------------------
console.log('\n[passthrough] no variants → identity:');
{
  const scene = {
    subjects: [
      { id: 'a', type: 'sphere', args: { radius: 1 }, transform: { translate: [0, 0, 0] } },
    ],
  };
  const out = expandVariants(scene, new Random(HASH));
  ok(out.subjects.length === 1, '1 subject preserved');
  ok(out.subjects[0].id === 'a', 'id preserved (no suffix when no variants)');
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------
console.log(`\n${pass}/${pass + fail} tests passed`);
if (fail > 0) process.exit(1);
