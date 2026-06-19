// =============================================================================
// waypoint-tween.js — Atlas Present Canvas Mode camera tweening
// -----------------------------------------------------------------------------
// Pure functions + RAF loop for animating camera between waypoints (spherical
// coords: yaw, pitch, distance, targetX/Y/Z). Used by editor (preview-tween,
// 200ms) and present mode (cinematic-tween, 800ms).
//
// Layer 2 owns this loop. Does NOT touch compositor's gpuCameraLoop or
// scene.evalCamera — that's for cameraSequence-driven scenes only.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-canvas-mode-design.md §4
// =============================================================================

const TWO_PI = Math.PI * 2;

/**
 * Compute shortest-arc delta for yaw. If |to-from| > π, wrap the result so we
 * tween the short way around the circle.
 *
 * @private
 * @param {number} from
 * @param {number} to
 * @returns {number} delta (signed)
 */
function shortYawDelta(from, to) {
  let delta = to - from;
  if (delta > Math.PI) delta -= TWO_PI;
  else if (delta < -Math.PI) delta += TWO_PI;
  return delta;
}

/**
 * Linearly interpolate camera state on spherical coords (yaw, pitch, distance,
 * targetX/Y/Z). Yaw uses shortest-arc to avoid spinning the long way around.
 * `focal` interpolated only if BOTH from + to have it.
 *
 * @param {{yaw:number, pitch:number, distance:number, targetX:number, targetY:number, targetZ:number, focal?:number}} from
 * @param {{yaw:number, pitch:number, distance:number, targetX:number, targetY:number, targetZ:number, focal?:number}} to
 * @param {number} t — [0,1]
 * @returns {object} interpolated camera
 */
export function interpolateCamera(from, to, t) {
  const yawDelta = shortYawDelta(from.yaw, to.yaw);
  const out = {
    yaw: from.yaw + yawDelta * t,
    pitch: from.pitch + (to.pitch - from.pitch) * t,
    distance: from.distance + (to.distance - from.distance) * t,
    targetX: from.targetX + (to.targetX - from.targetX) * t,
    targetY: from.targetY + (to.targetY - from.targetY) * t,
    targetZ: from.targetZ + (to.targetZ - from.targetZ) * t,
  };
  if (from.focal !== undefined && to.focal !== undefined) {
    out.focal = from.focal + (to.focal - from.focal) * t;
  }
  return out;
}

/**
 * Linear easing — identity. Useful as default.
 *
 * @param {number} t — [0,1]
 * @returns {number}
 */
export function easeLinear(t) {
  return t;
}

/**
 * Smoothstep easing — `3t² − 2t³`. Slow start + slow end (cinematic).
 *
 * @param {number} t — [0,1]
 * @returns {number}
 */
export function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Animate camera from `from` to `to` via RAF loop. Returns a handle with
 * `.cancel()` to abort mid-tween.
 *
 * @param {object} from — camera state (see interpolateCamera)
 * @param {object} to   — camera state
 * @param {object} opts
 * @param {number} [opts.durationMs=800]
 * @param {Function} [opts.easing=easeInOut]
 * @param {Function} [opts.onFrame] — called per frame with interpolated camera
 * @param {Function} [opts.onComplete] — called once when tween finishes naturally
 * @returns {{cancel: Function}}
 */
export function tweenCamera(from, to, opts = {}) {
  const durationMs = opts.durationMs ?? 800;
  const easing = opts.easing ?? easeInOut;
  const onFrame = opts.onFrame ?? (() => {});
  const onComplete = opts.onComplete ?? (() => {});

  const start = performance.now();
  let rafId = null;
  let cancelled = false;

  function frame() {
    if (cancelled) return;
    const elapsed = performance.now() - start;
    const tRaw = Math.min(1, Math.max(0, elapsed / durationMs));
    const tEased = easing(tRaw);
    const cam = interpolateCamera(from, to, tEased);
    onFrame(cam);
    if (tRaw >= 1) {
      onComplete();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return {
    cancel() {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    },
  };
}
