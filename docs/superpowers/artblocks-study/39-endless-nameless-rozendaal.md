# 第三十九课: Endless Nameless — Rafaël Rozendaal

- **ArtBlocks #120** · 原生 js · **3.0KB (全语料最小级)** · CC BY-NC-ND 4.0 → 严格 recipe-only
- 视觉: 纯平色块分割, Mondrian 血统的网页极简主义

## 分流判定: 2D-core, 文档课 (block-mosaic 覆盖 + ND 从严)

## 值得带走的 idiom

1. **色对目录带权重与组名**: `groups: [{name:"two-colors", weight:3,
   pairs:[13对]}, {name:"white+color", weight:1,…}]` — 颜色不是
   参数是**策展过的关系** (成对出现, 组有名字有权重)。加权 trait
   表 (L33) 的配色版, 第二目击 → 记入 v2 清单: 我们的主题色也可
   预策展"色对"而非单色抽签。
2. **rects 数量阶梯**: [1,2,3,3,3,5,5,5,5,5,9,9,9,9,13,16,36,72]
   — 重复即权重, 数组即分布 (无需 weighted 函数, 查表就是抽签)。
   1 块与 72 块同在目录里 = 极简与密集是同一作品的两端。
3. 3KB 含动画 (speed/stops) — Rozendaal 的"网站即作品"美学:
   每个字节都有名字。

## 一句话学到的

分布可以就是一个数组: 重复元素即权重, 查表即抽签 — 最短的加权随机。
