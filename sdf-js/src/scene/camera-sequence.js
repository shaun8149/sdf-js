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

function lerp(a, b, t) {
  return a + (b - a) * t;
}
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
 * @param {Object} [ctx] - resolution context:
 *   - subjectBaseTargets: { subjectId: [x,y,z] } — base positions for relativeTo resolution
 * @returns {Object | null}
 *
 * Sprint 4: returned object also carries `subjectOffsets` (from
 * evaluateSubjectMotion) + `sceneState` (merged from shot.sceneState) so
 * downstream renderer can apply subject motion + per-shot state without
 * re-evaluating.
 */
export function evaluateCameraSequence(seq, tSec, ctx) {
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
      pos: [...(last.pos || [0, 0, 0])],
      target: [...(last.target || [0, 0, 0])],
      fov: Number(last.fov ?? 25),
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

  // Sprint 4: Resolve subject motion BEFORE building start/end states so
  // relativeTo target resolution sees current frame's subject positions.
  const subjectOffsets = evaluateSubjectMotion(seq, t);
  const subjectBase = (ctx && ctx.subjectBaseTargets) || {};

  const resolveTarget = (rawTarget) =>
    resolveShotTarget(rawTarget || [0, 0, 0], subjectBase, subjectOffsets);
  // Sprint 5: pos also accepts {relativeTo, offset} — same resolver as target.
  const resolvePos = (rawPos) =>
    resolveShotTarget(rawPos || [0, 0, 0], subjectBase, subjectOffsets);

  const endPos = resolvePos(shot.pos);
  const endTarget = resolveTarget(shot.target);
  const endState = {
    pos: endPos,
    target: endTarget,
    fov: Number(shot.fov ?? 25),
    aperture: Number(shot.aperture ?? 0),
    focalDistance: Number(shot.focalDistance ?? distance(endPos, endTarget)),
  };
  let startState = endState;
  let startSceneState = shot.sceneState || {};
  const transition = shot.transition || 'cut';
  if (transition === 'blend' && idx > 0) {
    const prev = shots[idx - 1];
    const startPos = resolvePos(prev.pos);
    const startTarget = resolveTarget(prev.target);
    startState = {
      pos: startPos,
      target: startTarget,
      fov: Number(prev.fov ?? 25),
      aperture: Number(prev.aperture ?? 0),
      focalDistance: Number(prev.focalDistance ?? distance(startPos, startTarget)),
    };
    // Sprint 5: sceneState lerps too when blending. Without this, thrusterLevel
    // jumps abruptly from 0 → 1 at shot boundary (engine bursts on instead of
    // ramping up). With blend transition + sceneState lerp, the engine glow /
    // smoke / etc. ease in over the shot's duration.
    startSceneState = prev.sceneState || {};
  }

  // Sprint 5: lerp sceneState dict (union of keys from start + end, missing
  // values default to 0 so missing-in-start → ramp from 0 → end value).
  const endSceneState = shot.sceneState || {};
  const blendedSceneState = {};
  const allKeys = new Set([...Object.keys(startSceneState), ...Object.keys(endSceneState)]);
  for (const k of allKeys) {
    const a = typeof startSceneState[k] === 'number' ? startSceneState[k] : 0;
    const b = typeof endSceneState[k] === 'number' ? endSceneState[k] : 0;
    blendedSceneState[k] = lerp(a, b, blend);
  }

  const out = {
    pos: lerp3(startState.pos, endState.pos, blend),
    target: lerp3(startState.target, endState.target, blend),
    fov: lerp(startState.fov, endState.fov, blend),
    aperture: lerp(startState.aperture, endState.aperture, blend),
    focalDistance: lerp(startState.focalDistance, endState.focalDistance, blend),
    shotIndex: idx,
    shotBlend: blend,
    // Sprint 4 additions — caller uses these to position attached volumes,
    // override scene state, etc.
    subjectOffsets,
    // Sprint 5: blended sceneState (smooth ramp across shot transitions).
    sceneState: blendedSceneState,
    // Sprint 8: per-shot exposure ramp + renderer override.
    exposure: resolveExposure(shot, shotT),
    shotRenderer: typeof shot.renderer === 'string' ? shot.renderer : null,
  };

  // Sprint 4: resolved shake (number OR {amount, velocityScale, scaleWith})
  const shakeAmt = resolveShake(shot.shake, subjectOffsets);
  if (shakeAmt > 0) {
    const d = Math.max(1, distance(out.pos, out.target));
    const k = (shakeAmt * 0.05) / d;
    out.target[0] += shakeNoise(tSec * 9.7 + 1.0) * k;
    out.target[1] += shakeNoise(tSec * 11.3 + 2.0) * k;
    out.target[2] += shakeNoise(tSec * 13.1 + 3.0) * k;
  }

  return out;
}

function distance(a, b) {
  if (!a || !b) return 5;
  const dx = a[0] - b[0],
    dy = a[1] - b[1],
    dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// =============================================================================
// Sprint 4: Subject motion (CarInt physics integration)
// -----------------------------------------------------------------------------
// MttGz4 idiom: each subjectMotion[i] has `phases: [{ duration, v0, a }]`. We
// integrate s = ∫(u + at)dt across phases with continuity — at end of phase k,
// final velocity becomes initial velocity of phase k+1 (regardless of phase
// k+1's declared v0; we use that as an "additive injection" rather than a hard
// reset, matching the MttGz4 CarInt_Update pattern where each phase ADDS its
// v0 + integrates with its a).
//
// Returns map: { subjectId: { offset: vec3, velocity: vec3 } }.
// Only axis-aligned motion in v1: each subjectMotion[i].axis = 'x' | 'y' | 'z'.
// =============================================================================

export function evaluateSubjectMotion(seq, tSec) {
  const out = {};
  if (!seq || !Array.isArray(seq.subjectMotion)) return out;
  for (const m of seq.subjectMotion) {
    const id = m.subjectId;
    if (!id) continue;
    const axis = m.axis === 'x' || m.axis === 'y' || m.axis === 'z' ? m.axis : 'y';
    const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

    // Loop time over total motion duration if cameraSequence loops
    const total = (m.phases || []).reduce((a, p) => a + (p.duration || 0), 0);
    let t = Math.max(0, tSec);
    if (seq.loop && total > 0) t = t - Math.floor(t / total) * total;
    else if (t > total) t = total;

    // Walk phases accumulating displacement + carrying velocity forward
    let s = 0; // accumulated displacement so far
    let u = 0; // carried velocity at phase boundary
    let v = 0; // instant velocity at time t (for shake)
    let acc = 0;
    for (const p of m.phases || []) {
      const dur = p.duration || 0;
      const a = p.a || 0;
      const v0 = p.v0 || 0;
      const uPhase = u + v0; // phase carries previous + injects v0
      if (t < acc + dur) {
        // Inside this phase
        const dt = t - acc;
        s += uPhase * dt + 0.5 * a * dt * dt;
        v = uPhase + a * dt;
        break;
      } else {
        // Phase completed — advance accumulators
        s += uPhase * dur + 0.5 * a * dur * dur;
        u = uPhase + a * dur;
        v = u;
        acc += dur;
      }
    }
    const offset = [0, 0, 0];
    const velocity = [0, 0, 0];
    offset[axisIdx] = s;
    velocity[axisIdx] = v;
    out[id] = { offset, velocity };
  }
  return out;
}

// =============================================================================
// Sprint 4: Resolve target {relativeTo, offset} → absolute world position.
// Falls back to absolute shot.target if no relativeTo. subjectOffsets is the
// output of evaluateSubjectMotion at the current time.
// =============================================================================
export function resolveShotTarget(rawTarget, subjectBaseTargets, subjectOffsets) {
  if (Array.isArray(rawTarget)) return [...rawTarget];
  if (rawTarget && typeof rawTarget === 'object' && rawTarget.relativeTo) {
    const id = rawTarget.relativeTo;
    const offset = rawTarget.offset || [0, 0, 0];
    const base = subjectBaseTargets[id] || [0, 0, 0];
    const motion = subjectOffsets && subjectOffsets[id] ? subjectOffsets[id].offset : [0, 0, 0];
    return [
      base[0] + motion[0] + offset[0],
      base[1] + motion[1] + offset[1],
      base[2] + motion[2] + offset[2],
    ];
  }
  return [0, 0, 0];
}

// =============================================================================
// Sprint 8: per-shot exposure curve. shot.exposure can be:
//   number          → static exposure for the shot
//   [from, to]      → linear ramp across shot duration (LINEAR not smoothed —
//                     exposure ramps feel more cinematic when they're constant
//                     velocity; fade-from-black should not "ease" the brighten)
//   undefined/null  → falls back to defaults.postFx.exposure (no override)
// Returns null when no override, so caller can decide fallback.
// =============================================================================
export function resolveExposure(shot, shotT) {
  if (shot == null) return null;
  if (typeof shot.exposure === 'number') return shot.exposure;
  if (Array.isArray(shot.exposure) && shot.exposure.length === 2) {
    return lerp(shot.exposure[0], shot.exposure[1], Math.max(0, Math.min(1, shotT)));
  }
  return null;
}

// =============================================================================
// Sprint 4: Resolve shake — number (legacy) or {amount, velocityScale, scaleWith}.
// Returns final scalar shake amount for this frame.
// =============================================================================
export function resolveShake(rawShake, subjectOffsets) {
  if (typeof rawShake === 'number') return rawShake;
  if (rawShake && typeof rawShake === 'object') {
    const base = rawShake.amount || 0;
    const vs = rawShake.velocityScale || 0;
    if (vs > 0 && rawShake.scaleWith && subjectOffsets[rawShake.scaleWith]) {
      const v = subjectOffsets[rawShake.scaleWith].velocity;
      const vMag = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      return base + vs * vMag;
    }
    return base;
  }
  return 0;
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
  const halfRad = ((fovDeg * Math.PI) / 180) * 0.5;
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
    fov: fovDegreesToFlyFocal(state.fov), // converted to FLY 3D focal multiplier
    aperture: state.aperture,
    focalDistance: state.focalDistance,
  };
}
