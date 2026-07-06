# Sprint 30 — 任意 500 字新闻 → 稳定 10-20 页 PPT (2026-07-07)

User 验收标准: "任意的500字新闻可以产出稳定的10-20页PPT"。

## 一条命令

```bash
node sdf-js/scripts/news-to-deck.mjs --text article.txt --deck-name my-news --key-file key.txt
```

链: **expand-news** (Stage -1, 生文本 → 12-18 slide 大纲) → **bake-scaffold-pipeline**
(`--scaffold news-briefing` 钉选 + `--min-pages 10` 页数地板) → **eval** + 页数带宽断言。

## 新组件

| 件 | 作用 |
|---|---|
| `expand-news.mjs` | LLM 扩展 + 4 层确定性兜底: 数量不足复述重试 → `splitToFloor` 机械拆分 → `mergeToCeiling` 机械合并 → 指数退避重试 (429/5xx) + `repairJsonQuotes` (中文引号被模型转 ASCII 引号破坏 JSON — 行级转义修复) + max_tokens 截断打捞 |
| `news-briefing` scaffold | 第 21 个 scaffold, 14 slots: headline/agenda/key-figures/3×theme-lead+detail/risk-matrix/2×risk-detail/quote/outlook/summary |
| bake `--scaffold <id>` | 跳过 picker — 页数不再吃 picker 方差 |
| bake `--min-pages N` (Stage 1.6) | mapper 把多 slide 折进一 slot 时, 从最重 slot 的 extraSlides 里确定性赎回空 slot — orphan-rescue 同哲学, 不复制不造假 |
| `news-stability-harness.mjs` | 验收器: 3 文本 × N 次全链 bake, 断言每次页数 ∈ [10,20] |
| `test-expand-news.mjs` | 13 断言 (机械件, 无 LLM) 进 npm test |

## 验收结果 (最终代码, 6/6 PASS)

3 篇不同领域中文新闻 (经济/科技芯片/新能源政策, 各 ~450-520 字) × 2 runs:

```
run                     pages  band   score   facts%  ents%
news-econ-run1            14    ✓     100    100     100
news-econ-run2            14    ✓     100    100     100
news-tech-run1            12    ✓    96.4    100     100
news-tech-run2            12    ✓    96.4    100     100
news-policy-run1          13    ✓    98.2    100     100
news-policy-run2          13    ✓    98.2    100     100
```

页数 12-14 (带宽中部, 距离 10/20 边界都有余量), **数字 recall 6/6 全 100%**
(econ 11 个数字 / tech 20+ / policy 18 个), 视觉抽查 news-econ-run1 十四页全渲染
(viewer 截图 `screens/sprint28-validation/news-econ-run1-deck.png`)。

## 过程中抓到并修掉的失稳源

1. **模型把中文引号转成 JSON 内未转义 ASCII 引号** → parse 崩 (policy 文本可复现)。
   修: `repairJsonQuotes` 行级转义 — 这是确定性修复, 不是重试碰运气。
2. **瞬时 API 429/5xx** → 指数退避 3 attempts。
3. **计数重试路径未包 try** → 一次 LLM 故障拖垮整条链。修: 重试失败落回机械地板。

## 已知余量 (不阻塞)

- 页数落在 12-14, 未触发过 `--min-pages` 地板 — 地板是保险不是常态路径
- 中文实体抽取不认 部/局 后缀机构 (工信部/能源局) 与无后缀公司名 (比亚迪) —
  这些 deck 的 ents 分母为 0, 不影响分数但 metric 对它们盲
- slide "Theme-1 Lead" 与 "Key Figures" 可能展示同组数字 (概览 vs 深挖, 语义成立)
