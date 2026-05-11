// 2D 冒烟测试
import {
  circle, rectangle, rounded_rectangle, line,
  equilateral_triangle, hexagon, polygon, triangle,
  union, intersection, difference,
  SDF2, SDF3,
} from '../src/index.js';

let pass = 0, fail = 0;
function check(label, got, want, eps = 1e-9) {
  const ok = Math.abs(got - want) < eps;
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else    { fail++; console.log(`  ✗ ${label}: got ${got}, want ${want}`); }
}
function checkBool(label, cond) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else      { fail++; console.log(`  ✗ ${label}`); }
}

console.log('SDF2 callable:');
const c = circle(1);
check('circle(1) at origin = -1', c([0,0]), -1);
check('circle(1) at (1,0) = 0', c([1,0]), 0);
check('circle(1) at (3,0) = 2', c([3,0]), 2);
check('circle(1) at (3,4) = 4 (5-1)', c([3,4]), 4);

console.log('\nrectangle (size=2, 半边长 1):');
const r = rectangle(2);
check('rectangle(2) at origin = -1', r([0,0]), -1);
check('rectangle(2) at (1,0) = 0', r([1,0]), 0);
check('rectangle(2) at (2,0) = 1', r([2,0]), 1);
check('rectangle(2) at (2,2) = sqrt(2)', r([2,2]), Math.sqrt(2));

console.log('\nrectangle 用 a/b 角点:');
const r2 = rectangle(undefined, undefined, [-1, -2], [3, 4]);
// 中心 = (1,1)，size = (4,6)，半边 (2,3)
check('rectangle(a=(-1,-2),b=(3,4)) at center (1,1) = -2', r2([1,1]), -2);
check('在 a 角 (-1,-2) = 0', r2([-1,-2]), 0);

console.log('\nrounded_rectangle (size=2, radius=0.3):');
const rr = rounded_rectangle(2, 0.3);
check('在 (0.7, 0.7) (角圆心) = -0.3', rr([0.7, 0.7]), -0.3, 1e-12);
check('在 (1.0, 0.7) (角弧上) = 0', rr([1.0, 0.7]), 0, 1e-12);

console.log('\nrounded_rectangle 不对称半径 [0.4, 0, 0.4, 0]:');
// r0=0.4 (dx>0,dy>0), r1=0   (dx>0,dy<0)
// r2=0.4 (dx<0,dy>0), r3=0   (dx<0,dy<0)
// → Y-up 渲染下：右上+左上 圆角 0.4，右下+左下 锐角
const rr2 = rounded_rectangle(2, [0.4, 0, 0.4, 0]);
check('右上角圆心 (0.6, 0.6) → -0.4', rr2([0.6, 0.6]), -0.4, 1e-12);
check('左上角圆心 (-0.6, 0.6) → -0.4', rr2([-0.6, 0.6]), -0.4, 1e-12);
check('右下角顶点 (1, -1) → 0 (锐角，恰在边上)', rr2([1, -1]), 0, 1e-12);
check('左下角顶点 (-1, -1) → 0 (锐角)', rr2([-1, -1]), 0, 1e-12);

console.log('\n等边三角形:');
const tri = equilateral_triangle();
check('在原点 (内部) < 0', Math.sign(tri([0,0])), -1);
checkBool('在 (5,5) (外部) > 0', tri([5,5]) > 0);

console.log('\n六边形 r=1:');
const h = hexagon(1);
checkBool('在原点 (内部) < 0', h([0,0]) < 0);
checkBool('在 (10,0) (外部) > 0', h([10,0]) > 0);
// 六边形外接圆半径 r=1 → 顶点在距离 r*sqrt(3)/2... 实际 Python r 是中心到边距离
// 简单检查：(0.85, 0) 应该在内部、(0.95, 0) 应该接近边界
checkBool('在 (0.5, 0) 内部', h([0.5, 0]) < 0);

console.log('\npolygon (单位三角形):');
const t2 = triangle([-1,0], [1,0], [0,1]);
checkBool('重心 (0, 0.33) 内部', t2([0, 0.33]) < 0);
checkBool('外部 (5, 5) 正', t2([5, 5]) > 0);

console.log('\nline (水平线 y=0):');
const ln = line([0, 1], [0, 0]);
check('在 (0, 1) 法线方向上 → -1 (内)', ln([0, 1]), -1);
check('在 (0, -1) 反方向 → 1 (外)', ln([0, -1]), 1);
check('在 (5, 0) 线上 → 0', ln([5, 0]), 0);

console.log('\n2D booleans (SDF2 + SDF2 → SDF2):');
const moon = circle(0.5).difference(circle(0.55).translate([-0.15, 0]));
checkBool('moon 是 SDF2 实例', moon instanceof SDF2);
checkBool('moon 在 (0.4, 0.1) → 内部 (大圆内、小圆外的右上偏)',
          moon([0.4, 0.1]) < 0);
checkBool('moon 在 (-0.2, 0) → 外部 (大圆内、但被小圆挖空)',
          moon([-0.2, 0]) > 0);

console.log('\n2D 链式 transforms:');
const c2 = circle(1).translate([3, 0]).rotate(Math.PI / 2);
// 圆 r=1 平移到 (3,0)，再旋转 π/2 → 圆心到了 (0,3)
check('在新圆心 (0, 3) → -1', c2([0, 3]), -1, 1e-12);
check('在原圆心 (3, 0) → +2 (旋转后远离)', c2([3, 0]), Math.sqrt(9+9) - 1, 1e-12);

console.log('\nscale + rotate:');
const ell = circle(1).scale([2, 1]);  // 椭圆，X 方向半径 2、Y 方向 1
check('在 (2, 0) → 0 (椭圆边界)', ell([2, 0]), 0, 1e-12);
check('在 (0, 1) → 0 (椭圆边界)', ell([0, 1]), 0, 1e-12);
// 注意非均匀缩放是 inexact SDF, 内部值不一定准

console.log('\ncircular_array:');
// 8 个圆，绕原点等角分布；其中之一在 (1, 0) 半径 0.2
const ring = circle(0.2).translate([1, 0]).circular_array(8);
checkBool('在 (1, 0) → 内部 (该位置有一个圆)', ring([1, 0]) < 0);
const angle = 2 * Math.PI / 8;
const pt = [Math.cos(angle), Math.sin(angle)];
checkBool('在第 1 个圆心位置 → 内部', ring(pt) < 0);
checkBool('在中心 (0, 0) → 外部', ring([0, 0]) > 0);

console.log('\ndim-agnostic ops 在 2D 上工作:');
const dilated = circle(1).dilate(0.5);
check('circle(1).dilate(0.5) 在 (1.5, 0) → 0', dilated([1.5, 0]), 0);
const shelled = circle(1).shell(0.2);
check('circle(1).shell(0.2) 在 (1, 0) → -0.1 (壳内)', shelled([1, 0]), -0.1, 1e-12);
check('circle(1).shell(0.2) 在 (1.1, 0) → 0 (壳外边界)', shelled([1.1, 0]), 0, 1e-12);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
