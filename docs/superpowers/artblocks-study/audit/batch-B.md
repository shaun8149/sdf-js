# 二读审计 — batch-B (L02 / L14 / L19 / L20 / L21 / L24 / L39 / L40)

审计员: batch-B agent · 对照物: `<scratchpad>/ab-scripts/*.js` 链上原文 (已 js-beautify, 行号引用 beautified 版)
判定尺度按 audit-brief: ✅ confirmed / ❌ wrong / ⚠️ imprecise / 🔍 unverifiable; 家族只标 VOICE MISS / INVENTED DETAIL。

---

## L02 Fidenza (Tyler Hobbs, #78) — 严重度 MED

链上脚本可读性极好 (压缩但未混淆, 函数名保留: `flwP/flwL/cSegs/cllsn/fat/fSeg/pcLx`)。
注意: 笔记头部说 "curated 抓取的 #78 script.js 为空, 本课用手藏版" — 本次 scratchpad 的
L02-78.js 是**真链上原文** (14.5KB, 含全部 palette 函数), 该待办可视为已补洞。

### 笔记 claim 核对 (02-fidenza-hobbs.md)

| claim | 判定 | 证据 |
|---|---|---|
| "flow field 噪声场 → 角度网格" | ❌ | `flwP` (L149-172) **不用任何噪声**: 基角是 8 方向加权抽签 `wc([pi(.5),.1, pi(0),.1, pi(.25),.2, …])` (L644) 铺满整格, 再叠 15/28/45 个随机扰动 — 70% 走 `adjFlw` (半径内高斯角度冲击, 线性衰减), 30% 走 `adjFlw2` (全场 `sqrt(dist)` 螺旋旋转, `od(.5)` 定向)。`noise()` 只在 Soft-Shapes 渲染 (`strokeSegment` L422) 出现。Fidenza 的"整幅单一主流向 + 局部扰动"气质正来自常量基角, 不是 Perlin 场 |
| "可选角度量化 (90°/45° → collapsed 变体)" | ❌ ×2 | 量化是 `snp(j, pi(.2))` (L189) = **36° 步进**, 单一模式 (`u=od(.04)`, L670), 无 90°/45° 两档; 且 **collapsed 是另一个特征** (`o=od(.04)`, L667): 绕中心 `(w(.5),h(.4))` 的径向场 + 距离比例旋转 (L153), 与量化无关。量化对应的是 "Shape Angles: Sharp" 类 trait, collapsed 对应旋涡构图 |
| 起点 = y 行 × x 步进, 双向高斯抖动, shuffle | ✅ | cSegs L289-297: 行距 `n=h(.017)×{0.5,1,2.5,5}` (highAF/high/med/low), x 步 `r=w(.01)` (low `w(.02)`/highAF `w(.007)`), 抖动 `gssn(a,w(.005))`+`gssn(y,q)` (q=`w(.03)`, low `w(.07)`); 行列表和点列表都 `shffl` |
| 碰撞 = 距离 < r1+r2 且 curveId 不同; 每点注册 [x,y,r,curveId]; nScts² 网格 | ✅ | `cllsn` L262-274: `dist(a,b,e,h) <= c+i && f!==j`; `o[c][e].push([f,g,b,r])` L317; `nScts=10` L71 |
| 碰撞/越界 → 结束段继续走线找下一段 (编织) | ✅ | cSegs L346-350: else 分支 push 段后 `u+=1` 继续遍历同一条曲线 |
| look-ahead `max(2, r/ε)` 预检 | ✅ | L321 `Math.max(2, Math.floor(b / w(.001)))` — 探 margin/2px 个点 × 步长 `w(.007)`=14px ≈ 2×全宽 |
| 粗细 = 概率加权谱 f(), 少量极粗+大量中细 | ⚠️ | pm2-pm6 (L453-471) 确是 `wc` 加权谱; 但 V1/V4 是**固定宽** (pm1≡z1, pm7≡z4), V6/V7 谱重心在粗端 (pm6: z5 .2/z6 .5/z7 .3) — "极粗稀有"只对中小 scale 变体成立 |
| 密度档位 low/med/high/highAF = 间距+抖动参数组 | ✅ | 见上, L284-287 + L664 |

### 家族对照 A: banded-ribbons (registry.js L2017-2171, 二读后当前实现)

brief 专项: fat ribbon / 分段色 / luxe 数值 / 平端 / 碰撞 / 粗细 levels / turn bias / density / 碰撞半径。

- **fat ribbon 构造** ✅ 对上: 脊线→逐点法向偏移 top/bot (L2131-2141) = 原版 `fatTop/fatBot` (原 L209-249); 闭合 fill, 非描边折线。
- **平端** ✅ 对上: L2158-2168 直接 top→reversed bot 闭合 = 原版 `fat()` (L245-249) 的平切端; 半圆端帽发明已移除。
- **luxe 色池数值** ✅ **逐项精确**: 我把原版 16 色 HSB(360,100,100) 全部手工转 RGB 与 registry L2060-2077 对照 — 16/16 颜色分毫不差 (例: dRed [358,64,86]→[219,79,84]; ppGrn [160,15,85]→[184,217,206]; ddBrwn [25,45,13]→[33,24,18]), 16/16 权重与 `pcLx` (原 L521) 完全一致 (.05/.03/.12/.02/.06/.06/.03/.04/.18/.02/.05/.05/.03/.17/.09/.03)。注: 原版权重和=1.03, `wc` 不归一; registry 用 poolTotal 归一 — 数学上等价。
- **粗细 levels** ✅ 对上 (缩尺设计决定): 离散档 + 加权抽取 (L2087-2094) = 原版 z 档 + pm 谱。原版是 8 档 z0..z7=2..320 (75 笔记写"7 档" ⚠️, 见下)。
- **分段色** ⚠️ **机制偏差 (MED)**: 原版**先整条 fat shape 填一个底色** (`pMnCl`, 且宽带避开背景色, L681+695), 然后只在**两端**各画 `pNStps` 段 — 段数加权 `wc([0,.2, 1,.1, 2,.15, 4,.4, 8,.12, 16,.03])` 上限 1/f (L483, 20% 概率零段=纯色带), 从两端向内推进 (L697-719 的 `[!0,!1]` 循环)。段长 `pSL` 也是加权 [4px .15 / 8px .4 / 16px .3 / 32px .15] × 变体倍率 0.5-2.5 (L477-480)。registry 是全身均匀切段 + 段长均匀抽 (L2145-2148)。**原版"纯色长带混着端部分段带"的混合质感被简化成全身分段**。不算丢签名 (分段色本身在), 但这是二读后仍存的最大机制差。
- **碰撞** ⚠️ 两点: (1) 原版碰撞→当前段隐没、曲线继续走再现 (编织); banded-ribbons 碰撞→整条 break (L2120)。编织再现由 flow-ribbons 保有, banded 放弃 — 记 MED 设计权衡而非 miss。(2) 碰撞半径: 原版注册半径=margin (略大于绘制半宽, z4: 40 vs 37.6 → 自带留隙, 且判定是 r1+r2 双半径和); registry 用 `half*0.8` 查 14px cell 集合 (L2097-2106) — 允许轻微贴边。LOW。
- **turn bias**: 原版**没有** per-ribbon turn bias — 曲率全部来自场扰动 (adjFlw/adjFlw2); banded 的 `baseAngle + (noise-.5)*2.6` (L2122) 保住了"单一主流向+摆动", 比 flow-ribbons 的纯噪声更接近原版气质。✅ 无遗漏。
- **density**: 原版 行×步进+抖动+shuffle; banded 均匀随机撒 attempts 次 (L2114)。装饰尺度可接受, LOW。
- **最小长度门** ✅ `spine.length*step < thick*2.2` (L2127) ≈ 原版 look-ahead 门。
- **描边**: 原版深色描边是稀有模式 (`t`≈2.5%+blk/wOC 变体, L672; 默认段描边是自色 `w(5e-4)`, L432); registry 永远画深色发丝框 (L2161)。轻微 INVENTED (always-on), LOW。

### 家族对照 B: flow-ribbons (registry.js L268-425, v1 冻结)

分段可见性/网格碰撞+id 豁免/look-ahead/行+抖动+shuffle/加权粗细 5 个 idiom 全对上 (L332-338, 356-366, 393-411)。
一个真差异: **场用 `noise()*4π` 全向** (L398/418) — 原版是常量主方向+扰动, 所以 flow-ribbons 是回旋纹而非 Fidenza 的定向编织。v1 已冻结不改, 但记录: **主方向感是 L02 笔记"噪声场"误读的下游** (MED, banded-ribbons 已实质修正)。

### 75-fidenza-second-reading.md 补充核对

- "7 档离散等级 z0=2…z7=320" ⚠️ — 是 **8 档** (z0..z7, 原 L84)。数值 2/5/10/20/40/80/160/320 @2000 ✅。
- "厚带沿弧长切 4-32px 短段, 每段独立抽色" ⚠️ — 见上: 只有两端 pNStps 段重抽色, 带身保持底色; 4-32px 是 pSL 基值 ✅ 但有 0.5-2.5× 变体倍率。
- "luxe 淡色/新闻纸占 ~55%" ✅ 大意 (newsprint .12 + ppGrn .18 + browns .29 ≈ .59 承重)。
- "碰撞留隙…曲线相遇即止" ⚠️ — 原版是段隐没再现, 不是止; 该句与 L02 笔记 idiom 1 自相矛盾 (同段落却引"与 L2 结论一致")。
- "产物: 色池 = 主题色×1 + OKLab tint×1.6 + 中性×2.2" — **文档漂移**: Sprint 76 已换成真 luxe 池 (registry L2053-2077), 75 笔记此节未更新。LOW (merge 在后, 建议下次 doc pass 补一行)。

---

## L14 Torrent (Steganon, #466) — 严重度 MED (无家族)

| claim | 判定 | 证据 |
|---|---|---|
| "原生 WebGL" | ❌ | 是 **p5.js WEBGL 模式** (`new p5(...)` L191, `createCanvas(t,r,e.WEBGL)` L198, `createShader` L199), 非原生 WebGL |
| "8.9KB (frag ~1.5KB)" | ✅ | 8864 bytes; frag 字符串 ~1.9KB, 近似可 |
| "CPU 只准备一张源纹理" | ✅ | `oe(R)` (L155-175) 在 p5.Graphics 上画条纹 `Z`/斜杠 `te`/圆/矩形 + 三层 blendMode 洗线 `ee` (BURN/SOFT_LIGHT/OVERLAY, L173), shader 只吃 `u_imageInput` |
| `uv.y = mod(f(uv) + mod(u_time,1000.)/u_speed, u_mod)` | ✅ | frag 原文逐字 (L199) |
| fbm 场位移采样 | ✅ | `f()` = 7-octave value-noise fbm (a=0.9, gain .4, lacunarity `2.2+u_r3/4`); 且 `tt()` 把时间也馈入 hash 种子 |
| 恒等 hash 颗粒 `fract(sin(dot(uv,…))*43758.5453)/u_noise` | ✅ | frag 末行逐字, 常数 43758.5453 ✅ |
| "tile 化: u_tileoffset/u_tiledivisor 把一条流切成 N 条并排 — 单 shader 多窗格复用" | ❌ | 这两个 uniform 是 **print 导出机制**: `d`(?print=true) 时按 `U=20`px 横条逐条渲进大图 `T` 拼高分辨率输出 (L210: `T.image(e, 0, U*G, …)`); 实时模式恒为 `tileoffset=0, tiledivisor=1`。不是视觉多窗格 |
| "静止一帧只是条纹, 运动才是作品 — 动画即本体" | ⚠️ | 链上**默认是静帧**: 非 `?animated=true` 且非 print 时 `ae(e)`=noLoop (L202)。动画是 opt-in 查看参数; 每 200 帧还会换 uniform 场景 (`re(r)`, L209)。"shader-core→3D 端"的分流判定仍成立, 但"动画即本体"与收藏者默认所见不符 |

---

## L19 Screens (Thomas Lin Pedersen, #255) — 严重度 HIGH

| claim | 判定 | 证据 |
|---|---|---|
| "原生 js" · 14KB | ✅ | 无 p5, 手写 canvas2d + webgl; 13.7KB |
| "WebGL 仅 blit; fragment shader 全文 `gl_FragColor=texture2D(u_t,v_t)`; 艺术在 CPU" | ❌ **核心机制讲错** | 那只是最终显示 program `X` (L166)。真正的**每层合成 shader 动态拼串** (L503-506): stegu simplex + `fbm8/fbm6/fbm1` (L162-165), 纸纹 `tex=fbm8((K*pos)*200*q+of)+fbm8(pos+of)/4`, 边缘扰动 `di=vec2(fbm1(pos*75),…)/2500`, 网屏化 `g=smoothstep(tex-0.15,tex,sc)` 把 CPU 灰度 mask 转成一层**riso 质感彩墨**, 还有 D 变体的斑点罩层与逐层套印偏移/旋转 (misregistration, L512-520 的 `d`)。CPU 画的是灰度渐变 mask, **一半的艺术在 GPU**。末行还有致谢彩蛋 "noise from github.com/stegu/webgl-noise with permission" |
| "hash → 自实现 sfc32" | ❌ | 是 **xorshift128** (Marsaglia): `r^=r<<11; e[0]^=r^r>>>8^t>>>19` (L18)。sfc32 是 L21 Tide Predictor 的写法, 两者不同 |
| "线段链表结构" | ✅ | `xe` 造 `{l,n}` 双向链 (L220-233), `_e` 数链长, `ge` 剪链 |
| "y/z 轴旋转 (伪 3D 折叠)" | ⚠️ | 只有**一次全局绕 x 轴 -π/5 旋转** (L445-451, z 初始恒 0 → 实效 = y 向 cos 压缩/透视缩短); 折叠感真正来源: 链条转向 + 每段向下挤出高度 `i=[200,30,10,200][L]` 的四边幕布 (L525-526) + 沿链灰度渐变 + **BSP 二叉深度排序** (`ae/ie` front/back 树, L202-219 — painter's algorithm) 遮挡 |
| "每段灰度 `rgb(255e,…)`" | ✅ | `De = e => rgb(${255*e},…)` (L467), 段的 p/p1 弧长位置作 gradient stops (L526) |
| "2-3 屏半透明叠加, 交叠处密度拍频 (moiré)" | ❌ | 无 alpha 叠加: 层合成是 `mix(col,bg,g)` **不透明套印**; 交叠处理是几何的 — 相交处либо截断 (`I=false` 时把 s1 切在交点, L423-427) либо**剪掉交点周围 5 段造成穿插空隙** (`ge(r.n,5)`, L429-430 — 真正的"编织让位"), 不是光学干涉 |
| (未入笔记的大 idiom) | — | 5 个形状生成器 `de[]` (同心圆/平行线/回字方/放射线/样条曲线, L274-376) 按 E 组合; 交点剪 5 段的 weave-gap; BSP 深度树 — 三者都是 Screens 的骨架, 笔记未捕获 |

### 家族对照: folded-screens (registry.js L1169-1227)

- 屏数 2-3 / 折痕切 facet / facet 斜率 ✅ recipe 级成立 (链条转向的合理缩写)。
- **tone 偏差 (MED)**: 原版亮度是**沿整链连续的灰度渐变** (p→p1 单调推进, 映射两个 palette 色之间) — 折叠读成 3D 靠的是连续明暗坡; registry 每 facet 独立随机 `tone: 1 - toneSpread*rand()` (L1204), 相邻 facet 明暗无序 → 坡变成补丁。建议 (不改代码, 仅记录): tone 沿 facet 序单调渐变即可贴回原版。
- **"半透明干涉" = INVENTED (LOW-MED)**: 承笔记 ❌ 而来; 原版是不透明套印+BSP 遮挡+套印偏移。装饰尺度低 alpha 叠加是合理简化, 但不宜再以"复刻了原作干涉"叙述。
- 每屏单色 (L1192) vs 原版每链双色渐变 + 特殊层 W 黑底反白 (L510) — 刻意简化, 不标。

---

## L20 RASTER (itsgalo, #341) — 严重度 HIGH

| claim | 判定 | 证据 |
|---|---|---|
| "p5 + 双 shader" · 10KB | ✅ | shA=`fsn`, shB=`fs` (L1-3, L43); 10496 bytes |
| Gesture 类沿点对生成笔触路径 | ✅ | 5×4 网格点 shuffle 取 brushes 个 (initPts L97-104), 二次贝塞尔 + 每采样点 ±10 抖动 (qCurve L172-184), 逐帧沿路径推进 |
| drawBrush 软径向印章 alpha=A·(1-d/R) | ✅ | L79-89: `alpha = r/255*(255-map(dist,0,w/2,0,255))`, A=15 极低; 印章以 texture+plane 盖进 buffA (L158) |
| "drawNoise 撒噪声底" | ⚠️ | `npg` 是馈给 shB 4D simplex 的**噪声查找纹理** (`S.setUniform("h", npg)`, L59; frag 内 `A(a)=texture2D(h,…)` 采样), 不是可见的噪声底图 |
| "shA 半调点阵显示 (uniform j = 点径)" | ❌ **机制讲错** | `fsn` 是**逐通道 3 级色阶 + 值噪声抖动的 dither**: `g(b,c,a)`: `d=2/a*m(b)+c-1/a; f=clamp(floor(a*d)/(a-1))` (a=3 → 电平 {0,.5,1}), 外加 `floor(c)/k` 像素块化。**没有圆点、没有可变点径**; `j`=dot 是像素块尺寸 (默认 ≈1px, 键盘 1/2/4/8 放大), 恒定值, 不由场值调制 |
| shB 反馈 warp (自采样+偏移) | ✅ | `d=texture2D(G,(a+l)*0.986)` — simplex 位移 l + 0.986 缩放反馈, buffB→buffC 回灌 (L59) |
| "场与屏分离" 架构读法 | ✅ | 成立 (笔刷 buffA/累积 buffC 为场, shA 为屏), 但"屏"的real form是 dither 而非 halftone |

### 家族对照: halftone-fade (registry.js L1947-2015)

- 软径向 blob 场 ✅ 对上 drawBrush 思想 (falloff 平方是无害微调)。
- **"点径 = field^gamma" 的可变半径圆点网屏 + 错行 rosette (L2000-2010) = INVENTED DETAIL (MED-HIGH)**: RASTER 全程无变径圆点 — 它的印刷感来自 3 级噪声抖动色阶 + 像素块。家族把经典 halftone 视觉语言安在了 RASTER 名下; 注释 (L1947-1953) 与笔记都以"原作架构"叙述这一机制, 需在文档上更正归因 (视觉本身作为装饰家族没问题)。若想贴回原作 voice: 屏应是"粗像素 + 每通道少级色阶 + 噪声阈值抖动"。

---

## L21 Tide Predictor (LoVid, #376) — 严重度 LOW (ND 严格, 只读只对照)

笔记全部 claim 与原文一致 (此处只写 recipe 级结论, 不复述代码):

- 1000×1000 单一扫描索引折行 ✅; 无几何/噪声/对象 ✅ (全批最小 4.6KB ✅)
- 三通道三角波 `255-|255-(i%p)·k|`, 周期互异 ✅ (周期 ∈ {1000,500,333,250,200} 铸造抽取)
- 波谷处 0.01% 换周期 (±2 随机游走, 下限 10) / 1% 增益微调 ✅; 每帧掷 sync_probs [0.01/0.05/0.1/0.5] 全体归位 ✅
- drawWait 1→5000→500ms ✅; PRNG 确为 sfc32 (源码自名) ✅ — L19 笔记的 "sfc32" 很可能是从这课串写
- (审计员旁注, 不入笔记建议) 源码增益微调分支有一处真值判断笔误, 使微调恒走增益+方向 — 纯观察, ND 下不做任何利用

### 家族对照: scan-tides (registry.js L1879-1945)

ND 合规 ✅: 结构完全重写 (行式 gradient 段 vs 逐像素), 零代码搬运。idiom 对照: 1D 扫描游标跨行连续 ✅ (`scan += w`, L1936); 三角波 ✅; 周期随机游走+概率再同步 ✅ (静态适配为逐行, 笔记已声明); RGB 三通道→双主题色 OKLab + 失谐第二通道刻线 = 已文档化的调色板约束改写 ✅。无 VOICE MISS / 无 INVENTED。

---

## L24 WaVyScApE (Holger Lippmann, #406) — 严重度 MED (无家族)

| claim | 判定 | 证据 |
|---|---|---|
| p5 纯 2D · 7.4KB | ✅ | 7426 bytes |
| y 向每 60-140px 一带; 42% 显影 | ✅ | `S()` L91: `f += random(60,140)/1600*he`; `a<42 && v()` |
| 15 控制点变形闭合 blob, 沿 x 每 1-5px 盖章, 控制点连续 update | ✅ | `D=15` (L11), `I` 类 noise 驱动 magnitude/omega (L110-117); `v()` L96: `f += random(1,5)/1e3*wi`; 每枚章实为两遍 (fill(0,3) 阴影 + 彩色, L100-108) |
| "**17 组**手调调色板库" | ❌ | `k` 有 **34 组** (L17-58, 含重复组: 0≡12 等; 尾部两组几乎全随机槽)。17 疑是把阈值表 `y` (L15, 恰 17 元素) 数成了调色板 |
| 逐带抽签 (per-band 调色板) | ✅ | `E = int(random(k.length))` 在 `v()` 内 = 每带重抽 (L95) |
| 随机色槽 `[d(150,255),d(200),d(100,255)]` | ✅ | L18 逐字 |
| 画布内签名条 (白框 + 日期_作品名/作者/网址) | ✅ | L74-87: 白边 rects + `text(F+"_WaVyScApE / holger lippmann / www.e-art.co")`, F=真实渲染日期 |
| 自 xorshift `f^=f<<13…` | ✅ | `t()` L4-6 (种子 `parseInt(hash.slice(0,16))` 借 "0x" 前缀解析) |
| (未捕获, 不扣分) | — | draw() 叠 6 遍 S() (L71, 随机 scale/密度), b<s 阈值走 `y[]` 表控制黑描边带比率 |

---

## L39 Endless Nameless (Rafaël Rozendaal, #120) — 严重度 LOW-MED (无家族)

| claim | 判定 | 证据 |
|---|---|---|
| 原生 js · 3.0KB | ✅ | 2976 bytes, 无库 |
| 色对目录: two-colors w3 (13 对) / white+color w1 / black+color w1 | ✅ | L12-55 逐字 (white+color 7 对, black+color 8 对); groupCount [1,2,3], pairCount [1,12] |
| rects 阶梯 [1,2,3,3,3,5,5,5,5,5,9,9,9,9,13,16,36,72] | ✅ | L4 逐字; `Rnd.pck` 查表即抽签 ✅ |
| 3KB 含动画 (speed/stops) | ✅ | speed 7e-4, stops [2,16], 60fps setInterval (L159) |
| "**纯平色块**分割, Mondrian 血统" | ⚠️ | 分割是 ✅ (cmp: 每次取**最大面积**块二分, perp=.8 偏垂直切, variability 抖动切点, L94-112); 但每块填的是**滚动的双色线性 gradient** (奇数个 stops 交替色对两色, 相位 `p += s` 循环, L134-155) — 不是平色。"endless" 的流动感正在此; 笔记的视觉描述漏掉了核心渲染层 |

---

## L40 Skulptuur (Piter Pasma, #173) — 严重度 LOW (无家族; Bubble Blobby 脚本不在本批)

| claim | 判定 | 证据 |
|---|---|---|
| 原生 js · 6.4KB | ✅ | 6370 bytes, webgl2, 零依赖 |
| JS 拼装 GLSL 距离场源码 (dg 字符串累加) | ✅ | `dg += \`o=p+V(…);…F b${i}=${C};\`` (L30-41) 注入 `F D(V p){${dg}…}` (L93) |
| `L(max(q,0))-` 即 box SDF | ✅ | `g = '),0)+L(max(q,0))-'` (L37) — 经典 `min(max(...),0)+length(max(q,0))-r` |
| min/max/abs 高尔夫 | ✅ | `#define` 缩写表 (S/N/L/M/P/J/V/W/X/F, L70-72); 洋葱层 `abs(C)-h*e/40` (L38) |
| xorshift + 场景组合器 | ✅ | R() = xorshift128 (L2); 组合器 = cf 循环 + 网格 repeat `o.xy-=M(floor(o.xy)+…)` |
| 12 组行列比例 O[] 抽两组 | ✅ | O 12 项 (L10-23); `cf=[O.splice(R(12)|0,1)[0], O[R(11)|0]]` 不放回抽两组, 各带 shape(R8)/onion(R3) 参数 |
| "元编程 SDF raymarch" | ⚠️ (从宽) | 实际是**渐进式路径追踪器**: 5-9 次弹射循环、反射/漫反射混合、逐帧 accumulation buffer、ACES 近似 tonemap + 抖动 (L93 尾段) — 比 "raymarch" 高一档; 另有 1/150 金料稀有位 `G=R(150)<1` (L68)。分流判定不受影响 |

---

## 总严重度速览

| 课 | 严重度 | 一句话 |
|---|---|---|
| L02 | MED | 场≠噪声场 (常量基角+扰动)、量化 36° 非 90/45、collapsed≠量化; luxe 池 16/16 精确、平端/碰撞/档位 ✅; banded 全身分段 vs 原版端部分段 |
| L14 | MED | p5 非原生 WebGL; tile uniform 是 print 分条导出非多窗格; 链上默认静帧 |
| L19 | HIGH | "WebGL 仅 blit" 大错 (每层 fbm riso shader 占一半艺术); sfc32 实为 xorshift128; 家族 facet 随机 tone 丢连续明暗坡 |
| L20 | HIGH | shA 是 3 级噪声 dither 非变径半调; halftone-fade 的"点径=场值"+rosette = INVENTED DETAIL |
| L21 | LOW | 全部 claim 精确; scan-tides ND 合规、无发明 |
| L24 | MED | 调色板 34 组非 17; 其余含随机色槽引文逐字 ✅ |
| L39 | LOW-MED | 两个 idiom 引文逐字 ✅; "纯平色块"漏掉滚动双色 gradient 本体 |
| L40 | LOW | 全部 ✅; 实为渐进 path tracer (超出笔记但不矛盾) |
