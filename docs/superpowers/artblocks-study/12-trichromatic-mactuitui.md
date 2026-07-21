# 第十二课: Trichro-matic — MacTuitui

- **ArtBlocks #482** · 原生 WebGL2 (`#version 300 es`) · 48KB (JS 30KB + frag ~18KB) · CC BY-NC 4.0 → recipe-only

> 二读勘误 (2026-07-11): WebGL→WebGL2; 其余 claim 逐字实锤, 详见 audit/batch-F

## 分流判定: 第三形态偏 shader (CPU 构图 + shader 视觉核)

CPU 侧算多边形网格 + 调色板并作为 uniform 传入 (polyVertices[128] /
paletteAccentArray[50]); 但**视觉核在 fragment shader**: UV warp / wave
warp / spiralize / palette-swap / grid bleed-through 全是 uniform 开关的
shader 变换。与 Cytographia (L9, 2D 构图 + shader 材质) 相比, 这里 shader
不只是材质 — 它决定构图的最终形变。→ 文档课, 不 port。

## 带走的 recipe (2D 侧即用)

**具名调色板 + 主题标签纪律**: 每个调色板是完整对象
`{name:"Chalks", theme:"Calm", bg/highlight/lowlight/line/stroke/base/accent[]}`
— 调色板有名字、有性格标签 (Calm/Assertive/Rich/Toasty/Chilled)、有**角色分工**
(线/底/强调各就各位), 而非裸色数组。这正是我们 personality bundle 的调色板版:
颜色按整包铸造, 角色约束防止"强调色当背景"的乱用。

## 移交 3D 端

UV warp 字典: waveWarpX/Y (轴向波位移) + uvSpiralize (极坐标螺旋化) +
paletteSwapWarp (空间分区换调色板) — 全是 fragment 后处理 idiom, 可进
shader idiom registry 的 post-process 类。

## 一句话学到的

调色板不是色数组, 是"有名字、有性格、有角色分工"的完整对象。
