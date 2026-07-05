# Atom Visual Quality Scorecard — Sprint 26 baseline (2026-07-05)

Loop 2 (视觉质量循环) 第一次全量评审。方法: `all-atoms-gallery.html` 以 spec.example
args 渲染全部 101 atom (640×360, editorial-light palette), 9 chunk 截图,
多模态逐个对照 PL 质量基准评审。截图: `screens/sprint26-gallery/chunk-*.png`。

评分: ✅ 好 (PL 级) / 🟡 中 (可用但有硬伤) / 🔴 破 (视觉失败, 必修)。
只列 🔴/🟡; 未列出的 ~70 atom 均 ✅。

## ✅ Fixed in round 2 (2026-07-05)

全部 7 个 P0 已修复, 每项均重渲 gallery + 多模态截图确认。详见各 commit message
(branch `sprint-26-round2-p0-atoms`)。

| atom | 修了什么 |
|---|---|
| `pyramid` | 重写 `widthAtLayer` → `boundaryWidth(k)`(按 boundary 而非 pixel-row 计算宽度), layers[0]=base 现在正确渲染在底部最宽; `inverted` 只改上下位置不再影响哪层宽。塔尖 label 加"放不下就挪到金字塔外侧+连接线"的 fallback。顺带修了 spec `inverted.example: true` 意外把 gallery demo 强制渲成 funnel 朝向的 bug。确认 `pyramid-3d` twin 本来就是 base-bottom-widest, 2D 现在与之一致, 未改 3D。 |
| `feature-card-grid` | 标题加 fitFontSize auto-shrink(min 12px), 不再溢出撞邻居卡片; body wrapText 升到 4 行 + 末行 ellipsis(整词丢弃优先, 单词内部才退化到字符级裁切), tokenizer 支持连字符断行("zero-knowledge"→"zero-"/"knowledge")。 |
| `gauge` | 根因: arcRadius 贪心吃满剩余高度, 把数值文字/label 挤到 canvas 外(完全不可见)。改为先预留 bottomBlockH(数值字号+间距+可选 label)再算 arcRadius。指针角度数学本身没问题(0=左/0.5=顶/1=右, 向下开口的表盘), 之前"指针方向错"其实是表盘整体过大+数值裁切造成的观感。 |
| `seven-s-model` | R 从 `min(w,h)*0.31` 改为按 FILL_FRAC(0.75)反推, 团簇现在占满~75%可用空间。label 从固定字号+ellipsis 换成 `fitLabelLines()`: 先降字号(9px 下限)→ 再 2-line 词换行 → 单词不可切分时用连字符 2-line 字符对半("Structure"→"Struc-"/"ture")。 |
| `numbered-grid` | huge 数字列宽从 `numFontSize*0.65` 的猜测值改成 `ctx.measureText(numLabel)` 实测宽度 + 8px gap, label/sublabel 列从实测宽度之后起始, 不再压字。 |
| `mindmap` | 固定半径常量(36/22/14)+ 保守 maxRadius 改成按 80% 可用半径动态计算; 分支/叶子节点缩成小圆点, label 移到圆外(沿节点相对根节点的角度径向偏移, 按左右自动切 textAlign), 字号 10px 下限自动收缩; 根节点保留内嵌 label 但改 auto-shrink 不再 ellipsis 截断。 |
| `matrix-grid` + `nine-field-matrix` | 拆分 `drawCell` → `drawCellBg` + `drawCellLabel`, 渲染顺序改成: 背景 → 轴 → bubbles(半透明 fill α=0.32 + 实线描边)→ cell label(现在总在 bubble 之上)→ bubble 自己的 label 移到泡外(右下偏移, 避开 cell label 的水平中线), 深色小字。 |

## 🟡 P1 — 中等 (round 3 候选)

| atom | 问题 |
|---|---|
| `stat-banner` | trend chip 与 label 文本重叠 ("Annual Recurring Revenue" 被 "+117% YoY" 压住尾部) |
| `flow-chart` | 节点 label 截断 ("Onboard" / "Purchas") — 需 auto-shrink |
| `timeline` | 首卡片左边缘裁切 ("eed Round") |
| `icon-grid` | 4 item 换行后第 1 行 label 被第 2 行圆遮住 ("Security" 藏在 "Care" 圆后) |
| `funnel` | 级间 % chip 一半藏在梯形后 ("↓ 88%" 只露一半) |
| `fishbone` | 左侧枝 label 出画布 ("nel mix" 被裁) |
| `isotype-stat-comparison` | 图标行挤压变形, "FUll-time" 大小写渲染错误 |
| `bullet-list` | 空心圆环 bullet 视觉未完成感; 行间距过大留白多 |
| `bubble` | 气泡内 label 不可读 (深底深字), 图表稀疏 |
| `infinity-loop-flow` | 节点/loop 挤在中心, 画布利用率 <30% |
| `relationship-graph` | 3 节点偏下, 大片死区; "uses" 边标签过小 |
| `org-vs-org-matrix` | org label 太小, "Acme (us)" 在气泡内难读, 右半象限灰底对比不足 |

## 🟢 P2 — 小瑕疵 (顺手修)

- `bar`: targetLine "Target" 标签与图标题碰撞
- `histogram`: 标题与 "Median" 标注轻微重叠
- `arrow` / `diamond`: 单形状 + caption, hero 表现力弱 (设计层面, 非 bug)
- `radial-spoke`: 各 spoke 无差异化数值显示
- `sphere-network` / `sphere-tree`: 球面 label 偏小
- `image` / `image-split`: example 是 1px data URI 故渲染空白 (预期; gallery example 可换更大 demo 图)

## Round 2 计划

1. 修 7 个 P0 (pyramid 倒置需先确认视觉契约 + 3D twin 一致性)
2. 通用修法优先: auto-shrink helper 已存在 (fitFontSize), P0 里 feature-card-grid /
   numbered-grid / mindmap / seven-s-model / flow-chart 都是同一类 "无 shrink" 病
3. 重渲 gallery → 对照本 scorecard 复核 → 更新状态

## 状态

- [x] Round 2: P0 × 7 (2026-07-05, branch `sprint-26-round2-p0-atoms`)
- [ ] Round 3: P1 × 12
- [ ] Round 4: P2 清尾 + 复审全量
