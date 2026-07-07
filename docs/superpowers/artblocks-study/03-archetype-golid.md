# 第三课: Archetype — Kjetil Golid

- **ArtBlocks #23** · p5 · 13.9KB minified · **CC BY-NC 4.0 → recipe-only**
- 视觉: 等轴测块体构成 — 嵌套网格里的彩色矩形块, 三面受光, 42 套手调色板
- 更正: 前两课记录的"语料空文件"是误诊 (`wc -l` 对单行 minified 返回 0),
  语料 108 项 100% 完整

## 结构

```
rnd()          xorshift32 (seed^=seed<<13 / >>17 / <<5) — 最小可用 PRNG
w_pick(arr,w)  加权选择 (累计和数组) — Golid 全部决策的基本算子
布局人格        chaos/balance/pattern 三套参数包, w_pick([1,4,2]) 加权抽取
Apparatus      ★ 他的招牌开源生成器: 细胞生长状态机长出紧密矩形填充
               next_block: 延伸水平块/延伸垂直块/开新块 (概率驱动),
               linegrid → NW 角点 → 矩形
颜色模式        group/main/single/random + group_size —
               "group": 新块以概率继承邻块颜色 → 颜色连片成组
嵌套网格        外层 Apparatus 分区 → 每区内层 Apparatus 原子块 (+量化深度 z1)
等轴测投影      xu/yu/zu 三单位向量, 每块画三面, 面透明度组合 = 明暗人格
painter 排序   块重叠图 toposort — 严格正确的遮挡顺序
42 套色板      手调 {c[], s 描边, b 底色, w 权重}, w_pick 按权重抽
```

## 五个可提取 idiom

1. **Apparatus 矩形填充** (最重要): 细胞生长状态机产出的"紧密但不规则"
   面板布局 — 视觉上是 Mondrian 有机版。decor 之外, 这个生成器对
   **slide 面板布局本身**都有启发 (未来 layout 引擎候选)。
2. **邻块颜色继承** (group 模式 + group_size): 颜色分组不靠噪声索引
   (Rizzolli 式) 而靠**结构继承** — 新块以概率继承邻块色。块状构图里
   这是正确的形态: 色块连片、边界清晰。
3. **人格 = 加权参数包**: chaos/balance/pattern 整包抽取, 而非逐参数
   独立随机 — 保证参数间协调, 人格分明。我们 decor 家族的 intensity
   只有一维, 该学: 每家族定义 2-3 个"人格包"由 hash lane 抽取。
4. **w_pick 累计和加权** — 与我们 lane 引擎的 weighted() 相同, 互证。
5. **量化深度 + 三面受光**: depthSteps=8 的 z 量化 + 面透明度组合 —
   留作未来 pseudo-3D 块修饰参考, v1 不做 (平面块更安全)。

## Port 判定

- **recipe-only** (CC BY-NC): 新家族 `block-mosaic` = idiom 1+2 独立重写
  (细胞生长矩形填充 + 邻块颜色继承), 平面、低透明度、subtle 全幅 /
  bold 封面。pitch/consulting 亲和 (面板感与商务 deck 天然契合)。
- idiom 3 (人格包) 记为 decor 引擎 v2 的候选升级 (需要新 lane, 加而不改,
  冻结纪律兼容)。

## 一句话学到的

Golid 的构成感来自**生长而非切分** — 矩形不是把画布递归切出来的,
是从细胞状态机里长出来的; "有机的秩序"与"规则的秩序"的差异正在于此。
