# 第四十七课: Chromie Squiggle — Snowfro (Erick Calderon)

- **ArtBlocks #0** (平台创世项目) · p5 · 5.5KB · **NFT License → 纯研究, 零 port**
- 视觉: HSB 彩虹波浪线 — "hash 驱动生成艺术"的 hello world 与创世标本

## 分流判定: 2D-core, 纯研究文档课 (历史课)

## 考古发现

1. **tokenData.hashes 复数**: V0 合约给脚本传的是 hash **数组**
   (`tokenData.hashes[i]`), 32 槽位 × N hashes 全部入池 — 决策
   槽位模式的**原始出处** (Rizzolli L1 / Frammenti L36 / Tan L46
   都是此模式的后代)。后续合约才简化为单 hash。平台的随机性
   API 本身也有代际演化。
2. **谱系意义**: #0 定下的三件事成为全平台惯例 — hash 即作品身份
   / 槽位即 trait / 链上代码即真身。我们的 mint-hash + named-lane
   + DECOR_V 是同一血统的第三代 (槽位→lane 的演进见 rand.js 头注)。
3. 技术上只是 HSB 步进 + **hash 字节控制点的 Catmull-Rom 样条**
   (y = curvePoint 穿过 decPairs 字节映射的控制点 — 不是正弦:
   波形本身就是 hash 的可视化, 字节直接当振幅) + spread trait —
   **简单到极致但身份系统完备**, 证明 provenance 价值在机制不在
   复杂度。样条读法比"正弦"更强地支撑本课自己的 provenance 论点:
   你看到的每个起伏都是 hash 的一个字节。

   > 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-A

## 一句话学到的

创世作品的启示: 身份机制的完备性, 比生成算法的复杂度值钱得多。
