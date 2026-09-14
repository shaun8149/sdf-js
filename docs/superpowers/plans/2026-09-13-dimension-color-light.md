# DIMENSION 神庙光提频 + 色彩体系卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定:user 2026-09-13 batch45 审后两向令 + 诊断呈裁全按推荐圈定(ledger 2026-09-08 卷尾三条终裁)。
> 诊断依据:`color-light-design-draft.md`(800-hash vm 快扫 + batch44/45 重放 + 84 套 census + AutoScope 解剖 + Qilin textureClrs 读源)。

**Goal:** ①神庙光观感提频 ~4×(封神配方 2.0→~7.8% scene34 内);②3D 影色分离+色相守卫(治"影死灰"+"同暖糊片 13.1%");③纹样色角色化 2D+3D(Qilin 三律,恒墨退场)。

## Global Constraints

- 岛铁律全套:同 hash+同时刻+同 mintTime→逐位同;禁 Math.random/Date.now;消费恒定(新档独立侧流或纯派生零 roll;post-roll 重映射合法先例);链零 URL;minified 三库件/key.txt 不碰;测试实跑;基线 = Edifice 等窗刀落地后 HEAD。
- 观感变化 = pre-mint 合法;**重基线合并**:T1/T2/T3 同吃 3D 着色面,合并一次冻结;T4 带纹件面独立一次。
- user 终裁精神:"我们毕竟不是自然景观,而是艺术……背景色跟前景物体的颜色要有非常强的对比,要不然很容易糊,因为我们都是点。"
- 样张纪律:一切渲染产图同步拷 `~/Downloads/genlab-colorlight-*/`。
- sdf-main 附属走 `genlab-color-light` 分支 PR 不 merge。

### Task 1: 神庙光提频三连(K2+K3+K4)
K2 GOLD3 权重回摆 0.40/0.35/0.25 → **0.55/0.27/0.18**(gold 回主位,字面一刀);K3 **构图-时刻联动折叠**:碑式四型(monument/colossus/anchor/avenue)平光带折进斜光带(chronoStrongTLight 同式,纯派生零 roll,**全折版** user 已点头 t=12 观感变化面 ~64%);K4 **神庙 palette 提频窗**:金色带×碑式件 15% 概率重映射到暖亮金底名单 18 套(独立侧流恒耗,重映射不改 roll 结构;暖亮判据 = 诊断 §1 字面)。锁:三档权重字面/折叠曲线不动点/提频窗边界+统计。样张:同 hash 折叠前后对照 + 金色带碑式 6 张。

### Task 2: M1 影色分离(3D 全场景)
影环从中性灰压暗改为**向 bg 补色/冷色偏移**:四档 hash 派生——蓝影/紫影/补色影/灰影(灰影低权重保留,尖叫与耳语并存先例);第十四方独立侧流 1 roll(⊕新常数,与既有十三方两两互异 grep 锁扩容);影色强度随影深渐变(近影浓远影淡);夜窗早退(夜有自己的光影语法不动)。修拉点彩正统:影是蓝紫补色不是暗棕。锁:侧流互异/夜窗恒等/灰影档可达。样张:同 hash 四档影色对照。

### Task 3: M2 ΔHue 守卫(+全量重基线合并)
迷彩守卫(applyPal3dContrastGuard34 先例)加**色相门**:bg↔物体主色 ΔHue<30° → 确定性推开(OKLab/HSL 色相旋转至 ≥阈,方向 hash 派生自守卫既有流,零新 roll);触发面 ~13.1%(诊断实渲配对数);与既有 ΔY≥46 门叠加判。**T1+T2+T3 合并全量重基线一次**(t4 池 vm 预测受影响行 + 浏览器昼夜双轮对拍,kusama 转正笔同法)。锁:色相门阈值字面/推开确定性/守卫先后序(纹样/彩缎/砖砌 atlas 存槽解码吃守卫后色恒等)。

### Task 4: M5 纹样色角色化(2D 十族主战场 + 3D triplanar)
恒墨退场,Qilin 三律运行时版(读源定论 textureClrs 机制,recipe-only):纹色只取**墨/纸/accent 三角色**——①明度翻转律:暗层→纸色纹(画布底色系),亮层→墨纹(全画墨线色);②tone-on-tone 耳语档:同层色深浅一档(低对比,防全幅尖叫碎裂);③accent 贯穿档(稀有):金系纹扫全幅(与保金/黄昏金/GOLD3 并轨)。档位 hash 派生(WP 侧流扩槽恒耗或纯派生自层亮度,实现者论证后择一呈审);2D 十族全档吃;3D triplanar 同规则,纹色角色**吃迷彩+ΔHue 守卫后色**(atlas 存槽解码先例)。锁:三角色色值来源恒等/翻转律边界/耳语档对比带/守卫先后序。样张:2D 三律逐档对照 + 3D 带纹件前后 + 同 hash Qilin 感对标图。

### Task 4b: 纹样三原则细化 + Qilin 全族补齐(user 2026-09-13 Qilin 四纹样参考图令 + 全族令)
**④ 扩族 +5(user"Qilin 有的我们全部实现一遍")**:vines 蔓藤(user 点名"像小麦的",麦穗状短枝对生小叶,参考图深蓝块高频族)/crossHatch 交叉网纹/dots 点阵/woodFlowers 木花/stars 星纹(麻叶近亲但形不同)——族库 10→15;recipe-only(机制级自写零抄码零色值);WP_SEM_TAGS 268 键语义表与加权白名单为新族扩列;族池加长零 roll 结构影响(先例)。
2D 十族三调整:①**线更细+更多线**(user"纹样太粗了,不美观"——各族线宽降/线密度升,族内常量逐族过样,3D triplanar 密度联动审视一并出样);②**每件 ≥2 族**(user"一般只有一种,是不够美的"——带纹层选择数提升,双边门参数复核,目标典型件 2-4 族可见);③**同族跨区**(user"跨区域出现是最美的"——旧"同件不重样"改为族多样性+同族跨区并存:至少一族在 ≥2 个不相邻层重复,Qilin 同纹多补丁语法)。消费恒定(选层/族 roll 结构改动须整改+入全卷重基线);样张前后对照批 12+。**全卷合并重基线**(T1+T4+T2+T3+T4b 一次冻结,昼夜双轮,T3 处叫停挪此)随本任务尾执行。

### Task 4c: Kusama 圆语法 QQL 化(user 2026-09-13 看样令;源码已读 qql-art/qqlrs art.rs, Apache-2.0, 控制者精读定论)
QQL 真机制(qqlrs art.rs:390-458 BullseyeGenerator + :1555-1610 draw_ring_dot):**每圆 = (rings, density) 二元组**——rings∈{1,3,7}(件级 trait 圈定候选集,几何衰减加权抽样,空集回落 2);density~Gauss(件级均值,方差/2) 钳 [0.17,0.93];**厚薄由 density 单轴统一控制**:band_thickness = band_step×(1−density),件级三档 Thin(0.85)/Thick(0.28)/Mixed(0.7,方差 1.0 全谱);**同心** = 半径按 scale/rings 等距递减逐环画,**双色交替**(primary/secondary);**实心盘 = 小圆+单环特例**(r 小时 thickness→r 自动闭实)+ 大单环防肥甜甜圈钳制;**邻近圆继承**:spec 沿构图传播时 density×gauss(0.99,0.03) 微扰(件内统一件间异)。
DIMENSION 移植(机制级自写,虽 Apache-2.0 仍守零抄码,attribution 头注):**件级 BullseyeGenerator idiom**(件级单 roll 定 rings 候选集+density 档,逐圆从件分布抽——替代"逐圆独立五档"设想,件内风格统一);rings 候选 {1,2,3,5}(我们圆径谱比 QQL 小);双色交替吃既有 palette 派生圆色池;实心小圆特例照搬机制;fill-a wash 保留为第五态;KU 侧流恒耗扩槽;网只在背景/物外不变。比例 draft 呈裁。CP 行小面增量重基线。样张:三新档特写各 2 + 混合全景 2 + 前后对照 1 对 + QQL 参考对标页(~/Downloads/qql-reference/ 6 张官方图已备)。

### Task 5: 收卷
全量回归;200-hash 体检(神庙配方率实测 vs ~7.8%/影色四档分布/ΔHue 门触发率 vs 13.1%/纹样三律档分布);batch46 样张总批 → `~/Downloads/genlab-dimension-batch46/`;sdf-main style-plan(gold3 权重改/light_shadow 折叠+影色节/pattern_system 纹色三律节)+ §0.6 + PR 不 merge;README;STOP 呈裁(影色四档权重/耳语档对比带/accent 档出现率/K4 名单 18 套/M3 血统问题留下卷)。

## 工程纪律
双门审查;卷末 opus 终审;fix loop ≤5;执行序 **T1→T4→T2→T3(合并重基线)→T5**(user 2026-09-13 令 T4 提前;T4 先行时纹色角色暂吃迷彩守卫后色,T3 落位后补一道"纹色吃 ΔHue 守卫后色"恒等验证,列 T3 验收清单);起卷前置条件 = Edifice 等窗刀(ED_WIN_HI 0.40)已落地,基线以其 HEAD 起算。
