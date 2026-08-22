# DIMENSION 策展手术 + 4D 拼板 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 落地 2026-08-22 策展终裁(维度 2D78/3D5/4D16/升维1、BOB 血统彻底退场、B4 转正)并建成 4D 拼板管线,交付 batch6(新配比 2D+3D)与 batch7(4D 拼板首批,即呈裁件)。

**Architecture:** DIMENSION 孤岛(全局函数、vm 沙箱测试、hash 双流 r())。4D 拼板 = 新 scene 35:一件作品渲 4/16 个板,每板同一 4D 物在 w0_i 的切片经 probe_4d 成像,Muybridge 恒定律(相机/配色/构图/地形全片共享,唯 w0 变)。策展手术 = sketch.js 路由表摘除 + 归一,退场场景文件暂留链装配。

**Tech Stack:** DIMENSION 仓(`~/Documents/sdf/DIMENSION`,直提 main);sdf-main 附属走 `genlab-4d` 分支 PR。

## Global Constraints(逐字执行)

- 确定性铁律:同 hash→同作品;禁 Math.random/Date.now/new Date;r() 先耗满再分支,数据决定消费次数=Critical;dev 口关闭时零消费零开销。
- 三处同步:index.html script 序 = test/run-tests.mjs CHAIN_FILES = 链上装配序;新文件三处齐上。
- **绝不读取/输出/提交 key.txt。**
- 维度表(终裁):tier 权重 **2d 78 / 3d 5 / 4d 16 / 升维 1**;2d 池 = scenes [30,31,32] 权 **38/38/24**;3d 池 = [34];4d 池 = [35];升维 = 既有升维图 scene。
- 退场清单(unroute,不删文件):scenes 1-6、7、8、9、10、11、12、13、14、15、16、17、18、19、20、21、22、23、24;painted 风格;主题库 mandala/flake 生成器件。
- 2D 风格轴:物件(30)**before 99 / neon 1**;风景(31)**before 47.5 / after 47.5 / warp 5**;主题(32)沿用现值(仅剔 mandala/flake)。
- **B4_SCALE = 0.5**,按场景门控(pa.scene===34 或 35 时生效),注入点:sketch.js buildPattern cellSize(≈:391)尾乘 / POISSON maxR、minR(≈:554)/ drawPoisson dotR(≈:603,乘在 Math.max 结果之外);2D 场景代码层隔离(门控判 pa.scene,非 URL 参数)。
- 拼板:**拼4(2×2)70% / 拼16(4×4)30%**;w0 等步扫物的 w 跨度,ensureVisibleSlice 守卫;板间密度变奏 = 织线密度因子随 |w0_i − w0_center| 线性 1.0→0.85(纯派生,零 roll);构图/相机/PAL3D/fog/terrain 整件一次 roll 板间共享。
- 4D traits:Panels("4"/"16")、Polytope(内容名)、W-Sweep(跨度档 Narrow/Wide);沿用 setScene34Features 同款二次发射模式。
- 交付:`~/Downloads/genlab-2d3d-batch6/`(30 枚,自然 hash 过滤 2d/3d tier,零筛选)与 `~/Downloads/genlab-4d-batch7/`(20 枚 4d tier + contact sheet);batch7 即呈裁,交付后 STOP 等 user。
- 测试基线 179 起步;HASH_A/HASH_B 回归锁按新路由重标(自然场景会变,锁值实跑取新)。

### Task 1: 4D 拼板核心(scene 35)

**Files:** Create `scenes/panels-4d.js`;Modify `scenes/index.js`(注册+SCENE_TYPE '4d'+probe 分派)、`sketch.js`(pa 参数 roll + B4_SCALE 常量与场景门控 + setScene35Features)、`index.html` + `test/run-tests.mjs` CHAIN_FILES(三处同步)。
**内容池(本任务先接现成的):** glome、5-cell、8-cell、16-cell、24-cell(lib4d slice4 已有)。等权。
**要点:** 板网格布局(canvas 等分 + 板间留缝 ~2% csize);每板独立 probe_4d(共享 cam,唯 sceneSdf 里 w0_i 变);全部 roll(板数/内容/w0 序列/comp/PAL3D/fog/terrain)在 setup 一次完成后再逐板渲;B4 门控转正(scene 34 同时生效,`?b4=` 保留为 dev 覆盖口);密度变奏因子作用于 buildPattern cellcount 派生链。
**测试:** 板数分布锁 70/30、w0 单调等步、消费恒定(同 hash 拼4/拼16 强制口对照 roll 数一致)、SCENE_TYPE、三处同步、B4 门控(scene≠34/35 系数恒 1 的断言)、traits 三键值域。`?panels=4|16`、`?poly=<name>` dev 强制口(照 ?sculpt= 模式,roll 后覆写)。

### Task 2: 策展手术

**Files:** Modify `sketch.js`(tier 表/场景池/风格轴/内容池归一)、`scenes/index.js`(如涉路由辅助)、`README.md`(概率表节+退场记录);test/run-tests.mjs 大规模重标。
**要点:** 按 Global Constraints 的维度表/退场清单/风格轴逐字落地;退场 = 从 tier 池数组摘除(文件与 CHAIN_FILES 不动);mandala/flake 从主题池过滤(查 32 场景内容表);HASH_A/HASH_B 及一切场景路由锁实跑取新值;加"退场场景不可自然到达"断言(150-hash 扫掠 scene∈{30,31,32,34,35,升维} 全覆盖);painted 分支代码保留但权重 0(可达性断言)。
**验收:** `node test/find-hash.mjs` 各存活场景均可猎中;概率经验分布 vs 表值(1000-hash 卡方粗检,报告记录)。

### Task 3: 巨胞体 spike + 内容收尾

**Files:** Modify `objects4d/`或`scenes/panels-4d.js` 内容表;spike 脚本入 `.superpowers/sdd/` workspace(不进链)。
**要点:** 120-cell/600-cell 精确半空间交 SDF(顶点/胞面数据生成脚本可离线,产物为链内常量数组);性能预算:单板(拼16 尺寸)CPU probe ≤8s(与 batch4 的 0.5 档 colossus 同量级),超标则该胞体降级记录呈裁不入池;达标入池后六胞体+glome 权重呈裁 draft:glome 25 / 5-cell 15 / 8-cell 15 / 16-cell 15 / 24-cell 15 / 120-cell 7.5 / 600-cell 7.5。
**测试:** 新胞体符号探针(闭式点证)+ 切片非空守卫回归。

### Task 4: 双批交付 + 收卷

**要点:** batch6 = 30 枚自然 hash 过滤 tier∈{2d,3d}(预期 ~28:2,如实呈现)+ contact sheet → `~/Downloads/genlab-2d3d-batch6/`;batch7 = 20 枚自然 4d tier + contact sheet(拼4/拼16 自然出现)→ `~/Downloads/genlab-4d-batch7/`;渲染用真浏览器管线(scratchpad genlab* 脚本复用,CDP id 自增)。sdf-main:style-plan.json 全表改版(维度/退场/归一/拼板/B4)+ AGENT_HANDOFF §0.6 增行,提交 genlab-4d 分支,push 后 `gh pr create` **不 merge**;工作树无关 WIP(场景语料总地图节等)沿用单 hunk 手术排除。README/memory 收卷更新。**交付后 STOP:batch7 即呈裁件,等 user 终裁(拼板品相/胞体权重/120-600 去留)。**

## 工程纪律

DIMENSION 直提 main,frequent commits;每任务实现者+审查者双门;终审全分支 opus;退场造成的测试重标必须"实跑取值"不许手算猜值;batch 渲染零筛选零重摇。
