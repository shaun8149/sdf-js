# Plan: Blender 借法实施(四波)

> Spec:`../specs/2026-07-13-blender-borrow-spec.md`(先读)。
> 节奏:每波一个 PR,user merge 后进下一波;A/B 可紧连,C 前重估,D 单独立项。

## Wave A — 材质引用 + collections

1. spec.js:`scene.materials` 注册表 + `subject.material` string 引用解析
   (悬空引用 ERROR);`scene.collections` + `subject.collection` schema。
2. assembleDeck 双写:每个 subject 附 collection(station-k / path-k / massing /
   horizon / decor-*),注册表带切片语义(kind/cull/budget);id 前缀原样保留。
3. sliceDeckWindow 切到 collection 元数据驱动(fallback:无 collection 场景走
   旧正则——迁移期兼容 author/text-to-ir 老产物)。
4. 消费者迁移 checklist(23 文件清单):deck-shader-windows、beats、figure-core、
   test 魔数逐个切;全绿后删 fallback(可拆成 A2 小 PR)。
5. 材质注册:assembleDeck/renderers 的重复材质抽到注册表(36 种);decor voice
   与章节 accent 改走注册表改写。
6. 守卫:golden 重烤一次 + 语义等价断言(切片结果与旧正则逐 id 一致)。

## Wave B — modifiers v1(expansion)

1. `src/scene/modifiers.js`:四个修饰符的展开器 + `expandModifiers()`;
   接入 apply-studio-scene 管线(expandStage 之后)。
2. spec.js 校验(未知 type ERROR;参数域检查;count 上限接 sanity 预算)。
3. 改写产出端:assembleDeck 面包屑(12×array)、horizonSilhouettes(1×radial)、
   guard(mirror)、zoneMassing;deck-decor stelae/inlay(radial/array+scatter);
   render-network stardust(scatter)。
4. **语义等价快照**:展开产物与改写前手工 subjects 逐字段一致(一次性验证脚本,
   等价确认后 golden 重烤)。
5. 文档:atom/生成器作者指南补 modifiers 一节(LLM 面的 few-shot 示例,
   prompt 保持 SHORT 原则不变——modifiers 是 lift 输出面,不是 prompt 面)。

## Wave C — domain-rep lowering(stone/rich)

1. compile 按 renderMode 分支:array→opRepLim、radial→角度扇区折叠、
   mirror→abs 折叠;scatter 恒 expansion。
2. 验证:BOB-vs-FLY 双渲染器对照(域重复的 Lipschitz/法线/阴影);
   窗口 leaf 预算断言更新(面包屑 84→12、石板 14→1);laptop 实测复验。
3. 风险预案:任一渲染档出 artifact → 该档回落 expansion(lowering 是纯优化,
   语义由 expansion 定义)。

## Wave D(远期,单独立项)— analytic 解析重复求交

box/sphere 阵列的 k 近邻实例解析求交;立项前先量化 B/C 之后 analytic 档还剩
多少 leaf 压力,可能不再需要。

## 里程碑判据

- A 完成:grep 无人再消费 `/^s(\d+)-/`(除 fallback);材质注册表接管 deck 配色。
- B 完成:字节 deck subjects 319→≤100;golden/fidelity/全套绿。
- C 完成:content 窗口平均 leaf 数下降 ≥40%,laptop 帧率复验报告。
