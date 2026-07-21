# 第三十七课: The Blocks of Art — Shvembldr

- **ArtBlocks #74** · p5 纯 2D · 16KB · CC BY-NC 4.0 → recipe-only
- 视觉: 面板网格, 每格一件独立小构成, 边框纪律严整

## 分流判定: 2D-core, 文档课 (block-mosaic 已覆盖色块领域)

## 值得带走的 idiom

1. **panel = 迷你画布, 挂在立方体的脸上**: 95×110 固定面板是
   基本单元, 但构图**不是平面面板网格** — 是 5×4 错行 hex 格上的
   **等距立方体阵** (isometric cubes): 每个 hex cell 画三张剪切面
   (`shearY(30)` 顶/左、`shearY(-30)` 右、`shearY(30)+shearX(-41)`
   第三面), 各自 clip 后贴一张 95×110 面板。backs = 离屏画布,
   things = 画家 (动画的), images = **每块立方体的三张脸** — 不是
   三个图层。标题 "The Blocks of Art" 的 Blocks 是字面义: 积木块。
   每面仍是带边框的独立小作品, 格内自治 + 格间秩序的张力成立 —
   只是挂画的墙是立方体。
   对 Atlas: 我们的 slide 本身就是 panel — scaffold 多格布局
   (grid/matrix) 里每格的"背景层/主体层/点缀层"纪律可对照。
2. makeHex 六角点集工具: 60° 步进一圈 (起始角 30°) — 与
   hex-lattice (L10) 立方坐标法对照, 极坐标法更短但不能寻址邻居。
3. Shvembldr 量产纪律: 同一 panel 引擎变造型库 (things), 供给端
   复用的作者级样本 (呼应 3-Stage 供给复用 framework)。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-D

## 一句话学到的

网格的高级用法是画廊不是像素: 格内自治、格间秩序, 张力在两者之间 —
Shvembldr 还把画廊叠成了积木。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-D
