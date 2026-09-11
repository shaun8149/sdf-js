# DIMENSION 3D 构型扩容 + 2D 墨线装饰卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定:user 2026-09-08 batch43 审后两向令——"3D 品类不够丰富,构图和光已经很好,构型不够,按推荐 1+2 扩容";"2D 白天平坦需要装饰,走抽象不走具象",两参考对比后控制者判 Sudfah 胜出(Quine 自指魔法不可移植、网格与既有纹样撞车)。

**Goal:** ①3D 遗址建筑语汇包(8-12 新 kind)+lifted 语料二次策展(15-25 件复捞);②2D 白天墨线装饰层(Sudfah recipe-only:抽象书法长线+晕染事故区);③#40 Decay Row 38s 慢渲诊断随卷。

## Global Constraints

- 岛铁律全套:同 hash+同时刻+同 mintTime→逐位同;禁 Math.random/Date.now;消费恒定(池加长不改 roll 数/新装饰独立侧流);链零 URL;minified 三库件/key.txt 不碰;测试实跑;基线 DIMENSION 6d2fa37(1293/1293)。
- **recipe-only**:Sudfah 源码(~/Documents/artblocks 下查 #328)license 先判,预期最严档——扫描式笔触/遮罩变径模糊/事故区习语自写,零抄码零调色板;deep-dive 04 精读已备。
- 新 kind 全进 scene34 既有五分路由池结构(消费恒定);20s 单渲红线(#40 诊断先行厘清口径)。
- sdf-main 附属走 `genlab-form-inkline` 分支 PR 不 merge。

### Task 1: 遗址建筑语汇包
scene34 新 kind 8-12 件(布尔组合既有原语,填充八件先例,每件 15-30 行):阶梯金字塔 ziggurat/门阙 gate/断柱残墙/石阶祭台/方尖碑群 obelisk-row/穹顶残骸 broken-dome/牌坊 archway/其余脑洞自选;逐件符号探针+切片非空+8s probe 预算门;AVENUE_ASPECT 表补新 kind;traits Forms 扩;样张逐件。

### Task 1b: 「对比锚」构图型(user 2026-09-08 参考图令)
scene34 新构图:近景巨 kind 压画缘只露局部(暗部重织纹)+远景窄高 kind 雾中(近实远虚)+地平线极小直立形尺度锚(抽象小碑,非具象);三尺度层级;权重从既有表让(draft);消费恒定;品相守卫级联;样张 6。排 T1 后(同文件串行)。

### Task 2: lifted 语料二次策展
demo-lifts 217 件重审(现有纹样/彩缎/神庙光加持下二次对抗审"立不立"),目标 +15-25 件入 LIFTED_POOL;当年性能退避件(火箭/教堂)复测(排水预算+worker 后);链体量增量如实报;样张批。

### Task 3: #40 慢渲诊断 + 红线口径
0x…(batch43 #40, Decay Row monument 38s)专项 profile(probe vs 排水 vs 衰变粒子);修法呈裁(预算门控/构图帽/接受);**红线口径正式化**:单渲 ≤20s 为契约、并发批渲为工具口径(呈 user 追认)。

### Task 4: 2D 白天光治方案(user 2026-09-09 终裁, 墨线搁置候补)
**A′ 受光云系统**:白天风景天空区 hash 派生云彩(2-4 朵,层云/卷云形),受光面判定=太阳方位(T_2d 光位驱动),受光缘金/红、暗部蓝灰(palette 协调);时段色温联动(晨红金/午白金/昏烧红=朝霞晚霞入活画轴);出现率 draft(~60% 白天风景呈裁);消费恒定独立侧流。**A″ 流场淡彩 25%**:天空区极淡流带卷云(Fidenza 系 2D 化,强度极低不喧宾)。**B 主题池 warp**(已裁,进行中)。dev 原型出样呈裁再转正;样张含时段三连(朝霞/正午/晚霞同 hash)。

### Task 4-old: 墨线(搁置候补,代码已剥离归档)
白天风景/物件留白区 1-2 条抽象书法长线(扫描式笔触:笔锋变宽变细,弧线横贯)+ 事故区(遮罩调制变径模糊/晕染/飞溅点)+可选划痕;墨色=palette 派生(墨/金双模 draft);独立侧流消费恒定;概率 draft ~40% 白天件(夜件不加——夜有灯);与纹样/warp/金昏共存关系论证;dev 原型先行出样呈裁再转正(pattern-ext 先例)。

### Task 4b: 夜景强化(user 2026-09-08 审图令)
①**2D 灯光洒光**:夜灯/暖窗光从"晕圈"升级为"照明"——radial 大半径软衰减调制周围底色(墙面/地面被真实照亮),确定性零 roll,幅度 draft;②**3D 夜空星座**:夜泛光档深暗天空 hash 派生抽象小星座 1-2 个(5-8 星连线,独立侧流,做减法);③**夜地面保暗**:映金只给建筑主体,地面近黑(明暗对比=夜的骨架,user 审图令);④**光束渲染**:泛光灯光锥可见(灯位向上体积光束,确定性零 roll,强度 draft;顺带治大正面单调——光束热斑落在正面)。与既有夜灯/泛光的消费恒定与重基线级联。样张前后对照。

### Task 5: 收卷
全量回归;200-hash 体检(新 kind 分布/墨线出现率);样张总批;sdf-main style-plan+§0.6+PR 不 merge;README;STOP 呈裁(新 kind 品相/lifted 复捞名单/墨线观感与概率/红线口径/seamap 处置提醒)。

## 工程纪律
双门审查;卷末 opus 终审;fix loop ≤5;执行序 T1→T2→T3→T4→T5(T3 可与 T1 并行早做)。
