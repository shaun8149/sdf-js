# Presenter Mode Implementation Plan(讲稿 → 可上台的 3D 演讲世界)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 staged deck 从「自动播放的片子」变成「讲者用空格控制节奏、带原话提词的演讲搭档」。Spec: `docs/superpowers/specs/2026-07-10-presenter-mode-design.md`。

**Architecture:** ① 统一时钟(引擎:sequence 激活时 `u_time` = sequence 时间,暂停/seek 联动 build-in);② beat = 确定性推导(shots 打 `beat` 标签 → `deriveBeats(cameraSequence)` 得边界);③ presenter runtime:**讲稿 span 驱动步进** —— 空格 = 下一个 span,span 指向视觉 beat 则播放到该 beat 边界并 HOLD,span 是 hold 则只换提词;④ 讲稿对齐 = text-to-ir 合同扩展(原文切片 + 归属,只切不改)。

**Tech Stack:** 既有 studio(`setSequenceTime/Paused/getSequenceTime` 已存在)、assembleDeck/renderers、text-to-ir(BYOK)。无新依赖。

## Global Constraints

- 讲稿圣旨:切片拼回 ≈ 原文(空白归一后),违者重试一次 —— 验证在 parse 层强制。
- 每个引擎/合同改动:默认路径**零行为变化**(无 sequence → u_time 照旧;无 beats → 播放照旧;无 script → 纯 beat 步进)。
- Git:feature 分支;每 task 一 commit;PR 后停,不自 merge。测试进 `scripts/run-tests.mjs`,全量保绿。
- Prompt 守铁律:保持短。真 LLM 验证走 `regression/`(BYOK,不进 npm test);key 从 `~/.atlas-key` 读(可能已删,脚本须优雅 SKIP)。

---

## File Structure

- `sdf-js/src/render/studio.js` — **modify.** 统一时钟(u_time 跟随 sequence 时间)。
- `sdf-js/src/scene/beats.js` — **new.** `deriveBeats(cameraSequence) → [{t, station, kind}]`。
- `sdf-js/src/scene/assemble-deck.js` + `render-*.js` — **modify.** 给关键 shot 打 `beat` 标签(一行/处)。
- `sdf-js/src/scene/text-to-ir.js` — **modify.** 合同加 `script` spans(可选字段);切片验证。
- `sdf-js/apps/present/presenter.js` — **new.** 步进 runtime + 提词条(figure-core 挂载后附加)。
- `sdf-js/apps/present/figure.js` / `author.js` — **modify.** `?present=1` 接入。
- Tests: `test-beats.mjs`、`test-script-spans.mjs`(mock 回复)+ `regression/text-to-ir-eval.mjs` 扩展。

---

### Task 1: 统一时钟 — sequence 激活时 u_time = sequence 时间

**Files:** Modify `sdf-js/src/render/studio.js`;Test: Playwright 冻结验证(GPU 行为,无法 unit)。

**Interfaces:** Produces `studio.getPresentationTime() → number`(= 本帧上传给 `u_time` 的秒数;无 sequence 时为 wall-clock)。

- [ ] **Step 1: 加内部 getter。** 在 sequence 状态区(`let sequencePaused = false;` 附近,~2118)加:

```js
  // ONE presentation clock: when a sequence is active, subject animations
  // (u_time) follow the SEQUENCE time — pause freezes build-ins, seek scrubs
  // them. No sequence → wall-clock as before (zero change for old scenes).
  function presentationNowSec() {
    if (activeSequence) {
      if (sequencePaused) return sequencePausedAt;
      return warpSec((performance.now() - sequenceStartTime) / 1000);
    }
    return warpSec((performance.now() - timeStart) / 1000);
  }
```
(核对 `sequencePausedAt` 存的量纲:与 2766 播放分支的 `tSec` 同款(warped 秒)即直接用;若存 raw,补 `warpSec`。)

- [ ] **Step 2: 换上传点。** ~2597 的 `gl.uniform1f(uniformsCache.u_time, warpSec((performance.now() - timeStart) / 1000));` → `gl.uniform1f(uniformsCache.u_time, presentationNowSec());`。检查 2654 的 `tSec`(体积/其他消费)是否同源,若是也换。

- [ ] **Step 3: 暴露 getter。** studio 返回对象(~3015 `project` 附近)加 `getPresentationTime: () => presentationNowSec(),`。

- [ ] **Step 4: 冻结验证(Playwright)。** `figure.html?ir=funnel-sales&stage=1` 加载后立即经 console 调 `setSequenceTime(1.2); setSequencePaused(true)`(figure 页暴露 studio?若无,经 `window.__studio` 临时钩或在 presenter task 后补验)→ 间隔 2s 截两张图 → **字节级一致**(时间冻结 = 像素确定)。对照:不暂停时两张不同。

- [ ] **Step 5: 全量测试保绿 + commit** `feat(studio): one presentation clock — u_time follows the sequence (pause freezes build-ins)`。

### Task 2: beat 标签 + `deriveBeats`

**Files:** Create `sdf-js/src/scene/beats.js`;Modify `assemble-deck.js`(station/finale 标签)、`render-*.js` 5 个(super shot 加 `beat:'super'`);Test `sdf-js/scripts/test-beats.mjs`。

**Interfaces:** shot 可带 `beat: 'station'|'super'|'finale'`(station 标在每站**最后一个** shot 上,assembleDeck 转植时打;super = renderers 里 `transition:'cut'` 的 punch-in shot;finale = assembleDeck 尾 shot)。`deriveBeats(cameraSequence) → [{ t, station, kind }]`(t = 该拍 HOLD 边界的 sequence 秒,升序;station = 第几站,super/finale 继承所属站)。

- [ ] **Step 1: failing test**(构造带标签的假 shots 数组:2 站、站 0 含 super,断言 deriveBeats 输出 4 拍 [station0-super, station0, station1, finale]、t 升序、station 归属正确;无标签 shots → 单拍(整条时间轴))。
- [ ] **Step 2: 实现 `beats.js`**(纯函数:走 shots 累计 duration;遇标签记边界;注意 super 在站尾 shot 之前,顺序按时间即可)。
- [ ] **Step 3: 打标签。** assembleDeck:站循环里最后 push 的站 shot 加 `beat:'station'`(含 station index);finale shot 加 `beat:'finale'`。renderers:每处 `transition: 'cut'` 的 super shot 加 `beat:'super'`(5 个文件 grep `transition: 'cut'`)。
- [ ] **Step 4: 断言真实链路** —— `assembleDeck({slides:[funnelIR, orgIR]}, {stage:true})` 的 sequence 过 deriveBeats:拍数 ≥ 站数+1(finale),super 拍存在(sequence 的 emphasis)。
- [ ] **Step 5: 注册测试 + 全量 + commit** `feat(beats): beat tags on shots + deriveBeats (deterministic, from IR-authored shots)`。

### Task 3: presenter runtime — 空格步进 + HOLD

**Files:** Create `sdf-js/apps/present/presenter.js`;Modify `figure.js`(`?present=1`)。

**Interfaces:** `attachPresenter({ studio, scene, script? }) → { dispose }`。行为:load 后 seek 到 0 并 HOLD;**空格** = 播放到下一拍边界(rAF 轮询 `getSequenceTime() >= beat.t` → `setSequencePaused(true)`);**←** = seek 上一拍边界并 HOLD;有 `script` 时按 span 驱动(Task 5)。屏角小 HUD:`拍 3/9`。

- [ ] **Step 1: 实现**(核心 ~60 行:deriveBeats、键盘监听、`playTo(t)` = unpause + 轮询到 t 即 pause;figure.js:`present && attachPresenter(...)`)。
- [ ] **Step 2: Playwright 验证** —— `figure.html?deck=deck-pitch&stage=1&present=1`:加载后 1s 与 3s 截图一致(HOLD 在拍 0);`browser_press_key Space` → 等 2s → 画面前进;再等 4s 两张截图一致(HOLD 在拍 1)。
- [ ] **Step 3: commit** `feat(present): presenter runtime — space steps beats, timeline holds`。

### Task 4: 讲稿对齐 — text-to-ir 合同加 `script`

**Files:** Modify `sdf-js/src/scene/text-to-ir.js`;Test `sdf-js/scripts/test-script-spans.mjs`(mock);扩展 `regression/text-to-ir-eval.mjs`(真 LLM,可选跑)。

**Interfaces:** 合同扩展(向后兼容):`{title, slides, script?: [{text, station, kind:'station'|'super'|'hold'}]}`。新导出 `validateScript(deck, original) → {ok, errors}`:① 每 span 的 station ∈ [0, slides.length);② **切片拼回 = 原文**(`normWS(spans.map(s=>s.text).join('')) === normWS(original)`,normWS = 去所有空白);③ kind 合法。`textToScript(text, apiKey)`(或 textToIR 加第二参数 `{script:true}`):system prompt 追加一小段(守短):"若输入是完整讲稿,额外输出 script:原文逐段切片(一字不改),每片标 station+kind(station=讲到该站/super=punchline 落点/hold=过渡闲话)"。parse 层跑 validateScript,失败把错误喂回重试一次(复用现有 retry 骨架)。

- [ ] **Step 1: failing test(mock)** —— 手写一个模型回复 JSON(2 站 + 5 span,含 hold + super),断言 parse 通过、拼回原文成功;再造「span 改写了原文」的回复 → validateScript 拒绝。
- [ ] **Step 2: 实现**(prompt 追加 ≤ 400 字符;`parseIRResponse` 在 deck.script 存在时跑 validateScript(需要 original text —— 给 parse 加可选第二参))。
- [ ] **Step 3:(可选,key 在则跑)真 LLM:** eval 加 1 案例 —— 一段 ~300 字中文讲稿,断言 script 拼回原文 + station 在范围。key 不在 → SKIP。
- [ ] **Step 4: 注册 + 全量 + commit** `feat(text-to-ir): script spans — verbatim slicing + beat attribution (teleprompter fuel)`。

### Task 5: 提词条 + author 页整链

**Files:** Modify `presenter.js`(script 驱动模式 + 提词条 DOM)、`author.js`(present 默认开当 script 存在)。

**Interfaces:** script 模式下:空格 = **下一个 span**;span 的 (station,kind) 映射到目标视觉拍(station→该站 station 拍,super→该站 super 拍,hold→不动画面);目标拍在前方 → `playTo`,同拍/hold → 只换提词文字。提词条:底部一条半透明窄带,当前 span 原文,右端 `span k/N`。

- [ ] **Step 1: 实现**(映射:按 station 升序把 spans 对齐到 deriveBeats 输出;同站内 super span → super 拍;找不到精确拍 → 最近站拍,console.warn)。
- [ ] **Step 2: Playwright(mock 路径)** —— 不调 LLM:figure 页加临时 `?script=demo` 读一个 fixture(`scenes/ir/deck-pitch-script.json`:deck-pitch 配 8 个手写 span)→ 验证:提词条显示 span 0;Space×3 → 提词换、hold span 画面截图不变、station span 画面前进。
- [ ] **Step 3: author.js:** textToIR 带 `{script:true}`;结果有 script → 自动 `attachPresenter`。
- [ ] **Step 4: commit** `feat(present): teleprompter strip — script spans drive the beats`。

### Task 6: 真跑验收 + PR

- [ ] 全量测试绿;**(key 在则)** author 页真跑一篇 ≥800 字中文讲稿(Playwright 填 key+讲稿,截 3 拍)对照 spec §5 成功标准;push + `gh pr create`,STOP 报告。

## Self-Review

- Spec 覆盖:统一时钟 §3.1→T1;beat 推导 §3.2→T2/T3;讲稿对齐 §3.3(圣旨纪律→validateScript 拼回验证)→T4;hold 拍→span kind:'hold'(T4/T5);提词条 §2(a)→T5;成功标准 §5→T6。双屏/视觉方向明确不在本计划(spec §4 非目标)。✓
- 占位符:各 task 给了签名/行为/验证与锚点;engine 行号标注「~」并给搜索锚(文件在漂移)。T1 Step 1 对 `sequencePausedAt` 量纲留了核对指令而非假设。✓
- 类型一致:`deriveBeats→[{t,station,kind}]` 被 T3/T5 消费;`script span {text,station,kind}` T4 产 T5 消费;`getPresentationTime` T1 产(T3 验证用 getSequenceTime 亦可)。✓
