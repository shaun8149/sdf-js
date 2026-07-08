# 第四十一课: Ancient Courses of Fictional Rivers — Robert Hodgin

- **ArtBlocks #284** · p5 纯 2D · 51KB · CC BY-NC 4.0 → recipe-only
- 视觉: 虚构河流的地质史地图 — 现河道 + 淡去的古河道 + 牛轭湖 + 地块/城镇/铁路

## 分流判定: 2D-core → 2D 队列, 出家族 (Hodgin 第三课, 首个可 port)

L18 Solar Transits / 语料里的 Ancient Courses 是 Hodgin 的 CPU 侧
代表作: 河曲迁移模拟 (resampleLine/calcFlowBitangent) + oxbow 截弯
(7 处) + **河道演化史绘制** (HISTORY_TYPES) + 地图装饰系统 (地块网络/
建筑/宝藏图/铁路)。trait 分类学之丰 (BIOME×5 / COMP×6 / CITY×4 /
GRID×4 …) 是"具名 trait 面板"的又一教科书。

## 解剖 (recipe)

1. **河曲 = 曲率迁移 + 均匀重采样**: 点沿法向逃离弦中点 (弯越急
   逃越快), 重采样维持密度 — 两条规则就是河流地貌学。
2. **牛轭截弯是灵魂**: 索引远、空间近的两点相触 → splice 掉环,
   环成为牛轭湖遗迹。没有截弯只是蠕虫, 有截弯才是河。
3. **画历史即画时间**: 古河道按年代淡出 — 与 L26 生长年轮同构
   (画历史不只画结果), 但语义是地质时间。
4. 工程教训 (port 中亲历): 河曲长度指数增长, 必须给点数硬预算
   (MAX_PTS=700) + 牛轭扫描加索引窗口 (pinch 必是局部环) —
   否则 O(n²) 直接跑飞。

## Port: river-courses 家族 (registry.js, DECOR_V=1 下新增)

曲率迁移 + 重采样 + 窗口化牛轭截弯 + snapshot 古河道 (老→淡) +
双岸线收尾。人格 = 迭代 × 迁移强度 × 截弯阈值。适配 organic/
editorial。装饰系统 (城镇/铁路) 不 port — street-grid (L28) 已占
该领域。

## 一句话学到的

河流是一个会自我剪辑的曲线: 生长给形, 截弯给史, 淡出给时间。
