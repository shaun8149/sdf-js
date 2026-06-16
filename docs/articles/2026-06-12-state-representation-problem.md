> **DRAFT — 未发布。** 系列第一篇。后两篇：《一扇没人开的门，和一个迟到三十年的执行者》《"我做不到。" —— 模型说，然后我们一起做了》。Channel: 个人长文渠道。最终编辑权归作者。

# 世界模型有一个状态表示问题

VAST 之前宣布融资近两亿美元押注 3D world generator 方向，定位是 "AI 3D world generator"。OpenAI 的 Sora 不停往"世界模拟器"的方向 reposition，DeepMind 的 Genie 喊出 "foundation world model"。这些公司都在说"世界模型"，但他们指的不是同一个东西 —— 实际上，他们指的是三件完全不同的事。

主流叙述把这三件事压成同一句话，因为"世界模型"这个词太好用 —— 模糊到任何在做生成式 3D 的人都能往自己身上套。但这三件事之间的区别，决定了未来十年这个市场的版图。我想把它们拆开。

## 三个 rung

世界模型有三种实现方式，按 *世界状态如何演化* 区分：

**rung 1 — 脚本化 (scripted)**：世界状态是一段时间轴，`f(t) → state`。给定时刻 t，世界长成那个样子。p5 sketch、Pixar 动画、过场动画、shader 时间动画都是这一种。没有未来，只有播放。

**rung 2 — 模拟化 (simulated)**：世界有一个状态 + 一个 transition function，`f(state_t, action) → state_t+1`。每一刻的世界由上一刻的世界 + 这一刻发生的事计算出来。游戏引擎、物理模拟、CFD 都是这一种。未来是被算出来的。

**rung 3 — 学习化 (learned)**：transition function 本身是一个训练出来的模型。Genie 是这条路线最纯粹的例子。未来是被神经网络预测的。

这三个 rung 不是优劣排序，是不同的工程范式。但它们对"世界"这个词的承诺差别非常大：rung 1 给你一段播放，rung 2 给你一个可交互空间，rung 3 给你一个统计的可能性云。

主流玩家分别在哪里？

- **Sora / Veo / Runway** —— 视频生成，往 rung 3 走，但目前还是 rung 1 的高级版（生成一段播放，不能交互）
- **Genie** —— 真正在赌 rung 3，"agent 在生成出来的世界里做动作，模型预测下一帧像素"
- **VAST Eden** —— 暧昧。他们说"3D world generator"，但产出来的是 mesh + texture + 一些 baseline 物理。本质是 rung 1 + scene graph，外挂物理引擎可以到 rung 2
- **Unity / Unreal + AI 工具链** —— rung 2，但人类工程师写 `Update()`，AI 只参与 asset 生成
- **Tripo / Hunyuan3D / Trellis / CSM** —— 都是 rung 1 的 asset 生成，本质上不在世界模型赛道里，虽然 marketing 把自己往这边靠

最近 1-2 年最显眼的 framing 转向是 rung 3 —— Sora、Genie 把"我们在学世界"作为旗帜。这是 OpenAI / DeepMind 这种 scale 决定论玩家最自然的押注：给我足够多视频，我学出一个世界。

但这条路线里有个隐藏的问题没人在公开讨论。

## 隐藏的分叉：状态怎么表示

rung 2 和 rung 3 都有一个 state，但 state 长什么样 —— **这才是真正的架构分叉**。

两个家族：

**符号家族 (symbolic)**：state 是一棵可化简、可代数操作、可微分的表达式树。SDF（signed distance function）是其中之一；OpenSCAD、CadQuery、JSCAD、L-system、CSG tree 都属于这家。共同特征：world 是一段可被人类（或 LLM）阅读、编辑、推理的代码。

**采样家族 (sampled)**：state 是某个 manifold 在某个分辨率下被采样的结果。mesh（顶点 + 三角面）、NeRF（神经辐射场）、Gaussian Splat、voxel grid、point cloud、video frame —— 都属于这家。共同特征：你拿到的是数据数组，不是公式。

这个分叉决定了一件事：**LLM 能不能 native 写它**。

LLM 的训练分布里有几百万行符号代码、几千万行函数复合、boolean 运算、L-system 描述。它 *没有* 被训练去手写 50000 个顶点的 vertex array。所以：

- LLM × SDF / OpenSCAD = native writing。"画一棵树" → 输出几行表达式
- LLM × mesh asset = RPC into a generator。"画一棵树" → 调用 `tripo.generate("tree")` → 得到一个 mesh blob，里面几万个浮点数 LLM 自己读不懂也改不了

VAST、Tripo、Hunyuan3D、Trellis、CSM 这些公司的输出底物全部是 mesh。无论他们模型内部塞了多少 diffusion、transformer、3D VAE、multi-view consistency loss —— **模型内部的数学很丰富，但数学没贯穿到输出层**。你拿到 mesh 那一刻，数学性就被冻结成数据了。

这就像 JPEG 算法本身是数学，但 JPEG 文件不是 —— 它是数学的某个执行结果。LLM 能写算法（写一个 JPEG 编码器），但 LLM 不能"编辑"一个 JPEG（除非借工具）。这是同一种结构差别。

这一点在视频模型上更极端：Sora 输出像素帧，**根本没有 state 的概念**。世界存在于它的训练权重里，每一次生成是从那个分布里采样一段 trajectory，采完就忘。下一次生成是另一段独立 trajectory，没有从前一段继承的 state，没有可以编辑的中间产物。

## 编译时、训练时、运行时

把整件事压到一个轴上：看 *世界的法则是在什么时候被绑定的*。

**物理引擎在编译时绑定法则**。Bullet、PhysX、Rapier 的整个 solver 用 C++ 写在引擎源码里。重力的方向、摩擦的形式（Coulomb 锥）、约束的"必须为真"（Signorini 条件）—— 编译进库的时候就定死了。运行时你能动的只有参数：`setGravity(0, -12.7, 0)` 是合法的，但"让重力是各向异性的"不是。**引擎给你的是一族法则上的参数旋钮，不是法则的著作权。**

**学习模型在训练时绑定法则**。Sora、Genie、世界模型 v2 全部的物理（如果有的话）来自训练语料里出现过的物理。1g 重力的物体怎么运动，它学得到；月球上 0.16g 它也学得到（如果训练集里有月球视频）；但"假如光速是 100 m/s 会怎样" —— 不可能，因为没人拍过。学习模型只会算它见过的或被写进数据里的那一族世界。

**规则运行时在运行时绑定法则**。Rule-writable 系统的 state 演化是用户 / LLM 在运行时编辑的代码。重力 ≠ 9.8，加一行；潮汐力是一条规则，加 5 行；时间膨胀是一个 `timeScale(p)` 函数，加 3 行。法则跟世界一起在文档里出现，跟世界一起被保存、被版本化、被分发。

这就是最压缩的世界模型 framework：

> **物理引擎在编译时绑定法则。学习模型在训练时绑定法则。规则运行时在运行时绑定法则。**
>
> **一个世界是一套规则；另一个世界，是一个 diff。**

第二句是第一句的工程含义。如果法则在运行时绑定，那么把地球切换到火星不是"重新生成一个世界"，是"打一个 patch"。`gravity 9.8 → 3.7`，几行代码。

## Outer Wilds：在 Unity 里手写了一个 mini 引擎

游戏圈知道这个故事，外面的人少。

*Outer Wilds*（Mobius Digital，2019）是一款基于 n-body 引力的太空探索游戏：行星互相绕转，玩家的物理由当前主导星球的引力场决定。**他们用 Unity 做的**。Unity 默认是 Newtonian 单一向下重力。所以他们做了什么？

他们绕开 Unity 的内置重力系统，**在 Unity 内部用 C# 手写了一套 n-body simulation 和自己的引力体系统**。从此 Unity 对他们来说不是物理引擎了 —— 只是渲染引擎 + 一个 update loop 入口。法则全部由他们自己的 gravity controller 模块负责。

这是"在 game engine 默认架构里争取异质物理"的活案例：**一支天才团队，要做引擎架构没预想的事，不得不在引擎里重新发明一个小型规则运行时**。

这件事的含义不要小看：**rule-writable runtime 不是一种小众偏好，是任何 ambition 超过"换贴图换模型"的游戏 / sim 项目自己悄悄重新发明的东西**。Outer Wilds 团队是聪明人；他们做这个不是为了"优雅"，是因为 Unity 的默认假设逼着他们做。

如果你把 Outer Wilds 团队当时做的事抽象出来 —— state 显式、规则可写、每帧 fold over rules —— 那基本就是 rung 2 LLM-native 范式。他们没有 LLM，他们手写 C#。但骨架是一样的。

## 一颗潮汐锁定的海洋行星 —— 但杀招不是浪

到这里我们手上有了一个 framework + 一个 evidence。接下来用一个 thought experiment 测试它的极限。

我选物理学家 Kip Thorne 在 *The Science of Interstellar*（2014）里详细推导过的那颗"潮汐锁定海洋行星" —— 大众也许更熟悉它在那部电影里的名字。它有三个区分性物理特征：

1. **1.3× 地球表面重力**
2. **来自附近黑洞的潮汐力主导海洋动力学** —— 那一公里高的浪不是随机的，是 ~1 小时一次的潮汐周期
3. **重力时间膨胀：表面 1 小时 = 外部 7 年**

电影 IP 我不引，但物理本身是 Thorne 公开发表的学术，可以自由讨论。

现在问三种架构：如果一个用户想"访问"这颗星，每种架构要做什么？

| 特征 | 物理引擎 | 视频模型 | 规则运行时 |
| --- | --- | --- | --- |
| 1.3g 重力 | `setGravity(0, -12.7, 0)` —— 一行 | 没训练过 1.3g 视频 —— 不行 | `gravity: 9.8 → 12.7` —— 一行 patch |
| 潮汐力 | 绕过引擎管线手写 custom force —— 工程量但能做 | 同样不行 | `forces` phase 一条 ~5 行规则 |
| **时间膨胀** | **架构层不可逾越** | **结构性 OOD** | **`timeScale(p)` 规则，几行** |

前两个特征引擎咬咬牙都能扛。**第三个才是照妖镜**。

时间膨胀的物理含义是：**dt 本身成为空间的函数**。靠近黑洞的区域以 1/61320 的速率演化，远离的区域以"正常"速率演化。如果你站在浪的边上、伙伴飞船在轨道上等着，你这边过 3 小时，他们那边过 21 年。

这件事对物理引擎意味着什么？**整个引擎架构建立在"全场共享一个 dt"之上**。每一行 solver 都假设这个 dt，每一个 broadphase cache 都用这个 dt 更新，每一对接触约束都用这个 dt 求冲量。要支持空间变化的 dt，**等于重写引擎**。Bullet、PhysX、Rapier 全部如此，没有一个例外。

对视频模型呢？更绝望。Sora 这类模型学的是"看起来像物理"，但**它从来没见过差速时间流作为可交互系统**。给它一万小时电影素材它学到的是"巨浪场景的电影质感"，*不是*一个时间流自洽、潮汐周期自洽、玩家进去可以触发反事实的世界。反事实物理对统计模型是结构性的分布外 —— 它只能预测训练分布里出现过的下一帧。

而在规则运行时里？时间膨胀是什么？给每个 subject 一个 `timeScale` 参数，让所有 forces / integrate 规则用 `dt × timeScale(p)` 步进。几行代码。**因为状态是显式的，每个区域的本地时钟可读可审计可序列化**。

我不夸大：多速率区域之间的物理交互（快区物体撞进慢区）确实有真正的设计难题要解 —— 守恒律怎么走？相对论框架怎么对齐？但**它在这个范式里至少是可表达的**。在另外两个范式里，它连出生的语法都没有。

把三种回答排成一行：

> **从地球到这样一颗星的距离 —— 在物理引擎里是一次 solver 改造工程，在视频模型里是一次不可能的 OOD 泛化，在规则运行时里是 ~15 行 patch（`gravity 9.8 → 12.7` + 潮汐力规则 + `timeScale(p)` 规则）。而且这个 patch 本身就存在 savegame 里，任何人能 diff 出"这个世界和地球差在哪三条法则"。**

这就是 binding-time 这个轴的杀伤力。

## 隐藏的 TAM：虚构世界的物理原型

退后一步看：rung-2 规则运行时这个范式服务谁？

答案出乎意料地大 —— 但目前没人在做产品。

**Kip Thorne 给 Christopher Nolan 做的事 —— "设定一套不同的法则，然后推演后果"** —— 是科幻作者、游戏世界观设计师、影视前期设计师、TRPG 系统设计师、硬科幻物理插画师每天的核心工作。他们目前用的工具：纸、笔、白板、Mathematica、自己的直觉。

没有任何工具让他们"写下法则、按下播放、看到涌现"。Sora 不行（学不到没拍过的物理），Unity 不行（架构假设固定），Tripo / Hunyuan 更不行（只生成 asset）。

这个市场的上游是**所有人爱的 game world** 和**所有可信的硬科幻物理设定**。它现在被一群高学历 + 高直觉 + 高时间成本的专家手工服务。一个 rule-writable simulator 即便只覆盖这套 workflow 的 30%，影响也会 cascade 到下游一整圈创意产业。

把这个市场放进 LLM × symbolic representation 的整体 TAM 里：在 editorial illustration（杂志、海报、绘本）、PPT 视觉、emoji/icon 之后，**虚构世界 worldbuilding 是 LLM × symbolic 这条路最自然的下一站**。它的客户单价更高、复利效应更强、文化辐射半径更远。

## 收尾

绕回开头：VAST 押注 3D world generator，Sora 朝"世界模拟器" reposition，Genie 喊"foundation world model"。

到这里你应该能看出来，他们仨在解的不是同一个问题。VAST 在做 rung 1 + 0.5 rung 物理外挂，他们的客户是游戏工作室；Sora 在赌 rung 3 像素学习，他们的客户是内容消费者；Genie 在赌 rung 3 + agent action loop，他们的客户暂时还是研究员。

**rung 2 LLM-native 这一块 —— 法则在运行时绑定、状态是符号文档、demo 是改三行代码看世界变化 —— 目前没有大玩家在做**。这不是因为这块不值得做，是因为它需要的技术栈跟 rung 1 / rung 3 路线的玩家擅长的不一样：你要懂符号几何（SDF），要懂 LLM × code 那一面，要懂 game engine 设计但要有意识地拒绝 game engine 的默认架构。三种技能交叉的人不多。

我自己在做的 Atlas（开源仓 sdf-js，在 github.com/shaun8149/sdf-js）是这块的一次尝试。这篇文章不是为了 pitch 这个项目 —— 我更在意 framing 本身能不能立住。如果 framing 是对的，未来会有 N 个这样的项目；如果是错的，提前发现也好。

最后回到 1 个比喻。

Sora 这条路是把世界录下来再让神经网络学。Atlas 这条路是把世界的法则写下来再让代码演算。两条路都是真的 cross-modal 突破，都需要做。但你能学的世界，限于被拍摄过的世界。

**能被拍摄的世界才能被学习。能被书写的世界才能被模拟。而能被书写的，不止是世界的形状，还有世界的法则。**

---

<!-- 致谢段（可选）：作者可在发布前自行决定是否署 Fable 5 / Claude 等 LLM 协作者。 -->
<!-- *本文 framing 经多轮 LLM 协作 review 打磨，特别感谢 Fable 5 / Claude 模型对若干段落的精确化建议。* -->
