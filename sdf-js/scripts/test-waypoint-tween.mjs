// =============================================================================
// test-waypoint-tween.mjs — L1 unit tests for camera tween module
// =============================================================================

import * as tw from '../src/present/waypoint-tween.js';

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

console.log('=== waypoint-tween smoke test ===\n');

// interpolateCamera — t=0 returns from
{
  const from = { yaw: 0.5, pitch: 0.1, distance: 5, targetX: 1, targetY: 2, targetZ: 3 };
  const to = { yaw: 2.0, pitch: -0.3, distance: 10, targetX: 5, targetY: 0, targetZ: -2 };
  const r = tw.interpolateCamera(from, to, 0);
  ok(approxEq(r.yaw, 0.5), 't=0: yaw = from');
  ok(approxEq(r.pitch, 0.1), 't=0: pitch = from');
  ok(approxEq(r.distance, 5), 't=0: distance = from');
  ok(
    approxEq(r.targetX, 1) && approxEq(r.targetY, 2) && approxEq(r.targetZ, 3),
    't=0: target = from',
  );
}

// interpolateCamera — t=1 returns to
{
  const from = { yaw: 0.5, pitch: 0.1, distance: 5, targetX: 1, targetY: 2, targetZ: 3 };
  const to = { yaw: 2.0, pitch: -0.3, distance: 10, targetX: 5, targetY: 0, targetZ: -2 };
  const r = tw.interpolateCamera(from, to, 1);
  ok(approxEq(r.yaw, 2.0), 't=1: yaw = to');
  ok(approxEq(r.distance, 10), 't=1: distance = to');
  ok(approxEq(r.targetX, 5), 't=1: targetX = to');
}

// interpolateCamera — t=0.5 returns midpoint (linear)
{
  const from = { yaw: 0, pitch: 0, distance: 4, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 1, pitch: 0.4, distance: 8, targetX: 4, targetY: 2, targetZ: -2 };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(approxEq(r.yaw, 0.5), `t=0.5: yaw midpoint (got ${r.yaw})`);
  ok(approxEq(r.pitch, 0.2), `t=0.5: pitch midpoint (got ${r.pitch})`);
  ok(approxEq(r.distance, 6), `t=0.5: distance midpoint (got ${r.distance})`);
  ok(
    approxEq(r.targetX, 2) && approxEq(r.targetY, 1) && approxEq(r.targetZ, -1),
    't=0.5: target midpoint',
  );
}

// interpolateCamera — yaw wraparound short arc
// from yaw=0.1, to yaw=6.0 (≈ 2π−0.28): SHORT arc passes through 0 (not π)
// delta should be (6.0 − 2π) − 0.1 = -0.38 ; midpoint = 0.1 + 0.5·(−0.38) = −0.09
{
  const from = { yaw: 0.1, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 6.0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(r.yaw < 0.1 && r.yaw > -0.5, `yaw wraparound midpoint near -0.09 (got ${r.yaw})`);
}

// interpolateCamera — yaw NO wraparound when delta < π
// from yaw=0.5, to yaw=2.5 (delta = 2.0 < π): straight interp
{
  const from = { yaw: 0.5, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 2.5, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(approxEq(r.yaw, 1.5), `yaw no wraparound, midpoint = 1.5 (got ${r.yaw})`);
}

// interpolateCamera — focal interpolates if both present
{
  const from = {
    yaw: 0,
    pitch: 0,
    distance: 5,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    focal: 1.0,
  };
  const to = {
    yaw: 0,
    pitch: 0,
    distance: 5,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    focal: 2.0,
  };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(approxEq(r.focal, 1.5), `focal midpoint 1.5 (got ${r.focal})`);
}

// interpolateCamera — focal absent: result omits focal
{
  const from = { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(r.focal === undefined, 'focal absent: result has no focal');
}

// easeLinear: identity
{
  ok(approxEq(tw.easeLinear(0), 0), 'easeLinear(0) = 0');
  ok(approxEq(tw.easeLinear(0.5), 0.5), 'easeLinear(0.5) = 0.5');
  ok(approxEq(tw.easeLinear(1), 1), 'easeLinear(1) = 1');
}

// easeInOut: smoothstep behavior
{
  ok(approxEq(tw.easeInOut(0), 0), 'easeInOut(0) = 0');
  ok(approxEq(tw.easeInOut(0.5), 0.5), `easeInOut(0.5) = 0.5 (got ${tw.easeInOut(0.5)})`);
  ok(approxEq(tw.easeInOut(1), 1), 'easeInOut(1) = 1');
  // Smoothstep is symmetric around 0.5 (slow start AND slow end)
  ok(tw.easeInOut(0.25) < 0.25, `easeInOut(0.25) < 0.25 (slow start, got ${tw.easeInOut(0.25)})`);
  ok(tw.easeInOut(0.75) > 0.75, `easeInOut(0.75) > 0.75 (slow end, got ${tw.easeInOut(0.75)})`);
}

// tweenCamera: calls onFrame multiple times with camera state + onComplete once
{
  let now = 0;
  const realRAF = globalThis.requestAnimationFrame;
  const realCAF = globalThis.cancelAnimationFrame;
  const realPerfNow = performance.now;
  let scheduled = null;
  globalThis.requestAnimationFrame = (cb) => {
    scheduled = cb;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {
    scheduled = null;
  };
  performance.now = () => now;

  const frames = [];
  let complete = false;
  const from = { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 1, pitch: 0, distance: 5, targetX: 1, targetY: 0, targetZ: 0 };
  const h = tw.tweenCamera(from, to, {
    durationMs: 100,
    easing: tw.easeLinear,
    onFrame: (cam) => frames.push(cam),
    onComplete: () => {
      complete = true;
    },
  });
  ok(typeof h.cancel === 'function', 'tweenCamera: returns {cancel}');
  now = 0;
  scheduled(); // t=0
  now = 50;
  scheduled(); // t=0.5
  now = 100;
  scheduled(); // t=1 → complete
  ok(frames.length >= 3, `tweenCamera: at least 3 frames (got ${frames.length})`);
  ok(complete === true, 'tweenCamera: onComplete called when t reaches 1');
  ok(
    approxEq(frames[frames.length - 1].yaw, 1),
    `tweenCamera: last frame yaw = to.yaw (got ${frames[frames.length - 1].yaw})`,
  );

  globalThis.requestAnimationFrame = realRAF;
  globalThis.cancelAnimationFrame = realCAF;
  performance.now = realPerfNow;
}

// tweenCamera: cancel stops further onFrame calls
{
  let now = 0;
  const realRAF = globalThis.requestAnimationFrame;
  const realCAF = globalThis.cancelAnimationFrame;
  const realPerfNow = performance.now;
  let scheduled = null;
  globalThis.requestAnimationFrame = (cb) => {
    scheduled = cb;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {
    scheduled = null;
  };
  performance.now = () => now;

  let frames = 0;
  let complete = false;
  const h = tw.tweenCamera(
    { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 },
    { yaw: 1, pitch: 0, distance: 5, targetX: 1, targetY: 0, targetZ: 0 },
    {
      durationMs: 100,
      onFrame: () => frames++,
      onComplete: () => {
        complete = true;
      },
    },
  );
  now = 30;
  scheduled();
  const framesBeforeCancel = frames;
  h.cancel();
  now = 60;
  if (scheduled) scheduled();
  ok(
    frames === framesBeforeCancel,
    `cancel: no more frames after cancel (before ${framesBeforeCancel}, after ${frames})`,
  );
  ok(complete === false, 'cancel: onComplete NOT called');

  globalThis.requestAnimationFrame = realRAF;
  globalThis.cancelAnimationFrame = realCAF;
  performance.now = realPerfNow;
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
