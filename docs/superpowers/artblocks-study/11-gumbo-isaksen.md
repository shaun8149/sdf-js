# 第十一课: Gumbo — Mathias Isaksen

- **ArtBlocks #462** · 原生 WebGL2 (js 壳) · 15KB · **CC BY-NC 4.0 → recipe-only**
- 视觉: 有机软体 blob 场 — 圆角观感几何体的柔融堆积

## 分流判定: shader-core, 且是 SDF raymarch (→ 3D 端最高优先移交)

15KB 里绝大部分是打包成 JS 字符串的 GLSL: 值噪声 vn() / fbm / 盒体与
圆柱 SDF / mat3 旋转对齐 / 角度量化 (棱柱化) / smooth-min 柔融。
这是**伪装成 js 的 SDF raymarch 作品** — 恰好是 Atlas 3D 端的本垒
(sdf3.glsl + 67 shader idiom 的同族)。

**移交价值 (最高优先)**: Gumbo 的 SDF 组合词汇 — 旋转盒 rc() (r 为
rotated, 无圆角参数; "圆角感"实来自 o()/dc() 的 tube 截面半径 +
smin 柔融) / 带轴对齐的 e(v,f,y) 旋转 / 角度量化棱柱 o() /
soft-min 堆融 (指数 smin, k=22) — 可以直接对照进 3D 端的 primitive
家族; 它的"有机软体感"= tube 半径 + smin 系数的调音, 是现成的
material/form 调参 recipe。

> 二读勘误 (2026-07-11): 原文核实 (rc=旋转盒非圆角盒; WebGL2),
> 详见 audit/batch-F

## 2D 侧判定

不 port — 2D metaball 逐像素成本高, 有机感已有 circle-pack/wash-flow
覆盖。本课为纯文档课。

## 一句话学到的

SDF 生成艺术已经登上 ArtBlocks Curated — 我们的 thesis ("SDF 风格模板
库") 与生成艺术最高殿堂的语言是同一门。
