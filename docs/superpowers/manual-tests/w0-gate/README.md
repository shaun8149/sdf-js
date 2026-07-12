# Wave 0 Gate 周 — spike 结果(2026-07-12)

> Spec: `../../specs/2026-07-12-spatialplan-phase1-spec.md` §4。
> 复现:`node sdf-js/scripts/spike-w0.mjs` 生成场景 →
> `apps/present/spike.html?scene=<name>`(`?windows=0` 关站级切换,`?mode=stone|rich` 换渲染档)。
> 语料:bytedance-bp 13 页,手工 4 章标注(开场 0-1 / 市场 2-6 / 产品 7-9 / 团队与计划 10-12)。
> 测试硬件:RTX 5090 台机 + Chrome(**laptop 定价仍缺,见结论**),240Hz vsync 上限。

## Spike 1 — zone massing 剪影可读性(courtyard 前置)

| 帧 | 文件 | 读感 |
|---|---|---|
| 站 payoff | `w0-massing-payoff.png` | ✅ 成立:数据柱阵占焦点,massing 山脊线+塔冠在背后构成章节天际线,纯剪影不破明度 |
| transit | `w0-massing-transit2.png` | ✅ 双站同框 + 天际线,眼被引向下一竞技场 |
| finale | `w0-massing-finale2.png` | ⚠️ massing 只在画框边缘,弱;环心被 s0(封面 hold)的 monolith forest 占据 |

**踩坑记录**:massing 落点用"zone 质心 × 1.75"必坏——宽弧 zone 的质心向环心塌,
massing 落进 crane 近场(前景糊块)。修法 = 固定半径带(环半径 + 34),已写回生成器。

## Spike 2 — 中心纪念碑定价

`w0-monument-finale.png`:❌ **视觉不成立**——环心已被封面 hold 石林(26 subjects,
从站位向环心行进)占据,9-leaf 纪念碑完全被吞。courtyard 要中心件,必须先解决
石林与中心件的冲突(石林让位/改向,或纪念碑即石林)。
性能:analytic 240fps(vsync 顶格,+9 leaves 无感)。laptop 定价未测。

## Spike 3 — landscape 台地(对照方案)

| 帧 | 文件 | 读感 |
|---|---|---|
| 俯瞰 | `w0-landscape-overlook.png` | ✅✅ 雪山冰湖间五个黑色台地悬浮数据纪念碑,高程差可读,氛围碾压默认白世界 |
| 站内 | `w0-landscape-station.png` | ✅ 星座图在雪山前,山脊天然给"共享世界参照系",subtle 不抢数据 |

**terracing 机制验证**:origin y 平移 + shiftBuildInExpr(dy, 0) + 按 deckWindows
时间窗给 shots/overlay 抬升——全程 post-process,引擎零改动,机制可直接进 Wave 4。

## 编译/运行时定价(本轮最硬的数据)

| 配置 | 预热/编译 | 运行 fps(RTX 5090) |
|---|---|---|
| 默认世界 13 站,analytic,26 窗口 | ~52-56s | 240(顶格) |
| 默认世界 13 站,**stone**,26 窗口 | **>4min 未完成,放弃** | — |
| alpine 13 站,26 窗口 | **>4min 时 6/50,弃**(地形 fbm 在每个窗口 shader 各编一遍) | — |
| alpine 13 站,单 shader(windows=0) | **>5min 未完成,弃**(289 subjects+地形一锅,超线性) | — |
| alpine **5 站** mini,单 shader | 66s | **46-53** |

## 结论(带给选边评审)

1. **massing 在 leaf 预算内可读**(payoff/transit 成立)——courtyard 的 spike 1 过,
   但 finale 弱 + 中心件被石林吞(spike 2 视觉不过)。
2. **landscape 观感显著更强**(两帧定妆照),且 terracing 机制零引擎改动;
   但**编译与运行成本都真实更贵**:地形 × 窗口切换 = 编译乘法爆炸(必须
   单-shader 或地形跨窗口共享),5 站 mini 在 5090 上只有 ~50fps → laptop 不可行,
   除非 analytic 渲染档支持地形(当前 SUPPORTED 集不含 terrain)或地形走
   预烘焙/半程近似。
3. **两案都没有免费午餐**:courtyard 的成本在"环心冲突 + finale 弱",
   landscape 的成本在"地形渲染档缺口"。按 spec §4 选边规则,spike 1/2 = 一过一不过,
   属于"任一失败 → landscape 升主案"的边缘情形;但 landscape 自己的性能债也是实打实的。
   → **交 user 看图裁决**,两案的补救工作量并列在 PR body。
4. laptop GPU 实测仍缺(本机为 5090);无论选哪案,Wave 4 出口前必须补真 laptop 数字。
