# Infinigen 研读 · 第七课:地形锚定(资产的 y 不是作者给的)

> 前置:L01-L06。L06 的诚实清单欠了两个门(坡度/海拔)—— 它们的前提是
> "知道表面在哪"。本课交付。源码:`core/placement/placement.py` L87
> (ray_cast 向下落点)+ `core/nodes/node_utils.py facing_mask` +
> `core/placement/density.py altitude_range`。读取 2026-07-14,main,BSD-3。

## 一、源码解剖:三行核心

```
pos, *_ = scene_bvh.ray_cast(pos, Vector((0, 0, -1)))   # placement.py L87
up_mask = dot(normal, dir) > thresh                     # node_utils facing_mask
mask *= (start < z < end)                               # density.py altitude gate
```

思想一句话:**资产的 y 坐标不是作者写的,是世界表面决定的**。作者只给 xz
(L06 的密度场),y 由"向下投射打到哪"回答;坡度门和海拔门只是对表面回答
的两个谓词。Blender 里表面回答靠 BVH raycast;SDF 端我们有更好的东西 ——
高度场本身就是函数。

## 二、Atlas 移植:terrain-anchor.js

### CPU 高度场镜像(这张曲面的第一个真 CPU 求值)

`terrain-elevated` 的 CPU f() 是正弦桩(注释原话 "GPU-only primitive")。
`makeTerrainHeightFn(subject)` 逐字镜像 sdf3.glsl.js 的
`atlasTerrainElevated`(9 octave,与 sdTerrainElevated L902 一致):同
hash21(Hoskins)、同 cubic 插值、同导数衰减 fbm、同 ridge pow、同 mountain
mask、同 lowland 挖洞;读 subject 的 args + transform(与 compile.js 同一套
默认值)。cliffInject/canopyBumps 不镜像(默认 0;非零 warn)。

### anchorSpots:落点 + 两个门

`anchorSpots(spots, heightFn, {normalRange, altitudeRange, sink})`:
y = 表面 − sink("planted, not parked",与 horizon slab 同约定);法线走
有限差分(placement 只要 facing 判定);normalRange = facing_mask 与
normal_thresh_high 的合体;门丢掉的点直接消失(L06 语义:预算是上限)。

## 三、取证实录(两个跨课教训)

1. **GLSL `mat2` 是列主序** —— `mat2(1.6,-1.2,1.2,1.6) * p` 展开是
   `[1.6x + 1.2y, -1.2x + 1.6y]`,第一版写成行主序转置,高 octave 全错,
   树悬空 1-2 单位。**取证工具:1×1 shader 探针** —— 往页面注入一个只调
   库函数的 fragment,把 GPU 的 h 编码进 RGBA 读回来,与 CPU 同点对比。
   修复后四点全对(误差 ≤0.02 = 16bit 编码噪声)。探针从此是 CPU/GPU
   镜像工作的标准验法(比瞪代码快一个量级)。
2. **陡峭地形上"视觉验证"会说谎**:高山 demo 里前景山脊遮挡树脚,连续
   三帧读作"悬浮",其实数值早已对上。判读接触点要用缓丘 + 地形感知的
   相机(机位自己的 y 也要过 heightFn,否则埋进山脊拍出全黑)。

另:playground 的 studio 渲染器有内建 y=−1 地板(GROUND_Y)—— 地形 demo
必须把谷底抬到 −0.9 以上,否则棋盘格盖住真山面(双地面坑的又一判例)。

## 四、七课全景

```
资产层   L01 工厂 ─ L02 位移 ─ L04 genome ─ L05 材质槽
组装层   L03 混林 ─ L06 密度放置(xz)─ L07 地形锚定(y + 坡度/海拔门)
```

全链演示(测试里就是这条):`densityScatter`(哪里)→ `anchorSpots`(落地
+ 过滤)→ `makeConiferFactory`(造什么)→ `finalizeAssets`(林分风)→
场景 validate。**一片有地形的森林,作者只写了 seed 和几个分布。**

## 五、本课产物

- `src/scene/terrain-anchor.js`(makeTerrainHeightFn / anchorSpots / surveyTerrain)
- `scripts/test-terrain-anchor.mjs`(11 断言:纯函数/起伏/transform/贴面/
  双门/全链)
- 截图 `manual-tests/infinigen-l07/`(接触点特写 + mat2 转置悬空的 before)

## 六、第八课候选

- wear_tear 概率叠加层(材质年龄轴,最后一个未读的小系统)
- 产品接点批次:alpine env 用 L03-L07 全链重铺(混林+密度+锚定)+ horizon
  盲测(等节奏)
- 自然 deck 原型("数据在山谷里"——terrain + 全链 dressing + deck 站台)
