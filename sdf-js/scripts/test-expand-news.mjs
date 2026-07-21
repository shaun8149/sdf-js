#!/usr/bin/env node
// test-expand-news.mjs — Sprint 30: unit tests for the news expansion stage's
// deterministic mechanics (no LLM calls — the LLM path is covered by
// news-stability-harness.mjs, which needs a key).
import { splitToFloor, mergeToCeiling, repairJsonQuotes } from './expand-news.mjs';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== expand-news (Sprint 30: 任意新闻 → 稳定 10-20 页 mechanics) ===\n');

// ── splitToFloor ──
{
  const slides = [
    { title: 'cover', body: ['a'] },
    { title: 'agenda', body: ['b'] },
    { title: 'facts', body: ['1', '2', '3', '4'] },
    { title: 'risks', body: ['5', '6'] },
  ];
  const grown = splitToFloor(slides, 6);
  ok(grown.length === 6, 'splitToFloor reaches the floor (4→6)');
  ok(grown[0].title === 'cover' && grown[1].title === 'agenda', 'cover/agenda never split');
  ok(
    grown.some((s) => s.title === 'facts（续）'),
    'continuation slide titled （续）',
  );
  const allLines = grown.flatMap((s) => s.body).sort();
  ok(allLines.join(',') === '1,2,3,4,5,6,a,b', 'no body line lost or duplicated');
  ok(splitToFloor(slides, 4).length === 4, 'already at floor → untouched');
  // unsplittable: every content slide has 1 body line
  const thin = [
    { title: 'c', body: ['x'] },
    { title: 'a', body: ['y'] },
    { title: 'z', body: ['z'] },
  ];
  ok(splitToFloor(thin, 10).length === 3, 'unsplittable input stops honestly, never pads empty');
}

// ── mergeToCeiling ──
{
  const many = Array.from({ length: 24 }, (_, i) => ({ title: `s${i}`, body: [`l${i}`] }));
  const shrunk = mergeToCeiling(many, 20);
  ok(shrunk.length === 20, 'mergeToCeiling reaches the ceiling (24→20)');
  const allLines = shrunk.flatMap((s) => s.body);
  ok(allLines.length === 24, 'merged slides keep every body line');
  ok(shrunk[0].title === 's0' && shrunk[1].title === 's1', 'cover/agenda never merged');
}

// ── repairJsonQuotes ──
{
  const broken = `[
  {
    "title": "目标：实现"县县全覆盖"部署",
    "body": [
      "要求"全覆盖"落地",
      "normal line"
    ]
  }
]`;
  const parsed = JSON.parse(repairJsonQuotes(broken));
  ok(parsed[0].title.includes('"县县全覆盖"'), 'inner ASCII quotes in key-value line escaped');
  ok(parsed[0].body[0] === '要求"全覆盖"落地', 'inner quotes in array element escaped');
  ok(parsed[0].body[1] === 'normal line', 'clean lines untouched');
  const clean = `[{"title": "ok", "body": ["fine"]}]`;
  ok(
    JSON.stringify(JSON.parse(repairJsonQuotes(clean))) === JSON.stringify(JSON.parse(clean)),
    'valid JSON round-trips unchanged',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
