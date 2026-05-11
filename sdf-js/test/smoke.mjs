// 轻量冒烟测试：sphere/box 距离值 + 链式 + 布尔 + 变换
import {
  sphere, box, plane,
  union, intersection, difference,
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

console.log('SDF3 callable:');
const s = sphere(1);
check('sphere(1) at origin = -1', s([0,0,0]), -1);
check('sphere(1) at (1,0,0) = 0', s([1,0,0]), 0);
check('sphere(1) at (2,0,0) = 1', s([2,0,0]), 1);

console.log('\nbox SDF (size=2, half-extent 1):');
const b = box(2);
check('box(2) at origin = -1', b([0,0,0]), -1);
check('box(2) at (1,0,0) = 0', b([1,0,0]), 0);
check('box(2) at (2,0,0) = 1', b([2,0,0]), 1);
check('box(2) at (2,2,2) = sqrt(3)', b([2,2,2]), Math.sqrt(3));

console.log('\nchainable transforms:');
const t = sphere(1).translate([3,0,0]);
check('sphere translated to (3,0,0): at (3,0,0) = -1', t([3,0,0]), -1);
check('sphere translated to (3,0,0): at (4,0,0) = 0', t([4,0,0]), 0);

console.log('\nbooleans:');
const u = sphere(1).union(box(1).translate([0.5,0,0]));
check('union: at (0,0,0) → most negative (sphere wins)', u([0,0,0]), -1);
checkBool('union: at (10,0,0) far away (>8)', u([10,0,0]) > 8);

const d = sphere(1).difference(sphere(0.5));
check('sphere − inner_sphere at origin = +0.5 (carved out)', d([0,0,0]), 0.5);

const i = sphere(1).intersection(box(1.5));
check('intersection at origin = -0.75 (box wins, closer to its face)', i([0,0,0]), -0.75);

console.log('\norient: Z-长方块旋向 X：');
// box size [0.5,0.5,4], half=[0.25,0.25,2]; Z 方向最长 → orient([1,0,0]) 后 X 方向最长
const tall = box([0.5, 0.5, 4]);
const oriented = tall.orient([1, 0, 0]);
// 原始：(0,0,1.5) 在 Z 内，距 X/Y 面 0.25 → -0.25
check('原始 box 在 (0,0,1.5) → -0.25 (X/Y 面最近)', tall([0,0,1.5]), -0.25, 1e-9);
// orient 后 (1.5,0,0) 等价于原始 (0,0,1.5) → 同样 -0.25
check('orient 后在 (1.5,0,0) → -0.25', oriented([1.5,0,0]), -0.25, 1e-6);
// orient 后 (0,0,1.5) 等价于原始 (-1.5,0,0)：在 X 半轴 0.25 之外 1.25
check('orient 后在 (0,0,1.5) → +1.25 (现在外面了)', oriented([0,0,1.5]), 1.25, 1e-6);

console.log('\nsmooth k blends:');
const hard = sphere(1).union(sphere(1).translate([1.5, 0, 0]));
const soft = sphere(1).union(sphere(1).translate([1.5, 0, 0]).k(0.3));
const seam = [0.75, 0.5, 0];
checkBool('soft distance < hard distance at seam midpoint',
          soft(seam) < hard(seam));
// 远离 seam 处两者应该几乎一致
checkBool('远离 seam 处 soft ≈ hard',
          Math.abs(soft([5,0,0]) - hard([5,0,0])) < 1e-6);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
