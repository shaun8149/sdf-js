# 第二十课: RASTER — itsgalo

- **ArtBlocks #341** · p5 + 双 shader · 10KB · CC BY-NC 4.0 → recipe-only
- 视觉: 印刷半调点阵 + 手势笔触 + 反馈流动

## 分流判定: 第三形态 (CPU 手势构图 + shader 光栅/反馈核)

CPU 侧: Gesture 类沿点对生成笔触路径, drawBrush 逐像素写软径向印章
(alpha 随中心距离衰减) 进 buffer; drawNoise 生成的是馈给 shB 的
**噪声查找纹理** (uniform 采样源), 不是可见的噪声底图。
shader 侧: shA 是**逐通道 3 级色阶 + 值噪声抖动的 dither + 像素块化**
(`floor(a*d)/(a-1)`, a=3 → 电平 {0, .5, 1}) — **没有圆点、没有可变
点径**; uniform j 是像素块尺寸 (恒定值, 键盘 1/2/4/8 切换), 不由场值
调制。shB 对 buffer 做反馈 warp (自采样 + 偏移) — RASTER 之名的
光栅感与流动感都在 GPU, 但光栅是噪声 dither 色阶, 不是半调点阵。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-B

## 解剖 (recipe)

1. **场与屏分离**: 内容是一个标量场 (笔刷 buffer), 风格是采样屏。
   同一场可换任何屏 — 这就是 form/render 解耦 (user 审美原则) 的
   像素版。注意: RASTER 自己的"屏"是粗像素 + 每通道 3 级色阶 +
   噪声阈值抖动, **不是**"点径=场值"的变径圆点网屏 (后者是传统
   印刷半调的语言, 原作没有)。

   > 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-B
2. 软笔刷 = `alpha = A·(1 - d/R)` 的径向印章逐像素累积 — 无需纹理,
   一个 dist 循环即是笔刷引擎。
3. 反馈 warp: shader 读上一帧 buffer 加微偏移 → 流动感零成本
   (与 L14 Torrent 的位移采样同族, 但方向是时间轴)。

## Port: halftone-fade 家族 (registry.js, DECOR_V=1 下新增)

CPU 复刻"场×屏"架构: 场 = 数个软径向 blob (笔刷印章), 屏 = 错行
点阵 (印刷 rosette 感), 点径 = field^gamma。人格 = 网格密度 × blob 数
× gamma × 抖动。反馈/动画层不 port。适配 pitch/organic。
**归因更正**: 变径圆点网屏 + rosette 是**传统印刷半调**的视觉语言,
不是 RASTER 的机制 (原作是 3 级噪声 dither + 像素块) — 家族装饰效果
成立, 但不应再以"复刻 RASTER 架构"叙述屏的部分。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-B

## 移交 3D 端

- 反馈 warp (self-sampling + offset) — post-process idiom
- gamma 曲线做点径映射: 印刷灰度感的关键一挤

## 一句话学到的

内容是场, 风格是采样屏 — 把两者分开, 一份内容就能穿一柜子衣服。
