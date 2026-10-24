# DIMENSION 策展 T10 + 相机三轴 + 配比刀 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定:user 2026-09-19 三令——①batch50 审图逐字"这两种构图都去掉";②ledger `2026-09-19-dimension-3d-forms` 尾节"② roll 转正 = 要"(含 monument)/"③ pitch = 要";③配比逐字"总体增加 3D 在所有作品中的比例,提高 1.5 倍,然后 2D 相应的进行减少"。
> 基线 = d25973b(2013);收卷 HEAD = 38719cf(**2053/2053**)。
> 三把刀**并发在途**,各自跑隔离 worktree、各占独立 dev 端口,防冻结互相污染。

**Goal:** ①满幅密铺两族撤出 scene32 纹样池;②**相机第三轴 roll 转正上链**(新 traits 轴 Tilt)+ pitch 扩幅与俯角时辰门;③3D 在全库占比 ×1.5,2D 让出 14 点。

## Global Constraints

- 岛铁律全套:同 hash+同时刻+同 mintTime→逐位同;禁 `Math.random`/`Date.now`;消费恒定;链零 URL;测试实跑。
- **并发纪律**(本卷新立):每把刀在**隔离 worktree(HEAD + 本刀 hunks)**上渲染重基线,各起独立端口(T10 :8006 / 相机 :8005),后落地者 rebase 到先落地者之上再复跑——三刀同树会让冻结互相污染。
- 策展刀工法固定:`PIECE_CULL_*` 名单 + `pieceCullRemap` 让位槽,roll 消耗逐位不变;库表/函数零删,dev `?piece=` 全可达。
- 相机刀纪律:**只有 roll 能在摆位之后施加**(38 张原型 `design-proto-report.md` 立住的唯一机械事实);pitch 必须在 CAMS 表(摆位之前)改;yaw 留 dev 观察口。
- 配比刀纪律:动 `TIER_WEIGHTS` 一处,`POOL_2D_WEIGHTS` 一字不碰;派生锁把 user 的裁定本身写成可执行断言。
- 样张全进 `~/Downloads/genlab-*/`;sdf-main 附属走分支 PR 不 merge。

### Task 10: 策展刀——满幅密铺两族撤除

user 面对 batch50 样张裁"这两种构图都去掉"(Escher 鱼群渐变件 + 曼陀罗/瓷砖对称徽章件)。判据同 T9/T9b(**"只能被展示的删"**):两者都是满幅 2D 密铺图案——无 SDF 主体、无光影叙事。每个病例连同其**同族同胞**一并撤除 = 4 件,走既有 `PIECE_CULL_THEMES` + `pieceCullRemap` 让位槽,roll 消耗逐位不变:

```
PIECE_CULL_THEMES        23 → 27
  escher-fish-birds / escher-birds   (Escher 同形密铺族)
  zellige-star / alhambra-tiles      (伊斯兰四折/中心对称砖)
pattern 存续池            8 → 4
  art-nouveau-iris / chinoiserie-panel / hex-honeycomb / william-morris
```

`PIECE_CULL_OBJECTS` 与 `THEME32_CATEGORY_W` 一字未动(pattern 类权重仍 4,**池薄加剧知情**)。**边界件 william-morris 刻意不删**,单列呈 user 圈选(task-10-report §3)。证据:`sweep-cull-rate-t10`(raw/HEAD/work 三树,seed=471004,N=4000,mismatch 0)DIRECT 1.10% + REFLOW 4.05% = 全 mint **5.15%** / scene32 内 **25.95%**,让位散布 88–97 均分四存续件无聚集(2000 点均匀网格),scene30 侧 408/408 行逐位同;`recheck-t10` t4 池 111 行 → 7 行受影响(全 DIRECT),昼夜同;重基线 `rebaseline-rows-t10-tiling{,-night}`(归因 TILING-CULL,起自 t7-art 冻结)2D SAME 67/67 matchOld、7 行像素变、九桶全零、predMatches 74/74。13 条锁(字面 / 死键 / 存续池 / 零出场 / 让位锚 2 复述 + 4 新覆盖四剔件 × 四存续件 / 让位散布 2000 点 → 500·4 / william-morris 留任 / dev `?piece=` 四件可达)。样张 8 张 → `~/Downloads/genlab-t10-tiling-cull/`,manifest 三类语义显式标注(culled-archive / reflow-result / boundary)。测试(clean worktree)**2027/2027**。

### Task 1(相机三轴):件一——roll 转正上链

**第二十三方独立侧流** `CAMROLL_STREAM_XOR = 0x846CA68B`(lowbias32 第二乘子,与第十三方 KU `0x7FEB355B` 同族配对),恒 **14 roll**(12 预热 + 恰 2 payload:gate / 幅度),**零主流 r()**。白名单型内 30% 窗:

```
shadowfall 20° / hover 20° / colossus 18° / anchor 18°
monument 12°(user 终裁,"将倾之碑"的读法被接受)
closeup 10° / stilllife 10° / avenue 8°(限幅不是禁用)
interior 0°(禁用——一点透视 = 对称 + 中心灭点,roll 会把轴掰弯)
```

幅度 `|θ| = 4° + u^1.6 × (cap − 4°)`——**同一条曲线重标进各型角带**而非 `min()` 钳位(钳位会把 57.7% 的 avenue 件堆在恰好 8.0° 上);符号 = 幅度 roll 的低位(不另耗 roll)。scene35 只白名单 shadowfall(单板全幅);拼 4/16 切片件会在每块板的局部屏幕系里转,是另一种视觉语言且原型零样张,故关闭——**侧流照耗**(确定性承重)。新 traits 轴 **Tilt**(scene34/35 同口径同词表,值恒英文守 T9 命名纪律):None / Slight(<8°)/ Dutch Angle(<14°)/ Steep(≥14°)。装裱面构造性水平:`render2d/mount.js` 零 `rotate` / `.roll` / `CAM34|35` / `probe_4d` / `__camRot3` / `camTilt` 读,立为结构锁("水平画框裱一张歪画"本就是荷兰角的样子)。实测(`probe-camrot`,600-hash 池,t 钉死):白名单内命中 **50/178 = 28.1%**(目标 30%),|θ| p10/p50/p90/max = **4.28 / 6.40 / 13.83 / 18.72**,符号 +23/−27,interior 0/13 结构零,`CAM34.roll ≡ pa.tilt34` **211/211**。

### Task 1(相机三轴):件二——pitch 扩幅 + 俯角时辰门

不新增轴也不新增 roll——`cp` roll 本就在消费,只改它的仿射值域:

```
monument  0.21 + cp·0.34            → 0.21 + cp·0.49    12.03°…40.11°
colossus  0.1 + cp·0.22 − dip·0.31                     −12.03°…18.33°
hover     0.1 + cp·0.18 − dip·0.362                    −15.01°…16.05°
```

公式形状 `old − (dipOn ? (1−cp)·drop : 0)` 是刻意的:cp→1 时 drop 项恰为 0 故上界**字面等于旧上界**,门关时整式 = `old − 0` 对有限双精度**逐位相同**——这正是重基线归因能拆成 ROLL / PITCH 两支的原因。负角(俯瞰)半区**挂长影时辰**(user 要求):`camDipOk34 = CHRONO.goldW3 ≥ 1 且非夜窗` ⇒ `T_eff ∈ [2, 7.5) ∪ [16.5, 22)`,即 20 个日照小时里的 **11 个**。刻意读基础轴 `goldW3` 而非 `goldW3Strong`:碑式四型的强轴总闸恒真,用 Strong 会让时辰门几乎全天大开,user 要的正午/黄昏对比就不存在了。**证伪并记档**:立卷简报曾给 shadowfall 一条"任意时辰可俯瞰"的豁免,判决实验 `exp-shadowfall-dip`(6 件 × 7 步)杀掉它——`_assembleShadowfallPanels35` 的自适应拉远闭式是**按仰角推导**的(约束点 = 切片上沿),pitch<0 时相机被从 `ro.z −5.73` 拖到 `−18.74`(−15°)再到 `−66.22`(−25°),碑的画幅占比 16.1% → 1.5% → 0;故 **CAMS35 一字未动**,开这扇门需要一条双侧包络,另立一刀。新 dev 口 `?pitch34=<度>`:**摆位之前**覆写构图相机角——与 `?campitch=` 不同(后者是 `probe_4d` 里的事后增量,会把主体推出画外),真俯瞰画面只能由此口拍到;链文件零赋值点(结构锁)。

**重基线**(`rebaseline-camrot{,-night}`,起自 t10-tiling 冻结,真浏览器昼夜双轮口径一致):2D **69/69 逐位同**(本刀四处编辑面全在 3D/4D 管线内);3D/4D 37 行 = **ROLL 9 + PITCH 2 + SAME 26**,predMatches 37/37;**ROLL 行 cov34 漂移 0**(roll 不进摆位的渲染级证明);traits Tilt ≡ `pa.tiltTrait` 36/36;sup 6/6;九桶全零。PITCH 两轮都**只落 monument**,与 `old − 0` 恒等式的预测一致。自隔离 worktree 于 :8005 渲染。锚点重猎:monument 扩幅改了该型取景,旧 bowl 覆盖率锚的 cleared-manifest 侧翻成兜底、"两侧皆非兜底"前提失效 → 同 T1b/T2/T6 先例重猎;另补猎 closeup / stilllife 两型样张。测试 2027→**2050**(隔离树,+23)。样张 `~/Downloads/genlab-camrot-t1/`(27 + MANIFEST):8 张自然 roll 命中 + 2 张对照(含 interior 结构零)+ 4 张 pitch 前后 + 11 张黄昏俯瞰 + 2 张补样,八个白名单型全覆盖;t=17 时俯瞰件 3/211 → **37/211**,而全池兜底率只动了一件。

### Task 配比刀:3D ×1.5,2D 吸收差额

```
TIER_WEIGHTS  {2d:63, 3d:28, 4d:8, ascension:1}
           → {2d:49, 3d:42, 4d:8, ascension:1}
```

3d 28 × 1.5 = 42;14 点差额**全部且仅由 2D 吸收**,4D 与升维一字不动,和仍 = 100。**阈值派生核**:`setPa()` 的 tier 抽签是单 roll 对 `TIER_WEIGHTS` 派生的累积阈值,故**只有一个数动**——T2D 0.63→0.49,而 T3D(0.91)/T4D(0.99)逐位不动 ⇒ 4D 与升维带是与旧比例**同一批 hash**(5000-hash 确定性集 387/46 逐枚吻合),翻面带 = `tierRoll ∈ [0.49, 0.63)`,**严格单向 2D→3D**。消费恒定:tierRoll + poolRoll 仍恰 2 r(),只重划值域;翻面件下游 roll 流移一位系 `setPa()` 既有 `pa.texture` 分支换边('2d' 短路、非 2D 多花一次),**那就是"翻面"的定义本身**,不是本刀新引入的消费。`POOL_2D_WEIGHTS` 未动 ⇒ 2D 三池内部份额不变,只是 n2d 缩小。

实测(5000-hash 确定性集 / 全链双树扫):tier **3205/1362/387/46 → 2480/2087/387/46**(χ² 2.7342 → 1.1903);3D 倍数 **1.5323×**(阈值侧)/ **1.4746×**(全链 n=5000);2D 三池 **506/1631/1068 → 399/1258/823**(χ² 0.9902 → 0.6594);翻面率 **13.26%–14.50%**(四种抽样口径),100% 单向;4D/升维成员集、poly35 串、ascensionTheme 串双树逐位同;3D 八构图窗内部份额不动(monument 23.8→23.9% / colossus 23.1→23.2%)= 翻面件走的是完全同一条 3D 管线。锁重基线归因 TIER-SHIFT,**新增派生锁**断言 `3d === 28*1.5 ∧ 4d === 8 ∧ ascension === 1`,使 user 的裁定本身可执行。**锚点审计**:42 个具名锚只有 HASH_B 翻面(已重基线 + 自证断言),HASH_SD_MISS 免疫(从不调 `setPa()`,其门骑 tokenHash 侧流);六处 give-way 内联锚 + a1 hover 兜底锚按 T2/T6 先例重猎,原案例 hash 留档;印章带界锁换载体 HASH_B → HASH_A(仍 2D,期望值不变 = **换载体非重基线**)。重基线昼夜各 106 行:未翻 2D **56/56 像素级同**(零扰动硬证)/ 未翻非 2D 37/37 串级同(sha 跨导航不可复现系既有 harness 属性——t6-depool 这把零触 3D 的刀同样 37/37)/ 翻面 13/13 像素变且 13/13 吻合 vm 预测;九桶双轮全零。样张 6 张 → `~/Downloads/genlab-tier15/`,三对同 hash 前后对照(manifest 逐对写明"同一 hash,原为 2D,现为 3D"),**选片规则先于看图定死**:15 个翻面行里取等距 index 0/7/14。跑在隔离 worktree,相机刀落地后 rebase 到 3899abb 复跑,全量绿 **2053/2053**。

### Task 收卷

sdf-main style-plan(`dimension_tier` + `tier15_measured` / `3d_content.cam_axes_t1` / `piece_cull_t9` 的 T10 组与池表 / `dhue_guard_m2` 重锁链)+ §0.6 + plan 入库 + PR 不 merge;呈裁攒单:william-morris 边界件去留、shadowfall 双侧俯角包络立项、Tilt 轴与 C3 四轴 trait 曝露一并铸造前拍板、T10 四件在野复核挂 batch51。

## 工程纪律

双门审查;卷末 opus 终审;fix loop ≤5;三刀并发各占隔离 worktree 与独立端口,后落地者 rebase 复跑;样张全进 Downloads;选片规则先于看图定死;报告增量落盘。
