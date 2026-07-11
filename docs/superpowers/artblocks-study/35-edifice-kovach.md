# 第三十五课: Edifice — Ben Kovach

- **ArtBlocks #204** · 原生 js · 28KB · CC BY-NC 4.0 → recipe-only
- 视觉: 建筑立面式网格构成, 晶体/等距视角变体

## 分流判定: 2D-core, 文档课 (变换管线思想 > 单一视觉)

trait 字符串即架构图: **Tear / Perspective / Sharp / Wave / Torus /
Fold / Shift / Turn / Twist / Squish / Isometrize** — 一柜具名网格
变换算子; 填充器也具名 (MidpointWalkFill); 距离度量可换
(**Manhattan / Chebyshev**); 材质有 Bismuth (铋晶体)。
作品 = 网格 × **各轴单抽**: 变换是一次加权抽签出的标量 trait
(switch 返回一个变换函数), 正交轴 = 变换 × 填充器 × 度量 × 轴向
各抽一次 — **不是可组合的算子链**。与我们家族重叠的是产物
(块/网格), 不重叠的是**生成器架构**。

> 二读勘误 (2026-07-11): 原文核实 (单抽正交轴, 非算子序列),
> 详见 audit/batch-G

## 值得带走的 idiom

1. **具名算子柜**: trait 不是参数值, 是"施加了哪个变换" —
   Edifice 的一个 mint = 网格 + 从加权表单抽一个变换 (Sharp 10 /
   Wave 10 / … / Isometrize 0.2) + 各正交轴各抽一次。与 L13 Naïve
   的"算子柜=性格"同宗: 算子有收藏者可读的名字。注意: 是**单抽
   正交轴**, 不是"[Fold, Twist, Isometrize] 算子序列"的可组合
   管线 — "组合即 trait"的组合发生在轴间 (变换×填充器×度量),
   不在算子链内。decor v3 若做"变换层"可采。
2. **距离度量当 trait**: 同一算法换 Manhattan/Chebyshev 度量 =
   两种城市肌理 — 一行代码的 trait 轴 (我们 3D 端 SDF 域同理:
   L2 范数换 L∞ 即圆变方)。
3. Isometrize 是变换抽签表里的稀有选项 (权重 0.2, 确为等距投影),
   不是叠加在其他算子之后的末端 stage — 伪 3D 是抽签的一签,
   不是管线的一站。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-G

## 一句话学到的

把变换起成名字, 抽签就成了 trait — 生成器的词汇表就是收藏的说明书。
