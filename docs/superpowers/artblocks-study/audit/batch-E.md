# 二读审计 — batch-E (L09 / L26 / L33 / L41)

方法: 逐 claim 对照链上原文 (scratchpad/ab-scripts/) + registry.js 家族函数。
判定尺度按 brief: 刻意简化不算错; 只标 VOICE MISS / INVENTED DETAIL / 笔记事实错误。

---

## L09 Cytographia — Golan Levin (#487) · 家族 nib-flourish · 总评 MED

### Claim 核对表

| # | 笔记 claim | 判定 | 证据 (L09-487.js) |
|---|---|---|---|
| 1 | shader 材质部门: frag_paper / frag_blur / frag_comp | ✅ | 三个变量均存在。frag_paper = 程序纸纹 (uNoiOff/uGLNoi/expSg/elW 噪声整形); frag_blur = 可分离 blur (uTexelSize/uBlur); frag_comp = overlay 混合合成, 含 `U sampler2D texRevTxt; U F uReverseTextAmount` = 背面文字透印 (笔记的"水印") |
| 2 | 笔尖 vertex shader: 宽度 = 基宽 × nib(方向 vs nibAngle, nibStrength) × iqPerlinNoise6 | ✅ | vertex shader main: `F orientation=aPosition.z; ... F noise=iqPerlinNoise6(noiseFrequency*noiPos)-0.5; F th=zoom*thickness*(1.+noiseAmplitude*noise); F ns=nibStrength*0.5; th*=((1.-ns)+ns*cos(2.*(orientation+nibAngle))); px+=th*cos(orientation); py-=th*sin(orientation)` — 三因子乘法结构逐字吻合 |
| 3 | iqPerlinNoise6 = 6 倍频噪声 | ✅ | `for(int o=0;o<6;o++){f+=iqNoi(uv)*ampl;ampl*=noiseFalloff;uv=m*uv;}` m=mat2(1.6,1.2,-1.2,1.6), 经典 IQ fbm |
| 4 | StyledPolyline 是书法渲染载体 | ✅ | class StyledPolylineRenderer: `drawStyledPolyline(...)` setUniform("nibAngle",n)/("nibStrength",f) → `displayShaderTriangleStrip` — 填充三角带, 非描线 |
| 5 | stamp corrupter | ✅ | `frag_corrupterb64`(base64 GLSL) → `shaderStampCorrupter=ogCorruptedStamp.createShader(...)` |
| 6 | asemic 字形系统 | ✅ | `makeAsmSys()` + "asemic" ×3 |
| 7 | 细胞/blob = "converge 增长算法 + 相交检测" | ⚠ | **converge() 不是增长算法** — 它是 marching-squares 等值线追踪器里的边二分收敛步: getFieldAtPix 四角位掩码 (i\|=1/2/4/8) 走格, converge 在 cell 边上二分逼近等值点, 失败信息 `"FAILURE: blob with "+d`。blob 来自隐式场取等值线, 不是 converge "长"出来的。checkIntersection (线段相交) ✅ 存在 |
| 8 | CC BY-NC 4.0 | 🔍 | 脚本内无 license 文本 (来自 AB 元数据, 无法从脚本核) |

细节 nuance (不扣分): shader 里 orientation 是每顶点的偏移法向角 (aPosition.z), 不是行进方向; cos(2θ) 周期 π, 与"行进方向 vs 笔尖角"表述只差 π/2 相位, recipe 级等价。噪声按空间位置采样 (noiPos), 不是沿路径参数。

### 家族对照 nib-flourish (registry.js L805-859)

| 维度 | 对照 |
|---|---|
| 形状构造 | ✅ 对上: 沿路径逐点算半宽 → 左右偏移成飘带多边形 **填充** (L836-856) = 原作三角带填充的 canvas 等价, 无 Fidenza 式细描线问题 |
| nib 因子 | ✅ `0.25+0.75*|sin(qa-nibAngle)|` (L842) vs 原 `(1-ns)+ns*cos(2(θ+nib))` — 同为周期 π 的方向调制族, voice 保住 |
| 噪声呼吸 | ✅ `0.6+0.4*noise(phase+k*0.3,...)` (L843) — 沿路径参数化 vs 原作空间场采样, recipe 级等价 |
| 一支笔 | ✅/⚠ `nibAngle = rand()*π` 全画一支笔 (L811); 原作 nibAngle 是 drawStyledPolyline 的逐调用参数, 可以每类笔画不同。缩小版一支笔合理 |
| **端点 taper** | **INVENTED DETAIL (LOW)**: `taper=sin(π·t)` 两端收尖 (L841) — 原 shader 无弧长 taper (顶点只知 orientation, 不知 t)。与 Fidenza 半圆端帽同类: 我们发明的收尾 |
| 颜色/alpha | 设计决定: 主题色 + alpha≤0.22 (L850) vs 原作黑墨 `fill(0,0,0)` — 允许 |
| Attribution | ✅ L3023: after Cytographia / Golan Levin / #487 recipe-only |

**严重度: MED** — claim 7 "converge 增长算法" 讲错机制 (等值线追踪 ≠ 增长); 家族发明了端点 taper (轻)。核心 idiom (宽度=方向×呼吸的函数) 逐字核实成立, 笔记的"一句话学到的"站得住。

---

## L26 Spaghetti Bones — Joshua Bagley (#456) · 家族 growth-loops · 总评 MED

### Claim 核对表

| # | 笔记 claim | 判定 | 证据 (L26-456.js) |
|---|---|---|---|
| 1 | G.grw/G.org/G.mve/G.rsp 四方法 | ✅ | class DiffG 均有 |
| 2 | cohesion: 点吸引邻居 | ✅ | org(): 相邻点弹簧 (`f=map(m,0,this.d,-this.dmod,0)`) + 向 prev/next 中点吸引 (`f=map(m,0,this.d,0,5*this.dmod)`) |
| 3 | separation + quadtree 加速 | ✅ | org(): `this.dat.q(are,fnd)` 范围查询 → 逐个排斥 (`fr=constrain(map(m,0,this.d,this.dmod,0),...)`); class Q 内注 `"ty Daniel Shiffman"` |
| 4 | "线段过长即中点重采样" 是生长规则 | ⚠→❌ | **原作生长不看线段长**: grw() 插中点的门槛是**局部密度** — `this.dat.q(a,f,8); f.length<7 && nP.push(中点)` + age<agx + 窗口内 + 轮转偏移 ofr。"过长即分裂"只存在于 ext()/exts() (初始化 + 显示平滑用)。笔记把**我们家族的机制**说成了原作的 |
| 5 | rsp() = 重采样 | ⚠ | rsp() 实为**再激活**: 找低密度点 (`f.length<30`) 把一段 age 归零 (重新可生长), 不动几何。命名误导, 笔记跟着误读 |
| 6 | spd 自调速 "快进无聊段慢放涌现段" | ⚠ | 机制是 **fps 自适应**: `f>58&&FS>25?spd++ : f<10?spd=1 : f<49&&spd--` — 渲染便宜就快, 重就慢。效果近似笔记说法, 但导演依据是帧率不是形态 |
| 7 | ded 死亡重生 | ✅ | `(TT>20||ded)&&...G.gan()`; gan() 扫 400px 网格找空 cell → ini() 新环; 全满 `done=!0` |
| 8 | NP 计数出芽 | ⚠ | NP 计生长 tick; `NP>50&&(CNT<10&&(ded=!0))` = **停滞检测**触发重生, 不是出芽计数 |
| 9 | 15KB / p5 纯 2D | ✅ | 14.6KB, 无 shader; PRNG 是 xorshift128 `"ty Piter Pasma"` (未 claim, 记档) |

### 家族对照 growth-loops (registry.js L1658-1766)

| 维度 | 对照 |
|---|---|
| 三规则 | ✅ cohesion 0.12 (L1707-08) / 网格代 quadtree (L1692-98, cell=repelR, 3×3 邻域) / segMax 9 重采样 (L1674-89) — 与笔记 port 描述一致。注意: 家族的"过长分裂"其实更接近教科书 DiffG, 原作反而是密度门控出芽 — 差异已被 claim 4 的笔记错误掩盖 |
| 快照年轮 | ✅ snapEvery 存轮廓淡描 (L1739-41, L1752-57) — 原作历史来自 PG 持久缓冲的自然累积 (从不清除), 快照是合理缩小 |
| **渲染层** | **VOICE MISS (MED)**: 原作从不 stroke 轮廓 — dsp() 沿平滑片段**盖点** `PG.circle(p.x,p.y,cs)`, 尺寸两端 taper (swp/mxs), `R()<ran` 随机跳点淡出, 多帧累积成骨质/珊瑚的体积感; 颜色按片段长度映射进洗牌调色板 + cm() 色相偏移 + 多环多色。家族 = 单色细描线 + 淡填充 (L1759-64)。点彩累积质感是"Bones"的命名级签名, 细描线代之 ≈ Fidenza 细线代 fat ribbon 先例 |
| 多环 | 允许的简化: 原作 gan() 不断重生填满画布, 家族单环 (元素更少 = 设计决定) |
| Attribution | ✅ L3039-43 |

**严重度: MED** — 笔记 claim 4/5/8 把生长调度机制讲得不准 (密度门控出芽被说成长度重采样; rsp/NP 语义错位); 家族渲染层丢了点彩累积签名 (VOICE MISS, 但 decor 尺度可辩护)。

---

## L33 Memories of Qilin — Emily Xie (#282) · 家族 torn-paper · 总评 HIGH

### Claim 核对表

| # | 笔记 claim | 判定 | 证据 (L33-282.js) |
|---|---|---|---|
| 1 | 加权 trait 表 `[["Sweep",68],["Focal",11],["Offset",12],["Vertical",6],["Flock",3]]` | ✅ | `const i=[["Sweep",68],["Focal",11],["Offset",12],["Vertical",6],["Flock",3]]` 逐字吻合 |
| 2 | 每板每色 [hex,weight] 含 weight 0; 每板专属纹理色 | ✅ | 如 Sea Dune `clrs:[["#757575",10],["#4e5864",0],...]`; weight 0 无法被加权抽样 p() 选为主色 b=N(), 但 z() 均匀抽仍可选 → "偏置不禁止"成立; `textureClrs` 每板 {pattern:[{bg,stk},weight]} ✅ (笔记写"textureC", 实名 textureClrs) |
| 3 | **撕纸边 = 双尺度噪声 (慢起伏+细毛刺) + 偶发尖锐内切 (撕口)** | ❌ | **原作没有这个机制**。纸片是 Verlet 软体 (te/re/ae 类, 内注 credit David Lu): 圆环粒子 + 弹簧约束 morph 松弛, warp() 用**单尺度**噪声场位移 (`noise(i+x*s,n+y*o)*TAU*a`), 且 `detectJagged()` (段长>0.15 判毛糙) **主动拒绝尖锐边** — 毛了就 `e-=30` 重试直到平滑。既无双尺度边缘噪声, 也无撕口内切; "撕纸感"实际来自: 图案纹理填充 + Z() 泼溅 (4 万个微三角/微矩形纤维) + $()/ee() 颗粒 + le() 噪声纸边框 |
| 4 | 双 PRNG 交替 + 1e6 预热 + 100 空转 | ✅ | sfc32×2 (hash.substr(2,32)/(34,32)), `random_dec(){this.useA=!this.useA;...}` 交替; `for(let e=0;e<1e6;e+=2)this.prngA(),this.prngB()` = 1e6 次调用; `for(let e=0;e<=100;e++)_.random_dec()` ✅。另档: I() 里 `f=3e3-颜色数` 补齐 PRNG 调用次数到定额 (调用数归一化, 笔记未提, 值得记) |

### 家族对照 torn-paper (registry.js L1488-1544)

| 维度 | 对照 |
|---|---|
| **形状构造** | **INVENTED DETAIL (HIGH, 与 claim 3 同根)**: 46 点径向环 + 双尺度噪声半径 (L1509-20) + 撕口 `d<3 → r*=0.55+0.15d` (L1521-24) — 整套边缘 recipe 是我们发明的, 原作是 Verlet 软体且**拒绝**尖锐边。作为装饰 recipe 本身能看, 但笔记把它包装成"Xie 的机制的最小实现", 系谱错了 |
| 颜色权重 | ✅ accent 三倍权重 `flatMap((c,i)=>i===0?[c,c,c]:[c])` (L1495) — 加权板的合理最小致敬 |
| squash/旋转 | ✅ 有对应物: 原作 changeFormSize(1.4,1) 各向异性缩放; 家族 squash 0.55-1.25 + rot (L1503-04) |
| 填充与描边 | ⚠ VOICE (MED): 原作 = 图案纹理 (waves/flowers/hexagons/vines... 8 种 pattern generator) mask 进片内 + 统一深色 lineColor 细描边; 家族 = 平涂 + 自身色描边。**图案纸片是 Qilin 的招牌** — decor 尺度弃纹理可辩护, 但应记档为已知 voice 损失 |
| Attribution | ✅ L3049-53 |

**严重度: HIGH** — claim 3 是笔记事实错误 (发明了原作明确拒绝的机制: detectJagged 反毛糙是铁证), 家族形状构造建在这个发明之上; 纹理填充签名未做 (MED)。权重双 claim (trait 表 + 调色板) 和 PRNG 考据全部逐字成立。

---

## L41 Ancient Courses of Fictional Rivers — Robert Hodgin (#284) · 家族 river-courses · 总评 MED

### Claim 核对表

| # | 笔记 claim | 判定 | 证据 (L41-284.js) |
|---|---|---|---|
| 1 | resampleLine / calcFlowBitangent 存在 | ✅ | 两函数均在; resample(e,r) 按 spacing 均匀重采样 |
| 2 | 河曲 = "点沿法向逃离弦中点, 弯越急逃越快" | ⚠ | 方向 = bitangent (法向), 由 `p5.Vector.cross(p,s).z<0` 定侧 ✅; 速率 = `sqrt(1-dot(t_i,t_{i+1}))*riverSpeed` — **转角越大越快** ✅; 但"逃离弦中点"是**我们 port 的公式** (registry L1272-90 ±5 窗口弦中点), 不是原作的 tangent-dot 公式。recipe 同族, 表述把两者混了 |
| 3 | 牛轭截弯: 索引远、空间近 → splice | ✅ | checkOxbows(): `for(t=e+riverCollSpacing; t<min(e+numPts/2,numPts)...) if(magSq<riverCollDistSqrd && t-e<numPts/2){ e+1..t-1 → new Oxbow; splice }` — 逐字吻合; Oxbow 对象还会 update/衰亡 (isDead → 移除) |
| 4 | "(7 处)" | 🔍 | 含义不明 — 小写 "oxbow" 恰好出现 7 次, 若指此为琐碎; 若指机制处数则不成立 (机制一处)。建议删掉这个数字 |
| 5 | HISTORY_TYPES 河道演化史 | ✅ | `HISTORY_TYPES=["SEQUENTIAL","STACKS","SHORTSTACKS","RANDOMIZED"]`; drawRiver 按类型选 cs[l] 5 色轮换 |
| 6 | trait 分类学 BIOME×5/COMP×6/CITY×4/GRID×4 | ✅ | `BIOMES=["FARMLAND","SWAMP","DESERT","ARCTIC","MOUNTAINS"]`(5); `COMPS=[...]`(6); `CITY_TYPES=["REMOTE","HAMLET","SETTLEMENT","TOWN"]`(4); `GRID_TYPES=["NO GRID","JUST DOTS","PLUSSES","DOTTED LINES"]`(4) |
| 7 | 装饰系统: 地块/建筑/宝藏图/铁路 | ✅ | plots/plotB/PLOT_TYPES, Building, TREASURE, HAS_RAILROAD/Railroad 均在 |
| 8 | MAX_PTS=700 + 索引窗口 = port 亲历教训 | ✅ (自述) | registry L1266 `MAX_PTS=700`, L1317-18 窗口 i+8..i+90。注意原作牛轭扫描窗口是 numPts/2 (半条河), 小窗口是我们的工程发明 — 笔记正确地把它标为 port 教训而非原作机制 |
| 9 | "淡出给时间: 古河道按年代淡出" | ⚠ | 原作史河道 = `lerpColor(bgColor, cs[l], riverFramePer*HISTORY_CONTRAST)` — **5 色轮换 + 向背景色 lerp**, 不是单色 alpha 淡出; 多色古河道是 Ancient Courses 的可识别特征之一 |

### 家族对照 river-courses (registry.js L1245-1376)

| 维度 | 对照 |
|---|---|
| 迁移+重采样 | ✅ 窗口弦中点变体 (L1272-95, 注释诚实记录了первая尝试的教训) + 均匀重采样 (L1306-14) + 3 点核扩散 (L1300-05, 我们加的平滑, 无害) |
| 牛轭截弯 | ✅ 索引远(≥8)+空间近(<cutoff) splice → oxbows (L1317-28), 第二色描 (L1349-54) — recipe 对上 |
| 史河道 | ⚠ MED: 单色 alpha 梯度 (L1342-47) vs 原作 5 色轮换×HISTORY_TYPE — 多色地质史签名丢失 (decor 尺度可辩护, 记档) |
| **活河渲染** | **VOICE MISS (MED)**: 原作 buildRiverGeo = 左右岸按 bitangent 偏移**噪声调制的变宽度** (`map(getNoise(S,.01),0,1,.15R,.9R)`) 合成**闭合填充带** + 日照方向偏移的 highlight/shadow 双 pass; 家族 = ±2.2 常数偏移的两条细描岸线 (L1356-74)。河读作"水体"靠的是填充变宽带 — 细双线代 fat 填充带, Fidenza 先例直接适用 |
| Attribution | ✅ L3055-59 |

**严重度: MED** — 笔记机制方向全对, 两处表述把我们 port 的公式/渲染当原作描述 (claim 2 弦中点, claim 9 单色淡出); 家族活河用双细线代原作变宽填充带 = voice miss。

---

## 跨课观察

1. **共同模式**: 三个家族 (growth-loops / torn-paper / river-courses) 的笔记都存在"用我们 port 的实现反向描述原作"的倾向 — L26 长度重采样、L33 双尺度噪声撕边、L41 弦中点逃离/单色淡出。写笔记时机制描述应先从原码取证再写 port。
2. **共同 voice 缺口**: 三个原作的"体量感"都来自**填充/累积** (点彩累积 / 纹理填充 / 变宽填充带), 三个家族都退到了细描线 — 与 Fidenza 二读发现同构, 是系统性的 decor 渲染习惯, 不是单课失误。
3. Attribution 四条全部正确 (#487/#456/#282/#284, 项目名/作者名无误)。
4. L09 笔记质量最高: shader 三因子公式、6 倍频、triangle-strip 填充全部逐字核实成立。
