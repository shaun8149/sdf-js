# Per-Station Shader Switching (deck 站级 shader 切换) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deck 播放不再把所有站内联进一个巨型 fragment shader,而是按相机所在的时间窗口切换成"仅含当前站(+过渡时的相邻站)"的小 shader,让 M3 Mac 上的 deck 帧率从 ~7fps@0.5× 回到单站量级(≥30fps@1.0×)。

**Architecture:** 三层各改一点。(1) `assembleDeck` 在产出 SceneData 时顺手记录**时间窗口表** `deckWindows`(station / transit / finale),并提供 `sliceDeckWindow` 按 subject id 前缀(`s${k}-`/`path-${k}-`)切出每个窗口的子场景;(2) studio 渲染器加两个 API:`swapSDF(sdf)`(不清屏、不重置演出时钟的无缝换 program)和 `precompile(sdf)`(编译进 programCache 但不激活,靠 KHR_parallel 后台预热);(3) 新 runtime 模块 `deck-shader-windows.js` 在 rAF 上盯 `getPresentationTime()`,过窗口边界就 `swapSDF`,加载时先渲染窗口 0 再后台预热其余窗口。相机时间线、overlay、postFx 全程共享不变——只有 SDF/program 在换。

**Tech Stack:** 纯 ES modules(浏览器端 WebGL2 + node 测试),无新依赖。

## Global Constraints

- **Git 铁律**:永不 push main、永不自行 merge;从最新 `origin/main` 切分支 `perf/deck-station-shaders`;完成后 `gh pr create` 即停,等 user。Merge 策略 squash(user 锁定)。
- 测试跑法:repo 根 `node scripts/run-tests.mjs`(当前 main 应为 139/139);新测试文件要注册进 `scripts/run-tests.mjs` 的 TESTS 表。
- three.js 隔离铁律不涉及(无 three.js);不改抽象层语义,只加 API。
- 注释风格:解释"为什么",不写"改了什么";英文注释与现有文件一致。
- dev server:repo 根 `python3 dev-server.py 8001`(可能已在跑,先 `curl -s localhost:8001 >/dev/null && echo up`)。
- 浏览器验证用 Playwright MCP 工具(不是 gstack /browse——本 repo 既有会话都这么做,页面在 127.0.0.1:8001)。
- **基线数据(对照)**:`figure.html?deck=speech-demo&stage=1` 在 M3 上 7fps@0.5×(自适应降到底);单站 staged ~54fps。验收:同 URL 站内播放 ≥30fps 且自适应不降到 0.5×。

---

### Task 0: 分支

**Files:** 无(git 操作)

- [ ] **Step 1: 从最新 main 切分支**

```bash
cd /Users/hexiaoyang/Documents/sdfjs/sdf-js
git checkout main && git pull origin main
git checkout -b perf/deck-station-shaders
node scripts/run-tests.mjs 2>&1 | tail -1   # 期望 139/139
```

---

### Task 1: `assembleDeck` 产出 `deckWindows` 时间窗口表

**Files:**
- Modify: `sdf-js/src/scene/assemble-deck.js`(assembleDeck 函数体,~L87-278)
- Test: `sdf-js/scripts/test-deck-windows.mjs`(新建)
- Modify: `scripts/run-tests.mjs`(注册测试)

**Interfaces:**
- Produces: 返回的 SceneData 多一个字段 `deckWindows: Array<{ kind: 'station'|'transit'|'finale', stations: number[], start: number, end: number }>`,按时间升序、首尾相接覆盖 `[0, 总时长]`。`kind:'finale'` 的 `stations` 是全部站索引。时间单位与 `cameraSequence` 的 shot duration 累加一致(即 presentation 秒)。

- [ ] **Step 1: 写失败测试**

新建 `sdf-js/scripts/test-deck-windows.mjs`(仿 `test-camera-shake.mjs` 的 pass/fail 风格):

```js
// sdf-js/scripts/test-deck-windows.mjs — deck window timeline + slicing invariants.
// Guards the per-station shader switch (M3 perf): assembleDeck must emit a
// contiguous window timeline, and sliceDeckWindow must cut each window down to
// its own stations (plus shared world dressing) without touching the camera.
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { windowIndexAt } from '../src/runtime/deck-shader-windows.js';
import { expandAndCompile } from '../src/runtime/apply-studio-scene.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== deck windows (timeline + slice + compile) ===\n');

const ir = (t) => ({
  structure: 'magnitude',
  title: t,
  nodes: ['A', 'B', 'C'],
  magnitude: [3, 2, 1],
});
const deck = { title: 'perf', slides: [ir('one'), ir('two'), ir('three')] };
const scene = assembleDeck(deck, { stage: true });
const wins = scene.deckWindows;
const total = scene.cameraSequence.shots.reduce((s, sh) => s + sh.duration, 0);

// ---- timeline shape ----------------------------------------------------------
ok(Array.isArray(wins) && wins.length === 6, `3 slides → 6 windows (got ${wins && wins.length})`);
ok(
  wins.map((w) => w.kind).join(',') === 'station,transit,station,transit,station,finale',
  'kind sequence station/transit alternates, finale last',
);
ok(wins[0].start === 0, 'first window starts at 0');
ok(
  wins.every((w, i) => i === 0 || Math.abs(w.start - wins[i - 1].end) < 1e-9),
  'windows are contiguous',
);
ok(Math.abs(wins[wins.length - 1].end - total) < 1e-9, `last window ends at total (${total})`);
ok(
  wins[1].stations.join(',') === '0,1' && wins[3].stations.join(',') === '1,2',
  'transit windows carry both endpoint stations',
);
ok(wins[5].stations.join(',') === '0,1,2', 'finale window carries all stations');

// ---- slicing ------------------------------------------------------------------
const sliceOf = (i) => sliceDeckWindow(scene, wins[i]);
const stationIds = (s, k) => s.subjects.filter((x) => x.id && x.id.startsWith(`s${k}-`)).length;
{
  const s1 = sliceOf(2); // station window of slide 1
  ok(stationIds(s1, 1) > 0, 'station slice keeps its own subjects');
  ok(stationIds(s1, 0) === 0 && stationIds(s1, 2) === 0, 'station slice drops other stations');
  ok(s1.subjects.length < scene.subjects.length, 'station slice is smaller than the full deck');
  ok(s1.cameraSequence === scene.cameraSequence, 'slice shares the full camera sequence');
  ok(s1.defaults === scene.defaults, 'slice shares deck defaults (postFx/lights unchanged)');
}
{
  const tr = sliceOf(1); // transit 0→1
  ok(stationIds(tr, 0) > 0 && stationIds(tr, 1) > 0, 'transit slice keeps both endpoint stations');
  ok(stationIds(tr, 2) === 0, 'transit slice drops the far station');
  ok(
    tr.subjects.some((x) => x.id && x.id.startsWith('path-0-')),
    'transit slice keeps the breadcrumb path it flies over',
  );
}
ok(sliceOf(5).subjects.length === scene.subjects.length, 'finale slice is the full world');

// ---- every slice must actually compile to an SDF ------------------------------
for (let i = 0; i < wins.length; i++) {
  let sdf = null;
  try {
    sdf = expandAndCompile(sliceOf(i)).sdf;
  } catch (e) {
    /* fall through */
  }
  ok(!!sdf, `window ${i} (${wins[i].kind}) slice compiles to an SDF`);
}

// ---- windowIndexAt ------------------------------------------------------------
ok(windowIndexAt(wins, 0) === 0, 'windowIndexAt(0) → first window');
ok(windowIndexAt(wins, wins[1].start + 0.01) === 1, 'windowIndexAt lands mid-transit');
ok(windowIndexAt(wins, total + 99) === wins.length - 1, 'past the end → finale window');
ok(windowIndexAt(wins, -1) === 0, 'negative time clamps to first window');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node sdf-js/scripts/test-deck-windows.mjs
```
期望:FAIL —— `sliceDeckWindow`/`windowIndexAt` 尚未导出(import 报错)。

- [ ] **Step 3: 在 assembleDeck 中记录窗口**

`sdf-js/src/scene/assemble-deck.js`,四处小改:

(a) `let clock = 0;` 之后(~L91)加:

```js
  // Per-station shader switching (M3 perf): the ONE-shader deck world hits
  // Apple GPUs' super-linear giant-shader cost (register pressure kills
  // occupancy at compile time — runtime branch-skipping proved useless, see
  // docs 2026-07-10 perf notes). So we also emit a WINDOW TIMELINE: which
  // stations the camera can actually see during each span. The runtime swaps
  // in a small per-window shader as playback crosses each boundary.
  const windows = [];
```

(b) transit 分支内,`clock += dur;` 前(~L126)加:

```js
      windows.push({ kind: 'transit', stations: [k - 1, k], start: clock, end: clock + dur });
```

(c) `const stationDur = seqDuration(st.cameraSequence.shots);` 与 `clock += stationDur;` 之间(~L171)加:

```js
    windows.push({ kind: 'station', stations: [k], start: clock, end: clock + stationDur });
```

(d) finale block 内(shots.push 之后,~L228)加:

```js
    windows.push({
      kind: 'finale',
      stations: deck.slides.map((_, i) => i),
      start: clock,
      end: clock + 3.0,
    });
```

(e) return 对象加一行(`cameraSequence:` 之后):

```js
    deckWindows: windows,
```

- [ ] **Step 4: commit(测试仍 fail——sliceDeckWindow 未实现,不 commit 也可;推荐与 Task 2 一起 commit)**

(跳过单独 commit,连着 Task 2 提交。)

---

### Task 2: `sliceDeckWindow` — 按窗口切子场景

**Files:**
- Modify: `sdf-js/src/scene/assemble-deck.js`(文件末尾加导出函数)

**Interfaces:**
- Consumes: Task 1 的 `deckWindows` 条目。
- Produces: `sliceDeckWindow(scene, win) → SceneData` — 浅拷贝 scene,仅 `subjects` 被过滤;`cameraSequence`/`defaults`/`overlay` 保持**引用相等**(测试依赖)。finale 窗口直接返回原 scene。切分规则依赖 assembleDeck 自己的命名约定:站 subjects 前缀 `s${k}-`、面包屑 `path-${k}-`(连接 k→k+1,归属两端任一在窗口内即保留)、其余(horizon/env 世界装饰)全保留。

- [ ] **Step 1: 实现**

`sdf-js/src/scene/assemble-deck.js` 文件末尾追加:

```js
// ---- Window slicing (per-station shader switching) ---------------------------
// Cut ONE window's SceneData out of the assembled deck. Only `subjects` is
// filtered — camera timeline, overlay and defaults are shared by reference so
// the presentation clock, teleprompter and postFx are byte-identical across
// window swaps (the swap changes WHICH GEOMETRY EXISTS, never when/how it is
// filmed). Relies on assembleDeck's own naming: station subjects are prefixed
// `s${k}-`, breadcrumb paths `path-${k}-` (connecting k → k+1); anything else
// is shared world dressing (horizon hills, env terrain) and stays in every
// window so the backdrop never pops.
export function sliceDeckWindow(scene, win) {
  if (!win || win.kind === 'finale') return scene;
  const wanted = new Set(win.stations);
  const keep = (s) => {
    const id = typeof s.id === 'string' ? s.id : '';
    const st = /^s(\d+)-/.exec(id);
    if (st) return wanted.has(Number(st[1]));
    const path = /^path-(\d+)-/.exec(id);
    if (path) {
      const i = Number(path[1]);
      return wanted.has(i) || wanted.has(i + 1);
    }
    return true;
  };
  return { ...scene, subjects: scene.subjects.filter(keep) };
}
```

- [ ] **Step 2: 跑测试**

```bash
node sdf-js/scripts/test-deck-windows.mjs
```
期望:windowIndexAt 的 import 仍然失败(Task 3 的 runtime 模块未建)。为了本 task 可独立验证,先临时注释掉 windowIndexAt 的 import 与 4 条断言跑一遍——timeline + slicing + compile 断言应全绿——然后恢复注释。(或者接受 fail 直到 Task 3。)

- [ ] **Step 3: commit**

```bash
git add sdf-js/src/scene/assemble-deck.js sdf-js/scripts/test-deck-windows.mjs
git commit -m "feat(deck): emit deckWindows timeline + sliceDeckWindow (per-station shader prep)"
```

---

### Task 3: runtime 切换器 `deck-shader-windows.js` + 测试注册

**Files:**
- Create: `sdf-js/src/runtime/deck-shader-windows.js`
- Modify: `scripts/run-tests.mjs`(TESTS 表注册)

**Interfaces:**
- Consumes: `sliceDeckWindow`(Task 2)、`expandAndCompile`/`applyStudioScene`(`apply-studio-scene.js` 现有导出)、studio 实例的 `getPresentationTime()`/`isSequenceActive()`(已有)与 `swapSDF(sdf)`/`precompile(sdf)`(Task 4 加;本模块先调用,浏览器验证在 Task 4 之后)。
- Produces:
  - `windowIndexAt(windows, t) → number`(纯函数,node 可测)
  - `attachDeckWindows(studio, scene) → (() => void) | null` — scene 无 `deckWindows`(或 <2 窗)返回 null;否则完成初始渲染(窗口 0)、启动 rAF 边界监视 + 后台预热,返回 detach 函数。

- [ ] **Step 1: 实现**

新建 `sdf-js/src/runtime/deck-shader-windows.js`:

```js
// =============================================================================
// deck-shader-windows.js — per-station shader switching for deck playback.
// -----------------------------------------------------------------------------
// WHY: the assembled deck is ONE world in ONE fragment shader. On Apple GPUs a
// shader's register budget is allocated for its worst-case path AT COMPILE
// TIME, so a 3-station deck shader runs at ~7fps even at 0.5× resolution while
// each station alone runs at ~54fps (and runtime bounding-sphere early-outs
// measurably change nothing — 2026-07-10 A/B). The fix must make the SHADER
// smaller, not the work-per-frame: render only the stations the camera can
// currently see.
//
// HOW: assembleDeck emits a window timeline (deckWindows) + sliceDeckWindow.
// This module compiles each window's slice to its own SDF, warms every shader
// through studio.precompile() while window 0 plays, and swaps programs with
// studio.swapSDF() as the presentation clock crosses each boundary (a cache
// hit — no clear, no clock reset, no visible hitch). If the user grabs the
// fly camera we fall back to the FULL world (the finale window's shader):
// slow but correct — a free camera can look anywhere.
// =============================================================================
import { applyStudioScene, expandAndCompile } from './apply-studio-scene.js';
import { sliceDeckWindow } from '../scene/assemble-deck.js';

/** First window whose end is still ahead of t (clamped to the last window). */
export function windowIndexAt(windows, t) {
  for (let i = 0; i < windows.length; i++) if (t < windows[i].end) return i;
  return windows.length - 1;
}

export function attachDeckWindows(studio, scene) {
  const windows = scene.deckWindows;
  if (!Array.isArray(windows) || windows.length < 2 || !studio.swapSDF) return null;

  // Window index → ground-unioned SDF. Compiled lazily (CPU-side, ~ms each);
  // the GPU program for each SDF lives in studio's programCache.
  const sdfCache = new Map();
  const sdfFor = (i) => {
    if (!sdfCache.has(i)) sdfCache.set(i, expandAndCompile(sliceDeckWindow(scene, windows[i])).sdf);
    return sdfCache.get(i);
  };

  // Initial load renders window 0's slice (NOT the giant full-world shader —
  // the whole point is that the full shader only ever runs during the finale).
  const first = applyStudioScene(studio, sliceDeckWindow(scene, windows[0]));
  sdfCache.set(0, first.sdf);
  let cur = 0;
  let stopped = false;

  // Warm the remaining windows in playback order while station 0 plays.
  // Sequential await keeps at most one driver compile queued behind the
  // KHR_parallel pipeline; the finale (the expensive full-world program)
  // is naturally last.
  (async () => {
    for (let i = 1; i < windows.length && !stopped; i++) {
      try {
        await studio.precompile(sdfFor(i));
      } catch (e) {
        console.warn('[deck-windows] precompile failed for window', i, e);
      }
    }
  })();

  const tick = () => {
    if (stopped) return;
    const freeCam = studio.isSequenceActive && !studio.isSequenceActive();
    const idx = freeCam
      ? windows.length - 1 // free-fly → full world (finale shader)
      : windowIndexAt(windows, studio.getPresentationTime ? studio.getPresentationTime() : 0);
    if (idx !== cur) {
      cur = idx;
      studio.swapSDF(sdfFor(idx));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return () => {
    stopped = true;
  };
}
```

- [ ] **Step 2: 注册测试进 orchestrator**

`scripts/run-tests.mjs` 的 TESTS 表,紧挨 `sdf-js/scripts/test-atlas-deck-handoff.mjs` 那行(deck/present 相关分组)之后加:

```js
  { category: 'present', file: 'sdf-js/scripts/test-deck-windows.mjs' },
```

(以该文件里 atlas-deck-handoff 实际所属 category 为准——保持同组。)

- [ ] **Step 3: 跑单测 + 全量**

```bash
node sdf-js/scripts/test-deck-windows.mjs        # 期望:全绿(node 只 import,不触 WebGL)
node scripts/run-tests.mjs 2>&1 | tail -1        # 期望 140/140
```

注意:`test-deck-windows.mjs` import 了本模块 → 间接 import `apply-studio-scene.js`,纯 node 环境无 WebGL 但模块顶层无 DOM 依赖(现有 test-atlas-deck-handoff 已 import 过 apply-studio-scene,安全)。

- [ ] **Step 4: commit**

```bash
git add sdf-js/src/runtime/deck-shader-windows.js scripts/run-tests.mjs
git commit -m "feat(runtime): deck window watcher — swap per-station shaders on the presentation clock"
```

---

### Task 4: studio API — `swapSDF` / `precompile` + 缓存扩容

**Files:**
- Modify: `sdf-js/src/render/studio.js`(~L1971 `PROGRAM_CACHE_MAX`;public API 对象 ~L2826 起,`render(sdf)` 之后插入两个方法)

**Interfaces:**
- Consumes: 内部已有 `compileStudioFrag` / `uploadCompiledFrag` / `validateAndCache` / `programCache` / `parallelExt` / `wake`。
- Produces:
  - `swapSDF(sdf) → { bytes }`:同 `render()` 的编译+换入,但**不清屏、不重置 timeStart、不碰 flyControls、不走 pendingRender 延迟**。缓存命中→下一帧即换 program;未命中→KHR 异步编译期间旧 program 继续画,好了再换入(天然无卡顿)。
  - `precompile(sdf) → Promise<boolean>`:编译+link 进 programCache 但**不激活**(不调 finishProgramSetup、不碰 pendingProgram 槽)。已缓存→resolve(true)。

- [ ] **Step 1: 扩容 programCache**

~L1971,`const PROGRAM_CACHE_MAX = 6;` 改为:

```js
  // Deck window switching keeps 2N-1 programs alive for an N-station deck
  // (N station windows + N-1 transit pairs + the finale full-world program).
  // 24 covers a 12-station deck; each cached FS is ~1MB of driver bytecode,
  // well worth not recompiling a 200-500ms shader mid-presentation.
  const PROGRAM_CACHE_MAX = 24;
```

- [ ] **Step 2: 加两个 public API 方法**

public API 返回对象里,`render(sdf) {...},` 之后插入:

```js
    /**
     * Seamless SDF swap for deck window switching. Unlike render(): no canvas
     * clear (the old program keeps drawing until the new one is ready), no
     * presentation-clock reset (the camera sequence keeps playing through the
     * swap), no deferred-rAF dance. A programCache hit switches on the next
     * frame; a miss compiles async via KHR_parallel and swaps in when linked.
     */
    swapSDF(sdf) {
      const { fragSource, result } = compileStudioFrag(sdf);
      uploadCompiledFrag(fragSource, result);
      wake();
      return { bytes: fragSource.length };
    },

    /**
     * Compile + link a program into the cache WITHOUT activating it. Deck
     * playback warms every upcoming window's shader while station 0 plays so
     * later swapSDF() calls are cache hits. Resolves true once cached, false
     * on compile failure. Never touches the active program or the
     * pendingProgram slot (an in-flight render() swap is unaffected).
     */
    precompile(sdf) {
      let fragSource;
      try {
        ({ fragSource } = compileStudioFrag(sdf));
      } catch (e) {
        console.error('[studio] precompile: GLSL generation failed:', e);
        return Promise.resolve(false);
      }
      if (programCache.has(fragSource)) return Promise.resolve(true);
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, fragSource);
      gl.compileShader(fs);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      const entry = { prog, fs };
      if (!parallelExt) {
        try {
          validateAndCache(entry, fragSource);
          return Promise.resolve(true);
        } catch (e) {
          console.error('[studio] precompile failed:', e);
          return Promise.resolve(false);
        }
      }
      return new Promise((res) => {
        const poll = () => {
          if (!gl.getProgramParameter(prog, parallelExt.COMPLETION_STATUS_KHR)) {
            requestAnimationFrame(poll);
            return;
          }
          try {
            validateAndCache(entry, fragSource);
            res(true);
          } catch (e) {
            console.error('[studio] precompile failed:', e);
            res(false);
          }
        };
        requestAnimationFrame(poll);
      });
    },
```

- [ ] **Step 3: 回归**

```bash
node scripts/run-tests.mjs 2>&1 | tail -1   # 期望 140/140(studio.js 不进 node 测试,防手滑)
```

- [ ] **Step 4: commit**

```bash
git add sdf-js/src/render/studio.js
git commit -m "feat(studio): swapSDF (seamless mid-play program switch) + precompile (cache warm), cache 6→24"
```

---

### Task 5: figure-core 接线

**Files:**
- Modify: `sdf-js/apps/present/figure-core.js`(import 区 + `show()` 函数,~L86-115)

**Interfaces:**
- Consumes: `attachDeckWindows(studio, scene)`(Task 3)。
- Produces: `show(sceneData)` 行为不变;仅当 scene 带 `deckWindows` 时走切换器。author 页反复 `show()` 时旧 watcher 必须 detach。

- [ ] **Step 1: 接线**

(a) import 区加:

```js
import { attachDeckWindows } from '../../src/runtime/deck-shader-windows.js';
```

(b) `createFigure` 内(`let items = [];` 附近)加状态:

```js
  let detachDeckWindows = null;
```

(c) `show(scene)` 末尾,把

```js
    applyStudioScene(studio, scene);
```

换成:

```js
    // Deck scenes carry a window timeline — play them through the per-station
    // shader switcher (the giant full-world shader would run at single-digit
    // fps on laptop GPUs; see deck-shader-windows.js). Single-structure scenes
    // keep the one-shot path. Re-show() (author regenerates in place) must
    // detach the old watcher first or two rAF loops would fight over programs.
    if (detachDeckWindows) {
      detachDeckWindows();
      detachDeckWindows = null;
    }
    detachDeckWindows = attachDeckWindows(studio, scene);
    if (!detachDeckWindows) applyStudioScene(studio, scene);
```

- [ ] **Step 2: commit**

```bash
git add sdf-js/apps/present/figure-core.js
git commit -m "feat(present): route deck scenes through the per-station shader switcher"
```

---

### Task 6: 浏览器验证 + 性能 A/B + PR

**Files:** 无新改动(验证 + 可能的 fixup)

- [ ] **Step 1: dev server + 冒烟**

```bash
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8001/ || (cd /Users/hexiaoyang/Documents/sdfjs/sdf-js && python3 dev-server.py 8001 &)
```

Playwright 打开 `http://127.0.0.1:8001/apps/present/figure.html?deck=speech-demo&stage=1`,等 12s(自适应稳态),读 FPS HUD(fixed 定位、内容含 "fps" 的 div)。

**验收 1(性能)**:站内播放 ≥30fps,且 HUD 不显示 `0.5×`(自适应没降到底)。对照基线:改动前 7fps@0.5×。

- [ ] **Step 2: 窗口切换正确性**

- 等到 t≈第 2 站窗口(用 `window.__figStudio.getPresentationTime()` 轮询),截图:第 2 站的柱体/几何应在画面里(shader 真的换到了含该站的窗口)。
- console 里不应有 `[studio] precompile failed` / `async program compile failed` / `deck-windows` 告警。
- `window.__figStudio.setSequenceTime(1)` 回跳第 1 站,截图确认第 1 站几何回来了(倒带换回旧窗口 = 缓存命中)。
- finale(播到最后 3s)截图:全部站在画面里(full-world shader 生效;此处 fps 掉是预期,记录数值即可)。

**验收 2(视觉)**:transit 飞行中两端站都在;站内播放时画面与改动前一致(除了更流畅)。

- [ ] **Step 3: presenter 回归**

`blind.html`/`figure.html` 上 Space(播到下一拍 HOLD)、←(回退)、Home(重来)各按一次,确认提词/HOLD/倒带都正常(切换器跟随 presentation clock,seek 双向都要跟)。

- [ ] **Step 4: 单站不回归**

`figure.html?ir=funnel-sales&stage=1`(无 deckWindows → 走老路径),确认渲染正常、~54fps 量级。

- [ ] **Step 5: 全量测试 + PR**

```bash
node scripts/run-tests.mjs 2>&1 | tail -1    # 140/140
git push -u origin perf/deck-station-shaders
gh pr create --title "perf(deck): 站级 shader 切换 — deck 播放按时间窗口换小 shader" --body "..."
```

PR body 要点:根因(巨型 shader 静态成本,early-out A/B 证伪 7vs6fps)、架构(deckWindows 时间表 + slice + swapSDF/precompile + rAF watcher)、实测前后 fps、finale 仍用全量 shader 的已知代价、free-fly 回退全世界语义。**开完 PR 即停,把 URL + 摘要报给 user,等 merge 指令。**

---

## Self-Review

- **Spec 覆盖**:窗口时间表(T1)、切子场景(T2)、运行时切换+预热(T3)、无缝换 program 的渲染器支撑(T4)、产品接线(T5)、验收含性能/正确性/回归(T6)。用户拍板的 v1 语义——transit 用双站对、finale 用全量、free-fly 回退全量——分别落在 T1(d)/T2 finale 短路/T3 freeCam 分支。
- **占位符**:无 TBD;所有代码块完整可粘贴。
- **类型一致性**:`deckWindows` 字段名在 T1 产出、T2/T3 消费一致;`swapSDF`/`precompile` 在 T4 定义、T3 调用一致;`sliceDeckWindow(scene, win)` 签名一致;测试 import 的三个符号(`assembleDeck`,`sliceDeckWindow`,`windowIndexAt`)与实现导出一致。
- **已知风险(执行时注意)**:
  1. T3 测试在 node 里 import `apply-studio-scene.js` —— 该链条已被 `test-atlas-deck-handoff.mjs` 证明 node-safe;若 `deck-shader-windows.js` 顶层意外引用 DOM,把 rAF 引用留在函数体内(现设计已如此)。
  2. `run-tests.mjs` 里 category 名以现文件实际分组为准。
  3. speech-demo 的窗口数 = 3 站→6 窗,programCache 24 足够;若测试 deck 更大(>12 站)会 LRU 逐出——超纲,不处理。
