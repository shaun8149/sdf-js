# Spec: Blender 借法 — modifier stack / collections / 材质引用

> 来源:user 提议以 Blender 为 3D 端参考系(2026-07-13)→ text-to-Blender 生态调研
> (20 项目,star 实抓;结论存 memory `project_blender_reference_intel`)→ user 拍板
> "借法 spec 优先"。本 spec 定义 SceneData 契约的三个 Blender 式扩展与分波实施。
>
> 调研的三条前提结论(为什么借这三个、不借别的):
> ① 自由 bpy 代码路线被市场证伪(BlenderGPT 品类全灭、GPT-4o 裸写 bpy 仅 0.565 分),
>   赢家表示 = 声明式场景图 + 关系约束 —— Atlas 架构拿到反向背书,借法只在数据模型层;
> ② constraints/drivers/NLA 在全部调研项目中无一被 LLM 侧成功使用 —— **不借**;
> ③ Infinigen 2.0 正把巨型工厂类重写成"可组合可随机化函数块" —— 我们的链式 API
>   已在终点,借的是它的**组织概念**(两级 seed/LOD/供给流水线),不是实现。

## 0. 量化的问题(字节 radial deck 实测)

- 319 个 subjects 中:84 个面包屑 = 12 条阵列;14 块地平线 = 1 个环形阵列;
  6 块 guard = 3 对镜像;stelae/inlay/stardust 全是手工展开的散布。
- 36 种材质被内联约 300 次(无 datablock 复用)。
- collections 只存在于 id 前缀字符串契约(`/^s(\d+)-/`、`/^path-/`、`massing-`),
  sliceDeckWindow 靠正则解析,23 个文件挂在命名约定上(对抗讨论点名的脆性)。
- shader leaf 数对编译/运行成本超线性(#286 实测)——重复几何逐叶展开是病根之一。

## 1. Modifier stack(`subject.modifiers`)

### 1.1 契约

```jsonc
{
  "id": "runway",
  "type": "box",
  "args": { "dims": [1.7, 0.05, 0.32] },
  "modifiers": [
    { "type": "array",  "count": 7, "offset": [2.3, 0, 0] },
    { "type": "mirror", "axis": "x" }
  ],
  "transform": { "translate": [0, 0.03, 0] },
  "material": "runway-strip"
}
```

- `modifiers` 可选数组,**按序应用**,作用于 subject **局部空间**(先 modifiers,
  后 transform —— 与 Blender 语义一致)。
- v1 四个修饰符(Blender 对应物:Array / Array-circle / Mirror / Scatter):

| type | 参数 | 语义 |
|---|---|---|
| `array` | `count ≥ 2`, `offset: [x,y,z]` | 线性阵列(面包屑、跑道、栅栏) |
| `radial` | `count ≥ 2`, `radius`, `center?: [x,z]=[0,0]`, `startAngle?=0` | 环形阵列(地平线石板、stelae 环、柱环) |
| `mirror` | `axis: 'x'\|'z'` | 镜像对(guard 石、对称布景) |
| `scatter` | `count`, `region: {kind:'annulus'\|'box', ...}`, `seed` | 确定性散布(星尘、碎石场;= Generator-S 的声明式化) |

- **不做**(调研否决):constraints、drivers(动画 expr 文法已覆盖)、
  along-path(v1 用 array 逐段近似;曲线路径等真实需求出现再议)、
  嵌套 modifier 作用于 union children(v1 只作用于 subject 整体)。

### 1.2 两类实现语义(诚实分界)

- **expansion(v1 全部四个)**:编译期展开为 N 个内部叶子——纯语义层收益
  (JSON 变小、LLM 面变干净、id 契约消失),**leaf 数不变、性能不变**。
- **domain-rep(v2,仅 array/radial/mirror)**:GLSL 域重复(opRepLim / 角度折叠 /
  abs 折叠),N 实例 = **1 个 leaf** —— 这才是 leaf 超线性的修法。
- 分界写进契约注释:`scatter` 永远是 expansion(不规则摆放无法域重复);
  array/radial/mirror 的 lowering 由渲染档决定(见 1.4)。

### 1.3 展开语义细则

- 实例 id:`{subject.id}#0..N-1`(内部命名,**不进入任何窗口切片契约**——
  切片按 collection 走,见 §2)。
- `animation` exprs 作用于**整个修饰后 subject**(所有实例同步动;per-instance
  相位差 v1 不做——现有 decor 的逐实例 jitter 继续用 scatter 的 seed 通道)。
- scatter 的确定性:复用 `makeHashRand` 命名 lane(`{subject.id}:{i}`),
  同 seed 永远同布局(mint-hash 契约语义)。
- 与 sanity checker:展开后的叶子计入 subject-count/leaf 预算检查(不许借
  modifiers 绕过预算告警)。

### 1.4 渲染档交互(关键工程事实)

analytic(产品默认)是**整帧模式**:任何不支持的形状导致整帧回退 stone。因此:

- **v1(expansion)对 analytic 零影响**——展开后就是普通叶子,SUPPORTED 照旧。
- **v2(domain-rep)只在 stone/rich 生效**;analytic 路径继续消费展开形态
  (compile 按 renderMode 选 lowering)。
- **v3(可选,远期)**:analytic 的解析重复求交(对 box/sphere 阵列解析求 k 近邻
  实例)——单独立项,不阻塞 v1/v2。

## 2. Collections(一等公民分组)

### 2.1 契约

```jsonc
{
  "collections": {
    "station-3":  { "kind": "station", "station": 3 },
    "path-2":     { "kind": "transit-path", "from": 2 },
    "massing":    { "kind": "dressing", "cull": "never" },
    "horizon":    { "kind": "dressing", "cull": "nearest", "budget": { "hero": 7, "content": 3 } },
    "decor-st3":  { "kind": "decor", "station": 3 }
  },
  "subjects": [ { "id": "mono-1", "collection": "station-3", ... } ]
}
```

- `subject.collection` 可选字符串;`scene.collections` 注册表携带**切片语义**
  (kind / 归属站 / 裁剪策略 / 预算)——今天散落在 sliceDeckWindow 正则与常量里
  的规则,全部变成数据。
- sliceDeckWindow 改为按 collection 元数据过滤;**id 从此只是身份,不再承载
  路由语义**。`/^s(\d+)-/` 等正则在迁移期保留为 fallback,消费者切完即删。
- 嵌套 v1 不做(Blender 支持,我们的场景两层足够:deck → collection → subject)。

### 2.2 迁移纪律

- 纯增量:先加字段与注册表(assembleDeck 双写:collection + 旧 id 前缀),
  golden 重烤一次;消费者(deck-shader-windows / beats / figure-core hideAt /
  test 魔数)逐个切到 collection;全部切完后删正则 fallback。
- 23 文件消费面清单(对抗讨论产出)作为迁移 checklist 附在 plan。

## 3. 材质引用(datablock 复用)

```jsonc
{
  "materials": { "mono-gold": { "hue": 0.11, "sat": 0.78, ... } },
  "subjects": [ { "id": "mono-5", "material": "mono-gold" } ]
}
```

- `subject.material` 接受 **string(引用)或 object(内联)**,两者长期共存
  (内联是 LLM 单发场景的正确形态;引用是 deck 装配的正确形态)。
- 解析在 `resolveMaterial`(spec.js)一处完成;悬空引用 = validator ERROR
  (材质是视觉身份,静默回退会产生"看起来对了"的错)。
- 收益:字节 deck 36 种材质 ×300 次内联 → 36 条注册 + 300 个字符串;
  统一改色(章节 accent、decor voice)从"改 300 处"变"改注册表"。

## 4. 验证与守卫

- spec.js:modifiers/collections/materials 三个 schema 的完整校验
  (validator/evaluator 同步律照旧);未知 modifier type = ERROR(fail loud)。
- 新增 `expandModifiers()` 进 runtime 管线:
  `expandVariants → expandStage → expandModifiers → expandChartLabels → compile`。
- goldens:每波语义变更各重烤一次并在 PR 说明;fidelity 双审计不受影响
  (overlay 不变)。
- 预算断言:test 层验证"展开后 leaf 数 = 手工展开时代的数"(byte-level 等价的
  modifier 版:**语义等价快照**——展开产物与旧手工 subjects 逐字段一致)。

## 5. 分波

| 波 | 内容 | 收益 | 风险 |
|---|---|---|---|
| **A** | 材质引用 + collections(含 sliceDeckWindow 切换、双写迁移) | 契约卫生;id 正则契约退役 | 低(纯增量+golden) |
| **B** | modifiers v1(expansion)+ assembleDeck/decor/renderers 改用声明式 | subjects 319→约 80;LLM/作者面简化;Generator-S Phase 2 落地 | 中(语义等价快照守卫) |
| **C** | domain-rep lowering(stone/rich) | leaf 数 ↓(面包屑 84→12、石板 14→1)——超线性病根 | 中高(GLSL;Lipschitz/阴影验证) |
| **D**(远期) | analytic 解析重复求交 | 产品默认档吃到 perf | 高,单独立项 |

## 6. 非目标

- 不做 constraints / drivers / NLA / shader graph / 嵌套 collections(调研否决);
- 不做 bpy 式命令 API、不内嵌任何外部运行时(轻运行时是我们的差异化税盾);
- 不改 IR / atlas-deck 契约(本 spec 全部在 SceneData 层,2D 端零感知)。
