// =============================================================================
// 公共导出（聚合入口）
// -----------------------------------------------------------------------------
// 用法 1: 直接 import 顶层名字（primitives + 维度无关 ops）
//   import { circle, sphere, union, difference } from 'sdf-js';
//
// 用法 2: 链式调用（translate / scale / rotate 等只暴露为方法）
//   circle(1).translate([1, 2]).rotate(Math.PI / 4)
//   sphere(1).orient([0, 1, 0])
//
// 用法 3: 命名空间（避免和宿主代码撞名时用）
//   import { d2, d3, vec, vec2, ca } from 'sdf-js';
//   d2.circle(1).translate([1, 2])
//   ca.caGrid(...)
//
// 分层（参见 src/sdf/ 和 src/ca/）：
//   sdf/  —— 底层 form：primitives + ops + 链式 API + shader
//   ca/   —— 上层 generator：基于 SDF 的元胞自动机
//   未来 voronoi/ / lsystem/ / ... 都会平铺在 ca/ 同层，并行消费 sdf/
//
// 也可以按需深 import 单层：
//   import { circle } from 'sdf-js/src/sdf/index.js';
//   import { caGrid } from 'sdf-js/src/ca/index.js';
// =============================================================================

// sdf/ 整层 re-export（包括 vec / vec2 / d2 / d3 命名空间）
export * from './sdf/index.js';

// ca/ 通过命名空间暴露（避免名字污染顶层）
export * as ca from './ca/index.js';

// render/ —— SDF → pixels 渲染层（与 ca/ 同层平铺）
export * as render from './render/index.js';

// palette/ —— 调色板与色彩生成（Tyler / BOB pigments / generative 三套）
export * as palette from './palette/index.js';

// field/ —— 标量/向量场代数（noise / radial / 组合算子）
export * as field from './field/index.js';

// streamline/ —— field 上的流线追踪（traceThrough / densePack）
export * as streamline from './streamline/index.js';

// math/ —— 通用数学工具（easing 等）
export * as math from './math/index.js';
