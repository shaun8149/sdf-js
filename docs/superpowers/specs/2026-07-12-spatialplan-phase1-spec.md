# Spec: 空间组织框架 Phase 1 — "为镜头组织空间"

> 来源:user 三点需求(组织空间 / 排布 atoms / 类 ArtBlocks 艺术修饰)→ 三层框架提案 →
> 4+1 轮对抗讨论合议(`../notes/2026-07-12-spatialplan-debate-synthesis.md`,必读)→
> user 拍板四条(2026-07-12)。本 spec 是合议修订版提案 + 拍板结果的可执行化。

## 0. 已锁定的决策(user 拍板,不再重议)

1. **landscape 也做廉价 spike**——courtyard 与 landscape 各出一天级对比截图,看图选边,
   不是"courtyard 失败才轮到备胎"。
2. **石板换 massing 接受**——courtyard 窗口内地平线黑石板 6 → 0-3 块,名额让给远处章节
   体量剪影(布景换真内容)。
3. **hold 站进 Phase 1**——从 backlog 升格为硬前置(48% slot→station 衰减;§9.5-3),
   独立价值:3D 页数与 2D 对齐。
4. **盲测双臂等价装饰**——Layer C 按新排序先行,装饰两臂共用;结论宣称范围锁
   "courtyard 体验 > radial"。

## 1. 总框架(合议修订版)

**认知模型:观众无行动权(`evaluateCameraSequence` 是锁死时间线),空间感由镜头与剪辑
中介。空间是片场——为镜头组织空间,不是为居住者组织空间。**
一切空间结构的验收标准:**哪一拍镜头消费它?** 读不进任何镜头的空间结构不做。

三层地位(合议重排):

| 层 | 内容 | Phase 1 地位 |
|---|---|---|
| **Layer B 排布系统** | 模数 token、datum 对齐、节奏/对比操作;把 renderer 硬编码坐标(如 render-magnitude `xOf(i)`)抽出 | **先行/并行**——user 四词"排布/对齐/对比"的直接实现者 |
| **Layer C 3D decor** | 类 ArtBlocks 生成艺术家族;三纪律:seeded(deck hash 身份)/ 家族制 / subtle(明度封顶、不与数据争焦点);体量感靠填充/累积(instancing 场) | **先行/并行**——"艺术元素"的直接实现者;资产现成(Generator-S / terrain / procedural-city / 67 idioms) |
| **Layer A 空间组织** | zone / datum / threshold / promenade / vista 词汇表 | **降格**:Phase 1 = 词汇表 + 一个 layout 分支,**不落 IR** |

关键降级与删除(对抗讨论落地项):
- **vista 不是"反翻页核心机制"**,是 crane / transit / threshold / overlook / finale 这几拍
  消费的**素材**,按镜头需要供给;hero / super / payoff 的封闭竞技场感不得稀释。
- "5 几何核 ↔ Ching 一一对应"论证**删除**;courtyard 以"中心式组织"独立立论。
- 诚实声明:Layer A 感知增量目前**零证据**,Phase 1 盲测就是去买这个证据的。

## 2. 决策①替代方案:layout 分支,不替换

- 在现有单管线内加 `layout='courtyard'`(DECK_LAYOUTS / stationOrigins 是注释自证的扩展点)。
- courtyard 分支新增工作照实计价:zone 感知圆心、环形 transit 变体、朝中庭的合成镜头
  (threshold / overlook / turn-back)、zone massing。
- **不碰 transplant 机器**(EXPR_RE 平移 / idle 相位回卷 / hitstop 时间线 / #308 时钟纪律);
  planSpace 逻辑产出与 stationOrigins 同构的输出喂现有编译半边。
- **字节级保全**:assembleDeck 签名、输出形态(deckWindows / beat 标签 / hideAt 语义)、
  URL `?layout=` 参数、id 前缀 `/^s(\d+)-/` `/^path-(\d+)-/`(23 文件消费面)。
- **golden snapshot 先行**:line / radial / grid 三份现输出快照钉进测试,任何重构先过等价性。
- SpatialPlan IR 延后:**rule-of-two**——等第二个非退化 archetype(spine / terraced)进场,
  从两个实例提取;届时定义为时间无关纯空间 IR + 编译期 lowering(时间合成只能住编译期)。

## 3. 决策②修订:zone 是内部概念,契约请求延后

- **站住的原则**:zone 边界真相来源 = 2D 端章节语义;3D 不做语义推断;缺席时退化。
- v1 zone = planSpace **内部概念**,不进 IR、不进契约。
- Phase 1 语料:bytedance-bp(手工 IR deck,不走契约路径)在 **IR 层手工标注章节成员关系**。
- 退化梯级:outline → 结构邻接(只配"弱分组",vista 承诺降强)→ 单 zone。
  **无"体量均分"**(零信号下均分 = 3D 凭空发明章边界)。
- 空 zone 重映射规则(确定性):并入相邻 / 移除并重排 promenade / hold 回填;
  vista / 伏笔承诺显式以"zone 非空"为条件。
- **契约请求延后**至两证据齐备(盲测结果 + 一个真走契约路径的 deck)。届时形状:
  `deck.outline` 唯一权威;`slot.sectionId` = 对 outline id 的引用(悬空引用 = 跨字段
  WARNING);**无 divider**(由 outline 边界推导);`role` = hold 站之上的放置/镜头修饰符
  (cover = 世界入口,toc = overlook 点 + agenda 走 DOM overlay,appendix = 档案层),
  消费语义先写进契约文档才允许发请求。

## 4. 决策③修订:spike-gated courtyard,landscape 平行对照

- 承诺文本:**"在指定镜头时刻(transit / threshold / turn-back / overlook / finale)可见全局"**
  ——不是"任意时刻"(朝向几何:不旋转不变量 + 五拍 -z 视线)。
  解法:courtyard 分支直接合成朝中庭的世界坐标镜头,零几何旋转、零 EXPR 改动。
- 性能 spec(zone massing in leaf budget):
  - 每章 1-2 块合并体量(SDF 域重复优先,procedural-city 先例);
  - 独立 id 前缀(如 `massing-`),**永不按距离裁剪**(现有 horizon 裁剪留最近 6 块,
    对 massing 语义精确反转——伏笔回收需要的恰是远侧块);
  - 石板名额联动:`slabs = max(0, 6 − massingLeaves)`,每窗口 dressing 预算守恒;
  - finale 窗口不裁剪(现状已如此,vista 最重要时刻零改动)。
- **三个 spike 先行(第一周,gate)**:
  1. massing 剪影可读性截图(R≈33、stone 着色、subtle 纪律下能否与黑石板区分;
     可读通道:剪影 / 天际线 / 簇状分布,不许破明度封顶);
  2. 中心纪念碑 leaf 成本 laptop GPU 实测定价;
  3. landscape 对比截图(地形遮挡 = 天然 window 边界,高程差 = 免费 vista,资产已 ship)。
  **选边规则:1、2 都过 → 看图选边(user);任一失败 → landscape 升主案。**
- 语料:Phase 1 = 温室 thesis 验证(手工 IR deck,页数锁放宽至 8-13 页 / 3-5 章,
  bytedance-bp 13 页合规);**产品部署 gate = hold 站 + 2D outline 双前置**(现实分布
  0/15 ammo 达 8 站,须说破,不许拿温室结果宣称产品就绪)。
- 塌缩保护:每 zone≈1 站时检测器**拒绝 courtyard、退化到 radial**(正确行为)。

## 5. 盲测实验设计(合议四约束 + 拍板)

1. baseline = **radial**(已 shipped;用 line 会混入"环形 vs 直线"这个已 shipped 差异);
2. 双臂 **decor 等价**(同一 Layer C 家族与预算,user 已拍板);
3. 结论宣称范围锁定 **"courtyard 体验 > radial"**,不得引申为"Layer A IR 有效";
4. 任何重构前三 layout golden snapshot 等价性先过。

## 6. 非目标(Phase 1 明确不做)

- SpatialPlan IR / 新契约字段 / 2D outline 立项推动(等证据);
- 混合渲染管线(analytic + stone 同帧——整帧互斥是现实,massing 走 stone leaf 预算);
- structure renderer 的站内坐标全面重构(Layer B 只做第一个切口,见 plan);
- spine / terraced archetype(spine 是 rule-of-two 的 IR 触发候选,排期另议)。

## 7. 开放问题的处理

合议 10 条开放问题中:#1/#2/#3/#6 已由 user 拍板(§0);#9 语料锁放宽已并入 §4;
#10 Layer B 首落点见 plan;#4(2D outline 立项)/#5(调序重入观感)/#7(spine 时间表)/
#8(role 验证)延后至盲测证据落地后与 user 重议。
