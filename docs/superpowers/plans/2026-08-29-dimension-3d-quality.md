# DIMENSION 3D 品相根治卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定:user 2026-08-29"三件都做,开工"(全池 cov 扫掠 / closeup 兜底追根 / mandelbulb 提速复活)。

**Goal:** 把 3D 端(scene 34)品相下限抬起来:按症状统一尺寸压限、closeup 构图走通正常路径、Mandelbulb 达标复活。

## Global Constraints

- 岛铁律:同 hash+同时刻→同画面;禁 Math.random/Date.now;r() 先耗满再分支(压限/修法全部纯派生零 roll);链零 URL 解析(dev 口只进 dev/dev.js);三处同步;**绝不碰 key.txt**;测试实跑取值;基线 DIMENSION c7e4091,683/683。
- **minified 三库件是入仓正本不许重新生成/触碰**(objects2d/lib-*.js);本卷改动集中 scenes/solids-stage.js、render 相关与测试。
- 批量实验用 **T4 保真流口径**(镜像 setSeed/pal/pal2/shuf 全消费;扩容卷账本有记载);浏览器 before/after 判决必带 `&t=` 钉时刻。
- sdf-main 附属走 `genlab-3d-quality` 分支 PR 不 merge;无关 WIP 排除。

### Task 1: 全池 cov 扫掠 + 统一压限
**扫**:44 主体形 × {monument, colossus} × N≥50(保真流 forced-34,vm probe cov 口径与 T5/终审 sweep 同源),产出全池 cov 分布表(p50/p90/兜底率)+ 分布图数据。**定**:按症状统一判据(draft:p50>0.85 入压限,压至 min(hF,1.0);与既有四份名单对照,吸收合并为单一 `COV_COMPACT` 名单,四份旧名单退役为其成员注记——行为逐位等价于"旧四份∪新增"须实证);**吃残案**:cannonball×colossus 反升 N≥50 单调性判决、icosa 应急帽收效复评(若统一判据下需更紧,提数据呈裁)。**验**:压限前后各受影响 kind 同 hash 对照(vm cov + 抽样真浏览器);消费恒定;锁重标;683→实跑。样张:受影响 kind 前后对 12 枚 → `~/Downloads/genlab-covcap-batch20/`。分布表+名单呈裁 draft。

### Task 2: closeup 兜底追根
**诊**:插桩(dev 侧/vm,不进链)记录 closeup 摆位失败的具体分支(covTargets 不可达?t 窗×hF 窗冲突?lifted planar 特例?),≥200 hash 归因分布表。**修**:修正常路径(如 closeup 专属 covTargets/相机窗重标定,纯派生零 roll;若需改 roll 结构=Critical 级须报告停手呈裁)。**验**:兜底率 before/after(closeup 目标 ≤25%,其他四型零扰动);全型样张 16 枚(closeup 修后 8 + 对照 8)→ `~/Downloads/genlab-closeup-batch21/`;683→实跑;老 hash 锚点按需重标列旧→新。

### Task 3: mandelbulb 提速复活
**优化**:包围盒预剔除(外接球外走球距,盒内切真 DE)+ 步进安全系数调优(不穿膜前提放大步长;侧向步进回归款验证);**纯几何等价**:优化前后 SDF 语义逐位或有界差(报告证明)。**判**:重跑扩容卷 T4 同款基线对照(bench34 口径同 seed);进既有件包络(≤~20s)→ FRACTAL_WEIGHTS mandelbulb 0→2(五分路由自动伸缩,消费恒定);不达标→如实留 0 报告数据。**验**:达标则符号探针/切片守卫/样张 4 枚 → `~/Downloads/genlab-bulb-batch22/`;683→实跑。

### Task 4: 收卷
全量回归(683→终值)+ 300-hash 保真流复检(废片/兜底/时长,重点 closeup 兜底率与新压限生效面)+ 样张总批 16 枚 → `~/Downloads/genlab-quality-batch23/`;sdf-main:style-plan.json 同步(COV_COMPACT 统一名单/closeup 参数/mandelbulb 权重终值)+ AGENT_HANDOFF §0.6,分支 push + `gh pr create` **不 merge**;README/memory。**STOP 呈裁**:统一压限名单/closeup 修后观感/mandelbulb 判决/batch20-23。

## 工程纪律
双门审查;卷末 opus 终审;渲染零筛选;fix loop ≤5;执行序 T1→T2→T3→T4(T1 的统一名单先落,T2/T3 在其上)。
