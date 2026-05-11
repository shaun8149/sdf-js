// =============================================================================
// sdf/ —— 底层：SDF primitives + ops + 链式 API + shader 编译
// 这个层不知道 ca/ 或任何上层离散结构生成器存在
// =============================================================================

// Classes（让宿主代码能 instanceof 判断维度）
export { SDF2, SDF3 } from './core.js';

// 2D primitives
export {
  circle, rectangle, rounded_rectangle, line,
  equilateral_triangle, hexagon, polygon, triangle, trapezoid, flower,
} from './d2.js';

// 3D primitives
export {
  sphere, box, plane,
} from './d3.js';

// 维度无关 ops（auto-dispatch by first arg dimension）
export {
  union, intersection, difference,
  negate, dilate, erode, shell,
} from './dn.js';

// 命名空间出口
export * as vec from './vec.js';
export * as vec2 from './vec2.js';
export * as d2 from './d2.js';
export * as d3 from './d3.js';
