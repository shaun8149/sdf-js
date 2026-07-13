// test-cjk.mjs — Sprint 94: 中文排版引擎单元测试.
// 钉住三条规则: 盘古之白 / 禁则断行 (行首无收尾标点、latin 词不裂) / 尾行省略。
import { pangu, wrapCJK, fitTextCJK } from '../src/present/atoms-2d/cjk-text.js';

let passed = 0;
let failed = 0;
function ok(cond, msg, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}${extra ? ` — ${extra}` : ''}`);
  }
}

// 等宽 mock: 每字符 10px (thin space 也算 10 — 保守)
const ctx = { measureText: (s) => ({ width: String(s).length * 10 }) };
const SP = '\u2009';

// ── 1. pangu 盘古之白 ──
ok(pangu('质押1万ANT') === `质押${SP}1${SP}万${SP}ANT`, 'CJK↔数字/latin 边界补细空');
ok(pangu('pure english text') === 'pure english text', '纯 latin 不动');
ok(pangu('纯中文不动') === '纯中文不动', '纯 CJK 不动');
ok(pangu('已有 空格 不再补') === '已有 空格 不再补', '已有空格不重复补');
ok(pangu('（ANT）机制') === '（ANT）机制', '全角括号邻界不隔白');
ok(pangu('费率0.5%封顶') === `费率${SP}0.5%${SP}封顶`, '小数与百分号随词');

// ── 2. wrapCJK 禁则断行 ──
{
  // 8 字/行 (maxW=80): 「一二三四五六七，八九」 naive 切法第 8 字后断 → 第二行以「，」开头
  const lines = wrapCJK(ctx, '一二三四五六七，八九', 80);
  ok(
    lines.every((l) => !'，。、；：！？'.includes(l[0])),
    '行首无收尾标点 (禁则)',
    JSON.stringify(lines),
  );
  ok(lines.join('') === '一二三四五六七，八九', '断行不丢字');
}
{
  // 行尾禁: 起始标点「（」不能收行
  const lines = wrapCJK(ctx, '一二三四五六七（八九）', 80);
  ok(
    lines.every((l) => !'（【「'.includes(l[l.length - 1])),
    '行尾无起始标点 (禁则)',
    JSON.stringify(lines),
  );
}
{
  // latin 词整体移行: maxW=100=10字, "中文中文中文 tokens" → tokens 不裂
  const lines = wrapCJK(ctx, '中文中文中文说明 tokens', 100);
  ok(
    lines.some((l) => l.includes('tokens')),
    'latin 词不裂 (整体移行)',
    JSON.stringify(lines),
  );
  ok(
    lines.every((l) => !/^\s/.test(l)),
    '空白不领行',
    JSON.stringify(lines),
  );
}
{
  // 超长 latin token (URL) 字符级兜底拆
  const lines = wrapCJK(ctx, 'https-very-long-token-exceeding-width', 100);
  ok(lines.length > 1 && lines.every((l) => l.length * 10 <= 100), '超宽 latin 长词字符级兜底');
}
{
  // maxLines 截断 + 省略号
  const lines = wrapCJK(ctx, '一二三四五六七八九十甲乙丙丁戊己庚辛', 80, 2);
  ok(lines.length === 2 && lines[1].endsWith('…'), '超行数尾行加省略号', JSON.stringify(lines));
  ok(ctx.measureText(lines[1]).width <= 80, '省略号行不超宽');
}
{
  const lines = wrapCJK(ctx, '短文本', 200);
  ok(lines.length === 1 && lines[0] === '短文本', '不需折行时原样单行');
}

// ── 3. fitTextCJK 单行 ──
ok(fitTextCJK(ctx, '收入2亿', 200) === `收入${SP}2${SP}亿`, '宽度充裕: 单行带盘古之白');
ok(fitTextCJK(ctx, '收入2亿元整', 60) === '收入2亿元整', '空间紧张: 先撤白救宽度');
{
  const s = fitTextCJK(ctx, '这是一段很长很长放不下的文字', 60);
  ok(s.endsWith('…') && ctx.measureText(s).width <= 60, '实在放不下: 截断加省略号');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
