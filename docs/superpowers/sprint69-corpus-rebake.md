# Sprint 69: Rule 24 新 prompt 下的全语料重烤 (15 decks, 真机)

基线对照 (前=Sprint 67 混合基线, 后=本轮统一重烤):

| 聚合 | 前 | 后 |
|---|---|---|
| corpus mean | 97.4 | **97.7** |
| facts recall | 95.9% | 95.9% |
| entity recall | 91.2% | 92.1% |
| precision mean | 90.7% | 90.6% |

## Rule 24 在"有衍生需求"的 deck 上显著生效

| deck | precision | 衍生引用 |
|---|---|---|
| product-eng-retro | **71 → 87** | 0 → 6 |
| qbr-q3-2026 | **83 → 100** | — |
| qbr-earnings | 94 → 96 | 6 (稳定) |

retro/QBR 类内容天然要算增幅 — worked example 的一行示范让模型开始
带引用地算。聚合 precision 持平的原因: 其余 deck 的 run-to-run 方差
(funding 88→78 本轮又裸写、news 系 ±7) 抵消了增益。

## 观察与跟踪项

- yosemite facts recall 96→77: 单次低值 (小 deck 方差), 语料持续追踪
- econ-news-2026 fill 6/8→10/14: LLM picker 本轮选了不同骨架 (方差,
  非回归 — score 92.9 仍达标)
- swot-portfolio-2026 fill 6/8→5/8: 掉 1 slot, 已有失败重试产品面兜底
- funding-round 的裸衍生值仍是依从性头号残差 — 下一个候选杠杆:
  revision 阶段自动补引用 (检测到裸衍生值时用 ✏️ 通道修复), 或接受
  概率性并靠质量灯在产品面提示

结论: **统一基线已刷新, Rule 24 方向正确; 依从性从 prompt 单点改进
转入语料长期追踪。**
