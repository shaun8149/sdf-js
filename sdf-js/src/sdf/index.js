// =============================================================================
// sdf/ —— 底层：SDF primitives + ops + 链式 API + shader 编译
// 这个层不知道 ca/ 或任何上层离散结构生成器存在
// =============================================================================

// Classes（让宿主代码能 instanceof 判断维度）
export { SDF2, SDF3 } from './core.js';

// 2D primitives
export {
  circle, ellipse, rectangle, rounded_rectangle, line, segment, arc, ring,
  equilateral_triangle, hexagon, polygon, triangle, trapezoid, flower,
  // Tier 2: Editorial 高频 + IQ 装饰
  heart, star, moon, cross, rounded_cross, pie, pie_slice, horseshoe, egg,
  // Tier 3: 几何精度场景
  oriented_box, isosceles_trapezoid, parallelogram, rhombus, quadratic_bezier,
  // Tier 4 (Wave 1A): legacy-python cleanup
  slab, rounded_x, vesica,
} from './d2.js';

// 2D → 3D 升维算子
export { extrude, extrude_to, revolve } from './d2.js';

// 3D primitives (Wave 1B 基础 + Wave 2 Platonic solids / 装饰 / wireframe)
export {
  sphere, box, plane, capsule,
  torus, cylinder, capped_cylinder, ellipsoid, rounded_box,
  cone, capped_cone,
  tetrahedron, octahedron, dodecahedron, icosahedron,
  pyramid, slab3, wireframe_box,
  tri_prism,
  waves,
} from './d3.js';

// 3D artistic ops (Wave 2C)
export { twist, bend } from './d3.js';

// Euler-angle rotation convenience (Three.js / Blender 风格)
export { rotateXYZ } from './d3.js';

// Time-modulated scalar helpers (animation foundation)
export * as time from './time.js';

// 3D 射线求交 / 球追踪工具
export {
  raymarch3, intersect_sphere, sdf3_normal,
} from './raymarch.js';

// 维度无关 ops（auto-dispatch by first arg dimension）
export {
  union, intersection, difference,
  negate, dilate, erode, shell,
  rep, blend, elongate,
} from './dn.js';

// 命名空间出口
export * as vec from './vec.js';
export * as vec2 from './vec2.js';
export * as d2 from './d2.js';
export * as d3 from './d3.js';
