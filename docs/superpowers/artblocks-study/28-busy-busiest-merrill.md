# 第二十八课: BUSY / BUSIEST — James Merrill

- **ArtBlocks #504 / #503** · 原生 js (webpack, 251KB ×2 姊妹作) · CC BY-NC 4.0 → recipe-only
- 视觉: 程序化道路网 + 沿路行驶的 agent 轨迹 — 城市的"忙"

## 分流判定: 2D-core 大系统 → 出家族 (路网肌理空缺)

Merrill 第二课 (L22 ORI 折纸引擎作者)。trait 字符串暴露类型学:
straight / corner / corner-XL / diagonal-left/right / circular /
intersection / railroad / highway / singleLine / megaSingle / ghost /
pathFromCache — **道路是带类型目录的词汇表**, agent 沿网行驶留痕。
姊妹作 BUSY/BUSIEST 同引擎不同参数档 (250KB 里代码几乎全同)。

## 解剖 (recipe)

1. **网络先于轨迹**: 作品本体是路网拓扑, 车流只是显影剂 —
   与 L20 (场×屏) 同构: 结构与显影分离。
2. **类型目录不是自由曲线**: 转弯是固定半径四分之一圆弧,
   路型是枚举 (直/弯/环/铁路) — 工程感来自约束词汇, 不来自
   曲线自由度。
3. **pathFromCache / ghost**: 轨迹缓存复用 + 幽灵重影 —
   昂贵路径算一次, 显影 N 次。
4. 姊妹发行 (BUSY/BUSIEST): 同引擎两个参数档当两个系列卖 —
   引擎复利的发行策略。

## Port: street-grid 家族 (registry.js, DECOR_V=1 下新增)

路网静态层: 车道 = 平行双轨 (gauge 变化), 宽路加虚线中线,
railChance 概率变铁路 (垂直枕木), 交叉口按概率放四分之一圆弧转角。
agent/车流层不 port (修饰是静态的)。人格 = 车道数 × 转角概率 ×
铁路概率 × 轨距。适配 consulting/pitch (地图/系统图肌理)。

## 一句话学到的

工程感的秘密是词汇表: 枚举的路型 + 固定半径的弯 — 约束即风格。
