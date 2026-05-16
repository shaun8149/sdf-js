// =============================================================================
// time-expr —— 时间调制 scalar，给 SDF primitive args + transform args 用
// -----------------------------------------------------------------------------
// 让任意 number 参数都能用 `linearT(coef)` / `sinT(amp,freq,phase)` 替换 →
// compiler emit `u_time` 引用的 GLSL 表达式；CPU eval 路径 freeze 在 t=0。
//
// 用例：
//   sphere(sinT(0.075, 1/3, 0))                  // 半径 = 0.075·sin(t/3)
//   cylinder(sumT(0.4, sinT(0.075, 1/4)), 0.8)   // 半径 = 0.4 + 0.075·sin(t/4)
//   capsule([0,0,0], [linearT(0.5), 0, 0], 0.1)  // capsule b 端沿 X 飞
//   .translate([linearT(2.0), 0, 0])             // 整体沿 X 时间漂移
//   .rotate(linearT(0.5), [0,1,0])               // 绕 Y 慢转
//
// 数据形状（紧凑 plain-object，跟 SDF AST 同 idiom）：
//   { kind: 'time', form: 'linear', coef }
//   { kind: 'time', form: 'sin' | 'cos', amp, freq, phase }
//   { kind: 'time', form: 'sum', terms }      // 数 + time-expr 都可
//
// 嵌套表达式（mulT/sumT）保留代数结构 → 不展开成 AST tree（避免编译复杂度爆炸）
// =============================================================================

export const TIME_KIND = 'time';

export function isTimeExpr(x) {
  return x !== null && typeof x === 'object' && x.kind === TIME_KIND;
}

// ----------------------------------------------------------------------------
// 因子函数
// ----------------------------------------------------------------------------

/**
 * 线性时间：`coef * u_time`
 * @example
 *   linearT(0.5)  // bird 沿 X 0.5 单位/秒
 */
export function linearT(coef = 1.0) {
  return { kind: TIME_KIND, form: 'linear', coef };
}

/**
 * 正弦时间：`amp * sin(freq * u_time + phase)`
 * @param {number} amp   - 振幅
 * @param {number} freq  - 频率（rad/s，2π=每秒一周）
 * @param {number} phase - 相位偏移（rad）
 */
export function sinT(amp = 1.0, freq = 1.0, phase = 0.0) {
  return { kind: TIME_KIND, form: 'sin', amp, freq, phase };
}

/**
 * 余弦时间：`amp * cos(freq * u_time + phase)`
 */
export function cosT(amp = 1.0, freq = 1.0, phase = 0.0) {
  return { kind: TIME_KIND, form: 'cos', amp, freq, phase };
}

/**
 * 加和：`term1 + term2 + ...`。term 可以是 number 或 time-expr。
 * @example
 *   sumT(0.4, sinT(0.075, 1/3))    // 半径 0.4 + 0.075·sin(t/3)
 *   sumT(0.5, linearT(0.1))        // 0.5 + 0.1·t（线性增长）
 */
export function sumT(...terms) {
  return { kind: TIME_KIND, form: 'sum', terms };
}

/**
 * 标量乘：`k * expr`。number*number = number；其它 → 新 time-expr。
 * 用于 compiler emit 内部（如 box dims/2）—— 把代数 distribute 进 time-expr。
 */
export function mulT(expr, k) {
  if (typeof expr === 'number') return expr * k;
  if (!isTimeExpr(expr)) throw new Error(`mulT: unexpected ${typeof expr}`);
  if (expr.form === 'linear') return { ...expr, coef: expr.coef * k };
  if (expr.form === 'sin' || expr.form === 'cos') return { ...expr, amp: expr.amp * k };
  if (expr.form === 'sum')    return { ...expr, terms: expr.terms.map(t => mulT(t, k)) };
  throw new Error(`mulT: unknown form '${expr.form}'`);
}

// ----------------------------------------------------------------------------
// CPU 评估（freeze 在指定 t；默认 t=0 给 SDF closure 初始化用）
// ----------------------------------------------------------------------------

export function evalT(expr, t = 0) {
  if (typeof expr === 'number') return expr;
  if (!isTimeExpr(expr)) throw new Error(`evalT: expected number or time-expr, got ${typeof expr}`);
  if (expr.form === 'linear') return expr.coef * t;
  if (expr.form === 'sin')    return expr.amp * Math.sin(expr.freq * t + expr.phase);
  if (expr.form === 'cos')    return expr.amp * Math.cos(expr.freq * t + expr.phase);
  if (expr.form === 'sum')    return expr.terms.reduce((acc, term) => acc + evalT(term, t), 0);
  throw new Error(`evalT: unknown form '${expr.form}'`);
}

// ----------------------------------------------------------------------------
// 通用 freeze helpers（d3.js primitive constructor 用，把 args 烤成 number 给
// CPU SDF closure；AST 那侧仍保留原始 time-expr 供 compiler 用）
// ----------------------------------------------------------------------------

export function numLit(x, t = 0) {
  return isTimeExpr(x) ? evalT(x, t) : x;
}

export function vecLit(v, t = 0) {
  if (!Array.isArray(v)) return numLit(v, t);
  return v.map(x => numLit(x, t));
}
