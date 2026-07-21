# 3D 端「舞台/氛围」idiom 清单 — ArtBlocks shader-core 移交的沉淀 (2026-07-10)

> 来源:2D 端 ArtBlocks 学习(50/108 课)判给 3D 端的 8+ 课 shader-core 移交
> (L05/08/11/12/14/15/16/18/20/30/35/40)。本清单按**格斗游戏舞台**框架归类
> (背景 recede / 舞台打光 / 前景质感 / post 底座),并对照 studio 现有能力标注接入档位。
> 全部 recipe-only(CC BY-NC 系)——**只重实现通用技术,不 port NC 代码**。
>
> 档位:✅ 直接接(studio 已有对接点,配置/调参即用)· 🔩 小改(有基础,补一块)· 🏗 新建 · 📚 仅参考

## studio 现有对接点(核实于 2026-07-10 main)

| 能力 | 入口 | 备注 |
|---|---|---|
| 暗色环幕 + spec/rim/vignette | `defaults.studioBg='dark'` | stage.js **已默认 dark**(showcase 模式) |
| 剧场压暗(天光 0-1) | `defaults.interiorDark` | 让聚光灯凸显 |
| 舞台灯 rig(区域灯+聚光锥) | `defaults.lights[]`(带 `dir` 成聚光) | MAX_EXTRA_LIGHTS 个 |
| DOF(背景虚化) | `shots[].aperture / focalDistance` | cameraSequence 每 shot 可调 |
| 体积氛围 | volumes kind 0-3(smoke/flame/fog/godray) | u_time 驱动,`setVolumes` |
| 程序化环境 | `environments.js getEnvironment('alpine')` + `horizonSilhouettes` | 注册表已建,studio/alpine 两档 |
| 一次性 build-in 动画 | expr builtins(#193 smoothstep/clamp/step/…) | `transform.translate` 通道 |
| 连续世界 deck | `assembleDeck`(line/radial/grid stations) | 舞台间穿行 |

## A. 背景 recede(炫但退后)

1. **texture-flow — 噪声位移采样坐标**(Torrent L14)🔩
   `uv' = uv + fbm(uv)·flow + t·scroll` —— 位移**采样**而非几何,一行出「流动感」,
   便宜一个数量级。studio 已有 sea(sdWaves 位移几何面)是重版近亲;给环幕/背景面
   加一个采样位移材质即可。**接入点**:cyclorama 着色分支(studioBgDark 路径)或
   environments.js 新 env 的背景面材质。
   附:tile 化(`u_tileoffset/divisor` 单 shader 多窗格)、恒等 hash 颗粒防 banding。

2. **地层色带**(Apparitions L05,与我们 Subscapes/alpine 美学跨端呼应)✅
   band 内 lerp、band 间跳变 = 层理感颜色本体。alpine env 已有同族;做新背景 env 时
   直接用此配色法。

3. **DOF + 压暗 + 降对比 = 背景退后三件套** ✅
   全部现成:`aperture`(shot 级)+ `interiorDark` + dark cyclorama。**舞台 v0 的
   背景纪律就是这三个参数**,不需要新代码。

## B. 舞台打光 / 辉光

4. **光 = 到几何的距离衰减**(Box Light Studies L08)🔩(对 raymarcher 几乎免费)
   L08 在光栅世界要 jump-flood 近似距离场;**我们是 raymarcher,SDF 的 d 就在手上**。
   march 循环里累积 `glow += exp(-k·d)·stepLen` 即得几何辉光(棱线/轮廓自发光感)。
   **接入点**:studio.js march 主循环(volumes 累积同位置旁),一个 uniform 开关。
   附思想:「棱线即光源」—— 构图单位是棱不是面;辉光是**场算出来的**不是画的。

5. **聚光舞台**(studio 现成)✅
   `interiorDark: 0.18` + `lights: [{pos, dir, color, intensity}]` 聚光锥打主体
   = 剧场感。纯配置。

6. **软影拼接**(Väzt L15)📚
   每遮挡体贡献 `smoothstep(-k,0,-d)·step(-d,0)` 累加 —— O(N) 内联无循环。
   对照我们现有 shadow 实现的参考;架构背书(元编程 shader 三例之一)。

## C. 前景质感(舞台上的「角色」)

7. **有机软体调音**(Gumbo L11)✅(纯调参 recipe)
   「有机软体感 = 圆角半径 + smin 系数的调音」。rc 圆角盒 / 轴对齐旋转 / 角度量化
   棱柱 / soft-min 堆融 —— 我们的 IQ 图元库全都有,这课给的是**调参配方**:
   前景结构件(funnel 段、node 球)加大圆角 + smin 融合 → 高级软体质感。

8. **一行 trait 轴**(Edifice L35)✅
   L2 范数换 L∞ = 圆变方 —— SDF 域上一行代码的风格轴。结构渲染器的 style 变体
   (圆润/硬朗)可以这么给。

9. **构图目录**(Skulptuur L40)📚
   12 组行列比例抽两组做构图 —— 「构图先于形体,比例目录即风格」。舞台构图
   preset(主体位/镜头框)可借此法做成目录而非自由参数。

## D. post 底座(远期,新建)

10. **单三角覆屏**(Solar Transits L18)🏗(post pass 入门件)
    3 顶点 (-1,-1)(3,-1)(-1,3) 盖满 clip space,比 quad 少一条对角线插值缝 ——
    未来加全屏 post pass(bloom/曝光)的标准姿势。
11. **多 pass 曝光累积**(L18)🏗 —— 帧间亮度累积 = 长曝光感;cameraSequence
    「轨迹可视化」直接可用的 recipe。
12. **UV warp 字典**(Trichromatic L12)🏗 —— waveWarpX/Y、uvSpiralize、
    paletteSwapWarp,挂在未来 post pass 上的 fragment 后处理词表。
13. **反馈 warp**(Raster L20)🏗 —— self-sampling + offset;远期。
14. **blur-then-blend + pass 命名纪律**(Phase L30)📚 —— 模糊是混合**前置件**
    不是后处理;multi-pass 起名 pl0/pl1 顺序化(重构会强迫改名)。

## E. 架构背书(非技术,记录在案)

- **元编程 shader 三例**(Väzt L15 / Skulptuur L40 / Gumbo L11 近似):顶级 Curated
  作者的惯用架构 = 「生成器不画像素,生成 shader」= 我们 `sdf3.compile.js` 的架构。
  thesis 的社区共识背书。
- **Proscenium L16**(名字即「舞台拱」):CPU-3D + painter 排序策略字典;我们
  raymarch 不需要,仅参考。

## 轻量舞台 v0 的结论

**✅+🔩 两档就够拼出 fighting-game stage v0**:
dark cyclorama + interiorDark + 聚光 rig + DOF(全现成、纯配置)
+ SDF glow(🔩 march 循环一段)+ texture-flow 背景(🔩 环幕材质一段)
+ 前景 smin/圆角调音(✅ 调参)。
post 底座(D 组)是舞台 v1+ 的事,不阻塞。
