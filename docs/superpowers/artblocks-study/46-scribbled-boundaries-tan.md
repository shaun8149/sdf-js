# 第四十六课: Scribbled Boundaries — William Tan

- **ArtBlocks #131** · p5 纯 2D · 23KB · **NIFTY License → 纯研究, 零 port**
- 视觉: 手涂鸦线场, 边界处笔意反复

## 分流判定: 2D-core, 纯研究文档课 (ink-scribble 已占涂鸦领域)

## 值得带走的 idiom (思想层)

1. **hash 字节查表二段跳**: `rp = hi.slice(0,9).map(v => sp[v*(sp.length-1)/255])`
   — 字节先归一再查**手调档位表** [40,40,70,120,…,220]: 表里重复
   40 与 L39 "数组即分布"同技, 槽位派 + 查表分布的组合拳。
2. **graphics[] 多层离屏**: 每层独立 createGraphics 再合成 —
   层是一等公民, 我们 renderer 的 decor-under/over 分层同构。
3. 涂鸦的"边界反复": 笔在形状边缘折返加密 — 密度即轮廓, 无需
   描边 (与 stipple/hatch 家族的轮廓策略同宗)。

## 一句话学到的

轮廓可以不画: 让笔在边界处折返, 密度自己会说出形状。
