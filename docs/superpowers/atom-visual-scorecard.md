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

## ✅ Fixed in round 4 (2026-07-05)

全部 6 个 P2 已修复, 外加全量复审中发现的 2 个新问题, 每项均重渲 gallery + 多模态
截图确认。详见各 commit message (branch `sprint-26-round4-p2-cleanup`)。

| atom | 修了什么 |
|---|---|
| `bar` | targetLine 的竖直参考线永远贴着 title band 顶部绘制标签, 与标题碰撞。改为在图表底部预留一个小 band(bars 布局用缩小后的 chartHeight), 参考线 + 其"Target"标签移到最后一根 bar 下方, 不再挨着标题也不再压在 bar 上。 |
| `histogram` | 标题高度只按固定 h*TITLE_FRAC 预留, milestone 标注("Median")又画在 plotT 上方, 双重挤压导致标题被压。改为按标题实际字号预留 band, 再为 milestone 标签额外加高度预留, 标注本身从"画在 plotT 上方"改成"画在 plotT 下方"(标题区域内绝不会再出现标注文字)。 |
| `arrow` / `diamond` | 单形状+caption 作为 hero 表现力弱。形状目标尺寸改为画布高度的 ~55%(此前受限于过度保守的 caption band, 实际远小于此); caption 换成 Inter 700 / ~h*0.07 大字号 + 强调色下划线条, 两个孪生 atom 统一处理。 |
| `radial-spoke` | 各 spoke 只有分类 label, 看不出具体数值。沿着每根 spoke 的辐条方向、在靠近端点前(不越过端点)渲染该 spoke 的值(0-1 归一化 → 百分比), 白色描边光晕(strokeText)保证在任何 spoke 颜色上都可读, 内嵌位置避免与外侧分类 label 重叠。 |
| `sphere-network` / `sphere-tree` | 球面上的 label(hub label / 大节点内嵌 label)固定用白色填充, 在浅色球体上几乎不可见。改成: 深色前景字 + 白色描边光晕(strokeText, 3px, alpha 0.8)在填充下方, 无论球体本身颜色深浅都能读。同时给所有 label(hub / satellite / tree node)设 11px 最小字号下限。 |
| `image` / `image-split` | spec example 的 src 是 1×1 data URI PNG, gallery 格子渲染空白。换成一个小的内联 SVG(渐变天空 + 山脉剪影, ~300 字节, 显式 width/height 让 naturalWidth/naturalHeight 在 'cover' fit 下正确解析)。**仅改了 example, atom 代码本身未动** — 但验证时顺手发现 image.js 只在 borderRadius>0 时才裁剪到自己的 [x,y,w,h] 盒子, 'cover' fit 天然会画到盒子外(最明显的是 image-split 里图片会画到文字侧面板上), 因此额外修了: 始终裁剪(borderRadius=0 时用矩形裁剪)。 |

**全量复审(见下)额外发现并修复的 2 个新问题**(非原 P2 清单, 属于本轮 fix-forward):

| atom | 修了什么 |
|---|---|
| `strategy-map` | `fitFontSize` 字号收缩到 9px 下限后仍不截断 —— 旋转 90° 的透视 label("Internal Process" / "Learning & Growth")在 9px 时依然超出行高约束(maxW=rowH), 导致文字溢出到相邻行。新增 `truncateToWidth()` ellipsis 截断, 作为 fitFontSize 之后的兜底, row label 和卡片 item 文本都套用。 |
| `change-curve-chart` | 首尾 phase 的点恰好落在 plotL/plotR 上, 居中绘制的 label/description 在文字较长时("Integration" / "New normal achieved")会溢出画布边缘, 被 gallery 格子裁掉。改为首尾 anchor 到内侧(textAlign left/right)而非居中; 同时给每个 phase 的 label/description 按可用 slot 宽度(相邻 phase 间距, 居中的拿满宽度的一半在每一侧, 边界的按同样单侧预算)做 ellipsis 截断 —— 只改 anchor 不截断会把溢出问题转移到相邻 phase 的地盘, 必须两者都做。 |

## Round 2 计划

1. 修 7 个 P0 (pyramid 倒置需先确认视觉契约 + 3D twin 一致性)
2. 通用修法优先: auto-shrink helper 已存在 (fitFontSize), P0 里 feature-card-grid /
   numbered-grid / mindmap / seven-s-model / flow-chart 都是同一类 "无 shrink" 病
3. 重渲 gallery → 对照本 scorecard 复核 → 更新状态

## 认证状态 (2026-07-05 full re-audit)

Round 4 结束后对全部 101 个 atom 做了完整复审: 9 个 chunk(from/to 步长 12, 最后一个
11 个 atom)全部重渲 + 1400×2400 截图 + 逐张多模态人工看图, 截图见
`screens/sprint26-gallery/audit2-*-*.png`。

**101/101 atoms ✅ PL-grade** — 复审中发现的 2 个新问题(strategy-map 行 label 溢出、
change-curve-chart 首尾 phase label 溢出画布)已在本轮当场修复并重新截图验证(不留到
下一轮)。

已知的、评估后判定为"设计层面可接受, 非 bug"、不阻塞认证的细节:

- `nine-field-matrix` / `matrix-grid`: bubble 的外置 label(如 "A")紧贴 bubble 右下角,
  与所在 cell 的大号 label 尾部略有视觉拥挤, 但两者颜色/字重区分明显, 依然可读。
  round 2 已做过一次这类修复(bubble label 移到泡外), 这是同一设计下的正常边界情况,
  不是新退化。
- `segmented-bar`: 窄分段(如 10% 的 "Other")不显示条内 label, 只在下方图例出现 ——
  这是 `MIN_LABEL_W` 保护性 fallback 的预期行为(避免文字挤爆过窄的分段), 不是 bug。

## 状态

- [x] Round 2: P0 × 7 (2026-07-05, branch `sprint-26-round2-p0-atoms`)
- [x] Round 3: P1 × 12 (2026-07-05, branch `sprint-26-round3-p1-atoms`)
- [x] Round 4: P2 × 6 + 全量复审认证 101/101 (2026-07-05, branch `sprint-26-round4-p2-cleanup`)
