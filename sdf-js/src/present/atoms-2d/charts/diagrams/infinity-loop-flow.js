// =============================================================================
// atoms-2d/charts/diagrams/infinity-loop-flow.js — Figure-8 process loop
// -----------------------------------------------------------------------------
// N steps (4-8) distributed evenly along a lemniscate (infinity / figure-8)
// curve, connected by directional arrows, showing continuous cyclical flow.
//
// Semantic: closed-loop, iterative processes (Build-Measure-Learn, PDCA,
// Double Diamond, agile sprints). The figure-8 form emphasises two distinct
// but interconnected phases.
//
// Args:
//   steps  — array of 4-8 { label: string, description?: string }
//   title  — optional title above the figure
//
// Render: drawPseudo3D
//   - Lemniscate curve drawn as 200-sample polyline (palette accent, 2px)
//   - N step nodes (rounded rect, accent fill, white label) placed at evenly
//     spaced t values; t=0 sits at the cross-centre and the curve fans out to
//     the left and right lobes.
//   - Arrowheads between consecutive nodes along the curve direction
//   - Optional title (Inter 700 18px) centred at top
//
// Per Sprint 15b B4 — "special-flow" diagrams batch.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'infinity-loop-flow',
  category: 'charts/diagrams',
  description:
    'Figure-8 process loop — N steps positioned along an infinity-curve, arrows showing continuous flow.',
  args: {
    steps: {
      type: 'array of 4-8 { label: string, description?: string }',
      required: true,
      example: [{ label: 'Plan' }, { label: 'Build' }, { label: 'Measure' }, { label: 'Learn' }],
    },
    title: { type: 'string?', example: 'Build-Measure-Learn Loop' },
  },
};

// SAMPLES for browser demo / gallery
export const SAMPLES = [
  {
    args: {
      steps: [{ label: 'Plan' }, { label: 'Build' }, { label: 'Measure' }, { label: 'Learn' }],
      title: 'Build-Measure-Learn Loop',
    },
  },
  {
    args: {
      steps: [
        { label: 'Discover', description: 'Research' },
        { label: 'Define' },
        { label: 'Develop' },
        { label: 'Deliver' },
        { label: 'Deploy' },
        { label: 'Monitor' },
      ],
      title: 'Double Diamond Process',
    },
  },
];

// ---- Lemniscate (infinity curve) parametric helpers ----
// x(t) = a * cos(t) / (1 + sin²(t))
// y(t) = a * sin(t)*cos(t) / (1 + sin²(t))
// We use the simpler Lissajous approximation that is visually equivalent:
// x(t) = A * cos(t), y(t) = B * sin(2t) / 2 = B * sin(t)*cos(t)
// This produces the classic figure-8 with a visible cross at t = π/2, 3π/2.

function lemniX(t, a) {
  return a * Math.cos(t);
}
function lemniY(t, b) {
  return b * Math.sin(t) * Math.cos(t);
}

const NODE_W = 84;
const NODE_H = 34;
const CORNER_R = 8;
const CURVE_SAMPLES = 200;
const PAD = 24;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 800;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [60, 100, 200];

  const steps = Array.isArray(args.steps) ? args.steps : [];
  const n = Math.min(Math.max(steps.length, 0), 8);
  const title = args.title;

  // ---- Title ----
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.06);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(title), x + w / 2, y + PAD);
    plotTop = y + PAD + titleSize + 12;
  }

  if (n === 0) return;

  const plotH = y + h - plotTop - PAD;
  const cx = x + w / 2;
  const cy = plotTop + plotH / 2;

  // Node pills scale with canvas size (previously a fixed 84x34 regardless
  // of h — on a large canvas that read as tiny relative to everything else).
  const nodeScale = Math.max(0.9, Math.min(2.2, h / 300));
  const nodeW = NODE_W * nodeScale;
  const nodeH = NODE_H * nodeScale;

  // Semi-axes: target the loop spanning ~70% of canvas width/height
  // (previously capped at 0.42/0.72 of the HALF-extent, i.e. the loop only
  // used well under 30% of the canvas), clamped so nodes stay inside canvas.
  const halfNodeW = nodeW / 2 + 6;
  const halfNodeH = nodeH / 2 + 6;
  const a = Math.min(w / 2 - halfNodeW - PAD, w * 0.35);
  const b = Math.min(plotH / 2 - halfNodeH - PAD, plotH * 0.35);

  // ---- Draw infinity curve ----
  ctx.save();
  ctx.strokeStyle = rgbaCss(accent, 0.35);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const t = (i / CURVE_SAMPLES) * Math.PI * 2;
    const px = cx + lemniX(t, a);
    const py = cy + lemniY(t, b);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  // ---- Compute step node positions ----
  // Distribute n nodes evenly. The lemniscate passes through the center
  // (self-intersection point) TWICE per full loop, at t = π/2 and t = 3π/2 —
  // starting exactly at t = π/2 with a step of 2π/n means that whenever n
  // divides 4 evenly (n=4 is the most common step count!), every sampled t
  // lands exactly on a multiple of π/2, so TWO nodes get placed on top of
  // each other at dead-center and one silently disappears behind the other.
  // A half-step offset keeps every node's t off those exact crossing angles.
  const startT = Math.PI / 2 + Math.PI / (2 * n);
  const positions = [];
  for (let i = 0; i < n; i++) {
    const t = startT + (i / n) * Math.PI * 2;
    positions.push({
      t,
      px: cx + lemniX(t, a),
      py: cy + lemniY(t, b),
    });
  }

  // ---- Draw arrowheads between consecutive nodes ----
  for (let i = 0; i < n; i++) {
    const cur = positions[i];
    const next = positions[(i + 1) % n];
    // Sample a point slightly past 'cur' along the curve to get arrow direction
    const tMid = cur.t + (0.5 / n) * Math.PI * 2;
    const midX = cx + lemniX(tMid, a);
    const midY = cy + lemniY(tMid, b);
    // Arrow from midpoint toward next node
    const dx = next.px - midX;
    const dy = next.py - midY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 4) continue;
    const ux = dx / len;
    const uy = dy / len;
    // Offset start so arrow doesn't overlap with node rects
    const arrowTip = { x: next.px - ux * (nodeW / 2 + 4), y: next.py - uy * (nodeH / 2 + 2) };
    const arrowBase = { x: arrowTip.x - ux * 18, y: arrowTip.y - uy * 18 };
    drawArrow(ctx, arrowBase.x, arrowBase.y, arrowTip.x, arrowTip.y, accent);
  }

  // ---- Draw step nodes on top of curve / arrows ----
  for (let i = 0; i < n; i++) {
    const { px, py } = positions[i];
    drawNode(ctx, px, py, nodeW, nodeH, CORNER_R * nodeScale, steps[i], accent, fg);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function drawNode(ctx, cx, cy, nw, nh, r, step, accent, fg) {
  const nx = cx - nw / 2;
  const ny = cy - nh / 2;
  const label = step && step.label ? String(step.label) : '';

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.16)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  // Node fill — gradient
  const grad = ctx.createLinearGradient(nx, ny, nx, ny + nh);
  grad.addColorStop(0, rgbCss(lighten(accent, 0.12)));
  grad.addColorStop(1, rgbCss(accent));
  ctx.fillStyle = grad;
  roundedRectPath(ctx, nx, ny, nw, nh, r);
  ctx.fill();
  ctx.restore();

  // Label — sized proportionally to the (now canvas-scaled) node height
  const textSize = Math.min(22, nh * 0.34);
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = `700 ${textSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 1);
}

function drawArrow(ctx, x0, y0, x1, y1, color) {
  const HEAD = 8;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  ctx.save();
  ctx.strokeStyle = rgbaCss(color, 0.55);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.fillStyle = rgbaCss(color, 0.65);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - HEAD * ux + (HEAD / 2) * px, y1 - HEAD * uy + (HEAD / 2) * py);
  ctx.lineTo(x1 - HEAD * ux - (HEAD / 2) * px, y1 - HEAD * uy - (HEAD / 2) * py);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
