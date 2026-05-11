# sdf-main

链式 JS SDF 库 + 基于 SDF 的离散结构生成器。底层移植自 [fogleman/sdf](https://github.com/fogleman/sdf)（Python），上层是新增的扩展。

## 仓库结构

```
sdf-main/
├── sdf-js/          ← 主线：JS 移植 + 扩展
└── legacy-python/   ← 归档：fogleman 原版，算法参考用，不再开发
```

## sdf-js — 主线

两层解耦设计，每层有独立的入口（也可通过 `src/index.js` 聚合 import）：

- **`src/sdf/`** — 形状层。Primitives（`circle` / `rectangle` / `hexagon` / `sphere` / `box` / …）+ booleans + transforms + GLSL 编译。Chainable API：`circle(1).translate([1, 0]).scale(0.5)`。
- **`src/ca/`** — 生成器层。基于 SDF 的元胞自动机（[kjetil golid ApparatusGenerator](https://generated.space/sketch/apparatus/) 端口），把 SDF 当作 `isInside(x, y)` 谓词消费 —— 任何形状都能喂进来输出同款拼合纹理。

`ca/` 不 import `sdf/`。这是 form × generator 的纯函数式解耦：未来的 `voronoi/`、`lsystem/`、`reaction-diffusion/` 会与 `ca/` 平铺，并行消费 `sdf/`，互相不感知。

## 跑 demo

```bash
cd sdf-js
npm run serve              # = python3 -m http.server 8000
open http://localhost:8000/examples/
```

入口页 `examples/index.html` 列出所有 demo —— 2D 距离场可视化、3D raymarching、SDF 编辑器、Shader 版渲染、CA 机器人填充、装配动画……

## API 速写

```js
import { circle, rectangle, union } from './sdf-js/src/index.js';
import * as ca from './sdf-js/src/ca/index.js';

const robot = union(
  circle(0.12).translate([0, -0.8]),
  rectangle([0.5, 0.5]).translate([0, -0.3]),
  // ...
);

// 同一个 SDF 既能直接渲染剪影、又能作为 CA 的 isInside 谓词
const grid = ca.caGrid(ca.fromSdf2(robot, 288), 288, {
  initiateChance: 0.85,
  hSymmetric: true,
});
```

更详细见 [sdf-js/src/index.js](./sdf-js/src/index.js) 顶部注释。

## legacy-python

`fogleman/sdf` 原版 Python 实现。3D mesh marching 部分 JS 端尚未移植，保留作为算法参考。不再维护。

## License

MIT — 见 [LICENSE.md](./LICENSE.md)。原始版权 © Michael Fogleman；JS 移植与扩展 © 2024–。
