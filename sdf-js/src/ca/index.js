// =============================================================================
// ca/ —— 上层：基于 SDF 的元胞自动机离散结构生成器
//
// 本层不 import sdf/ —— 它通过 isInside(x, y, fuzz) 谓词接收 form，
// 实现"form 与 generator"的纯函数式解耦：任何能给出 inside 判定的
// 形状（SDF 实例、bitmap、自定义函数）都可以喂进来。
//
// 与 sdf/ 的桥接 fromSdf2() 也在这层，因为它只依赖 SDF 的公开 .call(x,y)
// 接口，不依赖任何 sdf/ 内部细节。
// =============================================================================

export {
  caGrid, caRects, caShuffle,
  caDraw, caDrawRects, caDrawRectsAt,
  fromSdf2,
} from './ca.js';
