# DIMENSION 活画卷 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development,逐任务双门。
> 裁定原文:DIMENSION `.superpowers/sdd/2026-08-29-dimension-3d-quality/progress.md` 尾部脑暴一/二/三轮+补裁节(2026-08-30,逐字为准)。

**Goal:** 把每件作品变成"活的画":出生偏移(mint 时刻定时区)+ BOB 逐笔生成动画恢复 + 装裱(边框/签名/印章/日月时钟标)+ 开场仪式(逐笔+日扫)。

## Global Constraints

- 岛铁律:确定性契约"同 hash+同时刻(+同 mintTime)→同画面";禁 Math.random/Date.now(CHRONO 墙钟是唯一合法时源,经 computeChrono);r() 先耗满;三处同步;链零 URL 解析;**minified 三库件(objects2d/lib-*.js)与 key.txt 不碰**;测试实跑取值;基线 DIMENSION 91303a8 后续(实跑确认 HEAD),711/711。
- **tokenData 契约扩展**:新增可选字段 `mintTime`(unix 秒,合约侧传区块时间戳);缺省→hash 派生偏移。README 链上契约节同步。
- 时间轴/装裱改动=全库观感变化(pre-mint 合法),指纹重基线一次性在 T3 后做;活效果层(逐笔过程/日扫/时钟指针)不入静态归档(mint-snapshot 等 $renderOK 完成态)。
- sdf-main 附属走 `genlab-living-painting` 分支 PR 不 merge;无关 WIP 排除。

### Task 1: 出生偏移 + 日照窗
`birthOffset`:主路 `tokenData.mintTime` 存在→offset = (mintTime 之时刻 h);兜底→hash 派生 h∈[0,24)(一次 roll,消费恒定位置固定)。渲染时刻 `T_eff = (墙钟h + offset) mod 24`;2D 全域使用;**3D/4D(scene 34/35/17 光照)确定性 remap 进日照窗 [5.5,18.5]**(连续映射保节律,公式入 README)。mint-snapshot manifest 增 offset/mintTime 字段。测试:两路 offset 确定性/日照窗边界/非时间路径零扰动;711→实跑。**呈裁件:同 hash×6 时刻对照表**(2D×2 件+3D+4D 各,真浏览器)→ `~/Downloads/genlab-birth-batch24/`——2D 时刻响应幅度是否需加大在此裁。

### Task 2: 2D 逐笔 generator 恢复
先审计:2D 库件(scene 30-32)walk libDirect/renderLibPiece 一次性直绘,绕过经典分段 generator(scene 34/35 的逐笔观感在)。恢复:weave/renderLibPiece 逐笔循环 generator 化接入既有分段驱动(sketch.js draw 排水),节奏目标 2-4 秒刷完(分段粒度呈报告);**完成态像素与直绘逐位相同**(硬验收);$renderOK 语义不变;neon/warp 风格同待遇(实现口径报告写明)。711→实跑;真浏览器目检逐笔过程录帧 6 张进报告。

### Task 3: 装裱系统
- 边框+留白:画心缩放 draft 0.93,留白 ~3.5% csize,留白色纸色系派生(不抢画);4D 拼板/升维图统一外包。
- 落款:角落 "shaun" 小号 2D SDF 字母(墨色/深色派生);**红方印「肖恩」**(圆角方框+SDF 笔画,书法主题批先例;阳文红底浅字 draft);位置固定角落(签名+印 对角或同角上下,draft 呈裁)。
- 日月时钟标:留白处小型 SDF 时钟(指针=当前 T_eff,**活层**随真实时间走)+ 日/月标随昼夜;静态归档含表盘不含活指针?——**归档含指针在归档时刻位置**(确定性:同时刻同指针)。
- 全部装裱元素确定性;消费恒定(装裱零 roll 或固定 roll);指纹重基线一次性(列旧→新);711→实跑;样张 8 枚(各 tier)→ `~/Downloads/genlab-mount-batch25/` 呈裁(画心比例/印章观感/时钟标)。

### Task 4: 开场仪式 + 收卷
逐笔生成(T2)完成后接 2-3 秒日扫(光色扫 24h 落定 T_eff,活层,requestAnimationFrame,无 WebGL 依赖则 canvas 层实现;衔接方案报告);100-hash 快速回归(六判据+完成态确定性);sdf-main:style-plan(时间轴/装裱节)+AGENT_HANDOFF §0.6+README 契约节,PR 不 merge;README/memory 收卷。**STOP 呈裁**:batch24/25+日扫观感+2D 幅度+装裱 draft 参数。

## 工程纪律
双门审查;卷末 opus 终审(额度许可则做,否则记账可补);渲染零筛选;fix loop ≤5;执行序 T1→T2→T3→T4。
