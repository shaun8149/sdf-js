# sdf-js

链式 JS SDF 库，分两层：

- **`src/sdf/`** —— 形状代数：primitives + booleans + transforms + GLSL 编译
- **`src/ca/`** —— 上层离散结构生成器：把任意 SDF 当 `isInside` 谓词消费的元胞自动机

`ca/` 不 import `sdf/`；二者通过函数式谓词接口耦合。未来 `voronoi/` / `lsystem/` / `reaction-diffusion/` 等会平铺在 `ca/` 同层。仓库整体定位见 [../README.md](../README.md)。

---

## 跑起来

```bash
npm run serve              # = python3 -m http.server 8000
open http://localhost:8000/examples/
```

`examples/index.html` 列出全部 demo（2D 距离场可视化、3D raymarching、SDF 编辑器、Shader 渲染、CA 机器人填充与装配动画）。

```bash
node test/smoke.mjs        # 3D smoke 测试
node test/smoke2d.mjs      # 2D smoke 测试
```

---

## 项目结构

```
sdf-js/
├── package.json
├── src/
│   ├── index.js              聚合入口
│   ├── sdf/
│   │   ├── index.js          形状层 API
│   │   ├── core.js           SDF2 / SDF3 类 + defineOp* 注册器
│   │   ├── d2.js             2D primitives + 2D transforms
│   │   ├── d3.js             3D primitives + 3D transforms
│   │   ├── dn.js             维度无关 ops（union / difference / shell / ...）
│   │   ├── vec.js            3D 向量
│   │   ├── vec2.js           2D 向量
│   │   └── sdf2.glsl.js      GLSL 端 2D primitives 字符串（fragment shader 用）
│   └── ca/
│       ├── index.js          CA 公开 API
│       └── ca.js             实现（kjetil golid ApparatusGenerator 端口）
├── examples/
│   ├── index.html            demo 目录页
│   ├── sdf/                  纯 SDF demo（2d, 3d, editor, cactus*, scenes*）
│   └── ca/                   ca 静态版 + 装配动画版 + 共享机器人定义
└── test/
    ├── smoke.mjs             3D 测试（box / sphere / 布尔 / orient / smooth k）
    └── smoke2d.mjs           2D 测试（圆 / 圆角矩形 / polygon / 链式变换 / dim-agnostic ops）
```

---

## SDF API

### Primitives

| 2D | 3D |
|---|---|
| `circle(radius=1, center=[0,0])` | `sphere(radius=1, center=[0,0,0])` |
| `rectangle(size=1, center, a, b)` | `box(size=1, center=[0,0,0])` |
| `rounded_rectangle(size, radius=0, center)` | `plane(normal=[0,1,0], point)` |
| `equilateral_triangle()` | |
| `hexagon(r=1)` | |
| `polygon(points)` | |
| `triangle(p0, p1, p2)` | |
| `trapezoid(a, b, ra, rb)` | |
| `line(normal=[0,1], point)` | |
| `flower(amp=0.12, freq=10, offset=20, baseR=0.2)` | |

返回的都是 `SDF2` / `SDF3` 实例。实例是 callable：`circle(1)(x, y)` 返回 `(x,y)` 到圆边的有符号距离。

### Booleans + dim-agnostic ops

```js
union(a, b, c, ...);                 // 取最小距离
difference(a, b, ...);               // a 减去 b
intersection(a, b, ...);             // 共同区域

union(a, b, { k: 0.1 });             // smooth blending，k = 圆角半径
difference(a, b, { k: 0.05 });

negate(a);                           // -d，里外翻转
dilate(a, r);                        // 整体膨胀 r
erode(a, r);                         // 整体收缩 r
shell(a, thickness);                 // 抽壳 ±thickness/2
```

`union` / `difference` / `intersection` 都支持 N 元参数 + 末尾的 `{k}` 选项做平滑融合。

### Chainable transforms

变换暴露为方法（顶层不导出 `translate` 这种 2D/3D 同名函数，避免冲突）。每次返回新实例：

```js
circle(1).translate([2, 0]).rotate(Math.PI / 4).scale(0.5);
sphere(1).translate([0, 0, 5]).rotate(Math.PI / 3, [0, 1, 0]);
sphere(1).orient([0, 1, 0]);          // 把局部 Z 轴对齐到目标方向
rectangle([1, 0.2]).circular_array(8); // 8 份围成圆
```

| 2D method | 3D method |
|---|---|
| `.translate([x, y])` | `.translate([x, y, z])` |
| `.scale(factor)` —— scalar 或 `[sx, sy]` | `.scale(factor)` —— scalar 或 `[sx, sy, sz]` |
| `.rotate(angle)` | `.rotate(angle, axis=Z)` |
| `.circular_array(count)` | `.orient(axis)` |

布尔与 dim-agnostic ops 也是方法形式：`a.union(b)`、`a.difference(b)`、`a.shell(0.05)` 等同于函数形式。

### Smooth blending

`union(a, b, { k })` / `difference(a, b, { k })` / `intersection(a, b, { k })` 用 polynomial smooth-min，`k` 是混合宽度（距离单位）。`k = 0`（或不传）退化成硬边。

---

## CA API

```js
import * as ca from './src/ca/index.js';

const isInside = ca.fromSdf2(myShape, gridDim);     // SDF → isInside(x,y,fuzz)
const grid = ca.caGrid(isInside, gridDim, {
  initiateChance: 0.85,
  extensionChance: 0.75,
  solidness:      0.56,
  hSymmetric:     true,
});

// 静态渲染
ca.caDraw(ctx, grid, cellSize, { offsetX, offsetY });

// 或者折成矩形列表（合并同色相邻 cell），可以拿去做动画
const rects = ca.caRects(grid);
ca.caShuffle(rects, { frames: 200, holdFrames: 25 });  // 累积 rect.path[]
ca.caDrawRectsAt(ctx, rects, frameIdx, cellSize, { stroke: false });
```

### `caGrid(isInside, gridDim, opts)`

| opt | default | 说明 |
|---|---|---|
| `colors` | 5 色调色板 | 调色板数组 |
| `initiateChance` | `0.9` | 已在 active 区时起新房间的概率 |
| `extensionChance` | `0.86` | 已有房间向外延伸的概率 |
| `solidness` | `0.5` | 完全空白处起新房间的概率 |
| `verticalChance` | `0.5` | case 9 偏垂直 vs 水平 |
| `roundness` | `0` | 1 = 硬边、0 = 最软（fuzz 完全随机） |
| `colorMode` | `'group'` | `'random'` / `'main'` / `'group'` / 其他=纯 main |
| `groupSize` | `0.82` | group 模式色彩聚合度 |
| `hSymmetric` | `true` | 水平镜像 |
| `vSymmetric` | `false` | 垂直镜像 |
| `simple` | `false` | true = 跳过 SDF 检查，铺满整网格 |

`isInside` 签名：`(x, y, fuzz=0) => bool`。`x, y` 是网格坐标（0..gridDim）；`fuzz` 是 caller 传入的容忍度（±1 量级），由 isInside 自己决定如何翻译成距离阈值。`fromSdf2` 默认把 fuzz 乘 `2/gridDim` 翻成约一格大小的世界距离。

### 渲染器

```js
ca.caDraw(ctx, grid, cellSize, { offsetX, offsetY, lineColor, lineWidth });
ca.caDrawRects(ctx, rects, cellSize, options);
ca.caDrawRectsAt(ctx, rects, frame, cellSize, {
  offsetX, offsetY,
  lineColor: '#000', lineWidth: 2,
  stroke: true,                   // false → 只填色不描边
  defaultFill: '#fff',
});
```

### 装配动画

`caShuffle(rects, { frames, holdFrames, movementLength, symmetric })` 累积每个 rect 的 `.path[]` 数组：开头 `holdFrames` 帧停在原位，之后随机推开。倒着播 `path` 就是 "scatter → assemble" 装配动画。完整例子见 [examples/ca/ca-animate.js](./examples/ca/ca-animate.js)。

---

## Shader 编译

`src/sdf/sdf2.glsl.js` 导出 `SDF2_GLSL` 字符串 —— 一组 GLSL `float circle(...)` / `float rectangle(...)` 函数定义，可以直接拼进 fragment shader。

```js
import { SDF2_GLSL } from './src/sdf/sdf2.glsl.js';

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

`examples/sdf/cactus-shader.html` 和 `cactus-sand-shader.html` 是完整可跑的示例。

---

## 主要 demo 索引

| 路径 | 内容 |
|---|---|
| `examples/sdf/2d.html` | 2D 距离场可视化（蓝/红色带 + 等值线） |
| `examples/sdf/3d.html` | 3D raymarching 网格 |
| `examples/sdf/editor.html` | SDF 编辑器（参数滑条 + 实时图 + 代码输出） |
| `examples/sdf/cactus*.html` | BOB 仙人掌场景（剪影 / 笔触 / shader / 沙画 4 种渲染） |
| `examples/sdf/painted-scenes.html` | BOB 六场景笔触版 |
| `examples/sdf/scenes-sand.html` | 多场景沙画（含飞鸟） |
| `examples/ca/ca.html` | SDF + CA 机器人填充（静态） |
| `examples/ca/ca-animate.html` | scatter → assemble 装配动画 |

机器人 SDF 定义在 [`examples/ca/robot-shapes.js`](./examples/ca/robot-shapes.js)，被 `ca.js` 和 `ca-animate.js` 共享。

---

## License

MIT —— 见根目录 [LICENSE.md](../LICENSE.md)。
