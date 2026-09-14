# Atlas — Agent Handoff / Context Brief

> **Why this file exists.** The working agent's persistent memory lives **outside the repo**
> (`~/.claude/projects/.../memory/`) and does **not** sync via git. The owner rotates machines
> between Bangkok visits, so this doc carries the durable, code-not-derivable context forward.
> A fresh agent on a new machine should read this first. Last updated **2026-06-23**;
> **capability catalog (§0.5) + staleness banner added 2026-07-21.**
>
> This is a **curated** brief, not a dump. It captures decisions, rules, state, and pointers —
> not things you can read from the code or `git log`. When in doubt, the code + `docs/STATUS.md`
> are the source of truth for *what exists*; this file is the source of truth for *why* and *what's next*.
>
> ⚠️ **STALENESS (2026-07-21):** §3 "current state" and §4/§7 are frozen at the sphere-fill-gauge
> (#134, late June) era. Since then, at least: **Theater v2** (#377, "the fighting camera", replaces
> the #119 landing described in §3); **Present 2D end → ~S101** (#376); **4D SDF work** (`apps/fourd/`
> + a duoprism generator) which is **absent below**. Trust this file for *why/rules/architecture*;
> for *what's current* use §0.5 + the code + `git log`.

---

## 0. Orientation (read this first)

- **Repo root:** `c:\altas\sdf-js` (Windows). Source lives under `sdf-js/sdf-js/src/`. Yes, the
  nested `sdf-js/sdf-js/` is real. Docs at `sdf-js/docs/`. Tests at `sdf-js/sdf-js/scripts/test-*.mjs`.
- **What Atlas is:** an engine that turns **LLM-written symbolic code → editable 3D graphics**,
  built on **SDFs** (signed distance fields) raymarched on the GPU. The thesis: LLMs are *closed*
  over symbolic/code state (millions of lines of it in training) but ~zero over hand-authored vertex
  arrays — so "LLM writes the world as code" beats "LLM calls a renderer" or "diffusion samples pixels."
- **The product (LOCKED):** **Atlas Present** — a *spatial-narrative presenter*. The engine serves
  this app (identity inverted: engine exists for Present). See §5.
- **Dev server:** from `sdf-js/sdf-js/`, run `python3 dev-server.py 8001` (port 8001, `Cache-Control: no-store`).
  Visual verify via Playwright MCP (or `/browse`) at `http://127.0.0.1:8001/...` — **not** by asking the
  user for screenshots. ⚠️ Multiple clones exist on the Mac (`~/dev/sdf-js`, `~/Documents/…`); a stray
  server can serve a *different* clone than you're editing — confirm its cwd. Repo root on the Mac is
  `~/dev/sdf-js` (the §16 `c:\altas\sdf-js` path is the old Windows machine).

---

## 0.5 Capability catalog (2026-07-21 — the full "what can we build" map)

Core framing: **start from SDF (2D/3D/4D) → what can we build.** SDF is the engine/form-axis;
**Present is the product.** Everything is **static + BYOK** (browser → `api.anthropic.com` directly,
no backend); live at **https://shaun8149.github.io/sdf-js/** (Pages from `main` root, no build).
Nested paths: apps `sdf-js/apps/`, examples `sdf-js/examples/`, engine `sdf-js/src/`.

**Engine core (form axis).** 2D SDF library (`src/sdf/sdf2.glsl.js`) · 3D SDF raymarch (`src/render/studio.js`,
PBR, 10 material kinds; +7 other renderers) · **4D SDF** (`apps/fourd/` — hypersphere/tesseract/duocylinder
+ a **duoprism generator**: any 2D SDF × any 2D SDF = a 4D body; square×square=tesseract, circle×circle=duocylinder).
The engine is **dimension-agnostic** — same ops in 2D/3D/4D (this is the thesis, made literal).

**Generation (LLM writes the world as code).** text→2D SDF illustration (`examples/mvp/`, Compositor Text tab)
· text→3D SDF "lift" + WASD fly (Compositor) · deterministic chart 2D→3D lift (`src/scene/lift-2d-to-3d.js`, NO key).

**THE PRODUCT — Atlas Present.** text → **IR** (`src/scene/text-to-ir.js`, 5 structures) → forks:
- **text → 2D deck / "PPT"** ⭐ `apps/present/author-2d.html` — quick 3-5p / full 10-20p, **exports PPTX+PDF**,
  `?demo=1` = no-key demo. *The capability the owner most wants exposed for others to use.*
- **text → 3D spatial world / "video"** `apps/present/author.html` — `assembleDeck`, one continuous world,
  camera flies between stations, presenter mode.
- 2D deck → 3D handoff (`deck.json` contract), prebuilt deck player, `figure.html` viewer.

**Showcase / no-key surfaces.** **Theater / 放映厅** ⭐ (`apps/present/landing/`, three.js, Theater v2 #377 —
cinematic screening room, live-shader screen, clickable hero-deck posters → fly in; three.js QUARANTINED here
only; **candidate homepage**) · Live gallery (Compositor Scenes tab) · 4D toy (`apps/fourd/`) · art-style demos
(`examples/sdf/`) · Compositor (`examples/compositor/`, flagship multi-tab app).

**Gap (2026-07-21):** the public entry only redirects to the Compositor. No front door surfaces Present /
Theater / 4D. Direction: polish the Theater into the homepage, other capabilities as a menu.

---

## 0.6 姊妹项目 DIMENSION（全链上生成艺术，独立仓）— 3D 端现状（2026-08-20）

**DIMENSION**（BOB 续作，10000 件全链上生成艺术，2D/3D/4D 三宇宙）代码在独立仓
`~/Documents/sdf/DIMENSION`（不在 sdf-main 内）；设计稿
`docs/superpowers/specs/2026-08-11-dimension-nft-design.md`，本轮计划
`docs/superpowers/plans/2026-08-17-dimension-3d-solids-depth-flow.md`。

3D 端已 ship：scene 34「正几何台」经**构图 v2**（2026-08-20 user 终裁）——12 种规则
几何体 + 布尔词汇池，骨架反投影摆位（`armatureRoll`/`backProject`）驱动五构图型
monument/colossus/hover/closeup/stilllife（30/25/20/15/10）+ 穿刺/相贯/衰变行修饰符；
配色改走 **PAL3D**（93 套 LLM 配色方案，sdf-main `harvest-palettes.mjs` 收割自 107 件
2D 风景语料，逐套溯源）。入 3D 轮盘 4/13≈31%（user 锁定）+ 景深（probe dist → fog/DoF，
档位概率维持现状）+ 3D 流光（右键触发，hit-mask→chamfer 场→2D 电流核移植，WebGL 优雅
降级）。确定性战役 R1-R3 清零裸 `Math.random` 并恒定化随机消费次数耦合，同进程同 hash
0 像素差，98/98 测试绿。
**⚠️ 上链前阻塞**：细线边界跨导航/跨进程差异（非级联，典型 8-12% 像素/视觉薄边界抖动）。
疑似引擎级浮点/光栅差异（JIT 假说未证实；终审指出证据签名〔逐 document 稳定、跨 document
分裂、细线非级联〕更像 canvas 光栅后端逐 document 差异；判决实验=JS 侧落笔 checksum 跨导航
比对，应先做，优先于下面的补救方向与 `verify-determinism.mjs`）。上链前阻塞项记录于
DIMENSION 仓 `.superpowers/sdd/2026-08-17-dimension-3d-solids-depth-flow/progress.md`
（🔴条目）。判决结果出来前，`Math.fround` 纪律/定点化/多渲取众数三条候选补救可能瞄错层，
暂不投入。押后待圈（未定案；user 最后一次提及倾向先试布尔雕塑系，
但明示"剩下的再说"）：布尔雕塑 / 柏拉图殿 / 分形 / 变形静物阵列；scene 33（SceneData
语料台）保持 dev-only 不入池。

**batch2 收官（2026-08-21）**：押后待圈里的"布尔雕塑"一项已完成——`SCULPT_POOL` 八件
（斯坦梅茨体/方孔圆球/穹顶残殿/笼中球/死星/拱廊/咬过的苹果/沙漏）进构图 v2 主件三分池
（原语 55%/布尔 25%/雕塑 20%），逐件全套对抗（8×3 contact sheet）后 user 四裁：八件
全留；紧凑凸形（steinmetz/cube-pierced-sphere/ruin-dome/death-star——task-4-report.md
§2 统计出的 cov34 p50 0.79-0.89 同型分布组，即 user 终裁时实际看到的呈裁材料）在
monument/colossus 型 `hF` 压 cap 1.0（结构性偏近景，已修；修复轮 2026-08-21 订正：
曾误换成含 bitten-apple 的另一组，未对照 T4 实测指标核验，审查发现后已还原照呈裁
材料四件）；电流 WebGL 视觉 user 自看不阻塞；fallback 件间差异（1.75–42.25%）留档，
与"柏拉图殿/分形/变形静物阵列"等下一卷内容一起评。另补 `set_features` 六键艺术语义
traits（Composition/Palette/Forms/Modifier/Terrain/Depth，scene 34 专属）；落笔
checksum 判决实验结论：双病灶（JS 残余 + canvas 光栅器）并存且会话依赖，详见
DIMENSION `test/judgment-report.md`。DIMENSION 测试 104→179，HEAD 见 DIMENSION 仓
`.superpowers/sdd/2026-08-20-dimension-3d-batch2/`（本地 gitignored，跨机器需重新走
`git log` 核对 commit）。

**策展手术 + 4D 拼板（2026-08-22）**：维度终裁表落地——tier 权重 2D 78%/3D 5%/4D
16%/升维 1%；BOB 六景/老 3D(7,8)/老 4D(9,10,12-14)/韵脚 2D(11,15,16,24)/静物台(23)/
韵脚 3D 台(18)/圣物殿(19-22) 全部退场（文件与 CHAIN_FILES 不动，`?scene=` 强制口原样
可达，退场只退自然路由）；2D 内容池收敛到 scenes 30/31/32（38/38/24），物件风格轴
painted 归零（before 99/neon 1，`?style2d=painted` 仍可达）；新建 scene 35「4D 拼板」
——一件作品 = 同一 4D 胞体在多个 w0 切片拼成的板网格（拼 4 70%/拼 16 30%），内容池
glome/cell5/8/16/24 五件各按 25/15/15/15/15，另有 cell120/600 两件精确半空间交 SDF
（数学验证通过）因真管线性能超预算（grid 路径单板等效 ≈41.6s/171.5s，门禁 8s）判定
降级不入池（权重 0，`?poly=` dev 口仍可达）；B4_SCALE=0.5 场景门控（scene 34/35）转正。
DIMENSION 测试 179→281，HEAD=`d02061d`。批量交付 batch6（30 枚，自然 hash 过滤
2D/3D tier，实际 27:3）+ batch7（20 枚，4D 拼板首批呈裁件，拼4:拼16=13:7）落
`~/Downloads/genlab-2d3d-batch6/`、`~/Downloads/genlab-4d-batch7/`；batch7 为呈裁件，
拼板品相/胞体权重/120-600 去留待 user 终裁。sdf-main 侧 `sdf-js/examples/genlab/
style-plan.json` 已同步全表改版（分支 `genlab-4d`，见 PR）。

**铸造准备卷（2026-08-25）**：T1 scene 17 升维图 2×2 拼板化重生（四板同一主题形体跨维呈现）；
T2 确定性三票（weave 舍入死区 + 排序 tie-break + 铸造快照单进程契约 `test/mint-snapshot.mjs`）；
T3 dev 口摘除（链文件零 URL 解析，dev 能力外迁 `dev.html`+`dev/dev.js` 装配后 monkey-patch）；
T4 p5 走 cdnjs+SRI（本地 p5.min.js 留作 dev fallback）；T5 2D 基石库 traits 三键
（Piece/Style/Category）；T6 小修七项（阴影灰环两档/glome 贴线残余 wOffset 最小幅度/渲中右键
pending 自动点火/boundedField Lipschitz 注释/`test/evidence/` 证据库建库/T1 两注释勘正/judgment
墙钟勘注——commit 标题曾写"四连"，实为七项，M10 终审勘正 2026-08-26）；T7 800-hash 大规模废片体检（纯观测，统计摘要见
`docs/superpowers/specs/2026-08-25-mint-checkup-summary.md`，图集 `~/Downloads/genlab-mint-checkup-batch13/`）。
测试段位 179→281→卷初 285→收卷 **422/422**（实跑），HEAD=`36ee79f`。
**终审修复轮（2026-08-25/26）**：opus 终审判 "Mint-ready: With fixes"，两裁定（I1 票①保留+诚实
文档；I4 契约="同 hash+同时刻→逐位同画面"）后 C1（mint-snapshot 链原生复活）/C2（归档判据=PNG
sha256+manifest 三处统一）/I2（票①② 基线常设锁，变异必红）/I3/I5（52 枚子集真 `index.html` 复跑
六判据全零——体检页=铸造页闭环）+ M1-M10 全落。测试 422→**468/468**（实跑）。

**3D 扩容+配比卷（2026-08-26..28）**：T1 tier 配比 4D 减半让 2D（78/5/16/1 → **86/5/8/1**，1000-hash
卡方双 PASS）；T2 SceneData 解释器复活进链（extrude/revolve/polygon + fitParams）+ demo-lifts 217 件
对抗审策展 **11 件语料档 LIFTED_POOL 入池**；T3 柏拉图殿五体齐（dodeca+icosa 入 SOLID_POOL、嵌套对偶
两件——**发现 sdf-main `d3.js` dodecahedron 笔误**：逐字复用 icosa 平面族且漏 (1,1,1) 项，本 PR 勘正
`d3.js`+`sdf3.glsl.js` 两处公式体，以 DIMENSION `scenes/scenedata.js` 勘正版为准）；T4 分形档
（sierpinski 入池 2%／mandelbulb 82.9s=4.3x 最重基线判死降级权 0；确立 **vm 自然流保真纪律**：任何
自然 hash 猎手必须逐行镜像浏览器 setSeed+pal/pal2+shuf 全消费）；T5 填充八件（扭塔/弯月柱 →
SOLID_POOL 16，组合六件 → SCULPT_POOL 16）——主件终态**五分路由** 47/21/17/15 draft ×(1−0.02) +
分形带 2%（呈裁）。T6 收卷：**600-hash 真浏览器体检 0/600 废片**（判据七桶全零；措辞收窄（终审
I3）：系**渲染健康度体检**——黑屏/纯色/近空对本管线结构性难触发，不构成品相背书，品相判据另立留下卷；
tier 落点 84.8/5.8/8.5/0.8 χ²=1.28 PASS；forced-600 保真流扫掠五分路由 χ²=4.70 PASS，24 件新内容各
≥5 次命中——forced-s34 口径（终审 M7）：强制 scene34 后池内自然路由，非全自然 600 口径）+ 指纹重
基线 12 枚（`test/evidence/task6-expand-rebaseline/`）+ batch19 24 枚全自然样张
呈裁（`~/Downloads/genlab-expand-batch19/`）。测试 468→**679/679**（实跑）。`style-plan.json`
全表刷新（本 PR）。**呈裁待 user**：五分路由权重／sierpinski 2%+mandelbulb 降级去留／CAGE_COMPACT
与 FILLER_COMPACT 名单／lifted 压限／batch15-19 品相；终裁后混合 minify 正式提交另行执行。

**3D 品相根治卷（2026-08-29）**：T1 全池 49 形 N≥50 cov 扫掠 → 四份 hF 压限名单合并为 **COV_COMPACT 16 件**（判据 p50>0.85，新增 7 件，行为逐位等价实证）；T2 closeup 兜底追根（窗重标 1.0+hFP*0.7 + 专属帽 1.1，兜底 53.5%→19.5%）；T3 mandelbulb 等价优化入仓（bbox 预剔除+步进 0.8，−18%）仍 6.3x 最重基线 → **判决留 0**；T4 收卷 100-hash 真浏览器复检 + batch23。测试 679→**711/711**（实跑）。呈裁待 user：pyramid 去留／帽后残余三件／lifted closeup 空幅 6/200／dev 口 mandelbulb 观感追认／batch20-23 品相。

**活画卷（2026-08-31）**：把每件作品变成"活的画"。T1 **出生偏移+日照窗**——契约升格
**「同 hash+同时刻+同 mintTime→逐位同画面」**：`tokenData.mintTime`（unix 秒，可选字段，合约侧传铸造
区块时间戳）→ birthOffset = 该时刻 UTC 时 h，缺省 hash 派生 h∈[0,24)（独立派生 sfc32 流，零主流 r()
消费）；T_eff=(墙钟h+offset) mod 24 全 CHRONO 统一，3D/4D 光照走日照窗 T_light=5.5+13·(T_eff/24)∈[5.5,18.5]
（t=12 唯一不动点）。T2 **2D 逐笔 generator 恢复**（weave/warp 逐笔 120 段/neon 逐行 96 段，2-4s 刷完，
完成态 vm 逐位 10/10；generator 分帧让 2D 像素首次跨 document 可复现 H-H 3/3）；T3 **装裱系统**（画心
0.93+3.5% 暖卡纸留白+勾线+落款 "shaun"+红方印「肖恩」+日月时钟标活层分钟走针，装裱零 roll，指纹全库
一次性重基线）；T4 **开场日扫**（排水完成后 2.6s 光色扫 24h 落定 T_eff——色调映射近似 DOM 叠加层，
主画布零触碰=落定态逐位归档态，`?t=`/mint-snapshot 不播扫；真浏览器 7/7 全 tier PASS）+ 100-hash
快速回归（七桶判据+装裱不变量全零）。测试 711→**823/823**（实跑）。`style-plan.json` 新增时间轴/装裱
两节（本 PR）。呈裁待 user：2D 深夜幅度／黎明缘月亮支／birthOffset 进 traits／neon 31s／印章位置与
朱白文口径／墨色自适应追认／batch24-25+日扫 batch26 观感。

**渲染性能卷（2026-08-31..09-01）**：user 裁定「4D 最坏 59 秒必须处理掉」→ 目标最坏
time-to-`$renderOK` ≤20s，硬验收 = **输出逐位不变**（墙钟优化零像素变化）。**T1 排水节拍
时间预算**（profile 定音：3D/4D/升维重件墙钟 71-77% 系逐帧排水的帧间空转、非 probe CPU；
`DRAIN_BUDGET_MS` 30ms 门控 scene 17/34/35，执行序完全不变 = 逐位构造性成立，2D 预算恒 0
逐笔观感零扰动；4D 最坏 61.7→**14.9s** / 3D 47.5→**7.3s** / 升维 50→**10.9s**）；**T2 计算型
长尾 worker 化**（`render2d/parallel.js` 静态分块 + 主线程合围兜底；链装配走 worker 内
importScripts——主线程 fetch 会被合围帧饿死至提速静默归零，教训锁进测试；neon 48.0→**14.4s**
/ weave 21.0→**8.5s**）；**T3 收卷**：100-hash mint-snapshot 口径分布刷新（活画卷 T4 固定池
全 tier）**p50 5.7 / p90 9.3 / max 18.0s，0/100 超 20s 达标 PASS**（九桶判据全零；3 枚 CDN p5
冷取白屏超时系 harness 伪影，复核即过）。逐位判据面 T1 14/14 + T2 14/14（vm op 流 +
`__CK`/2D `__PX`）。DIMENSION 测试 844→849→**869/869** 实跑。记账勘正：plan「无 worker 回退
路径」验收句在 T1 转向预算制后语义空转（T2 起回退 = 四重门控串行，已验）；T1 报告误落
sdf-main 侧已迁回 DIMENSION 仓 sdd 目录。`style-plan.json` 顶层 `render_perf` 节新增（本 PR）。

**时间重塑卷（2026-09-03）**：user 裁定①②——① **2D 时间分布重塑**：`chronoRemap2d` 把墙钟(T_eff)
单调分段线性映射进四段审美带（墙钟时长 **昼 65%/昏 10%/晨 10%/夜 15%**，值域按 ANCHORS 段落界
夜[20,4)/晨[4,8)/昼[8,16)/昏[16,20)；t=12 与 t=0 浮点精确双不动点；?t= 穿过 remap，t 恒墙钟口径；
带心落名锚 3→6 卯·破晓 / 21→18 酉·日落）；`CHRONO.hour` = 画中时刻 T_2d（时钟指针夜快昼慢），
T_eff 账面新增 `CHRONO.tEff`；3D/4D/升维日照窗 tLight 恒由 T_eff 直算**不动**（可执行锁 0.6875
黄金值逐位保持）；级联：night/日月标/朱文印自然变为时均 15%。② **夜段专属**：夜色提亮一档
`NIGHT_LIFT`{lmMul 1.15/lFloor 0.035/skyMul 1.15，draft 呈裁}+ 画面中上部 2-4 处暖色柔光晕
`computeNightLamps`（独立 sfc32 侧流，种子=出生偏移流种子⊕0x9E3779B9，零主流 r() 消费；灯进主画布，
昼/昏/晨零灯光零扰动；painted 豁免同 chrono 色温面）。指纹重基线：t4 池 100 行钉时刻 t=12 重算——
**2D 85/85 逐位回归 t4 基线**（84 批内 + 1 枚批内瞬时光栅漂移复渲 3/3 逐位复归），3D/4D/升维 15 枚
跨导航漂移域照旧结构判据；夜点检 6 枚双渲 **12/12 pairEqual**（夜灯逐位确定）+ 晨/昏各 4 枚带心
落点全对（`test/evidence/time-remap-rebaseline/`）。测试 876→**908/908**（实跑）。batch30 样张 12 枚
（四段×2 组 + 夜灯新旧对照 + 3D/4D 日照窗确认，`~/Downloads/genlab-timelight-batch30/`）。
`style-plan.json` chrono_axis_living 新增 `time_remap_2d`/`night_lamps` 两小节（本 PR）。呈裁待
user：四段时长口径追认／NIGHT_LIFT 三参幅度／夜灯参数（数量/位置带/半径/强度/暖色）／时钟指针变速
（画中时刻）观感／batch30 品相。

**观感终裁批（2026-09-03..05，user 逐项裁定）**：时间重塑卷呈裁全按推荐终裁——NIGHT_LIFT 三参与
夜灯参数追认转正／neon 同享夜灯／时钟指针=画中时刻保持／朱文时均 15% 接受／日扫维持色调映射近似。
**印章昼夜制**（2026-09-02，取代当日早先的 hash 奇偶 50/50 制）：sealMode 由日月标路由
`mountGlyphKind` 单一真源派生——日标→阳文（红底浅字）／月牙→朱文（纸底红字），3D/4D/升维恒日照窗
恒阳文；**钤印定格**（落定时刻定制式，观看中不翻，与时钟/日月标活层的对比=印是画的一部分）；
测试 869→876。**2D 电流核换血**（2026-09-05，user 报"2D 右键流光退化像精子头大尾小"）：诊断=2D
右键从未升级、仍走 2026-08-14 field-flow 彗星，而厚电流核 v5.2 只接了 3D/4D——修=`attachCurrent2d`
直喂 `attachCurrent3d`（单一真源零参数分叉，field-flow 选件逻辑保留：骑大主体/单环/满幅优雅无为
恢复原生菜单，user 三裁）；fix1 根治骑画框白团（160² mask 画框截断人工等值线→出框段修剪成框内
开路弧+渐隐+跳绘，"弃环→修剪"偏离经复审反事实复算批准）+亮底自适应减档 gain 1→0.55；fix2 折返
端点速度包络（2.5× 提速+压亮 0.3，聚亮团消灭）；共享核对 3D/4D 逐字节零扰动（FS 恒等锁 A/B）；
观看层 r() 消费 1..5 次/hash（纯几何跨环境恒定、画面定稿后，判合规非 Critical）。测试 908→**953/953**
（实跑）。batch32+fix1/fix2 样张（`~/Downloads/genlab-current2d-batch32/`）。电流案 draft（包络三常量
/F2 减档参数）user 目检"效果很不错"全按推荐追认。

**逐笔显影幕 + 日扫拉长（2026-09-05，user 目检截图两裁）**：①逐笔动画期间未画区裸露 wash 平色
+水平接缝线（诊断：渐变 bg 分 24 段脏矩形经 mountBlit 0.93 缩放 drawImage 的段界重采样，亮 3-8 LSB；
完成态里被笔触盖住属既有亚视觉债）——修在观看层：`WEAVE_FRONT` 前沿通道（只写不读）+ mount.js ⑥
逐笔显影幕（DOM overlay 盖 pa.bg 纸色随落笔前沿逐帧揭开，12px 湿边；主画布操作流一字不动，修前修后
终态同 git blob + 双端 ck/px 逐位回归）；②日扫 durMs 2600→**7000**（自然观看 renderOK ≈10s=排水3+扫7；
mint 口径 `__mountSweepOff` 零影响，性能卷 18.0s 不动，README 平台注记双处）。测试 953→**976/976**
（实跑）。batch33 样张。挂账：真"wash 并进笔序"须完成态重基线（另起卷呈裁）／湿边 PAD 口味／
mountBlit 接缝亚视觉既有债。

**迷彩件修复（2026-09-05，user 截图报"物体轮廓与背景分辨不出+尺寸太大"）**：诊断=①尺寸：cov 合法
上带 (0.92,0.96] + 摆位兜底后不复检（cov 可达 1.000 满幅）；②撞色：PAL3D startIndex 旋转 2/3 概率跨
role 边界产生从未验证的交叉配对（84 套中 10 套交叉对 ΔY 双双<25），渲染端零对比守卫。双症状率
0.83%（万件 ~83）。修=**b2 渲染端对比守卫**（bg 池 vs obj 池 ΔY<40 时对物体弧确定性 HSL 明度偏移，
0.02 步长搜索至 ΔY≥46，双向定向、钳 [0.04,0.96] 构造性必达；scene34/35/17 三场景同享；零 roll，
ΔY≥40 恒等路径即刻返回）+ **a1 兜底复检**（兜底后 cov>hi 则 hF×=min(0.85,hi/cov) 纯几何重摆 ≤8 步，
零 roll）。600 复扫：迷彩 5→**0**／dY<40 98→0（修后 min 46.1）／cov>hi 4→0；健康件 502/502 palSha
逐位恒等；2D 85/85 逐位；t4 池受影响恰 2 行重基线（`test/evidence/camo-fix-rebaseline/`）。测试
1008/1008（实跑；run-tests 纯插入零删改）。呈裁：camo4 类贴线件观感变化轻（守卫合同面=环判据非
像素域）／TARGET=46+STEP=0.02 draft。记账：index.js 守卫注释"不留残余"表述待勘正。

**纹样体系卷（2026-09-06，user 终裁全案圈定，前置=同日 warp 和风纹样初版三族 100% 带纹）**：和风
纹样 3 族→**十族**（青海波/麻叶/小花散点 + 鳞文/流水/立涌/七宝/霞/龟甲 + 等距晕实验族——纹=层自身
已扭曲 SDF 的等距环带，唯一"纹随形生"）+ **Qilin 三机制**（recipe-only 机制层学习零抄码：面积双边门
[3.5%,55%]+最大层恒素面／语义白名单加权——`WP_SEM_TAGS` 268 条 pieceId→tag 人工 curated + 6×10 权重
表加权单 roll+Focal 轮转不重样，3D 侧 kind→tag 47 键复用同表／磨损层 hash 反啄默认关呈裁）+
**扩面转正**（2D before/after 40% 静置纹样、warp 维持 100% 随形流动、themes 豁免、3D scene34 33%
triplanar |n|³ 掠射根治+单 probe，scene35/17 不接锁死）。全部独立 sfc32 侧流零主流 r() 消费（五方
种子互异；roll 计数收卷勘正统一含预热 WP=33/ext2D=16/ext3D=23）。T3 唯一大重基线（t4 池 100 行三笔
账一起收：带纹 20/20 应变+素面 44/44 逐位+豁免 20/20 逐位）；T4 vm 口径 15/15+浏览器 2D 85/85 逐位+
性能 A/B 块状中位 +1.4%。**T5 收卷体检**（固定池 100 hash，渲时 wrapper 实录+渲后重建双口径）：九桶
全零；2D gate 37.5%（n=64 噪声内，独立重建 41.1%）；warp 无 gate（不抽签，带数仍过双边面积门，全员出窗→素面 ~4%）；themes 0；3D 2/7（100k 32.88%）；
族分布 31 带十族全出现；语义命中率 82.4%（期望 63.5%）。记账勘正小刀：TRI_POW 字面锁／monk-sea→
sky-cloud 改判+snowflake 复核维持／roll 口径统一／**迷彩卷 index.js"不留残余"注释勘正兑现**（上段
记账项收账）。样张 24 枚 `~/Downloads/genlab-pattern-final/`（2D 十族+3D 六族+自然 warp 2+夜段对照
4）。测试 1008→1032（warp 初版）→1045（卷基线）→1061→1070→1085→1105→**1106/1106**（实跑）。
`style-plan.json` 新增 `pattern_system` 节（本 PR）。呈裁待 user：磨损层开关与浓度／等距晕实验族
去留／双边门参数／权重表 draft／curation 余项／poisson 纹样偏弱增强否／batch 样张品相。

**warp 提比 + 达利物件（2026-09-06..07）**：user 见 warp 纹样"挺美的"→ 风景池 warp 5%→**15%**；
物件池 warp 0→**30%**（"确实有一种达利的感觉"；怀表/小提琴/沙漏熔化语法最强）；全库 warp ≈14.7%。
划分窗 IEEE 位级重合验证（neon 尾窗零翻转，翻转唯 before→warp）；t4 池 19 翻转行重基线，非翻转
66/66 逐位。**豁免名单** `WARP2D_EXEMPT`（眼镜/打字机/莫兰迪瓶——细线框/密集机械/多件重叠熔后
失身份，折纸鹤不进）warp→before 纯判定重映射零 roll。**3D 裁定完全不走 domain warping**（warp3d
原型零第三态剥离）。测试 1106（锁重标零增删）。

**Fidenza 流场缎带（2026-09-07，recipe-only：Fidenza 无授权文本判最严档零抄码零调色板）**：
源码精读三要素=八档几何级数宽度混布/碰撞让位（grid 哈希+lookahead 防残段）/弧长分段变色。
实现：每渲 CPU bake 512² 双通道 atlas（{patT,色槽}）→ 主导面 triplanar O(1) 采样 → wpExt3dShade
解码（零新 raymarch，+1~3%）；**scene34 独立稀有档 FR_RATE=10%**（第七方侧流 ⊕0xa24baef7，
七方种子互异），kind 白名单 13（球面/穹面类 10 件剔除）；**v1.5 彩带**=弧长段 PAL3D 12 环内
加权选色（本色族 75%/跳色 25%，环外零引入）+ bg 族对比檐 K=0.32（守卫先后序构造论证：守卫
原位改写 pal 数组，atlas 存槽 fill 时解码恒吃守卫后色）；traits Modifier='Flow-Ribbon'。
测试 1119→**1132/1132**。batch39/40 样张。呈裁余项：ground 檐/波地 flat 豁免/留池三件
（cylinder/cone/graphics-mountain）追认（?fr=1 dev 对照口经审查建议保留）。

**Edifice 砖砌档 + 三窗互斥（2026-09-07，recipe-only 最严档）**：user 否 Ringers（"要铺满整面"）
点名 Edifice（Ben Kovach #204，deep-dive 02 精读已备）。三填充器 tag 圈地（RandomWalk/DistToStart
三度量/Spiral 年轮）→ flood 成砖 + 针脚 running-bond + PAL3D 环内面积加权固色 + 斥力源少步数侵蚀
→ 与彩缎同套 512² atlas→triplanar 管线（第八方侧流 ⊕0xed1f1cff 八方互异）。转正四连（user 全按
推荐）：**单 roll 三窗互斥**——彩缎 [0,0.20)/砖砌 [0.20,0.28)/素面（gateRoll 原位透传零 roll 变化，
彩缎命中集零扰动三证；ED 侧流原 gate 位改让位槽保位=转正与原型样张逐位可比）；跳色降权 90% 本色
+檐零新代码继承；traits Modifier='Masonry'+Grain 五值（未中不落键）；**ground/波地豁免两档共用**
（|solidsStageSdf|≥0.02 判据与病灶构造互补，十族恒不豁免 T4 逐位原封）。彩缎提频 FR_RATE 0.10→0.20
（"这个美更值得常见一点"，5000-hash 19.78%）先行入链。测试 1132→1153（原型）→**1172/1172**。
3D 装饰体系定型三层：十族纹样（材质）/彩缎 20%（流动构图）/砖砌 8%（建筑构图），后两档互斥。
HASH_NATURAL34 自然翻入砖砌窗（合法兑现，锚点全清点重锚）。铸前呈裁：Grain 命名/Masonry 命名追认。

**纵深卷（2026-09-07..08，衔接补记一句）**：avenue 纵深廊构图第六型入表（closeup 降 7%）+ 4D
拼板装饰解锁等，测试 1172→1293——该卷 sdf-main 侧账目未单独立段，此句补记衔接测试链。

**构型扩容+光影卷（2026-09-08..11，plan `2026-09-08-dimension-form-and-inkline.md`，1293→1469）**：
batch43 审图季裁定风暴（十余道审图令一卷吃尽）+ user 藏品级定调驱动的双主轴卷。**构型面**：T1
遗址建筑语汇十件（ziggurat/gate/broken-colonnade/altar-steps/obelisk-row/broken-dome/archway/
aqueduct/broken-stele/watchtower）入 SCULPT_POOL 16→26（池加长不改 roll；立面六件 KIND_PLANAR
ry 窗；高兜底三件入 COV_COMPACT；五件直写标量内联 1.8-3.4× 提速逐位等价锁）；T1b「对比锚」
scale-anchor 构图（user 埃菲尔铁塔蓝调参考图令：近景巨物压缘+远塔雾中+地平线 mini-stele 尺度锚）；
T4b「拱廊内景」interior 构图（user 砖拱廊剧照令：连拱退行+厚墙门洞+筒拱收顶，**光池 = 既有影判据
自然涌现**）——scene34 构图终态**八窗 26/20/5/18/7/12/6/6**（monument/colossus/anchor/hover/
closeup/avenue/interior/stilllife）；T2 lifted 复捞 486 文件全量二次普查唯一过三标准件
product-chrome-spheres 入池 10→11（+15-25 目标未达成如实报——具象件首轮捞净，扩池正道 user 已裁
atom 生成器移植立项，city-skyline/canyon/gear 族优先，排 4D 影雕卷前后）；收口小刀集三刀（poisson
方言降十倍 99.5/0.5、4D 拼 16 废除拼 4 独占、calligraphy 文字类权 0 退场）。**2D 白天装饰**：墨线
方案 user 叫停搁置候补（"墨线是不是我们最好的选择还没讨论过"——Sudfah 胜出系控制者意见未经终裁，
零代码入仓），终裁改走**"用光来治"**：受光云系统 60%（云暗部蓝灰/受光缘金红，时段色温朝霞-正午-
晚霞联动，dusk rim 独立提亮）+ 流场淡彩 25%（天空区极淡流带，浅天档实测亮度分档治白上加白）+
主题池 warp 生产转正（pattern 恒扭/seasons+lighthouse 60%）。

**光影定调与七件套（同卷后半）**：user 藏品级定调逐字精神——"光和影是整个表现手法的核心；影子
降一维，4 维降 1 维是 3 维……重点要描绘这个影子，才能把 4D 的感觉描绘出来"。落成三维影语法：2D
影是线（不强调）/3D 影是面（本卷长影+光池主战场）/**4D 影是"影雕"= 4D SDF 沿光向投影成的 3D
实体（下卷设计核，与对偶柱立项合体归 4D 减法卷）**。T4b 光影七件套：①2D 灯光洒光（晕圈→照明，
screen 垫层软衰减）②3D 夜空星座（hash 派生 1-2 座折线星座，星不压建筑）③夜地面保暗（"地面保暗，
明暗对比=夜的骨架"）④光束渲染（解析束辉闭式零采样，fix1 收紧束读作柱不作洗）⑤夜映金保金下限
（低饱和底色相钳金域，"脏米色"根治）⑥3D 长影强化（金色带影长 ~1.8×，t=12 IEEE 逐位保持）
⑦拱廊光池。审图季另沉淀审美原则：尺度对比（"2D SDF 大小有对比的其实会更美"=马远寒江独钓构图）、
夜黑须有内容承托（与 2D 昼留白逻辑相反）。测试链 1293→1348→1375→1376→1383→1410→1420→**1469**
全绿；batch44 200 张 user 总验收逐字："基本上可以说是非常完美了……3D 非常美，每一张都很有质量。"
呈裁攒单十条（seamap 修/删 user 仍欠终裁、素面 kind/stilllife 白名单、broken-dome 三选、
AVENUE_WIDE 追认、o1-o3 光影观察、俯视件淡彩白名单、等比归一追认、closeup 0 出场复核等）见
DIMENSION 仓 task-5b-closeout-report STOP 节。

**生产四刀（2026-09-12，呈裁攒单逐条清账，1469→1498）**：knife-1 seamap 删除（user："跟我们
整个的气质不搭，真的不搭"——THEME32 seamap 2→0，themeSum 8 等比归一+不可自然到达断言，293f1b8）；
knife-2 素面白名单三件套（3D 素面档 kind 资格制：强轮廓 40 件有资格/钝形 20 件出列重映射回纹样
（零 roll 纯 lookup wp4PlainAllowed）/夜件免死/stilllife 6% 追认，35a3624）；knife-3 黄昏色温三档
（user："有的时候偏金，有的时候偏红……不要全是金"——金色带日光色 hash 派生 纯金 40%/金红混 35%/
晚霞红 25%，第十二方侧流 ⊕0xCC9E2D51，5b92254）；knife-4 星座 SDF 化重做+扩域（user："你的星座
不是 SDF，这就不美了"——astroid 四芒星+胶囊连线走织谱管线，扩全部夜件 34/35/17 整幅一座，dcdc434）。
t4 池重基线一次收（7c4b69f）。**同期补记 objects 池改造（2026-09-08，773ff2e，sdf-main 侧此前
失同步）**：user "2D 单一物体跟现在的艺术风格已经很不搭……整体权重从 33% 降到 10%，剩下的加给
3D"——TIER 63/28/8/1 + POOL_2D 16/51.5/32.5 + objects 风格窗 before19/warp80/neon1 + 物件纹样
gate 80%。

**Kusama 线网背景（2026-09-12..13，1498→1531，DIMENSION r1 935257a → r2 634c27c → 转正
80cda71）**：2D 物件池物体背后的背景区两算法档——**圆堆积**（stroke 彩圆，palette 派生深色系+
accent、墨黑 ~40% 主色调，fill-a 逐圆 30% 淡填充内置）/**细碎 Delaunay 剖分**（"库萨玛银杏叶"级：
三角面积 r1 的 ~1/10，**内圈顶点落物体 SDF=0 轮廓零等值线上 = 物体成网中之洞**（扫格+牛顿投影采样，
物内三角剔除+穿物边整边剔），线色浅淡多彩弃黑，低幅 sine 波线端点归零）。网只画物外背景（物体 SDF
作障碍），圆 rMax/rMin 与剖分种子间距逐 hash 随机（每件泡沫粒度/网眼疏密不同）。单 roll 三窗互斥
[0,0.30) 圆/[0.30,0.50) 剖分/[0.50,1) 无网，第十三方独立侧流 ⊕0x7FEB355B，消费恒定对拍锁（自然
带网 vs 强制关网后续 r() 流逐位一致）+600-hash 统计锁（32.2/18.5/49.3）。user 终裁逐字："这两张
很好，50%的概率没问题……三角和圆跟背景很融入。" 转正重基线昼夜双轮 65/65 SAME + 受影响行
predMatches 100/100。呈裁复核项七条（fill-a 默认/密度权重/圆30剖20切分/素面白名单优先带网未实现/
neon 不接/traits 未曝露档位/mint-snapshot 口径）攒 200 张批，见 DIMENSION 仓 kusama ledger。
排队中：200 张完全体验收批 vs 4D 影雕卷（对偶柱+影雕设计核）二择 user 待裁；atom 生成器移植卷
（user 已选 A）排 4D 影雕卷前后。

**色彩光影卷（2026-09-13..14，plan `2026-09-13-dimension-color-light.md`，1531→1692，DIMENSION
HEAD c590393+T5）**：batch45 审后 user 两向令（神庙光复现率提频 + "我们毕竟不是自然景观，而是艺术
……背景色跟前景物体的颜色要有非常强的对比，要不然很容易糊，因为我们都是点"）+ M5 升格令（"纹样
色彩不仅要并进 3D，2D 端也要实现跟 Qilin 一样的效果"）驱动的九刀卷，执行序 T1→T4→T2→T3→T4b→
T4c→T4d→T4e→T4f（user 令"纹样应该首先测试 2D"）。**T1 神庙光三连**：K2 GOLD3 权重回摆 55/27/18
（金回主位）／K3 碑式四型（monument/colossus/anchor/avenue）平光带折进斜光带（`chronoMonuFoldOn`
纯派生零 roll，碑式金色带占用 41.7→68.4%）／K4 神庙 palette 提频窗（⊕0x1B873593 第十四方 15%×
金色带满效×碑式 → 暖亮金 18 套 `TP_WARM18` 判据实算），封神配方 C 预期 2.0→~7.8%。**T4 纹样色三律
三角色**：恒墨退场——墨 [44,38,34]／纸 [248,246,240]／accent≡NIGHT3_GOLD，明度翻转律+耳语 0.12+
accent 贯穿，件级三窗 67/25/8；user 再裁"2D 端不用考虑光照，只处理颜色本身"→ 翻转判定读装配期本色
全时刻恒定；3D triplanar 同律吃守卫后色。**T2 影色分离**（修拉正统：影是蓝紫补色不是暗棕）：影环
四档 蓝220°/紫270°/补色bg+180°/灰直通 = 35/25/25/15（⊕0xFF51AFD7 第十五方），影深 w=exp(−d/2)
近浓远淡，夜窗早退，金光蓝影合法叠加。**T3 ΔHue 守卫**：迷彩守卫门二——bg↔物体 s-加权圆均值主色
ΔHue<30° 且双池 s>0.15 → 物体弧保明度色相推开首达标即止；触发率实测 39.15% vs 诊断 13.1%（子集
口径），user 终裁 A 保持判据字面。**T4b 三原则+15 族**：user 贴 Qilin 参考图三裁（线更细更多线／
每件≥2族／同族跨区最美）+"Qilin 有的全部实现一遍"→ 扩族 vines/crosshatch/dots/woodflowers/stars
10→15；带数窗 2..4+饥饿救济+回响带 → 多族率 31%→83%；全卷合并重基线昼夜双轮此处冻结。**T4c
Kusama 圆语法 QQL 化**（qql-art/qqlrs art.rs Apache-2.0 精读，recipe-only 机制级自写）：件级
BullseyeGenerator——rings 构型 {1}/{1,2}/{1,3}/{1,2,3,5} 30/25/25/20 × density 三档 Thin/Thick/
Mixed 40/25/35，同心双色交替+实心小圆特例+防肥钳（大圆倾向环、小圆才实心），KU 侧流 16821→23431
恒耗。**T4d 白堆积四刀**（user 病例"白色的堆积显得画面很脏"+裁"2D 不要白色洒光；白纹应图案清晰"）：
F1a 织谱亮区密度地板 0→1／F2a noon rim 非白金 [255,216,150]／F2b 天饰承载合法门／F3 暗层纸纹三
旋钮细而清晰／F4a accent 暖亮档除名；判收白斑 7.5→**1.9%** PASS、黄点 16→6.0%——机制黄构造性
全灭，残 6 枚逐件证明为画意合法黄，门改述"机制黄=0"呈追认。**T4e/T4f 型染定纹**（user 设计假说
"纹样不受 domain warping 影响更像 Qilin 更美"→ dev A/B 看样按族终裁）：流水/青海波/立涌/霞四族
随形保势，其余十族 pre-warp 定纹，等距晕天然贴形；霞 motif 缩 0.65×。**batch46 200 张总验收**
（seed=461001 自然墙钟零筛选，`~/Downloads/genlab-dimension-batch46/`）：九桶零废片；tier
61.5/29.5/8/1 ✓；神庙配方 C 非夜 6/59=10.2%（预期 7.8% **提频兑现**，batch45 仅 1 件且构图不利）；
影色四档 χ² PASS；纹样多族率 85.1%（参照 83%）回响 4/4；白斑复扫 1.9% + 机制黄 0 逐位复现；ΔHue
触发 51.9%（+2.3σ 偏高知情项）；CP 渲时 max 5.6s（T4c concern 关闭）；亮点 14 张点名（#035 金柱廊×
蓝影 money shot 等）。测试链 1531→1558→1574/1577→1604→1634→1642→1661→1685→1688→
**1692/1692**（收卷实跑）。`style-plan.json` gold3 转正+light_shadow 四小节+pattern_system 15 族
三律+kusama qql_bullseye（本 PR）。呈裁攒单十条见 DIMENSION 仓 task-5-report STOP 节（三律三窗／
影色权重与补色趋同知情／ΔHue 两档制／新族语义表／T4c 五 draft／黄点门改述追认／vis=1 单带清零需动
双边门／M3、M4 血统留下卷）。

---

## 1. Hard rules (NON-NEGOTIABLE — these override defaults)

1. **Git: always PR, never push `main` directly.** Branch (`feat/…`, `fix/…`, `chore/…`) → commit →
   `git push -u origin <branch>` → `gh pr create` → **STOP and wait** for the user to say "merge".
   - **Never** self-`gh pr merge`. Merge strategy is **locked to `--squash --delete-branch`**.
   - `gh` CLI on the Bangkok machine is at `& "C:\Program Files\GitHub CLI\gh.exe"`. A new machine may
     differ — check `(Get-Command gh).Source` or just `gh`.
   - Memory files (`~/.claude/...`) are outside the repo and exempt. This handoff doc is **in** the repo,
     so it goes through the PR flow.
2. **three.js QUARANTINE.** three.js is allowed **only** in `apps/present/landing/` (the marketing/landing
   shell — "walk into the cinema" intro). It must **never** appear in `src/` or in the product runtime
   (deck/slides/player). The product renders with our own studio/SDF engine. The user has said this
   repeatedly and firmly: *"我们自己的 present 永远不引入 threejs."*
3. **LLM prompts stay SHORT.** Demo/lift/system prompts use the shortest noun phrase. Do **not** list
   parts or specify the camera. Verbose prompts regress the whole "LLM writes the world" thesis.
4. **Decide abstraction-layer changes WITH the user first.** API shape, default values, algorithm
   swaps, data contracts → confirm before doing. **Bug fixes → just do them.** (A change that is
   mathematically equivalent + mirrors an existing pattern counts as a bug fix, not an abstraction shift.)
5. **Engagement style:** push back on overclaims, extend agreements, connect to art history. **No
   generic praise.** The user wants honest assessment over flattery — including blunt post-mortems of
   our own process (see the end-of-session evaluation pattern).
6. **Shader template-literal backtick trap:** embedded GLSL lives in JS template strings; any backtick
   inside terminates the literal. **Run `node --check` before pushing any shader change.**
7. **Cross-renderer constants must match** (MAX_DIST / MAX_STEPS etc.) or be explicitly documented;
   run a fleet test when porting a renderer.
8. **Read source before porting.** When given a reference shader/algorithm, actually open and read it —
   don't reconstruct from the article's prose.

---

## 1.5 视觉管线两条铁律 (2026-07-14 黑洞页事故后立)

1. **fallback 永不落向极端色**: 视觉代码里"缺数据给默认值继续跑"必须落向
   可读状态 (纸面/墨色), 永不落向黑/白极端 — `rgbCss(undefined)` 曾静默涂出
   rgb(0,0,0) 黑洞页。renderer 入口已做 partial-palette 补齐 (防御纵深)。
2. **批量出 deck 只有一条管线**: `sdf-js/scripts/batch-decks.mjs` (playwright
   驱动 examples/batch-export.html → 真实 buildDeckPdf 产品代码 + page-lint
   出厂检)。不要再写临场脚本复刻导出循环 — 抽查脚本与批量脚本不同源时,
   抽查就是安慰剂 (事故正是这么漏的)。

**🗺 场景语料总地图（2026-08-12，防重复造轮子）：** 写任何新场景/物件前先查——
demo-lifts 217 件（`examples/compositor/demo-lifts/*.json`，具象王牌：火箭发射架/哥特教堂/
灯塔/航母舰队/自行车/罗马柱廊/时钟/盆景山，注意剥 `.sceneData` 壳）· `scenes/` 247 件 ·
场景 atoms 42 个（`src/scene/components/atoms/`）· MVP 61 示例（`examples/mvp/`，铅笔/钟表/
自行车/emoji 系列）· community ports · autoscope 6 模板。全部经 `compile().sdf.f` 可 CPU
求值（火箭 57-subject 已验证）——GPU 场景语料可直接喂 CPU 渲染器。

## 2. Architecture (the technical spine)

**3-layer (LOCKED 2026-06-19/22):**
- **Layer 1 — Engine:** `src/sdf/` (SDF primitives + ops + GLSL compile), `src/scene/` (SceneData →
  compile → sanity), `src/render/studio.js` (the product renderer). The engine is generic; "rich
  features threading through a generic dispatcher" caused a whole session of bugs → decouple via a
  single shared `applyStudioScene()` core.
- **Layer 1.5 — Runtime:** `src/runtime/apply-studio-scene.js` — the shared compile+render pipeline.
  **Pipeline order:** `expandVariants → expandStage → expandChartLabels → compile → ground-union`.
  ⚠️ It does **NOT** call `expandCompositeAtoms` (composite atoms don't expand on the studio path).
- **Layer 2 — Apps:** `examples/compositor/` (dev tool / playground — its DNA is *generative-art
  explorer*, dual to a presenter), and `apps/present/` (the product host). Layer 2 calls the engine
  through public API (`window.atlasLoadScene`, `callLiftLLM`, `renderLiftedSceneData`); it must **not**
  mutate engine internals. **Compositor is engine-layer-ish; the presenter is the app — call the
  engine, don't rewrite it** (analogy: PowerPoint ↔ OpenGL).

**Renderers:** studio (the product, HDR PBR raymarch) + 7 others in the compositor
(silhouette / BOB / Lines / Crayon / Topo + FLY 3D / BOB GPU / Blueprint). WebGL context limit ~8/page.

**studio.js material kinds** (`leafTone.y` int; set via `material.kind` → `MATERIAL_KIND_INDEX` in
`src/scene/spec.js`): `0` standard Lambert · `1` sea · `2` mountain · `3` emissive · `4` translucent ·
`5` snowy · `6` building · `7` eroded-terrain · `8` glass (real refraction; **decorative, currently
unused — candidate for a demo or removal**) · `9` fill-gauge (NEW, see §4).
Per-leaf data: `u_leafMaterial[256]` (hue,sat,metal,glow), `u_leafTone[256]` (value,kind,roughness,
clearcoat), `u_leafPattern[256]` (code,scale,strength,**[3]=fill** for kind 9). Per-leaf tags ride on
SDF nodes as `_subjectMaterial` / `_subjectPattern`; **child overrides parent** in `flattenUnion`.

**Lift pipeline:** `callLiftLLM(prompt, code2d, apiKey)` → `parseLiftResponse` (a JSON-isms stripper —
markdown fences / trailing commas / comments must be stripped, this is load-bearing) → SceneData →
compile → render. Per-history-entry caching (byte-equal code2d). BYOK, local processing.

**Camera:** `src/scene/camera-sequence.js` — `cameraSequence.shots[]` {duration,pos,target,fov,
aperture,focalDistance,ease,transition,shake,exposure}; ease `smooth|linear|in|out|inout`; rack focus =
`[from,to]` DoF arrays. The validator (spec.js) and evaluator (camera-sequence.js) must stay in sync —
update **both** when adding shot fields.

**⚠️ 2D→3D 路径地图 (2026-07-14 加, 防误读疫苗):** 仓库里有 TWO 条 2D→3D 路径, 别认错主线 —
- **现役 deck 主线**: `deck.json → atlasDeckToIR (scaffold-to-ir.js) → assembleDeck
  (assemble-deck.js, 结构感知站布局 + smoothstep build-in 入场 + beats 相机) →
  render-{magnitude,hierarchy,network,sequence,matrix}.js → figure.html`。结构决定形态在这条线上
  是**已实现事实**: ir.structure 路由渲染器, 站布局 structure-aware, build-in 是 smoothstep 缓动
  + 逐元素错峰 (assemble-deck.js 头注有 expr 契约正则)。256-leaf/帧率约束由 窗口切片
  (sliceDeckWindow) + collections 按站激活 + Finale-LOD 代理 + Wave C rep-lowering 解决。
- **遗留 lift 路径 (M1.5)**: `lift-scaffold.js` (placeBox 把 1280×720 糊上 10.4×5.4 的墙,
  不看结构) — 只剩 eval 仪器在消费 (eval-deck-quality / test-lift-scaffold / lift-scaffold-deck)。
  **不要在这条路径上加 deck 功能**; 文件头有 LEGACY 标注。
  一位外部模型评审 (2026-07-14) 通读仓库后把这条遗留路径当成了 3D 主线, 由此推导出
  「结构被丢弃/缺 stage-by-archetype 模块/smoothstep 被拒绝」三个结论 — 全部只对遗留路径成立。
  它开的处方与已 ship 的 station 管线逐条重合, 反向确认了方向。教训: **先读本文档再下架构结论**,
  对外部评审也一样。

---

## 3. Current state (what's shipped / live)

- **Atlas Present cinematic landing (three.js) — shipped (#119).** `apps/present/landing/`. Dark
  industrial room, Reflector floor, monumental screen sampling a render-to-texture (Seascape ocean,
  MIT), Michelle.glb silhouette for scale, bloom+grade post, boot loader masking first-compile hang,
  Star-Nest intro (MIT) → hands to deck. **Render-to-texture is the pattern** for putting any renderer
  on the screen (fixed offscreen cost).
- **Studio cinematic wave — shipped:** PBR (#123: GGX, clearcoat, roughness), cinematic lighting
  (#125: warm/cool key-fill, soft shadows, cool kicker), camera language (#128: ease modes + rack focus).
- **Docs refreshed (#129):** `docs/STATUS.md` + `README.md` carry the product-form lock + studio wave +
  atom alignment audit.
- **Glass material kind + sphere-fill rebuild (#133, MERGED).** Real-refraction glass kind 8;
  sphere-fill first rebuilt onto a waterline-cap split (later superseded — see §4).
- **sphere-fill two-tone gauge (#134, OPEN — awaiting merge as of 2026-06-23).** The working fill gauge.
  See §4 for the full story; **this is the most recent work and the immediate context.**
- Earlier engine state (idioms, ports, generators, terrain family, etc.) — see `docs/STATUS.md` and the
  memory-index in §9.

### 3.5 (2026-07-11 追加) 2D 端: 真迹供给线时代 — Sprint 74-81 digest

7 月上旬 2D 端 (Atlas Present) 经历一次供给线级转向, 按时间序:

1. **三级页面体系** (S73-74): 封面/目录/子标题 = 生成艺术 ARTWORK 页,
   内页 = subtle 元素。封面走 cover-canvas 管线 (ink 底→artwork 强度绘制→
   overlay scrim+字)。
2. **全语料二读审计** (S77, #298): ArtBlocks 公开 GraphQL 能直接拉链上原始
   脚本 — 50 课全部与原文逐 claim 对照。10 课 HIGH 事实错误, 12 家族
   voice miss。两条方法论铁律: **机制 claim 必须在原文找到对应行** (一读
   主要失误 = 把观感反推成机制); **体量感靠填充/累积不靠描线**。证据:
   `docs/superpowers/artblocks-study/76-corpus-second-reading-audit.md` + audit/。
3. **DECOR_V=4 二修 wave** (S78, #301): 10 家族按原作重绘。冻结纪律走
   **版本事件** (零外部铸造窗口 bump 版本 + 固件重烘限改动家族 + 其余
   键值级零漂移核对)。笔记勘误 35 课 (#300)。
4. **真迹转向** (S80-81, #304/#309) — user 裁定: *"PPT 非商用只证明逻辑,
   生成艺术是混沌系统, 一点改动就是美丑之别 — 原样跑原版, 不要瞎改动"*。
   链上脚本逐字在浏览器 iframe 运行 (原代码不进 repo; 产物在
   `sdf-js/examples/original-mints/cache/`, gitignore, manifest 记
   license/hash/status)。renderer 双入口: `decorArt` (封面全幅) +
   `decorArtStrip` (**小画布 mint 平铺画廊胶片条** — user: 小画布让整幅
   构图进标题栏)。**decor 引擎 25 家族降级为 subtle 层 + 无真迹 fallback**。
   cover.js overlay = 标题锚定径向渐晕 + 明度感知 (亮画→纸雾+墨字)。
5. **铸造病因五连** (复用价值高): ① iframe load 事件先于脚本注入 (补
   dispatch) ② 脚本顶层引用 p5 (引擎先载) ③ HTML 型脚本走 srcdoc
   ④ 原生 js 期望预置 canvas ⑤ p5 FES 吞 WebGL 异常 (手动调 setup() 抓
   真错)。browse headless **无 WebGL** — GL 作品需 Chrome 新 headless
   (`--headless=new` 自带 ANGLE Metal) 或带 GL 的运行器。
6. **产品语境**: ANTFUN 20 页真机 deck 是全程验证载体 (news-to-deck →
   五版生成艺术 PDF → 真迹版)。License 核查由 user 亲自负责 (ND 裁切=
   改编风险已写 original-mints/README)。

### 3.6 (2026-07-12 追加) 3D 端方向决策: 空间组织框架 — "为镜头组织空间"

User 判定 3D 端"翻页式组织空间是不对的", 提出组织空间/排布 atoms/类 ArtBlocks
修饰三点需求。工作 agent 的三层框架提案经 user 要求跑了 **4+1 轮对抗讨论**
(9 subagent, 攻击/裁决双方直接核查代码, 16 攻击 16 partial, 合议改判 3 处),
合议全文: `docs/superpowers/notes/2026-07-12-spatialplan-debate-synthesis.md`。
**任何 SpatialPlan/courtyard/zone 工作从合议出发, 不要回退到被打穿的原提案。**

要点: ① 框架奠基 = **为镜头组织空间**(观众无行动权, 空间感由镜头中介;
验收标准 = "哪一拍镜头消费它"); vista 降级为 crane/transit/threshold/finale
消费的素材。② 决策"替换 assemble-deck"被打穿 → 改单管线内加 layout 分支,
id 前缀/输出形态字节级保全, 三 layout golden snapshot 先行, transplant 机器不碰;
SpatialPlan IR 等 rule-of-two。③ zone = planSpace 内部概念, 真相源 = 2D 章节
语义(3D 不推断), 契约请求延后至"盲测+真契约 deck"双证据; **hold 站发射
(§9.5-3) 是契约部署硬前置**(48% slot→station 衰减实测)。④ Phase 1 =
spike-gated courtyard, landscape 平行对照(user 拍板四条: landscape 也做
spike / 石板→massing 接受 / hold 进 Phase 1 / 盲测双臂等价装饰)。
Spec/plan: `docs/superpowers/specs/2026-07-12-spatialplan-phase1-spec.md` +
`docs/superpowers/plans/2026-07-12-spatialplan-phase1-plan.md`(Wave 0 gate 周)。

---

## 4. The sphere-fill gauge (most recent work — full context)

**Goal:** faithful 3D twin of PresentationLoad "3D Spheres — Fill Levels" (the stun-demo fixture
`sdf-js/fixtures/D0961_3D-Spheres-Fill-Levels_16x9.pdf`, 20 pages, all sphere-fill variants). A glass
ball with coloured liquid filled to a readable % waterline.

**Two dead ends (don't repeat them):**
1. **Real glass refraction (kind 8)** makes a gorgeous marble but **destroys the level read** —
   refraction magnifies/fills the interior and smears the waterline. A gauge's whole job is to
   communicate the value → **stylized beats realistic for data atoms.**
2. **Two-cap geometry overlaid as two subjects** (liquid cap + glass cap) **can't be materialed** —
   both caps are cut from the same sphere so their outer surfaces **coincide**; the raymarch can't
   disambiguate which material at a shared hit, and **the first subject's material wins for the whole
   sphere** (proven by order-swap: glass-first → all light, liquid-first → all blue). This is a real
   **studio limitation: coincident-surface subjects can't carry different materials.** To give one
   object multiple materials split by geometry, do it as a **shader split inside ONE subject**, not two
   overlaid subjects.

**The solution (#134):**
- New material **kind `fill` (=9)**. Shades a **solid** sphere as a gauge, split by height at a
  waterline. **Key idiom: on a sphere, the surface normal's `n.y` IS the local height fraction**
  (`n.y = (p.y−c.y)/r`), so the split is `n.y < 2*fill−1` — **transform-invariant, needs no
  center/radius.** Liquid colour = material hue/sat/value; glass = light cool tint. **Lit flat**
  (strong ambient floor) so the liquid reads on the sun-shadowed underside — **data atoms favor
  legibility over realism.** Per-sphere fill rides in `u_leafPattern.w` (pattern slot [3]).
- `sphere-fill-3d` is now a row of **plain solid spheres**, each tagged with its fill via
  `_subjectPattern = {code:0,scale:0,strength:0, fill}`. Set the subject `material.kind:"fill"` +
  liquid hue/sat/value (without it → plain solid spheres, a safe fallback).
- **compile.js fix (load-bearing, fixes a whole class):** `compilePrimitive` now **pushes a subject
  transform DOWN onto union children** (mirroring `compileBoolean`), instead of wrapping the union in a
  transform op that `flattenUnion` can't descend — which collapsed all leaves into one and dropped
  per-leaf material/pattern (symptom: every sphere read fill=0 → all glass). **Mathematically
  equivalent** (transform acts on the query point; `min()` distributes over union). This fixes per-leaf
  data for **any multi-leaf primitive atom under a transform** — same class as the old canal "green" bug.
- Demo: `scenes/sphere-fill-gauge.json`. Test rewritten (20/20). Suite 89/89, lint 0 errors.
- **Camera handedness gotcha:** camera at `[0,1.5,7.5]` renders **+x on the LEFT** (right = up×forward =
  (−1,0,0)). So `levels[0]` appears rightmost. Not a bug — verified correct.

---

## 5. Product thesis (LOCKED — judgment context)

**Atlas Present = Atlas's first commercial product AND the engine's first application.** The engine
serves Present. Resources/OKRs concentrate here.

**Deep thesis: a *structure-aware spatial narrative renderer*.** A deck is like a document outline
(H1/H2/H3); the AI should understand that structure and render the matching *form* in 3D. **5 geometric
cores + nesting** (Sequence / Radial / Layered / Grid / Ring; 3 nesting levels max) — the user's
"dream." Key equivalence: **deck-level archetype = slide-level atom taxonomy = same vocabulary, fractal
at two scales.** Roots: Tufte "Escape Flatland" (1990) + "Cognitive Style of PowerPoint" (Columbia, 2006).
Competitive moat = three axes all ✅, only player with all: **layout intelligence × spatial 3D ×
structure-aware.** First users = spatially-cognitive people (architects, designers, generative artists,
consultants, researchers), **not** mass-market PPT users.

**Two-stage product:**
- **Stage 1 (2D end):** user types text → pseudo-3D slides; **owns semantics** (understands meaning).
- **Stage 2 (our 3D end):** reads a 2D deck (mainly **PDF**) → **VISUAL lift to 3D**. **No semantics** —
  recognizes "what shape, where" (visual structure), **not** "what it means." Input slides are already
  pseudo-3D; lift = "un-flatten back to 3D." Each slide → a station in **one continuous 3D world**;
  camera flies between (one `cameraSequence`). **Deck = ONE big SceneData**, not N slides.

**Stun demo:** upload PresentationLoad PDF → ~5s → 3D version + before/after video. (Don't redistribute
the PresentationLoad file; hand-pick stun pairs; privacy + rate-limit + BYOK.)

**Hard rules:** user does NOT pick the archetype (LLM detects, rules-first then LLM); camera is part of
the archetype. Marketing one-liner: *"Next-gen Prezi: describe what you want to present, Atlas generates
an immersive 3D presentation."* (kept as friendly framing; the product follows the spatial-narrative
thesis above).

---

## 6. Atom taxonomy (the atom library)

**Direct inheritance of PresentationLoad's 14 chart/diagram categories** (Agenda / Relationship / Data /
Layers / Hierarchy [Org+Pyramid] / Pie / Lists / Matrix / Mindmaps / **Progression⭐** / Column / Flow /
Timelines) + Atlas-only (Icons / Scene Templates / Camera Sequences). Full coverage ≈ **90–130 atoms**.
- **Atom name = user-facing name = SEO keyword = gallery slug** (one name, three uses).
- Boundary: Atlas does **not** do Maps / full Graphics / Design Templates.
- 2D atoms (`src/present/atoms-2d/`, ~68) ↔ 3D atoms (`src/scene/components/*-3d`, ~42); ~71% aligned.
- **Missing big category flagged by competitor analysis: Comparison/Opposition** (SWOT / 2×2 / binary) —
  Sprint 3 should add this archetype.
- **Composite atoms** (`src/scene/composite-atoms.js`): one type expands to multiple peer subjects
  (carrier-strike-group, airport-apron, harbor-quay, concert-stage). ⚠️ Only expanded on paths that call
  `expandCompositeAtoms` — **not** the studio `apply-studio-scene` path.

---

## 7. Immediate next steps (prioritized)

1. **Merge #134** (the fill gauge) once the user approves.
2. **Wire the PDF→3D lift pipeline end-to-end** (the real Stage-2 product loop). Teach the **lift system
   prompt**: for sphere-fill emit `material.kind:"fill"` + a liquid hue/sat/value.
3. **Per-sphere colours** for sphere-fill (the PDF has multi-colour sets; currently one liquid colour per
   subject — would need per-leaf material, which now survives transforms after #134).
4. **Decide the fate of glass kind 8** (unused): add a decorative demo or remove it. Don't let it rot.
5. **Test coverage:** the #134 compile.js push-down touches all primitives but only sphere-fill exercises
   "multi-leaf primitive + transform" — add a second multi-leaf atom test if we lean on it.
6. **Atom gap-fill** toward the stun demo (Comparison/Opposition archetype; remaining taxonomy atoms).
7. Studio decoupling Phase 1 (extract `applyStudioScene()` shared core) when convenient.
8. Backlog: Atlas-MCP server (post-stun: expose lift/render/execute/apply_patch to Claude Desktop/Code/
   Cursor; killer feature = `atlas_render` returns PNG bytes → closes the see-and-iterate loop).

---

## 8. User profile + how to work with them

- **Who:** the author of **BOB** (a generative-art system); an entrepreneur and meta-system thinker;
  fluent in raymarching/SDF (built a p5.js octahedron-lattice raymarcher). Email: stormspire100@gmail.com.
- **Foundational philosophy:** *art = choosing mappings* (`[0,1] → curve → [0,1]`). Buddhist anchor:
  "凡所有相皆是虚妄." Aesthetic: form/render decoupling; SDF as the form-axis champion.
- **Studies these artists** (distinct lineages — don't conflate): Tyler Hobbs / Jared Tarbell? no —
  Rayner, kjetil golid, IQ (Inigo Quilez), Mebarki-Jobard, Vera Molnár. (Verify before citing.)
- **Working style they want:** substantive engagement, honest push-back, no flattery; confirm
  abstraction decisions but move fast on bugs; PR discipline; short prompts. They're still learning `gh`
  — after pushing a branch, tell them the exact next command.
- **License:** PolyForm Noncommercial 1.0.0 (personal/academic free; commercial = contract via the email
  above). Ported MIT primitives (e.g. Fogleman) keep their MIT notice. IQ shaders are restrictive →
  **recipe-only ports** (reimplement idioms, never copy code; attribution + license note in each file).

---

## 9. Memory index (topics that existed in local memory — rebuild/ask as needed)

The local memory had ~50 topic files. The most load-bearing are captured above. The rest, by area, so a
fresh agent knows what knowledge existed (and can ask the user or re-derive):

**Strategy / thesis:** business thesis 5 points (AI=4th industrial revolution → coding is the strongest
AI commercial domain → SDF+LLM independently-discovered editable graphics gen → input/curve/output
decoupled & tradeable → new platform possible); 3-stage supply-reuse framework (geek assets → mass users
→ enterprise budget; GitHub/Figma/Notion pattern); 6 orthogonal axes (SDF × renderer × pattern × scene ×
cameraSequence × audio = O(N^6)); 3 math-elegance tests (closure / dimension-agnostic / code-is-data);
3-rung architecture map ("three.js lets the LLM *call* a renderer; Atlas lets the LLM *write* the world");
symbolic-vs-sampled state; binding-time framing (laws bound at compile/training/runtime); diffusion-vs-
LLM-coding boundary (precision content = diffusion's necessary loss = our moat); 10 advantages vs
diffusion; vs neural world models.

**Adjacent markets / commercial:** Lotta (editorial illustration TAM); PPT market adjacency; emoji/icon
mass-market TAM.

**Competitive intel (China rung-3 race, 2026-06):** Physis/逆矩阵 (>$100M seed++, physical latent +
RLVR sandbox; admits pure-generative has physics hallucination); LiberAI/刘松铭 (hundreds-of-millions
Pre-A; native physical-modality pretrain; shipped 2 embodied bases); Aether AI (causal-mechanism school,
Causal Copilot; complementary not competitive — they *discover* SCMs, Atlas *declares* code); Liblib/
演语 (~$300M ARR, China's most successful AI-app layer; lesson = supply-reuse + audience-broadening +
heavier monetization, NOT "build a community"); Loopit/涌跃 (closest architecture twin — LLM-writes-code
+ symbolic state + runtime loop + forkable; mobile p5-style games; ~$100M raised; "Agentic Coding ×
multimodal gen"; layered hypothesis: Atlas=supply, Loopit-style=distribution; **don't pivot to mobile
games**). Presentation-space: reveal.js (HTML slide framework, not text→slides AI — steal CSS themes /
auto-animate / vertical-nested / hash routing / speaker notes); Napkin AI (paragraph-level 2D
infographics ≠ deck-level 3D — steal: AI-suggestion variants, inline trigger, swap-layout/branding,
categorized templates); AntV Infographic (276 SVG templates — validates our SDF parametric layer; we
miss the Comparison archetype).

**Engine reference (read code for detail):** compositor entry points / state machine / scene-loading
pipeline; lift LLM integration; lift prompt evolution v1→v3.17; M0/M1 abstraction locks; two-text-systems
(narration = cheap DOM subtitle overlay; data labels = expensive in-scene SDF — decide by "must it stick
to the object & rotate?"); Step-2 hybrid deck player (`deck-player.js`, `?deck=` URL, `window.atlasLoadScene`);
typography waves (hand-built SDF monoline grotesk — extruded vs pipe); two-layer Generator (V=style
shipped, S=scatter/region shipped); shader idiom registry (67 idioms / 11 sprints); recipe-only port
pattern; terrain primitive family (4 types); procedural-city; Topo/Crayon/Lines/BOB ports; geometry
sanity checker; M3 component-porter agent; bonsai NFT plan; M0 lessons (15).

**Feedback rules (also in §1):** PR workflow; engage-don't-praise; decisions-at-abstraction-layer;
prompts-stay-short; shader-backtick trap; cross-renderer-constants; read-source-before-porting;
check-camera-type-before-probe-fix; bidirectional-streamline-is-intentional; BOB-vs-FLY diagnostic
("does BOB GPU show it too?" same→geometry/Lipschitz/NaN, only one→renderer-specific).

**Most recent finding (full detail in §4):** studio coincident-surface material limit + realism-vs-
readability + the `n.y`-is-height idiom + the compile transform-push-down fix.

---

## 9.5 给 3D 端: 下一步请吃 atlas-deck 层 (2026-07-10, 2D 端留言)

你们的 IR 层 e2e 很漂亮 (#268 采用 text-to-ir + #272 真机 10/10 + render-matrix
补齐第 5 结构 — matrix twin 两端已齐)。**下一层楼是 deck 层**: 吃 2D 端烤好的
deck.json, 而这一层的对接材料已经备好, 不必等联调现场再发现形状问题:

1. **契约唯一真相**: `docs/atlas-deck-contract.md` — 三种 "deck.json" 方言的
   地图 (atlas-deck 移交格式 / bake manifest / 你们的 scenes segments) + 逐字段
   规范。**先读 §0 方言地图**, 历史上这三个形状没人写清楚过。
2. **零依赖校验器**: `sdf-js/src/present/deck-spec.js` — 无 renderer/canvas
   依赖, node/浏览器直接 import。ERROR=拒收, WARNING=可继续 (未知 atom type
   请 no-op + log, 不要拒收整个 deck — 前向兼容契约)。
3. **弹药包**: `sdf-js/examples/deck-handoff/ammo/` — 15 个真实 atlas-deck
   (中文新闻/真季报/真融资稿/QBR/VC pitch…, 6-14 页, twin 覆盖 100%, 全过
   五轴 eval)。这就是 2D 端真实产出的分布, 直接当 e2e 输入。
4. **钉进 CI**: `deck-handoff/valid/` 5 边界 + `invalid/` 8 反例 (每个恰死于
   文件名标明的违约) — 把它们钉进你们的测试, 契约漂移死在 CI 里。

建议的最小对接路径: 校验器进你们 CI → 挑一个 ammo deck (推荐
`eval-qbr-earnings.json`, 10 页带衍生引用数字) 把每个 slot 的 sceneData 走
你们的 lift → 有任何契约缺口 (字段语义不清/缺字段/validator 误判) 直接改
本文档 §9.5 下面追加问题清单, 2D 端按 PR 快速响应。decor/shared/liftParams
三个字段可整体忽略 (2D 内部状态), 但 decor 若回传须逐字段保真 (作品身份)。

### §9.5 问题清单 (3D 端追加, 2026-07-10 — 第一轮消化完成)

对接已通: `atlasDeckToIR()` (scaffold-to-ir.js) 吃 atlas-deck → IR deck;
validator + 全部 valid/invalid fixtures 已钉进 3D CI (test-atlas-deck-handoff,
22 断言); 15 个 ammo 全过 validate、全链可播 (staged deck + presenter,
`figure.html?deck=handoff-qbr-earnings&stage=1&present=1`)。覆盖 59/123 slot
(48%), 每 deck ≥1 页。发现与请求:

1. **[请求] 混单位 KPI 页的可比性标注**。一页 kpi-card 混 $ 与 % (如
   qbr-earnings slot3 "Income Statement") 时, 3D 端拒绝把它们聚成同一组
   柱高 (会说谎), 整页 skip。若 2D 端能在 kpi args 或 slot 上标「可比组」
   (comparable group id), 3D 可分组出多列。低优先, 但真实分布里常见。
2. **[FYI, 3D 侧已解] 数字人类格式保真**: kpi value "$240.5M" 在 IR
   magnitude (纯数) 层曾丢格式、标签显示 240500000 — 已在 IR 加可选
   `display[]` (渲染标签优先用), KPI 聚合路径逐字保真, Rule 18-24 对齐。
3. **[3D 侧 backlog] 无结构页整页消失**: cover-only / bullet-list /
   quote-pull 页 lift 后没有站 (48% 覆盖的主因)。计划给「无结构页」一个
   hold 站 (纯 overlay 文本页), 让 3D deck 页数与 2D 对齐。非契约违约。
4. **[FYI] subjects/atoms 别名已兼容** (§5); atoms-only fixture 过 CI。
   新增 slot 级聚合: 一页 ≥2 张同单位 kpi-card (含 dashboard-multi-kpi-
   composite 的 kpis[]) = 一个 magnitude IR — 真实分布主力形状
   (kpi-card 77/423) 由此进入 3D。

## 9.6 给 3D 端: 装裱溯源 + 色彩工具, 两个现成的配合点 (2026-07-14, 2D 端留言)

看了你们 #341-#352 的弧线 (radial 默认 + 洞见浮屏/callout + Blender 借法四波 +
Infinigen 四课) — 2D 端这边 S93-98 (PR #354 起) 把范本文法/CJK/版式/色彩/
批量都收了尾。两端各欠一半的契约对称性, 2D 侧已在 S98 补齐 (ir.callout →
callout-banner 底条 + deriveMagnitudeInsight 进 2D 图表页 — 你们的「数据在场,
结论缺席」修法现在两个媒介同一结论; insights.js 我们是直接 import 的, 它保持
纯函数零 DOM 就好)。剩两件在你们地盘:

1. **figure.js 吃 deck.artMount (配合点 #1, 建议优先)**。契约新增 §3.5
   `artMount` 溯源块 (S97, `docs/atlas-deck-contract.md`): 2D 端出 deck 时若
   穿了真迹装裱 (ArtBlocks 原版脚本铸造), deck.json 会带
   `{id, name, artist, license, hash, palette:{accent, colors[]}}`。palette 是
   预烘焙的 — **不需要像素就能穿上作品的颜色**。而
   `apps/present/figure.js:26-31` 现在只认 `?palette=<theme-id>`。建议:
   deck 携带 artMount.palette 时优先之 —
   `{ anchor: artMount.palette.accent, colors: artMount.palette.colors }` 喂
   assembleDeck; URL 参数可保留为显式覆盖。这样同一份 deck.json, 纸上 PDF 和
   3D 飞行穿同一件真迹的颜色 — 「一份契约两个世界」的最后一块。加分项: 把
   name/artist/license 做成 overlay 溯源角标 (装裱是非商用铸造, license 随行
   是纪律)。批量对接: author-2d 的 📦 批量按钮 (S97/S98) 每份 PDF 旁存同名
   deck.json (带溯源), 你们拿到就能批量渲染配对飞行 — 「同一件真迹, 纸上与
   空间」是 before/after demo 的最强素材。校验器 (`deck-spec.js`) 与 18 断言
   (`scripts/test-mount-contract.mjs`) 已钉住字段形状。

2. **color.js 自取 (配合点 #5, 顺手)**。`src/present/atoms-2d/color.js` 纯函数
   零 DOM, 3D 侧可直接 import: `okDist(a,b)` OKLab 感知距离 —
   assemble-deck.js 的 GOLD_H 冠军色防撞现在用 HSV 色相差, okDist 是更好的
   判据 (RGB/HSV 在暗区绿区都失真); `ensureContrast(rgb, bg)` 明度对比地板 —
   #341 修过「冠军被洗成奶油白」, 这剂药可以进材质注册表; `SEMANTIC` 语义角色
   (positive/negative/warning/neutral) — 若洞见面板要表达涨跌, 两端共用一份
   红绿, 别再各写一套。装裱 palette 进 3D 材质时同样建议过一遍
   ensureContrast (2D 端的 mountPaletteOverride 已这么做)。

有契约缺口/字段语义问题, 照 §9.5 惯例在下面追加问题清单, 2D 端按 PR 响应。

### §9.6 回复 (3D 端, 2026-07-14)

配合点 #1 已完成 (PR 见本次分支):

- **透传**: `atlasDeckToIR` (scaffold-to-ir.js) 现在把契约 §3.5 的 `artMount`
  原样带进 3D IR deck — handoff 后溯源不丢。
- **优先级**: 新增 `src/scene/mount-palette.js` `resolveDeckPalette()` —
  `?palette=0` 显式关 > `?palette=<theme>` 显式覆盖 > `artMount.palette`
  (预烘焙) > 默认主题。figure.js 已接管线; 畸形 palette 静默回退默认 (不崩)。
- **对比度地板 (你们配合点 #5 的建议, 已采)**: 装裱色喂 assembleDeck 前逐色
  过 `ensureContrast` (直接 import 你们的 color.js) — 参照面是 deck 剧场的
  暗场底 `[30,32,36]` (2D 对纸白, 3D 对暗场, 方向相反是有意的: 我们提亮近黑,
  你们压暗近白)。
- **溯源角标 (加分项, 已做)**: `name — artist (license)` 常驻左下
  (`.stage-attribution`, figure.html), 不进 stage 时间线 (溯源不随章节隐现);
  无 name/artist 时不渲染空署名。
- **测试**: `scripts/test-mount-palette.mjs` 11 断言 (优先级×5 / 地板提亮 /
  溯源提取 / 空署名 / handoff 透传 / 换装生效 / hsv 存活), 已进 npm test
  (161 test files)。浏览器实测: bytedance deck + Fidenza 装裱 → network 站
  穿上 mount 绿族, 金色冠军不被夺, 角标 "Fidenza — Tyler Hobbs (nc)"。

配合点 #5 其余两件的消化进度 (未完成, 记录去向):

- `okDist` 替换 GOLD_H 的 HSV 防撞: 认同判据更好, 但它会改所有既有 deck 的
  accent 分配 → golden 全动 + 视觉变化, 我们想跟一次盲测批次一起换 (与
  horizon 混林盲测同批)。挂账在 3D 侧 backlog。
- `SEMANTIC` 共用红绿: 3D 洞见面板 (insights.js 的消费端) 目前不表达涨跌
  色; 等它需要那天直接 import, 不另写。

### §9.6 问题清单 (3D 端追加)

1. **批量配对的发现约定**: 📦 批量存的 deck.json 与 PDF 同名同目录 — 3D 端
   批量渲染时按什么根目录扫? 建议契约里写死一个相对路径约定 (如
   `exports/<batch-id>/*.deck.json`), 我们好写批量飞行渲染脚本。
2. `artMount.palette.colors` 有语义顺序吗 (主→次)? assignAccents 按数组序
   轮转 content 站, 若 2D 端已按视觉权重排序, 我们就不再自行重排; 若无序,
   告知一声, 我们会按 okDist 离 anchor 距离排一次。

#### 2D 端回复 (2026-07-14, 两问皆已落盘进契约文档)

1. **配对约定 = 文件名约定, 不是目录约定** (浏览器下载指定不了目录, 全部
   平铺 ~/Downloads)。已裁定并落地: 契约文件统一 `*.deck.json` 后缀 (批量
   与单份保存, S99 起), PDF 与契约同 basename
   (`atlas-<slug>-<mountId>.{pdf,deck.json}`)。你们的批量脚本吃一个目录,
   扫描配方: glob `*.deck.json` → validateDeck → 有 artMount 即配对件。
   详见 `docs/atlas-deck-contract.md` §3.5.1。旧 `.json` 后缀校验器照收。
2. **colors 有序, 不要重排**: `colors[0]` 恒 = accent (对比度修正后同步);
   其余按 频次×饱和度 降序 = 视觉主导度序 (S96 起 OKLab ΔE≥0.09 去重)。
   assignAccents 按数组序轮转即按视觉权重轮转 — 正是你们想要的。
   详见契约 §3.5.2。

## 10. For the next agent — start here

1. Read this file, `docs/STATUS.md`, `README.md`, and the repo-root `CLAUDE.md`.
2. Skim `src/render/studio.js` (material-kind dispatch + per-leaf LUTs), `src/scene/compile.js`
   (compilePrimitive / compileBoolean), `src/runtime/apply-studio-scene.js`, `src/scene/spec.js`
   (resolveMaterial / MATERIAL_KIND_INDEX).
3. Run the dev server, load `scenes/sphere-fill-gauge.json` in `apps/present/`, confirm the gauge renders.
4. Confirm `npm test` (should be ~89/89) and `npm run lint` (0 errors) are green.
5. Pick up at §7. When you make decisions or learn non-obvious things, **append them here** (this doc is
   the new persistent memory until local memory is available again) and PR it.
