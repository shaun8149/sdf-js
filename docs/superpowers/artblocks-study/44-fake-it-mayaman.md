# 第四十四课: FAKE IT TILL YOU MAKE IT — Maya Man

- **ArtBlocks #337** · 原生 js · 39KB · CC BY-NC-ND 4.0 → 严格 recipe-only
- 视觉: 励志语录 + 贴纸的网络美学拼贴 — 对自我优化文化的反讽

## 分流判定: 2D-core, 文档课 (文字语义 = 伦理线, 与 L25 同规)

生成的是**句子**: sentenceStructure + interjection + punctuation 槽位
拼装励志短语。文字内容不进修饰层 (第三次确认此线: Cytographia 字形 /
Still Moving 诗行 / 本课语录)。注: textBoundingBoxes 是 write-only
死代码 (见 idiom 2 勘误); stickers 是布尔开关 + 网格平铺, 非自由
层叠拼贴。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-G

## 值得带走的 idiom

1. **语法槽位生成文本**: 句构模板 + 插入语槽 + 标点槽 — 文本生成
   的"scaffold + slot"结构, 与我们 deck scaffold/slot 架构神似,
   佐证该分解在另一媒介的普适性。
2. **文字防重叠 = 按长度分档降级, 不是碰撞求解**: 一读的
   "textBoundingBoxes 增量放置 + 重叠检测"机制**不存在** — 该变量
   全文件只有声明和 push, 从未被读取 (write-only 死代码), 也没有
   任何 overlap/intersect 检测函数。真实防线是**按文本长度降字号/
   关贴纸**: 文本 ≥7 词或 ≥5 词组时字号降档并关闭贴纸, ≥10 词再关。
   教训升级: 生成侧最便宜的避让是"参数分档退让", 未必要几何碰撞。
3. 贴纸层 (stickers) = 点缀词汇表 (star/sparkle/cuteFace 等, 抽签
   选类型), 但开关是布尔、摆放是网格平铺 — 独立词汇表与 icon-library
   分离架构的同构仍成立, "自由层叠拼贴"的读法收回。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-G
4. Maya Man 的概念层: 作品讽刺的"表演性自我" 恰是生成艺术收藏
   文化自身 — Curated 会收录批评自己的作品, 策展的自反性。

## 一句话学到的

生成侧防重叠可以不做几何: 按内容长度分档退让 (降字号/关点缀),
一行三元表达式顶得上一个碰撞引擎。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-G
