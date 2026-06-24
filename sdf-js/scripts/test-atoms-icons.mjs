// =============================================================================
// test-atoms-icons.mjs — Sprint 18 atom-level icon smoke
// -----------------------------------------------------------------------------
// Verifies icon args are accepted on 8 atoms (2 new + 6 enhanced), all colorMode
// branches don't throw, backward compat preserved (no icon → render OK).
// Uses Canvas2D stub: tracks calls without rendering pixels.
// =============================================================================

globalThis.Path2D = class Path2D {
  constructor(d) {
    this.d = d;
  }
};

class Ctx {
  constructor() {
    this.calls = [];
    this.fillStyle = '';
    this.strokeStyle = '';
    this.font = '';
    this.textAlign = '';
    this.textBaseline = '';
    this.shadowColor = '';
    this.shadowBlur = 0;
    this.shadowOffsetY = 0;
    this.lineWidth = 0;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
  }
  save() {
    this.calls.push('save');
  }
  restore() {
    this.calls.push('restore');
  }
  beginPath() {
    this.calls.push('beginPath');
  }
  closePath() {
    this.calls.push('closePath');
  }
  moveTo() {}
  lineTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  fill() {
    this.calls.push('fill');
  }
  stroke() {
    this.calls.push('stroke');
  }
  fillRect() {}
  clearRect() {}
  strokeRect() {}
  fillText() {
    this.calls.push('fillText');
  }
  strokeText() {}
  measureText(s) {
    return { width: s.length * 6 };
  }
  translate() {}
  scale() {}
  rotate() {}
  setTransform() {}
  transform() {}
  createLinearGradient() {
    return { addColorStop() {} };
  }
  createRadialGradient() {
    return { addColorStop() {} };
  }
  createPattern() {
    return null;
  }
  clip() {}
  drawImage() {}
}

import { renderAtom } from '../src/present/atoms-2d/registry.js';

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

async function tryRender(type, args) {
  try {
    const ctx = new Ctx();
    await renderAtom(ctx, type, args, 'pseudo3d', {
      x: 0,
      y: 0,
      w: 1200,
      h: 400,
      palette: { silhouetteColor: [30, 30, 30], colors: [[60, 100, 200]], accent: [60, 100, 200] },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

console.log('=== atoms icon smoke (Sprint 18) ===\n');

console.log('--- NEW atoms ---');
for (const type of ['icon-row', 'icon-grid']) {
  const r = await tryRender(type, {
    title: 'Test',
    items: [
      { icon: 'briefcase', label: 'A' },
      { icon: 'shield', label: 'B' },
      { icon: 'lightning', label: 'C' },
      { icon: 'brand:slack', label: 'D' },
    ],
  });
  ok(r.ok, `${type} renders 4 items (${r.error || 'OK'})`);
  // colorMode variants
  for (const cm of ['auto', 'brand', 'theme']) {
    const r2 = await tryRender(type, {
      items: [
        { icon: 'heart', label: 'X' },
        { icon: 'star', label: 'Y' },
      ],
      colorMode: cm,
    });
    ok(r2.ok, `${type} colorMode=${cm} (${r2.error || 'OK'})`);
  }
}

console.log('\n--- Enhanced atoms WITH icon ---');
const enhanced = [
  [
    'bullet-list',
    {
      items: [
        { label: 'A', icon: 'briefcase' },
        { label: 'B', icon: 'shield' },
      ],
    },
  ],
  [
    'progression',
    { steps: [{ label: 'A', icon: 'rocket' }, { label: 'B', icon: 'flag' }, { label: 'C' }] },
  ],
  [
    'agenda-list',
    {
      items: [
        { label: 'Recap', icon: 'clock' },
        { label: 'Plan', icon: 'calendar' },
      ],
    },
  ],
  ['kpi-card', { value: '$3M', label: 'Revenue', icon: 'chart-line-up' }],
  [
    'nine-field-matrix',
    {
      cells: Array.from({ length: 9 }, (_, i) => ({ label: `${i}`, icon: 'star' })),
      xAxis: 'X',
      yAxis: 'Y',
    },
  ],
  [
    'matrix-grid',
    {
      rows: 2,
      cols: 2,
      cells: [
        { label: 'A', icon: 'briefcase' },
        { label: 'B', icon: 'shield' },
        { label: 'C', icon: 'lightning' },
        { label: 'D', icon: 'heart' },
      ],
    },
  ],
];
for (const [type, args] of enhanced) {
  const r = await tryRender(type, args);
  ok(r.ok, `${type} with icon arg (${r.error || 'OK'})`);
}

console.log('\n--- Enhanced atoms WITHOUT icon (backward compat) ---');
const backward = [
  ['bullet-list', { items: [{ label: 'A' }, { label: 'B' }] }],
  ['progression', { steps: [{ label: 'A' }, { label: 'B' }] }],
  ['agenda-list', { items: [{ label: 'A' }, { label: 'B' }] }],
  ['kpi-card', { value: '$3M', label: 'Revenue' }],
];
for (const [type, args] of backward) {
  const r = await tryRender(type, args);
  ok(r.ok, `${type} without icon (backward compat) (${r.error || 'OK'})`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
