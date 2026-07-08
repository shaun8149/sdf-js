# 第十三课: Naïve — Olga Fradina

- **ArtBlocks #483** · p5 (WEBGL 仅作后滤镜) · 22KB · CC BY-NC 4.0 → recipe-only
- 视觉: 柔软"天真"风景 — 噪声漂移粒子的点状纹理床 + 稀疏近邻连线网

## 分流判定: 2D-core (shader 只是后滤镜) → 2D 队列, 出家族

美学核心全在 CPU: 粒子系统 (initParticles/repellers/风力) + 连线
(drawConnections)。fragment shader 只做 warp + 对比度 + 颗粒 — 与
Watercolor Dreams (L4)、INK (L7) 同型的"2D 作品 + shader 化妆"。

## 解剖 (recipe)

1. **双相结构**: 背景相 — 粒子按噪声场漂移 backIterations 步, 沿途沉积
   极淡的点 (纹理床); 然后**重新撒粒子**进前景相 — 继续漂移但改画连线。
   一套机器两种产物, 分相只靠迭代计数。
2. **非对称孪生噪声**: `nX = noise(x,y)`, `nY = noise(y,x)` — 同一噪声场
   交换坐标采样, 一次采样两轴去相关。比养两个噪声场省一半, 且天然不同构。
3. **噪声算子动物园**: 对场输出可选叠加 round 量化 (台地化)、sin-of-noise
   (波化)、双尺度 max/min (加细节/挖空洞)、addedNoise — 以及一整套 IQ
   easing 函数 (expImpulse/cubicPulse/gain/parabola/pcurve/sinc) 备用。
   变体 = 算子开关组合, 不是重写生成器。
4. **距离带连线**: 近邻连线同时有 minDist 和 maxDist — **下界才是关键**,
   它禁止贴脸线, 网保持透气; 每粒子每帧还要掷 visiblePercent 概率。
5. 速度是**赋值**不是积分 (`vel = f(noise)`) — 粒子无惯性, 场即轨迹,
   保证确定性和均匀质感。

## Port: drift-web 家族 (registry.js, DECOR_V=1 下新增)

双相 (轨迹点床 + 距离带网) + 孪生噪声 + 算子人格化:
calm 无算子 / balanced 双尺度 max / wild 加量化台地。适配 pitch/consulting
(网络感)。零代码复制, 全部按 recipe 重写。

## 一句话学到的

变体设计 = 给一个场准备一柜算子, 开关组合就是性格 — 不是 N 个生成器。
