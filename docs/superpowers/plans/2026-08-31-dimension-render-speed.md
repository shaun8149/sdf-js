# DIMENSION 渲染性能卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定:user 2026-08-31"4D 最坏 59 秒完成不太行,一定要处理掉"。目标:**最坏 time-to-$renderOK ≤20s**(现 4D max ~57s+扫 2.6s;neon 53s;3D p90 23s)。

## Global Constraints

- **输出逐位不变是硬验收**:并行化只改墙钟不改任何像素/checksum(同 hash 同 mintTime 同时刻,优化前后 canvas sha256 逐字节;全 tier 代表 hash 矩阵)。禁降分辨率/降迭代/降质量。
- 岛铁律全套:禁 Math.random/Date.now(worker 内同);r() 序不变;链零 URL;三处同步(新 worker 文件如需);minified 三库件/key.txt 不碰;测试实跑;基线 DIMENSION 818df8a,844/844。
- **Worker 纪律**:worker 代码来自链文件自身(Blob URL 装配同一批链文件,零外部依赖);无 worker 环境优雅回退串行(行为逐位同,仅慢);worker 数由 hardwareConcurrency 派生但**分块边界确定性**(块划分与结果拼接顺序与并发度无关——静态分块,不许动态抢任务导致浮点归约序差异;probe 逐像素独立无归约,天然安全,论证写明)。
- sdf-main 附属走 `genlab-render-speed` 分支 PR 不 merge。

### Task 1: profile + probe 并行化(3D/4D 主战场)
先 profile:57s 的 4D 件与 23s 的 3D 件时间都花在哪(probe 逐像素 SDF 求值 vs 织线落笔 vs 其他),数字定音。实现:probe 场计算移入 worker 池(拼板按板分块/整幅按扫描带静态分块;主线程收结果拼场后织线照旧);逐笔 generator 观感保持(probe 先行并行算完,织线排水照 T2 节奏)。验收:全 tier 代表 hash ≥12 枚优化前后 canvas sha256 逐字节 + 消费恒定 + 844→实跑;**时长矩阵**(同机同批):4D 拼16 重件/3D 重件 前后对比,目标该路径 ≥3× 提速;无 worker 回退路径逐位+慢速实测。

### Task 2: neon 并行化 + 长尾清扫
neon 53s per-pixel 辉光同法 worker 化(逐像素独立);2D weave 若 profile 显示热点顺手;逐笔/日扫/时钟活层时序在 worker 下复核(renderOK=落定语义不变)。验收同 T1(neon 代表 hash 逐位+时长)。

### Task 3: 收卷
100-hash 时长分布刷新(mint-snapshot 口径):**max ≤20s 达标判定**,未达标如实报告剩余长尾与下一刀概算;全量回归 844→实跑;样张免(逐位不变无观感变化);sdf-main style-plan(性能节)+§0.6+PR 不 merge;README 性能行更新。STOP 呈报(达标数字/未达标余量)。

## 工程纪律
双门审查;卷末 opus 终审;fix loop ≤5;执行序 T1→T2→T3。

## T3 收卷勘正注记(2026-09-01,前两卷审查遗留记账)

1. **T1 验收句「无 worker 回退路径逐位+慢速实测」语义空转勘正**:T1 经 profile 定音
   (重件墙钟 71-77% 是逐帧排水节拍的帧间空转,非 probe CPU)后转向**排水节拍时间预算制**
   (`DRAIN_BUDGET_MS`,零 worker),该验收句在 T1 不适用(无 worker 可回退)。worker 在
   T2 才引入(neon/weave 计算型长尾),其回退语义由 **T2 四重门控串行回退**满足并已验:
   vm / 同步 wrapper / 评测口(pa.animation=false)构造上恒串行,池死/池慢由主线程合围
   兜底收满(无墙钟无停滞判定,行为逐位同、仅慢)。
2. **基线计数勘正**:plan 写「基线 844/844」系 T1 开卷态(818df8a);T1 +5 → 849,
   T2 +20 → 869。T3 全量回归口径为 **869→实跑**(非字面 844)。
3. Task 1 原案「probe 并行化」未按字面执行——数字定音后修法改为排水时间预算制
   (user 指令「方法跟 profile 走」),probe worker 化留作长尾再判(T3 实测后未再需要)。
