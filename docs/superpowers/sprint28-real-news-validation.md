# Sprint 28 Part C — 真实经济新闻 500 字验证 (2026-07-06)

按 user 要求, 不用玩具文本 — 用一段 ~500 字中文经济新闻摘录
(`sdf-js/scripts/scaffold-pipeline-fixtures/econ-news-excerpt.txt`, 真实数据:
IMF 3.3% / OECD 2.9% / 世界银行 2.5% / 中国 5% / 欧元区 1.1% / 低收入国家 5.4% /
美联储 3%-3.25% + 中东风险段落) 同时打穿两条管线。

## 路径 1 — heavy (3-stage scaffold 管线)

fixture: `econ-news-2026.json` (4 slides, 忠实摘录)。

```
bake:  analysis-report scaffold, 6/8 slots, $0.19, 0 errors
eval:  93.8/100 · 中文数字 facts recall 9/11 (82%, missing 1.1%/5.4%)
IR:    风险 slide → risk-heatmap atom → matrix IR
       deckToIR 正确过滤 + notice 指向 ir-matrix-proposal.md ✓
       2 张 magnitude slide 进 assembleDeck (ir-from-econ-news-2026.json)
```

**matrix 链路端到端**: 中文"概率高、冲击程度深"语言 → lift LLM 选
risk-heatmap → atomToIR 产出 matrix 结构 → 3D allowlist 过滤如设计。

## 路径 2 — light (author-2d.html, textarea 直贴 → BYOK)

两次生成 (LLM 非确定性, 结构选择略有波动, 均合理):

| slide | 结构 | 2D atom |
|---|---|---|
| 2026年全球GDP增速预测(%) | magnitude ×6 | **bar** (修复后) |
| 主要央行货币政策路径 | sequence ×4 | process-arrows / funnel |
| 全球主要风险矩阵: 概率×影响 | **matrix** 3×3 | matrix-grid |

**matrix 在浏览器路径自发 fire** — text-to-ir prompt 的 matrix 定义有效。
中文渲染全部正常。截图: `screens/sprint28-validation/`。

## 验证抓出的真 bug (已修)

第一次生成把 6 个机构的 GDP **增长率**画成了 donut, 中心值 "20.2" =
各百分比的无意义求和。根因: `isPartsOfWhole` 只检查"全正数", 增长率全正
→ 误判为构成关系。

修复 (`ir-to-2d.js`): `RATE_LANGUAGE` 检测
(growth/rate/forecast/增长/增速/预测/利率…) → 强制 bar。
回归测试 3 条加进 `test-ir-matrix.mjs` (41/41)。

这正是真实文本验证的价值 — 玩具文本 ("revenue mix by segment") 永远
触发不了这个误判。

## 其余发现 (未修, 记录)

- facts recall 82% < 玩具语料 95.8%: 丢的 1.1%/5.4% 在同一句 4 个数字的
  长句里, mapper 拆填时截断 — 中文长句多值是下一个 fidelity 靶点
- entity extractor 对中文实体 0/0 (正则按拉丁大写词设计) — 中文实体
  recall 需要另一套抽取规则, 挂 TODO
- 政策路径被第一次生成画成 funnel (LLM 给了递减 magnitude): 语义勉强,
  第二次生成 process-arrows 正确 — 不改代码, LLM 波动范围内
