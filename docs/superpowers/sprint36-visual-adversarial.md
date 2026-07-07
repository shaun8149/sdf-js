# Sprint 36 — 视觉对抗轴 (2026-07-07)

文本四轴 (facts/entities × recall/precision) 看不见"渲染坏了"的 slide。
视觉轴 = **插桩渲染**: 真跑每个 atom 的绘制代码, 录制 fillText/fillRect +
完整仿射变换 (旋转轴标签必须跟踪 transform, 否则假坐标), 确定性判六类:

| 判定 | 含义 |
|---|---|
| RENDER_CRASH | atom 绘制抛异常 |
| OUT_OF_BOUNDS | 墨水画出 1280×720 画布 (+8px 容差) |
| TEXT_OVERFLOW | 字符串估宽 (CJK 1.0×fs / Latin 0.58×fs) 冲出右缘 |
| TINY_FONT | < 9px 文字 (deck 尺度不可读) |
| TEXT_COLLISION | 跨 subject 文字框重叠 > 40% |
| SUBJECT_OVERLAP | 非 cover subject 声明框重叠 > 25% |
| BLANK_SLOT | 全渲染 < 5 次落墨 (纯 cover 页豁免) |

入口: `visual-audit.mjs` (auditSlotVisual/auditDeckVisual), 已接进
eval scorer (VISUAL 块, report-only 不进 composite) + a16z 复验器 (visual 列)。

## 首轮扫描 (39 decks) 与已修

初扫 **117 issues** → 修复后 **84**:
- **cover 标题无宽度自适应 (26 例, 最大真问题簇)**: titleSize=h*0.14 直画,
  a16z 长英文标题冲出右缘 ~400px。修: shrink-to-fit (floor 20px), 副标题同。
  浏览器截图交叉验证 raise-15b 首页 ✓
- 指标噪音: 纯 cover 页误报 BLANK / 装饰性单字符引号误报 OOB / rotate 轴标签
  假坐标 (transform 跟踪修复)

## 剩余 84 = 下轮打磨排序清单

- **TINY_FONT ×45** (最大簇): icon-grid ×9 / stat-with-icon ×7 / stat-banner ×7 /
  dashboard ×4 …— fit-to-space 缩字无下限 (最恶劣 callout-banner 3px)。
  修法样板 = stat-banner 的 fitLabelSize (floor + 换行)
- TEXT_OVERFLOW ×20: isotype-stat-comparison ×11 领跑 (长 label 无适配)
- SUBJECT_OVERLAP ×9 + TEXT_COLLISION ×5: LLM 排版错误 (100% 重叠框) —
  候选修法: lift prompt 加排版规则 或 lift 后确定性推挤
- OUT_OF_BOUNDS ×5

方法论: 仪器先行 → 全量测量 → 修最大簇 → 复测。117→84 是第一轮, 清单已排序。

## Sprint 37 打磨轮 (同日): 84 → 6

| 修复 | 消减 |
|---|---|
| **registry 级字号地板** `MIN_FONT_PX=9` — renderAtom 单点包装 ctx 拦截 font setter, "任何 atom 不得画 <9px 文字"成为注册表契约 (12 个 atom 的无下限公式一次覆盖) | TINY_FONT 45→0 |
| `fitFontPx` 共享 helper + isotype/bullet-list/agenda/kpi-card/bar/pie/stat-grid 逐位点缩字适配; stat-grid trend chip (LLM 塞整个清单进 trend 字段); pull-quote **wrapText 中文无空格永不折行** bug (字符级回退) | TEXT_OVERFLOW 46→3, OOB 6→3 |
| **Rule 23 SUBJECTS NEVER OVERLAP** (共享 lift prompt, 排版算术自检) + 重 bake 8 个受影响 deck | SUBJECT_OVERLAP 9→0, TEXT_COLLISION 6→0 |

累计 **117 → 6** (-95%)。残留 6 个为单例长尾 (flow-chart 节点布局 / icon-row 超长 sublabel floor 击穿 ×2 / value-chain 右缘 / bullet-list ×1 / agenda ×1), 审计持续看守。
浏览器抽查: read-25-books (曾 100% 重叠重灾区) 全 10 页干净。
