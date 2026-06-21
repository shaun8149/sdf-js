// =============================================================================
// chart-labels.js — SDF data-label placement + expansion for chart atoms.
// -----------------------------------------------------------------------------
// The #84 convention: a chart subject carries parallel arrays in its args —
// args.values + args.labels (e.g. bar-3d {values:[...], labels:['$1.2M',...]}).
// The 3D chart atoms render geometry from `values` but ignore `labels`. This
// module turns those labels into camera-facing text-3d-pipe subjects positioned
// on the rendered elements (anchors mirror each atom's own layout math).
//
// expandChartLabels(sceneData) is a deterministic SceneData→SceneData transform
// run at scene load (alongside expandVariants): it closes the loop from
// "2D real data (values+labels)" → "3D labelled chart" with no manual placement.
//
// Studio camera faces −z; labels need no rotate (rotating a pipe-glyph mirrors
// it). Budget: each short label ≈ +2k GLSL chars; loop atoms now render fine
// (see sdf3.compile.js unroll), so SDF labels co-exist with bar/line/column/pie.
// =============================================================================

const LABEL_MAT = { hue: 0, sat: 0, value: 1, metal: 0, glow: 0.28 };

// bar-3d: bars along +X, grow up. anchor = above each bar's top, on the −z front.
export function barAnchors(
  values,
  { barWidth = 0.4, barDepth = 0.4, gap = 0.1, maxHeight = 2.0, margin = 0.18 } = {},
) {
  const N = values.length;
  const totalX = N * barWidth + (N - 1) * gap;
  const xStart = -totalX / 2 + barWidth / 2;
  return values.map((v, i) => ({
    x: xStart + i * (barWidth + gap),
    y: v * maxHeight + margin,
    z: -barDepth / 2 - 0.1,
  }));
}

// line-3d: points along +X at value heights. anchor = above each point.
export function lineAnchors(values, { pointSpacing = 0.5, maxHeight = 2.0, margin = 0.22 } = {}) {
  const N = values.length;
  const xStart = -((N - 1) * pointSpacing) / 2;
  return values.map((v, i) => ({
    x: xStart + i * pointSpacing,
    y: v * maxHeight + margin,
    z: -0.12,
  }));
}

// column-3d: horizontal bars stacked along Y, grow along +X. anchor = beyond each bar's end.
export function columnAnchors(
  values,
  { barWidth = 0.4, barDepth = 0.4, gap = 0.1, maxHeight = 2.0, margin = 0.32 } = {},
) {
  const N = values.length;
  const totalY = N * barWidth + (N - 1) * gap;
  const yStart = -totalY / 2 + barWidth / 2;
  return values.map((v, i) => ({
    x: v * maxHeight + margin,
    y: yStart + i * (barWidth + gap),
    z: -barDepth / 2 - 0.1,
  }));
}

// pie-3d (standing, facing −z): anchor at each slice's mid-angle, just outside
// the rim. startAngle/clockwise match the atom defaults (12 o'clock, CW).
export function pieAnchors(
  values,
  {
    outerRadius = 1.0,
    thickness = 0.3,
    startAngle = Math.PI / 2,
    clockwise = true,
    margin = 0.35,
  } = {},
) {
  const sum = values.reduce((a, b) => a + (b > 0 ? b : 0), 0) || 1;
  const R = outerRadius + margin;
  const dir = clockwise ? -1 : 1;
  let cum = 0;
  return values.map((v) => {
    const frac = Math.max(0, v) / sum;
    const mid = cum + frac / 2;
    cum += frac;
    const ang = startAngle + dir * mid * 2 * Math.PI;
    return { x: R * Math.cos(ang), y: R * Math.sin(ang), z: -thickness / 2 - 0.1 };
  });
}

// sphere-fill-3d: row of spheres along +X (labels parallel to `levels`). anchor
// = just in front of each sphere's front face (−z), centred at sphere height.
export function sphereFillAnchors({
  levels = [],
  count,
  radius = 0.6,
  spacing = 0.3,
  margin = 0.1,
} = {}) {
  const N = count != null ? Math.floor(count) : levels.length;
  const stride = 2 * radius + spacing;
  const offset = ((N - 1) / 2) * stride;
  return Array.from({ length: N }, (_, i) => ({
    x: i * stride - offset,
    y: 0,
    z: -(radius + margin),
  }));
}

// matrix-grid-3d: R×C card grid, ROW-MAJOR with row 0 on TOP (matches the atom:
// y = (R-1-r)*strideY - offY). labels[] is a flat row-major array (len R*C).
export function matrixAnchors({
  rows = 2,
  cols = 2,
  cardW = 0.9,
  cardH = 0.7,
  cardD = 0.18,
  gap = 0.18,
  margin = 0.04,
} = {}) {
  const R = Math.max(1, Math.min(6, Math.floor(rows)));
  const C = Math.max(1, Math.min(6, Math.floor(cols)));
  const strideX = cardW + gap;
  const strideY = cardH + gap;
  const offX = ((C - 1) / 2) * strideX;
  const offY = ((R - 1) / 2) * strideY;
  const out = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      out.push({
        x: c * strideX - offX,
        y: (R - 1 - r) * strideY - offY,
        z: -(cardD / 2 + margin),
      });
    }
  }
  return out;
}

export const ANCHOR_FOR = {
  'bar-3d': barAnchors,
  'line-3d': lineAnchors,
  'column-3d': columnAnchors,
  'pie-3d': pieAnchors,
};

// internal: type → (args) → anchor list. Unifies the values-array family
// (bar/line/column/pie read args.values) with the shape-specific atoms
// (sphere-fill reads args.levels; matrix-grid reads rows×cols).
const ANCHORS_FROM_ARGS = {
  'bar-3d': (a) => barAnchors(a.values || [], a),
  'line-3d': (a) => lineAnchors(a.values || [], a),
  'column-3d': (a) => columnAnchors(a.values || [], a),
  'pie-3d': (a) => pieAnchors(a.values || [], a),
  'sphere-fill-3d': (a) => sphereFillAnchors(a),
  'matrix-grid-3d': (a) => matrixAnchors(a),
};

// turn anchors + label strings into camera-facing text-3d-pipe subjects.
export function placeLabels(
  anchors,
  labels,
  {
    height = 0.3,
    pipeRadius = 0.05,
    material = LABEL_MAT,
    idPrefix = 'lbl',
    align = 'center',
  } = {},
) {
  return anchors.map((a, i) => ({
    id: `${idPrefix}${i}`,
    type: 'text-3d-pipe',
    args: { text: String(labels[i] ?? ''), height, pipeRadius, align },
    transform: { translate: [a.x, a.y, a.z] },
    material,
  }));
}

// Deterministic SceneData→SceneData: for every chart subject carrying
// args.labels (parallel to args.values), append text-3d-pipe label subjects
// anchored on its elements (offset by the subject's own translate). No-op when
// no chart subject has labels, so it is safe to run on every scene.
export function expandChartLabels(sceneData) {
  if (!sceneData || !Array.isArray(sceneData.subjects)) return sceneData;
  const extra = [];
  sceneData.subjects.forEach((s, si) => {
    const fn = ANCHORS_FROM_ARGS[s && s.type];
    const args = s && s.args;
    const labels = args && Array.isArray(args.labels) ? args.labels : null;
    if (!fn || !labels || !labels.length) return;
    const anchors = fn(args);
    if (!anchors || !anchors.length) return;
    const tr = (s.transform && s.transform.translate) || [0, 0, 0];
    const off = anchors.map((a) => ({ x: a.x + tr[0], y: a.y + tr[1], z: a.z + tr[2] }));
    // only label the elements that actually have a label string
    const n = Math.min(off.length, labels.length);
    extra.push(
      ...placeLabels(off.slice(0, n), labels.slice(0, n), { idPrefix: `lbl_${s.id ?? si}_` }),
    );
  });
  if (!extra.length) return sceneData;
  return { ...sceneData, subjects: [...sceneData.subjects, ...extra] };
}
