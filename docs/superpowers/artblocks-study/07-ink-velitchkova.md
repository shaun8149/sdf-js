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
三遍复笔          同一曲线画 3 遍, 每顶点独立随机偏移 (R.r(4)~R.r(44)) —
                 墨迹的"毛边"= 顶点级抖动 × 遍数
极端顶点密度      0.001 弧度步进 ≈ 6283 顶点/遍 — 质感来自密度 (性能换质感)
shader 后处理     颗粒滤镜 (与 Sediments grainGraphics 同习俗)
```

## 四个可提取 idiom

1. **噪声-利萨茹闭环**: sin/cos 双相位喂 noise 得 x/y 半径 — 一行公式的
   涂鸦生成器, 圆的"手绘退化"。
2. **顶点级复笔抖动**: 毛边 = 同曲线多遍 × 每顶点独立小偏移 —
   Apparitions 影线的稠密版。
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
