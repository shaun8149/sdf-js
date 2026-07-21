# 第六课: Neural Sediments — Eko33 (后期队列第一课)

- **ArtBlocks #418** · p5 · 77KB (含 40KB polygonClipping 库) · **CC BY-NC 4.0 → recipe-only**
- 视觉: 地质沉积剖面 — 层叠噪声悬崖, 严格遮挡, 颗粒质感

## 结构

```
Random class     ★ 自带全套确定性数学栈: 双 sfc32 (hash 前后两半各喂一个)
                 交替取数 + 1e6 次预热 + 自实现 Gaussian (Marsaglia polar,
                 即 p5 randomGaussian 克隆) + 自实现 Perlin (用自己 PRNG
                 填表) — 对平台随机零信任
token 0 特判      mintNumber==0 → 固定 hash (artist proof 固定作品)
cliff()          逐层生成悬崖多边形: top 边是**向量随机游走**
                 (truncatedGaussian 转向, 角度上限 120-140°, 可倒走出
                 悬垂 overhang) + 高度 → 面片; Perlin 只用在渲染层
                 (线的 alpha/摆动), 不是 noise(x) 折线
polygonClipping  union/difference 做背面剔除 + 层间严格遮挡 (真多边形布尔)
drawFrame1/2/3   分帧渲染 (4 帧一轮) — 但三帧**各自 clear + 重画一版
                 不同场景** (frame2 用 DIFFERENCE 复合, frame3 BLEND 叠
                 grain+cracks 版): 分帧是多 pass 视觉复合, 不只是性能分摊
grainGraphics    颗粒纹理后处理缓冲
massExport       ★ 内嵌批量导出装置: 自动换 hash → 重渲染 → 存图 → 循环
                 (作者把 variation 测试仪器写进作品本体)
```

> 二读勘误 (2026-07-11): 原文核实 (cliff top = 随机游走可悬垂;
> 分帧 = 多 pass 复合), 详见 audit/batch-C

## 后期 vs 早期的代差 (第一手观察)

早期 (Fidenza/Archetype/Apparitions): 信任 p5 randomSeed/noiseSeed。
后期 (#418): **自带 PRNG + 自带 Gaussian + 自带 Perlin + 预热**, 对平台
零信任 — 三年间社区把"确定性"从约定升级成了工程学科。我们的 freeze
纪律 + 自带 noise2D 恰好走在同一路线上, 这课是行业最佳实践的确认。

## 四个可提取 idiom

1. **层叠噪声地平线 + 前层遮挡**: 每层一条噪声折线向下填充, 从后往前画,
   前层用不透明混合底色遮住后层 — 山峦/沉积剖面。轻量重写可达 (不需要
   多边形布尔 — painter 序 + 与 bg 混合的填充即可)。
2. **双 PRNG 交替**: 相邻决策去相关 (单流的 lag-1 相关性被打散)。
3. **token 0 固定 hash**: artist proof 惯例 — 我们 demo-fixed-hash 同构。
4. **内嵌 variation 装置** (massExport): 作品自带"换 hash 批量出图"测试
   循环 — 直接启发本课落地的 decor-gallery.html (全家族 × N hash 全家福)。

## Port 判定

- **recipe-only**: `sediment-layers` 家族 = idiom 1 独立重写 — 层叠噪声
  地平线填充剖面, 与 strata-lines (线束) 形成 填充/线条 对偶。
  organic/editorial/financial 亲和; bold 封面 = 山峦剪影。
- idiom 4 落地为仪器: `examples/atoms-2d-demo/decor-gallery.html`。

## 一句话学到的

成熟的生成艺术家把**测试仪器写进作品本体** — massExport 不是功能是方法论:
作品的质量来自作者看过它的一千种变体。
