# 76 — 全语料二读审计: 50 课 vs 链上原文

> 2026-07-11。方法 = Fidenza 二读 (75) 的推广: 从 ArtBlocks 公开 GraphQL
> (`data.artblocks.io`) 拉取全部 50 课对应项目的**链上原始脚本** (共 ~2MB, 含
> Cytographia 288KB / BUSY 252KB 两个巨兽), 7 个并行审计员逐课把笔记的事实性
> claim 与原文对照, 有 decor 家族的课再对照 registry.js 的渲染层实现。
> 逐 claim 证据表见 [`audit/`](audit/) 下 batch-A..G 七份报告。
> 判定尺度: 刻意简化不算错; 只标 **笔记事实错误** / **VOICE MISS** (丢原作签名
> 特征) / **INVENTED DETAIL** (原作没有、我们发明的细节)。

## 总量

| 判定 | 课数 | 说明 |
|---|---|---|
| HIGH | 10 | 笔记核心机制讲错, 或家族丢签名/建立在发明机制上 |
| MED | ~20 | 机制不精确 / 家族有一处 voice 级偏差 |
| LOW / CLEAN | ~20 | claim 全坐实 (多课到变量名/常量级逐字命中) |

笔记的 attribution (项目号/作者/license) 50/50 全对。可核对 claim 总体命中率
高 (大多数课 80%+ 逐字坐实), 错误集中在**渲染层机制**——和 Fidenza 二读的教训
完全同构。

## HIGH 级清单 (10 课)

| 课 | 错在哪 | 下游影响 |
|---|---|---|
| L19 Screens | "WebGL 仅 blit、艺术全在 CPU" 讲反 — 每层有动态拼装的 riso 合成 shader (纸纹/边缘扰动/网屏化/套印偏移); "半透明干涉 moiré" 机制不存在 (实为不透明套印 + BSP 深度树 + 交点剪段编织空隙) | folded-screens 的"干涉"叙述是错误下游 |
| L20 RASTER | 原作是逐通道 3 级色阶噪声 dither + 像素块化, **没有变径圆点** | halftone-fade 的"点径=field^gamma"圆点网屏是 INVENTED — 装饰效果成立, 但归因需改 (那是传统印刷网屏, 不是 RASTER) |
| L22 ORI | 3 条机制全是发明: 原作折线预生成后作用于全部 facet (无"贪心剖最大"); 折轴全随机 (非轴对齐±jitter); 着色是随机明度偏移 (非深度渐变) | paper-folds 把 3 条发明当"ORI 规则"实现了 |
| L33 Qilin | 原作是 Verlet 软体, `detectJagged` **主动拒绝**尖锐边; "双尺度噪声撕口"不存在, 纸感来自纹理/泼溅/颗粒 | torn-paper 的整套撕边 recipe 属 INVENTED, 且丢图案纸片签名 |
| L37 Blocks of Art | 原作是 hex 格上的**等距立方体** (shear 三张脸), 不是平面面板网格 | 笔记 idiom 需重写 |
| L38 Ringers | pAlg 指认错 (是布点非缠绕); shrinkConcavePegs 方向反; 真缠绕 = 洗牌子集 × 绕质心角排序的**闭合环** | peg-wraps 丢闭合环+缠绕带两签名, 发明了"逐钉交替侧别" |
| L42 Trossets | "邻格约束传播"不存在 (全局子集 + 每格独立均匀抽签, 衔接靠 Truchet 端点约定); "端点±抖动"不存在 (图元全精确几何) | idiom 结论建立在不存在的机制上 |
| L44 FAKE IT | 头牌 idiom "textBoundingBoxes 增量放置+重叠检测" 是 write-only 死代码; 真避让 = 按文本长度降字号/关贴纸 | idiom 需换头牌 |
| L50 720 Minutes | 机制讲反: 每 token 是**固定专属一分钟** (tokenId 末 4 位经 seed 42 洗牌分配), 不是"收藏一天" | 与 L27 的时钟流派表联动错 |
| L16 Proscenium | "fragment 一行直通/颜色全在 CPU" 以偏概全 — 另有完整 GPU 光照 shader (fresnel + 9 灯) | 笔记结论需限定范围 |

另 3 处 MED 级但性质相同的"观感反推成机制": L47 (Squiggle 的 y 是 hash 字节
Catmull-Rom, 非正弦), L26 (Spaghetti Bones 生长是密度门控出芽, 非"过长重采样"),
L08 (Box Light 的 distShader 与双色渐变 shader 是**死代码**, 真柔光 = 8 射线
× 250 帧 raymarch 累积)。

## 家族对照 (21 个受审家族)

**忠实 / 干净 (9)**: strata-lines (全维度同构, 最佳), ink-scribble, drift-web,
cargo-dashes, scan-tides (ND 合规), hex-lattice, street-grid (仅车道直线 vs
原作蜿蜒, LOW), 以及 flow-ribbons / banded-ribbons 的二读修正部分 (luxe 色池
16 色权重逐项精确、平端、碰撞、离散档位全验证)。

**VOICE MISS / INVENTED (12, 按修复价值排序)**:

| # | 家族 | 差距 | 级 |
|---|---|---|---|
| 1 | peg-wraps | 丢**闭合环** + **缠绕带** (原作: 洗牌子集绕质心角排序闭合); 发明"逐钉交替侧别"。修法已写进 batch-D 报告 (角排序/闭合/单钉高亮三条) | HIGH |
| 2 | torn-paper | 撕边 recipe 整套 INVENTED; 原作签名 = 图案纸片 (纹理+泼溅+颗粒) | HIGH |
| 3 | paper-folds | 3 条发明机制当规则; 丢"剖+镜像翻折"签名 | HIGH |
| 4 | banded-ribbons | 残留一处: 原版分段色只画在带**两端** (加权段数, 20% 零段), 带身单一底色; 我们全身分段。另: 段长应加权抽取, z 档 8 非 7 | MED |
| 5 | river-courses | 双细岸线 vs 原作**变宽填充带**; 古河道应 5 色轮换非单色淡出 | MED |
| 6 | growth-loops | 细描线丢原作**点彩累积**骨质 (盖点+taper+多色) | MED |
| 7 | meadow-streaks | 空心 stroke 椭圆 vs 原作**实心叶片** (fill+反差 stroke) | MED |
| 8 | wash-flow | 线段 vs 原作连续色幕 (TRIANGLE_STRIP+SUBTRACT 减色); 发明 5→1 taper 与 π/4 角度偏置 | MED |
| 9 | sediment-layers | 丢竖直 hatch 沉积纹理 (作品名的来源); 但笔记本身是有意重读为山峦剪影 — 待裁决 | MED |
| 10 | block-mosaic | 逐 cell strokeRect 产生均匀网格感, 原作整块矩形无内隔线 | MED |
| 11 | folded-screens | 每 facet 随机 tone vs 原作沿链**连续明暗坡** | MED |
| 12 | halftone-fade | 圆点网屏是发明 (效果成立); 至少改归因 | LOW-MED |
| — | light-edges | "双色棱"踩在原作死代码上 — 效果自立, 归因限定 | LOW |

## 系统性 lesson (跨课)

1. **体量感靠填充/累积, 不靠描线** — Fidenza fat ribbon / Fragments 实心叶 /
   Qilin 图案纸片 / Spaghetti Bones 点彩 / Ancient Courses 填充带 / Watercolor
   连续色幕: 6 个独立证据指向同一习惯 — decor 引擎默认用细 stroke 画一切。
   这是修复清单里最高杠杆的一条: 引擎级补一组 fill/accumulate 习语, 12 处
   voice miss 里 6 处同源。
2. **"把观感反推成机制"是一读的主要失误模式** — L42 约束传播、L22 折叠规则、
   L44 重叠检测、L33 撕口、L20 圆点、L47 正弦: 看效果脑补实现。二读铁律:
   **机制 claim 必须在原文里找到对应行**, 找不到就标 unverifiable。
3. **正向确认也有含金量** — 双 sfc32+1e6 预热+交替消费在 4 作里逐字出现
   ("社区标配" idiom 从推测升级为实锤); BUSY 脚本里发现零权重 `"busiest"`
   档直接证明姊妹作同引擎; luxe 色池 16 色权重逐项命中。

## 下一步 (待用户排序)

- A. 家族修复 sprint: 按上表 #1-#8 逐个二修 (peg-wraps / torn-paper /
  paper-folds 三个 HIGH 优先; banded-ribbons 端部分段是 Fidenza 收官)
- B. 引擎级 fill/accumulate 习语 (系统性 lesson #1, 一次修六处同源)
- C. 笔记勘误 wave: 10 HIGH + ~20 MED 的事实修正 (含 L27↔L50 联动)
- D. 冻结影响: 家族二修会动指纹 — 沿用"同日修正例外"不适用, 需按 DECOR_V
  纪律走新 lane 或 v4 版本位
