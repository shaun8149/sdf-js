# DIMENSION 4D 影雕卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定:user 2026-09-15 四问全按推荐圈定(设计诊断 `.superpowers/sdd/2026-09-15-dimension-4d-shadow/design-draft.md` + USER 终裁节)。
> 设计核(user 逐字):"四维的世界,它的影子是一个 3D 的物体……重点要描绘这个影子,才能够把这个 4D 的感觉描绘出来";"不要想表达得太多,要做减法"。

**Goal:** 4D 影雕落成——**shadowfall 第六构图型**(场内上下:影雕落地为碑+切片悬浮其上,一板一真场景,四板扫双旋转角 θ,地面 2D 长影自动 = 一板之内 4D→3D→2D 降维两跳全入画)。

## Global Constraints

- 岛铁律全套:同 hash+同时刻+同 mintTime→逐位同;禁 Math.random/Date.now;消费恒定(既有 roll 序一字不动+尾部恒 roll 追加);链零 URL;minified 件/key.txt 不碰;测试实跑;基线 = f190bdc (1752)。
- user 终裁四条:①拼板语法 = 场内上下 shadowfall;②型别配比 影雕 60:切片 40;③池表 对偶柱45/cell8 25/cell24 15/cell16 10/cell5 0/glome 0,切片型 glome 25→15;④美学三件套全认(影雕色=T2 影色四档同源偏深一档/影雕素面零白零 rim/整板纹样钉耳语档)。对偶柱参数族:不等径 ρ∈[1.25,1.7] 70% + 等径 30%。
- 性能门禁(spike 制):真管线 csize=256 外推法,影雕板 ≤ cell24 切片基准 1.2×、整件 mint ≤20s;超支即回炉(数值参数/早退半径),不许带病转正。
- 减法纪律:影雕型内切片 w0 定死不扫(一板一扫轴);L 恒取 w 轴(对偶柱双平面旋转不变 ⇒ 影家族仅 θ 一参)。
- sdf-main 附属走 `genlab-4d-shadow` 分支 PR 不 merge。

### Task 1: 数学底座 + 性能刀
①lib4d `sdf4_duocylinder` 三处 `Math.hypot`→sqrt 化(V8 陷阱,切片 ratio 2.21→1.11,免费省半,入池前必做,逐位等价锁);②影雕 SDF 三路径落地:对偶柱 = 数值 min-t(粗 6+金 6+包围球早退;bench 1.81×)、正多胞体(cell8/16/24)= 装配期顶点投影+3D 凸包 max-planes(精确,bench 1.36×)、θ=0 闭式 capped-cylinder(r1×半高 r2)= 回归锚(user"轴向光影=实心圆柱"铁证句的数学本体);③1-Lipschitz 守卫论证入注(min 族保 Lipschitz,球追踪安全);④真管线 spike 门禁实跑(csize=256 外推:影雕板 vs cell24 基准 ≤1.2×)。符号探针+切片非空+锁全套。

### Task 2: shadowfall 构图型(scene35 内长出)
一板一真场景 sceneSdf = min(切片体, 影雕体):影雕落地为碑(y 落地),切片悬浮其上;四板 θᵢ 纯算术展开(w0 机器同法,I1/I2 教训继承:真实跨度量测+相位偏移);Muybridge 恒定律保留(唯扫轴 w0→θ);型别窗 单 roll 60:40(影雕/切片);池表字面(对偶柱45/cell8 25/cell24 15/cell16 10/cell5 0/glome 0 影雕池;切片池 glome 25→15 字面刀);对偶柱 ρ 参数族 roll;尾部 4-5 无条件恒 roll(型别/θ 档+相位/ρ);既有 roll 序一字不动(消费恒定锁+双树对拍)。地面 2D 长影 = 既有影子射线自动(零代码,验证有即可)。traits:Composition 第六值 shadowfall + Polytope 更新(曝露细节与 C3 挂账合并列 T5 呈裁)。

### Task 2′: shadowfall 构图重做(user 2026-09-16 终裁"确实 B 加 C",排 T3 后)
拼 4 对影雕型退场,改**单板全幅**:**B 双影对峙**——悬浮切片 + 两座正交影碑(对偶柱 = θ=0 闭式躺柱 × θ=π/2 闭式立柱;胞体 = 双姿态 hull,如 cell8 立方碑×菱十二碑)+ 各拖 2D 长影,sceneSdf=min(切片,碑A,碑B);**C 活画翻滚**——一碑 θ 挂墙钟连续翻滚(chrono 既有管线),归档态 hash 派生角定格。A 轨迹碑不做。T2 的 θ 机器复用为双碑两角+活画轴;切片型 40% 拼 4 照旧;消费恒定(θ 序列 roll 复用/重排披露);性能(单场景三实体 vs 四板,预期更便宜,spike 复跑);样张 12(双影对峙全谱/翻滚三时刻/胞体双碑戏剧对)。

### Task 3: 影雕美学接线
①影雕着色 = T2 影色四档同源偏深一档(selectShadowRing 同侧流派生,碑与自己的 2D 长影同色相不同深——"这块碑就是影子"颜色自证);②影雕素面:零白零 rim(白光两情境门对影雕面构造豁免=不适用,rim 增益跳过影雕体;点彩织谱质地照常);③整板纹样钉耳语档(wpTier 对 shadowfall 板确定性重映射 tt,消费恒定);④切片体照常吃恒星光色+耳语纹+侧白。交互表:与 T6 光谱/两情境门/夜窗/GOLD3 逐条恒等或豁免论证。

### Task 4: 重基线 + 4D 专项体检
t4 池昼夜双轮(4D 行全变归因 shadowfall/池表/glome 降权;2D/3D 逐位 SAME)+ **定向掺入**:≥2 枚 shadowfall 命中件入冻结池(终审 C1 纪律);200-hash 4D 专项扫(型别率 60:40 实测/池分布/θ 档分布/渲时 max ≤20s);样张 16+(对偶柱翻滚四板全谱×2/cell8 立方↔菱十二影×2/θ=0 圆柱铁证锚×1/2D 长影两跳可见特写×2/影色同源对照×1/全型混合)→ `~/Downloads/genlab-4dshadow-t{n}/`。

### Task 5: 收卷
全量回归;batch49 200 张总验收(全库口径,4D 8% 下 shadowfall 期望 ~10 件);sdf-main style-plan(panels_split 让位/型别窗/影雕池/θ 机器/美学三则)+ §0.6 + plan 入库 + PR 不 merge;README 影雕卷节;opus 终审;STOP 呈裁(θ 档观感/ρ 族/影雕:切片实测复核/traits 曝露方案与 C3 合并)。

## 工程纪律
双门审查;卷末 opus 终审;fix loop ≤5;执行序 T1→T2→T3→T4→T5;样张全进 Downloads;dev 8003/8004 绝不动 8002;agent 前台轮询防看门狗;报告增量落盘。
