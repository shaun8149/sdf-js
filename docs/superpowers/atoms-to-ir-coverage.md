# atoms → IR 覆盖表 — Sprint 28 (2026-07-06)

`sdf-js/src/scene/scaffold-to-ir.js` 的 `atomToIR()` 把 2D atom SceneData 映射到
IR 5 结构 (sequence / hierarchy / network / magnitude / matrix), 让 3-stage scaffold 管线
的输出直接喂 `assembleDeck` (格斗游戏 cinematic 渲染)。只读 DATA args, 不读 x/y/w/h。

**matrix 是 Sprint 28 新增** (2 维分类 — SWOT / risk likelihood×impact /
cost-benefit) — 目前只有 2D 端消费 (`ir-to-2d.js` + `text-to-ir.js`)，3D 端还
没有 renderer；`deckToIR` 默认把 matrix slide 从 `assembleDeck` 的 `slides` 里
过滤掉（每条打一行 notice），传 `opts.structures` 才会放行。见
[`ir-matrix-proposal.md`](./ir-matrix-proposal.md)。

## 已映射 (40)

**sequence (12)**: change-curve-chart · circle-process-cycle · flow-chart · funnel ·
funnel-with-conversion · journey-flow-curve · kanban-board · maturity-model ·
process-arrows · progression · timeline · vertical-timeline

**hierarchy (6)**: decision-tree-3-arm · mindmap · okr-tree · org-chart ·
sphere-tree · tree-diagram

**network (4)**: circle-image-hub-spoke · radial-wheel-segmented ·
relationship-graph · sphere-network

**magnitude (12)**: bar · column · dashboard-multi-kpi-composite · donut-with-center ·
histogram · isotype-stat-comparison · pie · pyramid · radar-chart · segmented-bar ·
stat-grid-large · waterfall

**matrix (6)**: cost-benefit-matrix · matrix-grid · nine-field-matrix ·
org-vs-org-matrix · risk-heatmap · swot

## 无结构内容, 设计上不映射 (~40)

装饰/文字/单值/形状类 — IR 表达的是"结构", 这些没有:
cover · quote-pull · pull-quote-banner · callout-banner · call-to-action ·
section-number-divider · stat-banner · stat-with-icon · kpi-card · kpi-water-drop ·
testimonial-wall · pillar-3up · feature-card-grid · image · image-split ·
icon-badge · icon-row · icon-grid · bullet-list · agenda-list · number-list ·
numbered-grid · magazine-column-grid · arrow · diamond · cube · gear · circle-frame ·
circle-loop · circle-stack · circle-segmented · cube-grid · cube-segmented ·
gear-cluster · puzzle-pieces · sphere-fill · sphere-segmented · device-mockup-frame ·
device-mockup-row · isotype-people-grid · isotype-prop-row

## TODO (真有结构但 v1 未映射, ~7)

| atom | 候选结构 | 备注 |
|---|---|---|
| fishbone | hierarchy | effect 为根, branches 为子 |
| gantt | sequence | tasks 有起止 — 需要时间轴语义, v2 |
| line / stacked-area / scatter / bubble / break-even | magnitude/sequence | 连续序列数据, magnitude 语义勉强; 等 IR 加 series 结构 |
| value-chain-diagram | sequence | primary 链条可映射, v2 |
| strategy-map / layer-stack / seven-s-model | hierarchy? | 层带模型, 无单根; v2 |
| balance-scale / venn / comparison-table | — | 对比语义, IR 无对应 |
| mountain-path / multiple-arrows / infinity-loop-flow / traffic-light / gauge | sequence/单值 | 边角, 按需 |

## 入口 API

- `atomToIR(subject) → IR | null` — 单 subject
- `slotToIR(sceneData) → IR | null` — 一个 slot 选最富结构的 subject
- `deckToIR(deckDir, opts?) → {title, slides: IR[]}` — 整个 baked deck, assembleDeck-ready.
  `opts.structures` 覆盖 renderer-support allowlist (默认 `RENDERER_STRUCTURES` from
  `render-ir.js`, 即 sequence/hierarchy/network/magnitude); matrix slide 默认被过滤 +
  打印 notice, 传 `{ structures: [...RENDERER_STRUCTURES, 'matrix'] }` 放行
- `parseMagnitude(v)` — "$3.4M"→3400000, "92%"→92, "12,450"→12450

`ir-to-2d.js` 的 smart selection (Sprint 28):
- `chooseMagnitudeAtom(ir) → 'bar' | 'pie' | 'donut-with-center'` — 按数据形状 (parts-of-whole /
  share 语言 / node 数) 挑图表, 不再固定 bar
- `chooseMatrixAtom(ir) → 'swot' | 'cost-benefit-matrix' | 'risk-heatmap' | 'matrix-grid'` — 按
  axes 形状挑 matrix atom

## 证明产物

- `sdf-js/scenes/ir-from-qbr-q3-2026.json` (2 slides: hierarchy + sequence)
- `sdf-js/scenes/ir-from-vc-pitch.json` (5 slides: magnitude×3 + sequence + network)
- 3D 机器打开: `?scene=ir-from-vc-pitch`
