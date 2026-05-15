// =============================================================================
// streamline/ —— field 上的流线追踪
// -----------------------------------------------------------------------------
// 提供两层：
//   1. traceThrough(field, seed)
//      从单个种子双向追踪，吐一条 centerline。"种子放中间双向走"是个长度优化
//      策略 —— 同一个 seed 双向能拿到这条线的完整长度，比单向 trace 期望长度
//      ~2x（朴素假设种子均匀落在线上）。
//
//   2. densePack(field, opts)
//      种子放置 + 碰撞避让循环。内部用 spatial grid 做 O(1) 碰撞检测。
//      当前 seedStrategy 支持 'random' / 'grid'，'jobardLefer' 等高级策略未来加。
// =============================================================================

/**
 * 从 seed 双向追踪 streamline，返回 centerline。
 *
 * @param {(x,y)=>number} field  - angle field
 * @param {[number, number]} seed
 * @param {object} [opts]
 * @param {number} [opts.stepSize=1]      - 每步前进距离（像素）
 * @param {number} [opts.maxSteps=500]    - 单向最大步数
 * @param {object} [opts.bounds]          - {minX, maxX, minY, maxY}，越界即停
 * @param {(x,y)=>boolean} [opts.isValidPos] - 自定义停止条件（碰撞检测）。
 *                                              返回 false → trace 中止。
 * @returns {{centerline: Array<[number,number]>, forwardLen: number, backwardLen: number}}
 */
export function traceThrough(field, seed, opts = {}) {
  const {
    stepSize = 1,
    maxSteps = 500,
    bounds = null,
    isValidPos = null,
  } = opts;

  const inBounds = (x, y) => {
    if (!bounds) return true;
    return x >= bounds.minX && x < bounds.maxX
        && y >= bounds.minY && y < bounds.maxY;
  };
  const valid = (x, y) => isValidPos ? isValidPos(x, y) : true;

  // 正向
  const fwd = [];
  {
    let [x, y] = seed;
    for (let i = 0; i < maxSteps; i++) {
      if (!inBounds(x, y) || !valid(x, y)) break;
      fwd.push([x, y]);
      const a = field(x, y);
      x += Math.cos(a) * stepSize;
      y += Math.sin(a) * stepSize;
    }
  }

  // 反向（从 seed 出发，按 -field 方向）
  const back = [];
  {
    let [x, y] = seed;
    // 第一步先沿反方向走一步，避免和 fwd 第一个点重复
    const a0 = field(x, y);
    x -= Math.cos(a0) * stepSize;
    y -= Math.sin(a0) * stepSize;
    for (let i = 0; i < maxSteps; i++) {
      if (!inBounds(x, y) || !valid(x, y)) break;
      back.push([x, y]);
      const a = field(x, y);
      x -= Math.cos(a) * stepSize;
      y -= Math.sin(a) * stepSize;
    }
  }

  // 拼接：reverse(back) + fwd
  back.reverse();
  const centerline = back.concat(fwd);

  return {
    centerline,
    forwardLen: fwd.length,
    backwardLen: back.length,
  };
}

// ---- Spatial grid for collision detection --------------------------------

class SpatialGrid {
  constructor(bounds, cellSize) {
    this.bounds = bounds;
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
    this.rows = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / cellSize));
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
  }
  _cell(x, y) {
    const c = Math.floor((x - this.bounds.minX) / this.cellSize);
    const r = Math.floor((y - this.bounds.minY) / this.cellSize);
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return -1;
    return r * this.cols + c;
  }
  add(x, y) {
    const idx = this._cell(x, y);
    if (idx >= 0) this.cells[idx].push([x, y]);
  }
  // 3x3 邻域内有任意点距 (x, y) 小于 dsep → true
  hasNearby(x, y, dsep) {
    const idx = this._cell(x, y);
    if (idx < 0) return false;
    const c = idx % this.cols;
    const r = (idx / this.cols) | 0;
    const dsepSq = dsep * dsep;
    for (let dr = -1; dr <= 1; dr++) {
      const nr = r + dr;
      if (nr < 0 || nr >= this.rows) continue;
      for (let dc = -1; dc <= 1; dc++) {
        const nc = c + dc;
        if (nc < 0 || nc >= this.cols) continue;
        const cell = this.cells[nr * this.cols + nc];
        for (let i = 0; i < cell.length; i++) {
          const dx = cell[i][0] - x;
          const dy = cell[i][1] - y;
          if (dx * dx + dy * dy < dsepSq) return true;
        }
      }
    }
    return false;
  }
}

/**
 * 在 bounds 范围内 dense-pack 出多条不互相碰撞的 streamlines。
 *
 * @param {(x,y)=>number} field
 * @param {object} opts
 * @param {{minX,maxX,minY,maxY}} opts.bounds   - 必填
 * @param {number|((x:number,y:number)=>number)} [opts.dsep=4]
 *                                              - 流线间最小距离。可以是常数，或者是
 *                                                (x, y) => number 的函数（变间距 hatching：
 *                                                e.g. 用 probe.intensity 调密度，暗处密 / 亮处稀）
 * @param {number} [opts.dsepMax=0.05]          - 函数 dsep 下 spatial grid 的 cell 大小上界。
 *                                                必须 >= dsep 函数能返回的最大值。
 * @param {number} [opts.dtestRatio=0.5]        - trace 中断阈值（dsep 的倍率）
 *                                                比 dsep 小，让流线能"逼近"已有线
 * @param {'random'|'grid'} [opts.seedStrategy='random']
 * @param {number} [opts.seedCount=1000]
 * @param {number} [opts.maxStreamlines=1000]
 * @param {number} [opts.minLength=5]           - 短于这个的流线丢掉
 * @param {number} [opts.stepSize=1]
 * @param {number} [opts.maxStepsPerLine=2000]
 * @param {()=>number} [opts.rng=Math.random]
 * @param {(x,y)=>boolean} [opts.extraValid=null]  - 额外有效性谓词（AND 到 trace 的 isValidPos 上）。
 *                                                   典型用途：把流线限制在某个 SDF 内部 → hatching。
 *                                                   seed 也会先过这个 filter。
 * @returns {Array<{centerline, forwardLen, backwardLen}>}
 */
export function densePack(field, opts = {}) {
  const {
    bounds,
    dsep = 4,
    dsepMax = 0.05,
    dtestRatio = 0.5,
    seedStrategy = 'random',
    seedCount = 1000,
    maxStreamlines = 1000,
    minLength = 5,
    stepSize = 1,
    maxStepsPerLine = 2000,
    rng = Math.random,
    extraValid = null,
  } = opts;

  // dsep 可以是数字或函数。函数模式下 grid cell 用 dsepMax 当上界
  const dsepIsFn = typeof dsep === 'function';
  const getDsep = dsepIsFn ? dsep : () => dsep;
  const gridCellSize = dsepIsFn ? dsepMax : dsep;

  if (!bounds) throw new Error('densePack: bounds required');

  // 用 dsep (或 dsepMax) 作 cellSize → 邻域查 3x3 = 半径 1.5×cellSize 内全覆盖
  const grid = new SpatialGrid(bounds, gridCellSize);
  // 每点自己的 dtest = dsep(x,y) * ratio。函数模式下逐点重算
  const dtestAt = (x, y) => getDsep(x, y) * dtestRatio;

  // 种子放置策略
  const seeds = [];
  if (seedStrategy === 'random') {
    for (let i = 0; i < seedCount; i++) {
      seeds.push([
        bounds.minX + rng() * (bounds.maxX - bounds.minX),
        bounds.minY + rng() * (bounds.maxY - bounds.minY),
      ]);
    }
  } else if (seedStrategy === 'grid') {
    const sx = Math.ceil(Math.sqrt(seedCount * (bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY)));
    const sy = Math.ceil(seedCount / sx);
    const dx = (bounds.maxX - bounds.minX) / sx;
    const dy = (bounds.maxY - bounds.minY) / sy;
    for (let i = 0; i < sx; i++) {
      for (let j = 0; j < sy; j++) {
        seeds.push([
          bounds.minX + (i + 0.5) * dx,
          bounds.minY + (j + 0.5) * dy,
        ]);
      }
    }
  } else {
    throw new Error(`densePack: unknown seedStrategy '${seedStrategy}'`);
  }

  // trace 时的碰撞检测：当前点距离任何已铺点 < dtest 即停
  // 若用户给了 extraValid（如 SDF 内部判定），AND 上去
  const isValidPos = extraValid
    ? (x, y) => !grid.hasNearby(x, y, dtestAt(x, y)) && extraValid(x, y)
    : (x, y) => !grid.hasNearby(x, y, dtestAt(x, y));

  const streamlines = [];
  for (let s = 0; s < seeds.length; s++) {
    if (streamlines.length >= maxStreamlines) break;
    const seed = seeds[s];
    // 种子本身就在已铺线 dsep(seed) 范围内 → 跳过
    if (grid.hasNearby(seed[0], seed[1], getDsep(seed[0], seed[1]))) continue;
    // 种子不满足额外谓词（如不在 SDF 内）→ 跳过
    if (extraValid && !extraValid(seed[0], seed[1])) continue;

    const sl = traceThrough(field, seed, {
      stepSize,
      maxSteps: maxStepsPerLine,
      bounds,
      isValidPos,
    });

    if (sl.centerline.length < minLength) continue;

    // 把这条线的所有点入网格，供后续碰撞用
    for (let i = 0; i < sl.centerline.length; i++) {
      grid.add(sl.centerline[i][0], sl.centerline[i][1]);
    }
    streamlines.push(sl);
  }

  return streamlines;
}

// ---- Hatching: streamlines confined to an SDF interior --------------------

/**
 * 在一个 SDF 内部 dense-pack 流线 —— 2D 版的 Pasma rayhatching。
 * 流线在 SDF 边界处自然 terminate（isValidPos 返回 false）。
 *
 * 坐标系：全部用 world 单位（典型 view ±1.2）。stepSize / dsep 都以 world 计。
 * Field 接受 (worldX, worldY) 返回 angle (radians)。
 *
 * @param {(p:[number,number])=>number} sdf  - SDF 函数（chainable SDF 本身就是 callable）
 * @param {(x,y)=>number} field              - angle field in world coords
 * @param {object} opts
 * @param {number} [opts.view=1.2]           - 半边长，bounds = ±view
 * @param {number} [opts.dsep=0.02]          - 流线间距（world 单位）
 * @param {number} [opts.stepSize=0.005]     - trace 步长（world 单位）
 * @param {number} [opts.minLength=8]
 * @param {number} [opts.maxStreamlines=5000]
 * @param {number} [opts.seedCount=4000]
 * @param {'random'|'grid'} [opts.seedStrategy='grid']  - grid 在内部填得更均匀
 * @param {number} [opts.maxStepsPerLine=2000]
 * @returns {Array<{centerline, forwardLen, backwardLen}>}
 */
export function hatch(sdf, field, opts = {}) {
  const {
    view = 1.2,
    dsep = 0.02,
    stepSize = 0.005,
    minLength = 8,
    maxStreamlines = 5000,
    seedCount = 4000,
    seedStrategy = 'grid',
    maxStepsPerLine = 2000,
    ...rest
  } = opts;

  const bounds = { minX: -view, maxX: view, minY: -view, maxY: view };
  const insideSdf = (x, y) => sdf([x, y]) < 0;

  return densePack(field, {
    bounds,
    dsep,
    stepSize,
    minLength,
    maxStreamlines,
    seedCount,
    seedStrategy,
    maxStepsPerLine,
    extraValid: insideSdf,
    ...rest,
  });
}

// ---- Convenience: field from SDF gradient ---------------------------------

/**
 * 用 SDF 自己的 gradient 做 hatching field —— 流线垂直于 gradient，即沿
 * "等距离线"走。视觉上是 contour-following hatching：线在 SDF 内部画出一圈圈
 * 平行于形状边界的曲线，类似 Pasma 让线"贴 surface"的 2D 同构。
 *
 * @param {(p:[number,number])=>number} sdf
 * @param {number} [eps=0.001]
 * @returns {(x,y)=>number}  field function (angle)
 */
export function gradientPerpField(sdf, eps = 0.001) {
  return (x, y) => {
    const gx = sdf([x + eps, y]) - sdf([x - eps, y]);
    const gy = sdf([x, y + eps]) - sdf([x, y - eps]);
    return Math.atan2(gy, gx) + Math.PI / 2;
  };
}

// ---- 3D surface-aware field (Pasma rayhatching 的核心) --------------------

/**
 * 用 3D probe 返回的 (hit, normal) 算屏幕方向场。流线会绕着 3D 形状的表面
 * "贴皮"地走 —— 不再是 2D 洋葱环，而是 Pasma Universal Rayhatcher 那种
 * 沿 3D 曲面缠绕的线。
 *
 * 数学：
 *   1. probe 给我们 hit (3D 点) 和 normal (3D 法向)
 *   2. 选一个参考向量 R（默认 [1, 0, 0] 世界水平）
 *   3. 切向 T3D = R - (R·N)·N  —— R 在表面切平面上的投影
 *   4. 用相机 basis (right, up, fwd) 投影 T3D 到屏幕，取 atan2 得到 2D 角度
 *
 * 通用透视投影（相机 5-tuple）：
 *   camP = P - cam,  depth = camP · fwd
 *   tDotFwd = T · fwd
 *   dx =  T·right · depth - camP·right · tDotFwd
 *   dy = -(T·up    · depth - camP·up    · tDotFwd)    (y-flip)
 *
 * @param {(x:number,y:number)=>{hit:?number[], normal:?number[]}} probe
 * @param {object} [opts]
 * @param {[number,number,number]} [opts.ref=[1,0,0]]   - 参考向量
 * @param {{cam:number[], fwd:number[], right:number[], up:number[], focal:number}} [opts.camera]
 *        - 相机 5-tuple。默认 = 正面平视 cam=[0,0,-3.5]
 * @returns {(x,y)=>number}  field function (angle)
 */
export function projectedTangentField(probe, opts = {}) {
  const {
    ref    = [1, 0, 0],
    camera = {
      cam:   [0, 0, -3.5],
      fwd:   [0, 0,  1],
      right: [1, 0,  0],
      up:    [0, 1,  0],
      focal: 2,
    },
  } = opts;

  return (x, y) => {
    const data = probe(x, y);
    if (!data || !data.hit || !data.normal) return 0;

    const N = data.normal;
    const P = data.hit;
    const R = ref;

    // R - (R·N)·N
    const rDotN = R[0]*N[0] + R[1]*N[1] + R[2]*N[2];
    const T = [
      R[0] - rDotN * N[0],
      R[1] - rDotN * N[1],
      R[2] - rDotN * N[2],
    ];

    // 通用透视投影 —— 用相机 basis 算 dx, dy
    const camP = [P[0] - camera.cam[0], P[1] - camera.cam[1], P[2] - camera.cam[2]];
    const depth   = camP[0]*camera.fwd[0]   + camP[1]*camera.fwd[1]   + camP[2]*camera.fwd[2];
    if (depth <= 1e-6) return 0;
    const tDotFwd = T[0]*camera.fwd[0]   + T[1]*camera.fwd[1]   + T[2]*camera.fwd[2];
    const tDotR   = T[0]*camera.right[0] + T[1]*camera.right[1] + T[2]*camera.right[2];
    const tDotU   = T[0]*camera.up[0]    + T[1]*camera.up[1]    + T[2]*camera.up[2];
    const cpDotR  = camP[0]*camera.right[0] + camP[1]*camera.right[1] + camP[2]*camera.right[2];
    const cpDotU  = camP[0]*camera.up[0]    + camP[1]*camera.up[1]    + camP[2]*camera.up[2];

    const dx = tDotR * depth - cpDotR * tDotFwd;
    const dy = tDotU * depth - cpDotU * tDotFwd;
    // 2026-05-15: 跟 probe.rayFor 一起统一到 math-y-up；旧 `-(...)` 是 y-down 时代

    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 0;
    return Math.atan2(dy, dx);
  };
}
