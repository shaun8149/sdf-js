---
test_id: L4-priority-3-sequence-fallback
priority_under_test: 3 (P5 FALLBACK — 防退化兜底)
purpose: 验证 P5 fallback 在纯抽象 sequential 关系上**永远**画得出合理 layout, 不再出 Sprint 2 黑块。已被你的 "Causal Brain of World Agent" L3 截图验证, 保留作 regression baseline
sprint: 3
created: 2026-06-20
status_at_create: 已 PASS 一次 (2026-06-20 user 截图: M / W / ⊙ 3 盒子 + 箭头, 清晰可读)
---

# L4: Priority 3 — P5 FALLBACK (sequence, 防退化兜底)

## 测试目的

P5 fallback 是 Sprint 3 的**安全网**, 不是 Atlas 的 IP 表演舞台 (那是 L2/L3)。它存在的唯一理由: **保证任何抽象内容都不会输出黑块** (Sprint 2 的失败模式)。

L4 跑通 = "客户用了不会觉得难看", 这是产品下限。
L2/L3 跑通 = "客户用了会觉得 wow", 这是产品上限。

**L4 已被你 2026-06-20 截图验证 ("Causal Brain of World Agent" 3 盒子) — 这个文件主要是 regression baseline**: 以后改 prompt / 改 helper bundle 时, 必须保证 L4 不退化。

## 输入文本 (4 个 case, 各探一种 sequence framing)

### Case 4.A — agent loop (你截图的同一类)
> The agent explores the environment, builds hypotheses about its causal structure, tests them through interventions, and refines its world model based on the outcomes.

### Case 4.B — linear process
> First, gather requirements. Then design the system. Then implement. Then test. Finally, deploy.

### Case 4.C — cause-effect chain
> When the demand rises, prices increase, which incentivizes more production, which eventually lowers prices.

### Case 4.D — evolutionary sequence
> Cells became multicellular, then developed nervous systems, then brains, then language, then writing, then computers.

## 期望路由行为

LLM 应识别**无具象物体 + 无关键数字 + 强逻辑顺序** → 走 Priority 3:

| variant | 预期 priority | 形状 |
|---|---|---|
| 1 | **P3** | N 个等宽 box + → 箭头 (你截图的 pattern) |
| 2 | **P3 变体** | N 个圆形节点 + 弧线箭头 |
| 3 | **P3 变体** | 垂直 timeline + N 个 milestone |
| 4 | **P3 变体** | 同心圆 / 螺旋 (递进感) |
| 5 | **P3 变体** | 横排卡片 + step number |
| 6 | P2 (低概率) | 如果 LLM 能想到 metaphor (如 4.D "evolution" 可画树) |

**核心**: 6 variant 不能全一个样 (Sprint 1.5 收敛 bug)。即使全 P3, 至少 **3 种不同 layout 风格**。

## 通过标准

- [ ] **L4-no-black-blob** (regression 关键): 没有任何 variant 是空 / 黑块 / 乱码 — 这是 Sprint 3 vs Sprint 2 最直接的对比
- [ ] **L4-readability**: 所有 P3 variant 文字可读 (字号合理 / 不重叠 / 字体清晰)
- [ ] **L4-layout-diversity**: 6 variant 至少 3 种不同 P3 layout style
- [ ] **L4-arrow-correctness**: sequence 是有方向的, 箭头方向应正确 (从前一步指向后一步), 不能反或乱
- [ ] **主观**: 用户在 keynote 上展示时, 客户能不能一眼看懂步骤顺序

## 已知失败模式

- ❌ **回归 Sprint 2 黑块** — 如果某个 variant 真的 render 空白 / 黑块, 立即 STOP 调查 (helper bundle 错 / iframe sandbox 错 / branding palette 错)
- ❌ **L4-layout-diversity FAIL**: 6 variant 全是 "N 个 box + 横向箭头" → Sprint 1.5 收敛 bug 残留, prompt 没强制 6-variant 跨 layout
- ❌ **箭头方向反** (常见 LLM 坐标系混乱) → 可接受但应报告
- ❌ **字号超出 canvas 边界** (textSize 太大 / 文本太长) → 不算 fail 但 prompt 应该限定 max textSize
- ❌ **文字与 box 边界重叠** → typography fail, prompt 应强调 textAlign(CENTER, CENTER) + 留 padding

## 跑法

1. http://localhost:8001/examples/present/
2. 文本替换 + highlight + ⚡ (同 L1-L3)
3. **核心区别**: 这次重点看视觉, 不只看 sceneData JSON
4. 截图所有 6 variant (用 picker 切换 → 截图)
5. 对比你之前 "Causal Brain of World Agent" 截图作为 baseline

## Result log

### Case 4.A — agent explore-hypothesize-test-refine
- variant 0-5 layout 风格简述:
  - 0: __________
  - 1: __________
  - 2: __________
  - 3: __________
  - 4: __________
  - 5: __________
- L4-no-black-blob: PASS / FAIL (若 FAIL, 哪个 variant + 截图)
- L4-readability: PASS / FAIL
- L4-layout-diversity (≥3 种): PASS / FAIL
- L4-arrow-correctness: PASS / FAIL
- 跟 "Causal Brain" baseline 截图比, 进步 / 退化 / 持平: __________
- 截图打包: /tmp/__________

### Case 4.B — gather → design → implement → test → deploy
(同上)

### Case 4.C — demand → price → production → price (cycle!)
(同上 — 注意 4.C 是**循环**, 期望某个 variant 用循环 layout, 不只是线性箭头)

### Case 4.D — cells → brains → language → computers
(同上 — 期望某 variant 用树状/进化树 layout, 而不是单一线性)

### 总评 (跑完 4 case)
- 整体退化风险: __________
- 推荐固化为 fixture (作为以后 regression baseline) 的 case: __________
