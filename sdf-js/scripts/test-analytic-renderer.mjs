// sdf-js/scripts/test-analytic-renderer.mjs — analytic white-model renderer.
// Guards the zero-march path: closed-form intersectors per primitive, strict
// scope rejection (fallback to raymarch must be LOUD, not wrong), animation
// exprs baked as GLSL, and real-deck coverage (every bytedance-bp window
// except the funnel station compiles analytically).
import { readFileSync } from 'node:fs';
import { compileAnalyticFrag } from '../src/render/analytic.js';
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { expandStage } from '../src/scene/stage.js';
import { expandChartLabels } from '../src/scene/chart-labels.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== analytic white-model renderer ===\n');

// ---- basics -----------------------------------------------------------------
{
  const r = compileAnalyticFrag([
    { id: 'a', type: 'sphere', args: { radius: 0.5 }, transform: { translate: [1, 2, 3] } },
    {
      id: 'b',
      type: 'rounded_box',
      args: { dims: [1, 2, 1] },
      transform: { translate: [0, 1, 0], rotate: [0, 0.3, 0] },
      material: { hue: 0.11, sat: 0.78, value: 0.95, glow: 0.2 },
    },
  ]);
  ok(r.ok && r.count === 2, 'two primitives compile');
  ok(r.fragSource.includes('iSphere') && r.fragSource.includes('iBox'), 'intersectors emitted');
  ok(r.fragSource.includes('rotY('), 'yaw rotation baked');
  ok(!r.fragSource.includes('for (int i'), 'ZERO loops — no marching anywhere');
  ok(r.fragSource.includes('sphOcc'), 'analytic occlusion present');
}

// ---- animation exprs --------------------------------------------------------
{
  const r = compileAnalyticFrag([
    {
      id: 'anim',
      type: 'box',
      args: { dims: [1, 1, 1] },
      transform: { translate: [0, 2, 0] },
      animation: [
        {
          channel: 'transform.translate.y',
          expr: '1.500 + 2.300 * smoothstep(0.20, 0.80, t) + 0.05 * sin(0.6 * t + 1.70)',
        },
      ],
    },
  ]);
  ok(r.ok, 'build-in expr accepted');
  ok(r.fragSource.includes('smoothstep(0.20, 0.80, u_time)'), 't → u_time baked');
}

// ---- x-channel flight (evolution past→present) ----------------------------------
// 2026-07-14 regression: x was a baked constant — the evolution orbs' horizontal
// flight dropped WHOLE WINDOWS to the stone raymarcher (slow warm, heavy frame).
{
  const r = compileAnalyticFrag([
    {
      id: 'fly',
      type: 'sphere',
      args: { radius: 0.6 },
      transform: { translate: [-3.9, 2, 0] },
      animation: [
        { channel: 'transform.translate.x', expr: '3.900 - 7.800 * smoothstep(4.20, 4.90, t)' },
      ],
    },
  ]);
  ok(r.ok, 'x-channel build-in accepted (no raymarch fallback)');
  ok(r.fragSource.includes('float tx0 = (3.900'), 'x rides a per-frame GLSL expr');
}

// ---- scope rejection ----------------------------------------------------------
{
  const bad1 = compileAnalyticFrag([{ id: 'v', type: 'venn-3d', args: {} }]);
  ok(!bad1.ok && /venn/.test(bad1.reason), 'unsupported type rejected with reason');
  const fun = compileAnalyticFrag([
    {
      id: 'f',
      type: 'funnel-3d',
      args: { stages: 4, radii: [1.2, 0.9, 0.6, 0.4, 0.2], stageHeight: 0.5, gap: 0.06 },
      transform: { translate: [0, 2, 0] },
    },
  ]);
  ok(
    fun.ok && (fun.fragSource.match(/iCappedCone\(q/g) || []).length === 4,
    'funnel-3d emits one capped cone per slice',
  );
  const bad2 = compileAnalyticFrag([
    { id: 'r', type: 'box', args: { dims: [1, 1, 1] }, transform: { rotate: [0.3, 0, 0] } },
  ]);
  ok(!bad2.ok && /rotate/.test(bad2.reason), 'non-yaw rotate rejected');
  const bad3 = compileAnalyticFrag([
    {
      id: 'e',
      type: 'box',
      args: { dims: [1, 1, 1] },
      animation: [{ channel: 'transform.translate.y', expr: 'evilFn(t)' }],
    },
  ]);
  ok(!bad3.ok, 'unknown expr token rejected');
}

// ---- union flattening -----------------------------------------------------------
{
  const r = compileAnalyticFrag([
    {
      id: 'u',
      type: 'union',
      transform: { translate: [5, 3, 0] },
      material: { hue: 0.11, sat: 0.7, value: 0.9 },
      animation: [
        { channel: 'transform.translate.y', expr: '3.000 + 1.000 * smoothstep(0.10, 0.60, t)' },
      ],
      children: [
        { id: 'c1', type: 'sphere', args: { radius: 0.4 }, transform: { translate: [0, 0.5, 0] } },
      ],
    },
  ]);
  ok(r.ok && r.count === 1, 'union flattens to its child');
  ok(r.fragSource.includes('+ 0.5000'), 'child offset rides on the animated parent channel');
}

// ---- real-deck coverage -----------------------------------------------------------
{
  const deck = JSON.parse(
    readFileSync(new URL('../scenes/ir/bytedance-bp.json', import.meta.url), 'utf8'),
  );
  const scene = assembleDeck(deck, { env: 'studio', stage: true });
  let okCount = 0;
  let fallback = [];
  for (const w of scene.deckWindows) {
    const staged = expandChartLabels(expandStage(sliceDeckWindow(scene, w)));
    const r = compileAnalyticFrag(staged.subjects);
    if (r.ok) okCount++;
    else fallback.push(`${w.kind}(${r.reason})`);
  }
  ok(
    okCount >= scene.deckWindows.length - 4,
    `bytedance-bp: ${okCount}/${scene.deckWindows.length} windows analytic (fallback: ${fallback.join('; ') || 'none'})`,
  );
  // The -4 slack above is for exotic PRIMS only — an animation CHANNEL must
  // never cost a window its analytic tier (that's how the x-flight regression
  // slipped through green tests while the browser fell to stone).
  ok(!fallback.some((f) => /channel/.test(f)), 'no window falls back over an animation channel');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
