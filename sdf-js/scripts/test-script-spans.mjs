// test-script-spans.mjs — 讲稿对齐:script spans 的解析 + 「只切不改」验证。
import { parseIRResponse, validateScript } from '../src/scene/text-to-ir.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== script spans (teleprompter fuel) ===\n');

const ORIGINAL = '大家好。今天讲三件事。首先看漏斗:1200 个线索最终成交 45 单。这就是重点。谢谢大家。';

const GOOD = JSON.stringify({
  title: 'T',
  slides: [
    { structure: 'sequence', nodes: ['线索', '成交'], magnitude: [1200, 45], emphasis: [1], title: '漏斗' },
  ],
  script: [
    { text: '大家好。今天讲三件事。', station: 0, kind: 'hold' },
    { text: '首先看漏斗:1200 个线索最终成交 45 单。', station: 0, kind: 'station' },
    { text: '这就是重点。', station: 0, kind: 'super' },
    { text: '谢谢大家。', station: 0, kind: 'hold' },
  ],
});

// parse + validate happy path
{
  const deck = parseIRResponse(GOOD, ORIGINAL);
  ok(Array.isArray(deck.script) && deck.script.length === 4, 'script spans parsed (4)');
  ok(deck.script[2].kind === 'super', 'super span kept');
}

// validateScript directly
{
  const deck = JSON.parse(GOOD);
  ok(validateScript(deck, ORIGINAL).ok, 'verbatim slicing validates');

  const reworded = JSON.parse(GOOD);
  reworded.script[1].text = '首先看漏斗:一千二百个线索成交四十五单。'; // 改写 → 拒
  const v1 = validateScript(reworded, ORIGINAL);
  ok(!v1.ok && v1.errors.some((e) => /verbatim|原文/.test(e)), 'rewording rejected (讲稿圣旨)');

  const missing = JSON.parse(GOOD);
  missing.script.pop(); // 少一段 → 拼不回 → 拒
  ok(!validateScript(missing, ORIGINAL).ok, 'dropped span rejected (must cover the whole script)');

  const badStation = JSON.parse(GOOD);
  badStation.script[0].station = 5;
  ok(!validateScript(badStation, ORIGINAL).ok, 'station out of range rejected');

  const badKind = JSON.parse(GOOD);
  badKind.script[0].kind = 'zoom';
  ok(!validateScript(badKind, ORIGINAL).ok, 'unknown kind rejected');
}

// whitespace tolerance: spans may normalize spacing/newlines
{
  const spaced = JSON.parse(GOOD);
  spaced.script[0].text = '大家好。 今天讲三件事。'; // 多一个空格 → 容忍
  ok(validateScript(spaced, ORIGINAL).ok, 'whitespace differences tolerated');
}

// parse path: bad script attaches validationErrors (retry fuel)
{
  const bad = JSON.parse(GOOD);
  bad.script[1].text = '完全不同的话。';
  let e = null;
  try { parseIRResponse(JSON.stringify(bad), ORIGINAL); } catch (x) { e = x; }
  ok(e && Array.isArray(e.validationErrors), 'bad script throws with validationErrors');
}

// back-compat: no script field → fine; script but no original → skipped (no throw)
{
  const noScript = JSON.stringify({ title: 'T', slides: JSON.parse(GOOD).slides });
  ok(!!parseIRResponse(noScript, ORIGINAL), 'deck without script still parses');
  ok(!!parseIRResponse(GOOD), 'script without original text is tolerated (validation skipped)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
