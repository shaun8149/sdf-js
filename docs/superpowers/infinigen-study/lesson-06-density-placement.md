# Infinigen 研读 · 第六课:密度放置(把资产铺进世界)

> 前置:L01-L05(工厂/位移/混林/genome/材质槽)。资产两族齐了,本课读
> **world-assembly 层**:资产怎么被铺进世界。源码:
> `core/placement/density.py`(119 行,placement_mask)+
> `core/placement/placement.py`(337 行,placeholder_locs / scatter_placeholders /
> populate_*)。读取 2026-07-14,main,BSD-3。

## 一、源码解剖

### placement_mask:密度掩膜 = 一串独立门的乘积(density.py L55-119)

```
mask = 1
mask *= noise(scale) > normal(select_thresh, 0.025)   # 噪声门(L69-80)
mask *= facing_mask(normal_dir, thresh)               # 坡度门(L82-89)
mask *= tag_mask(tag)                                 # 语义 tag 门(L91-92)
mask *= (start < z < end)                             # 海拔门(L93-108)
# return_scalar: MapRange(noise, thresh → 0.75, SMOOTHSTEP)  (L109-115)
```

三个要点:
1. **聚簇是场的性质,不是逐点骰子** —— 资产出现在"噪声场超阈值"的地方。
   均匀撒点撒不出自然:自然界的石头是成片的,片之间是空的。
2. **阈值本身带 ±0.025 抖动** —— 同配置的两片场地,簇的疏密不同。
3. **return_scalar 不止是掩膜,是梯度**:阈值处 0 → 0.75 处饱和(SMOOTHSTEP),
   下游拿去调实例尺度 —— **簇心的石头大,簇缘的石头小**。密度场同时决定
   "有没有"和"多大",一个场两笔账。

### placeholder_locs + scatter_placeholders(placement.py L35-128)

- 泊松分布(`DistributePointsOnFaces POISSON` + `Distance Min`)× 掩膜选点
  —— 自然间隔,不重叠;
- 逐点均匀 yaw(L123),spawn placeholder,**按工厂 finalize**(L127,
  L04 钩子的又一个消费端);
- populate_* 两阶段:先铺 placeholder(粗场景),后按相机距离筛选
  populate 成品 —— 又是 placeholder 模式(finale-LOD / L01 的世界级版本)。

## 二、Atlas 移植:density-scatter.js

`densityScatter({region, count, seed, mask:{noiseScale, threshold}, minDist})`
→ `[{at, yaw, density}]`,全确定性(mint-hash covenant):

- 噪声门:2D 值噪声(与 GLSL nfValue 同一条 sin-fract hash)超阈值才收;
- 阈值场地级抖动(±0.025 语义保留);
- Poisson 最小间距:贪心掷镖(确定性顺序);
- `density` 标量 = smoothstep(threshold → 0.75)(MapRange 对应物),调用方
  拿去调 scale:簇心大簇缘小;
- **预算是上限不是承诺**:门 + 间距丢掉的点不硬凑(placement.py 的
  warning 语义;测试钉死 8/100 这种结果合法)。

**不借(诚实清单)**:坡度/法线门与语义 tag 门(地面还是平面,等 terrain
锚定的 deck);相机邻域放置 points_near_camera(deck 端已有窗口切片管
"相机看什么");populate 两阶段的运行时版(我们的档位系统已是它)。

## 三、验证

- 聚簇有统计学证据:同预算下,聚簇场的平均最近邻距离 2.43 << 均匀场 3.32
  (测试断言 < 0.85×);
- 俯视对照截图(`manual-tests/infinigen-l06/`):左场两团簇 + 簇间留空 +
  尺寸梯度,右场均匀同尺寸 —— 一眼可读;
- 贯通:spots → L03 混林 `spawn(i, {at, scale: 0.5 + density*0.8})` → 场景
  validate 通过。

## 四、系列结构(六课全景)

```
资产层  L01 AssetFactory ─ L02 位移 ─ L04 genome ─ L05 材质槽
组装层  L03 混林(谁和谁) ─ L06 密度放置(在哪、多密、多大)
```

供给端语法至此闭环:**造什么**(工厂+genome+材质槽)、**怎么配**(混林+权重)、
**铺在哪**(密度场+间距)。全部确定性、全部数据驱动。

## 五、第七课候选

- terrain 锚定(资产坐上起伏地形:坡度门/海拔门解锁的前提)
- wear_tear 概率叠加层(材质年龄轴)
- 产品接点批次:alpine 混林 / horizon 盲测 / 自然 deck 原型(等盲测节奏)
