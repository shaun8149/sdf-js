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
  hue: 0.57, sat: 0.55, value: 0.64, kind: 'normal', roughness: 0.3, clearcoat: 0.45,
};

// ── camera: gentle push-in (matches the hand-authored shape twins) ──
export function pushInCamera(target = [0, 1.6, 0], dist = 8.2) {
  return {
    loop: false,
    shots: [
      { duration: 0.01, pos: [1.0, target[1] + 0.5, dist + 1.6], target, fov: 50, aperture: 0, focalDistance: dist, ease: 'smooth' },
      { duration: 13, pos: [0, target[1] + 0.2, dist], target, fov: 46, transition: 'blend', aperture: 0, focalDistance: dist, ease: 'smooth' },
    ],
  };
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
  const x = opts.x ?? 3.0, top = opts.top ?? 2.6, gap = opts.gap ?? 0.72;
  return labels.filter((t) => t != null && t !== '').map((t, i) => ({
    text: String(t), anchor: [x, top - i * gap, 0], role: 'card', align: 'left',
  }));
}

// ── TWIN_MAP: only types that need an arg transform or non-default twin name ──
// Each entry: { to: '<3d type>', lift(args2d) → { args, transform?, overlay? } }
export const TWIN_MAP = {
  funnel: {
    to: 'funnel-3d',
    lift(a) {
      const st = Array.isArray(a.stages) ? a.stages : [];
      return {
        args: { stages: st.length || 4, topRadius: 1.15, bottomRadius: 0.28, stageHeight: 0.55, gap: 0.1 },
        transform: { translate: [-0.3, 1.6, 0], rotate: [0.12, 0, 0] },
        overlay: rightCards(st.map((s) => (s.value != null ? `${s.label} ${fmt(s.value, a.format)}` : s.label))),
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
      const barWidth = 0.55, gap = 0.25, maxHeight = 2.2, ty = 0.15;
      const step = barWidth + gap;
      const x0 = -((raw.length * barWidth + (raw.length - 1) * gap) / 2) + barWidth / 2;
      const overlay = raw.map((x, i) => ({
        text: fmt(x, a.format),
        anchor: [x0 + i * step, ty + norm[i] * maxHeight + 0.25, 0.3],
        role: 'value', radius: 0.32,
      }));
      return { args: { values: norm, barWidth, barDepth: 0.55, gap, maxHeight }, transform: { translate: [0, ty, 0] }, overlay };
    },
  },

  column: {
    to: 'column-3d',
    lift(a) {
      const raw = (a.values || []).map(Number);
      const mx = Math.max(...raw, 1);
      const norm = raw.map((x) => (x / mx) * 0.9 + 0.1);
      return { args: { values: norm, barWidth: 0.4, barDepth: 0.4, gap: 0.1, maxHeight: 2.0 }, transform: { translate: [0, 0.2, 0] } };
    },
  },

  line: {
    to: 'line-3d',
    lift(a) {
      const raw = (a.values || []).map(Number);
      const mx = Math.max(...raw, 1);
      const norm = raw.map((x) => (x / mx) * 0.9 + 0.1);
      return { args: { values: norm, pointSpacing: 0.7, pointRadius: 0.11, lineThickness: 0.06, maxHeight: 2.0 }, transform: { translate: [0, 0.25, 0] } };
    },
  },

  funnel_legacy: undefined, // placeholder slot — keeps diffs stable if reordered

  gauge: {
    to: 'sphere-fill-3d',
    lift(a) {
      const max = a.max ?? 100, min = a.min ?? 0;
      const frac = Math.max(0, Math.min(1, ((Number(a.value) || 0) - min) / (max - min || 1)));
      return {
        args: { levels: [frac], radius: 1.1 },
        transform: { translate: [0, 1.4, 0] },
        overlay: [{ text: fmt(a.value, a.format), anchor: [0, 1.4, 1.2], role: 'value', radius: 0.6 }],
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
        role: 'value', radius: 0.34,
      }));
      return { args: { count: n, axisLength: 4.2, axisRadius: 0.06, markerRadius: 0.2, stemHeight: 0.55 }, transform: { translate: [0, 1.4, 0] }, overlay };
    },
  },

  'layer-stack': {
    to: 'layer-stack-3d',
    lift(a) {
      const ly = Array.isArray(a.layers) ? a.layers : [];
      const n = ly.length || 4;
      return {
        args: { layers: n, layerW: 2.4, layerD: 1.5, layerH: 0.28, gap: 0.45, taper: a.taper ?? 1.0 },
        transform: { translate: [-0.3, 1.4, 0], rotate: [0.35, 0.5, 0] },
        overlay: rightCards(ly.map((l) => (typeof l === 'string' ? l : l.label))),
      };
    },
  },

  'circle-segmented': {
    to: 'circle-segmented-3d',
    lift(a) {
      const segs = Array.isArray(a.segments) ? a.segments.length : (a.segments || 6);
      return {
        args: { segments: segs, radius: 0.8, innerRatio: a.innerRatio ?? 0.55, thickness: 0.2, gapWidth: 0.12 },
        transform: { translate: [0, 1.6, 0], rotate: [1.5708, 0, 0] },
        overlay: rightCards((a.labels || [])),
      };
    },
  },
};

delete TWIN_MAP.funnel_legacy;

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
    material: { ...DEFAULT_MAT },
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

  if (title) overlay.unshift({ text: String(title).toUpperCase(), anchor: [0, 3.9, 0], role: 'title' });

  const target = [0, 1.6, 0];
  return {
    v: 1,
    name: `(lifted) ${scene2d.name || scene2d.subjects?.[0]?.type || 'scene'}`,
    subjects,
    overlay,
    cameraSequence: pushInCamera(target),
    defaults: { stage: { size: [18, 9, 11] } },
  };
}
