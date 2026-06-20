---
test_id: L6-multi-priority-variant-diversity
priority_under_test: 1+2+3 mixed (variant 跨 priority 分配)
purpose: 验证当文本**同时**含具象 + 数字 + 抽象关系时, 6 variant 自然分布到 ≥2 个 priority, 不重蹈 Sprint 1.5 全收敛 bug
sprint: 3
created: 2026-06-20
historical_failure_being_re_tested: Sprint 1.5 把 6 个 variant 全画成 text-card 同 layout (1.5 收敛 bug → Sprint 2 黑块根因之一)
---

# L6: Multi-priority — variant diversity 跨 priority 分配验证

## 测试目的

Sprint 1.5 痛点: 6 variant 同质化 (全 text-card 微差), 用户体感"6 个等于 1 个"。Sprint 3 v3.20 prompt 显式规定:
> For 6 variants per ⚡:
>   - Allocate ~3-4 variants in Priority 1+2 when content has concrete or metaphor-eligible material
>   - Allocate ~2-3 variants in Priority 3 (fallback coverage)
>   - Pure-abstract content: 1-2 try metaphor (invent), 4-5 P5 layout variation
>   - NEVER emit all 6 same-tier same-style

L6 验证这条规则真的被 LLM 执行。

## 输入文本 (3 个 case, 故意制造 priority 选择空间)

### Case 6.A — concrete + number + relation 全占
> In 2023, three new aircraft carriers were commissioned, increasing fleet capacity by 40%. Each carrier requires $13 billion to build and supports a crew of 5000 sailors over 20 years of service.

含: concrete (carrier, sailors) + 数字 ($13B, 40%, 5000, 20yr, 3 ships, 2023) + 关系 ("increasing capacity", "requires", "supports").

### Case 6.B — concrete-heavy + 少量数字
> The cathedral took 200 years to complete. Inside, candles flicker beneath stained glass windows that depict scenes from medieval life — knights, monks, peasants, and merchants.

含: 强 concrete (cathedral, candles, windows, knights/monks/peasants/merchants) + 弱数字 (200yr).

### Case 6.C — number-heavy + 弱 concrete
> Our SaaS reached $100M ARR in 18 months, with 92% gross margin, $50 CAC, $5000 LTV, and a Magic Number of 1.8 — putting us in the top 5% of B2B software startups.

含: 强数字 ($100M, 18mo, 92%, $50, $5000, 1.8, 5%) + 弱 concrete (SaaS, startups 偏抽象).

## 期望路由行为

### Case 6.A (concrete + number + relation 都有)
| variant | 期望 priority | 期望 shape |
|---|---|---|
| 1 | P1 | 3 carriers + sea + dock 直接画 |
| 2 | **P2 ⭐** | carrier 由 coin 组成 (\$13B metaphor) |
| 3 | **P2 ⭐** | "+40%" 或 "3" 由 sailors 小人填充 (quantity metaphor) |
| 4 | P1 变体 | 1 个 carrier 大 + sailor 群体 |
| 5 | P3 兜底 | "$13B × 3" 大数字 + timeline 2023 → 2043 |
| 6 | P3 兜底 | compare "before vs after 40%" |

### Case 6.B (concrete-heavy)
预期: ≥4 variant P1 (传统 cathedral atom + sub-atoms), 1-2 P3 兜底.

### Case 6.C (number-heavy)
预期: ≥3 variant P2 metaphor (\$100M coins, growth steps, MagicNumber 1.8 as scale), 2-3 P3 (KPI cards, timeline 18mo, percentile chart).

## 通过标准 (这是反 Sprint 1.5 关键 layer)

- [ ] **L6-anti-convergence (核心)**: 6 variant 至少分布到 **≥2 个 priority**, 不能全 P3 也不能全 P1
- [ ] **L6-anti-mono-style**: 6 variant 至少 **4 种不同视觉风格** (即使全 P3 也要不同 layout)
- [ ] **L6-priority-mix-matches-content** (per case):
  - 6.A: 期望 P1 + P2 + P3 都出现 (混合内容应充分探索)
  - 6.B: 期望 P1 占比 ≥4/6 (concrete-heavy 应主走 P1)
  - 6.C: 期望 P2 占比 ≥2/6 (number-heavy 应有 metaphor 尝试)
- [ ] **L6-no-Sprint-1.5-regression**: 6 variant 不能全是 "X 大数字 + Y 小 label" 模板 (Napkin 范式) — 必须看到 ≥1 真 P2 metaphor variant 在 6.A 和 6.C
- [ ] **主观**: 用户体感"6 个 variant 像 6 个不同设计师的方案", 不是"6 个等于 1 个"

## 已知失败模式

- ❌ **6 个全 P3** (Sprint 1.5 收敛复现, 最大失败模式) → prompt 没强制 priority 分配
- ❌ **6 个全 P1** (concrete-heavy 6.B 容易触发) → 失去多样性, 也失去 Atlas P2 wedge 展示机会
- ❌ **priority 分配但 style 同质** (e.g., 4 P3 全是 "boxes + arrows") → fix prompt 加 P3 layout 多样性指令
- ❌ **6.C number-heavy 全走 Napkin 范式 (\$100M 大字)** 没尝试 P2 metaphor → Atlas 在 SaaS deck 场景退化为 Napkin
- ❌ **跨 priority 但视觉割裂** (6 个看起来像 6 个不同应用的输出, 用户选不出整体) → 兼容性问题, 但 Sprint 3 不一定能 fix

## 跑法

1-4 同 L1-L5
5. **重点**: 6 个 variant 全截图 (打开 picker, 每个 thumbnail 截图)
6. dev console 拉 priority 分布:
   ```js
   (await import('/src/present/deck-model.js')).listDecks()[0].visuals[0].variants.map((v,i) => {
     const t = v.sceneData?.subjects?.[0]?.type;
     const code = v.sceneData?.subjects?.[0]?.args?.code || '';
     const hasSdf = !!code.match(/sdf_\w+|sdRoundBox|sdTriangle/);
     return {
       i,
       priority: t === 'p5-sketch' ? (hasSdf ? 'P2' : 'P3') : (t ? 'P1' : 'unknown'),
       type: t,
       archetype: v.archetype
     };
   })
   ```

## Result log

### Case 6.A — carriers + $13B + 40% + sailors + 20yr
- variant priority 分布:
  - 0: __  1: __  2: __  3: __  4: __  5: __
- L6-anti-convergence (≥2 priority): PASS / FAIL
- L6-anti-mono-style (≥4 style): PASS / FAIL
- L6-priority-mix-matches (期望 P1+P2+P3 都有): PASS / PARTIAL / FAIL
- 6 variant 截图: /tmp/__________

### Case 6.B — cathedral + medieval life (concrete-heavy)
(同上, 期望 P1 ≥4/6)

### Case 6.C — $100M ARR (number-heavy)
(同上, 期望 P2 ≥2/6, **核心 wedge 验证**)

### 总评
- 反 Sprint 1.5 收敛 bug: PASS / FAIL
- 6 个 variant 真有 6 种不同方案: PASS / FAIL
- 6.C 是否展示了 Atlas 在 SaaS deck 场景的 wedge (而不是退化 Napkin): PASS / FAIL
- prompt 调优建议: __________
