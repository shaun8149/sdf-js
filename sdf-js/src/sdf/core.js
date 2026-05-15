// =============================================================================
// SDF 核心：可调用类（2D / 3D 两种）+ 算子注册器
// -----------------------------------------------------------------------------
// 我们想要 Python 风格的 API：
//   - f(p)           → 取距离（像调函数）
//   - f.translate(o) → 链式（像调方法）
//
// JS 没有 __call__，但函数对象本身可以被 setPrototypeOf 改写原型链；
// 这样 inst() 当函数用，inst.method() 当对象用，两个能力同时具备。
//
// SDF2 和 SDF3 是两个独立的类（不是同一个加 dim 标记）：让 instanceof 区分
// 维度，便于 defineOpN 在调用时自动派发；也匹配 Python 的 d2.SDF2 / d3.SDF3
// 双类设计。两边的方法都通过 defineOp2 / defineOp3 / defineOpN 注册。
// =============================================================================

// 工厂：每次都生成一个全新的 callable 类，确保 SDF2 和 SDF3 的 prototype 互不污染
function makeSDFClass() {
  function SDF(f) {
    const inst = function (p) { return f(p); };
    Object.setPrototypeOf(inst, SDF.prototype);
    inst.f = f;
    inst._k = null;
    return inst;
  }
  SDF.prototype = Object.create(Function.prototype);
  SDF.prototype.constructor = SDF;
  SDF.prototype.k = function (k) { this._k = k; return this; };
  return SDF;
}

export const SDF2 = makeSDFClass();
export const SDF3 = makeSDFClass();

// 内部 helper：把 fn 注册成 TargetClass.prototype 上的方法
const _attach = (TargetClass, name, fn) => {
  TargetClass.prototype[name] = function (...args) {
    return TargetClass(fn(this, ...args));
  };
};

// 仅 2D：注册到 SDF2，标准导出顶层函数
export function defineOp2(name, fn) {
  _attach(SDF2, name, fn);
  return (...args) => SDF2(fn(...args));
}

// 仅 3D：注册到 SDF3，标准导出顶层函数
export function defineOp3(name, fn) {
  _attach(SDF3, name, fn);
  return (...args) => SDF3(fn(...args));
}

// 维度无关：注册到两边。顶层函数根据第一个参数的 instanceof 自动判维度。
// 给 dn.js 的 union/intersection/difference/dilate/erode/shell 用。
export function defineOpN(name, fn) {
  _attach(SDF2, name, fn);
  _attach(SDF3, name, fn);
  return (first, ...args) => {
    if (first instanceof SDF2) return SDF2(fn(first, ...args));
    if (first instanceof SDF3) return SDF3(fn(first, ...args));
    throw new Error(`${name}(): first argument must be an SDF2 or SDF3 instance`);
  };
}

// 2D → 3D 升维：源是 SDF2，结果是 SDF3。用于 extrude / revolve 等把
// 2D 形状变 3D 立体的算子。chainable 方法挂在 SDF2.prototype 上。
export function defineOp23(name, fn) {
  SDF2.prototype[name] = function (...args) {
    return SDF3(fn(this, ...args));
  };
  return (...args) => SDF3(fn(...args));
}
