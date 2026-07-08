# 第四十三课: Entretiempos — Marcelo Soria-Rodriguez

- **ArtBlocks #267** · p5 + shader 后滤镜 · 36KB · CC BY-NC 4.0 → recipe-only
- 视觉: 色带/色块的"时间之间", 胶片颗粒质感

## 分流判定: 2D-core + shader 后滤镜 (Watercolor/INK/Naïve 同型) → 文档课

CPU 侧 dC/dIi3/dRi 系列画色块构图; fragment 只做 grain (恒等 hash) +
方向模糊 (u_dir) + 亮度/对比 (u_br/u_con) — 化妆层。构图领域
(色带/块) 已被多家族覆盖, 不 port。

## 值得带走的 idiom

1. **后滤镜参数也是 trait**: u_pA/u_pB/u_pC/u_g(rain)/u_br/u_con
   全从 hash 铸造 — 同一构图不同"冲印批次"。修饰层 v2 若加统一
   grain pass, 强度可以走 hash lane (胶片批次感)。
2. **方向模糊做"时间感"**: u_dir 单向模糊 = 快门拖影的暗示 —
   "运动的痕迹"不需要动画 (与 L4 水彩"运动的痕迹"互证, 手段换成
   光学隐喻)。
3. sigM (sigmoid) 开场即定义 — 参数映射曲线先于一切: 线性参数
   出机器感, sigmoid 参数出手感 (中段敏感两端迟钝)。

## 一句话学到的

参数映射曲线是隐形的手感: 同一参数, 线性是机器, sigmoid 是人。
