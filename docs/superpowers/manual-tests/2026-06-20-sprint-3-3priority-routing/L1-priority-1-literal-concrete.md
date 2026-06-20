---
test_id: L1-priority-1-literal-concrete
priority_under_test: 1 (SDF DIRECT)
purpose: 验证 LLM 在文本含具象名词时直接复用 Sprint 1 v4 atom 库, 不走 P5
sprint: 3
created: 2026-06-20
related_test_files:
  - L2-priority-2-money-metaphor.md (⭐ Atlas wedge)
  - L3-priority-2-other-metaphors.md
  - L4-priority-3-sequence-fallback.md
  - L5-priority-3-other-relations.md
  - L6-multi-priority-variant-diversity.md
  - L7-edge-cases-and-robustness.md
---

# L1: Priority 1 — SDF DIRECT (字面具象)

## 测试目的

验证 v3.20 prompt 在文本含**单一具象物体**时, LLM 走 Priority 1 (传统 SceneData + 现有 atom), **不**偷懒走 P5 兜底。这是 Atlas 历史上最强能力 (Sprint 1 v4 已 ship), Sprint 3 不应该让它退化。

## 输入文本 (3 个 case 各跑一遍)

### Case 1.A — single concrete noun
> The cathedral on the hill at dawn stood silent against the rising mist.

### Case 1.B — multiple concrete nouns
> Three carriers anchored in the harbor, with a lighthouse on the rocks behind them.

### Case 1.C — concrete + setting
> A robot stood in the empty factory, surrounded by motionless conveyor belts.

## 期望路由行为 (per v3.20)

LLM 应识别:
- Case 1.A: `cathedral` + `hill` → Priority 1 直接调
- Case 1.B: `carrier` × 3 + `harbor` + `lighthouse` → Priority 1 多个 atom
- Case 1.C: `robot` + `factory` → Priority 1

6 variant 期望分布:

| variant | 预期 priority | 预期 subject type | 预期形状 |
| --- | --- | --- | --- |
| 1 | P1 | traditional | cathedral atom + terrain |
| 2 | P1 | traditional | 简化版 (只 cathedral) |
| 3 | P1 变体 | traditional | 不同视角 / atom 组合 |
| 4 | P2 (可能) | traditional 或 p5-sketch | 如果 LLM 看到 "dawn"/"mist" 可能加 atmospheric metaphor |
| 5 | P3 兜底 | p5-sketch | 兜底, 但应该是少数 |
| 6 | P3 兜底 | p5-sketch | 同上 |

**核心**: ≥4 个 variant 应该是 traditional sceneData (subjects[0].type != 'p5-sketch')。

## 通过标准

- [ ] **客观**: 6 variant 中至少 **4 个** sceneData.subjects[0].type **不是** 'p5-sketch' (走传统渲染)
- [ ] **客观**: 至少 1 个 variant 用了**预期 atom** (cathedral / carrier / lighthouse / robot)
- [ ] **主观**: 传统渲染的 variant 看起来像描述的物体 (不是抽象方块/圆球)
- [ ] **主观**: P5 兜底的 variant (如果有) 不是黑块或乱码

## 已知失败模式 (Sprint 1.5 + 2 教训)

- ❌ **LLM 偷懒全走 P3 兜底** (Sprint 1.5 收敛 bug 复现) — 6 个全是 P5 vector, 没用任何 atom
  → fix: v3.20 prompt Priority 1 worked example 不够强 / 没明说 "concrete noun 必走 P1"
- ❌ **LLM emit 不存在的 atom 名** (例 `'aircraft-carrier'` 而不是 `'carrier'`) → variant 报 lift error
  → fix: prompt 加 atom 库 explicit 列表
- ❌ **LLM emit text-3d-** 被 sanitize 过滤 (regression: Sprint 2 forbid 失效)
  → fix: 检查 sanitize2dSceneData filter 是否还在工作

## 跑法

1. 打开 http://localhost:8001/examples/present/
2. 导入 PDF (任意, 推荐 `sdf-js/fixtures/test-deck.pdf` 或自己的)
3. 在 document viewer 找一段文本, **用浏览器选中工具替换成 case 1.A 的文本** (或直接在 PDF 找类似句子)
4. 点 ⚡, 等 ~90 秒 6 个 lift 完成
5. 把 6 variant 状态填到下面 Result log
6. 重复 case 1.B + 1.C

## Result log (跑完后填)

### Case 1.A — cathedral on the hill

- variant 0: __________ (priority? subject type? 视觉简述?)
- variant 1: __________
- variant 2: __________
- variant 3: __________
- variant 4: __________
- variant 5: __________

- 实际 P1 占比: __ / 6
- 用到 cathedral atom 的 variant 数: __
- 视觉质量 (1-5): __
- 控制台错误: __________
- 截图: /tmp/__________
- 总判: PASS / PARTIAL / FAIL
- notes: __________

### Case 1.B — carriers + lighthouse
(同上格式)

### Case 1.C — robot + factory
(同上格式)
