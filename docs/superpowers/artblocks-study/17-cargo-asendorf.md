# 第十七课: Cargo — Kim Asendorf

- **ArtBlocks #426** · 原生 WebGL (2D 构图 + GPU 动画) · 36KB · CC BY-NC 4.0 → recipe-only
- 视觉: 集装箱式色块堆叠, 块内虚线/点线肌理, 像素级运动 (pixel motion)

## 分流判定: 第四形态 (2D-core 构图 + GPU 光栅/动画层)

管线三段: `C2dImage` (Canvas2D 画静态构图) → `c2dMotion` (逐帧像素位移)
→ `gl.render` (WebGL 显示 + 时间轴)。美学根基是 Canvas2D 里那本
**虚线画家字典** — `dashed[0..7]`, 每个画家用一种 dash 纪律填一个矩形;
GPU 只负责让它动。静态构图可 port, 运动层不 port。

## 解剖 (recipe)

1. **画家字典**: 8 个 `(x,y,w,h)=>{...}` 闭包, 每个是一种填充纪律
   (横虚线/竖虚线/点线/实面…)。构图循环只做两件事: 切块 + 抽画家。
   变化度来自字典 × 参数, 不来自更复杂的单画家。
2. **2 的幂行距**: `yStep = 2^random_int(0,2)` — 相邻块行距互为倍数,
   混排时节奏兼容, 不会出现 3px 对 5px 的莫尔杂纹。
3. **整数 dash pattern**: `[1..8, 1..8]` 的 setLineDash — 货运标记感的
   来源, 参数空间小而全部可用。
4. Asendorf 的招牌 pixel-sorting 在本作退为 GPU 运动层 — 静帧是干净的
   构图, 运动才泄露作者身份。

## Port: cargo-dashes 家族 (registry.js, DECOR_V=1 下新增)

行×随机切块, 每块从画家字典 (横虚线/竖虚线/疏点线/淡实面+框) 抽一个,
2 的幂行距 + 整数 dash。人格 = 字典开放几页 (calm 2 / balanced 3 / wild 4)
× 行数密度。适配 editorial/consulting (票据/表格肌理感)。

## 一句话学到的

丰富度来自"画家字典 × 抽签", 不来自把一个画家写复杂 — 字典是复利资产。
