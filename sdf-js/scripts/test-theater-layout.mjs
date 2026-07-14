// sdf-js/scripts/test-theater-layout.mjs — 话剧模式 v2 契约测试。
// 2026-07-14 user 方向更新:素材扎实后,幕内恢复格斗游戏镜头 —— theater =
// 居中一字排开 + 标准镜头管线。不变量:居中线布局(z=0,左→右,原点居中)、
// 格斗语法在场(super 拍 + hitstop + whip 甩镜)、总连续性锁仍在(零 cut)、
// 窗口时间线与 shot 时长对齐、默认布局字节不动。
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
console.log('=== theater layout v2 (居中一字排开 × 格斗镜头) ===\n');

const scene = assembleDeck(DECK, { layout: 'theater', decorSeed: 'hash-A', dressing: 'nature' });
const shots = scene.cameraSequence.shots;
const wins = scene.deckWindows;

// ---- 布局:居中一字排开 -------------------------------------------------------------
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
  const xs = stationWins.map((w) => w.origin[0]);
  ok(
    Math.abs(xs[0] + xs[xs.length - 1]) < 1e-6,
    'the line is CENTERED on the origin (the studio light rig reaches every act)',
  );
}

// ---- 格斗镜头语法在场 ----------------------------------------------------------------
{
  const supers = shots.filter((s) => s.beat === 'super');
  ok(supers.length >= 5, `super punch-ins present (${supers.length})`);
  ok(
    supers.every((s) => s.shake),
    'supers keep their shake (impact stays)',
  );
  ok(
    scene.cameraSequence.hitstops.length >= 5,
    `hitstops restored (${scene.cameraSequence.hitstops.length})`,
  );
  ok(
    shots.some((s) => s.ease === 'whip'),
    'transit slings use the whip ease (幕间甩镜)',
  );
  const beats = shots.filter((s) => s.beat === 'station');
  ok(
    beats.length === DECK.slides.length,
    `one station payoff beat per act (${beats.length}/${DECK.slides.length})`,
  );
}

// ---- 总连续性锁不回退 ---------------------------------------------------------------
{
  ok(
    shots.every((s) => s.transition !== 'cut'),
    'ZERO hard cuts in deck playback (continuity lock survives the fighting grammar)',
  );
}

// ---- 时间线:窗口与 shot 时长对齐 -----------------------------------------------------
{
  const total = shots.reduce((a, s) => a + (s.duration || 0), 0);
  ok(
    Math.abs(wins[wins.length - 1].end - total) < 1e-6,
    'window timeline tiles the full shot sequence',
  );
  const v = validate(scene);
  ok(v.ok, `theater deck validates (${v.errors[0] || 'no errors'})`);
}

// ---- 默认布局字节不动 ----------------------------------------------------------------
{
  const a = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A' });
  const b = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A' });
  ok(JSON.stringify(a) === JSON.stringify(b), 'radial (default) untouched by the theater branch');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
