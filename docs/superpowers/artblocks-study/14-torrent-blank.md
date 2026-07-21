# 第十四课: Torrent — Steganon

- **ArtBlocks #466** · p5.js WEBGL 模式 · 8.9KB (frag ~1.9KB) · CC BY-NC 4.0 → recipe-only

## 分流判定: shader-core → 3D 端移交

CPU 只准备一张源纹理; "激流"视觉全在 fragment:
`uv.y = mod(f(uv) + mod(u_time,1000.)/u_speed, u_mod)` — 用 fbm 场对
采样坐标做**沿流向的连续位移 + 时间滚动**, 配 fade 与 hash 颗粒。
注意: 链上**默认是静帧** (noLoop) — 动画是 `?animated=true` 的 opt-in
查看参数 (且每 200 帧换 uniform 场景); "动画即本体"与收藏者默认所见
不符, 但 shader-core → 3D 端的分流判定不受影响。宿主是 p5.js WEBGL
模式 (createCanvas(..., WEBGL) + createShader), 不是原生 WebGL。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-B

## 移交 3D 端 idiom

- **texture-flow**: 用噪声场位移采样坐标而非位移几何 — 一行实现"流动感",
  正合 3D 端 material.kind=1 (sea) 的近亲
- u_tileoffset/u_tiledivisor 是 **print 导出机制**: `?print=true` 时按
  20px 横条逐条渲染拼高分辨率大图 (实时模式恒为 0/1) — 不是视觉多窗格;
  "分条渲染拼大图"本身是可偷的导出 idiom
- 恒等 hash 颗粒: fract(sin(dot(uv,…))*43758.5453)/u_noise 防 banding

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-B

## 一句话学到的

位移采样坐标比位移几何便宜一个数量级 — "流动"是采样问题, 不是几何问题。
