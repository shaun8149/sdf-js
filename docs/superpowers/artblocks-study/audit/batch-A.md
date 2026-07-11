# 二读审计 batch-A

课程: L01 / L03 / L04 / L05 / L32 / L36 / L47 / L49。
方法: 笔记 claim ↔ 链上脚本逐条核对; 4 个衍生家族对照 registry.js。
判定尺度按 brief: 刻意简化不算错, 只标 VOICE MISS / INVENTED DETAIL / 笔记事实错误。

---

## L01 Fragments of an Infinite Field (Rizzolli, #159) — 笔记 ✅ 为主, 家族 MED

### claim 核对

| claim | 判定 | 证据 (L01-159.js) |
|---|---|---|
| hash → 32 决策位, 每 2 hex 字符 mod 10 | ✅ | `semente()`: `slice(i+2, i+4)` ×32, `parseInt(x,16) % 10` (L23-32) |
| 网格 93-107 × 20-39 | ⚠️ | `linha=map(s[0],0,9,93,107)`, `col=map(s[1],0,9,20,39)` 存在, 但它们是**格子尺寸除数** (`larg=DIM/linha`, `alt=DIM/col`); 实际循环 `i≤DIM, j≤1.5·DIM` (L301-302), 纵向 translate 是 `j*alt/fy` (fy=10) → 画布上有效网格 ≈ linha 列 × **10·col (200-390) 行**, 不是 20-39 行 |
| 噪声系数 fn 0.0325-0.07 | ✅ | L42 |
| fx=1, fy=10 各向异性椭圆 | ✅ | L44-46; `ellipse(0,0, this.fx*larg, fy*alt*a)` (L332) |
| 噪声门控密度 `if (a2 < chance)` | ✅ | L316; 注意 a2 = 同一噪声场**转置坐标** `noise(fn*j, fn*i)` (L304), 非独立噪声 |
| 噪声索引色板 `cor[floor(a*cor.length)]` | ✅ | `fill(novaCor[floor(a*corFolhas.length)])` (L331), `stroke(corFlor[floor(a*corFlor.length)])` (L329) |
| 四季 + 每季 2 变体叶色/花色 5 色板 | ✅ | estacao 四分支 (L61-209); corFolhas 变体由 `random(1)<0.5`, corFlor 变体由 digit 23/25/14/22 |
| 夏雨/冬雪叠加 | ✅ | `if(inverno) neve(); if(verao && chuvaChance<0.9) chuva()` (L287-292) |
| 草叶场画两遍 花前浓/花后疏 | ✅ | `folhas(random(.35,.6)); play(); folhas(random(.2,.35))` (L284-286) |
| flor 四层 petalaPlot/petalaOut/corona/stamen | ✅ | L383-645; petalaOut 仅秋季用 (L713) |
| "按季节决定花朵绘制顺序" | ⚠️ 轻微 | 实际只有秋季不同 (85% 概率多画一层 petalaOut, L707-717); 春夏冬顺序完全相同 |

### 家族对照 meadow-streaks (registry.js L239-266, CODE PORT CC BY, attribution L2994 ✅)

| 维度 | 判定 |
|---|---|
| 各向异性椭圆 + 噪声旋转 | 对上: `ctx.ellipse(0,0,bladeW=3, cellH*(0.5+a))` + `rotate((a-0.5)*π*1.6)` (L256-260)。旋转范围 ±0.8π vs 原作 `a*TAU` 全周 — 尺度级简化, 可接受 |
| **形状构造 fill vs stroke** | **偏差 (MED, VOICE)**: 原作草叶是**实心 fill 椭圆** (叶色) + 反差色 stroke 描边 (L329-332); 我们 stroke-only 空心轮廓 (L257-261, 无 fill)。原作质感 = 密集实心色叶片; 空心轮廓在 bladeW=3 下勉强读作笔画, 但"实心叶片场"这一签名丢了。Fidenza 先例同型 (细描线代替实心形) |
| 颜色来源 | 对上: 噪声索引 `colors[floor(a*colors.length)]` (L253) — 正确继承核心 idiom |
| 分布随机性/门控 | 对上: `gate>0.46 continue` (L252)。差异: 门控用独立噪声 (seed+7919), 原作是同场转置 — recipe 级, LOW |
| 双层纵深 (花前/花后两遍) | 未做 — decor 无主体, 合理省略 |

**严重度: MED** (家族 fill→stroke; 笔记本身仅 1 处网格行数 ⚠️ LOW)

---

## L03 Archetype (Golid, #23) — 全部 ✅, 家族 MED

### claim 核对

| claim | 判定 | 证据 (L03-23.js) |
|---|---|---|
| xorshift32 `<<13 >>17 <<5` | ✅ | `function rnd(){seed^=seed<<13,seed^=seed>>17,...seed<<5...}` |
| w_pick 累计和加权 | ✅ | `w_pick(e,t)`: `t.reduce((e,t)=>[...e, e[len-1]+t],[0])` + findIndex |
| chaos/balance/pattern 三人格包, 权重 [1,4,2] | ✅ | `layout=w_pick([chaos_layout,balance_layout,pattern_layout],[1,4,2])`; 各包含 outerSize/minGridSize/innerSize/nonempty |
| Apparatus next_block 延伸水平/垂直/开新块 | ✅ | `next_block(e,t,n,a)`: n.in&&n.h 续水平, a.in&&a.v 续垂直, 否则 `i()` 开新块, `chance_extend` 概率驱动 |
| linegrid → NW 角点 → 矩形 | ✅ | `linegrid_to_rects` → `get_nw_corners` (h&&v&&in) → `corners_to_rects` |
| group 颜色继承 + group_size | ✅ | `i()` group 分支: `t = rng()>.5 ? n.col : a.col; main_color = rng()>group_size ? random : t`; atomAppOpts group_size=0.4; colorModes 权重 [4,2,1,2] |
| 嵌套网格: 外层分区 → 内层原子块 | ✅ | reset(): 三个 section Apparatus → createGrid → createApparatus (内层) |
| 量化深度 depthSteps=8 | ✅ | `z1:.1+Math.floor(rng()*depthSteps)/depthSteps`, `depthSteps=8` |
| 等轴测 xu/yu/zu 三面 + 面透明度组合 | ✅ | xr=-π/6, yr=3π/6, zr=π/6; shades 6 组 `[[1,1],[1,0],[0,1],[0,0],[.15,0],[0,.15]]` 权重 [5,1,1,.5,1,1]; shadeOpacityTop=0 恒定 |
| painter toposort | ✅ | `get_overlap_graph` + `toposort1(...).reverse()` |
| 42 套色板 {c,s,b,w}, 按 w 抽 | ✅ | get_palette 数组逐一数 = **42 条**; `w_pick(e, e.map(e=>e.w))` |

### 家族对照 block-mosaic (registry.js L437-488, recipe-only, attribution L3005 ✅)

| 维度 | 判定 |
|---|---|
| 生长而非切分 | 对上 (recipe 级): 逐格扫描, 延左 p=.42 / 延上 p=.30 / 开新块 (L452-466) — 状态机生长, 非递归切分 ✅ |
| 邻块颜色继承 | 对上: `inheritFrom = rand()<0.55 ? (left!==-1?left:up) : -1` (L463)。差异: 原作 50/50 随机选 n.col/a.col, 我们恒优先 left — LOW |
| **块轮廓构造** | **偏差 (MED, VOICE)**: 原作经 NW 角点把每个生长块画成**一个完整矩形** (块内无内隔线); 我们对**每个 cell** 都 `strokeRect` (L482-484) → 画面呈均匀 16×9 网格线, 块只靠同色分组隐约可见。"不规则矩形紧密填充"这一 Archetype 签名被均匀格线稀释。同色描边减轻但未消除 |
| 稀疏填充 34% (id-hash 门控) | 我们发明 (L477-478), 但属 decor 减重设计决定, 不算 INVENTED DETAIL 违例 — 记录备查 |
| 等轴测三面 | 未做 — 笔记明说 "v1 不做 (平面块更安全)", 已声明的设计决定 ✅ |

**严重度: MED** (家族逐 cell 描边 → 网格感; 笔记零错误)

---

## L04 Watercolor Dreams (NumbersInMotion, #59) — 笔记 MED ×1 ⚠️×1, 家族 MED

### claim 核对

| claim | 判定 | 证据 (L04-59.js) |
|---|---|---|
| pwa(list) {p} 字段加权选择 | ✅ | `function pwa(s){let e=random(1)...if(e<=s[o].p+t)...}` |
| pal = IQ 余弦 a+b·cos(2π(c·t+d)) | ✅ | `pal(s,e,t,o,r)`: `255*(e[i]+t[i]*cos(2*PI*(o[i]*s+r[i])))` |
| **"颜色引擎是连续函数而非离散色卡"** | **⚠️ (MED)** | pal 只服务 `isv:true` 的 6/36 个 colorScheme (p 合计 ≈0.075); 其余 **30 个 scheme 是离散 3 色 RGB 色卡** (drawGraded 用 `palette[colorIndex%len]`, 每条 Flow 一色)。余弦板是稀有 variegated 模式, 不是主颜色引擎 |
| mc/ml/mr/mlt 圆/线/矩形/字母轮廓采样 | ✅ | 四函数俱在; mlt 用 letterData A-Z 多边形 |
| rlbs 弧长等距重采样 | ✅ | 逐段累计 dist + 线性插值 |
| FlowNode 噪声平流 | ✅ | `update(): currPos += flowField(currPos)` ×stepsPerUpdate(4) |
| **"每步画低透明度线段"** | **⚠️ (LOW-MED)** | 实际是 `beginShape(TRIANGLE_STRIP)` — prev/curr 两排节点织成**连续色带**, alpha 随 age `map(age,0,lifespan,255,0)` 从全不透明衰减, 且 `pg.blendMode(SUBTRACT)` + 暖纸底 `background(242,224,201)` — 减色混合是水彩暗部的来源, 笔记漏了这层签名 |
| 人格布尔梯 20/15/10/5/1% | ✅ | `isMirrored=random(1)<.2, isRotated<.15, isStriped<.1, isInverted<.05, isWavey<.01` 逐字吻合 |
| 镜像折叠 abs(x-0.5·ss) 喂噪声 | ✅ | `abs(s.x-.5*ss)/(noiseScales...s*ss)+offset` |

### 家族对照 wash-flow (registry.js L520-563, recipe-only, attribution L3006 ✅)

| 维度 | 判定 |
|---|---|
| 形状锚定 + 噪声平流 | 对上 (recipe 级): 斜色带上采样 NODES 节点, 逐步平流 (L535-559)。源形状只有 band (无圆环) — 笔记 port 判定写"色带/圆环", 圆环未做, LOW |
| **连续拖痕的画法** | **偏差 (MED, VOICE)**: 原作相邻节点连成 TRIANGLE_STRIP **连续色幕**被整体拖走; 我们每节点独立 moveTo/lineTo 短线段 (L553-556) → 纤维束感, 非"整幅软色雾"。与 Fidenza"细描线代替 fat ribbon"同型 |
| **笔宽 5→1 递减 ("thick→thin as it dries")** | **INVENTED DETAIL**: `lineWidth = P.lineWidth*(5-4s/STEPS)` (L552) — 原作无笔宽渐变 (宽度由 min/maxDist 节点密度维持), 干燥变细是我们发明的 |
| 角度场 | 偏差 LOW: 我们 `noise*2π + π/4` 恒加 45° 偏置 (L546) — 原作 `angleAmp(2-6)*π*noise` 无常数偏置; 小号 INVENTED |
| 颜色 | 对上: `continuousPalette(colors, n.t)` 沿节点参数 t 连续插值 (L550) — 笔记设计的 recipe 适配, 成立 |
| alpha 层次 | 对上: 恒定低 alpha 累积 (L543) — 对原作 age-fade 的合理简化; SUBTRACT 混合未仿 (Canvas 下合理) |

**严重度: MED** (笔记: 余弦板以偏概全; 家族: 线段代色幕 + 2 处 invented)

---

## L05 Apparitions (Penne, #28) — 笔记全 ✅, 家族 LOW (最佳对照)

### claim 核对

| claim | 判定 | 证据 (L05-28.js) |
|---|---|---|
| hti: 32 × 0-255 全字节 | ✅ | `hti`: 32 × slice(2+2e,4+2e) → parseInt 16 |
| mv(i,min,max) = map(byte,0,255,…) | ✅ | `mv=(e,v=0,c=1)=>map(rv[e],0,255,v,c)` |
| 色板链 ~30 区间; 白 0.5%/黑 0.5%/HSB 1% | ✅ | mv(1) 三元链共 **29 个分支**: `<.005→[cw]`, `<.01→[cb]+dk`, `<.02→HSB 特殊 colorMode(HSB,360,...)`, `<.1→黑白`, … else ew 大杂烩 |
| gg(xd,yd) 网格; xd 列 × yd 行 | ✅ | `v.xd=mv(2,100,300)` 列 / `v.yd=mv(3,600,700)` 行 |
| dal: 每行 curveVertex, x/y 各自噪声位移 (xa/ya × xo/yo) | ✅ | `x_=...map(noise(c*xo, j*yo),0,1,-xa,xa)`, `y_=...±ya`; xa/ya=0.1-0.3×width, xo=.002-.005, yo=.005-.03 |
| sxn/syn 开关 → 2×2 性格 | ✅ | mv(16): <.6 both false / <.7 both true / <.8 (F,T) / else (T,F); sxn→noise(c·xo) 仅按行, syn→noise(j·yo) 仅按列 |
| 色带分块: 每 bd 行重选 tic/tac, 行内 lerp | ✅ | `i%v.bd==0 && (tic=…,tac=…)`; `stroke(lerpColor(tic,tac,i%bd/bd))`; bd=int(mv(8,10,200)) |
| 影线 #1111 微偏移先画 | ✅ | `v.sw&&(…stroke("#1111"), dal(gd,i,.004*height)…)`; dk 模式用 "#EEE1" |
| 蒙版底 rect/ellipse | ✅ | `v.bk = mv(9)<.5?"r":"e"` |
| 4.7KB | ✅ | 4659 bytes |

### 家族对照 strata-lines (registry.js L574-616, recipe-only, attribution L3011 ✅)

| 维度 | 判定 |
|---|---|
| 平行线束 + 噪声垂直位移 | 对上: 34 行, `dy=(noise(px*FREQ, r*0.09)-0.5)*2*AMP` (L599) — 即原作 sxn/syn=false 主模式 |
| 色带分块渐变 | **精确对上**: `r%BAND===0 重选 c1/c2` + `lerpColor3(c1,c2,(r%BAND)/BAND)` (L589-594) — 与原作机制逐字同构 |
| 影线 | 对上: 深色 understroke 先画、+2.5 偏移、低 alpha (L603-605)。差异: 主线 1.4× 粗于影线 (原作同宽), 影线色用 silhouetteColor 非纯黑 — LOW |
| 未仿项 | x 向位移 / curveVertex 平滑 / 蒙版底形 — 均为尺度级简化, 不涉签名 |

**严重度: LOW** (batch 内最忠实的一组)

---

## L32 Dreams (Bagley, #89) — 笔记 MED ×1

| claim | 判定 | 证据 (L32-89.js) |
|---|---|---|
| **视觉 "抖动渐变填充的梦境色块"** | **❌ (MED)** | 脚本里没有任何抖动/渐变填充机制: draw() 两遍 — 先 `noFill()+stroke(r.c)` 描轮廓、再 `fill(r.c)+noStroke()` 平涂, 每个四边形**单色 flat fill**。渐变感只来自 `c1=c[d%c.length]` 深度轮换的相邻色块。"抖动渐变"疑与 Bagley 其他作品混淆 |
| max-run 受限随机序列 | ✅ | `u==p?t++:t=0, t>2&&(u=0==p?1:0,t=0), L.push(u)` — 逐字吻合 |
| 嵌套稀有度 `cs = 5==ri(0,150)?9:ch([5,15,10])` | ✅ | 逐字吻合; ri(0,150) 均匀 151 值 → 1/151; cs=9 → `C=shp(C)` + `c=C[cv]` 全板混色 |
| 全 13 板 | ✅ | C 数组数得 13 组色板 |
| 扭曲四边形递归 (四角点传参) | ✅ | `sd(p1,p2,p3,p4,…)` 任意四边形; 分割点 `a1=.5+mn(p1.x,p1.y,A)` 噪声扰动, 整树继承 |
| "13 组**具名**调色板" | 🔍 | minified 里色板是匿名数组, 名字读不出 (可能存在于未混淆源) — 不判错 |

**严重度: MED** (视觉机制描述与代码不符; 三个 idiom 全部精确)

---

## L36 Frammenti (Contiero, #72) — 笔记 ✅ 为主, LOW ×1

| claim | 判定 | 证据 (L36-72.js) |
|---|---|---|
| Z() = WCAG 相对亮度 (0.2126/0.7152/0.0722 + sRGB 线性化) | ✅ | `v<=.03928?v/12.92:((v+.055)/1.055)^2.4` + `.2126a[0]+.7152a[1]+.0722a[2]` — 教科书级吻合; 且用 WCAG 对比率 `(max+.05)/(min+.05)`, `while(n<3)` 换色 — 笔记 "亮度差校验低于阈值自动换" 完全成立 |
| 32 槽位: a[4]<64, a[8]→板 | ✅ | `f={a:a[4]<64, b:q(a[8],0,P.length),…}` |
| "a[11]→密度" | ⚠️ LOW | `f.d=z(a[11],.03,.16)` 实为**边距比例** (`w=t-t*f.d*2` 画幅内缩); 密度类参数在 f.g/f.i/f.k/f.l |
| 4.7KB 全功能 | ✅ | 4704 bytes |

**严重度: LOW**

---

## L47 Chromie Squiggle (Snowfro, #0) — 笔记 MED ×1

| claim | 判定 | 证据 (L47-0.js) |
|---|---|---|
| tokenData.hashes 复数, 32 槽位 × N hashes 入池 | ✅ | L1-10: `numHashes=tokenData.hashes.length`, 双层循环全部入 decPairs。⚠️ 微: 实际消费只有 decPairs[0..31] (首个 hash), 其余入池未用 |
| HSB 步进 | ✅ | `colorMode(HSB,255)`; `hue=((color/spread)+startColor+index)%255` 逐点步进 |
| **"正弦 y 偏移"** | **❌ (MED)** | y 不是正弦: `y = curvePoint(map(decPairs[j],…), map(decPairs[j+1],…), …, t)` (L55) — **Catmull-Rom 样条穿过 hash 字节映射的控制点**。波形本身就是 hash 的可视化 (decPairs[j] 直接当振幅), 这比"正弦"更强地支撑笔记自己的 provenance 论点, 写错反而亏了 |
| spread trait | ✅ | `spread = decPairs[28]<3 ? 0.5 : map(…,5,50)` (1.2% 超密彩虹) |
| "槽位即 trait" | ✅ | reverse/slinky/pipe/bold/segmented 全部 decPairs[22..31] 阈值 (L24-30) |

**严重度: MED** (机制讲错; 谱系/历史 claim 与脚本一致)

---

## L49 Elevated Deconstructions (luxpris, #7) — 笔记 ✅ 为主, LOW

| claim | 判定 | 证据 (L49-7.js) |
|---|---|---|
| 32 槽位 | ✅ | L3-5 循环 32 (实际消费 decPairs[0..20]) |
| multiplier = width/2400 分辨率无关 | ✅ | `multiplier = width/2400` (L19), 全部尺寸乘 multiplier |
| 3.1KB 全语料最小 | ✅ | 3072 bytes |
| "三五个形块的悬浮平衡 / 少量形块放置=全部" | ⚠️ LOW | 实际内容: 4 束平行线 (5-15 次重复偏移) + 同心圆簇 + **一个 `drawingContext.shadowBlur=40` 软阴影大圆** + **7500×multiplier 条粉色发丝线纹理**。"形块"是不准确的; shadowBlur (原生 canvas API 入 p5) 与发丝纹理是值得记的细节, 笔记漏了 |
| seed 取 hash.slice(48,64) (尾 16 字符) | — | 笔记未 claim; 记录: 与常见 slice(0,16) 不同 |

**严重度: LOW**

---

## 汇总

| 课 | 笔记 | 家族 | 总严重度 |
|---|---|---|---|
| L01 | ⚠️ 网格行数 (LOW) | meadow-streaks: fill→stroke (VOICE) | MED |
| L03 | 全 ✅ | block-mosaic: 逐 cell 描边→网格感 (VOICE) | MED |
| L04 | 余弦板以偏概全 + 画法描述不精确 | wash-flow: 线段代色幕 (VOICE) + 笔宽taper/角度偏置 (INVENTED) | MED |
| L05 | 全 ✅ | strata-lines: 全维度对上 | LOW |
| L32 | "抖动渐变填充"无代码依据 | — | MED |
| L36 | a[11]=边距非密度 (LOW) | — | LOW |
| L47 | "正弦 y 偏移"错, 实为 hash 字节 Catmull-Rom 样条 | — | MED |
| L49 | 视觉 gloss 不准 + 漏 shadowBlur/发丝纹理 (LOW) | — | LOW |
