# 第三十五课: Edifice — Ben Kovach

- **ArtBlocks #204** · 原生 js · 28KB · CC BY-NC 4.0 → recipe-only
- 视觉: 建筑立面式网格构成, 晶体/等距视角变体

## 分流判定: 2D-core, 文档课 (变换管线思想 > 单一视觉)

trait 字符串即架构图: **Tear / Perspective / Sharp / Wave / Torus /
Fold / Shift / Turn / Twist / Squish / Isometrize** — 一柜具名网格
变换算子; 填充器也具名 (MidpointWalkFill); 距离度量可换
(**Manhattan / Chebyshev**); 材质有 Bismuth (铋晶体)。
作品 = 基础网格 × 抽签组合的算子链 — 与我们家族重叠的是产物
(块/网格), 不重叠的是**生成器架构**。

## 值得带走的 idiom

1. **具名算子管线**: trait 不是参数值, 是"施加了哪些变换" —
   Edifice 的一个 mint = 网格 + [Fold, Twist, Isometrize] 这样的
   算子序列。与 L13 Naïve 的"算子柜=性格"同宗但更进一步: 算子有
   收藏者可读的名字, 组合即 trait。decor v3 若做"变换层"可采。
2. **距离度量当 trait**: 同一算法换 Manhattan/Chebyshev 度量 =
   两种城市肌理 — 一行代码的 trait 轴 (我们 3D 端 SDF 域同理:
   L2 范数换 L∞ 即圆变方)。
3. Isometrize 作为末端算子: 平面构成最后一步推成等距视角 —
   伪 3D 是管线的一站, 不是重写。

## 一句话学到的

把变换起成名字, 组合就成了 trait — 生成器的词汇表就是收藏的说明书。
