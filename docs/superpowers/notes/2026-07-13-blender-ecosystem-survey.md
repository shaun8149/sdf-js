# 2026-07-13 — text-to-Blender 生态调研(Blender 借法 spec 的证据基础)

> 四路调研(主综合 + BlenderGPT 品类深挖 + blender-mcp 生态深挖 + Infinigen 源码实读),
> star 数均为 2026-07 GitHub 实抓。借法判定见 `../specs/2026-07-13-blender-borrow-spec.md`。
> 本文件是核实过的事实底账(项目/数字/失败模式),供日后查证。

## 一、项目清单(核实数据)

| 项目 | Star | 状态 | 中间表示 | 关键事实 |
|---|---|---|---|---|
| ahujasid/blender-mcp | 23.8k | 活跃放缓 | 结构化感知 + **任意 exec 写操作** + 资产库工具×18 | 建模类结构化工具为零;头号 issue=连接稳定;安全评分 Grade D(unsandboxed exec/路径穿越/SSRF) |
| Blender Lab 官方 MCP(5.1+) | — | 2026-04 起 | null-byte JSON over TCP,本质仍 exec | **Anthropic 成为 Blender 基金 Corporate Patron(€240k/年)**;场景刻意收窄=调试/批处理 |
| gd3kr/BlenderGPT | 4,957 | 死(2024-06) | 自由 bpy + 正则提取 + exec,无重试无上下文 | 插件先于生成代码腐烂(OpenAI API 改版杀全插件);作者转行卖资产生成(blendergpt.org) |
| BlenderGPT 系仿品×9 | 1-126 | 全灭只剩 1 个活 | 同上 | 唯一活的靠 g4f 白嫖;唯一做全错误重试闭环的是闭源商业品(F.A.S.T.) |
| FreedomIntelligence/BlenderLLM | 269 | 论文态 | 微调 Qwen2.5-Coder-7B 生成 bpy | **GPT-4o 裸写 bpy 仅 0.565/0.444 分,o1 0.687,微调后 0.748**(CADBench)——通用模型上限被钉死 |
| RFingAdam/mcp-blender | 3 | 活 | **218 个结构化工具**(28 种 modifier/7 个 geonode) | 数据模型覆盖最深,市场无人买单——通用 DCC 的 API 面太大 |
| 3D-GPT(ANU/牛津) | 851 | 部分开源 | **Infinigen 生成器参数**(LLM 只填参) | 需给每个函数配文档+可读重构版+示例(LLM/documents/);表达力被生成器库封顶 |
| SceneCraft(ICML24 Oral) | 未开源 | — | 关系场景图→数值约束函数→求解→bpy | 双循环:GPT-4V 看图批评 + 函数沉淀 library learning |
| Holodeck(AI2, CVPR24) | 560 | 停更 | 结构化 JSON + 空间关系约束 + DFS/MILP 求解 | **LLM 从不直接吐坐标**;版本钉死资产库导致复现地狱 |
| SceneTeller / LayoutGPT | 58 / 402 | 停更 | LLM 直接吐 bbox 坐标(JSON / CSS 语法) | 都需要事后清洗重叠/越界——LLM 吐坐标不可靠的直接证据 |
| BlenderAlchemy(ECCV24) | 94 | 低维护 | **编辑既有程序**(VLM 评审树搜索) | 唯一深用 shader/geonode 的;每轮真渲染+VLM,贵且不可靠 |
| princeton-vl/Infinigen | 7,088 | 本周仍提交 | AssetFactory + gin + node transpiler | 见下节 |

## 二、Infinigen 源码实读(借法的正面参照)

- **AssetFactory 两级 seed**:`factory_seed` 物种级(构造时 `FixedSeed` 内采样共享参数),
  实例 seed = `int_hash((factory_seed, i))` —— 同种不同体。`spawn_asset` 是不可 override
  的模板方法(seed 上下文 + bpy.data GC 包好再调 `create_asset`)。
  ↔ Atlas decor 的 voice lane / per-station lane 独立收敛于同构。
- **placeholder 两阶段 + 距离 LOD**:`create_placeholder`(粗盒,供布局/相机规划)与
  `create_asset`(高细节)分离,`face_size` 按相机距离定。↔ massing proxy / stone-full。
- **node transpiler(v2.7.1,双表示)**:美术在 Blender 搭 nodes → 1 秒转 Python
  (`nw.new_node(...)` 形式)→ 开发者手工把常量替换成 numpy 分布(生成文件头自动
  import uniform/normal 就为这步)。资产库长到几百个生成器的供给端机制。
- **Indoors 约束 DSL**:硬约束(布尔,`*` 连接)× 软评分(加权 maximize/minimize)
  + 多阶段模拟退火;moves 含改生成器参数。词汇:`related_to/count/in_range/
  StableAgainst/SupportedBy/accessibility_cost/...`(home.py 1488 行)。
- **Infinigen 2.0 / procfunc**(进行中):官方把巨型工厂类+散装 gin 重写为
  "可组合可随机化函数块 + trace-to-code" —— 工厂类不是终局的官方自认。
- **它交的税**(issue 实测):安装地狱(bpy 锁 4.2.0+自编译 C 扩展)、最小场景
  10min/16GB、跨平台同 seed 不可复现(文档挂横幅认账)、gin 无统一 schema。

## 三、五条集体经验(借法判定的依据)

1. **自由 bpy 代码是被证伪的一端**:双端版本漂移 + 幻觉 + 不可 diff;品类时间线
   (2023 引爆 → 2026 开源全灭)+ CADBench 定量上限。
2. **赢家表示 = 声明式场景图 + 关系约束,坐标交求解器**(SceneCraft/Holodeck/
   Infinigen-Indoors 独立收敛)——Atlas IR(relations 一等公民、renderer 解算)同构。
3. **值得借的是数据模型不是 API**:modifier stack / collections / datablock /
   双表示;constraints/drivers/NLA 全生态无一被 LLM 侧用上,不借。
4. **生成器 = 工厂 × 参数分布 × seed 是 LLM 填参的最佳颗粒度**(3D-GPT 实证),
   复利继续投 atom 参数面与文档格式。
5. **两个税避开**:运行时重量(内嵌巨型宿主/版本钉死资产)与 VLM 看图主回路
   (只配兜底 QA)。附:全生态公认缺"几何验证层"——Atlas 的 validator/sanity/
   golden 是差异化卖点;结构化深覆盖在通用 DCC 无人买单,但演示垂直域窄,
   封闭 schema 可行,该教训不迁移。

## 四、战略注脚

- rung-2(LLM 调用 Blender)正在机构化(官方 MCP + Anthropic 赞助)——Atlas 差异化
  钉死 rung-3(LLM 写世界)+ 演示垂直。
- blender-mcp 23.8k star = MCP 分发时机的胜利 → Atlas-MCP backlog 的优先级佐证;
  教训:**永不暴露 exec 逃生舱**,只暴露 schema 工具 + atlas_render。
- "3D 端的 ArtBlocks = Infinigen":AssetFactory 生成器可按 ArtBlocks 50 课模式
  做研读语料(待 user 排期)。
