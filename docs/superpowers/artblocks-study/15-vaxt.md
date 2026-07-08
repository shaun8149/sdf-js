# 第十五课: Växt — Santiago (阿根廷)

- **ArtBlocks #488** · 原生 WebGL2 · 16KB · CC BY-NC 4.0 → recipe-only
- 视觉: 植物性 (växt=瑞典语"植物") 有机形态, SDF 软影

## 分流判定: shader-core, 且是元编程 shader (→ 3D 端移交, 架构级共鸣)

JS 侧没有任何绘制调用 (0 个 vertex/ellipse/stroke) — 它做的事是**用
hash 决策拼装 GLSL 源码字符串**: 逐项 `$n += "sh += SM(...)*step(...)"`
把每个形状的 SDF 软影表达式串进 fragment shader, 内嵌自实现 simplex
噪声, 最后 createShader 编译。作品 = 一次性生成的专属 shader。

**这就是 Atlas sdf3.compile.js 的架构**: 生成器不画画, 生成器写 shader,
GLSL 是编译目标不是手写产物。Curated 出现同构架构 = thesis 的又一独立
印证 (code-is-data 测试第三条的野生样本)。

## 移交 3D 端 idiom

- 软影拼接: 每个遮挡体贡献一项 `smoothstep(-k,0,-d)*step(-d,0)` 累加进
  shadow 因子 — O(N) 项内联展开, 无循环无数组, GLSL ES 1.00 安全
- `#define ro(a) mat2(...)` 旋转宏 + 单字母类型别名压缩 (A=vec2...) —
  链上字节预算下的 shader 高尔夫纪律

## 一句话学到的

最高级的生成器不生成像素, 生成程序 — 作品是被铸造出来的那份 shader 本身。
