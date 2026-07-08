# 第二十七课: because unless until — ixnayokay

- **ArtBlocks #472** · 原生 js · 83KB (27 个 class) · CC BY-NC-SA 4.0 → recipe-only (SA 从严)
- 视觉: 生长/死亡循环的层叠有机构成, 按真实时间变貌

## 分流判定: 2D-core 大系统, 文档课

27 个 class 的层叠构成系统 + growth/death 生命周期调度。规模 (83KB)
超出单课解剖性价比, 判定后按 idiom 摘录。

## 值得带走的 idiom

1. **真实时钟 trait 层** (本课头牌): 代码里躺着十二个月名 +
   "Golden Hour" / "Last Light" / "Blue Skies" / "Special Day" —
   同一 hash 在不同现实日期/时刻渲染出不同氛围。这给 provenance
   模型加了一个正交轴: **hash 定身份, v 定代码, wall-clock 定此刻
   的容貌** — 作品是"活的", 但身份仍可复现 (同 hash 同时刻同像素)。
   对 Atlas: deck 修饰可以有"清晨/深夜"氛围档 — 记入 decor v2 备选。
2. **双纪律叠加 (首见)**: 同一作品既用双 PRNG 交替+1e6 预热 (第三次
   目击, 社区共识再+1), 又用 hash 切 32 字节的决策槽位 (Rizzolli
   模式) — 流式随机管连续参数, 槽位管离散 trait, 各司其职。
   正是我们 named-lane 设计里"lane vs 槽位"之辩的野生答案: 成熟
   作者两个都用。
3. 命名 trait 面板 ("Coloring Modes" / "Detail Levels"): trait 是
   给收藏者读的 UI 文案, 不是内部变量名 — 命名即产品。

## 一句话学到的

确定性不排斥"活着": hash 锁身份, 时钟给容貌 — 可复现与会呼吸能共存。
