# 第四十九课: Elevated Deconstructions — luxpris

- **ArtBlocks #7** · p5 纯 2D · **3.1KB (全语料最小)** · CC BY-NC 4.0 → recipe-only
- 视觉: 极简几何解构 — 4 束平行线 (5-15 次重复偏移) + 同心圆簇 +
  一个 `shadowBlur=40` 软阴影大圆 + 7500×multiplier 条粉色发丝线纹理
  ("三五个形块"的一读 gloss 不准; shadowBlur 是原生 canvas API 入 p5
  的早期样本, 发丝纹理是画面的底噪)

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-A

## 分流判定: 2D-core, 文档课 (极简构成领域已覆盖)

## 值得带走的 idiom

1. **3KB 的完整作品解剖** (最小可行生成艺术): 32 槽位 + multiplier
   归一化 (width/2400 — 分辨率无关) + 少量元素放置 = 全部。
   与 L39 (3KB Rozendaal) 并列证明: 作品下限由**决策质量**决定,
   与代码量无关。
2. multiplier 模式: 所有尺寸以 width/2400 为单位 — 早期作品就有
   分辨率无关纪律 (我们 renderer 的 M 缩放同源)。
3. 早期编号 (#7, 2020) 的策展口味: 平台初期偏爱"少而准" —
   与后期 (BUSY 251KB) 对照, Curated 的复杂度通胀清晰可见。

## 一句话学到的

生成艺术的下限是决策质量不是代码量 — 3KB 与 251KB 同框 Curated。
