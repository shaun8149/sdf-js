// =============================================================================
// atoms-2d/shapes/sphere-tree.js — Hierarchical circle tree (sphere nodes)
// -----------------------------------------------------------------------------
// 2D twin of sphere-tree-3d. Top-down tree of circles connected by lines.
//
// Distinct from `tree-diagram` atom: tree-diagram uses RECTANGULAR card nodes
// (org-chart style); sphere-tree uses CIRCULAR nodes (more abstract /
// taxonomy / decision-tree feel). Same root + nested children data shape.
//
// Args:
//   root  — { label?, color?, children?:[...] } (REQUIRED)
//   title — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'sphere-tree',
  category: 'shapes',
  description: 'Hierarchical tree of circle nodes (top-down). Decision tree / taxonomy feel.',
  args: {
    root: {
      type: '{ label?, color?, children?:[...] }',
      required: true,
      example: {
        label: 'Decision',
        children: [
          { label: 'Yes', children: [{ label: 'Path A' }, { label: 'Path B' }] },
          { label: 'No', children: [{ label: 'Path C' }, { label: 'Path D' }] },
        ],
      },
    },
    title: { type: 'string?', example: 'Decision Tree' },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 560;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = palette.colors || [[60, 130, 200]];
  const accent = baseColors[0];

  const root = args.root;
  if (!root) return;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.07)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  // Compute depth + per-level node positions via simple layout
  const levels = layoutTree(root);
  const L = levels.length;
  if (L === 0) return;

  const plotL = x + PAD;
  const plotR = x + w - PAD;
  const plotT = plotTop + PAD * 0.4;
  const plotB = y + h - PAD;
  const plotH = plotB - plotT;
  const plotW = plotR - plotL;

  const levelGap = L > 1 ? plotH / (L - 1) : 0;
  // Node radius scales with depth + width budget
  const widestLevel = Math.max(...levels.map((lvl) => lvl.length));
  const baseR = Math.min(plotW / (widestLevel * 3 + 1), levelGap * 0.32, 28);

  // Assign coords
  for (let l = 0; l < L; l++) {
    const lvl = levels[l];
    const n = lvl.length;
    for (let i = 0; i < n; i++) {
      const node = lvl[i];
      node._x = plotL + ((i + 0.5) / n) * plotW;
      node._y = plotT + l * levelGap;
      node._r = baseR * Math.pow(0.88, l);
    }
  }

  // Draw links first
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.32);
  ctx.lineWidth = Math.max(1, baseR * 0.06);
  ctx.lineCap = 'round';
  for (let l = 1; l < L; l++) {
    for (const child of levels[l]) {
      if (child._parent) {
        ctx.beginPath();
        ctx.moveTo(child._parent._x, child._parent._y + child._parent._r);
        ctx.lineTo(child._x, child._y - child._r);
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Draw nodes
  for (let l = 0; l < L; l++) {
    for (const node of levels[l]) {
      const color = node.color || accent;
      const nx = node._x;
      const ny = node._y;
      const nr = node._r;

      // Ground shadow (soft ellipse)
      ctx.save();
      ctx.filter = 'blur(4px)';
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(nx, ny + nr * 0.9, nr * 0.72, nr * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Sphere body: full 3D radial gradient — highlight offset upper-left
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.20)';
      ctx.shadowBlur = 7;
      ctx.shadowOffsetY = 3;
      const grad = ctx.createRadialGradient(nx - nr * 0.35, ny - nr * 0.4, nr * 0.08, nx, ny, nr);
      grad.addColorStop(0.0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.15, rgbCss(lighten(color, 0.35)));
      grad.addColorStop(0.55, rgbCss(color));
      grad.addColorStop(1.0, rgbCss(darken(color, 0.35)));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Specular highlight ellipse (upper-left)
      if (nr > 6) {
        ctx.save();
        const specCx = nx - nr * 0.35;
        const specCy = ny - nr * 0.45;
        const specRx = nr * 0.34;
        const specRy = nr * 0.17;
        const specGrad = ctx.createRadialGradient(specCx, specCy, 0, specCx, specCy, specRx);
        specGrad.addColorStop(0.0, 'rgba(255,255,255,0.85)');
        specGrad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
        specGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
        ctx.fillStyle = specGrad;
        ctx.beginPath();
        ctx.ellipse(specCx, specCy, specRx, specRy, -0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Label (inside node if large enough; else below)
      if (node.label) {
        const insideOk = nr > 18;
        if (insideOk) {
          ctx.fillStyle = 'white';
          ctx.font = `700 ${Math.round(nr * 0.5)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(node.label), nx, ny);
        } else {
          ctx.fillStyle = rgbCss(fg);
          ctx.font = `600 ${Math.round(h * 0.034)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(String(node.label), nx, ny + nr + 4);
        }
      }
    }
  }
}

// Flatten tree to per-level arrays, with _parent backref for link drawing
function layoutTree(root) {
  const levels = [];
  function visit(node, depth, parent) {
    if (!levels[depth]) levels[depth] = [];
    node._parent = parent;
    levels[depth].push(node);
    const children = Array.isArray(node.children) ? node.children : [];
    for (const c of children) visit(c, depth + 1, node);
  }
  visit(root, 0, null);
  return levels;
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
