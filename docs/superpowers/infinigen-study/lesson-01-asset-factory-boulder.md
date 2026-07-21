# Infinigen 研读 · 第一课:AssetFactory + BoulderFactory

> 系列定位:仿 artblocks-study 的模式 —— 每课真读一段 Infinigen 源码(BSD-3,princeton-vl/infinigen),
> 解剖出可移植的 **recipe**(思路与参数分布,不是代码),再用 sdf-js 现有原语重写一个可跑的产物。
> 第一课读模式的心脏:`AssetFactory` 基类(src/infinigen/core/placement/factory.py,219 行)
> 和它最可读的实例之一 `BoulderFactory`(src/infinigen/assets/objects/rocks/boulder.py,194 行)。
> 读取日期 2026-07-13,main 分支。

## 一、AssetFactory 解剖(factory.py 逐段)

### 1. 两级 seed,机制精确到行

```
__init__:            self.factory_seed = factory_seed        # 物种身份
spawn_placeholder:   with FixedSeed(int_hash((self.factory_seed, i))):   # L75
spawn_asset:         with FixedSeed(int_hash((self.factory_seed, i))):   # L140
```

- **物种级决策**发生在子类 `__init__` 里的 `with FixedSeed(factory_seed)`(BoulderFactory L57-60:
  材质选择 + boulder/slab 形态选择)。同一 factory_seed 的所有实例共享这些决策。
- **实例级随机**不需要子类操心:框架在 `spawn_*` 里用 `int_hash((factory_seed, i))` 包住
  `create_*` 的全部执行,子类内部随手 `uniform()` 就自动是"该实例专属"的。
- 关键工程细节:placeholder 和 asset 用**同一个** instance seed(L75 与 L140 一致)——
  这是"占位体和成品剪影一致"的根,不是巧合。

Atlas 对应物:`makeHashRand` 的 named-lane 结构早已独立收敛到同一形状
(deck-decor 的 deck-wide voice lane + `st${k}-*` per-station lane)。差异:Infinigen 靠
"进 with 块全局接管 np.random",我们靠显式 lane 名 —— 我们的更可 diff、更细粒度,不改。

### 2. 模板方法:spawn_* 是框架,create_* 是创作面

`spawn_placeholder` / `spawn_asset` 明确注释 "Not intended to be overridden"(L71, L111);
子类只写 `create_placeholder` / `create_asset` / 两个 finalize 钩子。框架负责:seed 包裹、
命名(`repr(factory).spawn_asset(i)`)、位置赋值、parent 关系、数据块垃圾回收(L131-141,
每次 spawn 后清 meshes/textures/node_groups/materials —— 长循环不涨内存)。

### 3. placeholder/asset 两阶段 + 距离驱动 LOD

- `create_placeholder` 默认 2m 立方体(L44-46);`asset_parameters(distance, vis_distance)`
  把相机距离折算成 `face_size`(L53-59)交给 `create_asset`。
- `spawn_asset` 两条路:调用者已给 placeholder → 成品 parent 到它;没给 → 自己 spawn 一个、
  把成品挪到它的位置再删掉它(L153-163)。
- `coarse=True` 的工厂只允许铺 placeholder(L118-121)—— 粗排布阶段整个场景先用占位体规划。

Atlas 已经用上了这一课(finale-LOD #347 就是 placeholder 模式);第一课把它下沉到 **atom 级**。

### 4. 批处理钩子与物种混合

- `finalize_placeholders` / `finalize_assets`:跨实例一次性处理(注释举例:树间藤蔓、joint
  space colonization)。BoulderFactory 用它给全部占位体上材质(L121-123)—— 材质是物种级的。
- `make_asset_collection(spawn_fns, n, weights)`(L175-219):多工厂按权重混合生成 n 个资产,
  收进隐藏 collection 复用 —— 供给端的"物种混林"。

## 二、BoulderFactory 解剖:一块石头的完整配方

物种级(`__init__`,FixedSeed(factory_seed) 内):

| 决策 | 分布 | 行 |
|---|---|---|
| 岩石材质 | `weighted_sample(material_assignments.rock)` | L58 |
| 形态 | boulder 0.8 / slab 0.2 | L55-60 |

实例级(`create_placeholder`,自动被 instance seed 包住):

1. **32 个均匀随机点的凸包**做底形(L66-67)—— 石头的"骨"
2. **顶面阶地挤出**(geo_extrusion,L126-169):法线朝上(2π/3 锥)∧ bernoulli ∧ 面积大于均值
   的面,两轮 (prob, extrude, scale) = (0.2-0.3, 0.8, 0.4) 和 (0.6, 0.2, 0.6) 挤出并缩顶 —— 岩石的层理
3. SUBSURF simple ×2(L69-71)
4. **log_uniform 非均匀缩放**:slab xy∈[0.5,2.0] z∈[0.1,0.15];boulder xy∈[0.4,1.2] z∈[0.4,0.8](L75-78)
   —— 乘性量一律 log_uniform,这是全库习语
5. 姿态:x 倾 ±π/24,yaw 自由 [0,2π)(L82-85)
6. 非顶点组 BEVEL 10% + SHARP remesh(octree 3)+ geo_extension 噪声拉伸(L90-102)
7. **两层 Voronoi 位移**:noise_scale log_uniform(0.2,0.5) 与 (0.05,0.1),strength 0.01(L104-117)
   —— 大尺度节理 + 细尺度麻面

`create_asset`(L171-194)**不再造形**:深拷贝 placeholder,按相机距离 remesh 到目标 face_size。
**石头的 placeholder 就是成品的形**,LOD 只换网格密度 —— 剪影永真。

## 三、借 / 不借

**借(本课落地)**
1. **两级 seed 的契约化**:物种 lane `boulder:${seed}`,实例 lane `boulder:${seed}:${i}`;
   placeholder 与 asset 共享实例 lane(剪影一致的根)。
2. **placeholder/asset 双形态作为工厂 API**:`createPlaceholder(i)` 出 analytic 档安全的单
   prim(rounded_box —— 我们的"距离档"不是 face_size 而是渲染档);`createAsset(i)` 出
   raymarch 档的 smoothUnion 椭球 blob。两形态同 footprint 同姿态。
3. **配方本身**:凸包→椭球 blob 近似;log_uniform 缩放;slab/boulder 双形态权重;±π/24 倾 +
   自由 yaw;材质物种级。
4. **物种混合**(make_asset_collection 的形):多个 factory_seed 按权重混林 —— 留给 horizon
   dressing 升级时用,本课 API 预留 `voice` 暴露。

**不借 / 缓借(诚实清单)**
- 顶面阶地挤出、BEVEL/remesh、两层 Voronoi 位移:SDF 端对应"位移习语 + 阶地 intersection",
  `displace` 链算子已存在但 scene 层缺噪声源 prim —— 第二课候选(表面细节交给 stone 档材质)。
- `np.random` 全局接管:不借,显式 lane 更可 diff。
- GarbageCollect/coarse 标志:Blender 运行时税,无对应物。

## 四、映射表(速查)

| Infinigen | Atlas |
|---|---|
| `FixedSeed(factory_seed)` | `makeHashRand('boulder:' + seed)` 物种 lane |
| `FixedSeed(int_hash((seed, i)))` | `makeHashRand('boulder:' + seed + ':' + i)` |
| create_placeholder(2m cube 默认) | analytic 档单 prim 形态(finale-LOD 的 atom 级版) |
| create_asset + face_size LOD | raymarch 档 blob 形态(档位即距离) |
| finalize_placeholders 上材质 | 物种级 material 对象,实例共享 |
| make_asset_collection(weights) | 未来 horizon 混林;`voice` 已暴露 |
| log_uniform | `exp(range(ln a, ln b))` 助手 |

## 五、视觉迭代实录(4 轮,教训比结果值钱)

1. **椭球 blob 一版 = 鹅卵石**:smoothUnion 椭球读作河卵石/煎饼,不是岩石。岩感的来源在
   Infinigen 里是 sharp remesh + Voronoi 位移 —— SDF 端的对应物是**带姿态差的块互切**。
2. **块要大而挤**:中心抖动 ±0.45×half + 块占 0.5-0.95 → 块彼此不重叠,读作碎瓷片。
   凸包直觉:块占 0.7-1.0、抖动 ±0.22,重叠成一体,只有外露部分成为棱面。
3. **slab 是"叠"不是"交叉"**:每块自由 yaw 让石板互相穿插成 X;层理 = 块共享朝向(±0.12)
   + 沿 y 均匀错层。
4. **chamfer/round union 家族不是精确距离场**:sphere-tracing 过冲 → 表面黑斑(studio 档
   真机抓到)。angular 物种改精确 min-union —— 接缝是硬折痕,岩石本该如此;棱面感本来就
   来自块的互切,不靠接缝倒角。

最终读感:angular boulder = 采石场碎岩,angular slab = 叠层石板,weathered = 风化圆石。
第二课候选:Voronoi 位移(displace 链算子已在,缺 scene 层噪声源 prim)+ 顶面阶地。

## 六、本课产物

- `src/scene/boulder-factory.js` —— `makeBoulderFactory(factorySeed)` →
  `{ voice, createPlaceholder(i, opts), createAsset(i, opts) }`,输出 SceneData subject
  (纯数据,复用现有 rounded_box / ellipsoid / smoothUnion,零新 GLSL)。
- `scripts/test-boulder-factory.mjs` —— 确定性 / 物种-实例分离 / 双形态同 footprint /
  analytic 安全 / 编译通过。
