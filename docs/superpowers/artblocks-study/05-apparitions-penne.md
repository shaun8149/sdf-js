# 第五课: Apparitions — Aaron Penne

- **ArtBlocks #28** · p5 · 4.7KB · **CC BY-NC 4.0 → recipe-only**
- 视觉: 噪声位移的平行曲线束 — 云带 / 地层 / 织物, 全语料性价比最高的脚本

## 结构 (4.7KB 里的完整系统)

```
hti(hash)        hash → 32 个 0-255 字节 (Rizzolli 同宗, 但保留全字节精度)
mv(i, min, max)  ★ 决策位直接线性映射参数区间 — hash→参数的最干净形态
色板三元链        mv(1) 落进 ~30 个概率区间: 纯白 0.5% / 纯黑 0.5% / HSB 特殊 1%
                 → 常见色板 — 概率区间链 = 稀有度阶梯的第二种写法
gg(xd,yd)        水平线网格 (xd 列 × yd 行控制密度)
dal(grid,row,t)  ★ 核心: 每行一条 curveVertex 平滑曲线, x/y 各自被噪声位移
                 (xa/ya 振幅 × xo/yo 频率); sxn/syn 开关 = 噪声按行采样 or
                 按行列采样 → 条带/波场 2×2 种性格
色带分块          每 bd 行重选 tic/tac 双色, 行内 lerpColor(i%bd/bd) —
                 band 内渐变、band 间跳变 = 云层的色层结构
影线 (sw)        每条主线先画半透黑 (#1111) 微偏移影线 → 廉价立体感
蒙版底 (bk)      矩形/椭圆底形
```

## 四个可提取 idiom

1. **噪声位移平行线束** (核心): 一束水平曲线, 每条被噪声垂直/水平位移 —
   云带、地层、织物的统一生成器。与 3D 端 Subscape 地层美学**跨端呼应**
   (两端独立实现同一美学 — 正是"不对齐、各自补充"方针的实例)。
2. **色带分块渐变**: band 内 lerp、band 间跳变 — 层理感的颜色本体。
3. **影线**: 主笔画前的半透深色微偏移复笔 — 一行代码的立体感。
4. **mv() 决策位→区间映射**: `map(byte[i], 0, 255, min, max)` —
   比 Rizzolli mod 10 保精度, 比 fxrand 流免顺序耦合; 我们 lane 引擎的
   `range(label, min, max)` 已是同构物, 互证 (第四次)。

## Port 判定

- **recipe-only**: 新家族 `strata-lines` = idiom 1+2+3 独立重写。
  divider/封面底纹的天然选择; financial/consulting/editorial 亲和。
- 色板概率区间链并入 decor v2 稀有度设计输入 (第三个样本)。

## 一句话学到的

4.7KB 的完整作品系统 — 精炼不是少做事, 是**每个机制服务多个目的**:
一个噪声场同时给形状和节奏, 一个分块索引同时给颜色和层理。
