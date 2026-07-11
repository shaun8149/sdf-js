# 第二十三课: Pre-Process — Casey REAS

- **ArtBlocks #383** · p5 纯 2D · 11KB · CC BY-NC 4.0 → recipe-only
- 视觉: Process 系列语法 — 圆 (center/perimeter/angle dot) 相触连线的网络图

## 分流判定: 2D-core, 文档课 (与既有家族重叠)

100 个 cell = 圆 + 方向 + 自旋 (globalSpin), 相触时画网络线; 图元词汇
是"仪器图"式的: 圆心点、周界圈、角度点 (drawAngle 画的是周界上的
小圆点, 非刻线)。视觉领域与我们已有的
drift-web (连线网) 和 circle-pack (圆散布) 高度重叠 — 按"家族差异化"
纪律不再 port, 记 idiom。

## 值得带走的 idiom (进 decor v2 输入清单)

1. **mintNumber 算术 trait**: `surface = mintNumber % 8; origin = %3;
   growth = %5` — trait 不从 hash 来, 从**铸造序号**来。同系列第 N 件
   的性格是可预告的 (\#7 必是 surface-7)。与 hash-trait 互补: 序号
   trait 给收藏结构 (集齐 8 面), hash trait 给个体身份。
2. **图层布尔开关组当 trait**: drawCenter/drawPerimeter/drawAngle/
   fillCell/textOn — 同一份几何, 开关组合出 2^5 种"显影"。正合我们
   personality bundle 的下一步: 人格不止改参数, 还能开关图层。
3. Process 语法本体: "元素 = 形 + 行为", 行为相遇时留下痕迹 —
   REAS 二十年一以贯之的 conditional design 教科书。

## 一句话学到的

trait 有两个正交来源: hash 给个体身份, 铸造序号给收藏结构。
