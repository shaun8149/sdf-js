# Infinigen 研读 · 第八课:磨损轴(mesh 要侦探,SDF 转旋钮)

> 前置:L01-L07。本课读最后一个未读的小系统:wear_tear。源码:
> `assets/materials/wear_tear/edge_wear.py`(398 行)+ `scratches.py`
> (246 行)+ `material_assignments.py` 的 wear_tear_prob。
> 读取 2026-07-14,main,BSD-3。

## 一、源码解剖

### edge_wear:Bevel 节点 vs 真法线 = 凸边探测器(L105-151)

```
bevel  = ShaderNodeBevel(radius)          # 假装磨过圆角后的法线
edge   = dot(bevel_normal, true_normal)   # 差得越多 = 越接近凸边
mask   → 磨白(edge_base_color hue/whiteness)+ 划痕
```

关键认识:**mesh 不知道自己的曲率**。要"磨边",Blender 得先在 shader 里
用 Bevel-vs-法线把边**侦探**出来,再用掩膜染色。整个 edge_wear 的复杂度
都花在探测上。

### scratches:层叠噪声掩膜调 color/roughness;wear_tear_prob = [0.5, 0.5]

磨损是**概率叠加层**(约半数实例带),`apply_over` 包在原 BSDF 外面 ——
不改材质本体,是年龄套在材质上。参数全是分布(get_edge_wear_params)。

## 二、借/不借的核心论点(本课的一句话)

**SDF 端曲率是一等参数。** rounded_box 的 cornerR、smoothUnion 的 k,
本来就是"边有多圆"—— 所以几何磨损不需要探测器,**老化 = 转旋钮**:

```
age → cornerR += age × 0.2 × minDim     (angular 岩块磨圆)
age → fuseK   += age × 0.15             (weathered 融合软化)
```

风化的物理模型本来就是"曲率半径增长";SDF 把这个量暴露成参数,Infinigen
在 mesh 上必须逆向重建它。这条对比进 vs-mesh/vs-diffusion 论据库。

## 三、Atlas 移植

- `src/scene/weathering.js`:`weatherMaterial(mat, age)` —— 材质年龄轴
  (edge_wear 磨白 + scratches 糙化的蒸馏,全局而非掩膜级):漂白(sat/value
  衰减)、粗糙化、色相向尘土带微漂;age=0 恒等,纯函数。`WEAR_PROB = 0.5`。
- boulder 工厂:物种级 age lane(约半数物种带磨损,age∈[0.25,1]),同时驱动
  几何(cornerR/fuseK 旋钮)与材质(weatherMaterial 包在 L05 槽抽取外面 ——
  apply_over 的对应物:年龄套在材质上,不改材质本体)。age 进 voice,
  是物种身份的一部分(同 seed 同石头同年龄)。
- **不借(诚实清单)**:划痕/磨白的噪声掩膜级实现(shader 表面工作;SDF 端
  对应物是 L02 位移场,受 D3D 预算约束,不值得为划痕花)。

## 四、验证与诚实注记

- 12 断言:恒等/单调/纯函数/概率分布(37/80)/cornerR 旋钮(0.21 vs
  0.11,余量吃掉块级 base 抖动)/确定性。
- 视觉对比(`manual-tests/infinigen-l08/`):新石深色硬棱 vs 老石漂白。
  **诚实注记**:demo 尺度下几何磨圆读感偏弱,主读感是材质漂白 —— 与
  Infinigen 一致(edge_wear 本来也主要是颜色掩膜,几何从未真的动)。
  我们的几何面反而是超出原方的部分(mesh 动不了几何,SDF 动得起)。

## 五、系列小结(八课收官)

```
资产层   L01 工厂(两级 seed/双形态) ─ L02 位移(+D3D 预算)
         L04 genome(形状学=数据)   ─ L05 材质槽(材质学=数据)
         L08 磨损轴(年龄=数据;曲率是参数不是侦探对象)
组装层   L03 混林(谁和谁)─ L06 密度放置(xz)─ L07 地形锚定(y+门)
```

Infinigen 的供给端语法至此读完并全部移植:**造什么、什么材质、多老、
谁和谁、在哪、多密、多大、落在哪** —— 全确定性、全数据驱动、全部有
契约测试。跨课工程财富:D3D 编译预算三判例(循环展开/displaced 数量/
mat2 列主序)、1×1 shader 探针、displace 不透明 leaf 材质规矩、
非精确 union 黑斑、双地面坑两判例。

## 六、下一步(不再是"下一课")

系统性研读完成。往后是**产品接点批次**(需要盲测节奏配合):
- alpine env 用 L03-L07 全链重铺(混林+密度+锚定)
- horizon 混林盲测(L03 的 opt-in 转正与否)
- 自然 deck 原型("数据在山谷里":terrain + 全链 dressing + deck 站台)
