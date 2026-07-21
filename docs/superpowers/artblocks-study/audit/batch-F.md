# Batch-F 二读审计报告

课程: L28 BUSY (家族 street-grid) / L22 ORI (家族 paper-folds) / L11 Gumbo / L12 Trichro-matic / L15 Växt / L25 Still Moving
原脚本: scratchpad/ab-scripts/L{28-504, 22-379, 11-462, 12-482, 15-488, 25-433}.js
家族源: sdf-js/src/present/decor/registry.js

---

## L22 ORI — James Merrill (#379) · 严重度 HIGH

### Claim 核对表

| # | 笔记 claim | 判定 | 证据 |
|---|---|---|---|
| 1 | 参数化线段相交 (t/s 双参数) | ✅ | 函数 `n(...)`: `let t={t:x,s:f,side:null,other:null,xy:null}` — 交点对象带 t 与 s 双参数, 且 `l.sort((r,e)=>r.t-e.t)` 按 t 排序 |
| 2 | 点在多边形内测试 | ✅ | `const o=(r,e)=>{...l>o!=m>o&&n<(h-s)*(o-l)/(m-l)+s&&(i=!i)...}` — 标准 ray-cast |
| 3 | 多边形沿折线剖分 | ✅ | 剖分机器: 交点带 `flag` 插入边表, 按到线首距离排序后配对切出子多边形 (`if(s.length<2)return[r.slice(0)]; s.sort(...S.dist(a,r)-S.dist(a,e)...)`) |
| 4 | "折是平面拓扑操作, 没有 3D" | ✅ | 折 = 剖分 + 2D 镜像: `Ie` 里质心侧别测试后 `l=g(r,n,o).vertices`, `g` 沿折线法向 (`atan2(...)+PI/2`) 反射顶点; 另有 `x(l,n,t.distance)` 折翼平移。**注意: 笔记把折描述成"两侧各出一个子多边形"漏掉了镜像这一步** — 镜像才是"折"; 剖分只是"切" |
| 5 | **永远剖最大 facet (贪心面积 = 构图均衡器)** | ❌ | 原作不存在。折线由 `T.d2/d3/d4/d5/foldOver/radial/smallSmallSheers` **预先批量生成** (每档 10~25 条), 然后 `for(let n=1;n<=se.length;n++){...r=Ie(r,i,o,a,t)}` 逐条**作用于所有被穿过的 facet** (`Ie` 内 `r.forEach`)。全脚本唯一按面积排序处 `ye=ye.sort(((r,e)=>c(e)-c(r)))` (函数 `Ye`) 只用于把预生成的 2500 个样式对象按面积序配给 facet + d6 z 序调整, 与剖分选择无关 |
| 6 | **折轴偏爱轴对齐 (±jitter)** | ❌ | 折线生成器 `B=(r,e,n=!1)=>{const o=n\|\|random(2*-PI,2*PI);...}` — 折轴角**全随机**; `d4` 是平行族整体转一个随机角 `i=random(2*PI)`, `radial` 径向。轴对齐 ± 抖动确实存在但在**填充线方向 d9** 上: `case"down":o.d9=PI/2+random(-.1,.1)` / `"flippy":o.d9=PI/2*(±1)+random(-.1,.1)` — 笔记把 fill 方向的 idiom 错安到折轴上 |
| 7 | **facet 按折叠深度渐变色调** | ❌ | 无折叠深度追踪 (`Ie` 不给 facet 计数)。实际着色: 每 facet 从调色板组随机取色 + 随机明度偏移 `z("b5",random(-15,10))` + `A(...,5)` 明度抖动, 再叠方向性纹理填充 (leaf/dots/evenLines/perspective, 沿 d9 方向 `lerpColor(...,r/h+randomGaussian(0,.1))`)。"色阶读成纸的朝向"的效果存在, 但机制是随机明度+方向纹理, 不是深度渐变 |
| 8 | webpack 打包 | ✅ | 文件头 `var r={d:(e,n)=>{...Object.defineProperty...},o:...}` — webpack 5 runtime |
| 9 | "原生 js" | ⚠️ | 实为 **p5.js** (createCanvas/beginShape/endShape/vertex/lerpColor/randomGaussian/createVector/noiseSeed/randomSeed/drawingContext 全在), webpack 只是打包层 |
| 10 | 58KB / CC BY-NC | ✅/🔍 | 58198 B ✓; license 链上读不出 |

### 家族对照: paper-folds (registry.js:1768-1877)

| 维度 | 判定 | 说明 |
|---|---|---|
| 形状构造 (closed fill + crease stroke) | 对上 | 原作 facet 也是闭合多边形填色 + 描边 (`er(r,e)` outline); registry.js:1866-1874 fill+stroke ✓ |
| 剖分机器 (splitPolyByLine, 侧别分类+插交点) | 对上 | registry.js:1785-1805 与原作机器等价 (实现路线不同但同构) |
| **贪心剖最大 facet** (registry.js:1835-1846, 注释 "ORI's balance rule") | **INVENTED DETAIL** | 原作没有此规则 (见 claim 5)。整个循环选 max-area 是我们发明的, 却署名 ORI |
| **折轴轴对齐基调** (registry.js:1849 `baseAng = rand()<0.5 ? 0 : PI/2`) | **INVENTED DETAIL** | 原作折轴全随机 (claim 6); 轴对齐属于原作的填充方向 |
| **深度渐变着色** (registry.js:1832/1858 depth 计数, 1863-1864 `depth/splits → lerpColorOklab`) | **INVENTED DETAIL** | 原作按 facet 随机明度偏移, 无 depth 追踪 (claim 7) |
| **折 = 剖 + 镜像翻转** | **VOICE MISS (偏 MED)** | 原作真正的"折"是把一侧沿折线**反射** (`g`) 并可平移 (`x`), 产生翻折错位感; 家族只剖不折 — 变成"矩形递归 BSP + 色调渐变", 几何上更接近 shard-mesh 的姊妹而非折纸引擎。装饰尺度下色调+折痕线仍能读出拼贴感, 故 MED 不 HIGH |
| 颜色来源 (2 色 OKLab lerp 接主题) | 对上 (刻意简化) | 原作是调色板组+角色 (b5/c2 组) + 随机明度; 家族接 deck 主题双色 — 设计决定 |
| 分布随机性 | 对上 (刻意简化) | 原作满地 weighted choice `P([...])`; 家族均匀 rand — 装饰尺度可接受 |

**结论: HIGH** — 笔记 4 条解剖 recipe 里 3 条 (贪心最大/轴对齐折轴/深度着色) 是发明或错安, 且全部三条被家族当"ORI 的规则"实现并写进注释。家族视觉本身成立, 但 provenance 叙述失真: 它 port 的是笔记的想象, 不是 ORI 的机制。

---

## L28 BUSY — James Merrill (#504) · 严重度 MED

### Claim 核对表

| # | 笔记 claim | 判定 | 证据 |
|---|---|---|---|
| 1 | 251KB, BUSY #504 | ✅/🔍 | 251648 B ✓; `saveCanvas(\`BUSY-${tokenData.hash}.png\`)` 确认是 BUSY; 项目号链上读不出 |
| 2 | "原生 js (webpack)" | ⚠️ | 双错: 打包器是 **Vite/Rollup** (文件头 modulepreload polyfill 是 Vite 签名, 无 webpack runtime), 且是 **p5.js** 应用 (`window.setup=()=>`, createCanvas×3, beginShape×215, saveCanvas, HALF_PI, 含 p5-svg: `createCanvas(1e3,1e3*e,SVG)`)。252KB 大头之一是打包进来的多边形布尔运算库 (martinez 型 sweep-line) |
| 3 | trait 类型学: straight/corner/corner-XL/…/pathFromCache "道路是带类型目录的词汇表" | ⚠️ | 词汇表**核心成立但清单混层**: `straight/corner/corner-XL/start/end` = 路径段类型 (`case"corner":t=w3(i,t,o,"normal")`), `singleLine,3/megaSingle,1/ghost,4/railroad/highway` = 道路 genus 加权目录 (`Y1([...])`), 交叉口目录是 `["intersection",1,"furball",5,"splitter",4,"three-way",2]`, `pathFromCache` = 形状缓存类型。但 **diagonal-left/right 是调色板空间分布模式** (`rndFromList(["random",10,"top-to-bottom",10,"diagonal-left",5,...])` 决定按位置取 ink), **circular 是 turbulence 场模式** (`case"circular":i=1-dist(...)`) — 这两个不是路型。另有笔记漏的 genus: electricPole |
| 4 | "沿路行驶的 agent 轨迹 / agent 沿网行驶留痕" | ⚠️ | **静态作品, 无 agent 模拟**: 全文 0 个 requestAnimationFrame/draw()/frameCount, 有 noLoop。车是精灵多边形 (`"car-1-side"…"car-5-side"/"train-front-1"/"train-car-1"`) 按 `carDensity` 沿路**摆放**, 行人是 `walkerPositions` 过街点。"网络先于显影"的洞察本身 ✅ (路网 = 作品本体), 但"行驶留痕"是想象出来的机制 |
| 5 | 转弯 = 固定半径四分之一圆弧 | ✅ | `w3` 按 e6/e7 方向对以 PI/2 整数倍旋转放角件; 铁路弯 `y3` 用 24 段顶点扫 PI/2 圆弧 (`c*PI/4/(o/2)`, c≤24 → 总角 PI/2), 半径绑格距 (`.5±t/2`) |
| 6 | pathFromCache = 昂贵路径算一次显影 N 次 | ✅ | shape type `"!"` → `{type:"pathFromCache",attributes:{x,y,refID}}`, 渲染时 `o=k1(l[i.refID],{x:i.x,y:i.y},!1)` — 按 refID 取缓存路径带偏移重印 |
| 7 | ghost = 幽灵重影 | 🔍/⚠️ | ghost 是道路 genus 之一, 与 singleLine 同路径: 单 ink (`l.genus==="singleLine"\|\|l.genus==="ghost"?t=[t[0]]`)、占格豁免 — 读起来更像"淡色幽灵路"而非重影; 混淆代码里读不出"重影"证据 |
| 8 | 姊妹作同引擎两参数档 | ✅(旁证) | BUSY 自己的构图模式表里赫然有 `"busiest",0` 权重零档: `rndFromList(["cityNormal",20,"cityXL",16,"justPipes",5,"thinAir",5,"Detail",5,"busiest",0…])` — 同引擎内置 busiest 档, 姊妹发行 = 换权重, 笔记判断被链上代码直接支持 |

### 家族对照: street-grid (registry.js:1546-1640)

| 维度 | 判定 | 说明 |
|---|---|---|
| 车道 = 平行双轨 | 对上 | 原作路 = 带状两条边线 (`n.line(0,-h/2,…)` + `+h/2`, `a4:{height:.6}`); registry.js:1576-1590 法向偏移 ±gauge/2 双线 ✓ |
| 宽路虚线中线 (gauge>7, registry.js:1603-1611) | 对上 (recipe 级) | 原作有 `dashesPerGrid:2,dashLength:.2` 路内虚线元素, highway 是加权升格 genus (`L.d9&&(n=l2(n,"highway"))`) — "宽路才有虚线"是合理归纳 |
| 铁路垂直枕木 (registry.js:1591-1602) | 对上 (recipe 级) | 原作 railroad genus 双线 `c2:{height:.5,b8:2,a6:.15}` + 横向元素; 枕木间距 gauge*2.2 是我们的调音, 机制方向一致 |
| 四分之一圆弧转角 | 对上/小偏差 | 弧本身 ✓ (claim 5)。偏差: 原作的弧长在**一条路自己转弯处** (路径 corner 段), 家族放在**两条直通车道的交叉口上** (registry.js:1622-1637) 且车道永远贯穿全区 — 原作道路是格上随机行走的蜿蜒路径 (起点随机+方向改变 `p=R3(a,u,p)`+占格碰撞 `A(a,u,1,1,t)`), 家族是全跨度直线。装饰尺度可接受, LOW |
| 颜色来源 | 对上 (刻意简化) | 原作具名 ink 调色板 (`{name:"Robot",inks:[…]}`) 按 genus 切片 (ghost 1 色/highway 3 色); 家族接 deck 主题随机取 — 设计决定 |
| 分布随机性 | 小偏差 | 原作 genus 是加权离散目录 (`["singleLine",3,"megaSingle",1,"ghost",4]`), 家族是连续均匀 gauge (3+rand*gaugeMax) + railChance 概率 — 丢了"离散档位"的工程感一半, 但人格档 (calm/balanced/wild) 补了档位感, LOW |
| 无 agent 层 | 对上 | 笔记 port 判定"agent/车流层不 port"— 恰好躲过了 claim 4 的错误, 家族干净 |

**结论: MED** — 家族本身干净 (LOW), 但笔记有三处失真: 技术栈双错 (p5+Vite ≠ 原生js+webpack)、类型清单把调色板分布模式 (diagonal-left/right) 和 turbulence 模式 (circular) 混进路型目录、"agent 行驶留痕"实为静态精灵摆放 (无动画循环)。"busiest 权重 0 档"是本次审计最漂亮的正向发现。

---

## L11 Gumbo — Mathias Isaksen (#462) · 严重度 LOW

| # | 笔记 claim | 判定 | 证据 |
|---|---|---|---|
| 1 | 15KB, 绝大部分是打包成 JS 字符串的 GLSL | ✅ | 16171 B; 模板字符串 `e=\`#version 300 es…\`` 占全文一半以上 |
| 2 | 伪装成 js 的 SDF raymarch | ✅ | `main()` 里 sphere-trace 循环: `for(I l=0;l<it;l++){F j=i(h);…d+=j;h=x+y*d;if(K(j)<1e-6)break;}` |
| 3 | 值噪声 vn() | ✅ | `F vn(W v,F y,F f){…J(v),fract(v),s01(i)… 8 角 mix}` — 三线性值噪声, 名字就叫 vn |
| 4 | fbm | ✅ | `F d(W v,I f,F y,F t){…d+=n*vn(…),n*=.5,v=e(2.*v,W(1),1.2)}` — 倍频+半幅+旋转 |
| 5 | 盒体与圆柱 SDF (含圆角) / "圆角盒 rc()" | ⚠️ | 盒 `b()` = 精确盒 SDF (`K(v)-t/2`), **无圆角半径参数**; `rc()` = `b(e(v,f,y,d,1.),…)` 即**旋转盒** (r 更可能是 rotated), 也无圆角。"圆角感"实际来自 `o()`/`dc()` 的 tube 半径 (棱柱环 `t*=Y(PI/(h*tan(PI/h)))` + 截面半径 n) 与 smin 柔融 — 圆角安错了函数 |
| 6 | mat3 旋转对齐 e(v,f,y) | ✅ | `W e(W v,W y,W f,F t,F i){…mat3(h,H(h,n),n)…}` — 轴对齐旋转 |
| 7 | 角度量化棱柱 o() | ✅ | `x=2.*PI*round(h*x/(2.*PI))/h` — 极角量化成 h 边形 |
| 8 | smooth-min 柔融 | ✅ | `F u(F v,F f){F t=22.…y-log(exp(-t*(v-y))+exp(-t*(f-y)))/t}` — 指数 smin k=22, 组合处 `d=u(d,M(…))` |
| 9 | "原生 WebGL" | ⚠️ | `getContext("webgl2")` + `#version 300 es` — WebGL2 |

无家族 (纯文档课)。旁注: Gumbo 也用双 sfc32 + 1e6 预热 + 交替消费 (`i=!i,i?e():f()`) — L25 那条"社区共识" idiom 的第三个目击, 笔记没提, 白捡的语料。

---

## L12 Trichro-matic — MacTuitui (#482) · 严重度 LOW (near-clean)

| # | 笔记 claim | 判定 | 证据 |
|---|---|---|---|
| 1 | CPU 构图 + shader 视觉核, polyVertices[128] / paletteAccentArray[50] 作 uniform | ✅ | `uniform vec2 polyVertices[128]` + `uniform uvec2 polyIndices[128]` + `uniform vec3 paletteAccentArray[50]` (另有 altPaletteAccentArray[50]) |
| 2 | UV warp / wave warp / spiralize / palette-swap / grid bleed-through 全是 uniform 开关 | ✅ | `uniform int waveWarpX / waveWarpY / uvSpiralizeEnabled / paletteSwapWarpEnabled / gridBleedThrough / warpLayer …` 全套开关 + 参数 (uvWarpScale/waveWarpDivisor/paletteSwapArmWidth 等) |
| 3 | 具名调色板完整对象 `{name:"Chalks",theme:"Calm",bg/highlight/lowlight/line/stroke/base/accent[]}` | ✅ | 原文逐字命中: `{name:"Chalks",theme:g,bg:["#e9e1cc"],highlight:[…],lowlight:[…],line:[…],stroke:[…],base:[…],accent:[…5 色]}`, 其中 `g="Calm"` |
| 4 | 性格标签 Calm/Assertive/Rich/Toasty/Chilled | ✅ | `"Calm",m="Assertive",v="Rich",b="Toasty",w="Chilled"` — 5 个全对, 15 个调色板各带 theme |
| 5 | 48KB (JS 30KB + frag ~18KB) | ✅ | 49876 B, frag 是内嵌大字符串 |
| 6 | "原生 WebGL" | ⚠️ | `getContext("webgl2")` + `#version 300 es` — WebGL2 (与 L11 同款小误) |

无家族 (文档课)。

---

## L15 Växt — Santiago (#488) · 严重度 CLEAN

| # | 笔记 claim | 判定 | 证据 |
|---|---|---|---|
| 1 | JS 侧 0 绘制调用, 生成器拼装 GLSL 源码 | ✅ | 无 ellipse/rect/vertex 绘制; 构图全部输出为 GLSL 表达式字符串 (`P(n)`/`H(n)` 生成 `sc(…)`/`sb(…)` SDF 调用文本), 最后 `e.createShader(35632)` + `compileShader` |
| 2 | 逐项 `$n += "sh += SM(...)*step(...)"` | ✅ | **连变量名都对**: `$n+=\`sh += ${…\`SM(-${…},0.,-${r})*step(-${r},0.)\`…}\`` — 每个遮挡体一项软影, 累加进 sh; 高光侧同构累加进 d |
| 3 | 内嵌自实现 simplex 噪声 | ✅ | `F pns(A x,F a,out A g){…A uv=A(x.x+x.y*0.5,x.y)…}` — 2D simplex (带解析梯度输出!) 手写在 frag 里 |
| 4 | O(N) 项内联展开, 无循环无数组 | ✅ | 影子/高光累加全部是字符串拼出的加法链, shader 里无 shape 数组无循环 (palette 数组除外, 但那是 ES 3.00 合法用法, 不在该 claim 范围) |
| 5 | `#define ro(a) mat2(…)` + 单字母别名 | ✅ | `#define ro(a) (mat2(cos(a),-sin(a),sin(a),cos(a)))` + `#define A vec2 / B vec3 / C vec4 / F float / I int / SM smoothstep` |
| 6 | WebGL2 · 16KB | ✅ | `getContext("webgl2")` (这课笔记连版本都写对了), 15808 B |

无家族 (移交 3D 端文档课)。旁注: 同款双 prngA/prngB + 1e6 预热 + 交替 rd() 也在 (class A) — 该 idiom 第四个目击。

---

## L25 Still Moving — Stern & Stiles (#433) · 严重度 CLEAN

| # | 笔记 claim | 判定 | 证据 |
|---|---|---|---|
| 1 | p5 纯 2D, 24KB | ✅ | setup/draw/createCanvas/createGraphics/keyIsDown; 24241 B |
| 2 | 诗行数据 `PO=["I don't know much about minds…"]` | ✅ | 首行原文逐字: `"I don't know much about minds, but I think"`, 共 72 行诗全部上链 |
| 3 | 36×24 低清网格 + 阈值 thrsh=75 | ✅ | `VW=36,VH=VW/1.5` (=24), `thrsh=75`; 摄像头帧 `v.size(VW,VH)`, 帧差 `dist(a,l,…)>thrsh` 触发字符投放; 文字位图同用 36×24×BR 网格 + `BL.pixels[e]<130` 阈值 |
| 4 | 双 PRNG 交替 + 1e6 预热, 各吃 hash 一半 | ✅ | `prngA=_(hash.substr(2,32)), prngB=_(hash.substr(34,32))`; `for($=0;$<1e6;$+=2)prngA(),prngB()`; `RD(){useA=!useA; return useA?prngA():prngB()}` — 与笔记描述逐字吻合, "与 Neural Sediments 同构"成立 |
| 5 | 伪视频/监控质感 = 采样屏换皮 | ✅ (诠释) | 机制核对如上; thrsh 可用方向键 15~165 调 ("camera sensitivity"), 75 是初始值 — 笔记写法无误 |
| 6 | CC BY-NC-SA | 🔍 | license 链上读不出 |

无家族 (伦理线文档课, 判定正确: 文字语义内容确实是作品核心)。小遗漏 (非错误): 作品核心交互是**摄像头动作侦测**驱动文字投放 (createCapture(VIDEO)), 笔记只写了"伪视频处理"没点名 webcam — 不影响任何 recipe。

---

## 总裁定

| 课 | 严重度 | 一句话 |
|---|---|---|
| L22 ORI | **HIGH** | 3 条机制 claim 为发明 (贪心最大/轴对齐折轴/深度着色), 全部进了 paper-folds 家族并署名 ORI; 家族另丢"剖+镜像"的折签名 |
| L28 BUSY | **MED** | 词汇表混层 (diagonal/circular 非路型) + 静态精灵被写成 agent 行驶 + p5/Vite 误标 webpack/原生js; 家族干净, 且发现 "busiest",0 档实锤姊妹引擎 |
| L11 Gumbo | LOW | 核心 SDF/raymarch/smin/fbm 全实锤; "圆角盒 rc()" 安错 (rc 是旋转盒, 圆角来自 o/dc tube + smin); WebGL2 误标 WebGL |
| L12 Trichro-matic | LOW | 调色板对象/主题标签/uniform 开关逐字实锤; 仅 WebGL2 误标 |
| L15 Växt | CLEAN | 元编程 shader claim 连 `$n` 变量名与 SM*step 累加式都逐字命中 |
| L25 Still Moving | CLEAN | PO/36×24/thrsh=75/双 PRNG+1e6 全部逐字实锤 |

横向发现: 双 sfc32 + 1e6 预热 + 交替消费在本批 4/6 作品出现 (L25/L15/L11/L28 的 Merrill 除外待查) — "社区共识"级判定进一步加强。
