# DIMENSION 2D 抽象扩容卷(flowdots 转正)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定:user 2026-09-15 立卷令("万件必然大量重复……对 QQL 点状算法进行模拟,大量增加多样性")+ 融合终裁("1 2 4 都是对的")+ 池级按推荐(scene36/20%/双焦点不做)。
> 原型基础:`dev/flowdots.js` 480 行(3e8b208,dev 口 ?flowdots=1)+ 设计报告 `.superpowers/sdd/2026-09-15-dimension-2d-abstract/design-proto-report.md`(qqlrs 精读 §A/管线取舍 §B/多样性 1.3×10⁷ 格)。

**Goal:** QQL 点链流场转正为 **scene36 独立抽象池(POOL_2D 第四槽 20%)**,带 BOB 血统融合三刀——"织谱=网格排列的点彩,flowdots=流场排列的点彩,同一支笔两种排列语法"。

## Global Constraints

- 岛铁律全套:同 hash+同时刻+同 mintTime→逐位同;禁 Math.random/Date.now;消费恒定(scene36 入池 = POOL_2D 权重字面 + 独立侧流 ⊕0x2545F491 第十八方恒耗;既有 2D 三池 roll 序零扰动);链零 URL;minified 件/key.txt 不碰;测试实跑;基线 = 4D 卷 T2 落地后 HEAD(与 4D 卷共享测试链,dispatch 时以实际 HEAD 为准)。
- user 终裁字面:**F1 颜料同源**(珠色过 buildWeavePalettes BOB 颜料策展,HSB 微扰换颜料抖动)+ **F2 笔触同源**(珠=织谱 dab 笔触形,非纯圆点)= 硬规格;**F4 剪影互动**(流场遇 SDF 剪影绕行,物成流场中洞/岛)= 原型看样再定档;F3 不做;双焦点族不做;池位 scene36,配比 POOL_2D draft 12/38/25/25(objects/landscapes/themes/abstract≈20%,精确字面呈裁);流场族做减法 3-4 族(放射/螺旋/线性 ± 星阵)。
- 装裱/显影幕/chrono 时辰轴/印章/traits 全接(显影幕 = generator 沿链生长排水;原型已证装裱+chrono)。
- 四调优旋钮随卷:淡彩对比度地板/链束低频结构/Zebra 双色环/主珠槽。
- 与 4D 影雕卷并行纪律:共享 run-tests 落盘顺序先到先得,后到 rebase;dispatch 前确认对方不在共享文件上。
- sdf-main 附属走 `genlab-2d-abstract` 分支 PR 不 merge。

### Task 1: 融合两刀(F1 颜料同源 + F2 笔触同源)
flowdots.js 改造:①珠色管线换 `buildWeavePalettes(层色/palette 派生源)` 颜料池取色(色序游走保留,但游走对象 = 颜料链;逐珠微扰 = 颜料抖动机制,零 HSB 直调);②珠渲染换织谱 dab 笔触 primitive(椭圆/歪斜/多遍,织谱同源函数抽出共享,不复制);性能复测(dab 比圆点贵,60-165ms 基线,红线 2D 件既有渲时包络)。样张 A/B 对照(改前圆点纯色带 vs 改后颜料 dab)×4。锁:颜料源恒等(珠色 ∈ buildWeavePalettes 输出可执行断言)/dab 共享函数单源。

### Task 2: scene36 入池
scenes/index.js:scene36 注册(GEN2D 生成器件先例)+ POOL_2D_WEIGHTS 第四槽(字面 draft ≈20%,现值 16/51.5/32.5 等比让位方案呈审)+ 流场族窗/密度/色序/深浅底(70/30)全套侧流 ⊕0x2545F491 恒耗;既有三池 roll 序零扰动双树对拍;装裱/chrono/显影幕(generator 化)/印章全接;traits(Composition=abstract-flow 或 Family 轴,draft 呈裁);四调优旋钮落值(dev 试档目检)。100-hash 自然轮盘扫(池率/族分布/时辰三态)。样张 12+(自然命中各族×密度×时辰)。

### Task 3: F4 剪影互动原型(dev 口,出样呈裁不转正)
`?flowdrift=<piece>` 类 dev 观察口:流场以指定 SDF 剪影为障碍绕行(Kusama 物外成网同款距离判据),物体区留白或反相;试 熔化物件(怀表/眼镜)×流场涡旋 组合样张 6;观感记录(物为洞 vs 物为岛两式)。user 看样终裁转正与否/出现档。

### Task 5: 抽象构图族(user 2026-09-16 QQL 五参考圈选,排 F4 转正笔后)
scene36 加第二轴**构图族**(与流场族分成 55/45,件级单 roll):**区域代数构图器**——程序化 SDF 分区布局 + 逐区填充文法指派(珠链/T4c 靶心环/织谱纹/留白,全部既有笔刷复用零新绘制原语)。首发三族:①**组装体**(大弧环/竖柱条/同心盘堆叠布尔拼装,构成主义;区域 3-7 块);②**稀环场**(巨 annulus 一枚 + Poisson 散布小环群,大留白——好评谱系"极简留白"同族);③**弧扫唱片**(大半径弧束长曝光感 + 实心同心盘 2-4 枚,T4c BullseyeGenerator 直接复用)。分栏对写/透视网留二期。侧流恒耗扩槽(FD 侧流内);消费恒定;窄色域/时辰轴/装裱/显影幕全接;样张逐族 6+;分成与族内权重 draft 呈裁。

### Task 4: 重基线 + 收卷
全量重基线(t4 池昼夜:2D 三池受影响行归因 POOL 让位翻面 + scene36 新行定向掺入冻结池 ≥3;4D 行不动);batch50 200 张总验收(scene36 期望 ~40 件,重点验:抽象件融入度——"远看 QQL 近看 BOB"/与具象件同批陈列的气质统一性/重复感);sdf-main style-plan(scene36 节/POOL 四槽/流场族/融合三刀)+ §0.6 + plan 入库 + PR 不 merge;README;opus 终审;STOP 呈裁(配比字面追认/F4 去留/旋钮/traits)。

## 工程纪律
双门审查;卷末 opus 终审;fix loop ≤5;执行序 T1→T2→T3→T4(T3 可与 T2 尾并行);样张全进 Downloads;dev 8005(4D 卷占 8003/8004)绝不动 8002;agent 前台轮询;报告增量落盘 `.superpowers/sdd/2026-09-15-dimension-2d-abstract/`。
