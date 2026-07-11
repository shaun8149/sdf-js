# 第一课: Fragments of an Infinite Field — Monica Rizzolli

- **ArtBlocks #159** · p5@1.0.0 · 738 行 · **CC BY (全语料唯一可商用 code-port, 需 attribution)**
- 视觉: 四季花田 — 各向异性草叶场 + 程序化花朵 + 天气叠加 (雨/雪)
- 语料: `~/Documents/artblocks/curated/159-fragments-of-an-infinite-field-by-monica-rizzolli/`

## 结构 (自上而下)

```
semente()    hash → 32 个 0-9 决策位 (每 2 个 hex 字符 mod 10)
variaveis()  决策位 → 参数: linha 93-107 / col 20-39 (二者是**格子尺寸
             除数**, 实际画布网格 ≈ linha 列 × 10·col 行, 因纵向
             translate 除以 fy=10) / 噪声系数 / 四季选择 /
             每季 2 套手调 5 色板 (叶色 corFolhas × 花色 corFlor)
folhas(chance)  草叶场: 密集网格逐格 → 噪声驱动旋转 + 各向异性椭圆 (fx=1, fy=10)
flor()       花对象: petalaPlot/petalaOut/corona/stamen 四层构造
chuva()/neve()  天气叠加: 夏雨 (斜线束) / 冬雪 (白点)
play()       花朵绘制; 仅秋季 85% 概率多画一层 petalaOut (春夏冬顺序相同);
             草叶场画两遍 (花前浓/花后疏) 制造纵深
```

> 二读勘误 (2026-07-11): 原文核实 (网格行数 / 季节仅影响秋季一层),
> 详见 audit/batch-A

## 六个可提取 idiom (按对 decor 层的价值排序)

1. **hash → 32 决策位**: 每个美学决策一个独立 digit — 正交变化轴。我们的
   `seedFromHash` 把 hash 坍缩成单个 int, 这是直接升级: 一个 hash 供给
   家族选择/密度/方向/色板变体各自独立的 digit。
2. **噪声索引色板** `fill(cor[floor(a * cor.length)])` — 颜色由**空间噪声**索引
   而非独立随机 → 相邻元素同色成片, 有机色块而非均匀噪点。我们 weave-dashes
   目前逐格独立取色, 该学这个。
3. **噪声门控密度** `if (a2 < chance)` — 元素存在性也由噪声场决定 → 疏密成片。
4. **各向异性椭圆场** (fx=1, fy=10 拉长 + 噪声旋转) = 草叶/织物质感 —
   新家族候选 **meadow-streaks**, 低透明度下极适合 deck 背景。
5. **季节色板系统**: 1 个 digit 选季节 + 每季 2 变体 — 结构化的"情绪"分层。
   映射到 deck: theme 定大方向, hash 在 theme 内选变体。
6. **双层场纵深**: 主体前画浓场、主体后画疏场 — 封面修饰可用 under+over 两遍。

## Port 判定

- **可 code-port (CC BY + attribution)**。第一优先: `meadow-streaks` 家族
  (idiom 3+4+2 的组合, ~60 行), attribution 头注明 Rizzolli/#159/CC BY。
- 决策位机制 (idiom 1) 升级 `decor/registry.js` 的 hash 消费方式, 全家族受益。
- 花朵构造 (petala/corona/stamen) 对修饰层过于具象, 不 port; 天气叠加留作
  accent 家族候选。

## 一句话学到的

把"一个 hash"当成 **32 个独立旋钮** 而不是一颗种子 — 变化空间从一维变成
32 维正交格, 这是 fxhash 系作品"同一算法千姿百态"的核心机制。
