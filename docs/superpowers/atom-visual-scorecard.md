# Atom Visual Quality Scorecard — Sprint 26 baseline (2026-07-05)

Loop 2 (视觉质量循环) 第一次全量评审。方法: `all-atoms-gallery.html` 以 spec.example
args 渲染全部 101 atom (640×360, editorial-light palette), 9 chunk 截图,
多模态逐个对照 PL 质量基准评审。截图: `screens/sprint26-gallery/chunk-*.png`。

评分: ✅ 好 (PL 级) / 🟡 中 (可用但有硬伤) / 🔴 破 (视觉失败, 必修)。
只列 🔴/🟡; 未列出的 ~70 atom 均 ✅。

## 🔴 P0 — 视觉失败 (round 2 必修)

| atom | 问题 |
|---|---|
| `pyramid` | **语义倒置**: Maslow 例子 base 层 (Physiological) 渲染在顶部最宽, 塔尖朝下。惯例是 base 在底。且塔尖层 label 不可读 (白字压小三角)。⚠ 修渲染顺序是视觉契约变更 — 3D twin (pyramid-3d) 同步检查 |
| `feature-card-grid` | 标题溢出卡片 ("Performance"/"Global Reach" 撞右边), body 文本截断到词中 ("with" / "50+") — 无 auto-shrink |
| `gauge` | 指针方向/枢轴错 (指向右下 ~140°), 无数值显示 — 看起来根本没做完 |
| `seven-s-model` | 六边形团簇过小挤在中心, 全部 label 截断 ("Sha…Val…" / "Str…" / "Sys…") 不可读 |
| `numbered-grid` | huge 风格数字与 label 文字重叠 ("2Partner channel"), sublabel 被数字压住 |
| `mindmap` | 节点 label 截断 ("ende." / "Compo…" / "Pipel."), 圆太小, 挤在中心 1/3 区域 |
| `matrix-grid` + `nine-field-matrix` | bubbles arg 渲染在 cell label **之上**遮挡文字 ("Weaknesses" 被 "Stars" 泡遮住 / nine-field 左上 "Invest" 被遮) |

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

- [ ] Round 2: P0 × 7
- [ ] Round 3: P1 × 12
- [ ] Round 4: P2 清尾 + 复审全量
