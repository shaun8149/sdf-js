# Infinigen 研读 · 第二课:表面位移(geo_extension + Voronoi DISPLACE)

> 前置:[第一课](lesson-01-asset-factory-boulder.md)(AssetFactory + boulder 骨架)。
> 本课读 Infinigen 的表面细节配方,把 schema 里躺了两个月的 `displace` DOMAIN op
> 第一次真正落地(scene 层 → CPU → GPU 全链),并给 boulder 工厂穿上节理。
> 本课的主要产出其实是一场 **D3D 编译预算的取证**——比配方本身值钱。
> 源码读取 2026-07-13,main 分支,BSD-3。

## 一、Infinigen 的表面配方(源码解剖)

### geo_extension(assets/utils/decorate.py L71-98)

石头"骨"之上的第一层:**方向空间的分形噪声做径向鼓胀**。

```
direction = normalize(pos) + uniform(-1, 1, 3)     # L80-81:方向 + 随机偏移
musgrave  = (MusgraveTexture(direction, scale) + 0.25) * strength   # L82-93
SetPosition(offset = musgrave * pos)               # L94-97:沿径向推
```

- 噪声采样在 `normalize(pos)`(方向球面)而非位置空间 —— 同一方向整条射线同振幅,
  效果是**形体不对称**(某侧鼓、某侧瘪),不是表面颗粒。
- strength/scale 都过 `uniform(a/2, a)` 二次抖动(L74-75)—— 参数本身也是分布。

### 双层 Voronoi DISPLACE(boulder.py L104-117,第一课已读)

节理(大尺度,noise_scale log_uniform 0.2-0.5)+ 麻面(小尺度,0.05-0.1),
strength 都是 0.01 —— **位移振幅相对形体尺寸非常小**,细节靠法线变化读出来。

## 二、SDF 端落地

- **`displace` DOMAIN op 首次实现**(spec.js 自 IQ P3 批就有 schema 项,compile.js
  的 domain switch 里一直没有分支):`{type:'displace', source: 宿主, args:{kind,
  freq, amp, offset}}`。参数校验进 validateDomainArgs。
- **noiseField 位移场**(d3.js + GLSL 双端,hash 同一条 sin-fract 公式):
  `vfbm`(3 octave 值噪声,geo_extension 的近似)/ `ridge`(abs(2v-1) 折痕)/
  `sinfold`(IQ 经典 sin 位移的 ridged 变体,每次求值 3 个 sin)。
- boulder 工厂 v2:物种级 `voroScaleK`(节理尺度)+ `voroAmpK`(振幅 × minHalf,
  保 Lipschitz 冗余),实例级 offset lane(同物种不复读噪声图)。

## 三、D3D 编译预算取证(本课的真发现)

Windows/ANGLE(D3D 后端)上,studio 档完整 shader 的 pipeline 编译是 fxc 做的,
六轮取证结论:

| 实验 | 结果 |
|---|---|
| 27-cell Voronoi F1(三重循环) | 黑屏 2.5min+(fxc 把常量上界循环完全展开) |
| ridge 双 octave(零循环) | 仍黑屏 80s+ |
| ridge 单 octave(8 hash-sin/场) | 仍黑屏 |
| **sinfold(3 sin/场)× 8 石头** | **仍黑屏** —— ALU 理论破产 |
| sinfold × 1 石头 | 秒级渲染 ✓ |
| sinfold × 4 石头 | ~15s 渲染 ✓ |

**结论:fxc 成本的主导项是 displace 包装的 subject 数量,不是位移场的 ALU。**
8 个 displaced subject = 分钟级(什么场都一样),4 个 = 秒级。取证工具链:
① 迷你 raymarcher 注入页面(同一 sceneSDF,128 步循环)link+draw 只要 4.3s 且
画得出石头 → 场健康,studio shader 的十几个 sceneSDF 调用点 × displace 包装是
成本来源;② `studio.js u_loopGuard` 的注释是判例(fxc 展开常量循环)。

**工程规矩(写进工厂注释)**:
1. scene SDF 里的 GLSL **零常量上界循环**(会被内联进 march 再被 fxc 展开);
2. 位移场用 `sinfold` 档做批量;`vfbm`/`ridge` 留给单主体特写;
3. **每 studio 场景 ≤4-6 个 displaced subject**(本 Windows 机实测;Metal 未测);
4. 批量 decor 走第一课的裸 blob 形态,位移是特写预算。

## 四、映射表增补

| Infinigen | Atlas |
|---|---|
| geo_extension(方向空间 Musgrave 径向鼓胀) | noiseField kind='vfbm'(位置空间近似,文档级偏差) |
| 2× VORONOI DISPLACE strength 0.01 | kind='sinfold' 单层,amp = 0.03-0.06 × minHalf |
| 参数二次抖动 uniform(a/2, a) | 物种级 lane + 实例级 offset lane |
| Blender DISPLACE modifier(法线向) | SDF 加性位移(d + field;Lipschitz 由 amp 保) |

## 五、本课产物

- `displace` DOMAIN op(compile.js domain switch + spec.js validateDomainArgs)
- `noiseField` prim(d3.js CPU + sdf3.glsl.js GPU + sdf3.compile.js 发射器,3 kinds)
- boulder factory v2(单层 sinfold 节理;18/18 契约测试)
- 本页的 D3D 编译预算表 —— 未来任何"给 scene 加噪声"的工作先读这段
