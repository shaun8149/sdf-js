# Presenter Mode — 现场演讲模式(讲稿 → 可上台的 3D 演讲世界)

> 2026-07-10,与 user 逐题讨论收敛。产品最终形态:**输入一整篇讲稿 →
> 输出一个可以拿上台讲的 3D 演讲世界**(结构站 + beat 节奏 + 提词)。

## 0. 定位决定链(讨论记录)

1. **服务对象:看的人**(暂时不做「用的人」/嵌入工具线)。
2. 亚场景:**现场讲的**(keynote 投屏),不是发出去的成片 → **讲者节奏控制是 P0**;
   视觉方向(穿越镜头/人形尺度锚/开场全景/morph)降为「拍内容」,在 beat 系统之后排期。
3. **Beat 粒度 = 混合(C)**:默认一拍 = 一站(进站 + 站内自动 build-in);
   **emphasis/super 单独成拍**(punchline 交到讲者手里,一按空格「啪」);finale 一拍。
4. **智能化 = 从 IR 规则推导**:`slides`(站拍)/ `order`(站内自动节拍)/ `emphasis`
   (punchline 拍)已含全部所需信息 —— LLM 的智能在 text→IR 标 emphasis 时已付过,
   beat 编排是确定性规则,不再问模型。与 IR 架构同哲学:LLM 只判断,执行全规则。
5. **输入形态 = 完整讲稿**(整篇文本,不是一段话)。

## 1. 两条纪律(已立)

- **讲稿是圣旨,LLM 只切不改。** 提词显示的必须是讲者原话 —— 讲稿对齐 =
  **原文切片 + 归属**(这几句属于第几拍),严禁改写/浓缩。与 2D 端反幻觉纪律
  (Rule 21/22)同款:内容零发明。
- **允许纯讲话拍。** beat 合同 = 「每段讲稿都有归属的拍」,不是「每拍都有视觉变化」。
  无视觉变化的拍,镜头 hold 或极缓慢漂移 —— 把舞台安静让给讲者。

## 2. 提词呈现

- **v1:同屏提词条**(投屏底部一条小字,当前拍的讲稿切片)。
- **v2(紧随):双屏 presenter view** —— 讲者窗口(提词 + 下一拍预览 + 计时)+
  纯净观众窗口,同机 BroadcastChannel 同步;顺带解锁遥控/手机翻页。

## 3. 架构

```
讲稿全文 ──(text→IR 扩展:切片+归属,不改写)──▶ { title, slides:[IR], script:[{beatRef, text}] }
                                                          │
                            beat 推导(纯规则,from IR)   ▼
        assembleDeck/renderers ──▶ sceneData + beats:[{ tStart, tEnd, kind: station|super|hold|finale }]
                                                          │
        presenter runtime(figure/present 页):空格 = 推进到下一拍边界;
        时间轴在拍尾 HOLD;提词条显示当前拍归属的讲稿原文
```

### 3.1 工程前置:统一时钟(引擎小手术,第一刀)

现状有**两个时钟**:相机时间轴可控(`setSequenceTime/'Paused`),但 subject 动画
(build-in)走不可暂停的 wall-clock `u_time`。beat 模式要求「一个演示只有一个时间」:
**把 u_time 的推进改为可控**(pause/seek 与 sequence 时钟联动;默认行为不变,
存量场景零影响)。这是 beat 系统的先决条件。

### 3.2 Beat 推导规则(v1)

- 每站:`station` 拍(transit + 进站 + build-in 自动播完,拍尾 = 站 payoff 前)。
- 站内每个 emphasis:`super` 拍(punch-in + shake,单独一拍)。
- 讲稿归属了但无视觉变化的段:`hold` 拍(镜头静置/缓漂)。
- 结尾:`finale` 拍(全景 money shot)。
- 空格 = 从当前 HOLD 点播放到下一拍边界再 HOLD;方向键 ← 回上一拍边界(seek)。

### 3.3 讲稿对齐(text→IR 扩展)

- 输入:讲稿全文。输出在现有 deck 合同上加 `script` 数组:原文**逐段切片**
  (字符级原样),每片标注归属(station i / super j / hold)。
- 验证:切片拼回 ≈ 原文(允许空白差异)—— 违反即重试;守住「只切不改」。
- prompt 守铁律:保持短。

## 4. 范围(v1)/非目标

- **v1**:统一时钟 → beat 推导 + 空格步进(figure 页)→ 讲稿对齐 → 同屏提词条。
- **非目标(排后)**:双屏 presenter view(v2)、穿越镜头/人形锚/开场全景(拍内容,
  beat 之后)、morph 转场(大招)、视频导出、「用的人」工具线(拖转/嵌入)。

## 5. 成功标准

一次真实演练:把一篇 ≥800 字的中文讲稿粘进 author 页 → 生成 → 讲者用空格
从头讲到尾:每一拍视觉与讲稿对得上、提词是原话、punchline 由讲者亲手触发、
中途停顿画面安静不抢戏。讲完的人愿意说「我敢拿这个上台」。
