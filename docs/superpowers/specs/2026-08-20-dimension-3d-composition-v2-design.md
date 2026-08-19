# DIMENSION 3D 构图系统 v2 —— 骨架反投影 设计

> 2026-08-20。user 判 scene 34 v1 为"标本台"(小物居中摆地上,无艺术感),给 Pasma 参考四张
> (Universal Rayhatcher 构图系 + Industrial Devolution),经 8 问 brainstorm + 两轮参考研读定案。
> 本 spec 只覆盖 scene 34 的构图系统重做;老 3D 场景(7/8/18-22)不动。

## 论题

构图是 3D 端缺的轴,不是物体种类。Pasma 方法(RAYHATCHING ch.3 原话):
"armature, a set of imaginary lines that are important in the composition" +
"place SDFs of large blocks onto these lines" via "a mathematical transformation
from 2D (where the lines are on the image) to 3D (where the shapes are, in space)"。
即:**先在 2D 画面空间定构图,再反投影到 3D 摆物**。v2 以此为放置引擎地基。

## 一、放置引擎(骨架反投影)

- 屏幕空间 = probe 入参约定:x ∈ [-1,1],y ∈ [-1,1](canvas 惯例,y=-1 为顶,+1 为底)。
- **骨架(armature)抽样**:三分骨架为主(竖线 x=±1/3、横线 y=±1/3、四交点),
  辅以对角线锚点。hash 抽主锚(四交点之一或竖三分线上一点)与副锚(另一交点/线上点)。
- **反投影**:锚点 (ax, ay) + 相机(ro, pitch, focal=f) → 视线 v=[ax, -ay, f] 经 X 轴
  俯仰旋转 → 沿视线取深度 t(构图型定区间)→ 世界位置。落地物只锁屏幕 x 与深度,
  y 由"底沿贴地"覆盖;悬浮物全锁 2D 锚点。
- **尺寸反解**:构图型给"屏幕占高比" hF(画幅高的倍数),世界高 H ≈ hF·2·t/f,
  再由有效性检查兜底修正。
- **地平线派生**:屏幕 y_horizon = f·tan(pitch)(仰视 → 地平线压向画底),不再是死线。

## 二、相机

`probe_4d` 增可选第 4 参 `cam = { ro, pitch, focal }`,缺省 = 旧行为
(ro=[0,0,-3.5], pitch=0, focal=2)——**老场景零 diff,以回归测试锁死**。
scene 34 相机由构图型 roll:机位 y 贴地(-0.9)到齐胸(+0.2),pitch -5°~+32°,focal 1.3~2.2。

## 三、五构图型(概率 draft,contact sheet 后 user 终裁)

| 型 | draft | 要点 |
|---|---|---|
| 仰视纪念碑 | 30% | 低机位仰拍;1-2 件;主件锚竖三分线,hF 0.9-1.7(顶部出画);多落地 |
| 近巨远小 | 25% | 近巨 hF 1.2-2.0 锚画缘(x ±0.55~±0.95,被裁),远小 hF 0.12-0.3 在对侧三分交点,深度 7-14 |
| 悬浮低地平线 | 20% | pitch 上仰使地平线压底;大物悬浮锚上三分交点,hF 0.55-0.95;型内 30% 无地面 |
| 切边特写 | 15% | t 0.7-1.5,hF 1.4-2.4,锚可出画(±0.5~±1.1)→ 只见一道弧/一个角,形体即纹理 |
| 标本台重做 | 10% | 2-4 小件(hF 0.2-0.45)但深度错列(t 2-9)+ 去中心锚——静物感保留,死板去掉 |

去中心铁律:主件质心锚禁入画面中央 15% 半径区。

## 四、几何池 = 12 原语 + 布尔词汇 5 件

新增(与球同级的池成员,非押后的"布尔雕塑八件"成品场景):
月牙体(球−偏移球)、拱门(盒−横柱)、穿孔球(球−竖柱)、环穿柱(环∪柱,相贯)、
碗壳(球−同心球−上半切)。实现为 solids-stage 内纯函数组合(min/max 复用 SD3.P)。

## 五、修饰符(正交低概率)

- **穿刺 8%**:巨型空心柱/球壳横贯全场,从全部物体上减去(Pasma:"punched a hole
  through the entire scene")。
- **相贯 15%**(双件构图内):副件故意与主件穿插,交线成构图元素
  ("When two shapes intersect, their surfaces form a cutting line")——v1 的防穿模逻辑对此让位。
- **衰变行**(群像变体):同一形体沿深度重复 4-6 件,雾强制高档 → 近实远散
  (Industrial Devolution 的序列叙事,密度轴天生支持)。

## 六、地形档

平地 70% / 缓波 20%(y+1−a·sin(kx)·sin(kz),a≤0.18 保 Lipschitz 裕度)/
无地面 10%(悬浮型偏好;纯雾空)。

## 七、构图级消散

四个新型型内自 roll:无雾 20%,其余 fogK ∈ {0.09, 0.16, 0.28} 按 40/40/20;
标本台维持全局已锁档。focal 自动咬主件距离(t_主 × r(0.9,1.1))——焦平面永在主角上。
(此条修改了 2026-08-18 已锁雾档的适用范围,user 已在 brainstorm Q4 批准"构图级消散"。)

## 八、有效性检查(借构图求解器一味药)

参数 roll 后 32² 粗 probe 主件屏幕占比:超出型区间 / 副件被全食(可见 <40% 自面积)
→ reroll 参数(≤3 次),仍败走型内保守中值。r() 消费次数与 reroll 次数解耦
(先耗满固定 roll 预算再判定,沿用确定性战役配方)。

## 九、工程与验收

- pa.comp / pa.armature / pa.solidKinds 记录进参数袋(测试+元数据)。
- current3d(屏幕空间 mask)与新相机天然兼容;景深 dist 语义不变。
- 测试:老场景 probe 零 diff 回归 / 骨架反投影往返(悬浮件投影中心≈锚点,tol 2%)/
  布尔词汇符号理智 / 有效性检查收敛 / kinds+comp 断言更新。
- 验收:每型 hash 猎手 3-4 枚 → 五条新对抗标准(出画率在型区间/负空间成立/
  地平线位置分布/消散生效/穿刺切割可辨)→ 五型 contact sheet 交 user 终裁概率表。
