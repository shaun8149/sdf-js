# 第二十六课: Spaghetti Bones — Joshua Bagley

- **ArtBlocks #456** · p5 纯 2D · 15KB · CC BY-NC 4.0 → recipe-only
- 视觉: 差分生长的"意面骨" — 自回避曲线填满空间, 珊瑚/骨骼质感

## 分流判定: 2D-core → 2D 队列, 出家族 (有机曲线空缺)

DiffG 类 = 教科书级 differential growth: 点吸引邻居 (cohesion)、
排斥近旁一切 (separation, quadtree 加速)、线段过长即中点重采样
(G.grw/G.org/G.mve/G.rsp)。外加生长调度器 (spd 自调速、ded 重生、
NP 计数出芽) — 一个小型生命系统的完整节拍器。

## 解剖 (recipe)

1. **三条规则就是全部生物学**: cohesion + separation + resample —
   珊瑚、肠道、脑回、意面, 全是这三行力学的不同参数点。
2. **quadtree 不是优化是器官**: 自回避 = "感知到近旁" — 空间索引
   决定生物能长多密, 数据结构上限即形态上限。
3. **调度器让生长有戏剧**: 自动调速 (快进无聊段、慢放形态涌现段)、
   死亡重生、出芽计数 — 时间导演与力学同等重要。
4. Bagley (Dreams #89 作者) 的第二课: 从调色板工程 (Dreams) 到
   生命系统工程。

## Port: growth-loops 家族 (registry.js, DECOR_V=1 下新增)

闭合环差分生长: cohesion 0.12 + separation (网格代 quadtree) +
segMax 9 重采样 + 噪声漂移防圆化; **快照 = 生长年轮** (每 snapEvery
步存轮廓, 淡描) — 画历史不只画结果。人格 = 迭代数 × 点上限 × 排斥
半径 × 漂移。1280×720 全人格 <40ms。适配 organic/hr。

## 一句话学到的

有机形态 = 三条规则 + 时间 — 画出历史 (年轮), 结果才有生命的厚度。
