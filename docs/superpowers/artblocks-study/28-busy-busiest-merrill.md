# 第二十八课: BUSY / BUSIEST — James Merrill

- **ArtBlocks #504 / #503** · p5.js (Vite/Rollup 打包, 含 p5-svg + 多边形布尔库, 251KB ×2 姊妹作) · CC BY-NC 4.0 → recipe-only
- 视觉: 程序化道路网 + 沿路摆放的车辆精灵 — 城市的"忙"

## 分流判定: 2D-core 大系统 → 出家族 (路网肌理空缺)

Merrill 第二课 (L22 ORI 折纸引擎作者)。trait 字符串暴露类型学,
但清单分层: `straight / corner / corner-XL / start / end` = 路径段
类型; `singleLine / megaSingle / ghost / railroad / highway /
electricPole` = 道路 genus 加权目录; `intersection / furball /
splitter / three-way` = 交叉口目录; `pathFromCache` = 形状缓存类型。
**diagonal-left/right 是调色板空间分布模式、circular 是 turbulence
场模式 — 不是路型** (一读混层)。**道路是带类型目录的词汇表**成立。
作品是**静态的** (noLoop, 无动画循环): 车是精灵多边形按 carDensity
沿路**摆放**, 行人是过街点 — "agent 沿网行驶留痕"是一读想象的机制。
姊妹作 BUSY/BUSIEST 同引擎不同参数档 — 链上实锤: BUSY 的构图模式
表里有零权重 `"busiest",0` 档。

> 二读勘误 (2026-07-11): 原文核实 (p5+Vite 非原生js/webpack; 词汇表
> 分层; 静态精灵非 agent 行驶), 详见 audit/batch-F

## 解剖 (recipe)

1. **网络先于显影**: 作品本体是路网拓扑, 车辆精灵只是显影剂 —
   与 L20 (场×屏) 同构: 结构与显影分离。
2. **类型目录不是自由曲线**: 转弯是固定半径四分之一圆弧,
   路型是枚举 genus (直/弯/铁路/公路/幽灵路) — 工程感来自约束
   词汇, 不来自曲线自由度。
3. **pathFromCache / ghost**: pathFromCache = 昂贵路径算一次、按
   refID 带偏移重印 N 次; ghost 是道路 genus 之一 (单 ink 淡色
   幽灵路, 与 singleLine 同路径、占格豁免) — "幽灵重影"的读法
   收回, 混淆代码里读不出重影证据。

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-F
4. 姊妹发行 (BUSY/BUSIEST): 同引擎两个参数档当两个系列卖 —
   引擎复利的发行策略。

## Port: street-grid 家族 (registry.js, DECOR_V=1 下新增)

路网静态层: 车道 = 平行双轨 (gauge 变化), 宽路加虚线中线,
railChance 概率变铁路 (垂直枕木), 交叉口按概率放四分之一圆弧转角。
agent/车流层不 port (修饰是静态的)。人格 = 车道数 × 转角概率 ×
铁路概率 × 轨距。适配 consulting/pitch (地图/系统图肌理)。

## 一句话学到的

工程感的秘密是词汇表: 枚举的路型 + 固定半径的弯 — 约束即风格。
