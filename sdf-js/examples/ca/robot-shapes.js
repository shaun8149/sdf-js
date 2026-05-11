// =============================================================================
// 机器人 SDF 共享模块 —— ca.js (静态) 和 ca-animate.js (动画) 共同使用
// -----------------------------------------------------------------------------
// 只在这一个文件里调机器人。两个 demo 自动跟随。
// 想增加变体（比如重型机甲、瘦人型等）就再 export 一个常量即可。
// =============================================================================

import * as sdf from '../../src/index.js';

// =============================================================================
// ROBOT_CLASSIC ——【保留版本，请不要随意修改】
// -----------------------------------------------------------------------------
// 第一个真正"站住"的机器人。胸用 difference 挖出 U 形空腔、大腿嵌入其中。
// 9 个零件 union，1.2x 放大并下移 0.10 适配画布。
//
// 配套的 CA 参数（在 ca.html UI 的 default 里）:
//   gridDim         = 288
//   initiateChance  = 0.85
//   extensionChance = 0.75
//   solidness       = 0.56
//   verticalChance  = 0.50
//   roundness       = 0
//   colorMode       = 'group'
//   groupSize       = 0.82
//   hSymmetric      = true
//   vSymmetric      = false
//
// 任何新尝试请改 ROBOT 那个常量（在下面），不要碰这里。
// =============================================================================
export const ROBOT_CLASSIC = sdf.union(
  // 头（小环形）
  sdf.circle(0.12).difference(sdf.circle(0.03)).translate([0, -0.77]),
  // 脖子（细长）
  sdf.rectangle([0.06, 0.10]).translate([0, -0.61]),
  // 胸 = 大矩形 - 底部正方形（U 形）
  sdf.rectangle([0.50, 0.32]).translate([0, -0.38])
     .difference(sdf.rectangle([0.12, 0.12]).translate([0, -0.33])),
  // 大腿（顶端在胸 U 空洞内 y=-0.44, 底端 y=-0.04）
  sdf.rectangle([0.08, 0.40]).translate([-0.055, -0.24]),
  sdf.rectangle([0.08, 0.40]).translate([ 0.055, -0.24]),
  // 小腿（贴大腿底，向外阶梯式变粗 = calf）
  sdf.rectangle([0.13, 0.36]).translate([-0.08, 0.14]),
  sdf.rectangle([0.13, 0.36]).translate([ 0.08, 0.14]),
  // 脚（与小腿 0.04 间隙，再向外阶梯一点）
  sdf.rectangle([0.16, 0.06]).translate([-0.10, 0.39]),
  sdf.rectangle([0.16, 0.06]).translate([ 0.10, 0.39]),
)
.scale(1.2).translate([0, 0.10]);

export const ROBOT_CLASSIC_CODE = `union(
  circle(0.12).difference(circle(0.03)).translate([0, -0.77]),  // head ring
  rectangle([0.06, 0.10]).translate([0, -0.61]),                // neck (thin)
  rectangle([0.50, 0.32]).translate([0, -0.38])                 // chest
    .difference(rectangle([0.12, 0.12]).translate([0, -0.33])), //   minus bottom square = U
  rectangle([0.08, 0.40]).translate([±0.055, -0.24]),           // thighs (in chest cutout)
  rectangle([0.13, 0.36]).translate([±0.08,  0.14]),            // shins (step outward)
  rectangle([0.16, 0.06]).translate([±0.10,  0.39]),            // feet
).scale(1.2).translate([0, 0.10])`;

// =============================================================================
// ROBOT —— 当前正在调的版本
// -----------------------------------------------------------------------------
// 与 CLASSIC 的差异：
//   - 小腿 h: 0.36 → 0.42（+17%, 拉长）
//   - 小腿 y: 0.14 → 0.17（中心下移以匹配新高）
//   - shin↔foot 间隙: 0.04 → 0.02（更紧贴）
//   - 脚 w: 0.16 → 0.20（+25%）
//   - 脚 h: 0.06 → 0.08（+33%）
//   - 脚 x: ±0.10 → ±0.115（外移以保持左右脚之间间隙 ≥0.02）
//   - 脚 y: 0.39 → 0.44（适配新 shin 底部 + 0.02 gap + 半脚高）
// =============================================================================
export const ROBOT = sdf.union(
  sdf.circle(0.12).difference(sdf.circle(0.03)).translate([0, -0.84]),
  sdf.rectangle([0.10, 0.06]).translate([0, -0.67]),
  sdf.rectangle([0.50, 0.50]).translate([0, -0.38])
     .difference(sdf.rectangle([0.2, 0.2]).translate([0, -0.25])),
  sdf.rectangle([0.08, 0.40]).translate([-0.07, -0.24]),
  sdf.rectangle([0.08, 0.40]).translate([ 0.07, -0.24]),
  // 小腿（拉长到 0.42）
  sdf.rectangle([0.13, 0.42]).translate([-0.1, 0.17]),
  sdf.rectangle([0.13, 0.42]).translate([ 0.1, 0.17]),
  // 脚（更大 0.20×0.08，间隙 0.02）
  sdf.rectangle([0.24, 0.08]).translate([-0.12, 0.44]),
  sdf.rectangle([0.24, 0.08]).translate([ 0.12, 0.44]),
)
.scale(1.2).translate([0, 0.10]);

export const ROBOT_CODE = `union(
  circle(0.12).difference(circle(0.03)).translate([0, -0.77]),  // head
  rectangle([0.06, 0.10]).translate([0, -0.61]),                // neck
  rectangle([0.50, 0.32]).translate([0, -0.38])                 // chest
    .difference(rectangle([0.12, 0.12]).translate([0, -0.33])), //   - U cutout
  rectangle([0.08, 0.40]).translate([±0.055, -0.24]),           // thighs
  rectangle([0.13, 0.42]).translate([±0.08,  0.17]),            // shins (longer)
  rectangle([0.20, 0.08]).translate([±0.115, 0.44]),            // feet (bigger)
).scale(1.2).translate([0, 0.10])`;

// 占位：未来可以加更多机器人变体
// export const ROBOT_TANK = sdf.union(...);
// export const ROBOT_HUMANOID = sdf.union(...);
