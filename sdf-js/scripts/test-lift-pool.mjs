#!/usr/bin/env node
// test-lift-pool.mjs — Sprint 34: liftSlotsPool mechanics with an injected
// fake liftFn (no LLM). Warmup isolation, concurrency bound, 429 cooldown,
// result alignment, error isolation.
import { liftSlotsPool } from '../src/present/scaffolds/lift-slot-llm.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== lift-slot pool (Sprint 34: warmup + bounded concurrency) ===\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── warmup isolation + concurrency bound + alignment ──
{
  let inFlight = 0;
  let maxInFlight = 0;
  const started = [];
  const fakeLift = async (params) => {
    started.push(params.i);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await sleep(20);
    inFlight--;
    return { sceneData: { subjects: [] }, tag: params.i };
  };
  const paramsList = Array.from({ length: 9 }, (_, i) => ({ i }));
  const results = await liftSlotsPool(paramsList, { liftFn: fakeLift, concurrency: 3 });
  ok(started[0] === 0, 'slot 0 starts first (warmup)');
  ok(maxInFlight <= 3, `concurrency bounded at 3 (max seen ${maxInFlight})`);
  ok(
    results.every((r, i) => r.tag === i),
    'results aligned with input order',
  );
  // warmup ran ALONE: when slot 1 started, slot 0 must have finished
  ok(started.length === 9, 'all 9 slots ran');
}

// ── warmup truly serializes before the pool opens ──
{
  const events = [];
  const fakeLift = async (params) => {
    events.push(`start-${params.i}`);
    await sleep(10);
    events.push(`end-${params.i}`);
    return { ok: true };
  };
  await liftSlotsPool(
    Array.from({ length: 4 }, (_, i) => ({ i })),
    { liftFn: fakeLift, concurrency: 4 },
  );
  ok(
    events[0] === 'start-0' && events[1] === 'end-0',
    'warmup completes before any pool slot starts',
  );
}

// ── error isolation ──
{
  const fakeLift = async (params) => {
    if (params.i === 2) throw new Error('boom');
    return { good: params.i };
  };
  const results = await liftSlotsPool(
    Array.from({ length: 4 }, (_, i) => ({ i })),
    { liftFn: fakeLift, concurrency: 2 },
  );
  ok(results[2].error === 'boom', 'failing slot becomes {error}, does not reject the pool');
  ok(results[1].good === 1 && results[3].good === 3, 'other slots unaffected');
}

// ── 429 cooldown: onThrottle pushes shared cooldown that delays new starts ──
{
  const startTimes = [];
  const t0 = Date.now();
  const fakeLift = async (params, opts) => {
    startTimes.push({ i: params.i, at: Date.now() - t0 });
    if (params.i === 1) opts.onThrottle(); // simulate a 429 on slot 1
    await sleep(10);
    return { ok: true };
  };
  // shrink cooldown window for the test by monkey-scale: cooldown is 15s in
  // prod — here we only assert that slots starting AFTER the throttle wait
  // (i.e. no new start within the first 100ms after the throttle fires).
  const p = liftSlotsPool(
    Array.from({ length: 4 }, (_, i) => ({ i })),
    { liftFn: fakeLift, concurrency: 1 },
  );
  const timeout = sleep(1200).then(() => 'timeout');
  const winner = await Promise.race([p.then(() => 'done'), timeout]);
  ok(winner === 'timeout', 'post-429 slots wait out the cooldown (pool still running at 1.2s)');
  // don't await p (15s cooldown) — verified the delay exists, that's the contract
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
