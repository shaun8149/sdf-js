// test-expr-anim-builtins.mjs — GLSL-style builtins in the animation expr grammar
// (smoothstep / clamp / step / min / max / mix / abs / floor / fract / sqrt / sign / pow / mod).
import { parseExpr } from '../src/scene/expr.js';
import { evalT, isTimeExpr, callT, linearT } from '../src/sdf/time.js';
import { sphere } from '../src/sdf/d3.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
console.log('=== expr animation builtins ===\n');

// ── parse structure ──
{
  const e = parseExpr('smoothstep(0, 2, t)');
  ok(isTimeExpr(e) && e.form === 'call' && e.fn === 'smoothstep', 'smoothstep parses to a call form');
  ok(e.args.length === 3 && e.args[0] === 0 && e.args[1] === 2, 'edges are literal numbers');
  ok(isTimeExpr(e.args[2]) && e.args[2].form === 'linear', 'third arg is the time expr t');
}

// ── CPU eval: smoothstep(0,2,t) reveal curve ──
{
  const e = parseExpr('smoothstep(0, 2, t)');
  ok(near(evalT(e, 0), 0), 'smoothstep(0,2,0) = 0 (hidden at start)');
  ok(near(evalT(e, 1), 0.5), 'smoothstep(0,2,1) = 0.5 (mid reveal)');
  ok(near(evalT(e, 2), 1), 'smoothstep(0,2,2) = 1 (fully revealed)');
  ok(near(evalT(e, 5), 1), 'smoothstep past edge stays 1 (one-shot, not oscillation)');
}

// ── clamp / step / mix / others ──
ok(near(evalT(parseExpr('clamp(t, 0, 1)'), 5), 1), 'clamp(t,0,1) at t=5 → 1');
ok(near(evalT(parseExpr('clamp(t, 0, 1)'), -3), 0), 'clamp(t,0,1) at t=-3 → 0');
ok(near(evalT(parseExpr('step(2, t)'), 1), 0) && near(evalT(parseExpr('step(2, t)'), 3), 1), 'step(2,t): 0 before, 1 after');
ok(near(evalT(parseExpr('mix(0, 10, smoothstep(0, 1, t))'), 1), 10), 'mix + nested smoothstep composes');
ok(near(evalT(parseExpr('0.2 + 0.8 * smoothstep(0, 1, t)'), 0), 0.2), 'scale from 0.2→1 via + and *');
ok(near(evalT(parseExpr('0.2 + 0.8 * smoothstep(0, 1, t)'), 1), 1.0), 'scale reaches 1 at t=1');
ok(near(evalT(parseExpr('abs(t)'), -2), 2), 'abs');
ok(near(evalT(parseExpr('floor(t)'), 2.7), 2), 'floor');
ok(near(evalT(parseExpr('sqrt(t)'), 9), 3), 'sqrt');

// ── unknown function still rejected ──
{
  let threw = false;
  try { parseExpr('wat(t)'); } catch { threw = true; }
  ok(threw, 'unknown function rejected');
}

// ── sin/cos unchanged (back-compat) ──
{
  const e = parseExpr('0.3 + 0.05 * sin(t)');
  ok(isTimeExpr(e), 'sin still parses (back-compat)');
}

// ── GLSL emit: a smoothstep-animated transform emits GLSL smoothstep(…, u_time) ──
{
  const anim = callT('smoothstep', 0, 2, linearT(1)); // = smoothstep(0, 2, t)
  const sdf = sphere(0.4).translate([anim, 0, 0]);
  const r = compileSDF3ToGLSL(sdf);
  ok(!r.error, `smoothstep animation compiles to GLSL${r.error ? ' — ' + r.error : ''}`);
  const withTime = [...(r.glsl || '').matchAll(/smoothstep\([^;]*?u_time[^;]*?\)/g)];
  ok(withTime.length === 1, 'emits exactly one time-driven smoothstep(..., u_time)');
  ok((r.glsl || '').includes('smoothstep(0.0, 2.0, (1.0 * u_time)'), 'emit matches smoothstep(0.0, 2.0, (1.0 * u_time))');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
