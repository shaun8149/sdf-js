# 第二十九课: Quine — Larva Labs

- **ArtBlocks #506** (Curated 收官作, V3 合约) · custom (整份 HTML 上链) · 37KB · **NFT License → 纯研究, 零 port**
- 视觉: 作品渲染自己的源代码 — 语法块着色的代码版面构成

## 分流判定: 2D-core (SVG), 纯研究文档课

CryptoPunks/Autoglyphs 作者的 ArtBlocks 收官献礼。script 字段不是
js 而是**一整份 HTML 文档** (ASCII art 签名头 + style + svg + 代码),
processBlocks/processSubstitutions 把自身源码切块、按 scheme 着色、
排成 SVG 版面 — 标准 quine: 输出即源码。

## 值得带走的 (思想, 非代码)

1. **code-is-data 的极致样本**: 我们的数学优雅性测试第 3 条
   (code-is-data) 在生成艺术殿堂的表达 — 作品与其描述是同一个
   字节序列。Autoglyphs (链上 ASCII) 的十年后回声。
2. **命名 scheme 目录**: randomColorScheme/getSchemeByName —
   配色不是参数是**有名字的收藏词条** (与 L12 Trichro-matic 的
   具名调色板互证, 第三次目击 → 具名调色板升级为社区共识)。
3. **script_type 也是媒介选择**: p5/js/svg/custom-HTML —
   Quine 选 custom 因为它的内容就是它的容器。对 Atlas: deck.json
   既是数据也可以是展品 (机器契约的 Quine 式反身性, 思想储备)。
4. Curated #506 = 编号最大 = 系列终点站由自指作品收束 —
   策展叙事本身是作品的一部分。

## 一句话学到的

最深的确定性是自指: 当作品就是自己的源码, provenance 不需要外部证明。
