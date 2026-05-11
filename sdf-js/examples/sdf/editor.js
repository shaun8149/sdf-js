// =============================================================================
// SDF 编辑器
// -----------------------------------------------------------------------------
// 状态：layers[]，每一项 = 一个 primitive + (op, k) 的"如何与上面累积起来"。
// 第一层没有 op（它就是基底）。
//
// UI 改 → onChange() → buildSdf() + 重渲染 code + 清空 canvas → 沙画从头铺。
// =============================================================================

// Namespace import 避免和 p5 的全局函数（特别是 p5 的 circle()）撞名
import * as sdf from '../../src/index.js';

// ---- Primitive 的参数 schema -----------------------------------------------
// "common" 三项 (x, y, rotation) 自动每个 primitive 都加；下面只列 type-specific
const SCHEMA = {
  circle:               { specific: [{ name: 'r',      label: '半径',  default: 0.30 }] },
  rectangle:            { specific: [
                          { name: 'w', label: '宽', default: 0.40 },
                          { name: 'h', label: '高', default: 0.30 },
                        ]},
  rounded_rectangle:    { specific: [
                          { name: 'w',      label: '宽',     default: 0.40 },
                          { name: 'h',      label: '高',     default: 0.30 },
                          { name: 'radius', label: '圆角',   default: 0.05 },
                        ]},
  hexagon:              { specific: [{ name: 'r',      label: '外接圆 r', default: 0.30 }] },
  equilateral_triangle: { specific: [{ name: 'scale',  label: '缩放',     default: 0.40 }] },
};
const COMMON = [
  { name: 'x',        label: 'x',  default: 0 },
  { name: 'y',        label: 'y',  default: 0 },
  { name: 'rotation', label: '旋转 (rad)', default: 0 },
];

const TYPE_LABEL = {
  circle: 'circle',
  rectangle: 'rectangle',
  rounded_rectangle: 'rounded_rectangle',
  hexagon: 'hexagon',
  equilateral_triangle: 'equilateral_triangle',
};

const OPS = ['union', 'intersection', 'difference'];

// ---- 应用状态 --------------------------------------------------------------
let nextId = 1;
const state = {
  layers: [],
};

// 初始一个 circle 让用户看到东西
state.layers.push(makeLayer('circle'));

function makeLayer(type) {
  const params = {};
  for (const { name, default: def } of SCHEMA[type].specific) params[name] = def;
  for (const { name, default: def } of COMMON) params[name] = def;
  return {
    id: nextId++,
    type,
    op: 'union',                                            // 第一层时被忽略
    k: 0,
    params,
  };
}

// ---- 构造 SDF（在 onChange 中调）------------------------------------------
const PRIM_FN = {
  circle:               (p) => sdf.circle(p.r),
  rectangle:            (p) => sdf.rectangle([p.w, p.h]),
  rounded_rectangle:    (p) => sdf.rounded_rectangle([p.w, p.h], p.radius),
  hexagon:              (p) => sdf.hexagon(p.r),
  equilateral_triangle: (p) => sdf.equilateral_triangle().scale(p.scale || 1),
};

function buildPrim(layer) {
  let prim = PRIM_FN[layer.type](layer.params);
  if (layer.params.rotation) prim = prim.rotate(layer.params.rotation);
  if (layer.params.x || layer.params.y) {
    prim = prim.translate([layer.params.x || 0, layer.params.y || 0]);
  }
  return prim;
}

function buildSdf(state) {
  if (state.layers.length === 0) return null;
  let f = buildPrim(state.layers[0]);
  for (let i = 1; i < state.layers.length; i++) {
    const layer = state.layers[i];
    let operand = buildPrim(layer);
    if (layer.k > 0) operand = operand.k(layer.k);
    f = f[layer.op](operand);
  }
  return f;
}

// ---- 代码生成 -------------------------------------------------------------
function primExpr(layer) {
  const p = layer.params;
  switch (layer.type) {
    case 'circle':               return `circle(${fmt(p.r)})`;
    case 'rectangle':            return `rectangle([${fmt(p.w)}, ${fmt(p.h)}])`;
    case 'rounded_rectangle':    return `rounded_rectangle([${fmt(p.w)}, ${fmt(p.h)}], ${fmt(p.radius)})`;
    case 'hexagon':              return `hexagon(${fmt(p.r)})`;
    case 'equilateral_triangle': return `equilateral_triangle().scale(${fmt(p.scale)})`;
  }
}

function chainExpr(layer) {
  let expr = primExpr(layer);
  if (layer.params.rotation) expr += `.rotate(${fmt(layer.params.rotation)})`;
  const x = layer.params.x || 0, y = layer.params.y || 0;
  if (x !== 0 || y !== 0) expr += `.translate([${fmt(x)}, ${fmt(y)}])`;
  return expr;
}

const fmt = (n) => {
  // 漂亮的数字格式：去掉拖尾 0，保留至多 4 位小数
  return parseFloat(Number(n).toFixed(4)).toString();
};

function generateCode(state) {
  if (state.layers.length === 0) {
    return `// 还没添加形状`;
  }

  const usedTypes = new Set(state.layers.map(l => TYPE_LABEL[l.type]));
  const importLine = `import { ${[...usedTypes].sort().join(', ')} } from 'sdf-js';`;

  const parts = [];
  state.layers.forEach((layer, i) => {
    const expr = chainExpr(layer);
    if (i === 0) {
      parts.push(`const f = ${expr}`);
    } else {
      const operand = layer.k > 0 ? `${expr}.k(${fmt(layer.k)})` : expr;
      parts.push(`  .${layer.op}(${operand})`);
    }
  });
  parts[parts.length - 1] += ';';

  return importLine + '\n\n' + parts.join('\n');
}

// ---- DOM 渲染 -------------------------------------------------------------
const layersEl  = document.getElementById('layers');
const codeEl    = document.getElementById('code');
const statsEl   = document.getElementById('stats');

function renderLayers() {
  layersEl.innerHTML = '';
  state.layers.forEach((layer, i) => {
    const div = document.createElement('div');
    div.className = 'layer';
    div.dataset.id = layer.id;

    const opRow = i === 0
      ? '<div class="op-row" style="opacity:0.5; font-size:11px; color:#666;">基底层（无运算）</div>'
      : `
        <div class="op-row">
          <select class="op">
            ${OPS.map(o =>
              `<option value="${o}" ${o === layer.op ? 'selected' : ''}>${o === 'union' ? '∪ union' : o === 'intersection' ? '∩ intersect' : '− difference'}</option>`
            ).join('')}
          </select>
          <span class="k-row">
            k <input type="range" class="k" min="0" max="0.5" step="0.01" value="${layer.k}" />
            <span class="k-val">${fmt(layer.k)}</span>
          </span>
        </div>
      `;

    const allParams = [...SCHEMA[layer.type].specific, ...COMMON];
    const paramsHtml = allParams.map(({ name, label }) => `
      <label>${label}
        <input type="number" name="${name}" step="0.05" value="${fmt(layer.params[name])}" />
      </label>
    `).join('');

    div.innerHTML = `
      <header>
        <span class="type">${i + 1}. ${TYPE_LABEL[layer.type]}</span>
        <button class="del" title="删除">×</button>
      </header>
      ${opRow}
      <div class="params">${paramsHtml}</div>
    `;
    layersEl.appendChild(div);
  });
}

function renderCode() {
  codeEl.value = generateCode(state);
}

// ---- 事件绑定 -------------------------------------------------------------
document.getElementById('toolbar').addEventListener('click', (e) => {
  const type = e.target.dataset.add;
  if (!type) return;
  state.layers.push(makeLayer(type));
  onChange({ rerenderLayers: true });
});

layersEl.addEventListener('click', (e) => {
  if (!e.target.classList.contains('del')) return;
  const id = parseInt(e.target.closest('.layer').dataset.id, 10);
  state.layers = state.layers.filter(l => l.id !== id);
  onChange({ rerenderLayers: true });
});

layersEl.addEventListener('input', (e) => {
  const layerEl = e.target.closest('.layer');
  if (!layerEl) return;
  const id = parseInt(layerEl.dataset.id, 10);
  const layer = state.layers.find(l => l.id === id);
  if (!layer) return;

  if (e.target.classList.contains('op')) {
    layer.op = e.target.value;
  } else if (e.target.classList.contains('k')) {
    layer.k = parseFloat(e.target.value) || 0;
    layerEl.querySelector('.k-val').textContent = fmt(layer.k);
  } else if (e.target.tagName === 'INPUT' && e.target.name) {
    layer.params[e.target.name] = parseFloat(e.target.value) || 0;
  }
  onChange({ rerenderLayers: false });
});

document.getElementById('reset').addEventListener('click', () => {
  state.layers = [];
  onChange({ rerenderLayers: true });
});

document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(codeEl.value);
    const btn = document.getElementById('copy');
    const old = btn.textContent;
    btn.textContent = '已复制';
    setTimeout(() => { btn.textContent = old; }, 1200);
  } catch {
    codeEl.select();
    document.execCommand('copy');
  }
});

document.getElementById('clear').addEventListener('click', () => {
  if (typeof background !== 'undefined') background('#432');
});

// ---- 沙画渲染（p5 global mode）-------------------------------------------
const BG = '#432';
const COL_INSIDE   = '#06c';
const COL_OUTSIDE  = '#f80';
const COL_BOUNDARY = '#f5f5f5';
const BAND = 0.01;
const PER_FRAME = 1000;

let currentSdf = null;
let p5Ready = false;
let frameCount = 0;
const R = (a = 1) => Math.random() * a;

window.setup = () => {
  const c = createCanvas(600, 600);
  c.parent('canvas-host');
  background(BG);
  noStroke();
  p5Ready = true;
  // p5 初始化好之后第一次 build
  onChange({ rerenderLayers: true, initialBuild: true });
};

window.draw = () => {
  if (!p5Ready || !currentSdf) return;
  for (let k = 0; k < PER_FRAME; k++) {
    const wx = R(2) - 1;
    const wy = R(2) - 1;
    const d = currentSdf([wx, wy]);
    let col;
    if (d < -BAND)            col = COL_INSIDE;
    else if (d > BAND)        col = COL_OUTSIDE;
    else                      col = COL_BOUNDARY;
    fill(col);
    circle(((wx + 1) * width) / 2, ((wy + 1) * height) / 2, 1);
  }
  frameCount++;
  if (frameCount % 30 === 0) {
    statsEl.textContent = `${state.layers.length} 层 SDF · ${frameCount} 帧 · ${PER_FRAME * frameCount} 颗沙粒`;
  }
};

// ---- 中央调度器 -----------------------------------------------------------
function onChange({ rerenderLayers = false } = {}) {
  if (rerenderLayers) renderLayers();
  renderCode();

  currentSdf = buildSdf(state);

  if (p5Ready) {
    background(BG);                                       // 清画布让新形状从头铺
    frameCount = 0;
  }
}

// 初始 UI 渲染（p5 setup 之后还会再调一次做实际 SDF build）
renderLayers();
renderCode();
