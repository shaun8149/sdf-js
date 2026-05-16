// =============================================================================
// autoscope-primitives —— Erik Swahn Autoscope buffer.frag 的自定义 primitive 翻译
// -----------------------------------------------------------------------------
// 把 Autoscope 的 ~20 个 GLSL primitive 翻译成 sdf-js JS factory，compose 现有
// d3.js + dn.js primitives。Compiler 自动 emit GLSL。
//
// 坐标约定（沿用 Autoscope）：
//   - ground at y = 0（不是 BOB shader 的 y = -1；scene 生成器最终统一 shift）
//   - building 等 boxE 类 primitive 默认底面贴 y=0
//   - prism / tri_prism 轴沿 +Z
//
// 动画（compiler v0.5 支持）：
//   - houseP/C/S 等用 sinT 给 boxDims 加缓慢呼吸 (Autoscope idiom: dims += .15*sin(t/f))
//   - arch 半径用 sinT 脉动
//   - bird1-4 用 rep + linearT 实现飞过画面
//   - opts.breathe = false / opts.pulse = false 可关动画（debug 静态形状）
//
// 算术统一用 add() / mul() helpers（支持 number 和 time-expr 混合）
// =============================================================================

import {
  sphere, box, cylinder, capped_cylinder, capped_cone, cone, torus,
  ellipsoid, pyramid, tri_prism, waves, rounded_box,
} from '../../src/sdf/d3.js';
import { union, intersection, difference } from '../../src/sdf/dn.js';
import { linearT, sinT, sumT, mulT, evalT, isTimeExpr } from '../../src/sdf/time.js';

const PI = Math.PI;

// =============================================================================
// helpers —— number / time-expr 混合算术
// =============================================================================

// 加：a + b。两个 number 直接相加；含 time-expr 走 sumT
function add(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  return sumT(a, b);
}

// 标量乘：time-expr × number 或 number × number。不支持 time × time（一般不用）
function mul(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a * b;
  if (typeof a === 'number') return mulT(b, a);
  if (typeof b === 'number') return mulT(a, b);
  throw new Error('mul: time-expr × time-expr 不支持');
}

const half = (x) => mul(x, 0.5);

// freeze 一个值到 t=0（取静态值），用于需要 number 算术的场景（如 Math.min）
function freeze(x) {
  return isTimeExpr(x) ? evalT(x, 0) : x;
}

// Autoscope idiom: dims += amp * sin(u_time/period) — 给所有 dims 加 breathing
function breatheDims(dims, amp, period) {
  if (!Array.isArray(dims)) dims = [dims, dims, dims];
  const b = sinT(amp, 1 / period, 0);
  return dims.map((d) => add(d, b));
}

// =============================================================================
// 建筑物 (buildings)
// =============================================================================

/**
 * boxE: 底面贴地的 box（"E" = on Earth）。Autoscope 最常用建筑 primitive。
 * @param {[x,y,z]} loc  - 底面中心位置（y=0 即贴 ground）
 * @param {[w,h,d]} dims - 完整尺寸 (W × H × D)
 */
export function boxE(loc, dims) {
  const [w, h, d] = dims;
  return box([w, h, d]).translate([loc[0], add(loc[1], half(h)), loc[2]]);
}

/**
 * cylinderE: 底面贴地的圆柱。
 */
export function cylinderE(loc, height, radius) {
  return cylinder(radius, height).translate([loc[0], add(loc[1], half(height)), loc[2]]);
}

/**
 * houseP: 金字塔顶房子（pyramid + box）。
 *   dims: [w, h, d] box body 尺寸；roofHeight: pyramid 高度；angle: 绕 Y 旋转
 */
export function houseP(loc, dims, roofHeight, angle = 0, opts = {}) {
  const { breathe = true } = opts;
  const [w, h, d] = breathe ? breatheDims(dims, 0.15, 4) : dims;
  // d3.pyramid(h) 是 1×1 底 × h 高，顶点向 +Y。scale 到 [w*.99, 1, d*.99]
  const roof = pyramid(roofHeight)
    .scale([mul(w, 0.99), 1, mul(d, 0.99)])
    .translate([0, h, 0]);
  const body = box([w, h, d]).translate([0, half(h), 0]);
  return union(roof, body).rotate(angle, [0, 1, 0]).translate(loc);
}

/**
 * houseC: 圆柱体 + 圆锥顶（仓库 / 谷仓）。
 *   dims: [width, height]（宽 = 直径）；roofHeight: 圆锥屋顶高
 */
export function houseC(loc, dims, roofHeight, opts = {}) {
  const { breathe = true } = opts;
  let [w, h] = dims;
  if (breathe) {
    const b = sinT(0.15, 1 / 5, 0);
    w = add(w, b);
    h = add(h, b);
  }
  const body = cylinderE([0, 0, 0], h, half(w));
  const roof = cone(roofHeight, half(w))
    .translate([0, add(h, half(roofHeight)), 0]);
  return union(body, roof).translate(loc);
}

/**
 * houseS: 三角顶房子（tri_prism 屋顶 + box）。prism 轴沿 z。
 */
export function houseS(loc, dims, angle = 0, opts = {}) {
  const { breathe = true } = opts;
  const [w, h, d] = breathe ? breatheDims(dims, 0.15, 6) : dims;
  // Autoscope: prism h.x = boxDims.x * (cos30/1.5), h.y = boxDims.z*.5
  const cos30 = Math.cos(PI / 6);
  const j = cos30 / 1.5;
  const roofHalfWidth = mul(w, j);
  const roofHalfDepth = half(d);
  const roofY = add(h, mul(w, j * 0.5));
  const body = box([w, h, d]).translate([0, half(h), 0]);
  const roof = tri_prism(roofHalfWidth, roofHalfDepth).translate([0, roofY, 0]);
  return union(body, roof).rotate(angle, [0, 1, 0]).translate(loc);
}

/**
 * arch: 拱门（box - 半圆+矩形开口）。半圆半径随时间脉动。
 */
export function arch(loc, dims, xyRot = 0, opts = {}) {
  const { pulse = true } = opts;
  const [w, h, d] = dims;
  const baseR = 0.375 * Math.min(freeze(w), freeze(h));
  const radius = pulse ? add(baseR, sinT(0.2, 0.5, 0)) : baseR;
  const block = box([w, h, d]).translate([0, half(h), 0]);
  const cutoutBox = box([mul(radius, 2), add(half(h), 0.1), add(d, 0.5)])
    .translate([0, mul(h, 0.25), 0]);
  const cutoutCyl = cylinder(radius, add(d, 1.0))
    .rotate(PI / 2, [1, 0, 0])
    .translate([0, half(h), 0]);
  return difference(block, union(cutoutBox, cutoutCyl))
    .rotate(xyRot, [0, 1, 0])
    .translate(loc);
}

/**
 * arch2: 方形门洞（无半圆）。
 */
export function arch2(loc, dims, xyRot = 0) {
  const [w, h, d] = dims;
  const radius = 0.375 * Math.min(freeze(w), freeze(h));
  const block = box([w, h, d]).translate([0, half(h), 0]);
  const cutout = box([radius * 2, add(half(h), 0.1), add(d, 0.5)])
    .translate([0, mul(h, 0.25), 0]);
  return difference(block, cutout)
    .rotate(xyRot, [0, 1, 0])
    .translate(loc);
}

/**
 * vault: 拱顶削减形（box ∪ 半圆柱）。Autoscope 用作 `-vault` 做空间挖洞。
 */
export function vault(loc, dims, xyRot = 0) {
  const [w, h, d] = dims;
  const radius = 0.375 * Math.min(freeze(w), freeze(h));
  const cutoutBox = box([radius * 2, half(h), d]).translate([0, mul(h, 0.25), 0]);
  const cutoutCyl = cylinder(radius, d)
    .rotate(PI / 2, [1, 0, 0])
    .translate([0, half(h), 0]);
  return union(cutoutBox, cutoutCyl)
    .rotate(xyRot, [0, 1, 0])
    .translate(loc);
}

/**
 * cutouts: 周期性墙面孔（用 rep 重复 box 减空，autoscope 装饰墙）。
 *   offsets: [tileX, tileY, depth] — tile 周期 + 单 cutout 深度
 *   w, h: 单 cutout 尺寸；rot1, rot2: 朝向旋转
 */
export function cutouts(loc, offsets, w, h, rot1 = 0, rot2 = 0) {
  const [ox, oy, oz] = offsets;
  // 两组 rep（X-Y 平面 + Z-Y 平面），intersect 让墙角才有孔
  const tile1 = box([w, h, oz]).rep([ox, oy, 0]);
  const tile2 = box([oz, h, w]).rep([0, oy, ox]);
  return intersection(tile1, tile2)
    .rotate(rot2, [1, 0, 0])
    .rotate(rot1, [0, 1, 0])
    .translate(loc);
}

// =============================================================================
// 自然 (trees)
// =============================================================================

/**
 * tree1: 圆柱树干 + 球形树冠。
 */
export function tree1(loc, height, opts = {}) {
  const { breathe = true } = opts;
  const trunkR = mul(height, 0.02);
  const crownR = breathe
    ? add(mul(height, 0.5), sinT(0.075, 1, 0))
    : mul(height, 0.5);
  const trunk = cylinder(trunkR, height).translate([0, half(height), 0]);
  const crown = sphere(crownR).translate([0, height, 0]);
  return union(trunk, crown).translate(loc);
}

/**
 * tree2: 圆柱树干 + 圆锥树冠（fir / pine）。
 */
export function tree2(loc, height, opts = {}) {
  const { breathe = true } = opts;
  const trunkR = mul(height, 0.015);
  const crownR = breathe
    ? add(mul(height, 0.15), sinT(0.04, 1 / 1.5, 0))
    : mul(height, 0.15);
  const trunk = cylinder(trunkR, height).translate([0, half(height), 0]);
  const crown = cone(height, crownR).translate([0, add(half(height), mul(height, 0.6)), 0]);
  return union(trunk, crown).translate(loc);
}

/**
 * tree3: 圆柱树干 + 方块树冠（几何风）。
 */
export function tree3(loc, height, angle = 0, opts = {}) {
  const { breathe = true } = opts;
  const trunkR = mul(height, 0.02);
  const w = breathe ? add(height, sinT(0.15, 1 / 1.25, 0)) : height;
  const trunk = cylinder(trunkR, height).translate([0, half(height), 0]);
  const crown = box([w, w, w]).rotate(angle, [0, 1, 0]).translate([0, height, 0]);
  return union(trunk, crown).translate(loc);
}

// =============================================================================
// 居民 (people / animals / birds)
// =============================================================================

function applyMovement(shape, loc, movement) {
  const mvX = movement[0] ? linearT(movement[0]) : 0;
  const mvY = movement[1] ? linearT(movement[1]) : 0;
  const mvZ = movement[2] ? linearT(movement[2]) : 0;
  return shape.translate([add(loc[0], mvX), add(loc[1], mvY), add(loc[2], mvZ)]);
}

/**
 * person1: 锥形身体 + 球形头。
 */
export function person1(loc, height, movement = [0, 0, 0]) {
  const head = mul(height, 0.15);
  const body = cone(height, 0.5).translate([0, half(height), 0]);
  const headSphere = sphere(head).translate([0, add(height, head), 0]);
  return applyMovement(union(body, headSphere), loc, movement);
}

/**
 * person2: 方块身体 + 球头。
 */
export function person2(loc, height, movement = [0, 0, 0]) {
  const head = mul(height, 0.15);
  const body = box([0.5, height, 0.5]).translate([0, half(height), 0]);
  const headSphere = sphere(head).translate([0, add(height, mul(head, 2)), 0]);
  return applyMovement(union(body, headSphere), loc, movement);
}

/**
 * person3: 圆柱身体 + 横向圆柱头。
 */
export function person3(loc, height, movement = [0, 0, 0]) {
  const head = mul(height, 0.15);
  const body = cylinder(0.25, height).translate([0, half(height), 0]);
  const headCyl = cylinder(0.2, head)
    .rotate(PI / 2, [1, 0, 0])
    .translate([0, add(height, mul(head, 2.5)), 0]);
  return applyMovement(union(body, headCyl), loc, movement);
}

/**
 * person4: 倒锥 + 球头（沙漏形）。
 */
export function person4(loc, height, movement = [0, 0, 0]) {
  const head = mul(height, 0.15);
  // 倒锥：rotate(PI, X) flip。然后 translate 让锥底在 y=height 顶在 y=0
  const body = cone(height, 0.3).rotate(PI, [1, 0, 0]).translate([0, half(height), 0]);
  const headSphere = sphere(head).translate([0, add(height, mul(head, 1.5)), 0]);
  return applyMovement(union(body, headSphere), loc, movement);
}

/**
 * animal1: 长方块身体 + 球头（牛/狗类）。
 */
export function animal1(loc, height, speed = 0, rotation = 0) {
  const head = mul(height, 0.25);
  const body = box([mul(height, 1.5), height, 0.25]).translate([0, half(height), 0]);
  const headSphere = sphere(head).translate([add(height, head), add(height, head), 0]);
  const shape = union(body, headSphere).rotate(rotation, [0, 1, 0]);
  const offset = speed ? linearT(-speed) : 0;
  return shape.translate([add(loc[0], offset), loc[1], loc[2]]);
}

/**
 * animal2: 横圆柱身体 + 球头（羊/猪类）。
 */
export function animal2(loc, height, speed = 0, rotation = 0) {
  const head = mul(height, 0.25);
  const body = cylinder(head, height)
    .rotate(PI / 2, [0, 0, 1])
    .translate([0, add(height, mul(head, -1)), 0]);
  const headSphere = sphere(head).translate([add(height, mul(head, 2)), add(height, head), 0]);
  const shape = union(body, headSphere).rotate(rotation, [0, 1, 0]);
  const offset = speed ? linearT(-speed) : 0;
  return shape.translate([add(loc[0], offset), loc[1], loc[2]]);
}

/**
 * bird1: 两段圆柱（机翼形）。rep + linearT 让它飞过画面。
 */
export function bird1(loc, len, rotation = 0, speed = 2) {
  const thickness = mul(len, 0.2);
  // 两段：水平 cylinder + 略斜 cylinder
  const cyl1 = cylinder(half(thickness), len).rotate(-PI / 2, [0, 0, 1]);
  const cyl2 = cylinder(half(thickness), mul(len, 1.25))
    .rotate(-PI / 2, [0, 0, 1])
    .rotate(PI / 2, [1, 0, 0])
    .translate([0, 0, mul(len, 0.33)]);
  return union(cyl1, cyl2)
    .rotate(rotation, [0, 1, 0])
    .translate([linearT(speed), 0, 0])
    .rep([60, 0, 0])
    .translate(loc);
}

/**
 * bird2: 单段圆柱 + Y 轴 bobbing。
 */
export function bird2(loc, len, rotation = 0, speed = 2) {
  const thickness = mul(len, 0.2);
  const bobY = sinT(0.5, speed * 0.25, 0);
  return cylinder(half(thickness), len)
    .rotate(-PI / 2, [0, 0, 1])
    .rotate(rotation, [0, 1, 0])
    .translate([linearT(speed), bobY, 0])
    .rep([60, 0, 0])
    .translate(loc);
}

/**
 * bird3: 球形（远处小鸟看起来像点）。
 */
export function bird3(loc, radius, rotation = 0, speed = 2) {
  return sphere(radius)
    .rotate(rotation, [0, 1, 0])
    .translate([linearT(speed), 0, 0])
    .rep([60, 0, 0])
    .translate(loc);
}

/**
 * bird4: 横向小盒子（鱼鸟剪影）+ bobbing。
 */
export function bird4(loc, radius, rotation = 0, speed = 2) {
  const r = freeze(radius);
  const bobY = sinT(0.5, speed * 0.25, 0);
  return box([r, r * 0.25, r * 0.25])
    .rotate(rotation, [0, 1, 0])
    .translate([linearT(speed), bobY, 0])
    .rep([60, 0, 0])
    .translate(loc);
}

// =============================================================================
// 特殊 (special)
// =============================================================================

/**
 * backdrop: 远处大墙（让 frontalLight 形成 silhouette 构图）。
 *   z = 墙位置（在 +Z 方向）
 */
export function backdrop(z) {
  return box([400, 400, 0.1]).translate([0, 0, z]);
}

/**
 * autoscope-style pyramid: 多了 dims [w,h,d] 控制底面尺寸 + Y 旋转
 */
export function autoscopePyramid(loc, dims, rotation = 0) {
  const [w, h, d] = dims;
  return pyramid(h).scale([w, 1, d])
    .rotate(rotation, [0, 1, 0])
    .translate(loc);
}

/**
 * autoscope-style cone: loc + radius + height（autoscope 的 cone 签名跟 d3.cone 不同）
 */
export function autoscopeCone(loc, radius, height) {
  return cone(height, radius).translate([loc[0], add(loc[1], half(height)), loc[2]]);
}

// re-export waves for autoscope scene 1 (sea)
export { waves };
