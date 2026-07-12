# 2026-07-12 — SpatialPlan 提案对抗讨论合议记录

> **背景**:user 判定 3D 端缺空间组织框架("翻页式组织 3D 空间是不对的"),提出三点需求:
> ① 组织空间 ② 在空间内排布 3D atoms ③ 用类 ArtBlocks 艺术代码修饰空间(排布/对齐/对比/艺术元素)。
> 工作 agent 提出三层框架(SpatialPlan IR / 排布系统 / 3D decor)+ 三个决策(①替换 assemble-deck
> ②zone 由 2D 大纲驱动 + 契约三字段 ③Phase 1 = courtyard)。user 要求先跑 3-5 轮对抗讨论再计划。
> 实际执行:4 轮定向攻击(总前提 / 决策① / 决策② / 决策③)+ 1 轮合议,9 个 subagent,
> 攻击方与裁决方均直接核查 repo 代码,16 条攻击 16 个 partial,合议改判 3 处。
> **结果**:决策①打穿、②原则站住请求延后、③spike-gated 幸存;总框架重奠基为"为镜头组织空间"。
> 后续 spec/plan 见 `docs/superpowers/specs/2026-07-12-spatialplan-phase1-spec.md`。

以下为合议员原文。

---

核查完成(抽查了 assemble-deck.js 的不旋转不变量/DECK_LAYOUTS/id 正则/HILLS_PER_WINDOW、ir.js 的 STRUCTURES 六元组、studio.js 的整帧 renderMode 回退、analytic.js 的 SUPPORTED 集合——裁决方引用的代码事实全部属实)。以下为最终合议。

# SpatialPlan 提案最终合议

## 0. 改判声明(与裁决方结论不同之处,附理由)

- **改判一:总前提攻击 4("5 核↔Ching 一一对应是修辞巧合")从 partial 升格为落地。** 裁决方自己写明"该论证应从提案删除、courtyard 只能独立立论",这就是攻击的全部核心诉求;partial 只反映驳回了"courtyard 被拖下水"这个过度推论。诉求全部落地的攻击应归入落地类,过度推论单列驳回。
- **改判二:决策① 合并定性为"被打穿"。** 裁决方四条 partial 各自留了面子("rhetoric 降温不等于方案作废"),但四条成立半边叠加后,决策①的三个字面主张——一步替换设计半边、DECK_LAYOUTS/stationOrigins 作为 API 死掉、SpatialPlan IR 先行——无一存活。把结果称作"内部重构 + 增量"是保留方向,不是保留决策;合议直说打穿,给替代方案(见第 4 节)。
- **改判三:决策② 裁决 3 的"非连续 sectionId 纯形式解"从"已解决"降为"形式合法、观感未验证"。** zone=无序集合 + promenade 允许重入 zone 确实避免了 3D 做语义裁决,但用户调序后 promenade 反复穿越同一庭院的空间叙事是否还可读,恰是本提案的产品目标,不能用形式合法性遮掉。移入开放问题(第 5 节)。

其余裁决维持。裁决方的代码核查质量高(数字全部实跑复核),未发现事实性误判。

---

## 1. 落地的攻击(提案必须修改)

1. **"性能路径已躺好"是假的**(总前提攻 2 + 决策③攻 4 追击)。analytic 是整帧互斥模式(studio.js 1888-1901,失败整帧回退 stone),不存在"激活站全料 + 远站白模"混合路径。修改方向:删掉这句话;性能故事改写为 **zone-massing-in-leaf-budget**——每章 1-2 块合并体量(SDF 域重复优先,procedural-city 先例),走独立 id 前缀**永不按距离裁剪**(现有裁剪按最近优先,对 massing 语义精确反转:会先扔掉伏笔回收需要的远侧块),地平线石板名额联动缩减(slabs = max(0, 6 − massingLeaves))守恒每窗口 dressing 预算;中心纪念碑 leaf 成本第一周在 laptop GPU 实测定价,定价前不得宣称性能成立。**landscape/地形框(地形遮挡=天然 window 边界、高程差=免费 vista,资产已 ship)作为正式对照方案进 Phase 1 评审,不是脚注。**
2. **"5 核↔Ching 一一对应"论证整体删除**(改判一)。代码里的现实是 STRUCTURES 六元组(内容结构)+ DECK_LAYOUTS 三样;对得上的三对恰是已 shipped 老三样,Layered↔组团式语义相反、Ring 在 Ching 五型无席位。courtyard 直接以"中心式组织"独立立论(它本来就是教科书形态),不借血统。同时必须补"内容结构→空间类型"显式映射表或承认退化路径(matrix/hold/magnitude 无自然席位)。
3. **"vista 是反翻页的核心机制"降级**。改为:vista 是**由镜头语法在 crane/transit/threshold/finale 消费的素材**,按镜头需要供给;hero/super/payoff 的封闭竞技场感不得稀释。框架表述从"为居住者组织空间"改为**"为镜头组织空间"**(production design 视角)——观众无行动权,空间感由镜头与剪辑中介。
4. **决策① 原文打穿**(改判二)。"compilePlan=transplant 机器换喂法"被数据流证伪(clock/transit 位姿/windows/hideAt 全部依赖 renderIR 之后才存在的量,时间合成只能住编译期);"退一步替换 API"被 wrapper 悖论与 23 文件消费面否决;IR 在替换时刻只有 1 个非退化消费者,是过早抽象。替代方案见第 4 节。"留两条管线违反铁律"的论证删除——铁律禁平行管线,不禁单管线内加 layout 分支。
5. **决策② 的契约三字段请求打穿、延后。** Phase 1 语料 bytedance-bp 是手工 IR deck,根本不走契约路径,盲测无论胜负对字段设计零覆盖;15 个 ammo 零章节字段,2D 产 outline 是跨端新 feature 非透传。修改方向:v1 zone = planSpace **内部概念**,在 IR 层手工标注开工;§9.5 只发带证据的问题,待盲测 + 至少一个真走契约路径的 deck 后再提字段。届时字段收敛为**单一真相源**:deck.outline 唯一权威,sectionId 是对 outline id 的引用(悬空引用=跨字段 WARNING),**role:divider 删除**(可由 outline 边界推导),**"体量均分"退化删除**(零信号下均分=3D 凭空发明章边界,是提案自己反对的路线 (a) 的极端形式);退化梯级 = outline → 结构邻接(标"弱分组",vista 承诺降强)→ 单 zone。
6. **role 语义重写为 hold 站之上的放置/镜头修饰符,不是站的删除。** 原语义(封面=入场飞行、目录=overlook 一镜)与 §9.5-3 hold 站计划("让 3D 页数与 2D 对齐")及 Phase 1 语料自己的用法(bytedance-bp 封面就是 hold 站)正面矛盾。重写:cover = hold 站放世界入口,toc = hold 站放 overlook 点 + agenda 内容走 DOM overlay,appendix = hold 站放档案层。消费语义(渲不渲 sceneData、内容去哪)必须写进契约文档才允许发请求。
7. **hold 站前置依赖必须显式声明。** 48% slot→station 衰减是现状(实跑:funding-round 8→3,vc-pitch 9→5),zone 契约字段在真实语料可用的前置是 hold 站先 ship(此后 slot 空间与站空间重新同构);正确顺序:hold 先行或与 zone 消费同 PR。另补**部分衰减重映射规则**:空 zone 的确定性处理(并入相邻 / 移除并重排 promenade / hold 回填),vista/伏笔承诺显式以"zone 非空"为条件。
8. **决策③ 承诺文本重写。** "任意时刻回头可见全局"被朝向几何结构性证伪(不旋转不变量 + 五拍全部 -z 视线,θ≈180° 站全程背对中庭)。改为**"在指定镜头时刻(transit/threshold/turn-back/overlook/finale)可见全局"**;解法 = assembleDeck 合成的世界坐标镜头本就任意取向,courtyard 分支合成朝中庭的镜头,零几何旋转、零 EXPR 改动;朝向问题作为已计价工作项写进 Phase 1。
9. **决策③ 语料与 gate 修正。** 理由 (ii)"语料合身、qbr 同构"在当前分布为假(0/15 达 8 站,qbr 实测 5 站零章节),删除或改写为"post-hold+outline 的目标分布合身";8-12 页锁与自选 13 页语料自相矛盾,改 8-13 或换语料;显式声明 **Phase 1 = thesis 验证(温室手工 IR),产品部署 gate 在 hold 站 + 2D outline 两个前置上**;每 zone≈1 站的塌缩情形下检测器必须拒绝 courtyard、退化到 radial(这是正确行为)。
10. **盲测实验设计重写。** (a) baseline 必须是已 shipped 的 **radial** 而非 line(否则混入"环形 vs 直线"这个已 shipped 差异);(b) 双臂 **decor 对齐**(同等 Layer C 预算);(c) 结论宣称范围锁定为"courtyard 体验 > radial",不得引申为"Layer A IR 有效";(d) 任何重构前先对三个 layout 各存 **golden snapshot**,等价性过关才允许 A/B。

## 2. 变成设计约束的攻击(partial)

1. 观众无行动权 → 一切空间组织决策以"哪一拍镜头消费它"为验收标准;读不进任何镜头的空间结构不做。
2. SpatialPlan(日后若做)必须定义为**时间无关的纯空间 IR**(zone 几何/origins/promenade 曲线/vista 点/取景 hint),全部时间绑定与依赖渲染产物的位姿合成留在编译期(lowering pass)。
3. sliceDeckWindow 的 `/^s(\d+)-/`、`/^path-(\d+)-/` id 前缀约定要么逐字保全、要么升格为显式契约字段;23 文件消费面清单(deckWindows 形态、beat/station 标签、hideAt 语义、URL layout 参数、opts.stage 双语义)作为重构 PR 的不回归契约附上。
4. IR 抽象时机 = **rule-of-two**:等第二个非退化 archetype(spine/terraced)进场,从两个具体实例提取,不从 courtyard 单实例归纳。
5. 测试对魔数的锁定(transit 识别启发式 shake>0.1&&fov===50、面包屑 (n-1)*5、finale 断言)是重构预算必须计入的脆性。
6. 结构邻接分组只配当"弱分组"退化启发式,永不升为真相来源(qbr 里 Executive Summary 与 KPI Dashboard 同为 magnitude 会被误并章)。
7. zone = 无序成员集合、播放序 = §5 数组序,两者正交;确定性优先级/退化梯级表写进契约文档(观感问题另列开放问题)。
8. massing 远距可读性(R≈33、stone 着色、subtle 纪律下能否与黑石板区分)是未验证风险 → Phase 1 **第一周截图 spike**,不得默认成立;可读通道优先剪影/天际线/簇状分布,不许破明度封顶。
9. 实施排序:Layer C 与 Layer B 先行或并行(资产全现成、用户四词"排布/对齐/对比/艺术元素"的直接实现者是 B+C);任何 Layer A demo 不得以 decor=0 的裸白模出场。
10. 五拍不变量(hitstop 平移、idle 相位回卷、窗口边界)是靠测试+血泪维持的,Phase 1 一律不碰 transplant 机器,planSpace 产出与 stationOrigins 同构的输出喂现有编译半边。

## 3. 被驳回的攻击

1. "盲测胜利证据全挂在站间不可见/布景假 vista 即可"——finale money shot 与 transit 双站窗口就在获胜系统里,是依赖真实全局坐标的真 vista;黑石板承载不了对齐/对比/伏笔。
2. "建筑框与性能栈结构性冲突不可解、必回个位数 fps"——per-zone 合并体量 5-10 leaf 在现有 stone 管线预算量级内,是可测问题不是必爆问题。
3. "Layer A 是零证据假设应砍"——①命题(组织空间)是用户亲自提出的问题定义,盲测对照组不是更好的 3D,砍 A 等于拒答用户命题。
4. "courtyard 被 5 核血统拖下水"——中心式立论独立成立,欠的债在 vista 定位与性能,不在血统。
5. "两半切分自破、实际收缩为 20 行"——假二分,漏掉编译器分层第三项(IR 携带设计意图、lowering 绑时间);finale 取景/面包屑/窗口归属都是与时钟正交的空间量。
6. "退化 plan 二难 = 谎言"——transit/面包屑/finale/HILLS 本就是 layout 无关的共享合成规则,整体住编译期即可,既不进 IR 也不需 if 特判。
7. "IR 改版贵一个量级/迁移期必然平行管线"——Phase 1 的 plan 是 repo 内部结构无外部消费者;facade 一次性切换无共存期。
8. "wrapper 悖论"——facade 迁移是标准手法,保留壳是正解不是缩水耻辱。
9. "hold 前置 → 不可开工、几何作废重做"——zone 几何是从站点成员关系计算的产物,站数 59→123 是重算不是重做;bytedance-bp 不过滤、可先行。
10. "确定性优先级表 = 语义推断从后门回来"——对给定元数据执行确定性规则是形式消费,与"从内容推断哪页属于财务章"有本质区别。
11. "role = 替换作品本体、2D 有立场拒绝"——decor 在契约 §3 明文豁免 twin,3D 对任何页都不复现像素;利害只有页的存在(hold 解决)与文本内容(overlay 解决)。
12. "朝向死锁 + EXPR 表达力天花板"——合成镜头出路零成本绕开旋转;且数学上 yaw 旋转按通道分解后各通道仍是 EXPR_RE 可表达的单通道仿射形,缺的是未写的 rewrite pass 不是文法天花板。
13. "甜区空集 → 选型倒置 → 应换 spine"——Phase 1 目的函数是 thesis 证明(要反差)不是分布覆盖,demo/部署分离合法(但必须说破,已入落地 9);spine 构成排期论据不构成撤换论据。
14. "盲测无论输赢都无法归因"——radial 基线 + decor 对齐后残余差异恰是待测物;zone massing 与中庭属于被测的空间组织本身,不是混淆变量。
15. "leaf 税必然乘法爆炸、石板与 massing 名额竞争无解"——名额联动守恒下每窗口 dressing 总量与现状同量级;finale 窗口本就不裁剪,vista 最重要时刻零改动。

## 4. 修订后的提案

**总框架:production-design 化的三层,A 降格、B 升格、C 先行。**
认知模型修正:观众无行动权,空间感由镜头中介——空间是片场,**为镜头组织空间**。建筑学词汇(zone/datum/threshold/promenade/vista)保留为素材组织语言,但 vista 从"核心机制"降为"crane/transit/threshold/finale 消费的素材";"5 核↔Ching"论证删除。三层地位重排:**Layer B(排布系统:模数 token、datum 对齐、xOf(i) 等硬编码坐标抽出)是用户四词中"排布/对齐/对比"的直接实现者,Layer C(3D decor 三纪律 + instancing 场)是"艺术元素"的直接实现者且资产全现成——两者先行或并行;Layer A 在 Phase 1 是方向性词汇表 + 一个 layout 分支,不落 IR。** 必须诚实承认:Layer A 的感知增量目前零证据,Phase 1 盲测就是去买这个证据的。

**决策①(替换 assemble-deck):打穿。替代方案:**
在现有单管线内加 `layout='courtyard'` 分支(DECK_LAYOUTS/stationOrigins 是注释自证的扩展点),courtyard 需要的 zone 感知圆心、环形 transit 变体、朝中庭的 threshold/overlook 合成镜头、zone massing 在主循环增量落地——小手术但不是零手术,transit 变体等在扩展点之外的工作照实计价。assembleDeck 签名、输出形态、URL 参数、id 前缀字节级保全,三 layout golden snapshot 先行。SpatialPlan IR 等第二个非退化 archetype 进场时按 rule-of-two 从两个实例提取,且定义为时间无关纯空间 IR + 编译期 lowering。"把空间设计词汇从主循环合成代码里组织出来"这个方向保留,以内部函数边界的形式渐进实现,不以杀 API 的形式。

**决策②(zone 与 2D 契约):原则站住,请求打穿延后。**
站住的:zone 边界真相来源 = 2D 端章节语义,3D 不做语义推断,缺席时退化——这是两阶段分工的正确应用。打穿重写的:v1 zone 是 planSpace 内部概念,Phase 1 在 bytedance-bp 的 IR slides 上手工标注章节成员关系开工(不是标 sectionId——那是契约字段,Phase 1 语料不走契约路径);契约请求延后到"盲测 + 一个真走契约路径的 deck"两份证据齐备,且发出时收敛为单真相源(outline 权威、sectionId=引用、无 divider、role=hold 站修饰符且消费语义先写进文档);退化梯级 outline→结构邻接(弱)→单 zone,无"体量均分";显式声明 hold 站(§9.5-3)是契约路径部署的前置,hold 先行或同 PR;补空 zone 重映射规则。

**决策③(Courtyard 先行):基本站住,承诺与实验重写。**
courtyard 作为 Phase 1 archetype 维持——thesis 证明需要反差,中心式立论独立成立,spine 不构成撤换论据。但:承诺改为"指定镜头时刻可见全局"(朝向问题以合成镜头解决并计价);理由 (ii) 删除,声明 demo/部署分离与双前置 gate;语料锁修正(8-13 或换);性能 spec 落地(massing 免距离裁剪 + 石板名额联动 + finale 不裁);Phase 1 第一周两个 spike 先行(massing 剪影可读性截图、中心纪念碑 laptop 实测定价),任一 spike 失败则 landscape 对照方案升级为主案;盲测按落地 10 的四条约束执行。**landscape/terraced 作为正式对照方案与 courtyard 一起进 Phase 1 评审。**

## 5. 开放问题(需产品 owner 拍板)

1. **courtyard vs landscape 的最终选边机制**:两个 spike 都过时选 courtyard,任一失败时是自动切 landscape 还是回来重议?landscape 的"高程差免费 vista"要不要也做一个廉价 spike 以便真 A/B?
2. **地平线母题的美学取舍**:massing 与石板名额联动意味着 courtyard 窗口的黑石地平线稀疏化(0-3 块)——deck 世界的已 shipped 身份件被削弱,可接受吗?
3. **hold 站 backlog(§9.5-3)的排期与归属**:它现在是 zone 契约部署的硬前置,谁做、何时做、是否与 zone 消费同 PR?
4. **2D 端章节建模(outline)立项**:这是跨端新 feature(文档理解层新建能力),何时立项?在此之前 courtyard 产品触发条件对 100% 真实语料为空——接受 Phase 1 纯 thesis 验证、产品收益全部后置吗?
5. **用户调序后的 zone 重入观感**(改判三):形式解合法,但 promenade 反复穿越同一庭院的叙事可读性未验证;要不要请求 2D 端在调序时更新 sectionId,还是接受重入?
6. **盲测 decor 对齐的具体形态**:双臂"都裸"(测纯空间组织但两臂都难看)还是"等价装饰"(观感真实但 Layer C 工作量翻倍)?
7. **spine/画廊的时间表**:它合身当前真实分布(3-5 站)且零前置依赖——放 Phase 1.5 还是 Phase 2?它也是 rule-of-two 触发 IR 提取的候选,排期影响 IR 时机。
8. **role 字段的验证路径**:Phase 1 可顺手做"cover hold 站放世界入口 vs 普通站位"的对比作为 role 请求的证据——做不做?
9. **Phase 1 语料**:改锁 8-13 页,还是换/增一份 8-12 页内的手工 IR deck?
10. **Layer B 的首个落点**:render-magnitude 的 xOf(i) 抽模数 token 是最小切口——放 Phase 1 并行,还是等 courtyard 分支落地后再动 structure renderer?
