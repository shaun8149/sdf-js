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
 * @param {number} [opts.dsep=4]                - 流线间最小距离
 * @param {number} [opts.dtestRatio=0.5]        - trace 中断阈值（用于 isValidPos）
 *                                                 比 dsep 小，让流线能"逼近"已有线
 * @param {'random'|'grid'} [opts.seedStrategy='random']
 * @param {number} [opts.seedCount=1000]
 * @param {number} [opts.maxStreamlines=1000]
 * @param {number} [opts.minLength=5]           - 短于这个的流线丢掉
 * @param {number} [opts.stepSize=1]
 * @param {number} [opts.maxStepsPerLine=2000]
 * @param {()=>number} [opts.rng=Math.random]
 * @returns {Array<{centerline, forwardLen, backwardLen}>}
 */
export function densePack(field, opts = {}) {
  const {
    bounds,
    dsep = 4,
    dtestRatio = 0.5,
    seedStrategy = 'random',
    seedCount = 1000,
    maxStreamlines = 1000,
    minLength = 5,
    stepSize = 1,
    maxStepsPerLine = 2000,
    rng = Math.random,
  } = opts;

  if (!bounds) throw new Error('densePack: bounds required');

  const dtest = dsep * dtestRatio;
  // 用 dsep 作 cellSize → 邻域查 3x3 = 半径 dsep 内全覆盖
  const grid = new SpatialGrid(bounds, dsep);

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
  const isValidPos = (x, y) => !grid.hasNearby(x, y, dtest);

  const streamlines = [];
  for (let s = 0; s < seeds.length; s++) {
    if (streamlines.length >= maxStreamlines) break;
    const seed = seeds[s];
    // 种子本身就在已铺线 dsep 范围内 → 跳过
    if (grid.hasNearby(seed[0], seed[1], dsep)) continue;

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
