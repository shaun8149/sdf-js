# ArtBlocks 二读审计 — batch-D

课程: L08 / L10 / L17 / L30 / L31 / L34 / L37 / L38
方法: 笔记 claim 逐条对照链上原脚本 (prettier 展开后阅读, `<scratchpad>/ab-scripts/pretty/`)。
家族对照: `sdf-js/src/present/decor/registry.js` (行号以当前 main 为准)。

---

## L08 Box Light Studies — Lieberman (#499) · 家族 light-edges · **MED**

### Claim 核对

| Claim (笔记 08-*.md) | 判定 | 证据 (L08-499.js pretty) |
|---|---|---|
| p5 WebGL, 41KB | ✅ | 41245 bytes; p5.RendererGL patch, createFramebuffer polyfill (L549-556) |
| 盒体几何: rotateX/Y/Z 三函数 + 棱线投影, 每棱=(ptA,ptB,colorA,colorB) | ✅ | 函数 i/a/n = 三轴旋转 (L22-42); f() 8 顶点 + 24 indices=12 棱 (L133-150); s() setUniform ptA/ptB/colorA/colorB/lineId (L72-100) |
| 多 pass fbo 链: initShader → iterShader (3×3 邻域 jump-flood) → voroShader (spiral 补洞 + 距离衰减) | ✅ | process(): fbo2/fbo3 乒乓, stepP 从 1024 逐半 11 轮 (L839-874); voroShader `spiral(int n)` 600 次搜索 + `d=mix(1.,d,dScale)` (L777) |
| **distShader (距离→亮度) 作为管线一环** | ❌ | distShader 与 drawShader 仅 createShader (L779, 783), **全文无第二处引用 — 死代码**。真实柔光 = `_` 渲染器: trace() 沿距离场 100 步 2D raymarch × 每像素 8 方向随机射线 × 累积 250 帧 (`250 < c ||` L937) 的渐进式 2D 光传输, 不是"距离直接映射亮度" |
| line shader: 沿线渐变双色 + 光晕 | ⚠️ | 双色渐变 shader D (`mix(mix(colorA,colorB,.4),…,pct)` L984) 是**弃用代码**: L152 `createShader(T,D)` 返回值未接, `z=createShader(T,C)`。活 shader C 的棱色 = 三通道 simplex noise 按 lineId 键控 + doubleExponentialSigmoid 整形 (L986); colorA/colorB uniform 永远传白/黑 (`d={a:[1,1,1,1],b:[0,0,0,1]}` L155) 且 C 不声明该 uniform |
| 稀有度: colorMode / seethrough 等 hash 决策 | ⚠️ | settings 表 (L988-995): seethrough (float 0-1) 与 look (int 0-10) 是真 hash trait; **colorMode/drawMode/palette 均 min==max, 恒为常量 1** — 真正的形态开关是笔记未点名的 `look` (11 档, 直接字符串替换进 shader L909-913) |
| 本质是 shader 作品, p5 只是宿主 | ✅ | 全部美学在 GLSL: JFA 场 + raymarch 光传输 + look 分支 BRDF; p5 只画种子线 |

### 家族对照 (registry.js `drawLightEdges` L739-796)

| 维度 | 对照 |
|---|---|
| 构图: 棱线即光源 | 对上 — 4-6 个盒, 每棱独立描 (递归写在注释里的分流判定成立) |
| 盒构造 | 偏差 (可接受): 旋转正方形 + 固定 (dx,dy) 斜移 = 2.5D 伪盒 (L751-767); 原作真 3D 旋转 + 逐盒递增转角 + 网格/线性/吸附多种摆位 (m() L192-311)。装饰尺度简化, 不算错 |
| 辉光 | 声明式近似 ✓: 宽×0.25α → 中×0.5α → 窄×全α 三层 (L780-784), 与笔记 idiom 2 一致 (笔记已声明这是 2D 近似而非原机制) |
| **颜色: 双色棱 (两半各一色, L771-778)** | **INVENTED DETAIL (间接)**: 该机制源自原作的**死 shader D**; 链上实际渲染的棱色是 noise 场渐变 (彩虹微渐变), 从不出现"两端两色"的分段。家族忠实实现了笔记的 idiom 3, 但 idiom 3 本身读的是弃用代码 |
| 碰撞/去重 | 原作有共线近距棱去重 (函数 l, 阈值 5/0.01, L117-132) + X 模式 3-7 段随机切分; 家族无 — 装饰尺度可接受 |

**严重度 MED**: 笔记两处渲染层机制错误 (distShader 死代码当活 pass; 双色渐变 shader 死代码当活机制), 一处稀有度不精确 (colorMode 恒定, 漏掉真开关 look)。家族视觉方向 (棱=光, 分层 glow) 成立; "双色棱"是踩在死代码上的发明细节, 但装饰效果无害。

---

## L10 while true — Wander (#498) · 家族 hex-lattice · **LOW**

### Claim 核对

| Claim | 判定 | 证据 (L10-498.js pretty) |
|---|---|---|
| 原生 WebGL 23.7KB | ✅ | 23714 bytes; WebGL2 (`#version 300 es`) |
| cubic→cartesian: x'=√3·(x+y/2), y'=1.5·y, RT3=√3 | ✅ | vertex shader `const float RT3 = sqrt(3.0)`; `cubic_to_cat: vec2(RT3*(o.x+0.5*o.y), 1.5*o.y)` (L841) — 逐字符合 |
| vertex 只做实例化摆放 | ✅ | apply_tfm: axial→cubic (q,r,s=-q-r), w<0 翻转, rotate_k 绕 normalize(vec3(1)) 转 (L841); tfm/col 均 per-instance attribute + vertexAttribDivisor (L971-979) |
| fragment 只做 OKLab→sRGB | ✅ | fragment 全文 = oklab2rgb + rgb2srgb (L842), 无其他逻辑 |
| class G random tape: 预抽 I 个 float, float(t,min,max)→[下一游标,值] | ✅ | class G (L876-900): `values=Array(I).map(()=>l.float())`; `float(t,s,e)` 返回 `[this.step(t), i*(e-s)+s]` — 显式游标、引用透明, 完全符合 |
| (补充发现) | — | 磁带长度 I = `[2048,2048,2048,2048,8][h.int(5)]` (L186): 4/5 概率 2048, **1/5 概率仅 8** — 短磁带循环复用是一个笔记未记的 trait 杠杆 |

### 家族对照 (registry.js `drawHexLattice` L911-958)

| 维度 | 对照 |
|---|---|
| hex 数学 | 对上: `RT3*R*(q + row%2*0.5), 1.5*R*rr` (L930-931) — odd-row offset 形式 ≡ 立方坐标规范式 |
| OKLab lerp | 对上: rgbToOklab/oklabToRgb (L873-898) 常数与 Ottosson 参考及原作 shader 一致; lerpColorOklab 沿种子化方向打渐变 (L935-939) |
| 分布 | 声明式: noise gate >0.52 稀疏留白 (L932-933) + (q+rr*3)%4 选择性填充 — 笔记 port 判定写明"六边形铺陈+OKLab 渐变+种子化稀疏填充", 家族=自己的 recipe, 成立 |
| 形状构造 | 偏差 (可接受): 家族描 hex 轮廓线+偶尔填充; 原作从不描 hex 边框 — 它在格上实例化填充图案件 (三角形细分 subs)。recipe-only 下的自由发挥, 无签名丢失 (原作签名=感知均匀渐变+hex 织物, 家族保住了两者) |

**严重度 LOW**: 全部 claim 被源码逐字证实 (含 RT3、游标返回形状)。

---

## L17 Cargo — Asendorf (#426) · 家族 cargo-dashes · **LOW-MED**

### Claim 核对

| Claim | 判定 | 证据 (L17-426.js pretty) |
|---|---|---|
| 管线三段 C2dImage → c2dMotion → gl.render | ✅ | L1 `const C2dImage`, L1742 `const C2dMotion`, L1625 `render = renderFeedback + renderDraw`; 主循环 L1874-75 |
| 画家字典 dashed[0..7], 每个 (x,y,w,h)=>{} 闭包 | ✅/⚠️ | dashed[0..7] 确实存在 (L12-96: 4 横 + 4 竖)。但它只是 **8 本字典之一**: dashed/noise/grid/boxes/area/framed/rectangle/gradient 各 ~8 画家 (drawSymbol switch t=0..7, L904-938), 共 ~64 画家 + 8 种抽签策略 (case 0-7 含 rythm 计数器) + 9 种切块结构。笔记把"虚线字典"当唯一美学根基, 以偏概全 |
| 2 的幂行距 yStep = 2^random_int(0,2) | ✅ | L14 `let yStep = pow(2, R.random_int(0, 2))` — 逐字 |
| 整数 dash [1..8, 1..8] | ⚠️ | dashed[0]/[4] 逐字符合 (L15/57); 但 dashed[1]/[5] 用 [1..8,1..16] 四组轮换, dashed[2]/[6] 用 [1..4,1..16], dashed[3]/[7] 用 [1..2,1..16] — 参数空间比笔记写的大一倍 |
| pixel-sorting 退为 GPU 运动层 | ✅ (recipe 级) | 运动 = cellular-noise 位移 (r 通道 8 bit 各控一档频率) + reset 图案 (g 通道) 的 feedback shader (L1592), 控制图由 C2dMotion 按 rect 涂 RGB (L1830-38)。不是字面 pixel-sorting, 笔记措辞"退为运动层"成立 |
| 静态构图可 port, 运动层不 port | ✅ | 构图全在 Canvas2D (C2dImage.draw → getImageData L1403) |

### 家族对照 (registry.js `drawCargoDashes` L1091-1167)

| 维度 | 对照 |
|---|---|
| 画家 4 本: 横虚线/竖虚线/疏点线/淡实面+框 | 对上: 分别对应 dashed[0] / dashed[4] / dashed[3] (疏点 [1..2, 长 gap]) / framed·rectangle 族 (原作有实面+框画家, L450/594 验证) |
| 2 的幂行距 | 对上 (放大 ×2 适配装饰尺度): `pow(2, 1+rand*3)*2` (L1099) |
| 整数 dash | 对上: `[1+rand*8, 1+rand*8]` (L1100) — 取的是 dashed[0] 的字面参数空间 |
| 切块 | 对上 (简化): 行 × 随机切点 (L1147-1158) ≈ 原作 drawStructureColumns/subdivRows 的行式结构 |
| 人格 = 字典开放页数 calm2/balanced3/wild4 | 对上: CARGO_PERSONALITIES painters 2/3/4 + `.slice(0, B.painters)` (L1086-88, 1144) |

**严重度 LOW-MED**: 家族维度全对上; 唯一实质不精确是笔记把 8 本字典 ~64 画家收窄成"一本 dashed 字典 8 画家" — recipe 结论 ("字典×抽签是复利资产") 反而被更强地支持, 但事实陈述以偏概全。

---

## L30 phase — Bednar (#143) · 无家族 · **CLEAN (LOW)**

| Claim | 判定 | 证据 (L30-143.js pretty) |
|---|---|---|
| 管线署名 drawArt → blurArt → blendArt → compositeArt → renderFinal | ✅ | 五个函数逐名存在 (L458/479/501/526/547); 主循环按此顺序调用 (L888-908) |
| 自带 compileShader 工具函数 | ✅ | L448 `function compileShader(e,t)` — 被 6 处 shader 编译复用 |
| 零 p5 几何调用 (rect/line 均 0) | ✅ | 全文无 `rect(`/`line(` 绘图调用 (grep 0 hit); 条纹在 artFragmentShader 里算 |
| blur-then-blend (模糊是混合前置件) | ✅ | phaseLevel switch: `blurArt(target, target2, 0..3)` 先行, `blendArt` 随后 (L890-906); phaseLevel=4 档直接 blend 不 blur |
| hexToHSV / HSLtoHSV 双色彩空间桥 | ✅ | L391 `function hexToHSV`, L431 `function HSLtoHSV`, palette 处理 L367 |

**严重度 LOW**: 五条全部逐字证实, 无家族。文档课判定 (条纹柔度住在 GPU pass 链, 不 port) 与源码一致。

---

## L31 Subscapes — DesLauriers (#53) · 无家族 · **CLEAN (LOW)**

| Claim | 判定 | 证据 (L31-53.js pretty) |
|---|---|---|
| 内嵌完整 oklab→sRGB 矩阵 | ✅ | L21-42: l_/m_/s_ 系数 0.3963377774/0.2158037573… + 输出矩阵 4.0767245293/-3.3072168827/… (输入实为 OKLCH: L/100, C·cos(H°), C·sin(H°) — 比笔记说的还多一层 LCh 包装, 不矛盾) |
| 2021 年即采用 (比 L10 早两年) | 🔍 | 脚本本身无日期; #53 项目号与公开铸造时间一致, 采信但源码不可证 |
| BSP 切向由块的 o/c (宽高比) 加权 | ✅ | L74: 切向 = `((e=1,t=1)=>0.5>oe()/d(e,t))(o/c, f)` — **变量名就是 o/c** (o=宽 c=高, L53-54), 随机数除以 pow(宽高比, f) 决定横竖 — 高块竖切宽块横切, 逐字证实 |
| min-size 停机在 filter 里 (s 谓词), 剖到极限的块静默丢弃 | ✅ | L78 `e.C = t.filter(s).map(…)`; s = `f>=n && o>=n` (L81-86) — 谓词名也是 s。子块不合格即整支丢弃 → 自动留白 |

**严重度 LOW**: 三条可核 claim 全部到变量名级别证实。

---

## L34 Gazers — Kane (#215) · 无家族 · **LOW**

| Claim | 判定 | 证据 (L34-215.js pretty) |
|---|---|---|
| 每帧 uD = new Date, 时/分/秒/月/日全入渲染参数 | ✅ | draw() 开头 L44-49: uD/hR/mI/sZ/mH/dY; 光位 lX/lY 由 时+分 映射 (L64-71) |
| 真实月相驱动构图 (gMN=月相计算) | ✅/⚠️ | 月相真实: `lc = 2551443` 秒 = 朔望月 (L1791); gLP() = (距参考新月时间 mod lc)/86400 映射到 0-8 相位 (L1379-1390); gNP() = 距新月秒数/lc (L1044)。**但 gMN 是月亮绘制例程 (L145), 月相计算是 gLP/gNP** — 函数名张冠李戴, 机制本身对 |
| 跨年夜彩蛋 `11==mH && 31==dY && 23==hR` 时 map 分钟做过渡 | ✅ | L57 逐字: `nY = 11==mH && 31==dY && 23==hR ? map(mI,0,60,0,0.2) : 0`; nY 驱动 frameRate+300·nY 加速 (L133) |
| URL hash 参数覆盖 location.hash.split("\|"), 身份/视图两层分离 | ✅ | L53 `aR = window.location.hash.slice(1).split("|")`; aR[4] 显示模式, aR[9] mN, aR[10] 亮度 fR, aR[7]/[8] 光位覆盖 — 全是视图参数, tokenHash 身份不动 |
| 午夜整点触发 sDY() 重算 | ✅ | L52 `1==sP && 0==hR && 0==mI && 0==sZ && sDY()`; sDY 按距参考日天数重放 seed 流 (L410-424) |
| (笔记未记的 trait) | — | 参考"新月"日期 nM 按稀有度从 Kane 个人纪年里选 (theDream/firstSale/firstOnePersonShow…, L861-875 + L1650-58) — 传记日期作 trait, 有趣但不影响审计 |

**严重度 LOW**: 唯一瑕疵是 gMN 函数名指认错位 (⚠️ 表面级)。三层时钟论点 (氛围/构图/事件) 被源码充分支撑。

---

## L37 The Blocks of Art — Shvembldr (#74) · 无家族 · **HIGH (笔记事实错误)**

| Claim | 判定 | 证据 (L37-74.js pretty) |
|---|---|---|
| 95×110 固定面板 | ✅ | L17-18 `panelWidth = 95*M, panelHeight = 110*M` |
| makeHex 六角点集工具: 60° 步进一圈 | ✅ | L10-13 `r += 60` (angleMode DEGREES); 起始角 30° |
| 量产纪律: 同一 panel 引擎变造型库 (things) | ✅ | things = 从 f 数组 (thing0/thing1/… 多造型函数+参数包) 随机分配 (L323-325); 每帧 `things[t].thing(back, time, params)` (L335-337) — 且是**动画**的 |
| **"面板网格, 每格一件带边框独立小作品; backs/things/images 三层结构"** | ❌ | **构图不是平面面板网格, 是错行 hex 格上的等距立方体 (isometric cubes)**。证据: makeHex 造 5×4 错行六角格 (L49-60); draw() 里每个 hex cell 画**三张剪切面**: `shearY(30)` 顶/左面、`shearY(-30)` 右面、`shearY(30)+shearX(-41)` 第三面, 各自 clip 后贴一张 95×110 面板 (L338-363)。**images 不是"层" — 是每块立方体的三张脸**: `images = backs 三张一组` (L327-330)。backs=离屏画布, things=画家, images=三面组。标题 "The Blocks of Art" 的 Blocks 是字面义: 积木块 |
| 格内自治 + 格间秩序 | ⚠️ | 精神成立 (每面确实是独立动画小作品, 面有 stroke 边框 L340-341), 但"画廊挂画"读法漏掉了核心视觉身份: 挂的不是画, 是转印在立方体三面上的画 |

**严重度 HIGH** (按判定尺度: 笔记讲错了原作机制): "三层结构"与"面板网格"是对构图的误读 — 原作是六角格等距立方体阵, images 是立方体的三张脸不是三个图层。无家族继承, 损害封闭在文档层; panel-as-mini-canvas 这条 idiom 本身仍然成立 (以"面"为单位)。建议笔记改写分流判定段。

---

## L38 Ringers — Cherniak (#13) · 家族 peg-wraps · **HIGH**

### Claim 核对 (字符串数组混淆, 经查表解读)

| Claim | 判定 | 证据 (L38-13.js pretty) |
|---|---|---|
| 骨架: pegs 网格 + getTangents + pAlg + shrinkConcavePegs + connects | ✅/❌ | 名字都在字符串表 (L1-64); **但 pAlg 不是"缠绕算法"** — `ps.pAlg = rp[7]<220 ? G_ALG : R_G_ALG` 选的是**钉子布点算法**: pOnGrid (规则网格 gridD 3-6, L237-249) vs pOnRGrid (递归细分网格, L250-262)。缠绕算法在 Ring.generate (L343) |
| 构图即排列: 一个访问排列 + 每钉侧别 | ⚠️ | 不是自由排列: points = 全部钉洗牌后取 sampleRate (0.5-0.8) 的**子集** (sampleSize L296-300), 然后**按绕质心的极角排序** (`this.points.sort` 按 atan2 差, L355-368, forceCentroid 可移质心 L154) — 访问顺序是确定性的角排序, 组合空间的结构 = 子集 × 参数, 不是排列 × 侧别序列 |
| 切线几何: 同半径圆外切线 = 圆心连线垂直偏移 ±R; 异侧走内切线出交叉 | ⚠️ | getTangents (N(171), L450-476) 是**完整的双圆 4 切线通解** (外 c=1 / 内 c=-1), 支持不等半径 — 且半径确实会变: vRad = BIGGER_NEAR_RAD/BIGGER_FAR_RAD 按离画布中心距离缩放钉半径 (L159-168), C_RAD 恒定只是常见档。切线选择由**凹凸性**驱动: isConcave 来自相邻钉叉积 (L369-386), wrapped 模式按两端凹凸组合选 l[0]/l[1]/l[2]/l[3] (L387-400) |
| 绳是主角: 钉画静点, 绳 arc+tangent 交替一笔连续 | ✅ | Ring.draw: beginShape → 逐弧采样 vertex (100·width/800 步) → 切线端点 vertex → endShape (L312-342); strokeWeight 8 (参考宽 800) 粗绳 (L130, L144) |
| **shrinkConcavePegs: 凹侧钉半径微缩, 绳贴得更紧** | ❌ | 收缩只发生在**绘制期**: `ps.shrinkConcavePegs && s.isConcave && s.r >= 2*strokeW && (a *= 0.4)` (L200) — 缩的是画出来的钉圆直径 (×0.4), **绳的路径用原始 r 计算, 完全不动**。视觉效果是绳松松地绕在变小的钉子外围 (更"ring"), 方向与"贴得更紧"相反 |
| (笔记未记的签名) | — | ① 绳是**闭环**: 遍历 (t+1)%len 回到起点 — 项目名 Ringers 的 ring; ② 闭环可**填充** (ps.fill, 填 hlCol/secCol, L173-177); ③ **单个随机高亮钉** (g = rngFloor, 命中者用 hlCol #f2c945 等, L183-196) — Ringers 最有辨识度的 trait 之一; ④ 钉子可画同心环 (concentric, L199-221); ⑤ 32 字节 hash 逐字节直读作参数 (setupPs L263-269) |

### 家族对照 (registry.js `drawPegWraps` L1386-1472)

| 维度 | 对照 |
|---|---|
| 钉网格 + 静点 | 对上: 规则 cols×rows 网格 (L1402-1409), 钉画淡点 (L1424-1429) ≈ pOnGrid + C_RAD |
| 同半径外切线 ±R 偏移 | 对上 (同半径特例数学正确, L1441-1450); 原作是 4 切线通解+变半径 — 装饰尺度简化可接受 |
| 弯折处 ctx.arc 连续路径 | 对上: 上一切点→本切点绕钉 arc (L1451-1458), arc+tangent 交替 ✓ |
| **访问顺序: 无重复随机游走** | **VOICE MISS**: 原作是洗牌子集 + **绕质心角排序** → 绳呈现为环绕钉云的整齐缠绕带, 交叉只出现在凹钉处; 家族的自由随机顺序让绳在钉阵里乱穿, 读作 scribble 而非 wrap |
| **绳端: 开放折线 (i→i+1, 不闭合)** | **VOICE MISS**: 原作绳永远闭合成环 (Ringers 之 ring), 且可填充成实心色块 — 与 Fidenza 先例"细描线代替 fat closed ribbon"同类: 丢了闭合缠绕带这一签名形态 |
| **侧别: 逐钉严格交替 (weave = i%2, L1444)** | **INVENTED DETAIL**: 原作从不交替 — 侧别由角排序多边形的凹凸性决定 (isConcave); 交替产生的规律性内切线交叉是我们发明的机制 (视觉上近似"编织", 但节奏与原作不同源) |
| 高亮: 所有被访问钉都点亮 (L1464-1470) | 偏差: 原作只高亮**一个**随机钉 (孤点色彩是其辨识度来源); 全亮反而稀释。顺带丢了 fill/concentric 两个次级签名 (装饰尺度可谅解, 单高亮钉本可零成本保留) |
| 颜色/alpha/粗细 | 设计决定 (主题色 + intensity), 不算错; 但原作 fat rope (strokeWeight 8/800) vs 家族 `P.lineWidth*1.1` 细线, 与"绳是主角"的权重分配相悖 — 记在 voice 项下 |

**严重度 HIGH**: 笔记 2 处机制错误 (pAlg 指认错、shrinkConcavePegs 方向反) + 1 处结构不精确 (排列说), 家族丢 2 个签名特征 (闭合环 + 角排序缠绕带 → 开放随机 scribble) 并发明 1 个机制 (逐钉交替侧别)。根因链: 笔记把"排列+侧别"当参数结构 → 家族照笔记实现 → voice 漂移。修法 (recipe 级): 访问序改为绕质心角排序 + 闭合回起点 + 单钉高亮, 三改都不增加代码量级。

---

## 总结 (每课一行)

- L08 Box Light Studies — MED: distShader/双色渐变 shader 均为死代码被当活机制 (真柔光=8 射线×250 帧 2D raymarch 累积; 真棱色=noise 场), 家族"双色棱"踩在死代码上
- L10 while true — LOW: 全部 claim 到字面级证实 (RT3 公式/OKLab fragment/游标磁带); 补充: 磁带 1/5 概率仅 8 格
- L17 Cargo — LOW-MED: 管线/2^k 行距/dash 参数逐字证实; 但"8 画家字典"实为 8 本字典 ~64 画家, 以偏概全
- L30 phase — CLEAN: 五 pass 署名/compileShader/零几何调用/双色彩桥全部逐字证实
- L31 Subscapes — CLEAN: OKLab 矩阵/o-c 宽高比加权/filter 谓词 s 全部到变量名级证实
- L34 Gazers — LOW: 朔望月常数 2551443/跨年彩蛋/hash 视图层/午夜 sDY 逐字证实; 仅 gMN≠月相计算 (是绘制例程)
- L37 The Blocks of Art — HIGH: 构图误读 — 原作是 hex 格等距立方体 (三张剪切面各贴一块 95×110 面板), "backs/things/images 三层结构"里 images 是立方体三面不是三图层
- L38 Ringers — HIGH: 笔记 pAlg 指认错 + shrinkConcavePegs 方向反 + "排列"失准 (实为子集×角排序); 家族丢闭合环+缠绕带签名, 发明逐钉交替侧别
