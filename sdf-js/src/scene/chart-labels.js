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

export const ANCHOR_FOR = {
  'bar-3d': barAnchors,
  'line-3d': lineAnchors,
  'column-3d': columnAnchors,
  'pie-3d': pieAnchors,
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
    const fn = ANCHOR_FOR[s && s.type];
    const args = s && s.args;
    const labels = args && Array.isArray(args.labels) ? args.labels : null;
    const values = args && Array.isArray(args.values) ? args.values : null;
    if (!fn || !labels || !labels.length || !values || !values.length) return;
    const tr = (s.transform && s.transform.translate) || [0, 0, 0];
    const off = fn(values, args).map((a) => ({ x: a.x + tr[0], y: a.y + tr[1], z: a.z + tr[2] }));
    // only label the elements that actually have a label string
    const n = Math.min(off.length, labels.length);
    extra.push(
      ...placeLabels(off.slice(0, n), labels.slice(0, n), { idPrefix: `lbl_${s.id ?? si}_` }),
    );
  });
  if (!extra.length) return sceneData;
  return { ...sceneData, subjects: [...sceneData.subjects, ...extra] };
}
