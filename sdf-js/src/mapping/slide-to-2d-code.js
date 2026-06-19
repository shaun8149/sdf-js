// =============================================================================
// slide-to-2d-code.js — SlideData → runnable 2D SDF JS code (for compositor + lift)
// -----------------------------------------------------------------------------
// Replaces the deprecated direct-to-3D mapper (slide-to-scene.js, deleted
// 2026-06-19). New architecture:
//
//   PDF → SlideData (M0.3 parser)
//        → { prompt, code2d } (this file — deterministic emitter)
//        → callLiftLLM(prompt, code2d) (existing compositor pipeline)
//        → SceneData v1 (3D)
//        → renderLiftedSceneData() → 8 swappable renderers
//
// The emitter produces 2D code in the canonical format consumed by the
// compositor's silhouette/BOB/Crayon renderers AND by the lift v3.15 system
// prompt: imports from '../../src/index.js', builds a `layers = [{sdf, color}]`
// array, calls `render.silhouette(ctx, layers, opts)`. text2dSDF (Wave 1
// typography) is also imported when a slide carries numeric labels.
//
// Pattern detection is the same as the v1 mapper (percent-list, cover,
// fallback) plus a new kpi-feature detector for the "single big number"
// slides (test-deck 3, 4, 12, 14). All patterns include a semantic hint
// comment at the top of code2d so the lift LLM knows this is a presentation
// context and should favor regular geometric shapes / axis-aligned layouts.
// =============================================================================

// ---- Pattern detectors (carried over from deleted slide-to-scene.js) --------

/** Look for ≥3 numeric labels (with optional %) that look like percentages 0-100. */
function detectPercentList(slide) {
  const NUMERIC_PERCENT = /^(\d+)%?$/;
  const candidates = slide.body
    .map((b) => {
      const m = NUMERIC_PERCENT.exec(b.text.trim());
      return m ? { value: parseInt(m[1], 10), bbox: b.bbox, fontSize: b.fontSize } : null;
    })
    .filter((c) => c !== null);

  if (candidates.length < 3) return null;
  const inRange = candidates.filter((n) => n.value >= 0 && n.value <= 100);
  if (inRange.length / candidates.length < 0.7) return null;

  // Font-size cluster: drop items dramatically smaller (axis ticks / chrome)
  // only when gap is ≥3× — otherwise legitimate size-encoded data gets kept.
  const fontSizes = inRange.map((n) => n.fontSize || 0).filter((fs) => fs > 0);
  const maxFs = fontSizes.length ? Math.max(...fontSizes) : 0;
  const minFs = fontSizes.length ? Math.min(...fontSizes) : 0;
  const dataItems =
    maxFs > 0 && maxFs / Math.max(minFs, 0.01) >= 3.0
      ? inRange.filter((n) => (n.fontSize || 0) >= maxFs / 3.0)
      : inRange;
  if (dataItems.length < 3) return null;

  const sorted = [...dataItems].sort((a, b) => {
    const dy = a.bbox.y - b.bbox.y;
    if (Math.abs(dy) > 30) return dy;
    return a.bbox.x - b.bbox.x;
  });
  const values = sorted.map((n) => n.value / 100);
  return { values, confidence: Math.min(1, dataItems.length / 4) };
}

/** Single dominant percentage label (the "90%" / "100%" KPI slides). */
function detectKpiFeature(slide) {
  const NUMERIC_PERCENT = /^(\d+)%?$/;
  const candidates = slide.body
    .map((b) => {
      const m = NUMERIC_PERCENT.exec(b.text.trim());
      return m ? { value: parseInt(m[1], 10), bbox: b.bbox, fontSize: b.fontSize } : null;
    })
    .filter((c) => c !== null && c.value >= 0 && c.value <= 100);

  if (candidates.length === 0) return null;
  // Largest font-size candidate is "the" KPI value
  const top = candidates.reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
  // Confidence high if exactly one numeric candidate, or if the top is much
  // bigger than the rest. Reject if multiple numbers at similar large size
  // (that's a percent-list).
  const dominant =
    candidates.length === 1 || top.fontSize / candidates[1]?.fontSize > 1.5 ? top : null;
  if (!dominant) return null;
  return { value: dominant.value / 100, label: `${dominant.value}%`, confidence: 0.7 };
}

function detectCover(slide) {
  if (!slide.title) return null;
  const titleAtTop = slide.body.length <= 3;
  const isCoverLayout =
    slide.layout === 'cover' || slide.layout === 'title-only' || slide.layout === 'title-content';
  const confidence = titleAtTop && isCoverLayout ? 0.8 : 0.3;
  return {
    title: slide.title,
    subtitle: slide.body.find((b) => b.fontSize < 30)?.text ?? '',
    confidence,
  };
}

// ---- Emitter helpers --------------------------------------------------------

const COMMON_IMPORTS = `import {
  circle, ellipse, rectangle, rounded_rectangle, segment, ring,
  union, difference, dilate, render,
} from '../../src/index.js';
import { text2dSDF } from '../../src/scene/components/typography/text-3d.js';`;

const COMMON_PALETTE = `const BG_TOP    = [248, 250, 254];
const BG_BOT    = [218, 228, 240];
const ACCENT    = [42, 96, 178];
const ACCENT_2  = [232, 124, 64];
const INK       = [28, 36, 52];
const SOFT_INK  = [120, 130, 148];`;

const HEADER = (
  slidePattern,
  slideIdx,
  title,
) => `// =============================================================================
// Atlas presentation demo — slide ${slideIdx}: "${title}"
// Pattern detected: ${slidePattern}
//
// SEMANTIC HINT for lift: this is a PRESENTATION SCENE — favor regular
// geometric shapes (axis-aligned bars/columns/spheres), clean palette, a
// stage / pedestal below the data, camera tilted slightly above. Avoid
// organic / naturalistic interpretations.
// =============================================================================`;

const RENDER_TAIL = `const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
render.silhouette(ctx, layers, {
  view: 1.4,
  background: { top: BG_TOP, bottom: BG_BOT },
});`;

// ---- Pattern → code2d emitters ----------------------------------------------

function emitPercentListCode(slide, p) {
  const N = p.values.length;
  // Lay values along a horizontal row at y=0.0, span x ∈ [-0.9, +0.9]
  const xs = N === 1 ? [0] : Array.from({ length: N }, (_, i) => -0.9 + (1.8 * i) / (N - 1));
  // Use FILLED RECTANGLES as bars — height encodes value, baseline at y=-0.5
  const barLines = p.values
    .map((v, i) => {
      const x = xs[i].toFixed(3);
      const h = (v * 0.9).toFixed(3); // max bar height = 0.9 units
      const yc = (-0.5 + v * 0.45).toFixed(3); // center so bottom sits at y=-0.5
      const halfW = Math.min(0.07, 1.4 / (N * 2.2)).toFixed(3);
      return `  rectangle([${halfW} * 2, ${h}], [${x}, ${yc}]),`;
    })
    .join('\n');
  // Numeric labels above each bar
  const labelLines = p.values
    .map((v, i) => {
      const x = xs[i].toFixed(3);
      const y = (-0.5 + v * 0.9 + 0.06).toFixed(3);
      return `  text2dSDF({ text: '${Math.round(v * 100)}%', height: 0.08, strokeWidth: 0.014 }).translate([${x}, ${y}]),`;
    })
    .join('\n');
  // Title (if present and contains letters)
  const titleLine = slide.title
    ? `text2dSDF({ text: '${escapeStr(slide.title)}', height: 0.13, strokeWidth: 0.018 }).translate([0, 0.7])`
    : null;
  // Stage line below bars
  const stage = `rectangle([1.95, 0.02], [0, -0.52])`;

  const code = `${HEADER('percent-list', slide.index, slide.title || '(untitled)')}
${COMMON_IMPORTS}

${COMMON_PALETTE}

// ${N} percentage data points: ${p.values.map((v) => Math.round(v * 100) + '%').join(', ')}
const bars = union(
${barLines}
);

const labels = union(
${labelLines}
);

const stage = ${stage};
${titleLine ? `const title = ${titleLine};` : ''}

const layers = [
  { sdf: stage,  color: SOFT_INK },
  { sdf: bars,   color: ACCENT },
  { sdf: labels, color: INK },
${titleLine ? '  { sdf: title,  color: INK },' : ''}
];

${RENDER_TAIL}
`;

  const prompt = `Presentation slide ${slide.index}: "${slide.title || '(untitled)'}". A chart of ${N} percentage values (${p.values.map((v) => Math.round(v * 100) + '%').join(', ')}). Geometric, axis-aligned. In 3D, lift to a clean bar/column chart on a stage with the title floating above — corporate keynote aesthetic, not naturalistic.`;
  return { prompt, code2d: code, pattern: 'percent-list', confidence: p.confidence };
}

function emitKpiFeatureCode(slide, k) {
  const titleLine = slide.title
    ? `text2dSDF({ text: '${escapeStr(slide.title)}', height: 0.12, strokeWidth: 0.018 }).translate([0, 0.72])`
    : null;
  // Pick a short caption from body items that aren't the headline number
  const caption =
    slide.body.find((b) => /[A-Za-z一-龥]{4,}/.test(b.text) && b.fontSize < 20)?.text || '';
  const code = `${HEADER('kpi-feature', slide.index, slide.title || '(untitled)')}
${COMMON_IMPORTS}

${COMMON_PALETTE}

// Single dominant KPI value: ${k.label}
const bigValue = text2dSDF({ text: '${k.label}', height: 0.7, strokeWidth: 0.08, align: 'center' })
  .translate([0, 0.05]);

const pedestal = rounded_rectangle([1.6, 0.06], 0.03, [0, -0.45]);
${titleLine ? `const title = ${titleLine};` : ''}
${caption ? `const caption = text2dSDF({ text: '${escapeStr(caption.slice(0, 40))}', height: 0.07, strokeWidth: 0.012 }).translate([0, -0.62]);` : ''}

const layers = [
  { sdf: pedestal, color: SOFT_INK },
  { sdf: bigValue, color: ACCENT },
${titleLine ? '  { sdf: title,    color: INK },' : ''}
${caption ? '  { sdf: caption,  color: SOFT_INK },' : ''}
];

${RENDER_TAIL}
`;
  const prompt = `Presentation slide ${slide.index}: "${slide.title || '(untitled)'}". A single hero KPI value of ${k.label}. Lift to a 3D scene where the number itself is the monumental subject — extruded text on a pedestal, dramatic single-light cinematic feel, title hovering above. Keynote / TED-stage aesthetic.`;
  return { prompt, code2d: code, pattern: 'kpi-feature', confidence: k.confidence };
}

function emitCoverCode(slide, c) {
  const code = `${HEADER('cover', slide.index, c.title)}
${COMMON_IMPORTS}

${COMMON_PALETTE}

const title    = text2dSDF({ text: '${escapeStr(c.title)}', height: 0.22, strokeWidth: 0.028 }).translate([0, 0.18]);
${c.subtitle ? `const subtitle = text2dSDF({ text: '${escapeStr(c.subtitle.slice(0, 60))}', height: 0.08, strokeWidth: 0.012 }).translate([0, -0.10]);` : ''}
const underline = rectangle([0.6, 0.02], [0, -0.30]);

const layers = [
  { sdf: title,    color: INK },
${c.subtitle ? '  { sdf: subtitle, color: SOFT_INK },' : ''}
  { sdf: underline, color: ACCENT },
];

${RENDER_TAIL}
`;
  const prompt = `Presentation slide ${slide.index}: COVER. Title "${c.title}"${c.subtitle ? `, subtitle "${c.subtitle}"` : ''}. Lift to a 3D cover stage with the title as monumental extruded text, soft backdrop wall, subtle floor reflection. Cinematic opening shot — slow dolly-in feel.`;
  return { prompt, code2d: code, pattern: 'cover', confidence: c.confidence };
}

function emitFallbackCode(slide) {
  const title = slide.title || '(untitled)';
  const code = `${HEADER('fallback', slide.index, title)}
${COMMON_IMPORTS}

${COMMON_PALETTE}

const title = text2dSDF({ text: '${escapeStr(title)}', height: 0.16, strokeWidth: 0.022 }).translate([0, 0.0]);

const layers = [
  { sdf: title, color: INK },
];

${RENDER_TAIL}
`;
  const prompt = `Presentation slide ${slide.index}: text-only slide with title "${title}". Lift to a minimal 3D scene with the title as the only subject on a clean stage.`;
  return { prompt, code2d: code, pattern: 'fallback', confidence: 0 };
}

// ---- Helpers ----------------------------------------------------------------

function escapeStr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ---- Public entry -----------------------------------------------------------

/**
 * Map a SlideData → { prompt, code2d, pattern, confidence }. The output feeds
 * directly into the compositor's silhouette renderer (for 2D preview) AND
 * callLiftLLM(prompt, code2d) (for 3D lift via existing v3.15 system prompt).
 *
 * Detection priority: percent-list > kpi-feature > cover > fallback. Detectors
 * with confidence < 0.5 are skipped; the first qualifying one wins.
 *
 * @param {SlideData} slide
 * @returns {{ prompt: string, code2d: string, pattern: string, confidence: number }}
 */
export function emitSlide2dCode(slide) {
  const detectors = [
    { name: 'percent-list', detect: detectPercentList, emit: emitPercentListCode },
    { name: 'kpi-feature', detect: detectKpiFeature, emit: emitKpiFeatureCode },
    { name: 'cover', detect: detectCover, emit: emitCoverCode },
  ];
  for (const d of detectors) {
    const match = d.detect(slide);
    if (match && match.confidence >= 0.5) return d.emit(slide, match);
  }
  return emitFallbackCode(slide);
}
