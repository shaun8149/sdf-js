# Infinigen 研读 · 第三课:make_asset_collection(物种混林)→ 天际线

> 前置:[第一课](lesson-01-asset-factory-boulder.md)(AssetFactory)、
> [第二课](lesson-02-surface-displacement.md)(表面位移 + D3D 预算)。
> 本课读供给端的复用单元 `make_asset_collection`(factory.py L175-219,第一课
> 已下载的同一文件),把它接到产品上:deck 天际线的 **boulder 混林**(OPT-IN)。

## 一、make_asset_collection 解剖(factory.py L175-219)

```
weights /= sum(weights)                       # L189:归一
for i in range(n):
    fn_idx = np.random.choice(..., p=weights) # L200:逐实例加权抽种
    obj = spawn_fns[fn_idx](i=i, **kwargs)    # L201:选中的工厂生成第 i 个
for os, f in zip(objs, spawn_fns):
    f.finalize_assets(os)                     # L207-209:按物种批处理
col = butil.group_in_collection(objs, ...)    # L216:收进隐藏 collection 复用
```

要点:**混林不是一个工厂生成多样,而是多个物种工厂按权重逐实例抽签** ——
每个物种保持自己的 voice(第一课),多样性来自物种间,统一性来自物种内。
这正是 Infinigen 森林/岩场"像一个生态"的机制。

## 二、Atlas 移植

- `src/scene/asset-collection.js`:`makeAssetCollection(factories, {weights,
  seed, form})` → `{pick(i), spawn(i, opts)}`。np.random.choice 换成确定性
  lane(`collection:${seed}:pick${i}`)—— mint-hash covenant,同 seed 同林。
  `form` 选 placeholder(analytic 安全)/asset(raymarch),沿用第一课的
  "形态即档位"。
- **不借**:Blender collection 容器(我们的 collection 是路由标签,Wave A)、
  `centered` 重定位、`finalize_assets` 钩子(v1 无消费者,等树藤类需要再补)。

## 三、接到产品:boulder 混林天际线(OPT-IN)

`environments.js boulderHorizon(center, ringRadius, seed)`:3 个 boulder 物种
按 0.6/0.25/0.15 混合,**环位数学与 slabs 逐字相同**(index math 零随机)——
14 个位置、同 collection 'horizon'、同 nearest-cull 预算语义,leaf 成本相同
(placeholder = 单 rounded_box/个)。剪影纪律:材质压到 value 0.14(黑石
motif 不让位,天际线是背景)。

**默认不变**:`assembleDeck opts.horizon='boulders'` / 浏览器 `?horizon=boulders`
才启用;golden 四层零 diff(套件双保险)。要不要换默认,等盲测。

读感对比:slabs = 14 块同款石碑;混林 = 立柱、平顶 mesa、圆丘混排 —— 生态感
来自"物种内统一、物种间多样"。截图 `manual-tests/infinigen-l03/`。

## 四、系列至此的复利结构

```
L01 AssetFactory(两级 seed + 双形态)
  └─ L02 displace + noiseField(表面细节;D3D 预算规矩)
  └─ L03 make_asset_collection(物种混林)
        └─ boulderHorizon = 三课的乘积,第一个产品接点
```

第一课的 placeholder 契约在第三课兑现:天际线用 placeholder 形态,analytic
档(产品默认)零成本吃下混林;asset 形态(位移岩石)受 L02 预算约束,留给
特写。**工厂多一个物种,所有混林消费者免费变富** —— 这就是 Infinigen 供给端
复用的形状,也是 3-Stage 供给端复用 framework 的 Stage 0 机制。

## 五、本课产物

- `src/scene/asset-collection.js`(混林单元)+ `environments.js boulderHorizon`
- `assembleDeck opts.horizon` + `figure.html ?horizon=boulders`
- `scripts/test-asset-collection.mjs`(12 断言:确定性/权重分布/analytic 安全/
  预算语义/默认零改动)

## 六、第四课候选

- surface registry(material_assignments 的加权材质分配 → 物种材质从"工厂内
  写死"升级为"注册表加权抽取",对齐 Wave A 材质注册表)
- 树/仙人掌类 factory(带 finalize_assets 的首个消费者)
- 顶面阶地挤出(boulder.py geo_extrusion,L01 欠账)
