# DIMENSION 铸造准备卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。

**Goal:** 落地 2026-08-25 user 全套裁定(见 DIMENSION `.superpowers/sdd/2026-08-22-dimension-curation-4d/progress.md` 尾部「铸造准备卷 终裁」节,逐字为准):升维图拼板化 / 确定性三票 / dev 口摘除 / p5 CDN 模板 / 2D traits / 小修打包 / 大规模废片体检。minify 决策悬置至本卷后。

## Global Constraints

- 岛铁律照旧:同 hash→同作品;禁 Math.random/Date.now;r() 先耗满再分支;三处同步;**绝不碰 key.txt**;测试实跑取值;幸存场景既有锁非因本卷语义变更不动。
- DIMENSION 直提 main(基线 285/285,HEAD≈349d0ae);sdf-main 附属走 `genlab-mint-prep` 分支 PR,不 merge;无关 WIP 排除。
- 以太坊架构:一份总代码+hash;p5 走 cdnjs(版本锁);链文件零 dev 口。

### Task 1: 升维图拼板化(scene 17 重生)
2×2 固定四板:2D 剪影板(库件语言)/3D probe 板/4D 切片板/升维图解板(纸片→球→切片叙事浓缩);同 hash 四板同一"主题形体"跨维呈现(圆/方/环等基础形派生);接 PAL3D/B4(scene17 入门控)/灰影/comp 简化(板级居中即可,不必五型);traits(Ascension 键+Palette);消费恒定;老 scene17 代码替换,占比 1% 不变。测试:板结构/消费/traits/退场界面回归,实跑重标。真浏览器样张 6 枚呈报告。

### Task 2: 确定性三票
①weave.js:979 区域 hitIntensity 舍入刀锋加死区比较;②:518,522 排序并列加确定性 tie-break;③铸造快照单进程契约:文档化+可执行脚本(单进程单会话渲染存档流程,archival 渲染标准),judgment-report.md 更新。①②改后 2D 输出会变(pre-mint 可接受),全库指纹重基线实跑;跨导航漂移复测(verify-determinism.mjs)目标:checksum 稳定性提升,结果如实报告。

### Task 3: dev 口摘除
链文件(index.html 引用集)移除全部 URL 参数解析(?scene/?sculpt/?panels/?poly/?b4/?fog34/?fog/?focal/?dof/?cksum/?ckdump/?piece/?style2d 等,grep 尽列);dev 工具外迁:新建 dev.html+dev/dev.js(不入 CHAIN_FILES/index.html),以包装/注入方式恢复全部 dev 能力;find-hash.mjs/测试沙箱/批渲脚本随迁改走 dev 口径;链文件零 `location.search` 读取断言(常设);幸存场景自然渲染逐位不变(指纹对照)。

### Task 4: p5 CDN 模板
在 sdf-main 已有 Art Blocks 语料(grep artblocks/cdnjs,memory reference_artblocks_render_tech_map 所指语料位置)找其 p5 cdnjs 引用模式;DIMENSION index.html 改为 cdnjs p5(与本地冻结版同版本号,SRI integrity);本地 p5.min.js 保留仓内作开发 fallback(dev.html 用),链装配不含;离线开发路径说明入 README。

### Task 5: 2D traits 实装
审计 scene 30/31/32 现 set_features 输出;补齐:Piece(件名 id)/Style(before|after|warp|neon)/Category(物件|风景|主题)/Palette(如可溯);沿二次发射模式;值域断言+150-hash 扫掠六场景 traits 完备性(34/35/17 键不回归)。

### Task 6: 小修打包
①阴影灰环按 PAL3D 背景明度两档自适应(暗底用亮灰档,呈样张);②glome 贴线残余:wOffset 加最小幅度约束(保反回文前提下抬 near-dup 余量,0xe40a52cd 复验);③渲中右键 pending→渲完 auto-fire;④boundedField 非严格 Lipschitz 注释;⑤E 诊断脚本+关键 SDD 证据入 `test/evidence/`(git 内)。

### Task 7: 大规模废片体检(收卷)
800 随机 hash 全维度真浏览器渲染;按 tier/scene/风格轴/胞体/构图型统计:废片判据(全空/黑屏/兜底触发/近重复板)率、渲染时长分布;报告+最差 20 件图集呈 user;不筛选不修改,纯体检。sdf-main:本 plan+体检报告摘要提交 genlab-mint-prep,PR 不 merge。

## 工程纪律
每任务实现者+审查者双门;fix loop ≤5;卷末 opus 全分支终审;batch 渲染零筛选;T2 指纹重基线须在 T1 之后 T3 之前完成以免叠加混淆(执行序 T1→T2→T3→T4→T5→T6→T7)。
