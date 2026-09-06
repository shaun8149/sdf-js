# DIMENSION 纹样体系卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定:user 2026-09-06「开工开工」全案圈定(qilin-study-design.md 全采纳)。设计正文=
> DIMENSION `.superpowers/sdd/2026-08-31-dimension-living-painting/qilin-study-design.md`(逐字为准)。

**Goal:** 纹样 3 族→10 族(鳞文/流水/立涌/七宝/霞/龟甲/等距晕新增)+ Qilin 三机制(面积双边门控/语义白名单加权/磨损层)+ 扩面转正(2D before/after 40%、3D 33% triplanar、themes 豁免、warp 维持全带)。

## Global Constraints

- 岛铁律全套:同 hash+同时刻+同 mintTime→逐位同;禁 Math.random/Date.now;消费恒定(WP 侧流模式,roll 数恒定,加权抽=同一次 r() 过前缀和);链零 URL;minified 三库件/key.txt 不碰;测试实跑;基线 DIMENSION e074a21(1045/1045)。
- **recipe-only 铁律**:Qilin 源码 CC BY-NC,机制层学习零抄码,实现全自写;系谱差异声明保持(明暗调制,不采独立色替换——LLM 配色语义铁律)。
- 非目标面零扰动:warp 既有三族行为、theme/neon、3D 背景地面——各任务逐位/构造性证明。
- **重基线一次冻结一次重跑**:T3 所有 2D 面改动(40% gate+双边门+新族+语义表)合并后做唯一一次全量重基线;T4 3D 同批。
- dev 实验痕迹(`__wpExt3d` 门等)在 T3/T4 转正时剥离或转正,不留第三态。
- sdf-main 附属走 `genlab-pattern-system` 分支 PR 不 merge。

### Task 1: 族扩容 + 磨损层
fx2d.js 新增场函数:鳞文/流水纹/立涌/七宝(必上)+ 霞/龟甲 + 等距晕(实验族,样张单列呈裁);WP_SCALE 常量族表;磨损层(场值叠 hash 反啄门,低幅,独立开关 draft)。锁:逐族场确定性/值域/周期 + 磨损确定性(+~12)。逐族样张 8 枚 → `~/Downloads/genlab-pattern-t1/`。1045→实跑。

### Task 2: 语义三层
WP_SEM_TAGS(pieceId→tag 硬编码 curated 表,库件逐 id 过目,~百行)+ WP_SEM_WEIGHTS(design doc §三 draft 表按最终入选族裁列)+ 加权单 roll 前缀和抽族 + Focal 轮转不重样 + generic 均权兜底。锁:死键(表中 pieceId 必存在于库)/权重非零/roll 恒定/加权抽确定性。warp 件行为=既裁语义超集(重基线随 T3 合并)。

### Task 3: 2D 扩面转正(唯一大重基线)
ext 原型 monkey-patch→链内正式集成:before/after **40% gate**(WP 侧流)、themes 豁免、**面积双边门控**(draft [3.5%,55%],最大层恒素面——warp 面同步补门)、新族+语义表全接入、dev 门痕迹剥离。**全量重基线一次**(t4 池 2D 面),九桶复核;非 2D 逐位。样张 12 枚对照。

### Task 4: 3D 转正
probe 透 normal + **triplanar** 混合(掠射拉丝根治)+ 并入 applyScenePostprocess 单 probe(性能 A/B,双 probe 消除)+ **33% gate** + poisson 档接入 + kind→tag 复用语义表。3D 面重基线;背景/地面/2D 逐位。样张 8 枚(triplanar 前后对照含)。

### Task 5: 收卷
全量回归终值;100-hash 体检(九桶+纹样出现率实测 vs 40%/33%/warp 全带);batch 样张总批(三面×新族配额,轮盘零偏爱)→ `~/Downloads/genlab-pattern-final/`;sdf-main style-plan(纹样体系节:族表/语义表/门控/出现率)+ §0.6 + PR 不 merge;README;STOP 呈裁(磨损层开关/等距晕去留/双边门参数/样张品相)。

## 工程纪律
双门审查;卷末 opus 终审;fix loop ≤5;执行序 T1→T2→T3→T4→T5(T3∥T4 可并但重基线各自独立面)。
