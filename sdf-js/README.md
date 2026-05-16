# sdf-js

> **底层 SDF library，驱动 [Atlas](../README.md) 这个 LLM-native illustration platform。**
> 仓库整体定位、商业 thesis、roadmap 见根目录 [../README.md](../README.md)。本 README 只讲库本身。

链式 JavaScript SDF 库 + 配套的离散结构生成器 / 渲染器池 / scene 编译管线。`src/` 下 10 个 sibling layer 通过函数式接口耦合，互相不强依赖。

---

## 跑起来

```bash
python3 dev-server.py 8001        # dev server，加 Cache-Control: no-store 防 ES 模块图缓存
open http://localhost:8001/examples/
```

`examples/index.html` 列出全部 demo（MVP / Compositor 雏形 / autoscope-clone / 3D Pasma rayhatching / 编辑器 / shader 渲染 / CA 机器人填充）。

```bash
node test/smoke.mjs              # 3D smoke 测试
node test/smoke2d.mjs            # 2D smoke 测试
```

---

## 项目结构

```
sdf-js/
├── package.json
├── dev-server.py                 自带 dev server（no-store cache header）
├── src/
│   ├── index.js                  顶层聚合入口
│   ├── sdf/                      形状代数 + GLSL 编译
│   │   ├── core.js               SDF2 / SDF3 类 + defineOp* 注册器
│   │   ├── d2.js                 2D primitives + 2D transforms
│   │   ├── d3.js                 3D primitives + 3D transforms（含 .extrude / .revolve / .twist / .bend）
│   │   ├── dn.js                 维度无关 ops（union / difference / intersection / shell / blend / rep / negate / ...）
│   │   ├── probe.js              4-value probe 契约 {intensity, region, hit, normal}
│   │   ├── raymarch.js           CPU raymarching（canvas2D 3D 渲染器用）
│   │   ├── sdf2.glsl.js          2D SDF → GLSL 函数字符串
│   │   ├── sdf3.glsl.js          3D SDF → GLSL 函数字符串
│   │   ├── sdf3.compile.js       SDF 树 → fragment shader（含 emitObjectIndex 多物体上色）
│   │   ├── time.js               time-aware primitive 包装
│   │   ├── vec.js / vec2.js      math primitives
│   │   └── index.js              形状层 API barrel
│   ├── scene/                    SceneData v1 — Atlas Compositor 4-input lingua franca
│   │   ├── SPEC.md               spec single source of truth（locked 2026-05-17）
│   │   ├── spec.js               (M0 待办) validator + JSDoc types
│   │   ├── compile.js            (M0 待办) SceneData → SDF tree + camera + light + regionFn
│   │   └── serialize.js          (M0 待办) parse / stringify / version migration
│   ├── render/                   渲染器池（6 个 renderer + pattern family）
│   │   ├── silhouette.js         flat-color 实色（Lotta lineage）
│   │   ├── bobStipple.js         canvas2D 多层笔触 stipple（BOB lineage）
│   │   ├── hatch.js              Pasma rayhatching（2D contour-following + 3D surface-wrap）
│   │   ├── raymarched.js         canvas2D Lambert
│   │   ├── flyLambert.js         GPU Lambert + pointer-lock WASD
│   │   ├── bobShader.js          GPU Autoscope-style 量化色块 + 2-pass FBO 沙画
│   │   ├── truchet.js            Smith arcs 棋盘 pattern
│   │   ├── spaceCurve.js         Hilbert / Gosper L-system curves
│   │   ├── motifGrid.js          Reinder Nijhoff motif library × 3-band grid sweep
│   │   └── （painted / sand / bands / flowLines / lineTile / tileGrid 等支持文件）
│   ├── field/                    标量场（procedural）—— noise + proto
│   ├── streamline/               curve tracing（Pasma rayhatching 内核）
│   ├── motifs/                   hand-crafted SVG path library（Reinder Nijhoff default set）
│   ├── palette/                  色彩方案（autoscope / bob / generative / tyler）
│   ├── ca/                       cellular automata over SDFs（kjetil-golid-derived）
│   ├── input/                    pointer-lock WASD fly camera（Fly 3D + BOB GPU 共用）
│   └── math/                     easing 曲线
├── examples/
│   ├── index.html                demo 目录页
│   ├── mvp/                      LLM text → SDF MVP（Compositor M1 后会成为 text-mode tab）
│   ├── sdf/                      纯 SDF demo（2d / 3d / editor / autoscope-clone / streamline / painted / cactus / ...）
│   ├── ca/                       CA 静态 + 装配动画
│   ├── flow/                     流线 demo
│   └── tile/                     tile renderer demo
└── test/
    ├── smoke.mjs                 3D 测试
    └── smoke2d.mjs               2D 测试
```

跨层耦合规则：`render/` 消费 `sdf/` / `streamline/` / `motifs/` / `palette/`；`ca/` 用 `sdf/` 当 `isInside` 谓词；`scene/` 编译目标是 `sdf/` 树 + `palette/` + 相机 spec。**互不强依赖，可以单独 import 单层**。

---

## SDF API tour

### Primitives

完整列表见 [src/scene/SPEC.md § Primitive registry](./src/scene/SPEC.md#primitive-registry-v1-set)。简要摘要：

| 类别 | 代表 | 备注 |
|---|---|---|
| **2D 基础** | `circle / ellipse / rectangle / rounded_rectangle / triangle / hexagon / polygon` | IQ 1:1 |
| **2D 装饰** | `heart / star / moon / cross / pie / horseshoe / egg / trapezoid / parallelogram / rhombus / oriented_box / quadratic_bezier` | editorial / emoji 高频 |
| **2D legacy** | `flower / line / segment / arc / ring` | Wave 1A |
| **3D 基础** | `sphere / box / rounded_box / torus / capsule / cylinder / cone / capped_cone / ellipsoid / plane` | IQ 1:1 |
| **3D 装饰** | `pyramid / slab3 / wireframe_box / prism / capped_cylinder` | |
| **3D Platonic** | `tetrahedron / octahedron / dodecahedron / icosahedron` | Wave 2B |
| **2D→3D 升维** | `.extrude(h) / .revolve(offset) / .extrude_to(other, h, easing?)` | P1 milestone |
| **3D artistic ops** | `.twist(k) / .bend(k) / elongate(size)` | Wave 2C |

实例是 callable：`circle(1)(x, y)` 返回 `(x, y)` 到圆边的有符号距离。

### Booleans + 维度无关 ops

```js
import { union, difference, intersection, negate, dilate, erode, shell, blend, rep } from 'sdf-js/src/sdf/dn.js';

union(a, b, c, ...);                 // 最小距离
difference(a, b, ...);               // a 减 b
intersection(a, b, ...);             // 共同区域

union(a, b, { k: 0.1 });             // smooth blending，k 是混合宽度
difference(a, b, { k: 0.05 });

negate(a);                           // -d，里外翻
dilate(a, r);                        // 膨胀
erode(a, r);                         // 收缩
shell(a, t);                         // 抽壳
blend(a, b, k);                      // 线性插值
rep(a, [px, py], { count, padding }); // 周期重复
```

### Chainable transforms

```js
circle(1).translate([2, 0]).rotate(Math.PI / 4).scale(0.5);
sphere(1).translate([0, 0, 5]).rotate([0, Math.PI / 3, 0]);     // Euler 数组
sphere(1).orient([0, 1, 0]);
rectangle([1, 0.2]).circular_array(8);
polygon(profile).revolve(0);                                     // 2D → 3D
```

| 2D method | 3D method |
|---|---|
| `.translate([x, y])` | `.translate([x, y, z])` |
| `.scale(factor)` | `.scale(factor)` |
| `.rotate(angle)` | `.rotate(angle, axis)` or `.rotate([rx, ry, rz])` |
| `.circular_array(count)` | `.orient(axis)`, `.twist(k)`, `.bend(k)` |
| `.extrude(h)` → SDF3 | — |
| `.revolve(offset)` → SDF3 | — |

布尔与 dim-agnostic ops 也是方法：`a.union(b)`、`a.difference(b)`、`a.shell(0.05)`。

---

## Renderer 池

6 个渲染器分两个 family，都消费同一棵 SDF 树：

```js
import * as render from 'sdf-js/src/render/index.js';

// Canvas2D family — offline / SVG-ready
render.silhouette(ctx, [{ sdf, color }], { view });
render.bobStipple(ctx, [{ sdf, color }], { view });           // 2D 或 3D 自动 dispatch
render.hatch(ctx, [{ sdf, color }], { view });                // Pasma rayhatching
render.raymarched(ctx, [{ sdf, color }], { view });           // canvas Lambert

// GPU shader family — real-time / WASD / 60fps
import { createFlyLambertRenderer } from 'sdf-js/src/render/flyLambert.js';
import { createBobShaderRenderer } from 'sdf-js/src/render/bobShader.js';

const fly = createFlyLambertRenderer({ canvas, getControls: () => ({...}) });
fly.render(sdf);

const bob = createBobShaderRenderer({ canvas, getControls, twoPass: true, bufferResolution: 320 });
bob.render(sdf);
```

### Pattern axis（独立第三轴）

```js
render.truchet(ctx, { view, mask });
render.gosper(ctx, { view, mask });
render.motifGrid(ctx, { view, library, order, bands, mask });
// （Hilbert 仍 export 但 MVP UI 已撤）
```

Pattern 跟 subject 互相 mask（Pasma surreal-staging idiom）—— `mask` 字段传 subject SDF，pattern 自动避让 subject 形状。

---

## Shader 编译

SDF2 / SDF3 都能编译到 GLSL。两条路径：

### 路径 1：直接拼字符串（简单场景）

```js
import { SDF2_GLSL } from 'sdf-js/src/sdf/sdf2.glsl.js';

const fragmentShader = `
  precision highp float;
  ${SDF2_GLSL}
  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;
    float d = sdCircle(p, 0.5);
    gl_FragColor = vec4(d < 0. ? vec3(1.) : vec3(0.), 1.);
  }
`;
```

### 路径 2：从 SDF 树编译（多物体 / 上色用）

```js
import { compileSDF3ToGLSL, canCompileSDF3 } from 'sdf-js/src/sdf/sdf3.compile.js';

const sdf = union(sphere(1), box([0.5, 0.5, 0.5]).translate([2, 0, 0]));
if (!canCompileSDF3(sdf)) throw new Error('contains unsupported op');

const { glsl } = compileSDF3ToGLSL(sdf, {
  sceneFnName: 'sceneSDF',
  emitObjectIndex: true,                 // 多物体上色：side-effect imin → minIndex 全局
});
// glsl 是 fragment shader 片段，含 sceneSDF() + imin / ismoothUnion globals
```

`emitObjectIndex` 让每个 leaf 拿到独立 object index → spaceCol 可以按 index 取不同色块（BOB GPU / Autoscope 上色基础）。

完整 demo：[examples/sdf/cactus-shader.html](./examples/sdf/cactus-shader.html) / [examples/sdf/shader-lambert-browser.html](./examples/sdf/shader-lambert-browser.html) / [examples/sdf/autoscope-clone.html](./examples/sdf/autoscope-clone.html)。

---

## CA API

把 SDF 当 `isInside` 谓词喂给 kjetil-golid ApparatusGenerator 端口：

```js
import * as ca from 'sdf-js/src/ca/index.js';

const isInside = ca.fromSdf2(myShape, gridDim);
const grid = ca.caGrid(isInside, gridDim, {
  initiateChance: 0.85,
  extensionChance: 0.75,
  solidness:      0.56,
  hSymmetric:     true,
});

ca.caDraw(ctx, grid, cellSize);

// 或折成 rect 列表做装配动画
const rects = ca.caRects(grid);
ca.caShuffle(rects, { frames: 200, holdFrames: 25 });
ca.caDrawRectsAt(ctx, rects, frameIdx, cellSize);
```

详细 options 见 [src/ca/ca.js](./src/ca/ca.js) `caGrid` 签名。完整例子 [examples/ca/ca-animate.html](./examples/ca/ca-animate.html)。

---

## SceneData v1（M0，进行中）

新加的 `src/scene/` 是 Atlas Compositor 的 4-input lingua franca —— LLM / generator / 2D editor / 3D editor 都 emit 同一种 JSON 格式，编译器把它转成 SDF 树 + 相机 + 光源 + region 函数。

```js
import { compile, parse, stringify, validate } from 'sdf-js/src/scene/index.js';   // M0 Day 2-3 待 ship

const scene = parse(jsonString);
const { sdf, camera, light, regionFn, groundY } = compile(scene);
```

完整 spec 见 [src/scene/SPEC.md](./src/scene/SPEC.md)。

---

## 主要 demo 索引

| 入口 | 内容 |
|---|---|
| [`examples/mvp/`](./examples/mvp/index.html) | **MVP** — text prompt → Anthropic Claude → SDF JS → 6 renderer × 4 pattern 渲染。Compositor M1 后会变成 text-mode tab |
| [`examples/sdf/autoscope-clone.html`](./examples/sdf/autoscope-clone.html) | **Autoscope clone** — 6 generative scene template + URL hash 分享 + BOB GPU 2-pass 沙画 |
| [`examples/sdf/render-showcase.html`](./examples/sdf/render-showcase.html) | 4 renderer × 同一 SDF 集 |
| [`examples/sdf/streamline-scenes.html`](./examples/sdf/streamline-scenes.html) | Pasma 2D + 3D rayhatching gallery |
| [`examples/sdf/painted-scenes.html`](./examples/sdf/painted-scenes.html) | BOB stipple gallery（含 3D scenes 15+16）|
| [`examples/sdf/test-pasma-capsules.html`](./examples/sdf/test-pasma-capsules.html) | 3D Pasma scene 调控页（pointer-lock WASD） |
| [`examples/sdf/shader-lambert-browser.html`](./examples/sdf/shader-lambert-browser.html) | 独立 Fly 3D scene browser |
| [`examples/sdf/2d.html`](./examples/sdf/2d.html) / [`3d.html`](./examples/sdf/3d.html) | 2D 距离场可视化 / 3D raymarching 网格 |
| [`examples/sdf/editor.html`](./examples/sdf/editor.html) | SDF 编辑器（滑条 + 实时图 + 代码输出） |
| [`examples/ca/ca.html`](./examples/ca/ca.html) / [`ca-animate.html`](./examples/ca/ca-animate.html) | SDF + CA 机器人填充（静态 + 装配动画） |

---

## License

MIT —— 见根目录 [LICENSE.md](../LICENSE.md)。原始 Python SDF primitives © Michael Fogleman；JS 移植 + 扩展 + renderer 池 + motif library + scene 引擎 + Atlas brand © 2024–。
