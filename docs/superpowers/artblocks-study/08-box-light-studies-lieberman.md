# 第八课: Box Light Studies — Zach Lieberman (后期队列)

- **ArtBlocks #499** · p5 (WebGL) · 41KB · **CC BY-NC 4.0 → recipe-only**
- 视觉: 旋转盒体的棱线化作柔光 — 渐变光线、辉光边缘、空气感

## 结构 — shader 艺术穿着 p5 外衣

```
盒体几何          rotateX/Y/Z 三函数 + 棱线投影 → 每条棱 = (ptA, ptB, colorA, colorB)
line shader      每条棱交给 fragment shader: 沿线渐变双色 + 光晕
距离场管线 ★      多 pass framebuffer 链:
                 initShader (线画入 fbo) → iterShader (jump-flood 传播:
                 3×3 邻域找最近种子) → voroShader (spiral 搜索补洞 +
                 距离衰减) → distShader (距离→亮度) — GPU 版
                 "到最近线段的距离场", 柔光 = 距离的函数
稀有度/settings   colorMode / seethrough 等 hash 决策
```

这是全队列第一件**本质上是 shader 作品**的课: 美学核心 (柔光) 完全住在
GLSL 距离场里, p5 只是宿主。

## 双供给线的分流判定 (本课最重要的产出)

- **→ 3D 端 (shader 语料)**: jump-flood 距离场 + spiral 补洞搜索 +
  "光 = 到几何的距离衰减" — 完整 recipe 应该进 3D 端的 shader idiom
  registry (他们已有 67 idiom 基础)。已在本文档记录管线解剖, 待 3D 端
  接力时移交。
- **→ 2D 端 (canvas 近似)**: 取视觉概念不取机器 — "盒棱作为发光渐变线"
  用分层淡笔画近似辉光 (宽淡 → 窄亮 三层), 双色沿棱插值。
  = `light-edges` 家族。

## 三个可提取 idiom (2D 侧)

1. **棱线即光源**: 构图单位不是面而是棱 — 线框的"光化"。
2. **分层辉光**: 同一线段 宽×低α → 窄×高α 层叠 = 无 shader 的 glow。
3. **双色棱**: 每条棱两端各取一色、沿线渐变 (2D 近似: 分段插值)。

## 一句话学到的

Lieberman 把"光"翻译成"距离" — 柔光不是画出来的, 是**场算出来的**;
2D 端学它的构图 (棱线即光源), 把场留给拥有 GPU 的 3D 端。
