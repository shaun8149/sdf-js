# 二读审计 — Batch G (L16 / L18 / L27 / L29 / L35 / L43 / L44 / L45 / L50)

全部无 decor 家族, 只审"笔记 claim vs 链上原脚本"。方法: grep/perl 定位, 不通读。

---

## L16 Proscenium (Remnynt, #486) — 笔记: 16-proscenium.md · 脚本: L16-486.js

| Claim | 判定 | 证据 |
|---|---|---|
| 原生 WebGL, 145KB | ✅ | 145110 bytes; 无 p5./THREE. 引用; 自建 shader 类 |
| uModelMatrix/uViewMatrix/uProjectionMatrix 全套矩阵管线 | ✅ | 三个 uniform 各出现 9-11 次, vertex shader `gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * ...` |
| fragment shader 只有一行 `gl_FragColor = vColor` | ❌ **以偏概全** | 点/painter shader 确实是 passthrough: `fragmentShaderSource` = `gl_FragColor = vec4(vColor.rgb, vColor.a);` 一句。**但** 脚本另有 `TerrainViewShader` (两个 #version 300 es 变体, 主 view 里 `new TerrainViewShader(...)` 无条件实例化), 其 fragment 是完整光照: `const int MAX_LIGHTS = 9` + `uLightDirections/uLightColors` + `fresnelSchlick(...)` + `specular/diffuse` → `fragColor = vec4(finalColor, 1.0)` |
| "几何、颜色、排序全在 CPU" | ⚠️ | 排序 ✅ CPU (见下行); 几何数据 CPU 生成 ✅; 但 terrain **光照着色在 GPU** (Fresnel-Schlick + 9 灯), "颜色全在 CPU" 不成立 |
| SORT_CLOSEST_DISTANCE / SORT_REACH / SORT_EVENTS_* 多策略排序 | ✅ | SORT_CLOSEST_DISTANCE ×2, SORT_REACH ×2, SORT_EVENTS_TIME ×3, SORT_EVENTS_REACH ×2 |
| SRGBtoRGB/RGBtoSRGB 显式转换函数对 | ✅ | 各 11/10 次 |

**严重度: HIGH** — 笔记把整部作品描述成"直通 shader, 视觉全 CPU", 漏掉了带 Fresnel + 多灯的
terrain 光照 fragment shader (机制讲错)。分流结论 (CPU-3D 归 3D 端参考, 非 shader-core raymarch)
仍然成立, 但"第五形态: CPU-3D + 直通 shader"的表述需改为"CPU 几何/排序 + 混合 shader
(painter passthrough + terrain 光栅光照)"。

---

## L18 Solar Transits (Hodgin, #423) — 笔记: 18-solar-transits-hodgin.md · 脚本: L18-423.js

| Claim | 判定 | 证据 |
|---|---|---|
| 原生 WebGL2 多 pass | ✅ | `getContext("webgl2",{premultipliedAlpha:!1,alpha:!1,preserveDrawingBuffer:!0})`; createFramebuffer/framebufferTexture2D helper |
| 18 处 precision 声明 | ✅ | `precision highp float;` ×16 + `precision highp int;` ×2 = 18 |
| 几何只有全屏单三角 `Float32Array([-1,-1,3,-1,-1,3])` | ✅ | 该数组 (含配套 texcoord `[0,0,2,0,0,2]`) 出现 5 次, 唯一 drawArrays 路径 |
| 曝光累积 (长曝光感) | ✅ | `exposure` / `exposureFrames` 参数; `or=168+an.exposureFrames` 帧数控制 |
| 轨道/凌日参数化 | ✅ | planetDist/planetEdge/planetPer/corona/Transit 等词汇齐全 |

**严重度: LOW** — 全部 claim 对上, 无发现。

---

## L27 because unless until (ixnayokay, #472) — 笔记: 27-because-unless-until-ixnayokay.md · 脚本: L27-472.js

| Claim | 判定 | 证据 |
|---|---|---|
| 27 个 class | ✅ | `grep -o 'class [A-Za-z_$]*' \| sort -u` = 27 个唯一 class 名 |
| 双 PRNG 交替 + 1e6 预热 | ✅ | `this.prngA=new e(t.hash.substr(2,32)), this.prngB=new e(t.hash.substr(34,32)); for(let t=0;t<1e6;t+=2)this.prngA(),this.prngB()`; `random_dec(){this.useA=!this.useA, ...}` 严格交替 (预热各 5e5 次, 合计 1e6, 表述无碍) |
| hash 切 32 字节决策槽位 (Rizzolli 模式) | ✅ | `new Array(32).fill(null).map((e,i)=>parseInt(t.hash.slice(2+2*i,4+2*i),16))` — 与 PRNG 种子并存, "双纪律叠加"成立 |
| 真实时钟层: 不同现实日期/时刻不同容貌 | ✅ | help 文案 "renders as if the current date was the Unix epoch -- January 1, 1970" + "Special Day behaviors"; `rt()` 返回 [getDay, getDate, getMonth, getFullYear], `lt()` 用 getSeconds; 十二月名数组 `A=["January",...]` |
| "Golden Hour" / "Last Light" / "Blue Skies" 是时段氛围档 | ⚠️ **不精确** | 三者实际是 **Coloring Mode 调色板词条** (与 Scorch/Asiimov/Midnight/CMYK 并列的 CMYK 色值表, 如 `"Golden Hour":ye([0,0,0,100],[0,28,100,0],...)`) — 是 hash 抽的具名调色板, 不是时钟驱动的氛围状态。时钟层真实存在 (Special Day), 但笔记把调色板名当成了时钟证据 |
| 命名 trait 面板 "Coloring Modes"/"Detail Levels" | ✅ | 字符串各出现 5+/12 次 |

**严重度: MED** — 核心机制 (双纪律 PRNG、时钟反应) 全对; 唯"Golden Hour 等 = 时段氛围档"
把调色板名误读为时钟档位。L50 笔记的对照表引用了这一误读 (见 L50 节)。

---

## L29 Quine (Larva Labs, #506) — 笔记: 29-quine-larvalabs.md · 脚本: L29-506.js

| Claim | 判定 | 证据 |
|---|---|---|
| script 字段是一整份 HTML (ASCII art 签名头 + style + svg + 代码) | ✅ | 文件头: `<!DOCTYPE html>` + QQQ ASCII art "A generative code/art project by Larva Labs" + `<style>` + `<svg id="s" viewBox="0 0 1440 2560">` + `<script>` |
| processBlocks/processSubstitutions 切块自身源码 | ✅ | L139 `function processBlocks(text, vars)` — 解析自身源码里的 `/*__var{*/ ... /*__}*/` 条件块; L194 `processSubstitutions` |
| randomColorScheme/getSchemeByName 具名 scheme 目录 | ✅ | L93/L105; SCHEMES 表 `{name:"C", weight:100, colors:...}` 加权抽取 + 按名查找 (L448-452), 另有 ALT_HIGHLIGHT "BX" |
| 37KB custom | ✅ | 36792 bytes, 无 p5 |
| Curated 收官 / V3 合约 / NFT License | 🔍 | 链下元数据, 脚本内不可核 (tokenData.externalAssetDependencies 的存在与 V3 说法相容) |

**严重度: LOW** — 可核 claim 全部对上。

---

## L35 Edifice (Kovach, #204) — 笔记: 35-edifice-kovach.md · 脚本: L35-204.js

| Claim | 判定 | 证据 |
|---|---|---|
| 具名算子: Tear/Perspective/Sharp/Wave/Torus/Fold/Shift/Turn/Twist/Squish/Isometrize | ✅ | 全部字符串在场 (各 2-6 次), 且都有对应 `case"..."` 分支 |
| MidpointWalkFill 具名填充器 | ✅ | ×3 + `case"MidpointWalkFill"` |
| Manhattan / Chebyshev 距离度量可换 | ✅ | `case"Manhattan"` / `case"Chebyshev"` → 不同邻域集 + `fillGridDistToStart` |
| Bismuth 材质 | ✅ | ×4, 在填充器抽签表 `[["Bismuth",2],["Manhattan",4],["Chebyshev",4],...]` |
| "一个 mint = 网格 + [Fold, Twist, Isometrize] 算子**序列/链**" | ⚠️ **不精确** | 变换是**单次加权抽签**: `Mt=t([["Sharp",..],["Shift",10],["Wave",10],["Turn",10],["Twist",10],["V",10],["Perspective",5],["Squish",...],["NoShift",1],["Tear",6],["Isometrize",.2]])` — Mt 是标量 trait (`"Wave"==Mt||"Sharp"==Mt` 等值比较), switch 返回**一个**变换函数。正交轴是 变换×填充器×度量×轴向 各抽一次, 不是可组合的算子链 |
| "Isometrize 作为末端算子: 最后一步推成等距" | ⚠️ | Isometrize 是上述同一张抽签表里的一个选项 (权重 0.2, `case"Isometrize": return t=>{...new tt(e+n,(n-e)/2)}` 确为等距投影), 不是叠加在其他算子之后的末端 stage |

**严重度: MED** — 词汇表全部属实, 但"算子链/序列"与"末端算子"两处把 单抽正交轴 讲成了
可组合管线, 生成器架构描述失准 (idiom 1 的"组合即 trait"依据不足)。

---

## L43 entretiempos (Soria-Rodriguez, #267) — 笔记: 43-entretiempos-soria.md · 脚本: L43-267.js

| Claim | 判定 | 证据 |
|---|---|---|
| p5 + shader 后滤镜; CPU 侧 dC/dIi3/dRi 画构图 | ✅ | `function dC` + dIi3/dRi 在场; shader 是 `tex0` 后处理 |
| fragment 只做 grain + 方向模糊 (u_dir) + 亮度/对比 (u_br/u_con) | ✅ | frag: `rd()` hash 噪声 + `gB(tex0, uv, tS*u_dir)` 高斯 9-tap 方向模糊 + `bC(v,b,c)=(v-0.5)*c+0.5+b` |
| grain 是"恒等 hash" | ⚠️ | hash 函数确是经典 `fract(sin(dot(st,vec2(12.9898,78.233)))*43758.5453123)`; 但采样点是 `rd(uv*u_time)`, u_time=millis()/1e3 — **grain 逐帧动**, 不是 hash 冻结的静态颗粒 |
| "u_g(rain)" — u_g 是 grain 强度 | ❌ | `u_g` 是 **gamma**: `vec3 g(vec3 v, float p){return pow(abs(v),p)}` → `cOut=g(cOut,u_g)`; CPU 侧 `shG=dP.sh.shBW?1.65:1.15` (典型 gamma 值)。grain 强度实际走 `u_pC` (`cOut=0.99*tI+tN*u_pC`) |
| u_pA/u_pB/u_pC/u_g/u_br/u_con "全从 hash 铸造" | ⚠️ **不精确** | 多数是**常量**: `shBlEqA=.45, shBlEqB=.55, shK=1.05, shBr=.028, shCon=.925`; hash 只铸 `shBW=R.rd()<.075` (黑白 trait) 与模糊方向符号 `shBx/shBy=(-1)**R.rc([...])`, shG/shBlEqC 仅随 shBW 二选一。"冲印批次"实为 方向+BW 两根 lane, 不是六参数全 hash |
| sigM (sigmoid) 开场即定义 | ✅ | `sigM(t){return 1/(1+Math.exp(-t))}` 定义于文件头部 (class Random 之前), 用于距离→透明度映射 `(...sigM(min(dist(...),dist(...))))**3` |

**严重度: MED** — 结构判定正确, 但 u_g=gamma 误读为 grain, "参数全从 hash" 与实况
(大半常量) 不符, grain 还是时间动画的。idiom 1 ("后滤镜参数也是 trait") 的证据被高估。

---

## L44 FAKE IT TILL YOU MAKE IT (Maya Man, #337) — 笔记: 44-fake-it-mayaman.md · 脚本: L44-337.js

| Claim | 判定 | 证据 |
|---|---|---|
| sentenceStructure + interjection + punctuation 槽位拼句 | ✅ | `sentenceStructures=[["np","are part of the process"],["amx","ns","energy"],["I am","adv","amx"],...]` — 模板+词类槽 (np/ns/adj/adv/ving/amx/wp/ws); interjection ×3, punctuation ×4 |
| textBoundingBoxes 做文字排布碰撞 (增量放置 + 重叠检测, 生成时避让) | ❌ **机制不存在** | `textBoundingBoxes` 全文件仅 2 处: 声明 `textBoundingBoxes=[]` 和 `textBoundingBoxes.push([-textWidth(i)/2, e*t-t/2, textWidth(i), t])` — **write-only, 从未被读取**; 无 overlap/intersect/collide 任何检测函数。实际防重叠机制是**按文本长度降字号/关贴纸**: `e.length>=7||numWords>=5?(txtsi=6,stickers=!1):...`, `e.length>=10&&(stickers=!1)` |
| stickers 层叠贴纸 = 独立点缀词汇表 | ⚠️ | 有 sticker 词汇 (star/sparkle/cuteFace/drawCharacter...) 且 `stickerTypeIndex=R.r_i(0,..)` 抽类型, 但 `stickers` 是**布尔开关**, 贴纸按网格平铺 (`switch(stickerTypeIndex){case 0: 0==e&&0==l?...translate(...)}`), 非自由层叠拼贴 |
| 39KB 原生 js | ✅ | 39032 bytes, p5 风格全局 API (textWidth/push/translate — 实为 p5, 笔记说"原生 js"存疑但 minor) |

**严重度: HIGH** — idiom 2 是本课头牌带走项, 但"textBoundingBoxes 增量放置+重叠检测"
在脚本里不存在 (变量是死积累), "生成侧避让"的真实手段是长度分档降字号。
笔记的"一句话学到的"整句建立在这个不存在的机制上。

---

## L45 Fontana (Rayner, #367) — 笔记: 45-fontana-rayner.md · 脚本: L45-367.js

| Claim | 判定 | 证据 |
|---|---|---|
| SVG 管线 | ✅ | `createElementNS(svgns,t)` / xlinkns; 元素词汇 "path"×13 / "line"×7 / "circle"×4 / "rect"×1 |
| gen() 开场十余行把参数 clamp 进 (1e-5, 0.99999), 0.5 特判 0.49999 | ✅ | `function gen(){function a(a,t,e,r,...){ a=parseFloat(a.toFixed(5))<=0?1e-5:a, a=...>=1?.99999:a, ... a=.5==parseFloat(a.toFixed(5))?.49999:a, ...}` — 4 参数 × 3 种箝位 = 12 行, `1e-5`×4 / `.99999`×4 / `.49999`×4 全对上。(细节: 箝位在 gen 内部的辅助函数 a() 开场, 非 gen 顶层 — 表述可容) |
| 0/0.5/1 处贝塞尔/除法退化 | ✅ 佐证 | 箝位后紧跟 `M=o/Math.cos(v)` / `Math.tan(k)` 等除法/正切, 0.5→tan(π/2) 奇点, 防御动机吻合 |
| 19KB | ✅ | 18611 bytes |
| "全语料仅二例 SVG" (与 Unigrids 并列) | 🔍 | 跨语料统计, 本课脚本内不可核 |

**严重度: LOW** — 头牌 idiom (偏执级箝位) 逐字对上。

---

## L50 720 Minutes (Alexis André, #27) — 笔记: 50-720-minutes-andre.md · 脚本: L50-27.js

| Claim | 判定 | 证据 |
|---|---|---|
| 自带 alea PRNG + simplex (Float32Array 梯度表 + Uint8Array perm) | ✅ | Baagøe alea (masher 模式) 全文; simplex: `const l=1/3,u=1/6` (F3/G3 常数) + `c=new Float32Array([1,1,0,-1,1,0,...])` 12 梯度 + `this.perm=new Uint8Array(512); this.p12=this.perm[t]%12` — 教科书 3D simplex |
| "hash 定这一枚看哪 720 变体, **此刻几点决定你看到哪一件**; 收藏的是一天不是一帧; 每分钟一貌" | ❌ **机制讲反** | 分钟归属由 **tokenId** 定, 不是时钟也不是 hash: `v.init(42)` 固定种子洗牌 0..719 → `Ie=be[parseInt((tokenData.tokenId+"").substr(-4))%720], Ue=Ie%60, Ge=(Ie-Ue)/60` — 每枚 token 被固定分配**一个专属分钟**。视觉变体参数全部来自 hash (`v.init(tokenData.hash); he=v.r` → me/Ae/Fe/Ne/Se/Ce...), 与当前时间无关。当前时钟只做两件事: 画活动表针 (`i=Date.now(); ... l=p(f/60)%24; u=.5*d-l*d/6, c=.5*d-f*d/30`) + 当现实分钟命中本枚专属分钟时置激活旗 (`ze=f==Ue&&l%12==Ge, Oe=f==Ue`)。**收藏的是一分钟** (720 枚合起来才是一天), 到点作品"庆祝"自己 — 不是"此刻选帧" |
| 720 循环 (12 小时表盘, 错过明天再来) | ✅ | `l%12==Ge` — 12 小时制, 专属分钟每天命中两次 |
| 17KB 原生 js | ✅ | 17109 bytes; 原生 WebGL (`getContext("webgl",...)`), 无 p5 |

**严重度: HIGH** — 本课头牌 claim ("时间=身份本体, 此刻决定见哪件") 把机制讲反:
身份是 tokenId 分配的固定分钟, 时钟是活表针+到点庆祝。"时钟流派三样本"表格中本课行
("身份本体: 一分钟=一件作品"倒是碰巧接近真相, 但正文解释是反的) 与 L27 行
("氛围档 Golden Hour" — 已在 L27 节证伪) 都需修。

---

## 汇总

| 课 | 严重度 | 核心发现 |
|---|---|---|
| L16 | HIGH | 漏了 TerrainViewShader GPU 光照 (Fresnel+9灯), "shader 只有一行"以偏概全 |
| L18 | LOW | 全对 |
| L27 | MED | Golden Hour 等是调色板名, 非时钟氛围档 |
| L29 | LOW | 全对 |
| L35 | MED | 变换是单抽 trait 轴, 非"算子链" |
| L43 | MED | u_g=gamma 非 grain; "参数全从 hash"实为大半常量; grain 随 u_time 动 |
| L44 | HIGH | textBoundingBoxes write-only, "碰撞避让"机制不存在 (真机制=长度分档降字号) |
| L45 | LOW | 全对 |
| L50 | HIGH | 分钟归属=tokenId 固定分配, 非"此刻选帧"; 收藏的是一分钟不是一天 |
