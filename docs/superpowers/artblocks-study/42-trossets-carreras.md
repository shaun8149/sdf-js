# 第四十二课: Trossets — Anna Carreras

- **ArtBlocks #147** · p5 纯 2D · 12KB · CC BY-NC-SA 4.0 → recipe-only (SA 从严)
- 视觉: 网格上的线缠绕小块 (trosset = 加泰兰语"小片"), 松弛童趣

## 分流判定: 2D-core, 文档课 (画家字典架构已入库)

**13** 个具名 trosset 画家 (L/R/H/V/P/X/M/VV/XX/LL/PP/MN/MS)
按格子抽签 — **画家字典第二目击** (L17 Cargo 首见)。字典键有方向
语义 (H/V = 横线/竖线; L/R 对应 arcsD/arcsE, 加泰兰 dreta/esquerra
右/左弧), 但邻格衔接**不靠命名约定的过滤逻辑**成立 (见 idiom 1)。

> 二读勘误 (2026-07-11): 原文核实 (画家 16→13), 详见 audit/batch-C

## 值得带走的 idiom

1. **Truchet 端点约定, 不是约束传播**: 抽签是**全局子集 + 每格独立
   均匀抽取** — possibles 是全图一次性按一个随机数从 p0..p30 选出的
   子集, 每格从中独立均匀抽, **零邻格逻辑**。跨格观感连续靠的是
   Truchet 式静态约定: 图元端点固定在格边 .25/.5/.75 分数位, 任意
   相邻都能接上; 再加绘制时 `scale(2*w)` 超出格子一倍造成交叠。
   一读写的"按邻格已定画家过滤 possibles / 字典+约束传播 = 手写
   WFC"机制**不存在**。cargo-dashes v2 若做"跨块连续纹理"应采
   "Truchet 端点约定 + 全局子集抽签", 不是 WFC。
2. **加泰生活调色板**: cMontseny/cSalines/cIbiza/cAltafulla/cOlivos
   (地名) 之外还有 cPaella/cTortilla (食物)、cBarraca/cIndustria/
   cAlzines/cBuganvilea (物/植物), 共 19 组、5 色一组全部手调 —
   具名调色板共识的人文变体: 名字不是标签是记忆坐标。
3. Carreras 的松弛感来源: **所有绘制图元是精确几何** (arc/line
   端点零抖动, 一读的"端点±抖动"不存在) — 松弛感真实来自 ~7-11%
   概率的格子四分细分 + `scale(2*w)` 的相邻交叠 + 童趣图元词汇。
   秩序在结构层, 松弛在词汇层与尺度层。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-C

## 一句话学到的

跨格连续可以不要任何邻格逻辑: 把端点钉在格边的固定分数位上,
任何两张牌都拼得上 — Truchet 约定是比约束传播便宜一个量级的秩序。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-C
