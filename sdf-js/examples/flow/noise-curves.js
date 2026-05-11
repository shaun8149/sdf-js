// =============================================================================
// Phase A demo: noise flow field → dense-packed streamlines → 细线渲染
// -----------------------------------------------------------------------------
// 经典 "follow a noise flow field" 视觉：所有曲线追同一个 Perlin 流场，
// dense-pack 保证流线之间不互相交叉。
// =============================================================================

import { field, streamline, render } from '../../src/index.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const BG = '#fbf9f4';

const els = {
  scale:        document.getElementById('scale'),
  scaleVal:     document.getElementById('scale-val'),
  dsep:         document.getElementById('dsep'),
  dsepVal:      document.getElementById('dsep-val'),
  seedCount:    document.getElementById('seedCount'),
  seedCountVal: document.getElementById('seedCount-val'),
  lineWidth:    document.getElementById('lineWidth'),
  lineWidthVal: document.getElementById('lineWidth-val'),
  regen:        document.getElementById('regen'),
  save:         document.getElementById('save'),
  stats:        document.getElementById('stats'),
};

let currentSeed = Math.floor(Math.random() * 1_000_000);

function regenerate() {
  const scale     = parseFloat(els.scale.value);
  const dsep      = parseFloat(els.dsep.value);
  const seedCount = parseInt(els.seedCount.value, 10);
  const lineWidth = parseFloat(els.lineWidth.value);

  els.scaleVal.textContent     = scale.toFixed(4);
  els.dsepVal.textContent      = dsep.toFixed(0);
  els.seedCountVal.textContent = seedCount;
  els.lineWidthVal.textContent = lineWidth.toFixed(1);

  // 背景
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // field：单 noise，覆盖整张画布
  const f = field.noiseField({ scale, seed: currentSeed });

  // densePack
  const t0 = performance.now();
  const lines = streamline.densePack(f, {
    bounds: { minX: 0, maxX: W, minY: 0, maxY: H },
    dsep,
    seedCount,
    maxStreamlines: 5000,
    stepSize: 1.5,
    maxStepsPerLine: 4000,
    minLength: 10,
  });
  const tPack = performance.now() - t0;

  // 渲染
  const t1 = performance.now();
  render.flowLines(ctx, lines, {
    stroke: '#1a1a1a',
    lineWidth,
  });
  const tRender = performance.now() - t1;

  const totalPoints = lines.reduce((s, l) => s + l.centerline.length, 0);
  els.stats.textContent =
    `seed ${currentSeed} · ${lines.length} streamlines · ${totalPoints} points · ` +
    `pack ${tPack.toFixed(0)}ms · render ${tRender.toFixed(0)}ms`;
}

// 调一个参数 → 重新生成（保持同 seed，方便对比单参数影响）
['scale', 'dsep', 'seedCount', 'lineWidth'].forEach(k => {
  els[k].addEventListener('input', regenerate);
});

// 重新生成 → 换 seed
els.regen.addEventListener('click', () => {
  currentSeed = Math.floor(Math.random() * 1_000_000);
  regenerate();
});

els.save.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `noise-curves-${currentSeed}.png`;
  a.click();
});

regenerate();
