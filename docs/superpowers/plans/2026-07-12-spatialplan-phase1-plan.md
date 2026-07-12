# Plan: 空间组织框架 Phase 1 实施计划

> Spec:`../specs/2026-07-12-spatialplan-phase1-spec.md`(先读)。
> 合议记录:`../notes/2026-07-12-spatialplan-debate-synthesis.md`。
> 节奏:每 wave 一个 PR,user merge 后进下一 wave。Wave 0 是 gate——
> 结果决定主案(courtyard vs landscape),之后的 wave 按选边结果执行。

## Wave 0 — Gate 周:三 spike + golden snapshots(1 个 PR,截图为主)

**W0.1 golden snapshots**:对 line / radial / grid 三个 layout 各存一份 `assembleDeck`
现输出快照(subjects id 序列 / shots 序列 / deckWindows / hitstops / overlay 锚点),
钉进 `scripts/test-assemble-deck-golden.mjs`。此后任何 assemble-deck 改动先过等价性。

**W0.2 massing 剪影可读性 spike**:radial 布局(R≈33)手搓 3-5 块 zone massing
(合并体量,stone 着色,明度封顶内),真浏览器截图:crane / transit / finale 三个
镜头时刻,massing 与地平线石板能否分辨。可读通道按 spec §4(剪影 / 天际线 / 簇状)。

**W0.3 中心纪念碑定价 spike**:中庭中心件(5-10 leaf 量级)加进站窗口,laptop GPU
(集显基准)实测 FPS HUD 读数,对照 #286 现状基线。

**W0.4 landscape 对比 spike**:同一 deck 摆上已 ship 地形(terrain-elevated / canyon
任一),站点落在台地/谷地,一张俯瞰 + 一张 transit 截图。不写新引擎代码,只摆场景。

**验收**:三组截图 + FPS 数字进 PR body;**user 看图选边**(spike 1/2 都过 → 选边;
任一失败 → landscape 升主案)。

## Wave 1 — hold 站发射(独立于选边,可与 Wave 0 并行)

- `scaffold-to-ir.js` `atlasDeckToIR`:被 skip 的 slot(no-structural-atom)改发
  hold IR(标题 + 文本内容走 overlay;render-hold.js 已 ship,#287)。
- 15 个 ammo 重跑:slot→station 覆盖 48% → 目标 ≥95%;report 里 `skipped:*` 归零
  或逐条注明残余原因。
- 测试:test-atlas-deck-handoff 断言更新 + 每 deck 站数 = slot 数的对齐断言。
- **这是契约路径部署的硬前置**(spec §3),也独立兑现"3D 页数与 2D 对齐"。

## Wave 2 — Layer C 首批:3D decor 家族 v1(盲测两臂共用)

- 1-2 个家族起步(候选:Generator-S scatter/region 驱动的地面 inlay 场;
  柱列/碎石 instancing 场)。三纪律硬编码:seeded(deck hash → 家族参数)、
  subtle(明度封顶、只住虚空与壳层、数据 atom 独占焦点区)、家族制(参数化不是道具)。
- leaf 预算:decor 计入每窗口 dressing 预算(与石板/massing 同池,spec §4 守恒式)。
- 验收:同一 deck 两个 hash 出两套装饰截图(身份差异可见);FPS 不低于现状基线。

## Wave 3 — Layer B 首切口:模数 token(最小可用)

- 只做第一个切口:`render-magnitude` 的 `xOf(i)`/间距/plinth 尺寸抽成共享模数 token
  (`src/scene/layout-tokens.js`:stride / gap / datum-y / 纪念性尺度比),
  render-magnitude 消费;其余 renderer 不动(等 courtyard 落地后按需推广)。
- 验收:render-magnitude 输出逐字节不变(纯提取,golden 思路同 W0.1)。

## Wave 4 — 主案 layout 分支(按 Wave 0 选边结果)

**若 courtyard**:
- `assembleDeck` 加 `layout='courtyard'`:zone 感知圆心(章节成员 → 弧段聚类)、
  环形 transit 变体、朝中庭合成镜头(threshold 进章一瞥 / toc-overlook / finale),
  zone massing(独立 `massing-` 前缀、免距离裁剪、石板名额联动 slabs=max(0,6−massing))。
- zone 来源:bytedance-bp IR 层手工标注章节成员关系(不是契约字段);
  塌缩保护:每 zone≈1 站 → 检测器拒绝 courtyard 退化 radial。
- sliceDeckWindow:massing 进窗口的归属规则 + finale 不裁剪断言。

**若 landscape**:
- `layout='terraced'`:站点落台地(高程 = 章节),地形遮挡即窗口边界,
  overlook = 高程差免费;massing 由地形轮廓替代,石板保留。

**共同验收**:三 layout golden 等价性过;新 layout 全链可播
(`figure.html?deck=…&layout=…`);hitstop/字幕/beat 步进(presenter mode)不回归;
laptop FPS ≥ 现状基线。

## Wave 5 — 盲测(Phase 1 出口)

- 双臂:radial vs 主案 layout,**同一 deck、同一 decor 家族与预算、同一镜头纪律**。
- 产出:两条录屏给 user 盲选;结论只许"主案体验 > radial"。
- 盲测胜 → 与 user 重议延后项(2D outline 立项、契约请求、spine 排期、IR rule-of-two);
  盲测负 → 空间组织假设记录为证伪,Layer B/C 留存(它们独立有价值),Layer A 停。

## 风险与回退

- W0 spike 失败即换道(landscape),沉没成本 ≤1 周;
- 所有 assemble-deck 改动挡在 golden 后面;
- transplant 机器(EXPR_RE / 时钟 / hitstop)全程不动;
- 每 wave 独立 PR,任何一步 user 可叫停,已 merge 的 wave 各自独立有价值
  (hold = 页数对齐,decor = 观感,token = 卫生)。
