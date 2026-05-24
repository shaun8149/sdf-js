// =============================================================================
// camera-sequence —— Atlas 时间轴 (Sprint 2 / 2026-05-24)
// -----------------------------------------------------------------------------
// SceneData.cameraSequence 给一个场景定义一段多 shot 的电影机位编排：
//
//   cameraSequence: {
//     loop: true | false,
//     shots: [
//       {
//         duration: 4.0,         // 秒
//         target: [x, y, z],     // 镜头看向的世界坐标
//         pos:    [x, y, z],     // 镜头位置
//         fov:    25,            // 视角 (degrees)
//         aperture?: 0.5,        // DoF
//         focalDistance?: ...,   // 默认 = length(pos - target)
//         ease?: 'smooth'|'linear',  // 段内插值；shot 内 mix(start, end, smoothstep|t)
//         shake?: 0.5,           // 0..1 camera-shake amplitude
//         transition?: 'cut'|'blend',  // 跟前一个 shot 的过渡；默认 cut
//       },
//       ...
//     ]
//   }
//
// 模型：每个 shot 是「这段时间内镜头应该呆在哪 / 看向哪」的稳定位置。shot 内
// 的 mix(prevShot.endState, currShot.endState, smoothstep) 是可选 ease。MttGz4
// Sequence_Init / Sequence_Next / fSmoothBlend 模式 1:1 移植。
//
// transition: 'cut' = 段间硬切（不与前段插值）；'blend' = 与前一段做 dolly。
// =============================================================================

const TWO_PI = Math.PI * 2;

function lerp(a, b, t) { return a + (b - a) * t; }
function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Hash-noise for camera shake. Tiny + deterministic.
 * Returns [-1, 1] for shake offset.
 */
function shakeNoise(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Compute total sequence duration. Returns 0 for empty sequences.
 * Cached on the seq object so repeat calls are O(1).
 */
export function totalDuration(seq) {
  if (!seq || !Array.isArray(seq.shots) || seq.shots.length === 0) return 0;
  let total = 0;
  for (const shot of seq.shots) total += Number(shot.duration) || 0;
  return total;
}

/**
 * Evaluate camera state at time tSec.
 *
 * @param {Object} seq - cameraSequence object
 * @param {number} tSec - elapsed seconds since sequence start
 * @returns {{
 *   pos: [number, number, number],
 *   target: [number, number, number],
 *   fov: number,
 *   aperture: number,
 *   focalDistance: number,
 *   shotIndex: number,
 *   shotBlend: number,
 * } | null}
 *
 * 返回 null 表示 seq 无效（应该 fallback 到 static camera）。
 */
export function evaluateCameraSequence(seq, tSec) {
  if (!seq || !Array.isArray(seq.shots) || seq.shots.length === 0) return null;
  const shots = seq.shots;
  const total = totalDuration(seq);
  if (total <= 0) return null;

  let t = Math.max(0, tSec);
  if (seq.loop) {
    t = t - Math.floor(t / total) * total;
  } else if (t >= total) {
    // 非 loop 结束后停在最后一帧
    const last = shots[shots.length - 1];
    return {
      pos:    [...(last.pos    || [0, 0, 0])],
      target: [...(last.target || [0, 0, 0])],
      fov:    Number(last.fov ?? 25),
      aperture: Number(last.aperture ?? 0),
      focalDistance: Number(last.focalDistance ?? distance(last.pos, last.target)),
      shotIndex: shots.length - 1,
      shotBlend: 1.0,
    };
  }

  // 找当前 shot
  let acc = 0;
  let idx = 0;
  for (; idx < shots.length; idx++) {
    const d = Number(shots[idx].duration) || 0;
    if (t < acc + d) break;
    acc += d;
  }
  if (idx >= shots.length) idx = shots.length - 1;

  const shot = shots[idx];
  const shotDur = Number(shot.duration) || 1;
  const shotT = (t - acc) / shotDur;
  const easeMode = shot.ease || 'smooth';
  const blend = easeMode === 'linear' ? shotT : smoothstep(shotT);

  // Resolve state at start + end of this shot.
  //  - Default: shot is a fixed pose; start state = end state (no mid-shot move).
  //  - With transition='blend' AND prev shot exists: start = prev shot end, end = this shot end.
  //  - With transition='cut' (default): start = end = this shot end → hard cut + freeze.
  const endState = {
    pos: shot.pos || [0, 0, 0],
    target: shot.target || [0, 0, 0],
    fov: Number(shot.fov ?? 25),
    aperture: Number(shot.aperture ?? 0),
    focalDistance: Number(shot.focalDistance ?? distance(shot.pos, shot.target)),
  };
  let startState = endState;
  const transition = shot.transition || 'cut';
  if (transition === 'blend' && idx > 0) {
    const prev = shots[idx - 1];
    startState = {
      pos: prev.pos || [0, 0, 0],
      target: prev.target || [0, 0, 0],
      fov: Number(prev.fov ?? 25),
      aperture: Number(prev.aperture ?? 0),
      focalDistance: Number(prev.focalDistance ?? distance(prev.pos, prev.target)),
    };
  }

  const out = {
    pos:    lerp3(startState.pos,    endState.pos,    blend),
    target: lerp3(startState.target, endState.target, blend),
    fov:           lerp(startState.fov,           endState.fov,           blend),
    aperture:      lerp(startState.aperture,      endState.aperture,      blend),
    focalDistance: lerp(startState.focalDistance, endState.focalDistance, blend),
    shotIndex: idx,
    shotBlend: blend,
  };

  // Camera shake — per-frame jitter on target.y + ±x/z. Scaled by shake field
  // and inverse of distance so shake feels constant regardless of camera dist.
  const shakeAmt = Number(shot.shake || 0);
  if (shakeAmt > 0) {
    const d = Math.max(1, distance(out.pos, out.target));
    const k = shakeAmt * 0.05 / d;
    out.target[0] += shakeNoise(tSec * 9.7  + 1.0) * k;
    out.target[1] += shakeNoise(tSec * 11.3 + 2.0) * k;
    out.target[2] += shakeNoise(tSec * 13.1 + 3.0) * k;
  }

  return out;
}

function distance(a, b) {
  if (!a || !b) return 5;
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Convert evaluateCameraSequence output into a (yaw, pitch, position) triple
 * that FLY 3D camState expects. FLY 3D doesn't use target directly — it uses
 * a yaw/pitch heading. Compute heading from (target - pos) vector.
 *
 * IMPORTANT: shot.fov in the JSON is in DEGREES (cinematic convention).
 * FLY 3D's `u_focal` uniform is a focal-length MULTIPLIER (default 1.5 ≈ 67°
 * full vertical FOV). The relationship is `focal = 1 / tan(fovDeg/2 * π/180)`
 * because FLY 3D's ray formula is `rd = normalize(uv * R + uv.y * U + focal * F)`
 * with uv.y ∈ [-1, 1]. We convert here so the JSON schema stays cinematic-
 * friendly (LLM emits "fov: 35" not "focal: 3.17"); the renderer downstream
 * sees the right number.
 */
function fovDegreesToFlyFocal(fovDeg) {
  const halfRad = (fovDeg * Math.PI / 180) * 0.5;
  // Clamp to a sane range; tan(0) → ∞, tan(π/2) → 0
  const t = Math.max(0.02, Math.min(2.0, Math.tan(halfRad)));
  return 1.0 / t;
}

export function sequenceStateToCamState(state) {
  if (!state) return null;
  const dx = state.target[0] - state.pos[0];
  const dy = state.target[1] - state.pos[1];
  const dz = state.target[2] - state.pos[2];
  const horiz = Math.sqrt(dx * dx + dz * dz);
  // Note: FLY 3D's computeFwd uses [sy*cp, -sp, cy*cp] with pitch as inverted
  // Y component. To match: atan2(dx, dz) for yaw (camera forward in XZ),
  // and -atan2(dy, horiz) for pitch (pitch up = positive y component → pitch -).
  // Convention from src/render/flyLambert.js computeFwd().
  const yaw = Math.atan2(dx, dz);
  const pitch = -Math.atan2(dy, horiz);
  return {
    position: [...state.pos],
    yaw,
    pitch,
    fov: fovDegreesToFlyFocal(state.fov),  // converted to FLY 3D focal multiplier
    aperture: state.aperture,
    focalDistance: state.focalDistance,
  };
}
