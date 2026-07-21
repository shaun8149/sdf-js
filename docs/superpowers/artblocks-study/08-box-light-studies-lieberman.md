# 第八课: Box Light Studies — Zach Lieberman (后期队列)

- **ArtBlocks #499** · p5 (WebGL) · 41KB · **CC BY-NC 4.0 → recipe-only**
- 视觉: 旋转盒体的棱线化作柔光 — 渐变光线、辉光边缘、空气感

## 结构 — shader 艺术穿着 p5 外衣

```
盒体几何          rotateX/Y/Z 三函数 + 棱线投影 → 每条棱 = (ptA, ptB, colorA, colorB)
line shader      活 shader 的棱色 = 三通道 simplex noise 按 lineId 键控 +
                 doubleExponentialSigmoid 整形 (彩虹微渐变); "沿线渐变双色"
                 的 shader D 是**弃用代码** (createShader 返回值未接,
                 colorA/colorB 恒传白/黑且活 shader 不声明该 uniform)
距离场管线 ★      多 pass framebuffer 链:
                 initShader (线画入 fbo) → iterShader (jump-flood 传播:
                 3×3 邻域找最近种子) → voroShader (spiral 搜索补洞 +
                 距离衰减) — GPU 版"到最近线段的距离场"。
                 distShader (距离→亮度) 是**死代码** (仅 createShader,
                 全文无第二处引用); 真实柔光 = 沿距离场 100 步 2D raymarch
                 × 每像素 8 方向随机射线 × 累积 250 帧的渐进式 2D 光传输
稀有度/settings   seethrough (0-1) 与 look (int 0-10, 直接字符串替换进
                 shader 的 11 档形态开关) 是真 hash trait;
                 colorMode/drawMode/palette 均 min==max 恒为常量
```

> 二读勘误 (2026-07-11): 原文核实 (distShader/双色渐变 shader 均死代码;
> 真柔光 = 8 射线 × 250 帧 raymarch 累积; 真开关是 look), 详见 audit/batch-D

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
   **归因限定**: 这条读的是原作的弃用 shader D — 链上实际渲染的棱色
   是 noise 场渐变, 从不出现"两端两色"分段。light-edges 家族的双色棱
   效果自立, 但不再以"复刻原作机制"叙述。

   > 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-D

## 一句话学到的

Lieberman 把"光"翻译成"距离" — 柔光不是画出来的, 是**场算出来的**;
2D 端学它的构图 (棱线即光源), 把场留给拥有 GPU 的 3D 端。
