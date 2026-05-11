// =============================================================================
// SDF-driven cellular automaton (kjetil golid 的 ApparatusGenerator 完整移植 + SDF 泛化)
// -----------------------------------------------------------------------------
// 与原版的差异：把 ellipse 硬编码替换成任意 SDF 注入。其他算法精度全部保留：
//   - 9-case 状态机（分别处理"已有房间扩展"和"新房间生成"两种行为）
//   - 3 个独立概率（initiate / extension / solidness）
//   - roundness 模糊边界（每次调用对 SDF 距离加 [-(1-r), +(1-r)] 范围的随机偏移
//     扩展决策放宽边界、起新房间收紧边界 → 边缘有机化）
//   - 4 种色彩模式（random / main / group / default）
//   - 双轴对称（H + V，生成时跳过对称半边以保留 id 关系）
//
// 此外加了：
//   - caRects() 把 line grid 折成矩形对象列表（每个有 id 可独立操控）
//   - caShuffle() + caDrawRectsAt() 做 "scatter → assemble" 装配动画
//     （和 kjetil main.js 的 Transformers-like 动画对齐）
// =============================================================================

const DEFAULT_COLORS = ['#8ec07c', '#fabd2f', '#fb472c', '#d38693', '#314550'];

const DEFAULT_OPTS = {
  colors:           DEFAULT_COLORS,
  initiateChance:   0.9,    // 起新房间（已在 active 区里）的概率
  extensionChance:  0.86,   // 已有房间向外延伸的概率
  solidness:        0.5,    // 起新房间（从空白起手）的概率
  verticalChance:   0.5,    // case 9 里偏垂直 vs 水平延伸
  roundness:        0,      // 0 = 全 fuzz，1 = 硬边
  colorMode:        'group',// 'random' | 'main' | 'group' | 其他=纯 main
  groupSize:        0.82,   // group 模式下色彩聚合度
  hSymmetric:       true,
  vSymmetric:       false,
  simple:           false,  // true = 跳过 SDF 检查（铺满整网格）
};

// =============================================================================
// caGrid(isInside, gridDim, options) → grid (二维 cell 数组)
// -----------------------------------------------------------------------------
//   isInside: (x, y, fuzz=0) => bool
//     fuzz 是 caller 传给 SDF 的"宽容度"（典型范围 -1..+1）；正值更宽松、
//     负值更严格。具体怎么把 fuzz 翻成 SDF 距离阈值由 isInside 自己决定
//     （fromSdf2 helper 默认乘 (2/gridDim) 得到约一格大小的世界距离）。
// =============================================================================
export function caGrid(isInside, gridDim, userOpts = {}) {
  const opts = { ...DEFAULT_OPTS, ...userOpts };
  const ctx = {
    ...opts,
    isInside,
    idCounter: 0,
    mainColor: opts.colors[Math.floor(Math.random() * opts.colors.length)],
  };

  const grid = new Array(gridDim + 1);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = new Array(gridDim + 1);
    for (let j = 0; j < grid[i].length; j++) {
      if (i === 0 || j === 0) {
        grid[i][j] = blankCell();
      } else if (opts.hSymmetric && j > grid[i].length / 2) {
        // 水平镜像：从左半 copy。v 边要往右挪一格（左边变右边 = 邻居的左边）
        const m = grid[i][grid[i].length - j];
        const mv = grid[i][grid[i].length - j + 1];
        grid[i][j] = { h: m.h, v: mv ? mv.v : m.v, in: m.in, color: m.color, id: m.id };
      } else if (opts.vSymmetric && i > grid.length / 2) {
        const m = grid[grid.length - i][j];
        const mh = grid[grid.length - i + 1] ? grid[grid.length - i + 1][j] : m;
        grid[i][j] = { h: mh.h, v: m.v, in: m.in, color: m.color, id: m.id };
      } else {
        grid[i][j] = generateCell(j, i, grid[i][j - 1], grid[i - 1][j], ctx);
      }
    }
  }
  return grid;
}

const blankCell = () => ({ h: false, v: false, in: false, color: null, id: null });

// 9-case 状态机（与 kjetil ApparatusGenerator 的 block_set_1..9 一一对应）
function generateCell(x, y, left, top, ctx) {
  const startNewBlank = () => {
    if (ctx.simple) return true;
    if (!ctx.isInside(x, y, -(1 - ctx.roundness) * Math.random())) return false;
    return Math.random() <= ctx.solidness;
  };
  const startNew = () => {
    if (ctx.simple) return true;
    if (!ctx.isInside(x, y, 0)) return false;
    return Math.random() <= ctx.initiateChance;
  };
  const extend = () => {
    if (!ctx.simple && !ctx.isInside(x, y, (1 - ctx.roundness) * Math.random())) return false;
    return Math.random() <= ctx.extensionChance;
  };
  const verticalDir = () => Math.random() <= ctx.verticalChance;
  const newBlock = () => createNewBlock(left, top, ctx);

  // CASE 1: 都不在 room
  if (!left.in && !top.in) {
    if (startNewBlank()) return newBlock();
    return blankCell();
  }

  // 左在 room, 上不在
  if (left.in && !top.in) {
    if (left.h) {
      // CASE 3: 左在 room 且左有顶边 → 优先尝试向右延伸
      if (extend()) return { v: false, h: true, in: true, color: left.color, id: left.id };
    }
    // CASE 2 / fallback: 试着起新房间，否则封边
    if (startNewBlank()) return newBlock();
    return { v: true, h: false, in: false, color: null, id: null };
  }

  // 上在 room, 左不在
  if (!left.in && top.in) {
    if (top.v) {
      // CASE 5: 上在 room 且上有左边 → 优先尝试向下延伸
      if (extend()) return { v: true, h: false, in: true, color: top.color, id: top.id };
    }
    // CASE 4 / fallback
    if (startNewBlank()) return newBlock();
    return { v: false, h: true, in: false, color: null, id: null };
  }

  // 都在 room
  if (!left.h && !top.v) {
    // CASE 6: 都在且没有相邻边 → 直接继承
    return { v: false, h: false, in: true, color: left.color, id: left.id };
  }
  if (left.h && !top.v) {
    // CASE 7: 左有顶边
    if (extend()) return { v: false, h: true, in: true, color: left.color, id: left.id };
    if (startNew()) return newBlock();
    return { v: true, h: true, in: false, color: null, id: null };
  }
  if (!left.h && top.v) {
    // CASE 8: 上有左边
    if (extend()) return { v: true, h: false, in: true, color: top.color, id: top.id };
    if (startNew()) return newBlock();
    return { v: true, h: true, in: false, color: null, id: null };
  }
  // CASE 9: 双方都有相邻边
  if (verticalDir()) return { v: true, h: false, in: true, color: top.color, id: top.id };
  return { v: false, h: true, in: true, color: left.color, id: left.id };
}

function createNewBlock(left, top, ctx) {
  let color;
  const pick = () => ctx.colors[Math.floor(Math.random() * ctx.colors.length)];

  if (ctx.colorMode === 'random') {
    color = pick();
  } else if (ctx.colorMode === 'main') {
    color = Math.random() > 0.75 ? pick() : ctx.mainColor;
  } else if (ctx.colorMode === 'group') {
    // 邻居优先继承（产生色彩聚合），偶尔换 main
    const keep = Math.random() > 0.5 ? left.color : top.color;
    ctx.mainColor = Math.random() > ctx.groupSize ? pick() : (keep || ctx.mainColor);
    color = ctx.mainColor;
  } else {
    color = ctx.mainColor;
  }
  return { v: true, h: true, in: true, color, id: ctx.idCounter++ };
}

// =============================================================================
// caRects(grid) → [{x1, y1, x2, y2, w, h, color, id}, ...]
// -----------------------------------------------------------------------------
// 把 line grid 折成矩形对象列表。每个 rect 一个独立 id（同 id 跨镜像），
// 可独立操作（动画 / 单选 / 高亮 / SVG export）。
// =============================================================================
export function caRects(grid) {
  // 1. 找 NW 角（h && v && in 同时为 true 的 cell）
  const corners = [];
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const cell = grid[i][j];
      if (cell.h && cell.v && cell.in) {
        corners.push({ x1: j, y1: i, color: cell.color, id: cell.id });
      }
    }
  }
  // 2. 从 NW 角向东、向南扫描到下一个 v / h 边线，确定 w/h
  for (const c of corners) {
    let w = 1;
    while (c.x1 + w < grid[c.y1].length && !grid[c.y1][c.x1 + w].v) w++;
    let h = 1;
    while (c.y1 + h < grid.length && !grid[c.y1 + h][c.x1].h) h++;
    c.w = w; c.h = h;
    c.x2 = c.x1 + w; c.y2 = c.y1 + h;
  }
  return corners;
}

// =============================================================================
// caDraw / caDrawRects —— 默认渲染器
// =============================================================================
export function caDraw(ctx, grid, cellSize, options = {}) {
  const { offsetX = 0, offsetY = 0, lineColor = '#000', lineWidth = 1.5 } = options;
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const cell = grid[i][j];
      if (!cell.in) continue;
      ctx.fillStyle = cell.color;
      ctx.fillRect(offsetX + j * cellSize, offsetY + i * cellSize, cellSize, cellSize);
    }
  }
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = lineColor;
  ctx.beginPath();
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const cell = grid[i][j];
      const px = offsetX + j * cellSize;
      const py = offsetY + i * cellSize;
      if (cell.h) { ctx.moveTo(px, py); ctx.lineTo(px + cellSize, py); }
      if (cell.v) { ctx.moveTo(px, py); ctx.lineTo(px, py + cellSize); }
    }
  }
  ctx.stroke();
}

export function caDrawRects(ctx, rects, cellSize, options = {}) {
  const { offsetX = 0, offsetY = 0, lineColor = '#000', lineWidth = 2 } = options;
  ctx.lineWidth = lineWidth;
  for (const r of rects) {
    const px = offsetX + r.x1 * cellSize;
    const py = offsetY + r.y1 * cellSize;
    const w = r.w * cellSize, h = r.h * cellSize;
    ctx.fillStyle = r.color || '#fff';
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = lineColor;
    ctx.strokeRect(px, py, w, h);
  }
}

// =============================================================================
// fromSdf2 —— sdf-js SDF2 适配器（grid 坐标 → 世界坐标 + fuzz buffer）
// -----------------------------------------------------------------------------
//   fuzz 参数（来自 CA）→ 世界距离 buffer。默认 fuzzScale = 2/gridDim 约一格。
// =============================================================================
export function fromSdf2(sdf2, gridDim, options = {}) {
  const { fuzzScale = 2 / gridDim } = options;
  return (x, y, fuzz = 0) => {
    const wx = (x / gridDim) * 2 - 1;
    const wy = (y / gridDim) * 2 - 1;
    return sdf2([wx, wy]) < fuzz * fuzzScale;
  };
}

// =============================================================================
// caShuffle(rects, options) —— 装配动画的 path 生成
// -----------------------------------------------------------------------------
// 在每个 rect 上累积一个 path[]：从原始位置开始，反复挑随机 rect + 邻居方向、
// 把整个邻居链一起平移一格，记录到 path[i]。最终 path[末尾] 是"散开状"。
// 渲染时倒着播 path → "scatter → assemble" 像变形金刚装配。
//
// rects 会被 mutate：x1/y1/x2/y2 在过程中被修改 + 加 path[]。所以这是一次性的。
// =============================================================================
export function caShuffle(rects, options = {}) {
  const {
    frames = 200,
    holdFrames = 25,        // 路径开头停留多少帧（= 反向播放时末尾的"装配后悬停"）
    movementLength = 0.82,  // 1 - 每帧重启新 shift 的概率
    symmetric = true,       // 上半场对称运动（两侧镜像移动）
  } = options;

  // 初始化：每个 rect 在 holdFrames 内停留在原位
  for (const r of rects) {
    r.x2 = r.x2 ?? r.x1 + r.w;
    r.y2 = r.y2 ?? r.y1 + r.h;
    r.path = [];
    for (let i = 0; i < holdFrames; i++) r.path.push({ x: r.x1, y: r.y1 });
  }

  let chosen, origin, direction;
  let startNewPart = true;
  let sym = symmetric;

  for (let i = holdFrames; i < frames; i++) {
    if (i === Math.floor(frames / 2)) sym = false;  // 后半场放开对称约束

    // 每个 rect 把当前位置 push 到 path[i]
    for (const r of rects) r.path.push({ x: r.x1, y: r.y1 });

    if (startNewPart) {
      chosen = rects[Math.floor(Math.random() * rects.length)];
      origin = sym ? rects.filter(r => r.id === chosen.id) : [chosen];
      direction = (sym && origin.length === 1)
        ? Math.floor(Math.random() * 2) * 2     // 仅 N(0) / S(2)
        : Math.floor(Math.random() * (sym ? 3 : 4));
    }
    startNewPart = Math.random() > movementLength;

    if (isVertical(direction) || !sym) {
      const neighborhood = getNeighborhood(origin, rects, direction);
      shiftAll(neighborhood, direction, i);
    } else {
      // 水平方向 + 对称模式：左半镜像移、右半正常移
      const left = getNeighborhood([origin[0]], rects, mirrorDir(direction));
      const right = getNeighborhood([origin[1]], rects, direction);
      shiftAll(left, mirrorDir(direction), i);
      shiftAll(right, direction, i);
    }
  }
}

const isVertical = (dir) => dir === 0 || dir === 2;
const mirrorDir = (dir) => [0, 3, 2, 1][dir];

function shiftAll(rects, dir, time) { for (const r of rects) shift(r, dir, time); }
function shift(r, dir, time) {
  let sx = 0, sy = 0;
  if (dir === 0) sy = -1;       // North
  else if (dir === 1) sx = 1;   // East
  else if (dir === 2) sy = 1;   // South
  else if (dir === 3) sx = -1;  // West
  r.x1 += sx; r.y1 += sy; r.x2 += sx; r.y2 += sy;
  r.path[time] = { x: r.x1, y: r.y1 };
}

function getNeighborhood(seedRects, allRects, dir) {
  let ns = seedRects;
  let ms = unionRects(ns, ns.flatMap(n => allRects.filter(r => isNeighbor(n, r, dir))));
  while (ms.length > ns.length) {
    ns = ms;
    ms = unionRects(ns, ns.flatMap(n => allRects.filter(r => isNeighbor(n, r, dir))));
  }
  return ms;
}

function isNeighbor(r1, r2, dir) {
  if (r1 === r2) return false;
  if (dir === 0) return r2.y2 === r1.y1 && r2.x1 < r1.x2 && r2.x2 > r1.x1;  // N
  if (dir === 1) return r2.x1 === r1.x2 && r2.y1 < r1.y2 && r2.y2 > r1.y1;  // E
  if (dir === 2) return r2.y1 === r1.y2 && r2.x1 < r1.x2 && r2.x2 > r1.x1;  // S
  if (dir === 3) return r2.x2 === r1.x1 && r2.y1 < r1.y2 && r2.y2 > r1.y1;  // W
  return false;
}

function unionRects(a, b) {
  const set = new Set(a);
  for (const r of b) set.add(r);
  return [...set];
}

// =============================================================================
// caDrawRectsAt(ctx, rects, frame, cellSize, options) —— 按动画帧渲染矩形列表
// 调用方传 frame 索引（caShuffle 后 rects[i].path[frame] 是当帧位置）
// 想倒着播 → 传 frames - tick - 1
// =============================================================================
export function caDrawRectsAt(ctx, rects, frame, cellSize, options = {}) {
  const {
    offsetX = 0, offsetY = 0,
    lineColor = '#000', lineWidth = 2,
    defaultFill = '#fff',
    stroke = true,
  } = options;
  ctx.lineWidth = lineWidth;
  for (const r of rects) {
    if (!r.path || frame < 0 || frame >= r.path.length) continue;
    const pos = r.path[frame];
    const px = offsetX + pos.x * cellSize;
    const py = offsetY + pos.y * cellSize;
    const w = r.w * cellSize, h = r.h * cellSize;
    ctx.fillStyle = r.color || defaultFill;
    ctx.fillRect(px, py, w, h);
    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = lineColor;
      ctx.strokeRect(px, py, w, h);
    }
  }
}
