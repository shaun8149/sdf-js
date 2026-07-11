# 第四课: Watercolor Dreams — NumbersInMotion

- **ArtBlocks #59** · p5 · 17.2KB minified · **CC BY-NC 4.0 → recipe-only**
- 视觉: 水彩晕染 — 几何形状 (圆/线/矩形/字母) 在噪声流场中拖散成柔软色雾

## 结构

```
pwa(list)        概率加权选择 ({p} 字段) — 第三次独立遇见同一算子 (Golid w_pick /
                 我们 lane weighted) — 生成艺术的通用基本件确认
pal(t,a,b,c,d)   IQ 余弦色板 a+b·cos(2π(c·t+d)) — 但只服务 isv:true 的
                 6/36 个 colorScheme (p 合计 ≈0.075, 稀有 variegated 模式);
                 其余 30 个 scheme 是离散 3 色 RGB 色卡 (每条 Flow 一色) —
                 主颜色引擎是离散色卡, 余弦板是彩蛋
mc/ml/mr/mlt     形状源: 圆/线/矩形/字母 轮廓采样为点列
rlbs(pts,sp)     按弧长等距重采样折线 — 曲线工具箱经典件
FlowNode         ★ 核心: 形状轮廓上的节点被噪声流场平流 (advect),
                 prev/curr 两排节点织成 TRIANGLE_STRIP **连续色带**,
                 alpha 随 age 从全不透明衰减, 且 SUBTRACT 减色混合 +
                 暖纸底 — 减色混合是水彩暗部的来源
                 → "水彩" = 形状在流场中被拖走的连续色幕, 不是逐步短线段
人格布尔梯        isMirrored 20% / isRotated 15% / isStriped 10% /
                 isInverted 5% / isWavey 1% — 稀有度阶梯 (trait 文化的代码形态)
镜像折叠          abs(x-0.5·ss) 折叠噪声域 → 万花筒对称
```

> 二读勘误 (2026-07-11): 原文核实 (余弦板是稀有模式非主引擎;
> 画法是 TRIANGLE_STRIP 连续色带 + SUBTRACT, 非低透明度线段),
> 详见 audit/batch-A

## 五个可提取 idiom

1. **形状锚定的流场平流** (核心): 水彩感 = "有出身的雾" — 拖痕记得自己
   来自什么形状。比无锚流线 (我们 flow-streams) 多一层构图意图。
2. **连续色板函数**: IQ 余弦式连续色板在原作里是稀有 variegated
   模式 (≈7.5% 权重), 不是主颜色引擎 — 但 idiom 本身成立且值得偷。
   decor 适配: 主题色列表连续插值即可得同等效果。

   > 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-A
3. **稀有度阶梯**: 5 个人格布尔按 20/15/10/5/1% 递减 — 大多数作品"正常",
   少数携带惊喜 — 这是 ArtBlocks trait 文化的算法本体, decor 引擎
   人格包机制的落地形态参考。
4. **弧长重采样** (rlbs): 折线等距化, 保证平流节点密度均匀。
5. **噪声域折叠对称**: abs(x-mid) 喂噪声 → 镜像; 域变换先于采样。

## Port 判定

- **recipe-only** (CC BY-NC): 新家族 `wash-flow` = idiom 1+2 独立重写 —
  色带/圆环轮廓采样 → 噪声平流 N 步 → 每步低透明度粗笔画,
  颜色沿节点参数 t 连续插值主题色。organic/editorial 亲和。
- idiom 3 (稀有度阶梯) 与 Golid 人格包合并, 记为 decor 引擎 v2 设计输入。

## 一句话学到的

水彩不是滤镜, 是**运动的痕迹** — 把一个清晰的形状交给流场慢慢带走,
柔软感来自"形状记忆 × 累积透明度", 两个都是廉价操作, 组合出昂贵的质感。
