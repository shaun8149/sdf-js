# 第十八课: Solar Transits — Robert Hodgin

- **ArtBlocks #423** · 原生 WebGL2 多 pass · 69KB · CC BY-NC 4.0 → recipe-only
- 视觉: 日面凌日 — 轨道天体横越太阳盘面, 辉光/大气/曝光感

## 分流判定: shader-core (多 pass 全屏管线) → 3D 端移交

18 处 precision 声明 = 一整套 pass 链; 几何只有全屏三角
(`Float32Array([-1,-1,3,-1,-1,3])` — 单三角覆屏 trick), 所有视觉在
fragment 链里。Hodgin (Ancient Courses 作者) 的轨道力学功底这次全部
GPU 化。2D 端无静态可 port 之物 — 辉光/曝光是 HDR 累积效果。

## 移交 3D 端 idiom

- **单三角覆屏**: 3 顶点 (-1,-1)(3,-1)(-1,3) 盖满 clip space, 比 quad
  少一次对角线插值缝 — 全屏 pass 的标准姿势, 我们的 Fly3D pass 可对照
- 多 pass 曝光累积: 天体运动在帧间累积亮度 → 长曝光摄影感 —
  3D 端 cameraSequence 的"轨迹可视化"直接可用的 recipe
- 轨道参数化: 凌日 = 圆轨道投影到盘面的一维穿越, 稀有度可挂在
  轨道倾角/相位上 (astronomy-as-trait)

## 一句话学到的

全屏 shader 管线的几何学名叫"一个三角形" — 复杂度全部让渡给 fragment 链。
