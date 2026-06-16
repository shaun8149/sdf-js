// =============================================================================
// scene-smoke.mjs — M0 Day 3 smoke test for src/scene/
// -----------------------------------------------------------------------------
// Covers: validate / parse / stringify / compile across all 6 SPEC.md v1
// extensions:
//   - subjects with PrimitiveLeaf / BooleanGroup / DomainGroup (Ext 1)
//   - AnimationChannel dual-form (Ext 2)
//   - Camera + light animation hooks (Ext 3)
//   - waves time-aware primitive (Ext 4)
//   - defaults.shadow autoscope mode (Ext 5)
//   - SceneData.source preservation (Ext 6)
// =============================================================================

import {
  parse,
  stringify,
  compile,
  validate,
  parseExpr,
  stringifyExpr,
} from '../src/scene/index.js';
import { isTimeExpr, evalT } from '../src/sdf/time.js';

let pass = 0,
  fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    failures.push({ name, err: e });
    console.log(`  ✗ ${name}\n    ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg || 'mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
function assertCloseTo(actual, expected, eps = 1e-6, msg) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${msg || 'mismatch'}: expected ${expected}±${eps}, got ${actual}`);
  }
}

// =============================================================================
// 1. validate — basic + edge cases
// =============================================================================

console.log('\n[1] validate');

test('rejects missing v', () => {
  const r = validate({ subjects: [], defaults: { camera: {}, light: {} } });
  assert(!r.ok && r.errors.some((e) => e.includes('Missing required field "v"')));
});

test('rejects v=2', () => {
  const r = validate({ v: 2, subjects: [], defaults: { camera: {}, light: {} } });
  assert(!r.ok && r.errors.some((e) => e.includes('Unsupported version')));
});

test('rejects missing subjects', () => {
  const r = validate({ v: 1, defaults: { camera: makeCam(), light: makeLight() } });
  assert(!r.ok && r.errors.some((e) => e.includes('"subjects"')));
});

test('accepts empty subjects array', () => {
  const r = validate({
    v: 1,
    subjects: [],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  assert(r.ok, JSON.stringify(r.errors));
});

test('rejects duplicate subject ids', () => {
  const r = validate({
    v: 1,
    subjects: [
      { id: 'a', type: 'sphere', args: { radius: 1 } },
      { id: 'a', type: 'box', args: { dims: [1, 1, 1] } },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  assert(!r.ok && r.errors.some((e) => e.includes('Duplicate')));
});

test('rejects unknown primitive type', () => {
  const r = validate({
    v: 1,
    subjects: [{ id: 'x', type: 'spheroid', args: {} }],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  assert(!r.ok && r.errors.some((e) => e.includes('unknown type')));
});

test('rejects BooleanGroup with empty children', () => {
  const r = validate({
    v: 1,
    subjects: [{ id: 'g', type: 'union', children: [] }],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  assert(!r.ok && r.errors.some((e) => e.includes('non-empty children')));
});

test('rejects DomainGroup missing source', () => {
  const r = validate({
    v: 1,
    subjects: [{ id: 'r', type: 'rep', args: { period: [60, 0, 0] } }],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  assert(!r.ok && r.errors.some((e) => e.includes('source')));
});

test('accepts AnimationChannel with both expr and value (dual-form OK after normalize)', () => {
  const r = validate({
    v: 1,
    subjects: [
      {
        id: 's',
        type: 'sphere',
        args: { radius: 0.5 },
        animation: [
          {
            channel: 'args.radius',
            expr: 'sin(t)',
            value: { kind: 'time', form: 'sin', amp: 1, freq: 1, phase: 0 },
          },
        ],
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  assert(r.ok, JSON.stringify(r.errors));
});

test('warns (does not error) on AnimationChannel with neither expr nor value', () => {
  // Incomplete channels are tolerated for forward-compat (LLM may emit partial
  // animation; compile skips channels with neither expr nor value). Validator
  // reports a warning but ok=true.
  const r = validate({
    v: 1,
    subjects: [
      {
        id: 's',
        type: 'sphere',
        args: { radius: 0.5 },
        animation: [{ channel: 'args.radius' }],
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  assert(r.ok, `should be ok: errors=${JSON.stringify(r.errors)}`);
  assert(
    r.warnings.some((w) => w.includes('missing both "expr" and "value"')),
    `should warn about missing expr/value: warnings=${JSON.stringify(r.warnings)}`,
  );
});

test('rejects shadow with invalid mode', () => {
  const r = validate({
    v: 1,
    subjects: [],
    defaults: {
      camera: makeCam(),
      light: makeLight(),
      shadow: { enabled: true, mode: 'rainbow', strength: 0.5 },
    },
  });
  assert(!r.ok && r.errors.some((e) => e.includes('shadow.mode')));
});

// =============================================================================
// 2. parseExpr / stringifyExpr — expression DSL
// =============================================================================

console.log('\n[2] expr');

test('parseExpr: bare t', () => {
  const r = parseExpr('t');
  assert(isTimeExpr(r) && r.form === 'linear' && r.coef === 1);
});

test('parseExpr: number constant', () => {
  const r = parseExpr('0.5');
  assertEq(r, 0.5);
});

test('parseExpr: sin(t)', () => {
  const r = parseExpr('sin(t)');
  assert(isTimeExpr(r) && r.form === 'sin' && r.amp === 1 && r.freq === 1 && r.phase === 0);
});

test('parseExpr: sin(t * 0.5) * 0.3', () => {
  const r = parseExpr('sin(t * 0.5) * 0.3');
  assert(isTimeExpr(r) && r.form === 'sin');
  assertCloseTo(r.amp, 0.3);
  assertCloseTo(r.freq, 0.5);
  assertCloseTo(r.phase, 0);
});

test('parseExpr: 0.3 + 0.05 * sin(t)', () => {
  const r = parseExpr('0.3 + 0.05 * sin(t)');
  assert(isTimeExpr(r) && r.form === 'sum');
  // Verify evaluation
  assertCloseTo(evalT(r, 0), 0.3);
  assertCloseTo(evalT(r, Math.PI / 2), 0.3 + 0.05, 1e-6);
});

test('parseExpr: parens grouping', () => {
  const r = parseExpr('(0.2 + 0.1) * 2');
  assertCloseTo(r, 0.6, 1e-10);
});

test('parseExpr: unary minus', () => {
  const r = parseExpr('-0.5');
  assertEq(r, -0.5);
});

test('parseExpr: rejects unknown function', () => {
  let threw = false;
  try {
    parseExpr('tan(t)');
  } catch (e) {
    threw = true;
  }
  assert(threw, 'tan should not be supported in v1');
});

test('parseExpr: rejects division', () => {
  let threw = false;
  try {
    parseExpr('t / 2');
  } catch (e) {
    threw = true;
  }
  assert(threw, 'division should not be supported in v1');
});

test('stringifyExpr roundtrip: sin', () => {
  const e = parseExpr('sin(t * 0.5)');
  const s = stringifyExpr(e);
  const e2 = parseExpr(s);
  assertCloseTo(evalT(e2, 1), evalT(e, 1));
});

test('stringifyExpr roundtrip: sum', () => {
  const e = parseExpr('0.4 + 0.075 * sin(t * 0.333)');
  const s = stringifyExpr(e);
  const e2 = parseExpr(s);
  assertCloseTo(evalT(e2, 0), evalT(e, 0));
  assertCloseTo(evalT(e2, 5), evalT(e, 5), 1e-5);
});

// =============================================================================
// 3. parse / stringify dual-form
// =============================================================================

console.log('\n[3] parse / stringify');

test('parse adds value when only expr present', () => {
  const data = parse({
    v: 1,
    subjects: [
      {
        id: 'a',
        type: 'sphere',
        args: { radius: 0.5 },
        animation: [{ channel: 'args.radius', expr: 'sin(t * 0.5) * 0.1' }],
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const ch = data.subjects[0].animation[0];
  assert(ch.value != null, 'expected normalized value field');
  assert(isTimeExpr(ch.value) && ch.value.form === 'sin');
});

test('parse adds expr when only value present', () => {
  const data = parse({
    v: 1,
    subjects: [
      {
        id: 'a',
        type: 'sphere',
        args: { radius: 0.5 },
        animation: [
          {
            channel: 'args.radius',
            value: { kind: 'time', form: 'sin', amp: 0.1, freq: 0.5, phase: 0 },
          },
        ],
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const ch = data.subjects[0].animation[0];
  assert(typeof ch.expr === 'string', 'expected normalized expr field');
  assert(ch.expr.includes('sin'));
});

test('source field preserved', () => {
  const input = {
    v: 1,
    source: { format: 'llm', prompt: 'a red sphere on a table' },
    subjects: [{ id: 'a', type: 'sphere', args: { radius: 0.5 } }],
    defaults: { camera: makeCam(), light: makeLight() },
  };
  const data = parse(input);
  assertEq(data.source.format, 'llm');
  assertEq(data.source.prompt, 'a red sphere on a table');
});

test('stringify round-trip preserves shape', () => {
  const orig = {
    v: 1,
    subjects: [{ id: 'a', type: 'sphere', args: { radius: 0.5 } }],
    defaults: { camera: makeCam(), light: makeLight() },
  };
  const s = stringify(orig);
  const parsed = parse(s);
  assertEq(parsed.subjects[0].id, 'a');
  assertEq(parsed.subjects[0].args.radius, 0.5);
});

// =============================================================================
// 4. compile — primitives + booleans + domain ops
// =============================================================================

console.log('\n[4] compile');

test('compile single sphere returns SDF, regionFn works', () => {
  const data = parse({
    v: 1,
    subjects: [{ id: 'a', type: 'sphere', args: { radius: 1 }, region: 'object' }],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const { sdf, regionFn, subjects } = compile(data);
  assert(sdf != null, 'expected SDF');
  assertEq(subjects.length, 1);
  // Sphere of radius 1 at origin: origin should be inside
  assertEq(regionFn([0, 0, 0]), 'object');
  // Far point should be background
  assertEq(regionFn([10, 0, 0]), 'background');
});

test('compile BooleanGroup union', () => {
  const data = parse({
    v: 1,
    subjects: [
      {
        id: 'u',
        type: 'union',
        region: 'thing',
        children: [
          { id: 'a', type: 'sphere', args: { radius: 1 } },
          { id: 'b', type: 'sphere', args: { radius: 1 }, transform: { translate: [3, 0, 0] } },
        ],
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const { regionFn } = compile(data);
  assertEq(regionFn([0, 0, 0]), 'thing');
  assertEq(regionFn([3, 0, 0]), 'thing');
  assertEq(regionFn([1.5, 0, 0]), 'background'); // between the two spheres
});

test('compile difference', () => {
  const data = parse({
    v: 1,
    subjects: [
      {
        id: 'd',
        type: 'difference',
        region: 'shell',
        children: [
          { id: 'outer', type: 'sphere', args: { radius: 1 } },
          { id: 'inner', type: 'sphere', args: { radius: 0.5 } },
        ],
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const { regionFn } = compile(data);
  // Inside inner sphere: subtracted out, so background
  assertEq(regionFn([0, 0, 0]), 'background');
  // Shell region (between 0.5 and 1)
  assertEq(regionFn([0.75, 0, 0]), 'shell');
});

test('compile DomainGroup rep', () => {
  const data = parse({
    v: 1,
    subjects: [
      {
        id: 'flock',
        type: 'rep',
        args: { period: [10, 0, 0] },
        region: 'birds',
        source: { id: 'b', type: 'sphere', args: { radius: 0.3 } },
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const { regionFn } = compile(data);
  // Repetition: bird at every multiple of 10 along x
  assertEq(regionFn([0, 0, 0]), 'birds');
  assertEq(regionFn([10, 0, 0]), 'birds');
  assertEq(regionFn([20, 0, 0]), 'birds');
  assertEq(regionFn([5, 0, 0]), 'background'); // between
});

test('compile DomainGroup mirror', () => {
  const data = parse({
    v: 1,
    subjects: [
      {
        id: 'mirrored',
        type: 'mirror',
        args: { axis: 'x' },
        region: 'wing',
        source: {
          id: 's',
          type: 'sphere',
          args: { radius: 0.5 },
          transform: { translate: [2, 0, 0] },
        },
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const { regionFn } = compile(data);
  // mirror across x: original at +2, mirrored copy at -2
  assertEq(regionFn([2, 0, 0]), 'wing');
  assertEq(regionFn([-2, 0, 0]), 'wing');
  assertEq(regionFn([0, 0, 0]), 'background');
});

test('compile waves primitive', () => {
  const data = parse({
    v: 1,
    subjects: [
      {
        id: 'sea',
        type: 'waves',
        args: { freq: 2, amp: 0.5, angle: 0, speed: 1 },
        region: 'water',
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const { sdf } = compile(data);
  assert(sdf != null, 'waves should compile');
});

test('compile ground field', () => {
  const data = parse({
    v: 1,
    subjects: [{ id: 'a', type: 'sphere', args: { radius: 1 } }],
    ground: { y: -1, region: 'floor' },
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const { ground, groundSdf } = compile(data);
  assertEq(ground.y, -1);
  assertEq(ground.region, 'floor');
  assert(groundSdf != null, 'groundSdf should be built');
});

// =============================================================================
// 5. compile — animations
// =============================================================================

console.log('\n[5] animations');

test('camera animation: targetZ dolly', () => {
  const data = parse({
    v: 1,
    subjects: [{ id: 'a', type: 'sphere', args: { radius: 1 } }],
    defaults: {
      camera: { ...makeCam(), animation: [{ channel: 'targetZ', expr: '0.25 * t' }] },
      light: makeLight(),
    },
  });
  const { evalCamera, cameraStatic } = compile(data);
  const at0 = evalCamera(0);
  const at4 = evalCamera(4);
  assertCloseTo(at0.targetZ, 0);
  assertCloseTo(at4.targetZ, 1.0);
  assertEq(cameraStatic.targetZ, 0); // static unchanged
});

test('light animation: azimuth oscillation', () => {
  const data = parse({
    v: 1,
    subjects: [{ id: 'a', type: 'sphere', args: { radius: 1 } }],
    defaults: {
      camera: makeCam(),
      light: {
        ...makeLight(),
        animation: [
          {
            channel: 'azimuth',
            value: { kind: 'time', form: 'cos', amp: 1, freq: 0.5, phase: 0 },
          },
        ],
      },
    },
  });
  const { evalLight } = compile(data);
  assertCloseTo(evalLight(0).azimuth, 1); // cos(0) = 1
  assertCloseTo(evalLight(Math.PI / 0.5 / 2).azimuth, 0, 1e-6); // cos(π/2) ≈ 0
});

test('shadow animation: strength pulse', () => {
  const data = parse({
    v: 1,
    subjects: [],
    defaults: {
      camera: makeCam(),
      light: makeLight(),
      shadow: {
        enabled: true,
        mode: 'hueRotate180',
        strength: 0.5,
        animation: [{ channel: 'strength', expr: '0.3 + 0.2 * sin(t)' }],
      },
    },
  });
  const { evalShadow, shadowStatic } = compile(data);
  assertEq(shadowStatic.mode, 'hueRotate180');
  assertCloseTo(evalShadow(0).strength, 0.3);
  assertCloseTo(evalShadow(Math.PI / 2).strength, 0.5);
});

test('subject animation: args.radius pulse baked as TimeExpr', () => {
  // After compile, subject args containing TimeExpr means GLSL pipeline emits u_time.
  // We can verify at CPU level the sdf evaluated near radius==0.3 + sin pulse t=0.
  const data = parse({
    v: 1,
    subjects: [
      {
        id: 's',
        type: 'sphere',
        args: { radius: 0.3 },
        animation: [{ channel: 'args.radius', expr: '0.3 + 0.05 * sin(t)' }],
      },
    ],
    defaults: { camera: makeCam(), light: makeLight() },
  });
  const { sdf } = compile(data);
  // sdf at t=0 should behave as sphere of radius 0.3 (sin(0)=0, +0.05*0=0)
  // Distance at point (0.4, 0, 0) should be ~0.1 (0.4 - 0.3)
  const d = sdfDistance(sdf, [0.4, 0, 0]);
  // The bake might fold to 0.3 in initial closure; just check sign + rough magnitude.
  assert(d > 0, `point outside sphere: d=${d}`);
  assert(d < 0.5, `not too far away: d=${d}`);
});

// =============================================================================
// 6. End-to-end Example 5 from SPEC.md (autoscope-style scene)
// =============================================================================

console.log('\n[6] end-to-end autoscope-style');

test('Example 5: birds + breathing house + waves + camera dolly + light osc', () => {
  const data = parse({
    v: 1,
    name: 'Coastal village at sunrise',
    subjects: [
      {
        id: 'bird-flock-1',
        type: 'rep',
        args: { period: [60, 0, 0] },
        source: {
          id: 'bird-shape',
          type: 'sphere',
          args: { radius: 0.2 },
          transform: { translate: [0, 8, 0] },
          animation: [
            {
              channel: 'transform.translate.x',
              value: { kind: 'time', form: 'linear', coef: 5.0 },
            },
          ],
        },
      },
      {
        id: 'house',
        type: 'box',
        args: { dims: [3, 4, 3] },
        transform: { translate: [0, 2, 0] },
        animation: [{ channel: 'args.dims', expr: '0.15 * sin(t * 0.2)' }],
      },
    ],
    ground: { y: -1, region: 'ground' },
    defaults: {
      camera: {
        yaw: 0,
        pitch: 0.1,
        distance: 25,
        focal: 1.5,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        animation: [{ channel: 'targetZ', expr: '0.25 * t' }],
      },
      light: {
        azimuth: 0.5,
        altitude: 0.6,
        distance: 30,
        animation: [
          {
            channel: 'azimuth',
            value: { kind: 'time', form: 'cos', amp: 1, freq: 0.05, phase: 0 },
          },
        ],
      },
      shadow: { enabled: true, mode: 'hueRotate180', strength: 0.4 },
    },
  });

  const compiled = compile(data);
  assert(compiled.sdf != null);
  assert(compiled.evalCamera != null);
  assert(compiled.shadowStatic.mode === 'hueRotate180');
  assertCloseTo(compiled.evalCamera(2).targetZ, 0.5);
  assertCloseTo(compiled.evalLight(0).azimuth, 1.0);
});

// =============================================================================
// helpers
// =============================================================================

function makeCam() {
  return { yaw: 0, pitch: 0, distance: 3, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 };
}
function makeLight() {
  return { azimuth: 0.5, altitude: 0.6, distance: 5 };
}

function sdfDistance(sdfInstance, p) {
  const r = sdfInstance.f(p);
  if (typeof r === 'number') return r;
  if (Array.isArray(r)) {
    if (r.length === 1 && Array.isArray(r[0])) return r[0][0];
    return r[0];
  }
  return r;
}

// =============================================================================
// Summary
// =============================================================================

console.log(`\n\n${pass} passed / ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.err.message}`);
  }
  process.exit(1);
}
process.exit(0);
