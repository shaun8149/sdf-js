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

## ✅ Fixed in round 3 (2026-07-05)

全部 12 个 P1 已修复, 每项均重渲 gallery + 多模态截图确认。详见各 commit message
(branch `sprint-26-round3-p1-atoms`)。

| atom | 修了什么 |
|---|---|
| `stat-banner` | chip 尺寸/位置先算, label 用 `fitLabelSize` 自动收缩(min 11px)让出 chip 空间; 收缩到底仍撞则把 chip 挪到右上角、label 独占整行。 |
| `flow-chart` | 节点 label 加 `fitFontSize` 自动收缩(min 9px), 缩到底仍放不下则换行到 2 行, 不再截断("Onboard"/"Purchase" 现在完整显示)。 |
| `timeline` | 卡片中心 x 夹在 `[x+PAD+half, x+w-PAD-half]` 内, 首/末卡片向内挤而不是居中裁切; connector 线随之变成斜线。 |
| `icon-grid` | icon 半径/字号改为基于列宽(不再基于行高, 消除循环依赖); row pitch 取 `max(均分高度, 实测 label+sublabel 内容高度)`; 若整体仍溢出画布则统一按比例缩小 icon+字号+间距。 |
| `funnel` | 几何先算好, 分两遍绘制(全部梯形→全部 label/chip), chip 加白底+描边, 消除"后画的梯形盖住前一个 gap 的 chip"问题。 |
| `fishbone` | sub-cause label 右对齐锚点若会越过画布左边界, 改锚到更靠近脊柱的分支点; branch label 锚点同样夹在画布内。 |
| `isotype-stat-comparison` | mini icon 上限 30→20, 超出显示"×N"比例注记替代省略号; icon 行与 label 之间预留间距; caption 加粗+提高不透明度提升可读性(代码审计未发现真实大小写 bug, "FUll-time" 是小字号误读)。 |
| `bullet-list` | 无 `status` 的默认项渲染成实心 accent 圆点(不再默认走 hollow ring); hollow ring 保留给显式 `status:'todo'`; row pitch 收紧 ~15% 并整体居中。 |
| `bubble` | label 一律移到气泡外(右侧偏移+深色字); 气泡改半透明填充+实线描边(不再需要装深色底托白字); 最小半径提到 14px。 |
| `infinity-loop-flow` | 发现节点 t 值分布 bug: n=4(最常见 step 数)时全部落在 π/2 整数倍上, 导致两个节点重叠在中心("Plan" 被"Measure"完全遮住); 加半步偏移修复。同时半轴目标改为画布宽高的 ~70%, 节点/字号按画布尺寸缩放。 |
| `relationship-graph` | 圆形布局按角度均分对小 N 不对称(3 节点=1 上 2 下), 改为算出真实 bbox 后居中+缩放到可用区域 ~85%; 边标签 10px→11px 并加白色描边光晕。 |
| `org-vs-org-matrix` | 所有 org label 统一深色(之前 isUs 用白字, 但位置早已在气泡外, 白字对亮背景几乎不可见); 字号下限提到 12px; 4 个象限改成 4 种不同色相的淡色调(之前 3 个象限共用同一种灰, 只有右上象限略深)。 |

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
- [x] Round 3: P1 × 12 (2026-07-05, branch `sprint-26-round3-p1-atoms`)
- [ ] Round 4: P2 清尾 + 复审全量
