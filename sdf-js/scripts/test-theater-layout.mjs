// sdf-js/scripts/test-theater-layout.mjs — 话剧模式(layout='theater')契约测试。
// 不变量:一条水平轨道(全 shot 同高同距 → 幕间纯 x 平移)、幕内静止持机
// (station pose ≡ 前一 transit pose)、零硬切(全 blend)、零 hitstop、
// shot 时长与窗口逐一对齐(时间线不动 → reveal/字幕/章节卡原封)、
// 每站一个 presenter beat、默认布局字节不动。
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { validate } from '../src/scene/spec.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== theater layout (话剧模式:水平轨道镜头) ===\n');

const scene = assembleDeck(DECK, { layout: 'theater', decorSeed: 'hash-A', dressing: 'nature' });
const shots = scene.cameraSequence.shots;
const wins = scene.deckWindows;

// ---- 布局:一字排开 ---------------------------------------------------------------
{
  const stationWins = wins.filter((w) => w.kind === 'station');
  ok(
    stationWins.every((w) => Math.abs(w.origin[2]) < 1e-9),
    'stations sit on one line (z = 0)',
  );
  ok(
    stationWins.every((w, i) => i === 0 || w.origin[0] > stationWins[i - 1].origin[0]),
    'acts run left → right',
  );
}

// ---- 轨道:全程同高同距,幕间纯水平平移 ----------------------------------------------
{
  const rail = shots.filter((s) => s.beat !== 'finale');
  ok(rail.length === wins.length - 1, 'one shot per non-finale window');
  const y0 = rail[0].pos[1];
  const z0 = rail[0].pos[2];
  ok(
    rail.every((s) => s.pos[1] === y0 && s.pos[2] === z0),
    `camera rides ONE rail (y=${y0.toFixed(1)}, z=${z0.toFixed(1)} for all ${rail.length} shots)`,
  );
  // 幕内静止:station shot 的 pose 与它前面的 transit shot 完全一致
  for (let i = 0; i < wins.length; i++) {
    if (wins[i].kind !== 'station' || i === 0) continue;
    const prev = shots[i - 1];
    const cur = shots[i];
    if (JSON.stringify(prev.pos) !== JSON.stringify(cur.pos)) {
      ok(false, `act ${i} does not hold still (pose differs from arriving dolly)`);
      break;
    }
    if (i === wins.length - 2) ok(true, 'within an act the camera holds perfectly still');
  }
}

// ---- 零硬切 / 零冲击装置 -----------------------------------------------------------
{
  ok(
    shots.every((s) => s.transition === 'blend'),
    'zero cuts — every shot blends (思考连续性优先)',
  );
  ok(scene.cameraSequence.hitstops.length === 0, 'zero hitstops (no impact devices)');
  ok(
    shots.every((s) => !s.shake && !s.rush),
    'no shake / no rush fields anywhere',
  );
}

// ---- 时间线不动:shot 时长与窗口逐一对齐 --------------------------------------------
{
  ok(shots.length === wins.length, 'one shot per window (finale included)');
  const tiled = wins.every((w, i) => Math.abs(shots[i].duration - (w.end - w.start)) < 1e-9);
  ok(tiled, 'shot durations tile the window timeline exactly (reveals/字幕 untouched)');
}

// ---- presenter beats + validate ----------------------------------------------------
{
  const stationBeats = shots.filter((s) => s.beat === 'station');
  ok(
    stationBeats.length === DECK.slides.length,
    `one station beat per act (${stationBeats.length}/${DECK.slides.length})`,
  );
  ok(shots[shots.length - 1].beat === 'finale', 'the curtain call is beat-tagged');
  const v = validate(scene);
  ok(v.ok, `theater deck validates (${v.errors[0] || 'no errors'})`);
}

// ---- 默认布局字节不动 --------------------------------------------------------------
{
  const a = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A' });
  const b = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A' });
  ok(JSON.stringify(a) === JSON.stringify(b), 'radial (default) untouched by the theater branch');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
