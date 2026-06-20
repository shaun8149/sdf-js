---
test_id: L5-priority-3-other-relations
priority_under_test: 3 (P5 FALLBACK — non-sequence relations)
purpose: 验证 P5 fallback 能 cover sequence 以外的抽象关系类型 (compare / hierarchy / network 无 metaphor 兜底 / 列表)
sprint: 3
created: 2026-06-20
---

# L5: Priority 3 (non-sequence) — P5 兜底 cover 全套抽象关系类型

## 测试目的

L4 验证了 sequence 类抽象 → P5 兜底没问题。但抽象关系不只 sequence 一种 — Napkin / antvis 总结过经典几大类:

1. **Sequence** (步骤): A → B → C → D — L4 验证
2. **Comparison / Opposition** (对比): A vs B, SWOT, 2x2 matrix — L5
3. **Hierarchy** (层级): X is parent of Y is parent of Z — L5
4. **Network** (网络无 metaphor): N 个节点 + 互连, 但 LLM 找不到具象隐喻 (跟 L3.D constellation 不同) — L5
5. **List** (并列): A, B, C, D 无明显关系 — L5

L5 验证 P5 兜底**全套覆盖**。任何一类 fail 都意味着用户某种文本下会看到无法用的输出。

## 输入文本 (4 个 case)

### Case 5.A — comparison / 2x2 matrix
> Static analysis is fast but limited; dynamic analysis is thorough but slow. Each has its place in a complete security strategy.

### Case 5.B — hierarchy (org chart / tree)
> The CEO oversees three VPs: Engineering, Product, and Marketing. Engineering has four directors: Backend, Frontend, Mobile, and Infrastructure.

### Case 5.C — network 无 metaphor
> Microservices in this architecture communicate through async message queues. The auth service calls the user service, the user service calls billing, billing calls the email service, the email service calls auth (callback), and so on.

### Case 5.D — pure list (并列无关系)
> Our values are: integrity, transparency, customer focus, continuous learning, and accountability.

## 期望路由行为

LLM 应识别每种关系结构并选合适 layout:

| Case | 关系类型 | 期望 P3 layout |
|---|---|---|
| 5.A | 对比 | 左右两栏对比 / 2x2 grid / pros-cons 表 |
| 5.B | 层级 | 树形 / 缩进列表 / 嵌套 boxes |
| 5.C | 网络无 metaphor | nodes (boxes 或 circles) + lines, 无具象 (区别 L3.D 的 constellation 星空) |
| 5.D | 并列 | 5 个 equal-weight boxes 横排 / radial spokes |

6 variant 期望分布 (per case):

| variant | 预期 |
|---|---|
| 1 | P3 主 layout (上表) |
| 2-3 | P3 变体 (不同 layout 表达同关系) |
| 4-5 | P3 alt (e.g., 5.A 可以 2x2 也可以 timeline 对比) |
| 6 | P2 尝试 (低概率, 5.A "static vs dynamic" 可走天平 metaphor) |

## 通过标准

- [ ] **L5-coverage**: 4 个 case 全部至少有 ≥1 variant 是合理 layout (不黑块 / 不乱)
- [ ] **L5-structural-fit**: layout 跟内容结构匹配 (5.B 看起来像树, 不是 timeline; 5.C 看起来像网络, 不是 sequence)
- [ ] **L5-diversity per case**: 6 variant 至少 3 种不同 layout, 同 L4-layout-diversity 标准
- [ ] **主观**: 5.C 网络 case 不应该出现 "把网络强行画成 sequence" 这种结构错配

## 已知失败模式

- ❌ **LLM 一招吃所有**: 4 case 全画 "N 个 box + 横向箭头" (sequence 模板) → fallback 范式太窄, prompt 应给每种关系一个 worked example
- ❌ **5.B 层级被画扁平** (org chart 画成并排 boxes, 丢失层级) → LLM 没识别 hierarchy
- ❌ **5.C 网络被画线性** (callback 关系画成单线箭头, 丢失"环"结构) → LLM 没识别 cycle
- ❌ **5.D 并列被强加顺序** (画成 sequence "values 1 → 2 → 3 → 4 → 5", 但原文没有先后) → 错误暗示
- ❌ **5.A 对比被画成并列** (左右两栏但没对比箭头/分界) → 信息丢失

## 跑法

1-4. 同 L1-L4 (replace text → highlight → ⚡ → 等 90s)
5. 重点用人眼判 layout 是否结构匹配

## Result log

### Case 5.A — static vs dynamic analysis
- 6 variant layout:
  - 0: __________
  - 1: __________
  - ...
- L5-baseline (≥1 合理 layout): PASS / FAIL
- L5-structural-fit (layout 像对比, 不是 sequence): PASS / FAIL
- 最 best variant: __ — 截图: /tmp/__________

### Case 5.B — CEO → VPs → directors hierarchy
- 6 variant layout: __________
- L5-baseline: PASS / FAIL
- L5-structural-fit (像树, 不扁平): PASS / FAIL
- best variant: __

### Case 5.C — microservices network with cycle
- 6 variant layout: __________
- L5-baseline: PASS / FAIL
- L5-structural-fit (有环不是线性): PASS / FAIL
- best variant: __

### Case 5.D — 5 company values (parallel)
- 6 variant layout: __________
- L5-baseline: PASS / FAIL
- L5-structural-fit (并列不强加顺序): PASS / FAIL
- best variant: __

### 总评
- 4 关系类型 LLM 全 cover: PASS / PARTIAL (哪类 fail) / FAIL
- 跟 Napkin / antvis 同类输出对比 (你 manual 体感, 不需精确): Atlas WIN / TIE / LOSE
- prompt 修订建议: __________
