# 第三十七课: The Blocks of Art — Shvembldr

- **ArtBlocks #74** · p5 纯 2D · 16KB · CC BY-NC 4.0 → recipe-only
- 视觉: 面板网格, 每格一件独立小构成, 边框纪律严整

## 分流判定: 2D-core, 文档课 (block-mosaic 已覆盖色块领域)

## 值得带走的 idiom

1. **panel = 迷你画布**: 95×110 固定面板, 每格是**带边框的独立
   小作品** (backs/things/images 三层结构) — 不是"网格填色"而是
   "画廊挂画"。构图张力来自格内自治 + 格间秩序的对比。
   对 Atlas: 我们的 slide 本身就是 panel — scaffold 多格布局
   (grid/matrix) 里每格的"背景层/主体层/点缀层"三层纪律可对照。
2. makeHex 六角点集工具: 60° 步进一圈 — 与 hex-lattice (L10)
   立方坐标法对照, 极坐标法更短但不能寻址邻居。
3. Shvembldr 量产纪律: 同一 panel 引擎变造型库 (things), 供给端
   复用的作者级样本 (呼应 3-Stage 供给复用 framework)。

## 一句话学到的

网格的高级用法是画廊不是像素: 格内自治、格间秩序, 张力在两者之间。
