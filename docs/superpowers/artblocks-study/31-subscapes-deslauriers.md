# 第三十一课: Subscapes — Matt DesLauriers

- **ArtBlocks #53** · 原生 js · 17KB · CC BY-NC 4.0 → recipe-only
- 视觉: 层叠地形剖面 + 影线, 印刷海报感

## 分流判定: 2D-core, 文档课 (血统已在库)

Subscapes 的地层/影线 idiom 我们 2024-25 已经通过 Topo 渲染器 port
继承 (见 project_topo_crayon_ports_complete), 修饰侧由 strata-lines
(L5) / sediment-layers (L6) 覆盖 — 本课补的是**语料考古**。

## 考古发现

1. **OKLab 早期采用者 (语料第二目击)**: #53 (2021!) 内嵌完整
   oklab→sRGB 矩阵 — 比 while true (L10, 2023) 早两年。DesLauriers
   是 OKLab 布道者本人 (其博客即出处之一)。感知均匀渐变在顶级作者
   处是标配不是新潮 — 我们 lerpColorOklab 的选择再获印证。
2. **BSP 剖分带长宽比导航**: 递归切矩形时, 切向由当前块的 o/c
   (宽高比) 加权决定 — 高块竖切、宽块横切, 永不出细长条。
   block-mosaic v2 可采 (现版纯 50/50)。
3. min-size 停机条件放在 filter 里 (s(e) 谓词) 不在递归里 —
   剖到极限的块被静默丢弃而非强留, 构图自动留白。

## 一句话学到的

顶级作者的工具箱惊人一致: OKLab、BSP、谓词停机 — 语料考古就是校准自己。
