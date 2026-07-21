# 第七课: INK — Iskra Velitchkova (后期队列)

- **ArtBlocks #497** · p5@1.9 · 45KB · **CC BY-NC-SA 4.0 → recipe-only (SA 传染, 严格)**
- 视觉: 手绘墨迹/炭笔涂鸦 — 密集噪声闭环 + 复笔抖动, 15 种西语命名"笔法"

## 结构

```
Random class     后期标配: 自带 sfc32 (与 Eko33 同代差特征)
笔法目录          drawMacarra / drawCarboncillo / drawGridSuave /
                 drawRamonycajal / drawDomingoMercado / drawDelicado /
                 drawNovia / drawPelo … ~15 种命名笔法, hash 选用 —
                 人格包思想的极端形态: 一件作品 = 家族中的家族
噪声-利萨茹涂鸦   ★ 核心笔画: for e in [0,2π) step 0.001:
                   vertex(cx + noise(cy + sin(e)·freq)·ampX,
                          cy + noise(cy + cos(e)·freq)·ampY)
                 — 闭环参数曲线, 半径被噪声调制 → 手绘涂鸦轮廓
三重顶点复笔      每步在同一 beginShape 里连发 3 个顶点 (基点 + 2 个独立
                 抖动副本 R.r(4)~R.r(44)) 成单笔画内 zigzag, 之后常再来
                 第二个全 pass (噪声相位不同) — 墨迹的"毛边"= 步内三重
                 顶点 × pass 数, 不是"整曲线描三遍"
极端顶点密度      0.001 弧度步进 (部分循环走两圈), 每步 3 顶点 → 单 shape
                 实际 ~1.9-3.8 万顶点 — 质感来自密度 (性能换质感)
shader 后处理     颗粒滤镜 (与 Sediments grainGraphics 同习俗)
```

> 二读勘误 (2026-07-11): 原文核实 (复笔=步内三重顶点 zigzag + 二次 pass),
> 详见 audit/batch-C

## 四个可提取 idiom

1. **噪声-利萨茹闭环**: sin/cos 双相位喂 noise 得 x/y 半径 — 一行公式的
   涂鸦生成器, 圆的"手绘退化"。
2. **顶点级复笔抖动**: 毛边 = 每步基点旁连发抖动副本 (步内 zigzag)
   × 多 pass — Apparitions 影线的稠密版。
3. **笔法目录** (家族中的家族): 15 种命名 manner 共享基础设施、各有参数
   性格 — 我们人格包的极端参照 (v3 若做 per-family manner 可循此)。
4. **密度即质感**: 顶点密度是质感的第一参数 — deck 修饰必须降密
   (0.02 步进 ≈ 314 顶点足够), 性能预算意识。

## Port 判定

- **recipe-only, 严格** (NC+SA): `ink-scribble` 家族 = idiom 1+2 独立重写,
  降密度 (0.02 步进 × 2 遍 × 8-14 个), 角落加权散布, editorial/hr 亲和 —
  手绘感与"人味"主题天然合。
- 笔法目录记入 v3 设想 (per-family manners)。

## 一句话学到的

墨迹感的本质是**误差的分布**: 完美曲线 + 顶点级独立抖动 × 多遍 =
人手的微颤 — 数字复现"手"不靠模拟肌肉, 靠模拟误差统计。
