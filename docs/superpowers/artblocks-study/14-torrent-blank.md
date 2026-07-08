# 第十四课: Torrent — Steganon

- **ArtBlocks #466** · 原生 WebGL · 8.9KB (frag ~1.5KB) · CC BY-NC 4.0 → recipe-only

## 分流判定: shader-core (动画即本体) → 3D 端移交

CPU 只准备一张源纹理; "激流"视觉全在 fragment:
`uv.y = mod(f(uv) + mod(u_time,1000.)/u_speed, u_mod)` — 用 fbm 场对
采样坐标做**沿流向的连续位移 + 时间滚动**, 配 fade 与 hash 颗粒。
静止一帧只是条纹, 运动才是作品 — 动画即本体, 2D 静态修饰无处安放。

## 移交 3D 端 idiom

- **texture-flow**: 用噪声场位移采样坐标而非位移几何 — 一行实现"流动感",
  正合 3D 端 material.kind=1 (sea) 的近亲
- tile 化: u_tileoffset/u_tiledivisor 把一条流切成 N 条并排 — 单 shader
  多窗格的廉价复用
- 恒等 hash 颗粒: fract(sin(dot(uv,…))*43758.5453)/u_noise 防 banding

## 一句话学到的

位移采样坐标比位移几何便宜一个数量级 — "流动"是采样问题, 不是几何问题。
