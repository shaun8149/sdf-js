// sdf-js/scripts/test-camera-shake.mjs — camera shake quality invariants.
// Guards the fix for "镜头有抖动": shake must be SMOOTH sway (not white-noise
// jitter), fade at blend-shot edges (no pop when a calm shot blends into a
// shaky one), keep the instant hit on 'cut' shots, and support [from, to]
// impact-then-settle ramps.
import { evaluateCameraSequence } from '../src/scene/camera-sequence.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== camera shake (smooth sway + envelope + ramp) ===\n');

const BASE = { pos: [0, 2, 6], target: [0, 1, 0], fov: 46, ease: 'linear' };
const dev = (state) => Math.hypot(state.target[0] - 0, state.target[1] - 1, state.target[2] - 0);

// ---- smoothness: consecutive frames must be close (white noise was NOT) ------
{
  const seq = { shots: [{ ...BASE, duration: 10, shake: 1.0 }] };
  let maxStep = 0;
  let prev = null;
  for (let t = 2; t < 8; t += 1 / 60) {
    const s = evaluateCameraSequence(seq, t, {});
    const d = [s.target[0], s.target[1], s.target[2]];
    if (prev)
      maxStep = Math.max(maxStep, Math.hypot(d[0] - prev[0], d[1] - prev[1], d[2] - prev[2]));
    prev = d;
  }
  ok(
    maxStep < 0.01,
    `frame-to-frame shake step is small (${maxStep.toFixed(4)} — smooth sway, not jitter)`,
  );
  // and it actually moves (shake is alive)
  const a = dev(evaluateCameraSequence(seq, 3.1, {}));
  const b = dev(evaluateCameraSequence(seq, 4.3, {}));
  ok(a > 0 || b > 0, 'shake displaces the target');
}

// ---- envelope: blend shot fades shake in at its start -------------------------
{
  const seq = {
    shots: [
      { ...BASE, duration: 4, shake: 0 },
      { ...BASE, duration: 4, shake: 1.0, transition: 'blend' },
    ],
  };
  const atBoundary = dev(evaluateCameraSequence(seq, 4.001, {}));
  const midShot = Math.max(
    dev(evaluateCameraSequence(seq, 5.9, {})),
    dev(evaluateCameraSequence(seq, 6.1, {})),
    dev(evaluateCameraSequence(seq, 6.35, {})),
  );
  ok(atBoundary < 0.002, `no pop at the blend boundary (${atBoundary.toFixed(4)})`);
  ok(midShot > atBoundary * 5, 'shake ramps up inside the shot');
}

// ---- cut keeps the instant hit + [from,to] settles ----------------------------
{
  const seq = {
    shots: [
      { ...BASE, duration: 4, shake: 0 },
      { ...BASE, duration: 4, shake: [1.0, 0.0], transition: 'cut' },
    ],
  };
  // sample the peak sway near the cut vs near the end (sway oscillates, so take maxima)
  const early = Math.max(
    ...[4.05, 4.25, 4.45, 4.65].map((t) => dev(evaluateCameraSequence(seq, t, {}))),
  );
  const late = Math.max(
    ...[7.2, 7.4, 7.6, 7.8].map((t) => dev(evaluateCameraSequence(seq, t, {}))),
  );
  ok(early > 0.005, `cut shot hits immediately (peak ${early.toFixed(4)})`);
  ok(
    late < early * 0.3,
    `[from,to] ramp settles by the end (${late.toFixed(4)} vs ${early.toFixed(4)})`,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
