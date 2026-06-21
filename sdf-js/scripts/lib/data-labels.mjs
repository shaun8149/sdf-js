// =============================================================================
// data-labels.mjs — SDF data-label PLACEMENT for chart atoms (the in-scene half
// of the two-text-systems split; narrative text rides the overlay caption).
// Each anchor function mirrors the corresponding chart atom's own layout math
// so labels land exactly on the rendered elements. Labels face the −z camera
// (no rotate — rotating a pipe-glyph mirrors it).
//
// Budget (measured): each short label ≈ +2k GLSL chars; ≤~10 short labels/chart
// is GPU-safe. Long labels / stacking onto heavy loop-atoms → re-measure.
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

// pie-3d (standing, unrotated, facing −z): anchor at each slice's mid-angle, just
// outside the rim. startAngle/clockwise match the atom defaults (12 o'clock, CW).
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

// turn anchors + label strings into text-3d-pipe subjects (camera-facing).
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

export const ANCHORS = {
  bar: barAnchors,
  line: lineAnchors,
  column: columnAnchors,
  pie: pieAnchors,
};
