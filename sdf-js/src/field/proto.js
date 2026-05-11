// =============================================================================
// Proto field —— 球极投影 + 旋转对称的振荡场
// -----------------------------------------------------------------------------
// 数学：
//   α(x, y, r) = acos(2 r x / (x² + y² + r²))
//     —— 把 (x, y) 经球极投影到半径 r 的球面上，取角度
//   opacity(x, y) = (sin(α · freq) + 1) / 2    （phase=0 用 sin，否则用 cos）
//
// 多重对称：
//   把 (x, y) 旋转 N 次，每次 π/N 角度，对每个旋转点求 opacity，平均。
//   N=5 → 五重花瓣对称；N=3 → 三角；N=8 → 八角放射。
//
// 视觉特征：同心圆环 + 双曲线条纹 + N 重旋转对称。
// 跟 Perlin noise 是完全不同的家族：proto 是 **解析的、全局的、对称的**，
// noise 是 **采样的、局部的、各向同性的**。两者可以加在一起做混合场。
//
// 用例：Harvey Rayner 的 plotter 作品、Alice 的 tile 渲染。
// =============================================================================

// 2D 旋转：把 (x, y) 绕原点旋转 angle 弧度（保持 Alice 原作的轴向约定：
//   nx = cos·x + sin·y, ny = cos·y - sin·x，等价于绕 z 轴 -angle 旋转）
function rotateAbout(x, y, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * x + s * y, c * y - s * x];
}

/**
 * 单点的 raw alpha（不做旋转对称、不做调制）
 * @returns alpha ∈ [0, π]
 */
export function calculateAlpha(x, y, r) {
  return Math.acos(2 * r * x / (x * x + y * y + r * r));
}

/**
 * Proto opacity 场。返回一个 (x, y) → [0, 1] 的函数。
 *
 * @param {object} opts
 * @param {number} [opts.r=150]       球极投影半径
 * @param {number} [opts.freq=4]      振荡频率（每 α 单位多少周期）
 * @param {number} [opts.phase=1]     0 = sin, !=0 = cos
 * @param {number} [opts.domains=5]   多少重旋转对称（>=1）
 */
export function protoOpacity({ r = 150, freq = 4, phase = 1, domains = 5 } = {}) {
  const step = Math.PI / domains;
  const trig = phase === 0 ? Math.sin : Math.cos;

  return (x, y) => {
    let sum = 0;
    for (let i = 0; i < domains; i++) {
      const a = step * i;
      const [xr, yr] = a === 0 ? [x, y] : rotateAbout(x, y, a);
      const alpha = Math.acos(2 * r * xr / (xr * xr + yr * yr + r * r));
      sum += (trig(alpha * freq) + 1) / 2;
    }
    return sum / domains;
  };
}

/**
 * Proto alpha 场（不调制，直接返回 α 的对称平均）。
 * 用于跟 noise 等其他角度场合成 —— 比如 field.blend(protoAlpha, noiseField, 0.5)。
 * @returns (x, y) => α ∈ [0, π]
 */
export function protoAlpha({ r = 150, domains = 5 } = {}) {
  const step = Math.PI / domains;
  return (x, y) => {
    let sum = 0;
    for (let i = 0; i < domains; i++) {
      const a = step * i;
      const [xr, yr] = a === 0 ? [x, y] : rotateAbout(x, y, a);
      sum += Math.acos(2 * r * xr / (xr * xr + yr * yr + r * r));
    }
    return sum / domains;
  };
}
