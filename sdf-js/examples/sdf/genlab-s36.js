import {
  circle,
  ellipse,
  segment,
  polygon,
  union,
  intersection,
  difference,
  dilate,
  render,
} from '../../src/index.js';

// ── Palette ────────────────────────────────────────────────────────────
const SKY_TOP = [138, 176, 202];
const SKY_BOTTOM = [238, 214, 180];
const SUN_HALO = [252, 236, 202];
const SUN_C = [255, 248, 226];
const FAR_DUNE = [223, 199, 176];
const MID_DUNE = [236, 199, 152];
const LIT_SAND = [246, 191, 112];
const RIPPLE_C = [252, 214, 150];
const CREST_RIM = [255, 234, 176];
const SHADOW = [120, 79, 84];
const SHADOW_DEEP = [95, 60, 70];
const FIGURE = [46, 30, 32];

// ── The one S-curve: crest of the great dune ───────────────────────────
// Rises from the lower-left, snakes over a high crest at x ≈ 0.35,
// then eases away to the right. This single line is the value divider.
const ridgeY = (x) => 0.08 + 0.3 * Math.sin(1.9 * x + 0.9) + 0.08 * x;

// Secondary curves for atmospheric depth (all monotone, low contrast)
const farY = (x) => 0.63 + 0.045 * Math.sin(2.6 * x + 1.2);
const midY = (x) => 0.54 + 0.06 * Math.sin(1.5 * x - 0.6);
const litY = (x) => 0.45 + 0.06 * Math.sin(2.1 * x + 2.0);
const deepY = (x) => -0.6 + 0.12 * Math.sin(1.6 * x + 2.4);

// ── Helper: fill everything BELOW a curve y = f(x) ─────────────────────
function below(f, samples = 20, x0 = -1.6, x1 = 1.6, floor = -1.8) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const x = x0 + (x1 - x0) * (i / samples);
    pts.push([x, f(x)]);
  }
  pts.push([x1, floor], [x0, floor]);
  return polygon(pts);
}

// ── Landscape masses (back to front) ───────────────────────────────────
const farDunes = below(farY, 18);
const midDunes = below(midY, 18);
const litSand = below(litY, 18);
const shadowMass = below(ridgeY, 30);
const deepShadow = below(deepY, 18);

// Razor-thin catch-light riding the top edge of the ridge
const crestRim = difference(
  below((x) => ridgeY(x) + 0.012, 30),
  shadowMass,
);

// ── Wind ripples on the sunlit windward slope ──────────────────────────
// Each is a crescent: an ellipse minus itself nudged down → top arc only.
const ripple = (rx, ry, cx, cy, t) =>
  difference(ellipse(rx, ry, [cx, cy]), ellipse(rx, ry, [cx, cy - t]));

const ripples = difference(
  union(
    ripple(1.1, 0.6, -0.55, -0.28, 0.011),
    ripple(0.95, 0.5, -0.68, -0.37, 0.009),
    ripple(1.35, 0.78, -0.3, -0.52, 0.01),
  ),
  shadowMass,
);

// ── Sun ────────────────────────────────────────────────────────────────
const sun = circle(0.105, [0.76, 0.82]);
const sunHalo = dilate(sun, 0.075);

// ── Caravan ────────────────────────────────────────────────────────────
function camel(cx, groundY, s = 1) {
  const legTop = groundY + 0.034 * s;
  const legs = union(
    segment([cx - 0.03 * s, groundY], [cx - 0.026 * s, legTop], 0.005 * s),
    segment([cx - 0.013 * s, groundY], [cx - 0.016 * s, legTop], 0.005 * s),
    segment([cx + 0.015 * s, groundY], [cx + 0.013 * s, legTop], 0.005 * s),
    segment([cx + 0.031 * s, groundY], [cx + 0.026 * s, legTop], 0.005 * s),
  );
  const body = ellipse(0.042 * s, 0.019 * s, [cx, groundY + 0.048 * s]);
  const hump = circle(0.021 * s, [cx - 0.004 * s, groundY + 0.062 * s]);
  const neck = segment(
    [cx + 0.029 * s, groundY + 0.05 * s],
    [cx + 0.05 * s, groundY + 0.096 * s],
    0.007 * s,
  );
  const head = ellipse(0.015 * s, 0.009 * s, [cx + 0.059 * s, groundY + 0.1 * s]);
  const tail = segment(
    [cx - 0.04 * s, groundY + 0.05 * s],
    [cx - 0.053 * s, groundY + 0.026 * s],
    0.0035 * s,
  );
  return union(legs, body, hump, neck, head, tail, { k: 0.006 * s });
}

function rider(cx, groundY, s = 1) {
  return union(
    segment([cx - 0.004 * s, groundY + 0.07 * s], [cx - 0.002 * s, groundY + 0.098 * s], 0.008 * s),
    circle(0.009 * s, [cx - 0.001 * s, groundY + 0.108 * s]),
    { k: 0.005 * s },
  );
}

function walker(cx, groundY, s = 1) {
  return union(
    segment([cx - 0.01 * s, groundY], [cx + 0.002 * s, groundY + 0.024 * s], 0.0045 * s),
    segment([cx + 0.011 * s, groundY], [cx + 0.002 * s, groundY + 0.024 * s], 0.0045 * s),
    segment([cx + 0.001 * s, groundY + 0.018 * s], [cx, groundY + 0.046 * s], 0.01 * s),
    circle(0.0085 * s, [cx, groundY + 0.056 * s]),
    { k: 0.005 * s },
  );
}

const S = 0.85;
const onCrest = (x) => ridgeY(x) - 0.006;

const caravan = union(
  walker(0.68, onCrest(0.68), S),
  camel(0.5, onCrest(0.5), S),
  rider(0.5, onCrest(0.5), S),
  camel(0.28, onCrest(0.28), S),
  camel(0.07, onCrest(0.07), S),
  camel(-0.14, onCrest(-0.14), S * 0.96),
  rider(-0.14, onCrest(-0.14), S * 0.96),
  camel(-0.35, onCrest(-0.35), S * 0.92),
);

// ── Layers ─────────────────────────────────────────────────────────────
const layers = [
  { sdf: sunHalo, color: SUN_HALO },
  { sdf: sun, color: SUN_C },
  { sdf: farDunes, color: FAR_DUNE },
  { sdf: midDunes, color: MID_DUNE },
  { sdf: litSand, color: LIT_SAND },
  { sdf: ripples, color: RIPPLE_C },
  { sdf: shadowMass, color: SHADOW },
  { sdf: deepShadow, color: SHADOW_DEEP },
  { sdf: crestRim, color: CREST_RIM },
  { sdf: caravan, color: FIGURE },
];

// ── Render ─────────────────────────────────────────────────────────────
// —— painted 展示接线 (scene 36) ——
export const getSdfs = () => layers.map((l) => l.sdf);
