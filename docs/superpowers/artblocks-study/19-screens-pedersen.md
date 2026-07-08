# 第十九课: Screens — Thomas Lin Pedersen

- **ArtBlocks #255** · 原生 js (WebGL 仅 blit) · 14KB · CC BY-NC 4.0 → recipe-only
- 视觉: 密排线网屏, 沿折痕折叠的伪 3D 帷幕, 近单色克制

## 分流判定: 2D-core (shader 是一行 blit) → 2D 队列, 出家族

fragment shader 全文: `gl_FragColor = texture2D(u_t, v_t)` — WebGL 只是
显示器。艺术在 CPU: 线段链表结构 + y/z 轴旋转 (伪 3D 折叠) + 每段灰度
`rgb(255e,…)`。ggplot2 作者的作品, 一如其人: 极简数据结构, 全部克制。

## 解剖 (recipe)

1. **屏 = 单一对象**: 一屏是一整片密排平行线光栅, 被当作单个可折叠
   实体操作 — 不是 N 条独立线。折痕把屏切成 facet。
2. **折叠 = 每-facet 着色, 不是透视数学**: facet 各有斜率 + 亮度,
   人眼把亮度差读成朝向差 — 伪 3D 的最低成本实现。
3. **层间干涉**: 2-3 屏半透明叠加, 交叠处自然产生密度拍频 (moiré 的
   克制版) — 干涉是免费的, 只要线够密、alpha 够低。
4. hash → 自实现 sfc32 (tokenData.hash 切 4 段 32-bit 直接做状态) —
   又一个"平台随机零信任"样本 (与 L1 结论互证)。

## Port: folded-screens 家族 (registry.js, DECOR_V=1 下新增)

2-3 屏 × 每屏 1-3 折痕 × facet 斜率/亮度, 折线是逐 facet 连续的多段线。
人格 = 屏数 × 线距 × 折痕数 × 斜率幅度。适配 editorial/financial
(纸感/织物感)。零代码复制。

## 一句话学到的

伪 3D 折叠不需要投影矩阵 — 斜率给形, 亮度给朝向, 干涉给深度。
