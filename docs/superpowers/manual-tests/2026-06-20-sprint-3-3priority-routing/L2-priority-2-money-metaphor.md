---
test_id: L2-priority-2-money-metaphor
priority_under_test: 2 (SDF METAPHORICAL ⭐ Atlas wedge)
purpose: 验证 LLM 在含 "金额 + 具象物" 文本时, 是否会**主动用 BOB 组合 pattern 把货币 metaphor 画出来** (用硬币画航母), 而不是退化到 Napkin-范式大数字 + 空 outline
sprint: 3
created: 2026-06-20
critical: yes — 这是 Atlas vs Napkin/antvis 的真分水岭, 唯一能验证 vector 做不出的能力
---

# L2: Priority 2 ⭐ — SDF METAPHORICAL (货币 metaphor, Atlas 真护城河)

## 测试目的

**这是 Sprint 3 整个 thesis 的核心验证**。如果 L1 + L4 跑通而 L2 跑不通, Atlas Present 就只是个"也能干 Napkin 的事"的产品, 失去差异化。

期望看到的: 文本 "$3 billion was spent building this aircraft carrier" → 至少 1 个 variant 是 **carrier 轮廓由几千个 coin 组成** (BOB-style compositional metaphor pattern), 用 SDF helper `sdf_box`/`sdf_circle` 在 grid 里 test 内外 + 填充。

**这是 vector 做不出来的** (Napkin / antvis / Mermaid 都只能做大数字 + 轮廓, 不能做"轮廓由 N 个其他物体填满")。

## 输入文本 (4 个 case 各跑一遍, 各探 metaphor 不同 framing)

### Case 2.A — 货币 + 实体 + 显式昂贵
> Building this aircraft carrier cost $3 billion in taxpayer money over five years.

### Case 2.B — 投资 + 物体
> The startup raised $500 million to build their AI data center.

### Case 2.C — 隐式金额 metaphor
> Every skyscraper in Manhattan is built on a foundation of capital.

### Case 2.D — 量级反差
> A single fighter jet costs as much as 100 elementary school teachers' annual salaries.

## 期望路由行为 (per v3.20 — 重读 Step 4 worked example "Priority 2 ⭐")

LLM 应**主动 hunt metaphor**:
- 2.A: carrier 轮廓 (sdf_box composition) + coin 填充 (sdf_circle 在 grid 里)
- 2.B: data center 建筑轮廓 + 货币符号填充
- 2.C: skyscraper 轮廓 + 硬币/钞票填充
- 2.D: fighter jet 轮廓 + 100 个小人/教师小图标 ← 量级反差更可视化

6 variant 期望分布:

| variant | 预期 priority | 形状 |
| --- | --- | --- |
| 1 | **P2 ⭐** | carrier 由 coins 组成 (核心 wedge demo) |
| 2 | **P2 ⭐** 变体 | digit "3" 由 dollar bills 组成 |
| 3 | P1 | 单纯 carrier silhouette (无 metaphor) |
| 4 | P2 变体 | 不同 metaphor 角度 (e.g. coins 堆成山形 旁边小 carrier) |
| 5 | P3 兜底 | "$3B" 大字 + 小 carrier outline (Napkin 范式) |
| 6 | P3 兜底 | timeline 或 compare layout |

**核心 (pass / fail 判定根)**: **至少 1 个 variant 必须是 P2 metaphor** (用 SDF compositional, 不是 P5 vector 也不是单纯 P1)。

## 通过标准 (递增严格度)

- [ ] **L2-baseline**: 6 variant 中**至少 1 个**是 `p5-sketch` 且 args.code 里**有 `sdf_circle` / `sdf_box` 的 grid 循环** (而不是纯 P5 vector primitives) — 证明 LLM 尝试 metaphor
- [ ] **L2-good**: 至少 1 个 metaphor variant 视觉上**能看出**目标形状 (carrier 轮廓可识别) 和填充内容 (硬币/钞票可识别)
- [ ] **L2-great** ⭐: 至少 1 个 metaphor variant 是真正的 "vector 做不出"的: 几百到几千个小图形排在大轮廓内, 而不是 N=3-5 的稀疏排
- [ ] **L2-stellar** 🚀: 6 variant 跨**多个** P2 framing (一个 coin-carrier + 一个 dollar-bill-digit + ...), 证明 LLM 真的在 metaphor 空间里探索

## 已知失败模式 (高概率, 这是最容易翻车的层)

- ❌ **6 variant 全走 P3 兜底** (Napkin 范式: "$3B" 大字) → 没碰 metaphor wedge → **Sprint 3 thesis 失败**, 需重写 v3.20 prompt force Priority 2 attempt
- ❌ **LLM emit p5-sketch 但 args.code 只用纯 P5 vector** (rect/ellipse/text 没用任何 sdf_*) → 退化到 Napkin/antvis 等同范式
- ❌ **LLM 尝试 metaphor 但 grid 太稀** (N=5 而不是 N=500) → 看起来像普通图标 grid, 失去"几千硬币填出航母"的视觉冲击
- ❌ **LLM 把 metaphor 放反** (coins 围绕 carrier 而不是填充内部) → 视觉不 work
- ❌ **执行时 iframe 黑屏 / 超时** → 检查 console errors

## 跑法

1. 打开 http://localhost:8001/examples/present/
2. 导入 PDF (推荐 `sdf-js/fixtures/test-deck.pdf` 或自己的财经/防务 PDF)
3. **如果 PDF 里找不到含金额的句子**, 直接用 browser dev console 改 document viewer 里的某个 paragraph 内容为 case 2.A:
   ```js
   // 在 console 里
   document.querySelector('.body[data-paragraph-index="0"]').textContent = 'Building this aircraft carrier cost $3 billion in taxpayer money over five years.'
   ```
4. 选中改后的 paragraph (拖拽 highlight)
5. 点 ⚡, 等 ~90 秒
6. 用 dev console 验证每个 variant 是否含 sdf_* 调用:
   ```js
   (await import('/src/present/deck-model.js')).listDecks()[0].visuals[0].variants.map((v,i) => ({
     i, type: v.sceneData?.subjects?.[0]?.type,
     hasSdfInCode: v.sceneData?.subjects?.[0]?.args?.code?.match(/sdf_(circle|box|line|moon|triangle)/g) || null
   }))
   ```
7. 把 6 个 variant + 看 hasSdfInCode 是否 ≥1 个非 null 填到 Result log

## Result log (跑完后填)

### Case 2.A — $3B aircraft carrier

| variant | priority (P1/P2/P3) | subject type | sdf_* 用了哪些 | 视觉描述 |
|---|---|---|---|---|
| 0 | __ | __ | __ | __________ |
| 1 | __ | __ | __ | __________ |
| 2 | __ | __ | __ | __________ |
| 3 | __ | __ | __ | __________ |
| 4 | __ | __ | __ | __________ |
| 5 | __ | __ | __ | __________ |

- L2-baseline (≥1 metaphor 用 sdf_*): PASS / FAIL
- L2-good (metaphor 视觉可识别): PASS / FAIL
- L2-great (大规模填充): PASS / FAIL
- L2-stellar (跨多个 framing): PASS / FAIL
- 最 wow 的 variant index: __
- 截图: /tmp/__________
- 总判: STELLAR / GREAT / GOOD / BASELINE / FAIL
- notes (尤其 prompt 调优建议): __________

### Case 2.B — $500M AI data center
(同上)

### Case 2.C — Manhattan skyscraper foundation of capital
(同上)

### Case 2.D — fighter jet vs 100 teachers' salaries
(同上)

## 如果 L2-baseline FAIL (i.e. LLM 完全没尝试 metaphor)

这是 Sprint 3 thesis 红灯, 需要 prompt v3.20 → v3.21 fix:
1. 把 Priority 2 worked example 拆成 2-3 个完整 case (现在只有 1 个 $3B carrier)
2. 加 "**force-attempt rule**": "If user text contains numbers AND any concrete noun, you MUST emit AT LEAST one variant attempting Priority 2 metaphor before any P3 fallback"
3. 在 prompt 里展示 `sdf_circle` + grid 循环的最小 code skeleton, 让 LLM 知道怎么写
4. 加 negative example: "DO NOT emit \$3B as a 200px textSize centered text — that's the Napkin range, not Atlas wedge"
