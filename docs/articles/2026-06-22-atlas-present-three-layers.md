# 《一个 deck 由三层组成 —— Atlas Present v1 架构》

**DRAFT v1 — 未发布。** 工程笔记 / 架构 dispatch。前置阅读非必须，但理解 [Atlas thesis](./2026-06-14-discovery-of-llm-sdf.md) 可补全 "为什么是 SDF、为什么是 LLM 写代码" 的上下文。

---

## 开场：deck 的三个独立 axis

做 PowerPoint 替代品的工具有一个反复出现的 framing 错误 —— **把 "template" 当作单一交付物**。

你看 Gamma 的 marketing page：他们给你 12 个企业 template，每个长得几乎一样、只换颜色。你看 Tome：他们给你 30 个 "Pitch deck 模板"，本质是 layout + 配色的全排列。你看 Pitch：他们给你 100+ 模板，按行业切。

这三家都做对了一件事 —— **理解用户要的是看起来不像 PPT 的 deck**。但都做错了同一件事 —— **把决定 deck 形状的三个独立维度，绑成一个不可拆解的"模板"**。

这三个维度是：

1. **Atoms** — 视觉词汇 (KPI card / 饼图 / 时间线 / 流程图 / 球体填充率)
2. **Themes** — 风格一致性 (字体家族 + 主色 + 调色板 + 留白哲学)
3. **Scaffolds** — deck 结构 (VC pitch 的 9-slot 序列 / 季度回顾的 5-slot / OKR 的 6-slot)

绑在一起的代价是组合爆炸：12 个 template × 9 个行业 × 5 种风格 = 540 个 "模板"，每个都要 designer 单独维护。Gamma 实际只敢 ship 8 个 base 模板换色，因为再多维护不动。

**Atlas Present v1 的赌注：把三层拆开 ship。**

61 atoms × 9 themes × 10 scaffolds = 5500 种组合 (理论上)，**而每一层都可以独立扩展、独立测试、独立 polish**。

---

## 第一层：Atoms (61 个视觉词汇)

Atom = "一个 chart 类型 / 一个 diagram 类型 / 一个 composition 单元"。具象例子：`kpi-card` (KPI 数值卡)、`bar` (柱状图)、`waterfall` (瀑布图)、`pyramid` (金字塔)、`circle-image-hub-spoke` (中心辐射网络)、`isotype-people-grid` (人形 figure 网格)、`sphere-fill` (3D 球填充率)。

这一层做对了三件事：

**(1) 命名 = 用户搜索词 = SEO 关键词 = Gallery slug。** 一字三用。`bar` 就叫 `bar`，不是 `chart-bar-vertical`。`sphere-fill` 就叫 `sphere-fill`，不是 `volumetric-percentage-indicator`。LLM lift 时 prompt 出现 `bar`，SEO landing page URL 是 `/atoms/bar`，gallery 里搜索框输入 `bar` 全命中。

**(2) 每个 atom 都是 polish-wave-quality**。Inter 字体的 700/600/400/900 四档；gradient lighten 0.08-0.10 (微妙的深度，不是夸张的霓虹)；drop shadow 10-12px alpha 0.10-0.15 (嵌入感，不是漂浮);  调色板 token 化 (不写死 `[60, 130, 200]` 蓝色，写 `palette.colors[0]`)。这些不是审美选择，是从 PresentationLoad / Gamma 53 个企业模板观察池抽出的视觉公约数。

**(3) Atom = vocabulary, NOT atom for icons**。这个 lock 来自一次差点犯的错。当时观察 PL 看到 21 个 icon 模板 (icon-grid-medical, icon-grid-finance...)，第一反应是 "ship 21 个 atom"。中途意识到这 21 个都是同样的结构 (cover + grid + use)，差的只是 icon 内容 —— **icons 是 vocabulary 不是 atom**。最终 ship 的是 ONE icon library (Phosphor ~9000 icons, MIT)，被 3 个现有 atom 消费 (`icon-row-N`、`icon-grid-N`、`icon-badge`)。

61 个 atom 跨 8 个 category：charts/data (9 个 chart 类型)、charts/diagrams (12)、charts/hierarchy (4)、charts/infographic (10)、charts/lists (3)、shapes/3D-style (17)、presentation (3 个 layout 单元) + icons (vocabulary library)。每个 atom 在 `sdf-js/src/present/atoms-2d/<category>/<name>.js`，都是纯 Canvas2D 渲染函数 + spec metadata。

---

## 第二层：Themes (9 个风格组合)

Theme = "整套 deck 的视觉气质"。这一层最容易被低估，**也是 Gamma 真正的差异化所在**。

观察池给的 smoking gun: **8 个 Gamma 企业模板 → 12 个看起来不同的 slide → 但骨架只有 3-4 种。剩下的差异全在 theme 上**。

所以 Atlas 不 ship 8 个独立 theme，ship **3 macro × 3 color = 9 themes**：

- **Editorial · Calm** (navy / forest / burgundy) — serif heading + Inter body + 暖白纸张 bg + 大量留白 + 深色。气质：纽约客封面 / FT 周末特刊 / 学术 paper。
- **Pitch · Punchy** (black-neon / cobalt-orange / charcoal-yellow) — Inter Display 大字 + 高对比 + 饱和强调色。气质：YC pitch / 硅谷 Series A / 苹果发布会。
- **Organic · Nature** (teal / coral / lavender) — Quicksand 圆体 sans + 柔和渐变 + 自然色系。气质：B-corp / wellness 品牌 / 教育产品。

每个 theme 的 schema 不止是 `{bg, fg}`，而是 `{bg, silhouetteColor, accent, colors[], font: {heading, body}, macroCluster}`。**`font` 字段是 Sprint 16 的伏笔 —— 等 atom 真正读 `palette.font.heading` 时，Editorial 自动切 serif、Pitch 自动切 Inter Display、Organic 自动切 Quicksand**。现在 atom 都还硬编码 Inter，但 schema 已经 ready。

这一层的实施细节：`branding-palettes.js` 原本有 28 个 chromotome palettes (legacy)，新的 9 个 atlas themes **被前置插入**，所以 UI Swap Branding 按钮第一次循环先到 Editorial · Navy 而非 mono-light。

---

## 第三层：Scaffolds (10 个 deck 结构)

Scaffold = "deck 的 slot 序列"。`pitch-deck-vc` = `[cover, problem, market-size, solution, product, traction, business-model, team, ask]`。`qbr` = `[cover, executive-summary, kpis, wins, challenges, outlook, next-steps]`。

10 个 scaffold 是从市场需求池抽出的高频结构：

| Scaffold | Slots | Audience |
|---|---|---|
| pitch-deck-vc | 9 | VC / angel |
| company-overview | 7 | prospect / partner / candidate |
| product-launch | 8 | customer / press / internal |
| qbr (Quarterly Business Review) | 7 | exec / board |
| training | 8 | employee / customer / student |
| thesis-defense | 9 | academic |
| business-plan | 8 | bank / advisor |
| vision-mission | 6 | employee / prospect |
| strategic-plan | 7 | exec / board |
| okr-goal-setting | 8 | team / individual |

但 scaffold 不只是 "slot 名字列表"。每个 slot 携带：
- `purpose`: 这个 slot 应该展示什么内容 (LLM 的语义 hint)
- `recommended_atoms[]`: 这个 slot 适合用哪些 atom (按优先级排序)
- `forbidden_atoms[]`: 这个 slot 不要用哪些 atom (e.g. "problem slot 不要用 org-chart / gantt")
- 父 scaffold 的 `theme_affinity[3]`: 这个 scaffold 适合哪 3 个 theme

**关键设计选择：scaffold 不规定 atom 的具体参数，只规定可选菜单**。这样 LLM 在 Stage 2 lift 时有空间根据 source 内容选择 —— 但选项被 menu 严格约束，LLM 不会突然 emit `text-3d-pipe` 在 "ask" slot。

---

## 端到端：3-stage Pipeline

三层架构如果只是 ship 数据不接管线，就是 dead components。Sprint 16 的工作就是把三层 stitch 进一个真 pipeline：

**Stage 0 — Pick scaffold (1 LLM call)**

输入：deck 的 title + body 文本。

v1 deterministic: keyword + audience + slot-count 评分，fallback `company-overview`。

v2 LLM-wrapped (`picker-llm.js`): 把 10 scaffold menu + deck 内容喂给 Claude Sonnet 4.5，让它按**语义意图**选 (而非关键词表面)。返回 `{scaffoldId, confidence: 0-10, reasoning[]}` + 可选 themeHint。错任何一步 (no apiKey / HTTP / parse / unknown id) 静默 fallback v1，pipeline 不崩。

**Stage 1 — Map source slides → scaffold slots (heuristic, no LLM)**

对每个 slot，遍历未消费的 source slide，按 `purpose+title` 关键词重叠评分，选 best match。Slot 0 (cover) 拿 slide 0。剩余 slide fallback 分配，不丢任何 source。

(这是当前最薄弱环节，已 backlog 进 Sprint 17：换成 LLM judge。)

**Stage 2 — Per-slot lift (N LLM calls, N=slot count)**

每个 slot 单独调 Claude Sonnet 4.5，注入 4 类约束：
1. Slot purpose ("Pain point — who hurts and how much")
2. Recommended atoms (positive 菜单 + 排序)
3. Forbidden atoms (negative 约束)
4. Theme (`bg`, `accent`, `colors[]`, `font`)

LLM emit SceneData JSON：`{name, layout, subjects: [{type, x, y, w, h, args}]}`。每个 subject 必须落在 1280×720 画布内、必须显式给出 x/y/w/h (否则 atom 会重叠在 canvas 原点)。

---

## 一组数字

**合成 VC pitch (9 slide → 9 slot)**：
- Stage 0: v2 picker → `pitch-deck-vc`, confidence 10/10。推理具体 "Title 明确 'Series A Pitch' / canonical 9-slot 结构 / TAM $4.8B+ / ARR trajectory / pricing tiers / team credentials / break-even 全有"
- Stage 1: 9 slot 全 mapped，每个 slot 的 source 评分 ≥1
- Stage 2: 9/9 LLM lift 成功
- **总成本 $0.63 (~$0.07/slot)，墙钟 30 秒**
- 每个 LLM 选的 atom 都在该 slot 的 `recommended_atoms[]` 菜单里 (约束真正生效)

**PD sphere-fill demo deck (20 slide → 8 slot)** —— fuzzy 输入测试：
- v1 picker: company-overview (score 0 fallback，silent 错配)
- v2 picker: product-launch, **confidence 2/10**。推理诚实 "deck 只有重复 placeholder text ('3D SPHERES' / '2D SPHERES'). Title 暗示 template 而非真 deck. product-launch 是最 flexible 兜底, confidence 2/10 因 intent signals 完全缺失"
- 8/8 slot baked, $0.59

v2 picker 在 confident 输入上不退步，在 fuzzy 输入上**两个改进**：
1. 更合适的 scaffold (product-launch vs company-overview)
2. **诚实的置信度** —— 2/10 让下游能 surface "我猜的" 警告给用户，而不是隐藏

---

## 为什么这样设计能 work

三层架构的 leverage 来自三个独立性质：

**正交性**。改一层不影响另一层。新加 atom (Sprint 18 想 ship 一个 sankey 图？) 不需要改 theme 或 scaffold。新加 theme (想做 cyberpunk / wabi-sabi / 90s-zine？) 不需要重写 atom。新加 scaffold (想 ship "post-mortem" 或 "investor-update"？) 只需要写 JSON registry 一个 entry。

**菜单约束 vs 自由生成**。Sprint 15 之前的 lift LLM 是 "自由 emit any atom"，结果 LLM 在 "team" slot 经常 emit waterfall 图 (毫无理由)。Sprint 16 把每个 slot 的 `recommended_atoms[]` 作为强约束注入 prompt，LLM 100% 在菜单里选 —— **less freedom = better choices**。

**诚实的不确定性**。v2 picker 的 confidence score 是这个架构最被低估的功能。pipeline 输出 `deck.json` 里带 `pickerMethod: 'llm' | 'fallback'` + `confidence: N/10`，UI 层可以决定 "confidence < 5 时显示 'we guessed this scaffold, want to pick another?' 横幅"。这种 vertical-aware 的 UX 在 fully-magical "AI does it all" 范式下做不到。

---

## 还没做的

- **Visual-panel UI 接入** — pipeline 现在只跑 CLI。in-browser 上传 PDF + scaffold-confirm + slot-progress UI 是 Sprint 16 follow-up。
- **Stage 1 LLM mapping** — 现在用关键词启发式，PD 这种 fuzzy 输入会错配 (pricing slot 拿到 TAM slide)。换 LLM judge ~$0.05/deck (+8% 总成本)。
- **Export 真 deck 格式** — PDF / PPTX / HTML / video。没 export 这是 demo 不是 tool。
- **Typography 集成** — atom 都还硬编码 Inter，没读 `palette.font.heading`。架构 ready，工作量 ~4-6 小时。

---

## 总结

把"一个 deck"看作 atoms × themes × scaffolds 的笛卡尔积，而不是 N 个独立模板，**是 Atlas Present v1 的本质押注**。三层独立 ship、独立测试、独立 polish；用 menu 约束 LLM 而非让它自由生成；用 confidence score surface 不确定性给 UX 层而非隐藏 —— 这套架构在 9 slot $0.63 的 VC pitch demo 上首次端到端跑通，并且 (这件事比单个 demo 更重要) **三层都可以独立扩展**。下一波工作 ship 进 visual-panel UI 之后，这个架构就从"已验证的工程"升级为"可被用户验证的产品"。

`docs/articles/2026-06-22-atlas-present-three-layers.md` — 内部技术 dispatch，未发布。
