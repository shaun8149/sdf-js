// lift-2d-to-3d.js — deterministic 2D→3D lift (Stage-2 atom-twin instantiation)
//
// Product thesis: Stage 2 reads a 2D (pseudo-3D) slide and instantiates its real-3D
// twin. The supply side — a 3D atom for nearly every 2D atom — already exists. This
// module is the bridge: it takes a 2D SceneData (atoms-2d subjects + args) and emits a
// 3D studio SceneData, with NO model in the loop.
//
// Three moving parts:
//   1. TWIN RULE   — every 2D atom type T has a 3D twin named `${T}-3d` (38/41 of the
//                    registry follow this verbatim). TWIN_MAP only needs to override the
//                    few that differ, plus carry per-atom ARG TRANSFORMS.
//   2. ARG XFORM   — 2D args describe data (e.g. funnel `stages:[{label,value}]`); 3D
//                    args describe geometry (e.g. funnel-3d `stages: <count>`). Each
//                    twin's lift() maps one to the other.
//   3. TEXT ROUTE  — per the two-text-systems rule: framing text (title) + element
//                    labels go to the DOM overlay, never baked as SDF. value readouts
//                    use role 'value'; legend labels use role 'card'.
//
// liftSceneData2dTo3d(scene2d) → scene3d (compile-ready studio SceneData).

const DEFAULT_MAT = {
  hue: 0.57,
  sat: 0.55,
  value: 0.64,
  kind: 'normal',
  roughness: 0.3,
  clearcoat: 0.45,
};

// Coordinated palette so a deck of mixed slide types isn't a wall of navy. Each atom
// family maps to a hue chosen to fit its meaning (warm conversion funnels, gold
// pyramids, green sequences, purple radials…), all at the same sat/value so they read
// as one professional set. (Per-leaf coloring inside a chart needs atom-level colors[]
// support — only sphere-fill/cube have it today — so this is whole-object hue.)
const HUE_BY_TYPE = {
  // data / network — blue
  bar: 0.58, column: 0.58, line: 0.55, 'sphere-network': 0.58, 'relationship-graph': 0.58, scatter: 0.58, waterfall: 0.58,
  // proportion / rings — teal
  pie: 0.50, 'circle-segmented': 0.50, 'circle-loop': 0.50, venn: 0.50, 'circle-frame': 0.50,
  // conversion — warm coral
  funnel: 0.04,
  // hierarchy of levels — gold
  pyramid: 0.11,
  // stacks — indigo
  'layer-stack': 0.66, 'circle-stack': 0.66,
  // sequence / flow — green
  timeline: 0.40, gantt: 0.40, progression: 0.40, 'flow-chart': 0.40, 'agenda-list': 0.40, 'bullet-list': 0.40,
  // radial / mind — purple
  'radial-spoke': 0.74, mindmap: 0.74,
  // org / tree — cyan
  'org-chart': 0.54, 'tree-diagram': 0.54, 'sphere-tree': 0.54,
  // grid / blocks — steel blue
  'matrix-grid': 0.60, cube: 0.60, 'cube-grid': 0.60, 'cube-segmented': 0.60, 'icon-grid': 0.60,
  // scaffold coverage
  'circle-image-hub-spoke': 0.58, 'break-even': 0.4, 'icon-badge': 0.6, 'device-mockup-frame': 0.6,
  // misc
  'sphere-segmented': 0.50, 'kpi-card': 0.58, fishbone: 0.40, diamond: 0.58, gear: 0.58, arrow: 0.58, 'traffic-light': 0.58,
};

// full-material overrides for atoms whose look needs more than a hue swap
const MATERIAL_OVERRIDE = {
  mountain: { hue: 0.6, sat: 0.24, value: 0.62, roughness: 0.55, clearcoat: 0.15 }, // rock
};

function materialFor(type2d) {
  if (MATERIAL_OVERRIDE[type2d]) return { ...DEFAULT_MAT, ...MATERIAL_OVERRIDE[type2d] };
  const hue = HUE_BY_TYPE[type2d];
  if (hue == null) return { ...DEFAULT_MAT };
  // warm hues (reds/oranges/golds) turn muddy brown at the default value/sat — brighten
  // and saturate them so they read as vivid coral/gold, matching the cool families' punch.
  const warm = hue < 0.16 || hue > 0.95;
  return { ...DEFAULT_MAT, hue, sat: warm ? 0.72 : DEFAULT_MAT.sat, value: warm ? 0.82 : DEFAULT_MAT.value };
}

// per-leaf shade ramp of one hue (light→dark) — for atoms that accept colors[]
// (funnel / layer-stack / circle-stack). Gives intra-chart depth without going garish.
export function shades(hue, n) {
  const warm = hue < 0.16 || hue > 0.95;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    out.push({ hue, sat: (warm ? 0.7 : 0.58) + t * 0.08, value: (warm ? 0.88 : 0.76) - t * 0.3 });
  }
  return out;
}

// ── camera: gentle push-in (matches the hand-authored shape twins) ──
export function pushInCamera(target = [0, 1.6, 0], dist = 8.2) {
  return {
    loop: false,
    shots: [
      {
        duration: 0.01,
        pos: [1.0, target[1] + 0.5, dist + 1.6],
        target,
        fov: 50,
        aperture: 0,
        focalDistance: dist,
        ease: 'smooth',
      },
      {
        duration: 13,
        pos: [0, target[1] + 0.2, dist],
        target,
        fov: 46,
        transition: 'blend',
        aperture: 0,
        focalDistance: dist,
        ease: 'smooth',
      },
    ],
  };
}

// cover / establishing shot — wider & higher start, slow grand settle. Gives a deck's
// first slide a cinematic reveal distinct from the per-slide push-in.
export function coverCamera(target = [0, 1.6, 0]) {
  return {
    loop: false,
    shots: [
      { duration: 0.01, pos: [2.2, target[1] + 1.6, 12.0], target, fov: 55, aperture: 0, focalDistance: 11.5, ease: 'smooth' },
      { duration: 17, pos: [0.2, target[1] + 0.35, 8.6], target, fov: 46, transition: 'blend', aperture: 0, focalDistance: 8.6, ease: 'smooth' },
    ],
  };
}

// ── per-slide-type camera moves: a subtle motion that suits the shape, instead of one
//    push-in for everything. All 2-shot blends that settle to a clean front framing. ──
const two = (a, b) => ({ loop: false, shots: [{ ...a, duration: 0.01, aperture: 0, ease: 'smooth' }, { ...b, duration: 14, transition: 'blend', aperture: 0, ease: 'smooth' }] });

// radial / network — swing around to the front (orbit-in)
function orbitIn(t, d = 8.4) {
  return two({ pos: [d * 0.78, t[1] + 0.7, d * 0.62], target: t, fov: 48, focalDistance: d }, { pos: [0, t[1] + 0.2, d], target: t, fov: 46, focalDistance: d });
}
// horizontal sequences (timeline/gantt/bars) — glide laterally while pushing in
function lateralPan(t, d = 8.4) {
  return two({ pos: [-d * 0.5, t[1] + 0.55, d * 0.95], target: t, fov: 50, focalDistance: d }, { pos: [d * 0.18, t[1] + 0.2, d * 0.88], target: t, fov: 47, focalDistance: d });
}
// tall shapes (funnel/pyramid/mountain/stacks) — crane up from a low hero angle
function craneUp(t, d = 8.4) {
  const tgt = [t[0], t[1] + 0.3, t[2]];
  return two({ pos: [0.6, t[1] - 0.9, d + 1.4], target: tgt, fov: 52, focalDistance: d }, { pos: [0, t[1] + 0.6, d], target: tgt, fov: 46, focalDistance: d });
}

const CAMERA_BY_TYPE = {
  'sphere-network': orbitIn, mindmap: orbitIn, 'radial-spoke': orbitIn, 'relationship-graph': orbitIn,
  pie: orbitIn, venn: orbitIn, 'circle-segmented': orbitIn, 'circle-loop': orbitIn, 'sphere-segmented': orbitIn,
  timeline: lateralPan, gantt: lateralPan, progression: lateralPan, 'flow-chart': lateralPan,
  bar: lateralPan, column: lateralPan, line: lateralPan,
  funnel: craneUp, pyramid: craneUp, mountain: craneUp, 'layer-stack': craneUp, 'circle-stack': craneUp,
};

function cameraFor(type2d, target) {
  const fn = CAMERA_BY_TYPE[type2d];
  return fn ? fn(target) : pushInCamera(target);
}

// ── value formatting (2D atoms carry format: 'number'|'percent'|'currency') ──
export function fmt(v, format) {
  if (v == null || Number.isNaN(Number(v))) return String(v ?? '');
  const n = Number(v);
  if (format === 'percent') return `${Math.round(n)}%`;
  if (format === 'currency') return `$${n}`;
  return String(n);
}

// ── overlay layout helpers (geometry-independent placements) ──
// right-side legend column — for funnel / pie / layers / venn-style legends
function rightCards(labels, opts = {}) {
  const x = opts.x ?? 3.0,
    top = opts.top ?? 2.6,
    gap = opts.gap ?? 0.72;
  return labels
    .filter((t) => t != null && t !== '')
    .map((t, i) => ({
      text: String(t),
      anchor: [x, top - i * gap, 0],
      role: 'card',
      align: 'left',
    }));
}

// ── data-shape helpers ──
// label off any item shape (string | {label|name|title|text|...})
const itemLabel = (x) => (x == null ? '' : typeof x === 'string' ? x : (x.label ?? x.name ?? x.title ?? x.text ?? ''));
// coerce a count-or-array arg to an array (number N → N empty slots)
const asArray = (v) => (Array.isArray(v) ? v : (typeof v === 'number' && v > 0 ? Array.from({ length: v }, () => ({})) : []));

// derive {levels, branching} from a nested {children:[...]} tree (org/tree/mindmap/sphere-tree)
function treeShape(root) {
  if (!root || typeof root !== 'object') return { levels: 3, branching: 2 };
  let levels = 0, maxBranch = 1;
  const walk = (n, d) => {
    levels = Math.max(levels, d);
    const ch = Array.isArray(n.children) ? n.children : [];
    maxBranch = Math.max(maxBranch, ch.length);
    ch.forEach((c) => walk(c, d + 1));
  };
  walk(root, 1);
  return { levels: Math.max(2, levels), branching: Math.max(2, maxBranch) };
}

// builder: "array-of-items" atoms → { [countArg]: N } + legend cards.
// key = the 2D data arg holding the array (items/steps/layers/segments/tasks/…).
// countArg = the 3D geometry arg holding the count (items/steps/levels/segments/…).
function itemsTwin(to, key, countArg, opts = {}) {
  const { geom = {}, transform = { translate: [0, 1.5, 0] }, min = 3, role = 'card' } = opts;
  return {
    to,
    lift(a) {
      const arr = asArray(a[key]);
      const n = arr.length || (typeof a[key] === 'number' ? a[key] : 0) || min;
      let labels = arr.map(itemLabel).filter(Boolean);
      if (!labels.length && Array.isArray(a.labels)) labels = a.labels; // count-style atoms carry labels separately
      const overlay = role === 'card' ? rightCards(labels) : [];
      return { args: { [countArg]: n, ...geom }, transform, overlay };
    },
  };
}

// builder: "single labelled icon" atoms (arrow/diamond/gear/cube/circle-frame) →
// geometry default + the one label as a centered caption card.
function iconTwin(to, opts = {}) {
  const { geom = {}, transform = { translate: [0, 1.6, 0] } } = opts;
  return {
    to,
    lift(a) {
      const g = typeof geom === 'function' ? geom(a) : geom;
      const label = itemLabel({ label: a.label });
      const overlay = label ? [{ text: String(label), anchor: [0, 0.4, 0], role: 'card', align: 'center' }] : [];
      return { args: g, transform, overlay };
    },
  };
}

// ── TWIN_MAP: only types that need an arg transform or non-default twin name ──
// Each entry: { to: '<3d type>', lift(args2d) → { args, transform?, overlay? } }
export const TWIN_MAP = {
  funnel: {
    to: 'funnel-3d',
    lift(a) {
      const st = Array.isArray(a.stages) ? a.stages : [];
      const n = st.length || 4;
      return {
        args: {
          stages: n,
          topRadius: 1.15,
          bottomRadius: 0.28,
          stageHeight: 0.55,
          gap: 0.1,
          colors: shades(HUE_BY_TYPE.funnel, n),
        },
        transform: { translate: [-0.3, 1.6, 0], rotate: [0.12, 0, 0] },
        overlay: rightCards(
          st.map((s) => (s.value != null ? `${s.label} ${fmt(s.value, a.format)}` : s.label)),
        ),
      };
    },
  },

  pie: {
    to: 'pie-3d',
    lift(a) {
      const v = (a.values || []).map(Number);
      const labs = a.labels || [];
      return {
        args: { values: v, innerRadius: 0.55, outerRadius: 1.3, thickness: 0.45 },
        transform: { translate: [0, 1.5, 0], rotate: [1.2, 0, 0] },
        overlay: rightCards(labs.map((l, i) => (v[i] != null ? `${l} ${fmt(v[i], a.format)}` : l))),
      };
    },
  },

  bar: {
    to: 'bar-3d',
    lift(a) {
      const raw = (a.values || []).map(Number);
      const mx = Math.max(...raw, 1);
      const norm = raw.map((x) => (x / mx) * 0.9 + 0.1); // keep all bars visible
      const barWidth = 0.55,
        gap = 0.25,
        maxHeight = 2.2,
        ty = 0.15;
      const step = barWidth + gap;
      const x0 = -((raw.length * barWidth + (raw.length - 1) * gap) / 2) + barWidth / 2;
      const overlay = raw.map((x, i) => ({
        text: fmt(x, a.format),
        anchor: [x0 + i * step, ty + norm[i] * maxHeight + 0.25, 0.3],
        role: 'value',
        radius: 0.32,
      }));
      return {
        args: { values: norm, barWidth, barDepth: 0.55, gap, maxHeight, colors: shades(HUE_BY_TYPE.bar, norm.length) },
        transform: { translate: [0, ty, 0] },
        overlay,
      };
    },
  },

  column: {
    to: 'column-3d',
    lift(a) {
      const raw = (a.values || []).map(Number);
      const mx = Math.max(...raw, 1);
      const norm = raw.map((x) => (x / mx) * 0.9 + 0.1);
      return {
        args: { values: norm, barWidth: 0.4, barDepth: 0.4, gap: 0.1, maxHeight: 2.0 },
        transform: { translate: [0, 0.2, 0] },
      };
    },
  },

  line: {
    to: 'line-3d',
    lift(a) {
      const raw = (a.values || []).map(Number);
      const mx = Math.max(...raw, 1);
      const norm = raw.map((x) => (x / mx) * 0.9 + 0.1);
      return {
        args: {
          values: norm,
          pointSpacing: 0.7,
          pointRadius: 0.11,
          lineThickness: 0.06,
          maxHeight: 2.0,
        },
        transform: { translate: [0, 0.25, 0] },
      };
    },
  },

  gauge: {
    to: 'sphere-fill-3d',
    lift(a) {
      const max = a.max ?? 100,
        min = a.min ?? 0;
      const frac = Math.max(0, Math.min(1, ((Number(a.value) || 0) - min) / (max - min || 1)));
      return {
        args: { levels: [frac], radius: 1.1 },
        transform: { translate: [0, 1.4, 0] },
        overlay: [
          { text: fmt(a.value, a.format), anchor: [0, 1.4, 1.2], role: 'value', radius: 0.6 },
        ],
      };
    },
  },

  timeline: {
    to: 'timeline-3d',
    lift(a) {
      const ev = Array.isArray(a.events) ? a.events : [];
      const n = ev.length || 5;
      const span = (n - 1) * (4.2 / Math.max(1, n - 1)); // axisLength 4.2
      const x0 = -span / 2;
      const overlay = ev.map((e, i) => ({
        text: String(e.label ?? e.date ?? e),
        anchor: [x0 + i * (span / Math.max(1, n - 1)), 2.25, 0],
        role: 'value',
        radius: 0.34,
      }));
      return {
        args: { count: n, axisLength: 4.2, axisRadius: 0.06, markerRadius: 0.2, stemHeight: 0.55 },
        transform: { translate: [0, 1.4, 0] },
        overlay,
      };
    },
  },

  'layer-stack': {
    to: 'layer-stack-3d',
    lift(a) {
      const ly = Array.isArray(a.layers) ? a.layers : [];
      const n = ly.length || 4;
      return {
        args: {
          layers: n,
          layerW: 2.4,
          layerD: 1.5,
          layerH: 0.28,
          gap: 0.45,
          taper: a.taper ?? 1.0,
          colors: shades(HUE_BY_TYPE['layer-stack'], n),
        },
        transform: { translate: [-0.3, 1.4, 0], rotate: [0.35, 0.5, 0] },
        overlay: rightCards(ly.map((l) => (typeof l === 'string' ? l : l.label))),
      };
    },
  },

  'circle-segmented': {
    to: 'circle-segmented-3d',
    lift(a) {
      const segs = Array.isArray(a.segments) ? a.segments.length : a.segments || 6;
      return {
        args: {
          segments: segs,
          radius: 0.8,
          innerRatio: a.innerRatio ?? 0.55,
          thickness: 0.2,
          gapWidth: 0.12,
        },
        transform: { translate: [0, 1.6, 0], rotate: [1.5708, 0, 0] },
        overlay: rightCards(a.labels || []),
      };
    },
  },

  // ── array-of-items family: items[] → count arg + legend cards ──
  'agenda-list': itemsTwin('agenda-list-3d', 'items', 'items'),
  'bullet-list': itemsTwin('bullet-list-3d', 'items', 'items'),
  progression: itemsTwin('progression-3d', 'steps', 'steps', { transform: { translate: [-1.0, 0.6, 0] } }),
  pyramid: {
    to: 'pyramid-3d',
    lift(a) {
      const arr = asArray(a.layers);
      const n = arr.length || (typeof a.layers === 'number' ? a.layers : 0) || 3;
      const labels = arr.map(itemLabel).filter(Boolean);
      return {
        args: { levels: n, colors: shades(HUE_BY_TYPE.pyramid, n) },
        transform: { translate: [0, 0.6, 0] },
        overlay: rightCards(labels.length ? labels : a.labels || []),
      };
    },
  },
  'traffic-light': itemsTwin('traffic-light-3d', 'lights', 'lights', { transform: { translate: [0, 1.8, 0] } }),
  'circle-stack': {
    to: 'circle-stack-3d',
    lift(a) {
      const ly = asArray(a.layers);
      const n = ly.length || (typeof a.layers === 'number' ? a.layers : 0) || 4;
      const labels = ly.map(itemLabel).filter(Boolean);
      return {
        args: { count: n, colors: shades(HUE_BY_TYPE['circle-stack'], n) },
        transform: { translate: [0, 1.4, 0] },
        overlay: rightCards(labels.length ? labels : a.labels || []),
      };
    },
  },
  'flow-chart': itemsTwin('flow-chart-3d', 'steps', 'steps', { transform: { translate: [0, 1.6, 0] } }),
  'sphere-segmented': itemsTwin('sphere-segmented-3d', 'segments', 'segments', { transform: { translate: [0, 1.6, 0] } }),
  'cube-segmented': itemsTwin('cube-segmented-3d', 'segments', 'segments', { transform: { translate: [0, 1.5, 0] } }),
  gantt: itemsTwin('gantt-3d', 'tasks', 'tasks', { transform: { translate: [0, 1.6, 0] } }),
  fishbone: itemsTwin('fishbone-3d', 'branches', 'ribs', { transform: { translate: [0, 1.6, 0] } }),
  'circle-loop': itemsTwin('circle-loop-3d', 'segments', 'segments', { transform: { translate: [0, 1.6, 0], rotate: [1.5708, 0, 0] } }),

  venn: {
    to: 'venn-3d',
    lift(a) {
      const n = Array.isArray(a.sets) ? a.sets.length : (a.sets || 3);
      return {
        args: { sets: n, radius: 0.95, tube: 0.1, overlap: a.overlap ?? 0.5 },
        transform: { translate: [0, 1.7, 0] },
        overlay: rightCards(Array.isArray(a.sets) ? a.sets.map(itemLabel) : []),
      };
    },
  },

  // ── values family: raw values[] → count + value readouts ──
  'radial-spoke': {
    to: 'radial-spoke-3d',
    lift(a) {
      const v = a.values || [];
      return {
        // thicker hub/spokes/nodes read far better at presentation scale than atom defaults
        args: { spokes: v.length || 6, hubRadius: 0.34, spokeThickness: 0.09, nodeRadius: 0.17, maxLen: 1.35, minLen: 0.7 },
        transform: { translate: [0, 1.7, 0] },
        overlay: rightCards((a.labels || []).map((l, i) => (v[i] != null ? `${l} ${fmt(v[i], a.format)}` : l))),
      };
    },
  },
  waterfall: {
    to: 'waterfall-3d',
    lift(a) {
      const bars = Array.isArray(a.bars) ? a.bars : [];
      return { args: { count: bars.length || 5 }, transform: { translate: [0, 0.3, 0] } };
    },
  },
  scatter: {
    to: 'scatter-3d',
    lift(a) {
      const pts = Array.isArray(a.points) ? a.points : [];
      return { args: { count: pts.length || 24 }, transform: { translate: [0, 1.6, 0] } };
    },
  },

  // ── tree family: {root:{children}} → levels + branching ──
  mindmap: {
    to: 'mindmap-3d',
    lift(a) {
      const ch = a.root && Array.isArray(a.root.children) ? a.root.children : [];
      return {
        args: { branches: ch.length || 5, leavesPerBranch: 2 },
        transform: { translate: [0, 1.7, 0] },
        overlay: rightCards(ch.map(itemLabel)),
      };
    },
  },
  'org-chart': {
    to: 'org-chart-3d',
    lift(a) {
      const t = treeShape(a.root);
      return { args: { levels: t.levels, branching: t.branching, nodeW: 0.62, nodeH: 0.36, levelHeight: 1.15, spread: 4.0 }, transform: { translate: [0, 3.0, 0] } };
    },
  },
  'tree-diagram': {
    to: 'tree-diagram-3d',
    lift(a) {
      const t = treeShape(a.root);
      return { args: { levels: t.levels, branching: t.branching }, transform: { translate: [0, 2.8, 0] } };
    },
  },
  'sphere-tree': {
    to: 'sphere-tree-3d',
    lift(a) {
      const t = treeShape(a.root);
      return { args: { levels: t.levels, branching: t.branching }, transform: { translate: [0, 2.6, 0] } };
    },
  },
  'sphere-network': {
    to: 'sphere-network-3d',
    lift(a) {
      const sats = Array.isArray(a.satellites) ? a.satellites : [];
      return {
        args: { count: sats.length || 6, arrangement: 'sphere' },
        transform: { translate: [0, 1.8, 0] },
        overlay: rightCards(sats.map(itemLabel)),
      };
    },
  },
  'relationship-graph': {
    to: 'relationship-graph-3d',
    lift(a) {
      const nodes = Array.isArray(a.nodes) ? a.nodes : [];
      // 3D edges arg wants an array of [from,to] index pairs, or null (auto). Pass
      // through only when 2D already supplies pairs; otherwise let the atom auto-wire.
      const pairs = Array.isArray(a.edges) && a.edges.every((e) => Array.isArray(e)) ? a.edges : null;
      return { args: { count: nodes.length || 5, edges: pairs }, transform: { translate: [0, 1.7, 0] } };
    },
  },

  // ── grid family ──
  'matrix-grid': {
    to: 'matrix-grid-3d',
    lift(a) {
      return { args: { rows: a.rows ?? 3, cols: a.cols ?? 3 }, transform: { translate: [0, 1.8, 0] } };
    },
  },
  'cube-grid': {
    to: 'cube-3d',
    lift(a) {
      const size = a.size ?? 3;
      return {
        // grid arranges flat in XZ (floor) — stand it up into XY so the full NxN faces
        // the camera instead of being seen edge-on (only the front row visible).
        args: { arrangement: 'grid', count: size * size, cubeSize: 0.5, spacing: a.spacing ?? 0.22, material: 'solid', colors: a.colors || null, arrangementParams: { cols: size } },
        transform: { translate: [0, 1.9, 0], rotate: [1.5708, 0, 0] },
      };
    },
  },

  // ── single labelled icon family: geometry default + one centered caption ──
  arrow: iconTwin('arrow-3d'),
  diamond: iconTwin('diamond-3d'),
  cube: iconTwin('cube-3d', { geom: { count: 1, arrangement: 'row', cubeSize: 1.0 } }),
  gear: iconTwin('gear-3d', { geom: (a) => ({ teeth: a.teeth ?? 12 }), transform: { translate: [0, 1.6, 0], rotate: [1.5708, 0, 0] } }),
  'circle-frame': iconTwin('circle-frame-3d', { transform: { translate: [0, 1.6, 0] } }),

  // ── single value+label (KPI-ish) ──
  'kpi-card': {
    to: 'kpi-card-3d',
    lift(a) {
      return {
        args: { value: a.value, label: a.label, trend: a.trend, trendValue: a.trendValue },
        transform: { translate: [0, 1.6, 0] },
        overlay: a.value != null ? [{ text: fmt(a.value, a.format), anchor: [0, 1.9, 0.6], role: 'value', radius: 0.5 }] : [],
      };
    },
  },
  'sphere-fill': {
    to: 'sphere-fill-3d',
    lift(a) {
      const frac = Math.max(0, Math.min(1, Number(a.value) > 1 ? Number(a.value) / 100 : (Number(a.value) || 0)));
      return {
        args: { levels: [frac], radius: 1.1 },
        transform: { translate: [0, 1.4, 0] },
        overlay: [{ text: fmt(a.value, a.format ?? 'percent'), anchor: [0, 1.4, 1.2], role: 'value', radius: 0.6 }],
      };
    },
  },

  // summit / journey metaphor — a real mountain with an ascending trail
  mountain: {
    to: 'mountain-3d',
    lift(a) {
      const stages = a.stages || a.steps || a.layers || [];
      return {
        args: { height: 2.6, baseRadius: 1.6, sidePeaks: 2, pathMarkers: a.markers ?? Math.max(3, stages.length || 4) },
        transform: { translate: [0, 0, 0] },
        overlay: rightCards(stages.map(itemLabel)),
      };
    },
  },

  // icon set — a wall of pictogram tiles
  'icon-grid': {
    to: 'icon-grid-3d',
    lift(a) {
      return {
        args: { rows: a.rows ?? 2, cols: a.cols ?? 4, glyphs: a.glyphs ?? null },
        transform: { translate: [0, 1.9, 0] },
      };
    },
  },

  // ── scaffold coverage: types that appear in real 2D decks ──
  'circle-image-hub-spoke': {
    to: 'sphere-network-3d',
    lift(a) {
      const sats = Array.isArray(a.satellites) ? a.satellites : [];
      return {
        args: { count: sats.length || 6, arrangement: 'sphere' },
        transform: { translate: [0, 1.8, 0] },
        overlay: rightCards(sats.map(itemLabel)),
      };
    },
  },
  'break-even': {
    to: 'line-3d',
    lift() {
      // approximate a break-even chart as a rising revenue line
      return {
        args: { values: [0.15, 0.35, 0.55, 0.75, 0.95], pointSpacing: 0.7, pointRadius: 0.11, lineThickness: 0.06, maxHeight: 2.0 },
        transform: { translate: [0, 0.25, 0] },
      };
    },
  },
  'icon-badge': {
    to: 'icon-grid-3d',
    lift(a) {
      return {
        args: { rows: 1, cols: 1, tileSize: 1.0 },
        transform: { translate: [0, 1.6, 0] },
        overlay: a.label ? [{ text: String(a.label), anchor: [0, -0.75, 0], role: 'card', align: 'center' }] : [],
      };
    },
  },
  'device-mockup-frame': {
    to: 'device-mockup-3d',
    lift(a) {
      return {
        args: { device: a.device || 'phone' },
        transform: { translate: [0, 1.7, 0] },
        overlay: a.title ? [{ text: String(a.title), anchor: [0, -1.4, 0], role: 'card', align: 'center' }] : [],
      };
    },
  },

  // ── Sprint 22 B1: PL-recommendations atom twins (from main #180) ──
  'mountain-path': {
    to: 'mountain-3d',
    lift(a) {
      const milestones = a.milestones || [];
      return {
        args: {
          pathMarkers: Math.max(2, milestones.length || 4),
          height: 2.4,
          baseRadius: 1.5,
          sidePeaks: 2,
          spread: 1.7,
          sideScale: 0.6,
          markerRadius: 0.13,
        },
        transform: { translate: [0, 0, 0] },
        overlay: [
          ...rightCards(milestones.map((m) => m.label || '')),
          ...(a.summit ? [{ text: String(a.summit), anchor: [0, 3.0, 0], role: 'value', radius: 0.4 }] : []),
        ],
      };
    },
  },

  'strategy-map': {
    to: 'layer-stack-3d',
    lift(a) {
      const persp = a.perspectives || [];
      return {
        args: {
          layers: persp.length || 4,
          layerW: 2.4,
          layerD: 1.5,
          layerH: 0.28,
          gap: 0.45,
          taper: 1.0,
        },
        transform: { translate: [-0.3, 1.4, 0], rotate: [0.35, 0.5, 0] },
        overlay: rightCards(
          persp.map((p) => {
            const items = Array.isArray(p.items) ? p.items.join(' · ') : '';
            return p.label ? (items ? `${p.label}: ${items}` : p.label) : items;
          }),
        ),
      };
    },
  },

  'radar-chart': {
    to: 'radial-spoke-3d',
    lift(a) {
      const axes = a.axes || [];
      const series = a.series || [];
      const values = (series[0] && series[0].values) || [];
      return {
        args: { spokes: axes.length || 6 },
        transform: { translate: [0, 1.7, 0] },
        overlay: rightCards(
          axes.map((label, i) =>
            values[i] != null ? `${label} ${Math.round(Number(values[i]) * 100)}%` : label,
          ),
        ),
      };
    },
  },

  'okr-tree': {
    to: 'tree-diagram-3d',
    lift(a) {
      const krs = a.keyResults || [];
      return {
        args: { levels: 2, branching: Math.max(1, krs.length) },
        transform: { translate: [0, 2.8, 0] },
        overlay: rightCards(
          krs.map(
            (kr) =>
              `${kr.label || ''} ${Math.round((Number(kr.progress) || 0) * 100)}%` +
              (kr.sublabel ? ` · ${kr.sublabel}` : ''),
          ),
        ),
      };
    },
  },

  // ── Sprint 22 B2 twins ──

  'decision-tree-3-arm': {
    to: 'tree-diagram-3d',
    lift(a) {
      const arms = a.arms || [];
      const titleOverlay = a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : [];
      return {
        args: { levels: 2, branching: Math.max(1, arms.length) },
        transform: { translate: [0, 2.0, 0] },
        overlay: [
          ...titleOverlay,
          { text: a.question || '', anchor: [0, 3.2, 0], role: 'card', align: 'center' },
          ...rightCards(arms.map((arm) => arm.label + (arm.sublabel ? ` · ${arm.sublabel}` : ''))),
        ],
      };
    },
  },

  'maturity-model': {
    to: 'pyramid-3d',
    lift(a) {
      const stages = a.stages || [];
      const titleOverlay = a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : [];
      return {
        args: { levels: stages.length },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...titleOverlay,
          ...rightCards(
            stages.map((s, i) =>
              (a.currentLevel === i + 1 ? '▶ ' : '') + (s.label || '') + (s.description ? ` · ${s.description}` : ''),
            ),
          ),
          ...(a.label ? [{ text: String(a.label), anchor: [0, -0.2, 0], role: 'value', align: 'center' }] : []),
        ],
      };
    },
  },

  'cost-benefit-matrix': {
    to: 'matrix-grid-3d',
    lift(a) {
      const items = a.items || [];
      const ql = a.quadrantLabels || {};
      const titleOverlay = a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : [];
      return {
        args: { rows: 2, cols: 2 },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...titleOverlay,
          ...(ql.tl ? [{ text: ql.tl, anchor: [-2.2, 2.8, 0], role: 'card', align: 'center' }] : []),
          ...(ql.tr ? [{ text: ql.tr, anchor: [2.2, 2.8, 0], role: 'card', align: 'center' }] : []),
          ...(ql.bl ? [{ text: ql.bl, anchor: [-2.2, 0.2, 0], role: 'card', align: 'center' }] : []),
          ...(ql.br ? [{ text: ql.br, anchor: [2.2, 0.2, 0], role: 'card', align: 'center' }] : []),
          ...rightCards(items.map((it) => `${it.label || ''} (${it.cost || '?'} cost · ${it.benefit || '?'} benefit)`)),
        ],
      };
    },
  },

  'journey-flow-curve': {
    to: 'timeline-3d',
    lift(a) {
      const tps = a.touchpoints || [];
      const titleOverlay = a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : [];
      return {
        args: { count: tps.length },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...titleOverlay,
          ...rightCards(
            tps.map((tp) => {
              const emo = Number(tp.emotion) || 0;
              const sign = emo > 0 ? '+' : '';
              return tp.label + (tp.sublabel ? ` · ${tp.sublabel}` : '') + ` (emotion ${sign}${Math.round(emo * 100)}%)`;
            }),
          ),
        ],
      };
    },
  },

  // ── Sprint 22 B3 twins ──

  'risk-heatmap': {
    to: 'matrix-grid-3d',
    lift(a) {
      const risks = a.risks || [];
      return {
        args: { rows: 5, cols: 5 },
        transform: { translate: [0, 1.8, 0] },
        overlay: [
          ...risks.map((r) => ({ text: r.label || '', role: 'card', align: 'left' })),
        ],
      };
    },
  },

  'org-vs-org-matrix': {
    to: 'matrix-grid-3d',
    lift(a) {
      const orgs = a.orgs || [];
      const ql = a.quadrantLabels || {};
      return {
        args: { rows: 2, cols: 2 },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...(ql.tl ? [{ text: ql.tl, anchor: [-2.2, 2.8, 0], role: 'card', align: 'center' }] : []),
          ...(ql.tr ? [{ text: ql.tr, anchor: [2.2, 2.8, 0], role: 'card', align: 'center' }] : []),
          ...(ql.bl ? [{ text: ql.bl, anchor: [-2.2, 0.2, 0], role: 'card', align: 'center' }] : []),
          ...(ql.br ? [{ text: ql.br, anchor: [2.2, 0.2, 0], role: 'card', align: 'center' }] : []),
          ...orgs.map((o) => ({ text: o.name || '', role: 'card', align: 'center' })),
        ],
      };
    },
  },

  'kanban-board': {
    to: 'flow-chart-3d',
    lift(a) {
      const cols = a.columns || [];
      return {
        args: { steps: Math.max(1, cols.length) },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...cols.map((c) => ({ text: c.label + (c.cards && c.cards.length ? ` (${c.cards.length})` : ''), role: 'card', align: 'left' })),
        ],
      };
    },
  },

  'donut-with-center': {
    to: 'circle-segmented-3d',
    lift(a) {
      const segs = a.segments || [];
      return {
        args: { segments: Math.max(2, segs.length), radius: 0.8, innerRatio: 0.55, thickness: 0.2, gapWidth: 0.12 },
        transform: { translate: [0, 1.6, 0], rotate: [1.5708, 0, 0] },
        overlay: [
          { text: String(a.centerValue || ''), anchor: [0, 1.9, 0.6], role: 'value', radius: 0.5 },
          ...(a.centerLabel ? [{ text: String(a.centerLabel), anchor: [0, 1.3, 0.6], role: 'card', align: 'center' }] : []),
          ...rightCards(segs.map((s) => s.label || '')),
        ],
      };
    },
  },

  // ── Sprint 22 B4 twins ──

  'funnel-with-conversion': {
    to: 'funnel-3d',
    lift(a) {
      const stages = a.stages || [];
      const n = stages.length || 4;
      const titleOverlay = a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : [];
      return {
        args: {
          stages: n,
          topRadius: 1.15,
          bottomRadius: 0.28,
          stageHeight: 0.55,
          gap: 0.1,
          colors: shades(HUE_BY_TYPE.funnel, n),
        },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...titleOverlay,
          ...rightCards(
            stages.map((s, i) => {
              const label = s.label || '';
              const conv = i > 0 && stages[i - 1]?.value != null && s.value != null
                ? ` (${((Number(s.value) / Number(stages[i - 1].value)) * 100).toFixed(1)}%)`
                : '';
              return label + conv;
            }),
          ),
        ],
      };
    },
  },

  'pillar-3up': {
    to: 'column-3d',
    lift(a) {
      const pillars = a.pillars || [];
      const n = pillars.length || 3;
      const titleOverlay = a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : [];
      return {
        args: { columns: n, height: 1.8 },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...titleOverlay,
          ...rightCards(pillars.map((p) => p.heading || '')),
        ],
      };
    },
  },

  'testimonial-wall': {
    to: 'matrix-grid-3d',
    lift(a) {
      const testimonials = a.testimonials || [];
      const n = Math.max(2, testimonials.length);
      const titleOverlay = a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : [];
      return {
        args: { rows: 1, cols: n },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...titleOverlay,
          ...rightCards(
            testimonials.map((t) => (t.name || '') + (t.role ? ` · ${t.role}` : '')),
          ),
        ],
      };
    },
  },

  'balance-scale': {
    to: 'venn-3d',
    lift(a) {
      const leftItems = a.leftItems || [];
      const rightItems = a.rightItems || [];
      const titleOverlay = a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : [];
      return {
        args: { sets: 2, overlap: 0.12 },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...titleOverlay,
          ...(a.leftLabel ? [{ text: String(a.leftLabel), anchor: [-2.2, 2.6, 0], role: 'card', align: 'center' }] : []),
          ...(a.rightLabel ? [{ text: String(a.rightLabel), anchor: [2.2, 2.6, 0], role: 'card', align: 'center' }] : []),
          ...leftItems.slice(0, 4).map((item) => ({ text: String(item), role: 'card', align: 'left' })),
          ...rightItems.slice(0, 4).map((item) => ({ text: String(item), role: 'card', align: 'right' })),
          ...(a.verdict ? [{ text: String(a.verdict), anchor: [0, 0.4, 0], role: 'value', align: 'center' }] : []),
        ],
      };
    },
  },

  // ── Sprint 24: close the X-gap — twins for the 20 Sprint 19/20 dead-end atoms ──
  // Each maps to the CLOSEST existing 3D atom so every atom the LLM pipeline can
  // emit has a 3D exit. Invariant enforced by scripts/test-atom-3d-coverage.mjs.

  'quote-pull': {
    to: 'cube-3d',
    lift(a) {
      return {
        args: { size: 1.6 },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...(a.quote ? [{ text: `“${a.quote}”`, anchor: [0, 3.4, 0], role: 'title' }] : []),
          ...(a.author ? [{ text: String(a.author), anchor: [0, 0.4, 0], role: 'value' }] : []),
          ...(a.attribution ? [{ text: String(a.attribution), anchor: [0, -0.2, 0], role: 'card' }] : []),
        ],
      };
    },
  },

  'pull-quote-banner': {
    to: 'cube-3d',
    lift(a) {
      return {
        args: { size: 1.6 },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...(a.quote ? [{ text: `“${a.quote}”`, anchor: [0, 3.4, 0], role: 'title' }] : []),
          ...(a.author ? [{ text: String(a.author), anchor: [0, 0.4, 0], role: 'value' }] : []),
          ...(a.attribution ? [{ text: String(a.attribution), anchor: [0, -0.2, 0], role: 'card' }] : []),
        ],
      };
    },
  },

  swot: {
    to: 'matrix-grid-3d',
    lift(a) {
      const quad = (label, items) => ({
        text: label,
        role: 'card',
        ...(Array.isArray(items) && items.length ? { sublabel: items.slice(0, 4).join(' · ') } : {}),
      });
      return {
        args: { rows: 2, cols: 2 },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          quad('Strengths', a.strengths),
          quad('Weaknesses', a.weaknesses),
          quad('Opportunities', a.opportunities),
          quad('Threats', a.threats),
        ],
      };
    },
  },

  'value-chain-diagram': {
    to: 'flow-chart-3d',
    lift(a) {
      const primary = a.primary || [];
      return {
        args: { steps: Math.max(2, primary.length) },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...rightCards(primary.map((p) => p.label || '')),
          ...(Array.isArray(a.support) && a.support.length
            ? [{ text: a.support.join(' · '), anchor: [0, -0.4, 0], role: 'card' }]
            : []),
          ...(a.outcome ? [{ text: String(a.outcome), anchor: [3.0, 3.2, 0], role: 'value' }] : []),
        ],
      };
    },
  },

  'change-curve-chart': {
    to: 'timeline-3d',
    lift(a) {
      const phases = a.phases || [];
      return {
        args: { count: Math.max(2, phases.length) },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...rightCards(phases.map((p) => p.label || '')),
        ],
      };
    },
  },

  'radial-wheel-segmented': {
    to: 'circle-segmented-3d',
    lift(a) {
      const segments = a.segments || [];
      return {
        args: { count: Math.max(2, segments.length) },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...(a.hub ? [{ text: String(a.hub), anchor: [0, 1.6, 0], role: 'value' }] : []),
          ...rightCards(segments.map((s) => s.label || '')),
        ],
      };
    },
  },

  'section-number-divider': {
    to: 'cube-3d',
    lift(a) {
      return {
        args: { size: 1.8 },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.number ? [{ text: String(a.number), anchor: [0, 3.2, 0], role: 'value' }] : []),
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 0.4, 0], role: 'title' }] : []),
          ...(a.subtitle ? [{ text: String(a.subtitle), anchor: [0, -0.3, 0], role: 'card' }] : []),
        ],
      };
    },
  },

  'stat-banner': {
    to: 'kpi-card-3d',
    lift(a) {
      return {
        args: {},
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.value ? [{ text: String(a.value), anchor: [0, 2.6, 0], role: 'value' }] : []),
          ...(a.label ? [{ text: String(a.label), anchor: [0, 0.6, 0], role: 'card' }] : []),
          ...(a.trend ? [{ text: String(a.trend), anchor: [2.4, 2.6, 0], role: 'card' }] : []),
        ],
      };
    },
  },

  'stat-with-icon': {
    to: 'kpi-card-3d',
    lift(a) {
      return {
        args: {},
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.value ? [{ text: String(a.value), anchor: [0, 2.6, 0], role: 'value' }] : []),
          ...(a.label ? [{ text: String(a.label), anchor: [0, 0.6, 0], role: 'card' }] : []),
          ...(a.sublabel ? [{ text: String(a.sublabel), anchor: [0, 0.0, 0], role: 'card' }] : []),
          ...(a.trend ? [{ text: String(a.trend), anchor: [2.4, 2.6, 0], role: 'card' }] : []),
        ],
      };
    },
  },

  'stat-grid-large': {
    to: 'matrix-grid-3d',
    lift(a) {
      const stats = a.stats || [];
      return {
        args: { rows: 1, cols: Math.max(2, stats.length) },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...stats.map((s) => ({
            text: String(s.value ?? ''),
            role: 'value',
            ...(s.label ? { sublabel: String(s.label) } : {}),
          })),
        ],
      };
    },
  },

  'comparison-table': {
    to: 'matrix-grid-3d',
    lift(a) {
      const columns = a.columns || [];
      const features = a.features || [];
      return {
        args: {
          rows: Math.min(4, Math.max(2, features.length)),
          cols: Math.max(2, columns.length),
        },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...rightCards(columns.map((c) => c.label || '')),
          ...features.slice(0, 5).map((f) => ({ text: String(f.label || ''), role: 'card' })),
        ],
      };
    },
  },

  'process-arrows': {
    to: 'progression-3d',
    lift(a) {
      const steps = a.steps || [];
      return {
        args: { steps: Math.max(2, steps.length) },
        transform: { translate: [-1.0, 0.6, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...rightCards(steps.map((s) => s.label || '')),
        ],
      };
    },
  },

  'number-list': {
    to: 'agenda-list-3d',
    lift(a) {
      const items = a.items || [];
      return {
        args: { count: Math.max(2, items.length) },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...rightCards(items.map((it, i) => `${i + 1}. ${it.label || ''}`)),
        ],
      };
    },
  },

  'numbered-grid': {
    to: 'matrix-grid-3d',
    lift(a) {
      const items = a.items || [];
      const cols = a.cols || (items.length <= 6 ? 3 : 4);
      return {
        args: { rows: Math.max(1, Math.ceil(items.length / cols)), cols },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...items.slice(0, 8).map((it, i) => ({ text: `${i + 1}. ${it.label || ''}`, role: 'card' })),
        ],
      };
    },
  },

  'call-to-action': {
    to: 'cube-3d',
    lift(a) {
      return {
        args: { size: 1.6 },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...(a.heading ? [{ text: String(a.heading).toUpperCase(), anchor: [0, 3.4, 0], role: 'title' }] : []),
          ...(a.subheading ? [{ text: String(a.subheading), anchor: [0, 2.8, 0], role: 'card' }] : []),
          ...(a.buttonText ? [{ text: String(a.buttonText), anchor: [0, 0.4, 0], role: 'value' }] : []),
          ...(a.contact ? [{ text: String(a.contact), anchor: [0, -0.4, 0], role: 'card' }] : []),
        ],
      };
    },
  },

  'vertical-timeline': {
    to: 'timeline-3d',
    lift(a) {
      const events = a.events || [];
      return {
        args: { count: Math.max(2, events.length) },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...rightCards(events.map((e) => (e.date ? `${e.date} — ${e.label || ''}` : e.label || ''))),
        ],
      };
    },
  },

  'circle-process-cycle': {
    to: 'circle-loop-3d',
    lift(a) {
      const steps = a.steps || [];
      return {
        args: { count: Math.max(3, steps.length) },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...(a.centerLabel ? [{ text: String(a.centerLabel), anchor: [0, 1.6, 0], role: 'value' }] : []),
          ...rightCards(steps.map((s) => s.label || '')),
        ],
      };
    },
  },

  'segmented-bar': {
    to: 'circle-segmented-3d',
    lift(a) {
      const segments = a.segments || [];
      return {
        args: { count: Math.max(2, segments.length) },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...rightCards(
            segments.map((s) => (s.value != null ? `${s.label || ''} ${s.value}` : s.label || '')),
          ),
        ],
      };
    },
  },

  'feature-card-grid': {
    to: 'icon-grid-3d',
    lift(a) {
      const features = a.features || [];
      return {
        args: { count: Math.max(2, features.length) },
        transform: { translate: [0, 1.6, 0] },
        overlay: [
          ...(a.title ? [{ text: String(a.title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' }] : []),
          ...rightCards(features.map((f) => f.title || '')),
        ],
      };
    },
  },

  'callout-banner': {
    to: 'cube-3d',
    lift(a) {
      return {
        args: { size: 1.5 },
        transform: { translate: [0, 1.5, 0] },
        overlay: [
          ...(a.heading ? [{ text: String(a.heading).toUpperCase(), anchor: [0, 3.4, 0], role: 'title' }] : []),
          ...(a.body ? [{ text: String(a.body), anchor: [0, 0.4, 0], role: 'card' }] : []),
        ],
      };
    },
  },
};

// resolve the 3D twin type for a 2D atom type (override or `${type}-3d` rule)
export function twinTypeOf(type2d) {
  return TWIN_MAP[type2d]?.to ?? `${type2d}-3d`;
}

// lift a single 2D subject → { subject3d, overlay[] }
export function liftSubject(subject) {
  const type2d = subject.type;
  const a = subject.args || {};
  const twin = TWIN_MAP[type2d];
  let r;
  if (twin?.lift) {
    r = twin.lift(a);
  } else {
    // generic fallback: type→type-3d, pass args through best-effort
    r = { args: { ...a }, transform: { translate: [0, 1.5, 0] }, overlay: [] };
  }
  const subject3d = {
    id: subject.id || type2d,
    type: twinTypeOf(type2d),
    args: r.args || {},
    transform: r.transform || { translate: [0, 1.5, 0] },
    material: materialFor(type2d),
  };
  return { subject3d, overlay: r.overlay || [] };
}

// lift a whole 2D SceneData → 3D studio SceneData (compile-ready)
export function liftSceneData2dTo3d(scene2d) {
  const subjects = [];
  const overlay = [];
  let title = scene2d.title || null;

  for (const s of scene2d.subjects || []) {
    const { subject3d, overlay: ov } = liftSubject(s);
    subjects.push(subject3d);
    overlay.push(...ov);
    if (s.args && s.args.title) title = s.args.title; // atoms carry title in args
  }

  if (title)
    overlay.unshift({ text: String(title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' });

  // cover slide (deck opener): tagline subtitle under the title + an establishing camera
  if (scene2d.cover && scene2d.subtitle) {
    overlay.push({ text: String(scene2d.subtitle), anchor: [0, 3.35, 0], role: 'body', align: 'center' });
  }

  const target = [0, 1.6, 0];
  const primaryType = scene2d.subjects?.[0]?.type;
  return {
    v: 1,
    name: `(lifted) ${scene2d.name || scene2d.subjects?.[0]?.type || 'scene'}`,
    subjects,
    overlay,
    cameraSequence: scene2d.cover ? coverCamera(target) : cameraFor(primaryType, target),
    defaults: { stage: { size: [18, 9, 11] } },
  };
}
