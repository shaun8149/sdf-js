// =============================================================================
// raymarched —— 3D SDF 渲染（orthographic + sphere-tracing + Lambert shading）
// -----------------------------------------------------------------------------
// 渲染含 SDF3 的 layers（典型来自 sdf2d.extrude(h) 或 sdf2d.revolve(offset)）。
// 接口与 silhouette 一致：raymarched(ctx, layers, options)。
//
// Camera：orthographic（无透视），默认从 +Z 看向 -Z（看 XY 平面），
// 通过 yaw（绕 Y）+ pitch（绕 X）旋转。
//   - 2D 形状在 XY 平面，extrude 沿 Z 拉厚度 → 视觉上是"出屏方向"的厚度
//   - revolve 绕 Y 轴 → 视觉上"立着的旋转体"，profile 的 y 是 height
//
// Lighting：一个方向光 + ambient。每个 SDF 层的颜色按 Lambert 强度调暗。
//
// 性能：典型 640×640 + 3 层 ≈ 1-3 秒（单线程同步 ray marching）。
// =============================================================================

import { raymarch3, sdf3_normal } from '../sdf/raymarch.js';
import * as v from '../sdf/vec.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function makeBgFn(bg, view) {
  if (typeof bg === 'function') return bg;
  if (Array.isArray(bg)) return () => bg;
  if (bg && bg.top && bg.bottom) {
    const { top, bottom } = bg;
    return (_wx, wy) => {
      const t = (wy + view) / (2 * view);
      return [
        bottom[0] + (top[0] - bottom[0]) * t,
        bottom[1] + (top[1] - bottom[1]) * t,
        bottom[2] + (top[2] - bottom[2]) * t,
      ];
    };
  }
  return () => [240, 240, 240];
}

/**
 * 3D SDF raymarched 渲染。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{sdf, color: [r,g,b]}>} layers - 数组顺序 = 底到顶。SDF 可以是
 *   SDF3（typical：extrude/revolve 结果）或 SDF2（自动当 z=0 平面处理，只显示
 *   横截面，不推荐 —— 通常需要先 .extrude(0.05) 转 3D）。
 * @param {object}  [options]
 * @param {number}  [options.view=1.2]
 * @param {number}  [options.yaw=0.5]        - 绕 Y 轴旋转 ~28°（俯视右偏）
 * @param {number}  [options.pitch=0.35]     - 绕 X 轴俯仰 ~20°（向下看一点）
 * @param {number}  [options.cameraDist=4]   - 正交相机起点距离
 * @param {[number,number,number]} [options.lightDir=[-0.5, 1, 0.5]] - 方向光（会归一化）
 * @param {number}  [options.ambient=0.3]    - ambient term (0=纯 Lambert / 1=平涂)
 * @param {*}       [options.background]
 * @param {number}  [options.maxSteps=80]    - raymarch step 数
 * @param {number}  [options.eps=0.0008]     - 命中阈值
 */
export function raymarched(ctx, layers, options = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const view = options.view ?? 1.2;
  const yaw = options.yaw ?? 0.5;
  const pitch = options.pitch ?? 0.35;
  const cameraDist = options.cameraDist ?? 4;
  const lightDir = v.normalize(options.lightDir ?? [-0.5, 1, 0.5]);
  const ambient = options.ambient ?? 0.3;
  const maxSteps = options.maxSteps ?? 80;
  const eps = options.eps ?? 0.0008;
  const bgFn = makeBgFn(options.background ?? [240, 240, 240], view);

  // 旋转矩阵：把 camera-space 点旋转到 scene-space（应用相机的"逆旋转"到点）
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const inverseRotate = (p) => {
    // 逆 yaw（绕 Y）
    let x = p[0] * cy - p[2] * sy;
    let z = p[0] * sy + p[2] * cy;
    let y = p[1];
    // 逆 pitch（绕 X）
    const ny = y * cp - z * sp;
    const nz = y * sp + z * cp;
    return [x, ny, nz];
  };

  // SDF 统一 callable：layer.sdf 可能是 SDF2 或 SDF3，统一用 (p) => distance 调
  const callSdf = (sdf, p) => sdf(p);  // SDF instances 是 callable

  // 场景 union SDF（camera-space 输入 → 内部 inverseRotate 到 scene-space）
  const unionSdf = (p) => {
    const ps = inverseRotate(p);
    let m = Infinity;
    for (const { sdf } of layers) {
      const d = callSdf(sdf, ps);
      if (d < m) m = d;
    }
    return m;
  };

  // 命中点找最近层 index
  function findLayer(p_scene) {
    let bestD = Infinity, bestIdx = 0;
    for (let i = 0; i < layers.length; i++) {
      const d = Math.abs(callSdf(layers[i].sdf, p_scene));
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    return bestIdx;
  }

  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wx = (x / W) * 2 * view - view;
      const wy = -((y / H) * 2 * view - view);

      // 正交相机：从 +Z 远处看向 -Z，每个像素一根平行光线
      const ro = [wx, wy, cameraDist];
      const rd = [0, 0, -1];

      const t = raymarch3(ro, rd, unionSdf, maxSteps, cameraDist * 3, eps);

      let col;
      if (t < 0) {
        col = bgFn(wx, wy);
      } else {
        const pCam = [wx, wy, cameraDist - t];
        const pScene = inverseRotate(pCam);

        const layerIdx = findLayer(pScene);
        const layerColor = layers[layerIdx].color;

        // 法向量在 camera-space（unionSdf 已经包含 inverseRotate）
        const nCam = sdf3_normal(unionSdf, pCam);
        const lambert = Math.max(0, v.dot(nCam, lightDir));
        const intensity = ambient + (1 - ambient) * lambert;
        col = [
          clamp(layerColor[0] * intensity, 0, 255),
          clamp(layerColor[1] * intensity, 0, 255),
          clamp(layerColor[2] * intensity, 0, 255),
        ];
      }

      const i = (y * W + x) * 4;
      data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
