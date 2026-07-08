# 第十六课: Proscenium — Remnynt

- **ArtBlocks #486** · 原生 WebGL · 145KB (全语料最大之一) · CC BY-NC 4.0 → recipe-only
- 视觉: 剧场式 3D 布景 — 层叠景片、雾、光, 舞台纵深

## 分流判定: CPU-3D (shader 仅直通光栅) → 3D 端参考

真 3D: uModelMatrix/uViewMatrix/uProjectionMatrix 全套矩阵管线, 但
fragment shader 只有一行 `gl_FragColor = vColor` — 几何、颜色、排序
(SORT_CLOSEST_DISTANCE / SORT_REACH / SORT_EVENTS_*) 全在 CPU。
与 while true (L10, CPU 算 2D + WebGL 光栅) 同构, 只是升到 3D:
**第五形态: CPU-3D + 直通 shader**。归 3D 端参考, 不进 2D 队列。

## 移交 3D 端 idiom

- 多策略 painter 排序字典: 按最近点距 / 按可达范围 / 按事件时间 —
  可切换的深度排序策略, 正合 2D 端 painter sort lesson 的 3D 版
- proscenium 舞台范式: 前景框 + 层叠景片 + 纵深雾 — 与我们
  "背景=真3D静态室内" 的格斗游戏分层模型直接对话 (布景语言参考)
- sRGB↔linear 显式转换函数对 (SRGBtoRGB/RGBtoSRGB) — CPU 端算色也
  要在线性空间做

## 一句话学到的

"3D 作品"不等于"shader 作品" — 145KB 的剧场全在 CPU, shader 可以只有一行。
