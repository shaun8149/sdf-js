# Sprint 64: auto 骨架端到端真机验证 (Guidewire Q3 FY26 季报)

## 设置

- **输入**: Guidewire 2026-06-04 真实季报新闻稿 (2757 字符, 全真数字),
  fixture 在 `sdf-js/scripts/fixtures/qbr-guidewire-q3fy26.txt`
- **路径**: `newsToFullDeck({ scaffoldId: 'auto' })` — Sprint 63 新路径,
  eval 语料此前全部是 news-briefing 烤的
- **runner**: `sdf-js/scripts/validate-auto-scaffold.mjs` (常设仪器:
  任意文章 → auto 骨架 → 烤成 scaffold-pipeline 目录 → 五轴同尺)

## 结果

| 轴 | 结果 | news 基线参照 |
|---|---|---|
| 骨架选择 | **financial-summary** (10 槽) — 季报落财务骨架, 正确 | n/a (新路径) |
| 结构 | fill_rate **1.0** (10/10, 0 errors), 70.5s | 1.0 |
| atom 质量 | 7 类 34 实例, 1 个 arg violation (kpi-card trendDirection) | 同级 |
| 3D readiness | twin 1.0, lift 10/10 | 1.0 |
| 数字 recall | **96.1%** (49/51; 漏 $4.5M 原文位、回购股数精确值) | 95.8% |
| 数字 precision | 字面 87.9% — 但见下: **真实为 100%** | ~100% |
| 实体 | precision 93.1%, recall 50% (漏 CFO Jeff Cooper) | 84.8% recall |
| 视觉 | 3 × TEXT_OVERFLOW → 修复后 **0** | 101/101 |

## 发现 1 (本次最大): "幻觉数字"全部是正确的衍生算术

字面精度把 7 个数标为幻觉, 逐一验算全部成立:

| 数 | 来源 |
|---|---|
| +580% | GAAP 营业利润 (30.6-4.5)/4.5 |
| +69% | 非GAAP 营业利润 (77.8-46.1)/46.1 |
| -64% | GAAP 净利 (46.0-16.5)/46.0 |
| +47% | 非GAAP 净利 (69.6-47.4)/47.4 |
| +49% | 非GAAP EPS (0.82-0.55)/0.55 |
| 22.7% | 现金降幅 (1483.2-1146.8)/1483.2 |
| 1.7M | 回购股数 1,696,180 取整 |

**结论**: financial-summary 骨架的槽位天然要求增幅/占比分析, 模型做了
正确的算术。Rules 21-22 ("永不发明数字") 在财务骨架下有一个合法灰区:
**衍生 ≠ 发明**。eval 的字面匹配精度在此系统性低估 —— 后续任选其一:
(a) eval 加衍生数验证器 (对源数字做四则组合匹配);
(b) lift 规则要求衍生值标注来源 (如 "+580% (30.6 vs 4.5)"), 字面匹配
自然恢复。倾向 (b): 对读者也更诚实。

## 发现 2: stat-banner value 不按宽度收缩 (已修)

真实数据把 "Record Quarter" 放进 392px 侧栏 banner → 溢出画布
(audit x=1327 > 1280)。根因: value 字号只由 bannerH 定, 从不量宽。
修复: 收缩循环 (min 14px), 本 deck 审计 3→0, 全套件 133/133。
残留 polish: 收缩后 label 尾巴贴画布右缘 (在界内, 不触发 audit)。

## 发现 3: 实体 recall 的分母太小

季报只有 2 个人名实体 (CEO/CFO), 漏 1 个就是 50% — 小分母噪声,
不代表回归。综合判断: **auto 路径的整本质量与 news 基线同级**,
新路径可以放量。

## 交付物

- 常设 runner + 真机 deck (`examples/scaffold-pipeline/qbr-guidewire-auto/`)
- stat-banner 修复 (renderer 级, 惠及所有路径)
- 本文档
