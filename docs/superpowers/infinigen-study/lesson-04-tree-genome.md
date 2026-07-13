# Infinigen 研读 · 第四课:GenericTreeFactory(genome 注入 + taper 律 + 林分批处理)

> 前置:L01(AssetFactory)/ L02(位移 + D3D 预算)/ L03(混林)。
> 本课读树 —— Infinigen 资产库里最复杂的一族。源码:
> `objects/trees/generate.py`(564 行,GenericTreeFactory)+
> `objects/trees/treeconfigs.py`(1330 行,物种 genome 库)。
> 读取 2026-07-13,main,BSD-3。

## 一、三个新语法(源码解剖)

### 1. genome 注入:工厂是通用机器,物种是外部数据

```
GenericTreeFactory(factory_seed, genome: tree.TreeParams, child_col, ...)   # L66-69
treeconfigs.py: pine_tree() / palm_tree() / baobab_tree() / bamboo_tree() / shrub()
```

boulder 的物种参数写死在工厂内;树不是 —— **一台工厂,喂不同 genome 出不同
树种**。物种形状学彻底 DATA 化(treeconfigs 是 genome 库,不是工厂库)。这是
资产库规模化的关键一跳:加树种 = 加一份数据,不是加一个类。

### 2. 锥形轮廓来自 taper 律,不是锥体 prim(pine_tree L866-893)

```
per_layer = 4                                # 每层 4 根枝(轮生)
"sz": max_sz - (max_sz / tree_ht) * (idx // per_layer)   # L882:枝长随高度线性衰减
"n_pts": ⌊((n - idx//per_layer) / n) * 6⌋ .. ⌈... * 8⌉    # L875-878:枝点数同步衰减
"ang_min": π/2, "ang_max": π/2 + π/16        # L888-889:枝近水平、微下垂
```

松树的锥形不在任何地方被声明 —— 它从"枝长按高度线性衰减"的规律**涌现**。
换 taper 律 = 换树形(palm/baobab 就是不同的律)。

### 3. 骨架一次,两形态共享(generate.py L96-159)

`create_placeholder` **总是**先建骨架(tree_skeleton,空间竞争生长),粗网格
或 4m 立方体只是它的壳;`create_asset` 从 `placeholder.children[0]` 取回同一
副骨架再精细蒙皮。**贵的结构计算只做一次** —— L01"placeholder/asset 同
instance seed"在树上升级成"同一份骨架对象"。叶子不是几何:child_col 实例
集合按 child_placement(密度/尺度域)散布在骨架上(Blender 实例化,我们的
rep/scatter 的亲戚)。

## 二、Atlas 移植:makeConiferFactory(seed, genome)

- **genome 注入**:第二参,默认 `PINE_GENOME`(treeconfigs pine 的蒸馏:高度/
  裸干占比/冠径斜率/层数/材质带/风倾上限,全部是"分布"不是常数)。测试里
  用矮胖 genome 验证同一台机器出不同物种。
- **taper 律**:asset 形态的冠 = N 层锥塔,第 t 层底半径 `crownR × (1 − f×0.78)`
  —— 律的离散化;锥体只是单元,轮廓来自律。
- **双形态**:placeholder = union{干圆柱 + 双椭球}(子项只平移,analytic 契约);
  asset = union{裸干 + displace(smoothUnion 锥塔)}(每树 1 个 displaced
  subject,守 L02 预算)。
- **finalizeAssets(林分批处理,finalize_assets 的首个消费者)**:盛行风。
  "整片林共享一个风向"是**单株表达不了的决策**(每株自己抽就成乱风)——
  这正是 finalize 钩子存在的理由。物种级 lane 抽风向+强度,批处理时压到每株
  的 rotate x/z;placeholder 不受染(倾斜是非 yaw 旋转,analytic 契约优先)。
  `makeAssetCollection` 补了 `spawnAll(n, optsFor)`:混林生成后按物种回调
  finalize(factory.py L200-209 的完整对应物)。

## 三、视觉验证抓到的坑(第 5 个跨课教训)

**displace 是不透明 leaf,子件材质活不下来** —— 第一版树把 trunkMat/foliage
挂在 displace 内部的子件上,studio 拿不到材质走了默认色环:三棵同物种的树
渲染成绿/紫/白。这是共面材质限制([[studio-coincident-surface-material-limit]])
的近亲:flattenUnion 只下潜 union,domain group 是 opaque leaf。
**规矩:要多材质,就把部件提成 union 的 sibling** —— 干走普通 leaf(自带
材质),冠的材质挂 displace wrapper。修复后一林同色、干冠分明。

## 四、映射表增补

| Infinigen | Atlas |
|---|---|
| genome: TreeParams 注入 | makeConiferFactory(seed, genome) 第二参 |
| treeconfigs 物种库 | PINE_GENOME(+ 调用方自带 genome) |
| 枝长线性衰减(L882) | 锥层半径 × (1 − f×0.78) |
| tree_skeleton 一次共享 | instance() 同 lane 双形态(结构参数级共享) |
| child_col 叶实例散布 | 未移植(SDF 端叶=冠体积;真要针叶走 rep/scatter) |
| finalize_placeholders 上树皮 | finalizeAssets 压盛行风(林分级决策) |

## 五、本课产物

- `src/scene/conifer-factory.js`(genome 注入 + taper 律 + 风 finalize)
- `asset-collection.js` 补 `spawnAll`(混林 → 按物种 finalize 链路)
- `scripts/test-conifer-factory.mjs`(15 断言)
- 截图 `manual-tests/infinigen-l04/`(一林三树:同物种同色、同风向倾斜、
  taper 锥塔、sinfold 冠面)

## 六、第五课候选

- surface registry(material_assignments 加权材质分配,对齐 Wave A 注册表)
- 针叶/叶实例散布(child_placement → rep/scatter,树的第二形态档)
- deck 产品接点:alpine env 的 tree-pine 换 conifer 混林(等盲测节奏)
