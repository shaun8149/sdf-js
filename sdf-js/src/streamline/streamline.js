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
    // Pasma stop conditions (B in the optimization roadmap)
    stopOnReversal = false,
    stopOnDivergence = false,
    divergenceThreshold = -0.7, // dot(f0, fc) > -0.7 = within ~135° of start
    // SOURCERY idiom 1: skip-tolerance. Allow up to N consecutive invalid
    // (extraValid=false, e.g., QT collision zone or transient mask gap)
    // samples before terminating. Points are still appended to centerline
    // during the skip — only the streamline TERMINATION is deferred. This
    // produces longer / smoother streamlines that bridge over thin "no
    // draw" regions instead of fragmenting into shorter segments.
    skipTolerance = 0, // 0 = old behavior (Universal Rayhatcher)
  } = opts;

  const inBounds = (x, y) => {
    if (!bounds) return true;
    return x >= bounds.minX && x < bounds.maxX && y >= bounds.minY && y < bounds.maxY;
  };
  const valid = (x, y) => (isValidPos ? isValidPos(x, y) : true);

  // Initial direction at seed (used by stopOnDivergence)
  const aSeed = field(seed[0], seed[1]);
  const f0 = [Math.cos(aSeed), Math.sin(aSeed)];

  // Forward extend
  const fwd = [];
  {
    let [x, y] = seed;
    let fpx = f0[0],
      fpy = f0[1]; // previous direction
    let skipCount = 0; // (SOURCERY 1) consecutive invalid samples
    for (let i = 0; i < maxSteps; i++) {
      if (!inBounds(x, y)) break;
      fwd.push([x, y]);
      if (valid(x, y)) {
        skipCount = 0;
      } else {
        skipCount++;
        if (skipCount > skipTolerance) break;
      }
      const a = field(x, y);
      const fcx = Math.cos(a),
        fcy = Math.sin(a);
      // (B.1) Reversal: previous vs current direction flipped → stop
      if (stopOnReversal && fpx * fcx + fpy * fcy <= 0) break;
      // (B.2) Divergence: current direction past divergenceThreshold of seed
      // direction → stop. Default -0.7 ≈ 135° cone.
      if (stopOnDivergence && f0[0] * fcx + f0[1] * fcy < divergenceThreshold) break;
      x += fcx * stepSize;
      y += fcy * stepSize;
      fpx = fcx;
      fpy = fcy;
    }
  }

  // Backward extend (negate direction; mirror the same stop logic)
  const back = [];
  {
    let [x, y] = seed;
    // First step backwards from seed
    x -= f0[0] * stepSize;
    y -= f0[1] * stepSize;
    let fpx = -f0[0],
      fpy = -f0[1]; // backward direction at seed
    let skipCount = 0;
    for (let i = 0; i < maxSteps; i++) {
      if (!inBounds(x, y)) break;
      back.push([x, y]);
      if (valid(x, y)) {
        skipCount = 0;
      } else {
        skipCount++;
        if (skipCount > skipTolerance) break;
      }
      const a = field(x, y);
      // current step direction = -field (we're going backward)
      const fcx = -Math.cos(a),
        fcy = -Math.sin(a);
      if (stopOnReversal && fpx * fcx + fpy * fcy <= 0) break;
      // Diverge check against backward seed direction (-f0)
      if (stopOnDivergence && -f0[0] * fcx + -f0[1] * fcy < divergenceThreshold) break;
      x += fcx * stepSize;
      y += fcy * stepSize;
      fpx = fcx;
      fpy = fcy;
    }
  }

  // Stitch: reverse(back) + fwd
  back.reverse();
  const centerline = back.concat(fwd);

  return {
    centerline,
    forwardLen: fwd.length,
    backwardLen: back.length,
  };
}

// ---- Spatial collision detection ------------------------------------------
//
// Two implementations, same { add(x,y), hasNearby(x,y,r) } interface:
//
//   SpatialGrid  — fixed-cellSize hash grid. O(1) per query. cellSize must
//                  be >= largest possible query radius. Best when dsep is
//                  constant or has a small known max.
//
//   QuadTree     — adaptive bucket-and-split (Pasma's QT). Each node holds
//                  up to 8 points, then splits into 4 children. Query
//                  recurses into overlapping subtrees only. NO max-radius
//                  assumption — every query carries its own radius. This is
//                  what enables Pasma's brightness-driven variable spacing
//                  without a worst-case cellSize budget.
//
// densePack picks based on the `spatialIndex` opt (default 'grid'; switch
// to 'quadtree' for Pasma-style adaptive radius).

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

// QuadTree (port of Pasma's Q/Qa/Qh from Universal Rayhatcher). Each node:
//   { x, y, w, p: points[], r: [child0, child1, child2, child3] | null }
// where (x, y) is the BOTTOM-LEFT corner and w is the side length.
// Split on add when p.length reaches BUCKET_SIZE.
const QT_BUCKET = 8;

class QuadTreeNode {
  constructor(x, y, w) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.p = []; // points up to QT_BUCKET; after that we split
    this.r = null; // 4 children [TR, BR, TL, BL] in (lower-left at) (x+w/2, y+w/2) etc
  }
}

class QuadTree {
  constructor(bounds) {
    // Snap to a square that covers the bounds (QT works best square)
    const W = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    this.root = new QuadTreeNode(bounds.minX, bounds.minY, W);
  }
  add(x, y) {
    this._add(this.root, x, y);
  }
  _add(q, x, y) {
    // If already split, recurse into child whose quadrant contains (x, y)
    if (q.r) {
      const hw = q.w / 2;
      const i = (x >= q.x + hw ? 1 : 0) + (y >= q.y + hw ? 2 : 0);
      this._add(q.r[i], x, y);
      return;
    }
    // Otherwise add to leaf bucket
    q.p.push([x, y]);
    if (q.p.length > QT_BUCKET && q.w > 1e-6) {
      // Split: create 4 children covering each quadrant
      const hw = q.w / 2;
      q.r = [
        new QuadTreeNode(q.x, q.y, hw), // 0: BL
        new QuadTreeNode(q.x + hw, q.y, hw), // 1: BR
        new QuadTreeNode(q.x, q.y + hw, hw), // 2: TL
        new QuadTreeNode(q.x + hw, q.y + hw, hw), // 3: TR
      ];
      // Re-bucket existing points
      const old = q.p;
      q.p = [];
      for (let i = 0; i < old.length; i++) this._add(q, old[i][0], old[i][1]);
    }
  }
  // Any stored point within Euclidean distance `dsep` of (x, y)?
  hasNearby(x, y, dsep) {
    return this._hasNearby(this.root, x, y, dsep * dsep, dsep);
  }
  _hasNearby(q, x, y, rSq, r) {
    // Reject node whose AABB doesn't overlap the query disk's bounding box
    if (x + r < q.x || x - r > q.x + q.w) return false;
    if (y + r < q.y || y - r > q.y + q.w) return false;
    // Check this node's points
    const pts = q.p;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i][0] - x;
      const dy = pts[i][1] - y;
      if (dx * dx + dy * dy < rSq) return true;
    }
    // Recurse into children
    if (q.r) {
      for (let i = 0; i < 4; i++) {
        if (this._hasNearby(q.r[i], x, y, rSq, r)) return true;
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
    // Pasma stop conditions (B) — caller can opt in
    stopOnReversal = false,
    stopOnDivergence = false,
    divergenceThreshold = -0.7,
    // Spatial index choice (E): 'grid' (default, fixed cellSize) vs
    // 'quadtree' (adaptive, no max-radius assumption — needed when dsep
    // varies a lot per query point, e.g., Pasma's brightness-driven spacing)
    spatialIndex = 'grid',
    // SOURCERY idiom 1: tolerate brief excursions through invalid (QT
    // collision / extraValid=false) regions so streamlines stay continuous.
    // Default 0 = old strict break-on-first-invalid.
    skipTolerance = 0,
  } = opts;

  // dsep 可以是数字或函数。函数模式下 grid cell 用 dsepMax 当上界
  const dsepIsFn = typeof dsep === 'function';
  const getDsep = dsepIsFn ? dsep : () => dsep;
  const gridCellSize = dsepIsFn ? dsepMax : dsep;

  if (!bounds) throw new Error('densePack: bounds required');

  // 用 dsep (或 dsepMax) 作 cellSize → 邻域查 3x3 = 半径 1.5×cellSize 内全覆盖
  // QuadTree 模式下不用 cellSize（每次 query 带自己的半径）
  const grid =
    spatialIndex === 'quadtree' ? new QuadTree(bounds) : new SpatialGrid(bounds, gridCellSize);
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
    const sx = Math.ceil(
      Math.sqrt((seedCount * (bounds.maxX - bounds.minX)) / (bounds.maxY - bounds.minY)),
    );
    const sy = Math.ceil(seedCount / sx);
    const dx = (bounds.maxX - bounds.minX) / sx;
    const dy = (bounds.maxY - bounds.minY) / sy;
    for (let i = 0; i < sx; i++) {
      for (let j = 0; j < sy; j++) {
        seeds.push([bounds.minX + (i + 0.5) * dx, bounds.minY + (j + 0.5) * dy]);
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
      stopOnReversal,
      stopOnDivergence,
      divergenceThreshold,
      skipTolerance,
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
 * 两种 mode（视觉差异显著）：
 *
 *   'cross-nfw' (DEFAULT, Pasma signature):
 *     T3D = cross(N, fw)  —— 表面切平面与"屏幕平行平面"的交线方向
 *     视觉：线条像纬度圈，在 sphere 上绕纬线、在 torus 上绕大圆、
 *     在 box 上贴面走 — 跟相机视角自然耦合，"缠绕"感强。
 *
 *   'horizontal-ref' (legacy, 我们 2025-2026 早期实现):
 *     T3D = R - (R·N)·N  —— 固定参考向量 R=[1,0,0] 投影到切平面
 *     视觉：线条跟世界 X 轴关联，旋转物体时线条跟着物体转。
 *     适合静态镜头或物体方向有意义的场景。
 *
 * 通用透视投影（相机 5-tuple）：
 *   camP = P - cam,  depth = camP · fwd
 *   tDotFwd = T · fwd
 *   dx =  T·right · depth - camP·right · tDotFwd
 *   dy =  T·up    · depth - camP·up    · tDotFwd
 *
 * @param {(x:number,y:number)=>{hit:?number[], normal:?number[]}} probe
 * @param {object} [opts]
 * @param {'cross-nfw'|'cross-tilted'|'horizontal-ref'} [opts.mode='cross-nfw']
 *        - 'cross-nfw'     : T = N × fwd            (Pasma Universal Rayhatcher)
 *        - 'cross-tilted'  : T = N × hv             (SOURCERY idiom 2 — tilted reference)
 *                            where hv = normalize(up·tiltUp + fwd·tiltFwd + right·tiltRight)
 *        - 'horizontal-ref': T = R - (R·N)·N        (project ref onto tangent plane)
 * @param {[number,number,number]} [opts.ref=[1,0,0]]   - 仅 horizontal-ref 模式用
 * @param {{up:number, fwd:number, right:number}} [opts.referenceTilt]
 *        - 仅 cross-tilted 模式用。混合权重定义 hv。SOURCERY 用 {up:1, fwd:6, right:2}
 *        默认 = SOURCERY 原值。视觉效果：笔触沿 hv 在切平面上的投影方向 = 倾斜的纬度圈
 *        （而非水平等距线）；适合给同一形状换一种"螺旋包裹"的视觉签名。
 * @param {{cam:number[], fwd:number[], right:number[], up:number[], focal:number}} [opts.camera]
 *        - 相机 5-tuple。默认 = 正面平视 cam=[0,0,-3.5]
 * @returns {(x,y)=>number}  field function (angle)
 */
export function projectedTangentField(probe, opts = {}) {
  const {
    mode = 'cross-nfw',
    ref = [1, 0, 0],
    referenceTilt = { up: 1, fwd: 6, right: 2 }, // SOURCERY values
    camera = {
      cam: [0, 0, -3.5],
      fwd: [0, 0, 1],
      right: [1, 0, 0],
      up: [0, 1, 0],
      focal: 2,
    },
  } = opts;

  // Pre-compute the tilted hatching reference vector `hv` once per field
  // (cross-tilted mode only). hv = normalize(up·tiltUp + fwd·tiltFwd + right·tiltRight)
  let hv = null;
  if (mode === 'cross-tilted') {
    const fw = camera.fwd,
      up = camera.up,
      rt = camera.right;
    const tu = referenceTilt.up ?? 1;
    const tf = referenceTilt.fwd ?? 6;
    const tr = referenceTilt.right ?? 2;
    const hx = up[0] * tu + fw[0] * tf + rt[0] * tr;
    const hy = up[1] * tu + fw[1] * tf + rt[1] * tr;
    const hz = up[2] * tu + fw[2] * tf + rt[2] * tr;
    const hl = Math.hypot(hx, hy, hz) || 1;
    hv = [hx / hl, hy / hl, hz / hl];
  }

  return (x, y) => {
    const data = probe(x, y);
    if (!data || !data.hit || !data.normal) return 0;

    const N = data.normal;
    const P = data.hit;

    // Tangent vector in 3D — mode determines algorithm
    let T;
    if (mode === 'cross-nfw') {
      // Pasma's `hd = X(n, fw)` — cross product gives a vector perpendicular
      // to BOTH the surface normal and the camera view direction. This is
      // the surface's "horizontal contour" direction at this pixel.
      const fw = camera.fwd;
      T = [N[1] * fw[2] - N[2] * fw[1], N[2] * fw[0] - N[0] * fw[2], N[0] * fw[1] - N[1] * fw[0]];
    } else if (mode === 'cross-tilted' && hv) {
      // SOURCERY's `hd = X(n, hv)` where hv = normalize(up + 6*fwd + 2*right).
      // Result: lines wrap surface at an angle instead of horizontal — visually
      // like a screw thread vs latitude rings.
      T = [N[1] * hv[2] - N[2] * hv[1], N[2] * hv[0] - N[0] * hv[2], N[0] * hv[1] - N[1] * hv[0]];
    } else {
      // horizontal-ref: project a fixed world-frame reference onto tangent plane
      const R = ref;
      const rDotN = R[0] * N[0] + R[1] * N[1] + R[2] * N[2];
      T = [R[0] - rDotN * N[0], R[1] - rDotN * N[1], R[2] - rDotN * N[2]];
    }

    // 通用透视投影 —— 用相机 basis 算 dx, dy
    const camP = [P[0] - camera.cam[0], P[1] - camera.cam[1], P[2] - camera.cam[2]];
    const depth = camP[0] * camera.fwd[0] + camP[1] * camera.fwd[1] + camP[2] * camera.fwd[2];
    if (depth <= 1e-6) return 0;
    const tDotFwd = T[0] * camera.fwd[0] + T[1] * camera.fwd[1] + T[2] * camera.fwd[2];
    const tDotR = T[0] * camera.right[0] + T[1] * camera.right[1] + T[2] * camera.right[2];
    const tDotU = T[0] * camera.up[0] + T[1] * camera.up[1] + T[2] * camera.up[2];
    const cpDotR =
      camP[0] * camera.right[0] + camP[1] * camera.right[1] + camP[2] * camera.right[2];
    const cpDotU = camP[0] * camera.up[0] + camP[1] * camera.up[1] + camP[2] * camera.up[2];

    const dx = tDotR * depth - cpDotR * tDotFwd;
    const dy = tDotU * depth - cpDotU * tDotFwd;

    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 0;
    return Math.atan2(dy, dx);
  };
}

// ----------------------------------------------------------------------------
// SOURCERY idioms 4 + 5: Coverage analysis utility
// ----------------------------------------------------------------------------
// Random-sample a probe across screen coords to estimate scene composition.
// Returns counters useful for two unrelated decisions:
//   • idiom 4 (rejection sampler): is this scene worth rendering, or should
//     the caller reroll the hash? SOURCERY's gate: dense ∈ [3%, 30%], sky
//     ∈ [5%, 45%], fg ≤ 20%. If outside, regenerate.
//   • idiom 5 (fxhash features): bucket the region counts as collector-
//     filterable attributes (`cliff`, `ground`, `thing`, `sky`). The caller
//     decides the y-thresholds for region tagging (default = SOURCERY).
//
// The probe is expected to follow the 5-value contract:
//   { intensity, region, hit, normal, t, maxDist }
// (`t` and `maxDist` come from src/sdf/probe.js since 2026-05-27.)
//
// Usage (rejection loop):
//   while (attempts++ < N) {
//     buildScene(seed);
//     const probe = makeProbe(...);
//     const stats = analyzeCoverage(probe);
//     if (stats.dense > 3 && stats.dense < 30 &&
//         stats.sky > 5 && stats.sky < 45 && stats.fg < 20) break;
//     seed = newSeed();
//   }
//
// Usage (features):
//   const stats = analyzeCoverage(probe, { regionByY: hit => ... });
//   const features = bucketFeatures(stats.regions);
//
// Convention: y is `hit[1]` in world space. Region indices [0, 3]:
//   0 = sky (no hit)
//   1 = "thing" (high y)
//   2 = "ground" (mid y)
//   3 = "cliff" (low y)
//
// @param {(x, y) => {intensity, region, hit, normal, t, maxDist}} probe
// @param {object} [opts]
// @param {number} [opts.samples=1023]    - SOURCERY's K (= 2^10 - 1)
// @param {()=>number} [opts.rng=Math.random]
// @param {number} [opts.aspect=16/9]     - screen aspect; sx ∈ [-aspect/2, +aspect/2], sy ∈ [-0.5, +0.5]
// @param {number} [opts.denseDsep=0.01]  - probe.c < this counts as "dense"
//                                          (only used if probe returns c — see notes)
// @param {(hit:[number,number,number])=>number} [opts.regionByY]
//                                          hit → region index 1..3. Default = SOURCERY.
// @returns {{
//   samples: number,
//   sky: number, dense: number, fg: number,    // raw counts
//   skyPct: number, densePct: number, fgPct: number,
//   regions: number[4],                         // [sky, thing, ground, cliff]
// }}
export function analyzeCoverage(probe, opts = {}) {
  const {
    samples = 1023,
    rng = Math.random,
    aspect = 16 / 9,
    fgT = null, // probe.t < fgT → "foreground". null → maxDist*0.067 (SOURCERY 5/75)
    skyT = null, // probe.t > skyT → "sky/miss". null → maxDist*0.987 (SOURCERY 74/75)
    regionByY = (hit) => (hit[1] > 0.8 ? 1 : hit[1] < -0.3 ? 3 : 2),
  } = opts;
  const half = aspect / 2;
  let sky = 0,
    dense = 0,
    fg = 0;
  const regions = [0, 0, 0, 0]; // index = region id
  for (let i = 0; i < samples; i++) {
    const sx = rng() * aspect - half;
    const sy = rng() - 0.5;
    const r = probe(sx, sy);
    if (!r || !r.hit) {
      sky++;
      regions[0]++;
      continue;
    }
    // SOURCERY uses absolute distances (max 75 world units). If caller
    // didn't override, derive from probe's maxDist.
    const md = r.maxDist || 1;
    const _fgT = fgT ?? md * (5 / 75);
    const _skyT = skyT ?? md * (74 / 75);
    if (r.t > _skyT) {
      sky++;
      regions[0]++;
      continue;
    }
    if (r.t < _fgT) fg++;
    if (r.intensity < 0.1) dense++; // dark = densely hatched
    const region = regionByY(r.hit) || 2;
    regions[Math.max(0, Math.min(3, region))]++;
  }
  return {
    samples,
    sky,
    dense,
    fg,
    skyPct: (100 * sky) / samples,
    densePct: (100 * dense) / samples,
    fgPct: (100 * fg) / samples,
    regions,
  };
}

// SOURCERY's `z(p)`: bucketize a count to multiples of p for fxhash-style
// collector filtering. count → percent-ish (count/10) → snap to nearest p.
//   bucketCount(count=23, p=4) = round(23/10/4) * 4 = round(0.575) * 4 = 4
export function bucketCount(count, p) {
  return Math.round(count / 10 / p) * p;
}

// Convert analyzeCoverage's `regions` array into SOURCERY-style features.
// Caller can override the buckets if they want different granularity.
export function bucketFeatures(regions, buckets = { cliff: 1, ground: 2, thing: 4, sky: 4 }) {
  return {
    cliff: bucketCount(regions[3], buckets.cliff),
    ground: bucketCount(regions[2], buckets.ground),
    thing: bucketCount(regions[1], buckets.thing),
    sky: bucketCount(regions[0], buckets.sky),
  };
}

// Default SOURCERY gate for rejection sampler. Returns true if composition
// is "balanced" (= caller should render this scene). Returns false → reroll.
//   dense ∈ [3%, 30%]   not too uniform, not too dark
//   sky   ∈ [5%, 45%]   some sky, but not all sky
//   fg    ≤ 20%         foreground doesn't dominate
export function isBalancedComposition(stats, gate = {}) {
  const { minDense = 3, maxDense = 30, minSky = 5, maxSky = 45, maxFg = 20 } = gate;
  return (
    stats.densePct >= minDense &&
    stats.densePct <= maxDense &&
    stats.skyPct >= minSky &&
    stats.skyPct <= maxSky &&
    stats.fgPct <= maxFg
  );
}

// SOURCERY idiom 4: rejection-sampler loop. Caller supplies a `buildProbe(seed)`
// factory; we try up to `maxAttempts` seeds and return the first one that
// passes `isBalancedComposition` (or the last attempt's seed if none pass).
//
// Returns { seed, probe, stats, attempts, accepted }. `accepted=false` means
// no seed in maxAttempts gave a balanced composition; caller may still want
// to render the best attempt.
//
// @param {(seed:number) => Function} buildProbe   - seed → probe(x, y)
// @param {(_:void) => number} seedGen             - returns a fresh seed each call
// @param {object} [opts]
// @param {number} [opts.maxAttempts=5]
// @param {object} [opts.gate]                    - threshold overrides for
//   isBalancedComposition
// @param {object} [opts.coverage]                - overrides for analyzeCoverage
export function rejectionSample(buildProbe, seedGen, opts = {}) {
  const { maxAttempts = 5, gate, coverage } = opts;
  let bestSeed = null,
    bestProbe = null,
    bestStats = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed = seedGen();
    const probe = buildProbe(seed);
    const stats = analyzeCoverage(probe, coverage);
    if (isBalancedComposition(stats, gate)) {
      return { seed, probe, stats, attempts: attempt + 1, accepted: true };
    }
    // Track best-so-far by closeness to gate (cheap heuristic: smallest
    // sum of "out-of-band" distances)
    if (!bestStats || _gateDistance(stats, gate) < _gateDistance(bestStats, gate)) {
      bestSeed = seed;
      bestProbe = probe;
      bestStats = stats;
    }
  }
  return {
    seed: bestSeed,
    probe: bestProbe,
    stats: bestStats,
    attempts: maxAttempts,
    accepted: false,
  };
}

function _gateDistance(s, gate = {}) {
  const { minDense = 3, maxDense = 30, minSky = 5, maxSky = 45, maxFg = 20 } = gate;
  const oob = (v, lo, hi) => (v < lo ? lo - v : v > hi ? v - hi : 0);
  return (
    oob(s.densePct, minDense, maxDense) + oob(s.skyPct, minSky, maxSky) + oob(s.fgPct, 0, maxFg)
  );
}
