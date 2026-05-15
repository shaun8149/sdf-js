// =============================================================================
// test-torso.js —— 同一 back-view female torso polygon，两种 visual register
// -----------------------------------------------------------------------------
// 模式（URL hash 切）：
//   #outline   —— shell + intersection 出极简单线（Matisse Nu Bleu 路数）
//   #hatch     —— streamline.hatch 出 contour-following 阴影线（Pasma 2D 同构）
//
// 同一组 polygon 顶点 → 两种 render → 演示 sdf-js 的 visual register 解耦。
// =============================================================================

import {
  render,
  polygon,
  rectangle,
  intersection,
  shell,
  union,
} from '../../src/index.js';
import { hatch, gradientPerpField } from '../../src/streamline/index.js';

// ---- 共享 polygon：19 个手描顶点 -------------------------------------------
const torso = polygon([
  // Left side, top → bottom
  [-0.18,  0.78],
  [-0.22,  0.55],
  [-0.30,  0.30],
  [-0.40,  0.10],
  [-0.45, -0.15],   // 髋最宽
  [-0.43, -0.40],
  [-0.38, -0.60],
  [-0.25, -0.72],   // 左臀底

  // 底部：内收，V-notch，再外凸
  [-0.08, -0.62],
  [ 0.00, -0.70],   // 臀沟 V
  [ 0.08, -0.62],

  // Right side, bottom → top (镜像)
  [ 0.25, -0.72],
  [ 0.38, -0.60],
  [ 0.43, -0.40],
  [ 0.45, -0.15],
  [ 0.40,  0.10],
  [ 0.30,  0.30],
  [ 0.22,  0.55],
  [ 0.18,  0.78],
]);

const mode = (location.hash.slice(1) || 'outline').toLowerCase();
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---- 模式 1: outline + 内部臀沟线 ------------------------------------------
function renderOutline() {
  const cleftBar = rectangle([0.006, 0.60], [0, -0.40]);
  const outline = shell(torso, 0.005);
  const lineArt = union(outline, intersection(cleftBar, torso));

  render.silhouette(ctx, [{ sdf: lineArt, color: [25, 25, 25] }], {
    view: 1.2,
    background: { top: [253, 253, 253], bottom: [246, 246, 246] },
  });
}

// ---- 模式 2: contour-following hatching ------------------------------------
function renderHatch() {
  const field = gradientPerpField(torso);
  const streamlines = hatch(torso, field, {
    view: 1.2,
    dsep: 0.025,
    stepSize: 0.004,
    minLength: 8,
    seedCount: 6000,
    seedStrategy: 'grid',
    maxStreamlines: 4000,
  });

  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const VIEW = 1.2;
  const wxToPx = wx => (wx + VIEW) / (2 * VIEW) * W;
  const wyToPx = wy => (VIEW - wy) / (2 * VIEW) * H;  // y-flip: math y-up → canvas y-down

  for (const sl of streamlines) {
    const pts = sl.centerline;
    if (pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(wxToPx(pts[0][0]), wyToPx(pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(wxToPx(pts[i][0]), wyToPx(pts[i][1]));
    }
    ctx.stroke();
  }
  document.getElementById('stats')
    && (document.getElementById('stats').textContent = `${streamlines.length} streamlines`);
}

if (mode === 'hatch') renderHatch();
else renderOutline();

// 模式切换按钮
document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    location.hash = btn.dataset.mode;
    location.reload();
  });
});
