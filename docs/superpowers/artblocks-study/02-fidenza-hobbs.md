# 第二课: Fidenza — Tyler Hobbs

- **ArtBlocks #78** · p5 · 1085 行 (手藏注释版 `~/Documents/artblocks/Fidenza/`) · **CC BY-NC 4.0 → recipe-only**
- 视觉: 流场彩带 — 不重叠的粗细各异条带沿噪声场编织
- 注: curated 抓取的 #78 script.js 为空 (V1 大脚本分块存储?), 本课用手藏版; 语料补洞待办

## 结构 (核心 60% 在 cSegs + cllsn)

```
flow field     噪声场 → 角度网格; 可选角度量化 (90°/45° → "collapsed" 变体)
起点生成        y 行 × x 步进, 双向高斯抖动, shuffle 打乱 (杀掉栅格感)
flwL           沿场追踪完整曲线路径
cSegs          ★ 把曲线切成可见段:
               - 空间分区碰撞网格 (nScts², 每点注册 [x,y,r,curveId])
               - 碰撞 = 距离 < r1+r2 且 curveId 不同 (自身不撞自身)
               - 碰撞/越界处 → 结束当前段, 继续走线找下一段 (彩带互相绕行!)
               - look-ahead 预检: 新段起点向前探 max(2, r/ε) 个点, 不够长不开段 (无碎屑)
粗细选择        概率加权谱函数 f() — 少量极粗 + 大量中细 (Tyler 签名式分布)
密度档位        low/med/high/highAF = 起点间距 + 抖动幅度参数组
```

## 六个可提取 idiom

1. **分段可见性** (最重要): 碰撞不是停线而是**切段** — 同一条逻辑曲线被别的彩带
   遮挡后在另一侧继续出现, 产生"编织"错觉。我们 flow-streams 目前碰到边界就 break,
   这是本质升级。
2. **空间分区碰撞 + id 豁免**: 扇区网格使碰撞查询 O(邻域); 同 id 不自撞。
3. **look-ahead 最短段预检**: 段起点先探路, 保证段长下限 — 消灭视觉碎屑。
4. **起点高斯抖动 + shuffle**: 行结构给整体秩序, 抖动+乱序给有机感 — 秩序与
   随机的配比是 Fidenza 气质的来源。
5. **概率加权粗细谱**: 粗细不均匀分布 (极粗稀有) — 直接用我们 lane 引擎的
   `weighted()`。
6. **角度量化开关**: 同一算法, 连续角 vs 90°/45° 量化 = 完全不同气质 —
   一个 hash 决策位换一种性格。

## Port 判定

- **recipe-only** (CC BY-NC): 思想重写为 `flow-ribbons` 家族, 零代码复制,
  attribution 注明 "after Tyler Hobbs' Fidenza (recipe-only)"。
- idiom 1+2+3 是家族骨架; 5 用 lane weighted; 6 留作 hash 决策位。
- 新家族**增量加入** DECOR_V=1 (加家族不改既有像素, 冻结纪律兼容;
  只有修改已发布家族才需要发 v2)。

## 一句话学到的

Fidenza 的高级感不来自流场 (那是大路货), 来自**碰撞切段** — 让每根彩带
尊重所有其他彩带的空间, 秩序感是"互相让路"涌现出来的, 不是排出来的。
