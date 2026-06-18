// =============================================================================
// slide-to-scene.js — SlideData → SceneData mapper (M1.5 first cut)
// -----------------------------------------------------------------------------
// Takes parser output (SlideData) and produces a SceneData ready to compile +
// render via existing pipeline. v1 handles 3 patterns:
//
//   1. "Percentage list" — N numeric labels (X%) → single bar-3d
//   2. "Title + subtitle" → cover-3d with stage + backdrop
//   3. Fallback → empty cover (always renders something)
//
// Each pattern matcher returns { type, confidence, ...data } if it fires.
// Mapper picks highest-confidence pattern. v2+ will add more patterns:
// chart, process, hierarchy, comparison, image-statement, etc.
//
// All output is valid SceneData v1 — directly consumable by compile().
// =============================================================================

const DEFAULT_CAMERA = {
  yaw: 0.0,
  pitch: 0.15,
  distance: 8,
  focal: 1.5,
  targetX: 0,
  targetY: 0.5,
  targetZ: 0,
};

const DEFAULT_LIGHT = {
  altitude: 0.5,
  azimuth: 0.6,
  distance: 12,
  intensity: 1.2,
};

const sceneSkeleton = () => ({
  v: 1,
  defaults: { camera: { ...DEFAULT_CAMERA }, light: { ...DEFAULT_LIGHT } },
  subjects: [],
});

// ---- Pattern detectors -------------------------------------------------------

/**
 * Detect "N percentage labels" pattern (chart-of-percentages).
 * Returns { values: number[], confidence: 0-1 } or null.
 */
function detectPercentList(slide) {
  // Find body items whose text is pure number (no letters)
  const numItems = slide.body
    .filter((b) => /^\d+$/.test(b.text.trim()))
    .map((b) => ({ value: parseInt(b.text.trim(), 10), bbox: b.bbox }));

  if (numItems.length < 3) return null;
  // Reject if numbers don't look like percentages (most > 100 = not percentages)
  const inPercentRange = numItems.filter((n) => n.value >= 0 && n.value <= 100);
  if (inPercentRange.length / numItems.length < 0.7) return null;

  // Sort by Y then X (reading order — top-to-bottom, left-to-right per row)
  const sorted = [...inPercentRange].sort((a, b) => {
    const dy = a.bbox.y - b.bbox.y;
    if (Math.abs(dy) > 30) return dy; // different rows
    return a.bbox.x - b.bbox.x;
  });

  const values = sorted.map((n) => n.value / 100); // normalize 0-1
  return { values, confidence: Math.min(1, numItems.length / 4) };
}

/**
 * Detect "title + subtitle" pattern (cover slide).
 * Always at least low-confidence applicable if title exists.
 */
function detectCover(slide) {
  if (!slide.title) return null;
  // Heuristic confidence: high if title is at top, body is small
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

// ---- Scene builders ----------------------------------------------------------

function buildPercentListScene(slide, pattern) {
  const scene = sceneSkeleton();
  // Single bar-3d with all values — Atlas's bar-3d handles N bars natively
  scene.subjects.push({
    type: 'bar-3d',
    id: 'percent-bars',
    args: {
      values: pattern.values,
      barWidth: 0.4,
      barDepth: 0.4,
      gap: 0.15,
      maxHeight: 2.5,
    },
    region: 'object',
  });
  // Subtle backdrop for visual context (very flat cover with no wall, just stage)
  scene.subjects.push({
    type: 'cover-3d',
    id: 'stage',
    transform: { translate: [0, -0.1, 0] },
    args: {
      stageWidth: pattern.values.length * 0.55 + 1.5,
      stageDepth: 1.5,
      stageThickness: 0.08,
      backdropHeight: 0,
      backdropThickness: 0,
      cornerRadius: 0.1,
    },
    region: 'object',
  });
  // Camera framing tighter for a horizontal bar row. Tilt + yaw so the bars
  // read as 3D (head-on flattens them visually); distance scales with bar
  // count so wide charts don't clip the edges of the frame.
  scene.defaults.camera.distance = Math.max(6, pattern.values.length * 0.9);
  scene.defaults.camera.targetY = 1.0;
  scene.defaults.camera.yaw = 0.45;
  scene.defaults.camera.pitch = 0.55;
  return scene;
}

function buildCoverScene(slide, pattern) {
  const scene = sceneSkeleton();
  scene.subjects.push({
    type: 'cover-3d',
    id: 'cover',
    args: {
      stageWidth: 5.0,
      stageDepth: 2.0,
      stageThickness: 0.2,
      backdropHeight: 2.5,
      backdropThickness: 0.2,
      cornerRadius: 0.15,
      title: pattern.title,
      subtitle: pattern.subtitle,
    },
    region: 'object',
  });
  scene.defaults.camera.distance = 9;
  scene.defaults.camera.targetY = 1.0;
  scene.defaults.camera.yaw = 0.2;
  scene.defaults.camera.pitch = 0.3;
  return scene;
}

function buildFallbackScene(slide) {
  const scene = sceneSkeleton();
  scene.subjects.push({
    type: 'cover-3d',
    id: 'fallback',
    args: {
      stageWidth: 4.0,
      stageDepth: 2.0,
      stageThickness: 0.2,
      backdropHeight: 2.5,
      backdropThickness: 0.15,
      cornerRadius: 0.1,
      title: slide.title || '(untitled)',
      subtitle: '',
    },
    region: 'object',
  });
  return scene;
}

// ---- Entry point -------------------------------------------------------------

/**
 * Map a SlideData → SceneData (v1).
 * @param {SlideData} slide
 * @returns {{ scene: SceneData, pattern: string, confidence: number }}
 */
export function mapSlideToScene(slide) {
  const detectors = [
    { name: 'percent-list', detect: detectPercentList, build: buildPercentListScene },
    { name: 'cover', detect: detectCover, build: buildCoverScene },
  ];

  let best = null;
  for (const d of detectors) {
    const match = d.detect(slide);
    if (match && (!best || match.confidence > best.confidence)) {
      best = { ...d, match };
    }
  }

  if (best && best.match.confidence >= 0.5) {
    return {
      scene: best.build(slide, best.match),
      pattern: best.name,
      confidence: best.match.confidence,
    };
  }
  return {
    scene: buildFallbackScene(slide),
    pattern: 'fallback',
    confidence: 0,
  };
}

export { DEFAULT_CAMERA, DEFAULT_LIGHT };
