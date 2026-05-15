// =============================================================================
// fly-controls —— pointer-lock 3D 游戏式 camera 输入控制
// -----------------------------------------------------------------------------
// 适用于 free-fly camera（createFlyCamera）的鼠标 + 键盘控制层。
// 跟 Blender camera fly mode / Source noclip / UE editor camera 同 paradigm。
//
// 控制映射（跟主流 3D 游戏一致）：
//   Click canvas        → 进入 pointer lock（鼠标隐藏 + 无限拖）
//   Mouse move          → 转头（yaw + pitch）
//   W / S               → 前 / 后（沿 fwd 方向移动）
//   A / D               → 左 / 右（沿 right 方向 strafe）
//   Q / Space           → 上（沿 world up 方向）
//   E / Ctrl            → 下
//   Shift               → 加速 ×3
//   Wheel               → 沿 fwd 方向缩放（前后小步移动）
//   R                   → 调 onReset 回调（caller 决定 reset 到哪）
//   Esc                 → 退出 pointer lock
//
// 设计：
//   - state 不持有，每次从 getState() 读最新（避免 stale closure）
//   - 修改 state 通过 setState({...partial})，caller 自己决定如何持久化（slider / cookie）
//   - WASD 是连续操作 → raf loop 计算 dt，按速度 × dt 累积位移
//   - mouse look 是离散事件 → 每个 mousemove 直接 setState
//
// 不在 fly-controls 关心：camera state 的存储方式（caller 用 slider 还是别的），
// 也不关心是否触发 rerender（caller 在 setState 里决定）。这是 input → state delta
// 的纯函数 wrapper。
// =============================================================================

export function attachFlyControls(canvas, getState, setState, opts = {}) {
  const {
    speed = 2.0,              // world unit / 秒
    speedBoost = 3.0,         // Shift 乘子
    mouseSensitivity = 0.003, // rad / pixel
    pitchClamp = 1.40,        // ≈ ±80°，防极点 gimbal
    wheelStep = 0.005,        // wheel deltaY 系数
    onReset = null,           // R 键回调
  } = opts;

  const keys = new Set();
  let pointerLocked = false;
  let rafId = null;
  let lastTime = 0;

  // ---- 工具函数 -----------------------------------------------------------
  const computeFwd = (yaw, pitch) => {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw),   sy = Math.sin(yaw);
    return [sy * cp, -sp, cy * cp];
  };
  const computeRight = (fwd) => {
    // right = world_up × fwd = [fwd[2], 0, -fwd[0]]
    const m = Math.hypot(fwd[2], fwd[0]);
    if (m < 1e-6) return [1, 0, 0];
    return [fwd[2] / m, 0, -fwd[0] / m];
  };
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // ---- Pointer lock 状态切换 ----------------------------------------------
  const onClick = () => {
    if (!pointerLocked) canvas.requestPointerLock();
  };
  const onLockChange = () => {
    pointerLocked = (document.pointerLockElement === canvas);
    if (pointerLocked) {
      canvas.style.cursor = 'none';
      if (!rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    } else {
      canvas.style.cursor = '';
      keys.clear();
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }
  };

  // ---- Mouse look ---------------------------------------------------------
  const onMouseMove = (e) => {
    if (!pointerLocked) return;
    const s = getState();
    const newYaw = s.yaw + e.movementX * mouseSensitivity;
    const newPitch = clamp(s.pitch + e.movementY * mouseSensitivity, -pitchClamp, pitchClamp);
    setState({ yaw: newYaw, pitch: newPitch });
  };

  // ---- Wheel zoom（沿 fwd 移动）------------------------------------------
  const onWheel = (e) => {
    if (!pointerLocked) return;
    e.preventDefault();
    const s = getState();
    const fwd = computeFwd(s.yaw, s.pitch);
    const step = -e.deltaY * wheelStep; // negative deltaY = 向前
    setState({
      position: [
        s.position[0] + fwd[0] * step,
        s.position[1] + fwd[1] * step,
        s.position[2] + fwd[2] * step,
      ],
    });
  };

  // ---- Keyboard -----------------------------------------------------------
  const onKeyDown = (e) => {
    if (!pointerLocked && e.code !== 'KeyR') return; // R 可以在任何时候 reset
    keys.add(e.code);
    if (e.code === 'KeyR' && onReset) onReset();
  };
  const onKeyUp = (e) => keys.delete(e.code);

  // ---- raf loop: WASD 连续移动 -------------------------------------------
  function loop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    const boost = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? speedBoost : 1.0;
    const step = speed * boost * dt;

    let dx = 0, dy = 0, dz = 0;
    const s = getState();
    const fwd = computeFwd(s.yaw, s.pitch);
    const right = computeRight(fwd);

    if (keys.has('KeyW')) { dx += fwd[0]; dy += fwd[1]; dz += fwd[2]; }
    if (keys.has('KeyS')) { dx -= fwd[0]; dy -= fwd[1]; dz -= fwd[2]; }
    if (keys.has('KeyD')) { dx += right[0]; dy += right[1]; dz += right[2]; }
    if (keys.has('KeyA')) { dx -= right[0]; dy -= right[1]; dz -= right[2]; }
    if (keys.has('Space') || keys.has('KeyQ')) { dy += 1; }
    if (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyE')) { dy -= 1; }

    const mag = Math.hypot(dx, dy, dz);
    if (mag > 1e-6) {
      setState({
        position: [
          s.position[0] + (dx / mag) * step,
          s.position[1] + (dy / mag) * step,
          s.position[2] + (dz / mag) * step,
        ],
      });
    }
    rafId = requestAnimationFrame(loop);
  }

  // ---- 挂载 ---------------------------------------------------------------
  canvas.addEventListener('click', onClick);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.style.cursor = 'grab';

  return {
    detach() {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (rafId) cancelAnimationFrame(rafId);
      if (pointerLocked) document.exitPointerLock();
      canvas.style.cursor = '';
    },
    isLocked: () => pointerLocked,
  };
}
