# 第十课: while true — Lars Wander (后期队列)

- **ArtBlocks #498** (+ #501 fabric 变体) · 原生 WebGL · 23.7KB · **CC BY-NC-SA 4.0 → recipe-only**
- 视觉: 六边形格上的图案织物 — 感知均匀的色彩渐变, 编程循环的视觉隐喻

## 分流判定: 2D-core, WebGL 只是光栅器

原生 WebGL 但 shader 极薄: vertex 只做实例化摆放 (cubic→cartesian 六边形
坐标数学, RT3=√3), fragment 只做 **OKLab→sRGB 色彩空间转换**。图案、
铺陈、色彩序列全在 CPU JS — 归档: 2D-core (GPU 仅加速光栅)。

## 结构

```
cubic_to_cat     六边形格坐标数学: 立方坐标 (q,r) → 笛卡尔
                 x' = √3·(x + y/2), y' = 1.5·y — hex 铺陈的规范式
OKLab shader ★   顶点色在 OKLab 空间, fragment 转 sRGB —
                 感知均匀渐变: RGB lerp 的"浑浊中间调"在 OKLab 中消失
class G ★        random tape: 预抽 I 个 float 的"磁带", 每次决策显式
                 传游标 float(t,min,max) → [下一游标, 值] —
                 引用透明的随机: 同游标同值, 插入新决策不扰动旧游标
图案系统          hex 格上的 while-loop 织物图案 (程序循环的视觉本体)
```

## 确定性纪律的第三种形态 (集齐)

| 方案 | 出处 | 稳定性机制 |
|---|---|---|
| 决策位切片 | Rizzolli/Penne (L1/L5) | 固定槽位 |
| 命名 lane | 我们 (fxhash 改) | 标签派生独立流 |
| **random tape + 显式游标** | Wander (L10) | 游标显式传递, 引用透明 |

三者同构于一个原则: **随机消费必须可寻址** — 地址是槽位、标签还是游标
只是风格差异。

## 三个可提取 idiom

1. **OKLab 色彩空间** (立即可用): RGB lerp 中间调发灰发浑, OKLab lerp
   感知均匀 — decor 新家族即刻采用 (`lerpColorOklab`);
   已冻结家族 (wash-flow 的 RGB lerp) 按冻结纪律不动。
2. **六边形格数学**: 立方坐标规范式 — hex 铺陈家族的骨架。
3. **random tape**: 记入确定性纪律对照表 (上表)。

## Port 判定

- **recipe-only** (NC+SA): `hex-lattice` 家族 = idiom 1+2 — 六边形铺陈 +
  OKLab 渐变染色 + 种子化稀疏填充。pitch/consulting 亲和 (科技织物感)。

## 一句话学到的

色彩的"高级感"一半是色彩空间的选择 — 同样两个端点色, RGB 直线穿过
浑浊地带, OKLab 直线沿着感知等距走; 好渐变不是选好颜色, 是选好空间。
