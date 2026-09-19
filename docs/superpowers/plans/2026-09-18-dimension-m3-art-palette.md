# DIMENSION 抽象池退场 + M3 艺术配色档卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定:user 2026-09-18 batch49 审后两令(①QQL 抽象池撤;②M3 艺术档七点终裁)。
> 设计核(user 逐字):"我们的 QQL 模仿是失败的,跟我们的 SDF 风格不搭;除了 2D 物件上的 QQL,把这些类 QQL 的东西都去掉";艺术档"要用英文,不要拼音"(T8)/"都按照你的推荐来"(T9 六改)。
> 基线 = dbcfe65(1965);收卷 HEAD = d25973b(2013)。

**Goal:** ①**scene36 抽象池退出自然路由**(入池的严格逆运算,2D 三池分布逐位回到入池前);②**PAL3D_ART 艺术配色档落地**——20 套人工策展的非自然色板,以独立数组 + 第二十二方侧流 22% 窗入池,84 套收割池字节不动。

## Global Constraints

- 岛铁律全套:同 hash+同时刻+同 mintTime→逐位同;禁 `Math.random`/`Date.now`;消费恒定(独立侧流或纯派生零 roll;post-roll 重映射合法先例);链零 URL;minified 件/key.txt 不碰;测试实跑。
- 退池纪律 = **只退自然路由**:代码/函数/`SCENE_TYPE`/分派分支一行不删,`?scene=`/`?piece=` dev 强制口原样可达(mandala/flake、seamap、calligraphy、painted 同款先例)。
- 艺术档纪律:自然池 PAL3D 84 套与两份 census 名单(TP_WARM18 / NG_NARROW32)**字节不动**;新档独立成文件 + 独立侧流,避免任何"改老表"的扰动面。
- 观感变化 = pre-mint 合法;每刀自带重基线或"像素不可能动"的**可复跑探针**。
- 样张一切进 `~/Downloads/genlab-*/`;sdf-main 附属走分支 PR 不 merge。

### Task 6(depool): scene36 抽象池退出自然路由

一字面刀:`POOL_2D_WEIGHTS` 四槽 `{30:12.8, 31:41.2, 32:26, 36:20}` → **还原入池前三槽** `{30:16, 31:51.5, 32:32.5}`,`setPa()` 2D 路由四分支→三分支。选"还原原值"而非"等比重标"= 最小扰动支:2D 三池分布逐位回到入池前(f190bdc)状态,T2 翻带每一件原路翻回,退池 = 入池的严格逆运算(`[0.128,0.16)` 31→30 / `[0.54,0.675)` 32→31 / `[0.80,1)` 36→32)。消费恒定(tierRoll+poolRoll 恒 2 r(),只动阈值)。**留任不退**:scene30 物件池背景的 Kusama 线网 = user 明示例外(活在具象 SDF 主体身上的语法);退池后 scene30 池权 12.8→16,Kusama 份额反升 3.2pp,`KU_GATE_CP/DT` 仍 0.30/0.50。锁:三槽字面 / 退池字面(无 36 槽、三分支)/ 5000-hash 三池卡方 506-1631-1068 与入池前逐枚吻合 / 退役域基数 655 / scene36 自然不可达(150-hash 扫 0 命中)/ `?scene=36` 强制口可达 + Kusama 例外三锁(双向 grep 零机制耦合 / 两枚样本锚 KU 门窗逐位 / 池权升而门值不动)。重基线一次冻结(t4 池 100+11 掺行 = 111,昼夜双绿九桶全零,归因 DEPOOL36 13 / POOL3231 8 / POOL3130 4 / SAME 75);200-hash 自然轮盘 scene36 命中 0(若仍按 T2 库内 12.6% 份额出现,连续 200 次不中概率 2.0e-12)。样张 6 张 → `~/Downloads/genlab-t6-depool/`,manifest 三类显式分栏(kusama-keep / reflow / scene36 archive)——本批曾被三次误读成"被删掉的那些件"。测试 1965→**1974**。

**教训落字**:点链流场与 DIMENSION 的 SDF+织谱点彩是两套平行语言,满幅铺珠后画面读作 QQL 仿作而非 DIMENSION;Kusama 成立是因为它服务于一个具象主体。**外部 recipe 移植只在它服务既有主体时成立,不能自己变成主体。**

### Task 7(M3):PAL3D_ART 艺术配色档入池

新链文件 `objects3d/palettes-art.js` 逐字承载 design-draft §7 的 20 套(零改动);`scenes/index.js` 加第二十二方侧流 `ART_STREAM_XOR = 0x133111EB`(splitmix64 第二乘子低字,与第九方主题 warp 的高字同族配对)、`ART_WIN_RATE = 0.22`、`artWinRoll()`(恒 13 roll = 12 预热 + 1 窗,零主流 r())、`setupPal3d()` 尾部**第四道 post-roll 重映射** + `pa.artWin34` 记账;装配四面同步。**重映射次序**(user 裁定⑥):主 roll → K4 神庙 → T6③ ng 窄色域 → **ART**,即策展档赢得 palette 而 ng 的构图偏置/耳语纹/白光抑制照常开火 = 有意供给"窄色域艺术档 × colossus × 耳语纹"。**无资格门/无场景门/无夜窗门**(user 裁定④:黑金与霓虹按设计就是夜件)。**稀有度不平权且 user 接受**:目标 = 原 idx % 20 纯派生零 roll,84 = 4×20+4 ⇒ 前四套各 **5.95%**、其余十六套各 **4.76%**,比值 **1.25×**(同 K4 %18 / T6③ %32 既有习语);对外稀有度表必须如实标此栏——挂铸造收口卷。**`PAL3D_ART` 裸引用无 typeof 防御是有意的**(静默退池 = 悄悄丢掉整个策展档,比白屏更坏),它把"装配四面同步"锁顶成**承重锁**。证据:窗率 1096/5000 = **21.92%**(χ²=0.0186),setupPal3d 主流 r() 窗内外恒 55;净位守卫恒等 160/160(20 套 × 8 干净 startIndex),最小 dY 67.255(门 40)/最小 dHue 36.118°(门 30),混合位 56/80 触发 = 结构性同自然池、记档不修;PAL3D 仍 84 / TP_WARM18 18 / NG_NARROW32 32 / src 零重叠;重基线归因 ART-WIN(2D 74/74 像素同,3D 37 行 = 7 ART-WIN + 30 SAME,sup 11/11,九桶全零);T3 ΔHue 门统计重锁 742/405/669 → **625/453/738**(3D 行触发率 40.86%→**34.42%**,三桶之和 1816 逐枚相同 + 2D 3184 恒定 = 路由未动的双旁证,预期带重标 33-42%)。12 张样张覆盖 design-draft 点出的四个证据缺口(夜窗 / scene35 拼板 / scene17 升维 / 4D 影雕深环)。测试 1974→**2002**。

### Task 8(M3):英文命名转正 + scene35 Palette 第五键

`src` 既是冻结表字面又是 traits `Palette` 轴的**链上文本**,故按 user 令全部改 Title Case 英文;中文策展名留内部(ledger/README/design-draft),链上只出英文。**四处表示同步移动**(既有字节级不变量):活数据文件 / run-tests `ART_FROZEN` 字面锁 / design-draft §7 落地块 / capture 与重基线证据。色值未动 ⇒ 像素不可能动,双证:结构上 `\.src\b` 全链(去注释)只命中 4 文件 8 处、其中读 `PAL3D_ART[...].src` 的只有 sketch.js 三个 traits setter;实证上 600-hash 双树对 0408f46——12 色环 / 四 palette 角色 / 22 路由字段 / 8 连主流 r() 全逐位同,40/40 艺术件译名,560/560 自然 src 不变,0 mismatch,**无重基线**。同刀落 **scene35 第五 trait 键 Palette**(18fa5f3):35 原为四键且 22% 抽艺术档的件 trait 面完全不显色板,而 35 与 34/17 共用同一个 `setupPal3d()`/PAL3D 12 色环 —— 色彩对三者是同一条艺术轴;表达式逐字照抄另外两处,**不加前缀不设 PaletteKind 键**(user 裁定),两族靠词形自明(自然池小写连字符 vs 策展池 Title Case)。traits 是只写侧信道(setter 零 r(),只进 `set_features` 快照永不回喂),构造性零像素影响。并落 T7 审查的 F2(capture meta 的 monu1/monu2 注文同步到实测措辞)、措辞收窄("色是 user 的色、关系是 user 的关系,**角色由色环旋转决定**"——startIndex 仍随机,user:"确实可以随机,挺好的")、F5(基环色相余量排序 ≠ 抖动模式排序)、F8(无防御记档)。新锁 T8③ 英文名形状(Title Case 正则 / ≤16 字符 / 互异 / 与自然池零重叠——两族构造上不可能撞名,这正是 Palette 轴能免前缀的原因)、T8④(读 `.length` 实算,重排数组或改池长即红)、T8⑦(禁止加 typeof 防御把承重锁降级)。测试 2002→**2011**。

### Task 9(M3):六名终裁 + 探针复跑化 + 墙钟 flake 根治

user"都按照你的推荐来"改六名:**Klein→Blue Monochrome**(二十套里唯一的画家姓氏,且 IKB 是注册专名而我们的值刻意不是 IKB;作品的标题应指向作品不指向人)/ **Indigo Fold→Indigo Print**(「摺」是印不是折)/ **Neon→Neon Tube**(与 2D Style 轴的 `Neon` 值撞名)/ **Primary Three→Primaries**(词序)/ **Papercut→Cut Paper**(读作"被纸划破")/ **Dual Field→Plum Field**(旧名给的是结构不是画面);Gold Ground / White Night / Violet Shadow / Moon Pillar 等十四套逐字不动;拼写钉**英式 grey**。**F-B3(承重)**:论证"像素不可能动"故跳过重基线的那支探针原先只活在草稿纸上随后消失、证据不可复跑——重写并提交为 `test/evidence/m3-t8-pixelzero/`,由**改名表参数化**,同一支探针同时证 T8/T9 两把刀(给一张拼音→今名的合并表即可从艺术档第一天重放)。实跑:基 877ad0e vs 隔离树,昼 t=12 / 夜 t=0 各 600 hash 全 600/600 SAME,11/11 改名件译出,589/589 其他 src 未动,0 mismatch;2500-hash 换 seed 一轮补覆盖,六个新名各自被实际观测到(Blue Monochrome 24 / Cut Paper 16 / Plum Field 10 / Indigo Print 9 / Neon Tube 8 / Primaries 4),71/71 译出,2500/2500 SAME。**墙钟 flake 两条根治**:①探针必须 `?t=` 钉时(路由携 `CHRONO.tLight` 会漂,两树沙箱建在不同瞬间,跨分钟边界冒幻影 mismatch 3/600)——**未钉的红轮与绿轮都留档**,这一对本身就是 flake 的定义,也是"未钉的绿什么都证明不了"的理由;②T7⑦ 的 K4 神庙双窗锚断言 `pa.templeWin34` 而 K4 有时辰门,锚只在某些钟点绿(tLight 12 真 / 14.9 假 / 0 假,基线 877ad0e 上同样 ⇒ flake 早于本刀),钉 t=12 并断言 `tLight === 12`。**落字**:T7⑦ 的谓词压根没提 CHRONO——时间依赖是从窗的**资格门**进来的,所以"这条锁凌晨三点会红吗"的规矩必须覆盖**窗的记账位**,不只是字面 CHRONO 读。另 F-B1(T8④ 改读 `.length` 实算并断言两条前提)、F-A1/A2/A3(证据目录 11 文件非 10;`CHAIN_FILES` 32 非 33;"①..⑦ 八锁"实为七锁九断言;三个锚 hash 不再截断)。新锁 T9①(六改钉成一个单元 + recipe-only 血统规则可执行:**零画家姓氏**)、T9②(英式 grey,只管本轴)。**抖动挂账升级**——风险有两套机制而非一套:Moon Pillar 摆幅族 4.875%(两 objs 色相近对跖,物体池圆均值摆幅最大)与 Blue Monochrome 豁免门族 0.563%(饱和 0.137 卡在 0.15 灰豁免下,±0.16 明度抖动推过门,近中性池开门后色相极不稳),未来的抖动锁必须两族同扫。测试(隔离树)2011→**2013**。

### Task 收卷

sdf-main style-plan(`2d_content` 三槽还原 / `abstract_flowdots_36` 退池节 / 新增顶层 `art_palette_m3` / `dhue_guard_m2` 重锁链)+ §0.6 + plan 入库 + PR 不 merge;呈裁攒单:对外稀有度表的不平权栏(铸造收口卷)、抖动双族锁立项、pattern 池薄的补语料。

## 工程纪律

双门审查;卷末 opus 终审;fix loop ≤5;执行序 T6→T7→T8→T9;样张全进 Downloads;dev 端口避开 8002;探针一律 `?t=` 钉时;报告增量落盘。
