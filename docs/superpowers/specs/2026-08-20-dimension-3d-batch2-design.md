# DIMENSION 3D batch2 —— 布尔雕塑档 + 两张硬票 设计

> 2026-08-20。构图 v2 封卷后经 8 问 brainstorm 定案:内容扩容为主(布尔雕塑八件,进构图 v2 池,
> 独立雕塑档权重,逐件全套对抗)+ 两张高优票(判决实验卷首先行 / set_features 艺术语义精选键)。
> 老 3D 场景(7/8/18-22)与 4D 一根手指不碰,下一卷再评。

## 一、判决实验(卷首,与内容批并行)

**目的**:一锤定音"细线边界跨导航像素漂移"的病灶层——JS 逻辑还是 canvas 光栅器。
终审已指出 JIT 假说证据不足(逐 document 稳定/跨 document 分裂的签名更像光栅后端)。

**方法**:sketch.js 加 dev-only 钩(`?cksum=1` 门控,默认零开销零消费):drawSegment/drawPoisson
落笔前把每笔 (x, y, size, colorIdx, layerIdx) 卷进 FNV-1a 累积 hash 挂 `window.__strokeChecksum`。
真 Chrome 同 hash × 5 次全新导航 × 三场景(34 grid 已知漂 / 30 before 已知细线漂 / poisson 对照净),
逐次收 checksum + canvas toDataURL 摘要,拼判决矩阵:
- checksum 全同 & 像素异 → **光栅器**:fround/定点化两票作废,补救转"铸造快照单进程契约 + 存档渲染标准化"
- checksum 有异 → **JS 残余**:diff 首个分歧笔序号,顺藤定位
**产出**:判决报告 + 确定性票据重排。

## 二、set_features 艺术语义精选键(traits 表,本 spec 即终审件)

scene 34 补 6 键(其余场景 features 不动);内部参数(cov/fallback/相机数值/hF)不暴露:

| trait 键 | 值域 | 说明 |
|---|---|---|
| `Composition` | Monument/Colossus/Hover/Closeup/Still Life | 构图型 |
| `Palette` | PAL3D src 作品名(84 值,如 "wanderer-fog") | 配色血统——收藏家语言 |
| `Forms` | solidKinds 连接串(如 "steinmetz+sphere") | 几何词汇 |
| `Modifier` | Pierce/Intersect/Decay Row/None | 修饰符(多者并列连接) |
| `Terrain` | Flat/Waves/Void | 地形档 |
| `Depth` | Clear/Soft/Deep | fog34 映射(0→Clear, 0.09-0.16→Soft, 0.28→Deep) |

## 三、雕塑档八件(SCULPT_POOL)

每件 ~15 行纯函数(复用 SD3.P + min/max + 极角折叠),经 `_makeSolid` 同一 bbox 量测/旋转/落地管线:

1. **斯坦梅茨体** steinmetz:三正交无限圆柱之交(max₃)——经典数学体,剪影极美
2. **方孔圆球** cube-pierced-sphere:球 − 三轴无限方柱十字
3. **穹顶残殿** ruin-dome:上半空壳穹顶 + 内立一柱一球(希腊废墟)
4. **笼中球** caged-orb:wireframe_box ∪ 内浮球(囚禁的月亮)
5. **死星** death-star:球 − 偏移球咬口
6. **拱廊** arcade:拱门(盒−横柱)绕 Y 极角折叠 ×6 成环形神庙
7. **咬过的苹果** bitten-apple:球 − 侧咬球 − 顶凹 + 叶片椭球
8. **沙漏** hourglass:双锥对尖 + 上下盖板

**入池结构(user 终裁"独立雕塑档")**:主件三分池 **原语 55% / 布尔小件 25% / 雕塑档 20%**(draft,
sheet 后终裁);副件仍走原语+布尔两分池(雕塑只当主角)。消费恒定:三路索引恒 roll。
雕塑件自动吃五型构图 / PAL3D 配色 / 景深 / 电流全红利,零新基建。

## 四、验收(逐件全套,2D 批纪律平移)

每件 × ≥3 hash:构图五标(出画率/负空间/地平线/消散/修饰符可辨)+ 电流爬剪影(镂空件重点:
笼中球/拱廊的 mask 拓扑)+ 景深 A/B + 配色变奏。8 件 × 3 列 contact sheet → **STOP 交 user 终裁**
(雕塑档权重 20% 一并裁)。产物入 ~/Downloads/genlab-3d-batch2/。

## 五、工程纪律

- DIMENSION 代码直进独立仓 main;sdf-main 附属(本 spec/plan/概率表/判决报告摘要)走 **genlab-3d-batch2** 分支 PR
- 消费恒定/孤岛三处同步/老场景零变化 照旧;测试基线 104 起步
- 概率表:comp_34 增 `sculpt_route` 子键(55/25/20 draft → 终裁 locked)
