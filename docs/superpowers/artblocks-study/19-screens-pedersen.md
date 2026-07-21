# 第十九课: Screens — Thomas Lin Pedersen

- **ArtBlocks #255** · 原生 js (canvas2d + WebGL 混合) · 14KB · CC BY-NC 4.0 → recipe-only
- 视觉: 密排线网屏, 沿折痕折叠的伪 3D 帷幕, 近单色克制

## 分流判定: CPU 构图 + GPU riso 合成 → 2D 队列, 出家族

最终显示 program 确是一行 `gl_FragColor = texture2D(u_t, v_t)`, 但
那只是末端 blit — 真正的**每层合成 shader 是动态拼串的** (stegu
simplex + fbm8/fbm6/fbm1): 纸纹 (fbm 双频叠加)、边缘扰动 (fbm 微位移)、
网屏化 (`smoothstep(tex-0.15, tex, sc)` 把 CPU 灰度 mask 转成 riso
质感彩墨), 外加变体的斑点罩层与逐层套印偏移/旋转 (misregistration)。
CPU 画的是灰度渐变 mask, **一半的艺术在 GPU**。CPU 侧: 线段链表结构 +
一次全局绕 x 轴 -π/5 旋转 (透视缩短) + 每段灰度 `rgb(255e,…)`; 折叠感
来自链条转向 + 逐段向下挤出的四边幕布 + 沿链灰度渐变 + BSP 二叉深度树
排序 (painter's algorithm) 遮挡。PRNG 是 xorshift128 (Marsaglia), 不是
sfc32。ggplot2 作者的作品, 一如其人: 极简数据结构, 全部克制。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-B

## 解剖 (recipe)

1. **屏 = 单一对象**: 一屏是一整片密排平行线光栅, 被当作单个可折叠
   实体操作 — 不是 N 条独立线。折痕把屏切成 facet。
2. **折叠 = 每-facet 着色, 不是透视数学**: facet 各有斜率 + 亮度,
   人眼把亮度差读成朝向差 — 伪 3D 的最低成本实现。
3. **层间交叠是几何的, 不是光学干涉**: 层合成是 `mix(col,bg,g)`
   **不透明套印**, 无 alpha 叠加; 交叠处либо在交点截断, либо剪掉
   交点周围 5 段造成穿插空隙 (真正的"编织让位"), 深度由 BSP 二叉树
   排序决定 — 不存在"半透明叠加密度拍频 (moiré)"机制。
4. hash → 自实现 xorshift128 (Marsaglia; `r^=r<<11` 系) — 又一个
   "平台随机零信任"样本 (与 L1 结论互证)。sfc32 是 L21 Tide
   Predictor 的写法, 两者不同。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-B

## Port: folded-screens 家族 (registry.js, DECOR_V=1 下新增)

2-3 屏 × 每屏 1-3 折痕 × facet 斜率/亮度, 折线是逐 facet 连续的多段线。
人格 = 屏数 × 线距 × 折痕数 × 斜率幅度。适配 editorial/financial
(纸感/织物感)。零代码复制。

## 一句话学到的

伪 3D 折叠不需要投影矩阵 — 斜率给形, 亮度给朝向, BSP 排序给深度。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-B
