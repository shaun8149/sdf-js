# DIMENSION 3D 扩容+配比卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定原文(逐字为准):DIMENSION `.superpowers/sdd/2026-08-25-dimension-mint-readiness/progress.md` 尾部「新卷终裁 (2026-08-26)」节。

**Goal:** 4D 减半让 2D(配比 2D86/3D5/4D8/升维1)+ 3D 语料五路扩容(解释器语料/柏拉图殿/分形/填充),落完后在最终语料上正式提交混合 minify。

## Global Constraints

- 岛铁律:同 hash+同时刻→同画面;禁 Math.random/Date.now;r() 先耗满再分支;三处同步;链零 URL 解析(常设断言在,别破);**绝不碰 key.txt**;测试实跑取值。
- DIMENSION 直提 main(基线 682f8b0,468/468);sdf-main 附属走 `genlab-3d-expand` 分支 PR 不 merge;无关 WIP 排除。
- 新 3D 内容全部进 **scene 34** 现有池结构(主件路由扩展,消费恒定:池加长不改 roll 数;新增路由档需无条件先耗)。已完成勿重做:布尔雕塑 1-8、waves 地形。
- 混合 minify(DIMENSION-hybrid 已验证)**压后**:本卷收卷后在最终三库件上重跑同款 terser 正式提交。

### Task 1: 配比调整
sketch.js TIER_WEIGHTS **2d 86 / 3d 5 / 4d 8 / 升维 1**(旧 78/5/16/1);全部相关锁实跑重标(列旧→新);1000-hash 卡方复检;sdf-main style-plan.json 同步(本卷分支);README 概率表节。

### Task 2: SceneData 解释器 + 语料策展入池
~150 行解释器进链(scenedata.js 既有 buildNode/buildScene 残件可复活/重写,SD3.P 原语在);sdf-main demo-lifts 217 件语料(`sdf-js/examples/compositor/demo-lifts/` 与 scenes/,grep 定位)对抗审"立不立/像不像"逐件过 → 策展子集(预计 100-150)转为链内常量数据 + 新主件路由档(scene 34 内 lifted 档,权重 draft 15% 呈裁;primitive/bool/sculpt 相应压缩,呈裁);链体量增量如实报;新档 traits(Forms=件名)。逐件符号探针抽样 + 消费恒定 + 样张批呈裁。

### Task 3: 柏拉图殿
scene 34 新增 platonic-shrine 内容:五正多面体单件成景变体(独立档或并入 primitive 档加权,呈裁 draft)+ **嵌套对偶件**(线框立方⊃八面/十二⊃二十,wireframe_box 手法照 caged-orb 先例);README/traits 记"2D∞/3D5/4D6"叙事;样张。

### Task 4: 分形 spike
fractal.js 的 mandelbulbDE/sierpinskiSDF 接 scene 34 稀有档(权重 draft 各 2%);**单板 CPU probe ≤8s 预算门**(120-cell 先例):达标入池、超标降级记录呈裁;符号探针+切片非空+样张。

### Task 5: 填充八件
扭塔 twist(box)/弯月柱 bend(cylinder)/链条 iq-link/禅石塔 ellipsoid 叠/拱桥月夜 iq-arch-bridge+浮球/柱林 rep+异色球/炮弹金字塔/同心环阵——进 scene 34 组合静物/阵列档(路由结构呈裁 draft);每件 ~15 行;batch2 逐件纪律(探针+样张)。

### Task 6: 收卷
全量指纹重基线;600-hash 体检刷新(mint-snapshot 口径,新配比+新内容分布);batch15 样张呈裁(各新档);sdf-main style-plan 全表+handoff §0.6 提交,PR 不 merge;README/memory。**STOP:新档权重/分形去留/样张品相呈 user 终裁**;终裁后正式 minify 提交另行执行。

## 工程纪律
双门审查;卷末 opus 终审;渲染零筛选;fix loop ≤5;执行序 T1→T2→T3→T4→T5→T6。
