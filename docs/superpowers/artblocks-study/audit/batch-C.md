# ArtBlocks 二读审计 — batch-C

课程: L06 / L07 / L13 / L23 / L42 / L46 / L48
方法: 笔记 claim 逐条对照链上原脚本 (scratchpad/ab-scripts/), 家族对照 registry.js。
判定尺度按 audit-brief (刻意简化不算错; 只标 VOICE MISS / INVENTED DETAIL / 笔记事实错误)。

---

## L06 Neural Sediments (Eko33, #418) — 家族 sediment-layers

### Claim 核对表

| Claim | 判定 | 证据 (原脚本) |
|---|---|---|
| 双 sfc32, hash 前后两半各喂一个 | ✅ | `this.prngA=new sfc32(tokenData.hash.substr(2,32)); this.prngB=new sfc32(tokenData.hash.substr(34,32))` (byte ~40650) |
| 交替取数 | ✅ | `random_dec(){this.useA=!this.useA; return this.useA?this.prngA():this.prngB()}` |
| 1e6 次预热 | ✅ | `for(let i=0;i<1e6;i+=2){this.prngA();this.prngB()}` (总计 1e6 次取数, 每流 50 万) |
| 自实现 Box-Muller Gaussian | ⚠️ 微 | 实为 Marsaglia polar 变体 (`do{x1=...;x2=...;w=x1²+x2²}while(w>=1)`), 即 p5 randomGaussian 的克隆; 习惯上归为 Box-Muller polar form, 表面不精确 |
| 自实现 Perlin, 用自己 PRNG 填表 | ✅ | `this.perlin[i]=this.random_dec()` 填 4096 表; 算法为 p5 noise 克隆, `perlin_octaves=1, amp_falloff=.2` (非 p5 默认 4/0.5) |
| token 0 特判固定 hash | ✅ | `if(mintNumber==0){tokenData.hash="0x8d20ecb9..."}` |
| cliff() "噪声折线 top + 高度 → 面片" | ⚠️ | top 边不是 noise(x) 折线, 是**向量随机游走**: `setHeading(displacement, truncatedGaussian(0,maxAngle,...))`, 且有 `force_backward_cliff_number → setHeading(...,radians(120))` / 140° 上限 — 可以**倒走出悬垂 (overhang)**。Perlin 只用在渲染层 (线的 alpha/摆动) |
| polygonClipping union/difference 背面剔除 + 层间遮挡 | ✅ | `cullBackfacesPoly` 用 `polygonClipping.difference(result,face)`; `fullContoursPoly` union; 背景区用 `xor(visibleContours, canvaspoly)` |
| drawFrame1/2/3, 4 帧一轮, "重计算不卡浏览器" | ⚠️ | 结构 ✅ (`frameCount%4` switch case 1/2/3)。但三帧**各自 clear()+drawScene() 重画一版不同的场景** (rd 流续走), frame2 用 `pg.blendMode(DIFFERENCE)` 复合, frame3 用 BLEND 叠 grain+cracks 版 — 分帧是**多 pass 视觉复合**, 不只是性能分摊 |
| massExport 换 hash → 重渲染 → 存图循环 | ✅ | `saveSketch(); setTimeout(()=>{tokenData.hash="0x"+Date.now()...; initInput(); redraw()},1e3)` |
| grainGraphics 颗粒后处理 | ✅ | frame3: `tint(100,.3); image(grainGraphics,...)` |
| 77KB 含 40KB polygonClipping | ✅ | 文件 77370B, 库结束于 byte ~40430 |

### 家族对照 sediment-layers (registry.js 618-676)

原版渲染层真相 (drawCliffs, byte ~72316): 悬崖面 = **白底 quad (DARKEST 混合) + 黑色波浪描边 (wrapLine) + 面内竖直黑色 hatch 线** (nLines 5-400, 直线段 10 段渐变 alpha 或 organic 逐点 point() 抖动画法); 彩色只来自**单一 watercolor 色**铺在背景区 (xor 出的非悬崖区) + 全局 grain。

| 维度 | 判定 |
|---|---|
| 层叠地平线 back→front + 前遮后 | 对上 (recipe 声明的简化: painter 序 + 近不透明 wash 代替多边形布尔, brief 允许) |
| 顶边形状 | **偏差**: 家族用平滑 Perlin `noise(px*0.0045, li*3.7)` (L657); 原版是 truncatedGaussian 随机游走折线, 棱角 + 竖直崖面 + 可倒走悬垂 — 剪影气质从"锯齿地质剖面"变成"平滑山峦" |
| 面的质感 | **VOICE MISS (MED)**: 原版的签名 = 崖面上密集**竖直 hatch 细线** (作品名 "Sediments" 的沉积颗粒感即来自此) + organic 逐点画法; 家族是纯色 solid wash (L651 `rgba(fill,0.92)`), 无任何面内纹理 |
| 顶边 hairline 描边 (L664-673) | 对上 — 原版有 `cliffBuffer.stroke("black"); strokeWeight(scl*1)` + wrapLine 波浪描边, 非发明 |
| 颜色来源 | 设计决定 (允许): 原版近乎黑白 + 单一 watercolor accent (`watercolor_color=rd.random_choice(colors)`, 14 色池选 1); 家族每层轮换主题色 |
| 分布随机性 | 对上: 层数 personality 化 (4-10 层) vs 原版 n_cliff 3-88, 缩小版合理 |

**严重度: MED** — 笔记 2 处机制不精确 (cliff top 生成方式 / 分帧的真实目的), 家族丢了"竖直 hatch 沉积纹理 + 棱角崖面"这一签名组合 (Fidenza 尺度下算 voice miss, 但笔记 idiom-1 本身就是按"山峦剪影"重读的, 属于有意重定向 — 建议 parent 裁决)。

---

## L07 INK (Iskra Velitchkova, #497) — 家族 ink-scribble

### Claim 核对表

| Claim | 判定 | 证据 |
|---|---|---|
| 自带 sfc32 Random class | ✅ | minified `class Random` (byte 9684): 同款 sfc32 (substr(2,32)/(34,32)), 同款 1e6 预热, `d()` 交替 uA — 与 Eko33 同代差特征坐实 (grep 'sfc32' 0 命中只因函数名被压成 `e`) |
| ~15 种西语命名笔法, hash 选用 | ✅ | drawMacarra/Carboncillo/CarboncilloMas/GridSuave/Ramonycajal/DomingoMercado(+Detalle)/Delicado(+Vertical)/Novia/Pelo/Maquinaria/LapizCorrido/LineasYcuadrados/... 由 `z.s` switch 分发 (`15==z.s` 等), 每笔法附 `z.f.song` 彩蛋 |
| 噪声-利萨茹核心: noise(c+sin(e)·freq)·ampX / noise(c+cos(e)·freq)·ampY | ✅ | drawCarboncilloMas: `for(let e=0;e<=TWO_PI;e+=.001){var p=noise(o+sin(e)*l)*t, d=noise(o+3*cos(e)*l)*i; ...}` — o=中心 y, l=freq, t/i=amp |
| 三遍复笔: "同一曲线画 3 遍, 每顶点独立偏移" | ⚠️ | 实现是**每步在同一 beginShape 里连发 3 个顶点** (基点 + 2 个抖动副本): `pg.vertex(a+4*p,o+4*d), pg.vertex(a+4*p+R.r(4),o+4*d-R.r(14)), pg.vertex(a+4*p+R.r(4),o+4*d-R.r(4))` — 是单笔画内的 zigzag 三重顶点, 不是整曲线描三遍; 之后常再来第二个 beginShape 全 pass (噪声相位不同)。视觉等效"复笔毛边", 机制描述不准 |
| 抖动幅度 R.r(4)~R.r(44) | ✅ | R.r(4)/R.r(14)/R.r(11)/R.r(12) 遍布; R.r(44)×3 + R.r(41)×1 存在 |
| 0.001 步进 ≈ 6283 顶点/遍 | ⚠️ 微 | 步进 0.001 ✅, 但部分循环走 `e<=2*TWO_PI` (两圈), 且每步 3 顶点 → 单 shape 实际 ~1.9-3.8 万顶点; "6283/遍"是按单顶点单圈算的下限 |
| shader 后处理颗粒 | ✅ | 文件开头即 WebGL2 GLSL: `hash(vec2)` 颗粒 + erode/dilate 滤镜组, `aeGris/aeCartulina/aeWorsePerson` 等后处理链 |
| 45KB / CC BY-NC-SA | ✅ | 45149B |

### 家族对照 ink-scribble (registry.js 678-728)

| 维度 | 判定 |
|---|---|
| 噪声-利萨茹闭环 | 对上: `rx=noise(phase+sin(e)*freq, phase)*ampX; ry=noise(phase, phase+cos(e)*freq)*ampY` (L714-715), 参数域闭合与原版同理 (原版 endShape 不 CLOSE, 靠 sin/cos 周期性闭合; 家族 closePath 显式闭合 — 等效, 非发明) |
| 复笔毛边 | 对上 (声明的降密简化): 2 遍 × 每顶点 jitter 1.5/4px (L709-710) vs 原版每步 3 顶点 + 二次 pass; 递进 jitterAmp 是合理浓缩 |
| 密度 | 对上: STEP=0.02 ≈ 314 顶点 — 笔记 idiom 4 明说 deck 降密 |
| 颜色 | 设计决定: 原版黑墨 `stroke(0,s)` + 偶发 `fill(10)` 深色实心块 (p≈0.057); 家族主题色、无实心块 — 缩小版可接受 |
| 分布 | 家族角落加权 (L698-701, 让开 slide 中心) — 原版全画布均匀 `R.r(-artW/4,artW)`; 功能性 deck 决定且笔记已声明"角落加权散布", 不算 invented |

**严重度: MED** — 笔记"三遍复笔"机制描述不准 (单笔画内三重顶点 zigzag, 非整曲线三遍); 家族无 voice miss。

---

## L13 Naïve (Olga Fradina, #483) — 家族 drift-web

### Claim 核对表

| Claim | 判定 | 证据 |
|---|---|---|
| 2D-core, shader 只是后滤镜 | ✅ | 主体画进 `buff=createGraphics(576,1024)`; 最后 `shader(theShader); theShader.setUniform("u_tex0",buff)` |
| 双相结构: 背景相沉积点 → 重新撒粒子 → 前景相连线 | ✅ | `iters<options.backIterations` 沉积 `thickDots`; `iters==options.backIterations && initParticles()`; 其后 `options.lines.enable && ... drawConnections(l)` |
| 孪生噪声 nX=noise(x,y), nY=noise(y,x) | ✅ | `noiseProcessing`: `noise((o+3e3)/nF,(e+4e3)/nF)` 与坐标互换的 `noise((e+4e3)/nF,(o+3e3)/nF)` |
| 算子动物园: round 量化 / sin-of-noise / 双尺度 max·min / addedNoise | ✅ | `options.rounded.enabled && ($=round($*v)/v)`; `sinOfNoise`; `maxOfNoises && ($=max($,t))` (t = nFactor/nDenom 第二尺度); 另有 subtracted/multiplied/moduloNoise (笔记未列全, 不算错) |
| IQ easing 全套备用 (expImpulse/cubicPulse/gain/parabola/pcurve/sinc) | ✅ | 全部逐字在 (byte ~19100-19700), 另有 polyImpulse/expSustainedImpulse/expStep/falloff |
| 距离带连线 minDist+maxDist + visiblePercent 概率 | ✅ | `s<options.lines.maxDist && s>options.lines.minDist`; `R.random_dec()<options.lines.visiblePercent && drawConnections(l)` |
| 速度赋值非积分, 无惯性 | ✅(微注) | `e.vel.x=s*shiftSignDX; e.vel.y=t*shiftSignDY` 每帧覆写 — 无惯性成立; 但 wind/repeller 走 `applyForce→acc`, update() 里 `vel.add(acc)` 在赋值后仍会叠加 — 帧内扰动, 不推翻结论 |

### 家族对照 drift-web (registry.js 960-1070)

| 维度 | 判定 |
|---|---|
| 孪生互换噪声 | 对上 (L1017-1018) |
| 算子人格化 calm 无算子 / balanced 双尺度 max / wild 加量化 | 对上 (WEB_PERSONALITIES L969-1003: quantize 0/0/5, maxOfNoises f/t/t — 与笔记宣称一致) |
| 距离带 + visible 概率 | 对上 (L1051, L1055) |
| 双相 | 简化 (允许): 家族相 2 直接在相 1 落点上一次性连线, 不重新撒粒子、不边漂边连 — 原版 `initParticles()` 重撒 + 逐帧连线。装饰尺度合理缩减, 无 voice miss |
| 边界 | 对上: 家族 wrap (L1038-1041) ≈ 原版 edges() wrap |

**严重度: LOW** — 全部 claim 坐实, 家族忠实。

---

## L23 Pre-Process (Casey Reas, #383) — 无家族

| Claim | 判定 | 证据 |
|---|---|---|
| 100 cell | ✅ | `let numCells = 100` |
| mintNumber 算术 trait %8/%3/%5 | ✅(微注) | `mintNumber += 1; surface = mintNumber % 8; origin = mintNumber % 3; growth = mintNumber % 5;` + 0→上限 remap (`if(surface==0) surface=8`) — 笔记省略了 +1 与 remap, 结论 ("#N 性格可预告") 不受影响 |
| hash 与序号 trait 互补 | ✅ | 位置/角度来自 `r = new RND()` (hash 种子), trait 来自序号 |
| 图层布尔开关组 drawCenter/drawPerimeter/drawAngle/fillCell/textOn | ✅ | `setParameters()` 按 surface 1-8 设置这 5 个布尔 + networkMode |
| 相触连线 | ✅ | `distance < cellwidth/2 + other/2 - 1 → friends[]`, `displayNetwork()` 画 LINES; networkMode 1 为 alpha 渐积变体 |
| 圆心点/周界圈/角度刻线 + globalSpin | ⚠️ 微 | drawCenter (圆心点) ✅, drawPerimeter (周界圈) ✅, `globalSpin=0.0125` ✅; 但 drawAngle 画的是周界上的**小圆点** (`ellipse(ax,ay,ds/2)`), 不是"刻线" |

**严重度: LOW** — 仅表面用词 (角度刻线→角度点)。

---

## L42 Trossets (Anna Carreras, #147) — 无家族

| Claim | 判定 | 证据 |
|---|---|---|
| 具名 trosset 画家字典按格抽签 | ✅ | 13 个画家函数经 `trosset(s)` 按 id 0-12 分发; `assignaTrosset()` 逐格赋 id |
| "16 个具名画家" | ❌ | 实际 **13 个** (L/R/H/V/P/X/M/VV/XX/LL/PP/MN/MS), 分发表止于 `12==s && trossetMS()` |
| 抽签按邻格已定画家过滤 possibles, "字典+约束传播 = 手写 WFC" | ❌ **INVENTED** | `assignaTrosset(){for(...) trossos[s].id = possibles[int(r.rb(0,len))]}` — possibles 是**全图一次性**按 `q=r.rb(0,195)` 从 p0..p30 选出的子集 (line 74 三元链), 每格**独立均匀抽取, 零邻格逻辑**。跨格观感靠的是 Truchet 式约定 (图元端点固定在 .25/.5/.75 分数位, 任意相邻都能接上) + 绘制时 `scale(2*w)` 超出格子一倍造成交叠 — 不存在约束传播 |
| 字典键方向语义 (L/R/H/V) | ⚠️ | H/V 确实横线/竖线 (`liniaH: line(.25,.5,.75,.5)`); L/R 对应 arcsD/arcsE (加泰兰 dreta/esquerra 右/左弧) — 命名有语义, 但"邻格衔接靠方向命名约定成立"是过度引申 (见上, 无衔接机制) |
| 地名调色板 cMontseny/cSalines/cIbiza/cAltafulla/cOlivos, 5 色一组 | ⚠️ | 5 个名字全部在 ✅, 每组 5 色 ✅ (`c1..c5 = cTots[numc][0..4]`), 共 19 组; 但命名不全是地名 — 还有 cPaella/cTortilla (食物)/cBarraca/cIndustria/cAlzines/cBuganvilea (物/植物), "加泰生活命名"更准 |
| 松弛感来源: "缠线端点带 ±抖动, 笔触不严格" | ❌ **INVENTED** | 全脚本 `r.rb` 只出现在 setup/creaTrossos/assignaTrosset (格子细分与抽签); **所有绘制图元是精确几何** — `arc(.75,.25,.5,.5,90°,180°)`, `line(.25,.5,.75,.5)`, 端点零抖动。松弛感真实来源: ~7-11% 概率的格子四分细分 (`r.rb(0,1)>r.rb(pMin,pMax)` → 4 个半尺寸 trosset) + `scale(2*w)` 的相邻交叠 + 童趣图元词汇 |

**严重度: HIGH** — 笔记两处核心机制是发明的 (约束传播式抽签、笔触端点抖动), 外加画家数量错 (16→13)。idiom 1 的"字典+约束传播"结论建立在不存在的机制上; 若 cargo-dashes v2 照此采纳需改写为 "Truchet 端点约定 + 全局子集抽签"。

---

## L46 Scribbled Boundaries (William Tan, #131) — 无家族 (NIFTY, 零 port)

| Claim | 判定 | 证据 |
|---|---|---|
| hash 字节查表二段跳 | ✅ 逐字 | `sp=[40,40,70,120,150,75,100,150,170,200,220]; rp=hi.slice(0,9).map(v=>sp[parseInt(v*(sp.length-1)/255)])` — 与笔记引文一致 (含重复 40) |
| graphics[] 多层离屏合成 | ✅ | createGraphic/endGraphic 按笔画预算切层 (`forcount>(grindex+1)*sPerLayer` 换层); draw() 里逐层 `image(graphics[i],...)`, 鼠标移动时各层按 `Math.abs(l/2-i)/(l/2)` 视差偏移 |
| 边界折返加密, 密度即轮廓, 无需描边 | ✅ | `class scribble_gr.display()`: 随机游走 curveVertex 链, 候选点命中任一 mask 形状 (inCircle/isInside/inBlock/inParting/...) 时**跳过该顶点且 prevx/prevy 不动** — 笔停在边界原地重试, 密度在形状外缘堆积, 形状区留白成形。机制 = 拒绝采样式折返, 与笔记 recipe 描述相符 |
| 23KB / NIFTY | ✅ | 22708B; 无家族, 合规 |

**严重度: LOW** — 全部坐实, 引文精确。

---

## L48 CENTURY (Casey Reas, #100) — 无家族

| Claim | 判定 | 证据 |
|---|---|---|
| `let janky = true` 具名布尔 trait | ✅ | line 4 逐字; 随后 hash 重抽 `r.rb(0,1)>0.7 → janky=true` (p=0.3) |
| janky 统一控制切片边缘错位 | ✅(微注) | 唯一消费点 sliceBuffer: `janky==true && randomized==true → slices[which].display(x + slices[which].xoffset)` (首尾切片豁免) — 控制的是**切片 x 错位**一处机制, "抖动/错位"的"抖动"略宽 |
| 双调色板配对 colorsA + lineColorsA 分池 | ✅ | 且共 4 对 (A/B/C/D) 按 rc 阈值 0.63/0.95/0.99 选; lineColorOptions 再限制线色池深度 `int(r.rb(2, lineColors.length+1))` |
| maxSlices=50 + sliceOrder 洗牌 | ✅ | line 7 `let maxSlices = 50`; `randomSequence(): sliceOrder=scrambleArray(...)`, 另有 orderedSequence() 有序变体 (构图=排列 成立, 且排列/恒等二态) |
| #100 编号即概念 | 🔍 | 平台元数据, 脚本内不可核 (合理的外部事实) |

**严重度: LOW** — 全部坐实。

---

## 跨课观察

1. L06/L07 的 sfc32 + 1e6 预热 + 交替双流是同一份社区样板 (变量名都同构), 笔记"后期标配"判断被两份脚本互证。
2. batch-C 唯一系统性问题在 L42: 笔记把 Truchet 式"任意相邻皆可接"的静态约定, 误读成了动态"约束传播/WFC", 又给精确几何脑补了笔触抖动 — 两者都是把"观感"反推成"机制"的失误 (与 feedback_read_source_before_porting 同型教训)。
3. 三个家族 (sediment-layers / ink-scribble / drift-web) 均无 invented detail; 唯一 voice 问题在 sediment-layers 的面内竖直 hatch 纹理缺失 (原作"沉积"质感的来源)。
