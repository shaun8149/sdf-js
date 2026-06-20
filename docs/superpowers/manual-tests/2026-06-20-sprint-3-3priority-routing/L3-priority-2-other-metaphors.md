---
test_id: L3-priority-2-other-metaphors
priority_under_test: 2 (SDF METAPHORICAL — non-money family)
purpose: 验证 LLM 把 metaphor 概念**泛化**到货币以外的领域 (时间 / 增长 / 数量 / 网络 / 流程), 而不是只会做 carrier-from-coins 一招
sprint: 3
created: 2026-06-20
---

# L3: Priority 2 (non-money) — metaphor family generalization

## 测试目的

L2 测了"金钱 → 硬币填充"这一对 metaphor。但 v3.20 prompt 在 Priority 2 列出了 **6 类 metaphor pattern**:
- money / expensive → coins
- time / duration → hourglass + sand
- growth / 10x → steps / tower / ladder
- quantity (N items) → N concrete shapes
- network → constellation
- process / pipeline → assembly line

L3 验证 LLM 是不是只会模仿 worked example 里的硬币-航母对, 还是真的**理解 metaphor 概念本身**, 能在其他 5 类自主发挥。

如果 L2 跑通但 L3 跑不通 → LLM 是在**抄 example**, 不是在 reason。Sprint 4+ 必须扩 worked example 库或加 "metaphor recipes" 索引。

## 输入文本 (5 个 case, 各探一类 metaphor)

### Case 3.A — 时间 (hourglass + sand)
> Time is running out — the deadline is in three days and the project is only half done.

### Case 3.B — 增长 (steps / tower / ladder)
> Revenue grew 10x year-over-year, from $1 million to $10 million.

### Case 3.C — 数量 (N items concrete repeat)
> The library houses 1 million books, each one a doorway to another world.

### Case 3.D — 网络 (constellation + edges)
> The neural network connects 1000 nodes through 5000 weighted edges.

### Case 3.E — 流程 (assembly line shapes)
> Raw iron is smelted, rolled, stamped, and welded into car frames at this factory.

## 期望路由行为

LLM 应针对每个 case 选合适的 metaphor:

| Case | 期望主 metaphor | 推荐 atom/helper |
|---|---|---|
| 3.A | 沙漏轮廓 + 下落沙粒 | sdf_box (hourglass 边界) + sdf_circle (sand grains 在 grid) |
| 3.B | 阶梯上升 / 塔加高 | sdf_box 阵列高度递增 |
| 3.C | 1000 个小书形 grid | sdRoundBox (书脊) × N 排列 |
| 3.D | 星座: 节点 + 连线 | sdf_circle (nodes) + sdf_line (edges) |
| 3.E | 流水线 4 段 + 箭头 | sdf_box (stations) + sdEtriangle (arrows) |

6 variant 期望分布 (per case):

| variant | 预期 |
|---|---|
| 1 | P2 主 metaphor (上表) |
| 2 | P2 变体 (不同视角 / 不同 helper 组合) |
| 3 | P2 alt metaphor (e.g., 3.B "增长" 可以画山, 也可以画温度计) |
| 4 | P1 (如果文本含具象, e.g., 3.E "iron" "car" 可走 P1) |
| 5 | P3 兜底 (大字 + label) |
| 6 | P3 兜底 (relational layout) |

**核心**: 每个 case ≥1 个 P2 variant 用 sdf_* helper, 且不是简单照抄 carrier-coin 模板。

## 通过标准

- [ ] **L3-baseline (per case)**: ≥1 variant 是 p5-sketch 含 sdf_* helper 调用 (证明 LLM 应用 metaphor 概念到非货币 case)
- [ ] **L3-cross-case-diversity**: 5 个 case 跑完, **每个 case 产生不同的 metaphor visual** (sand 不像 coins, books grid 不像 step tower) — 证明泛化能力
- [ ] **L3-recipe-coverage**: 5 个 case 的 P2 variant **覆盖 ≥3 类不同 helper 组合**, 不是 5 个全用 sdf_circle 填充
- [ ] **主观**: 每个 metaphor 视觉上能传达原文的抽象意思

## 已知失败模式

- ❌ **LLM 只会"X 由 sdf_circle 填充"** (carrier-coins 模板照抄, 不会其他 pattern) → 5 个 case 全长得一样, 失去 metaphor reasoning
- ❌ **LLM 不识别 metaphor opportunity**, 5 个 case 全走 P3 兜底 (vector boxes + arrows) → v3.20 Priority 2 worked example 数量 (1 个) 不够, 需要扩到 3-5 个覆盖不同 metaphor 类
- ❌ **LLM 尝试 metaphor 但 helper 用错** (e.g., 用 sdf_line 画 "growth steps") → bug 但可纠正
- ❌ **3.D "neural network" 被误识为具象 P1** (LLM 找了 "brain" atom) → 不算 fail, 但失去 P2 demo 机会

## 跑法

每个 case (3.A-3.E) 单独跑一遍:
1. 打开 http://localhost:8001/examples/present/
2. 把 document viewer 里某段替换成 case 文本 (dev console 改 textContent 同 L2)
3. highlight → ⚡ → 等 90s
4. 用 dev console 查每个 variant 的 (subject type, sdf_* 调用):
   ```js
   (await import('/src/present/deck-model.js')).listDecks()[0].visuals[0].variants.map((v,i) => ({
     i, type: v.sceneData?.subjects?.[0]?.type,
     sdfHelpers: [...new Set((v.sceneData?.subjects?.[0]?.args?.code?.match(/sdf_\w+|sdRoundBox|sdTriangle|sdTrapezoid|sdEtriangle|sdf_moon|xRepeated/g) || []))]
   }))
   ```
5. 截图 1 个最 wow 的 metaphor variant

## Result log (每个 case 一组)

### Case 3.A — time running out
- variant 0-5 (priority, type, sdf_helpers, 视觉): __________
- L3-baseline (≥1 metaphor variant): PASS / FAIL
- 最 wow variant 描述: __________
- 截图: __________

### Case 3.B — revenue grew 10x
(同上)

### Case 3.C — 1 million books
(同上)

### Case 3.D — neural network 1000 nodes
(同上)

### Case 3.E — assembly line car frames
(同上)

### 跨 case 总评 (跑完 5 case 后填)
- L3-cross-case-diversity (5 case 视觉显著不同): PASS / FAIL
- L3-recipe-coverage (≥3 类 helper 组合): PASS / FAIL
- 哪些 metaphor pattern LLM 掌握: __________
- 哪些 pattern LLM 没尝试 / 失败: __________
- prompt 修订建议: __________
