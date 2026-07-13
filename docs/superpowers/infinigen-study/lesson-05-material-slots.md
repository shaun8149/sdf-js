# Infinigen 研读 · 第五课:语义材质槽(material_assignments)

> 前置:L01-L04。本课读材质分配系统 —— 作者注释里的原话是它的全部纲领:
> **"separate materials from implementations"**(Meenal Parakh 的 initial
> assignment system)。源码:`assets/composition/material_assignments.py`
> (442 行)+ `core/util/random.py weighted_sample` + 一个材质实现样本
> `assets/materials/terrain/stone.py`。读取 2026-07-13,main,BSD-3。

## 一、三层分离(源码解剖)

```
# material_assignments.py — 全库唯一的一张"语义槽 → 加权候选"表
rock  = [(terrain.Mountain, 5), (terrain.Stone, 1)]
bark  = [...]
woods = [(wood.Wood, 1.0), (wood.WhitePlywood, 0.1), ...]

# 工厂端(BoulderFactory L57-58)
with FixedSeed(factory_seed):
    self.rock_surface = weighted_sample(material_assignments.rock)()

# 材质实现端(stone.py geo_stone L44+)
with FixedSeed(random_seed):
    size_bumps_lf = uniform(0, 30)      # 材质自身也是参数采样器
    dens_crack   = uniform(0, 0.1)
```

1. **工厂只声明语义**:"我是 rock" —— 不 import 任何具体材质。
2. **候选与权重住中央注册表**:一张表管全库。改 `rock` 一行 = 全世界的石头
   换族。这是 retheme 的杠杆点,也是 442 行文件成为"美术总监"的原因。
3. **材质实现是参数采样器**:Stone 不是一种固定观感,是 bump 尺寸/裂缝密度
   的分布,在物种 seed 下坍缩 —— 与 genome(L04)完全同构。
4. wear_tear(划痕/磨边)是概率叠加层 —— 未移植,记为候选。

## 二、Atlas 移植:material-slots.js

- `MATERIAL_SLOTS = { rock: [[graniteCool,5],[basaltDeep,1],[sandstoneWarm,0.5]],
  bark: [...], foliage: [[pineGreen,4],[autumnRust,1]] }` —— 配方 =
  `(S, lane) => material`,参数是分布(stone.py 的对应物)。
- `drawMaterial(slot, S, {lane, registry})`:物种 lane 系下加权抽配方并实例化。
  `registry` 可覆盖 = retheme 杠杆的机器面(未来接 deck palette/theme 的口)。
- **工厂重接**:boulder 的材质从"工厂内写死的分布"变成 `drawMaterial('rock', S)`;
  conifer 的 genome 不再内嵌颜色分布,只指槽名(`foliageSlot`/`trunkSlot`)——
  L04 的教训递归应用:形状学是数据,材质学也是数据,genome 只留指针。
- 同一工厂抽两个槽用 lane 前缀区分(物种内冠一族、干一族,永远配套)。

### 与 Wave A scene.materials 的关系(容易混)

| | Wave A `scene.materials` | L05 `MATERIAL_SLOTS` |
|---|---|---|
| 层 | 编译期,场景内 | 生成期,资产库 |
| 内容 | 材质**实例**去重(36 种 × 300 引用) | 语义槽 → 加权**配方** |
| 作用 | 场景 JSON 瘦身 + 统一改写口 | 工厂声明语义,retheme 杠杆 |

上下游:槽在生成期抽出实例 → 实例进场景 → Wave A 在编译期去重。

## 三、本课产物

- `src/scene/material-slots.js`(注册表 + drawMaterial + censusSlot)
- boulder/conifer 工厂重接(genome 去掉颜色分布,PINE_GENOME 改指槽名)
- `scripts/test-material-slots.mjs`(8 断言:确定性/权重/retheme 覆盖/
  fail loud/工厂贯通/双槽配套)

## 四、第六课候选

- wear_tear 概率叠加层(材质的"年龄轴")
- 针叶/叶实例散布(child_placement → rep/scatter)
- 产品接点批次:alpine env 换 conifer 混林 + horizon 盲测(等节奏)
