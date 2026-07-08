# 第四十四课: FAKE IT TILL YOU MAKE IT — Maya Man

- **ArtBlocks #337** · 原生 js · 39KB · CC BY-NC-ND 4.0 → 严格 recipe-only
- 视觉: 励志语录 + 贴纸的网络美学拼贴 — 对自我优化文化的反讽

## 分流判定: 2D-core, 文档课 (文字语义 = 伦理线, 与 L25 同规)

生成的是**句子**: sentenceStructure + interjection + punctuation 槽位
拼装励志短语, textBoundingBoxes 做文字排布碰撞, stickers 层叠贴纸。
文字内容不进修饰层 (第三次确认此线: Cytographia 字形 / Still Moving
诗行 / 本课语录)。

## 值得带走的 idiom

1. **语法槽位生成文本**: 句构模板 + 插入语槽 + 标点槽 — 文本生成
   的"scaffold + slot"结构, 与我们 deck scaffold/slot 架构神似,
   佐证该分解在另一媒介的普适性。
2. **文字排布 = 碰撞问题**: textBoundingBoxes 增量放置 + 重叠检测
   — 与我们 visual-audit 的 TEXT_COLLISION 检查同一数学, 他们用于
   生成时避让, 我们用于验收时报警; 生成侧避让是更早的防线。
3. 贴纸层 (stickers) = 独立于构图的点缀词汇表 — 我们 icon-library
   与 atom 分离架构的又一同构。
4. Maya Man 的概念层: 作品讽刺的"表演性自我" 恰是生成艺术收藏
   文化自身 — Curated 会收录批评自己的作品, 策展的自反性。

## 一句话学到的

文字排布本质是碰撞求解 — 生成时避让永远好过验收时报警。
