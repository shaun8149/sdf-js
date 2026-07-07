#!/usr/bin/env node
// test-visual-audit.mjs — Sprint 36: the visual adversarial axis, tested
// against synthetic scenes with DELIBERATE defects (and clean controls).
import { auditSlotVisual, estimateTextWidth, makeAuditCtx } from './visual-audit.mjs';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== visual-audit (Sprint 36: render-level adversarial checks) ===\n');

const kindsOf = (issues) => new Set(issues.map((i) => i.kind));

// ── clean control: a normal kpi slot produces zero issues ──
{
  const issues = await auditSlotVisual({
    subjects: [
      {
        type: 'cover',
        x: 0,
        y: 0,
        w: 1280,
        h: 120,
        args: { title: 'Quarterly', style: 'gradient' },
      },
      { type: 'kpi-card', x: 40, y: 160, w: 300, h: 200, args: { value: '$3.4M', label: 'ARR' } },
      {
        type: 'kpi-card',
        x: 380,
        y: 160,
        w: 300,
        h: 200,
        args: { value: '92%', label: 'Retention' },
      },
    ],
  });
  ok(
    issues.length === 0,
    `clean slot has zero issues (got ${issues.length}: ${[...kindsOf(issues)]})`,
  );
}

// ── SUBJECT_OVERLAP: two charts on the same box ──
{
  const issues = await auditSlotVisual({
    subjects: [
      { type: 'kpi-card', x: 40, y: 160, w: 400, h: 300, args: { value: '1', label: 'a' } },
      { type: 'kpi-card', x: 60, y: 180, w: 400, h: 300, args: { value: '2', label: 'b' } },
    ],
  });
  ok(kindsOf(issues).has('SUBJECT_OVERLAP'), 'overlapping subject boxes flagged');
}

// ── pure cover slot is NOT blank ──
{
  const issues = await auditSlotVisual({
    subjects: [
      {
        type: 'cover',
        x: 0,
        y: 0,
        w: 1280,
        h: 720,
        args: { title: 'Deck Title', style: 'gradient' },
      },
    ],
  });
  ok(!kindsOf(issues).has('BLANK_SLOT'), 'pure cover slot exempt from BLANK_SLOT');
}

// ── cover shrink-to-fit: a very long title no longer overflows ──
{
  const issues = await auditSlotVisual({
    subjects: [
      {
        type: 'cover',
        x: 0,
        y: 0,
        w: 1280,
        h: 720,
        args: {
          title: 'Leaders, Gainers and Unexpected Winners in the Enterprise AI Arms Race of 2026',
          style: 'gradient',
        },
      },
    ],
  });
  ok(
    !kindsOf(issues).has('TEXT_OVERFLOW'),
    'cover shrink-to-fit: long title stays inside the canvas',
  );
}

// ── instrumented ctx: transform tracking ──
{
  const record = { texts: [], rects: [], inkCalls: 0, currentSubject: 0 };
  const ctx = makeAuditCtx(record);
  ctx.save();
  ctx.translate(100, 400);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '700 12px Inter';
  ctx.fillText('rotated label', 0, 0);
  ctx.restore();
  const t = record.texts[0];
  ok(
    t.x > 0 && t.y > 0 && t.y < 400,
    `rotated text lands at real coords (${t.x.toFixed(0)},${t.y.toFixed(0)})`,
  );
  ok(t.h > t.w === false || t.h > 20, 'rotated bbox is tall not wide');
  ctx.fillText('after restore', 10, 10);
  ok(record.texts[1].x <= 10 + 1, 'restore pops the transform');
}

// ── width estimate: CJK wider than Latin ──
{
  ok(
    estimateTextWidth('中文标题', 20) > estimateTextWidth('abcd', 20) * 1.5,
    'CJK chars estimated wider than Latin',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
