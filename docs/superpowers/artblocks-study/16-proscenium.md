# 第十六课: Proscenium — Remnynt

- **ArtBlocks #486** · 原生 WebGL · 145KB (全语料最大之一) · CC BY-NC 4.0 → recipe-only
- 视觉: 剧场式 3D 布景 — 层叠景片、雾、光, 舞台纵深

## 分流判定: CPU-3D + 混合 shader → 3D 端参考

真 3D: uModelMatrix/uViewMatrix/uProjectionMatrix 全套矩阵管线。
点/painter shader 确是一行直通 `gl_FragColor = vColor`, **但另有
完整的 GPU 光照 shader**: TerrainViewShader (两个 #version 300 es
变体, 主 view 无条件实例化) 的 fragment 是 Fresnel-Schlick +
最多 9 灯 (uLightDirections/uLightColors) 的 specular/diffuse 光栅
光照 — "颜色全在 CPU"只对 painter 通道成立, terrain 着色在 GPU。
几何生成与排序 (SORT_CLOSEST_DISTANCE / SORT_REACH / SORT_EVENTS_*)
确在 CPU。修正表述: **第五形态 = CPU 几何/排序 + 混合 shader
(painter 直通 + terrain 光栅光照)**。归 3D 端参考, 不进 2D 队列
(分流结论不变)。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-G

## 移交 3D 端 idiom

- 多策略 painter 排序字典: 按最近点距 / 按可达范围 / 按事件时间 —
  可切换的深度排序策略, 正合 2D 端 painter sort lesson 的 3D 版
- proscenium 舞台范式: 前景框 + 层叠景片 + 纵深雾 — 与我们
  "背景=真3D静态室内" 的格斗游戏分层模型直接对话 (布景语言参考)
- sRGB↔linear 显式转换函数对 (SRGBtoRGB/RGBtoSRGB) — CPU 端算色也
  要在线性空间做

## 一句话学到的

"3D 作品"不等于"shader 作品" — 剧场的几何与排序全在 CPU, shader
按通道分工: 能一行直通的就一行, 需要光照的才上光照。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-G
