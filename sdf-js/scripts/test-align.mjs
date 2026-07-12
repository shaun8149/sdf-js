// test-align.mjs — Sprint 83: layout-hygiene pass (edge clustering + grid snap)
import { alignSceneData } from '../src/present/align.js';

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}

// 1. near-miss left edges collapse to one column
{
  const scene = {
    subjects: [
      { type: 'kpi-card', x: 40, y: 160, w: 380, h: 200 },
      { type: 'kpi-card', x: 43, y: 400, w: 377, h: 200 },
      { type: 'kpi-card', x: 38, y: 640, w: 382, h: 200 },
    ],
  };
  const out = alignSceneData(scene);
  const xs = new Set(out.subjects.map((s) => s.x));
  ok(xs.size === 1, `near-miss lefts unify (${[...xs].join(',')})`);
  const rights = new Set(out.subjects.map((s) => s.x + s.w));
  ok(rights.size === 1, 'near-miss rights unify');
  ok([...xs][0] % 8 === 0, 'unified edge sits on the 8px grid');
}

// 2. genuinely different columns stay apart
{
  const scene = {
    subjects: [
      { type: 'kpi-card', x: 40, y: 160, w: 300, h: 200 },
      { type: 'kpi-card', x: 640, y: 160, w: 300, h: 200 },
    ],
  };
  const out = alignSceneData(scene);
  ok(out.subjects[1].x - out.subjects[0].x > 500, 'distinct columns are not merged');
  ok(out.subjects[0].y === out.subjects[1].y, 'shared row tops align');
}

// 3. banner cover atoms and typeless subjects are untouched
{
  const scene = {
    subjects: [
      { type: 'cover', x: 0, y: 0, w: 1280, h: 121 },
      { type: 'bullet-list', x: 41, y: 163, w: 1199, h: 500 },
      null,
    ],
  };
  const out = alignSceneData(scene);
  ok(out.subjects[0].h === 121, 'banner cover keeps its raw geometry');
  ok(out.subjects[1].x % 8 === 0 && out.subjects[1].y % 8 === 0, 'content snaps to grid');
  ok(out.subjects[2] === null, 'null subjects pass through');
}

// 4. pure function — input untouched
{
  const scene = { subjects: [{ type: 'kpi-card', x: 41, y: 163, w: 300, h: 200 }] };
  alignSceneData(scene);
  ok(scene.subjects[0].x === 41, 'input sceneData is never mutated');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
