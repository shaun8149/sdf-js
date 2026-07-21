# 第四十三课: Entretiempos — Marcelo Soria-Rodriguez

- **ArtBlocks #267** · p5 + shader 后滤镜 · 36KB · CC BY-NC 4.0 → recipe-only
- 视觉: 色带/色块的"时间之间", 胶片颗粒质感

## 分流判定: 2D-core + shader 后滤镜 (Watercolor/INK/Naïve 同型) → 文档课

CPU 侧 dC/dIi3/dRi 系列画色块构图; fragment 只做 grain (经典
`fract(sin(dot))` hash, 但采样点是 `uv*u_time` — **grain 逐帧动**,
不是冻结颗粒) + 方向模糊 (u_dir, 高斯 9-tap) + 亮度/对比
(u_br/u_con) + gamma (u_g) — 化妆层。构图领域 (色带/块) 已被
多家族覆盖, 不 port。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-G

## 值得带走的 idiom

1. **后滤镜参数也是 trait — 但只有两根 lane**: 二读核实, 多数
   shader 参数是**常量** (shBlEqA=.45 / shK=1.05 / shBr=.028 /
   shCon=.925 …); hash 只铸黑白 trait (`shBW`, p=7.5%) 与模糊方向
   符号 (shBx/shBy), gamma 仅随 shBW 二选一。u_g 是 **gamma** 不是
   grain (grain 强度走 u_pC)。"冲印批次"实为 方向+BW 两根 lane,
   不是六参数全 hash — idiom 方向仍可用, 但证据档位降级。修饰层
   v2 若加统一 grain pass, 强度可以走 hash lane (胶片批次感)。

   > 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-G
2. **方向模糊做"时间感"**: u_dir 单向模糊 = 快门拖影的暗示 —
   "运动的痕迹"不需要动画 (与 L4 水彩"运动的痕迹"互证, 手段换成
   光学隐喻)。
3. sigM (sigmoid) 开场即定义 — 参数映射曲线先于一切: 线性参数
   出机器感, sigmoid 参数出手感 (中段敏感两端迟钝)。

## 一句话学到的

参数映射曲线是隐形的手感: 同一参数, 线性是机器, sigmoid 是人。
