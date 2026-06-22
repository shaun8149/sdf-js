// =============================================================================
// apps/present/present.js — Atlas Present host (Layer 2 product app).
// -----------------------------------------------------------------------------
// The thin studio host: owns ONE canvas + ONE studio renderer, and exposes
// `present.show(sceneData)` = applyStudioScene (the shared runtime core). It does
// NOT go through the compositor playground — no renderer pills, no tabs, no lift
// UI, no 8-renderer dispatch. Present locks to studio → always full features.
//
// Dependency rule (locked): apps/present/ imports `src/` ONLY, NEVER `examples/`.
// New visual features go in src/ (spec + studio + apply-studio-scene), not here.
// =============================================================================

import { createStudioRenderer } from '../../src/render/studio.js';
import { applyStudioScene } from '../../src/runtime/apply-studio-scene.js';

const SCENES = '../../scenes'; // shared scene/deck JSON dir (also read by the playground later)

const wrap = document.getElementById('canvas-wrap');
const canvas = document.getElementById('c-present');

// Size the canvas to the viewport in CSS px (no devicePixelRatio multiply — the
// studio caps internal resolution + applies its own SSAA; multiplying by DPR on
// top is what blew the GPU watchdog). Must be set BEFORE createStudioRenderer
// (its first ensureSceneFbo reads canvas.width).
function sizeCanvas() {
  canvas.width = Math.max(1, wrap.clientWidth || window.innerWidth);
  canvas.height = Math.max(1, wrap.clientHeight || window.innerHeight);
}
sizeCanvas();

// Authored-only presentation: the studio camera is driven by each scene's
// cameraSequence / defaults (set via applyStudioScene → setSequence/setPostFx).
// getControls is just the static fallback the studio wants per frame; the real
// light/camera/studioBg come from the scene through applyStudioScene. No
// light-override UI, no viewer fly — Phase 2 locks the authored camera.
const getControls = () => ({
  lightAzim: 0.5,
  lightAlt: 0.7,
  lightDist: 30,
  fov: 1.5,
  shadowsOn: true,
  groundOn: true,
  checkerOn: true,
});

const studio = createStudioRenderer({ canvas, getControls, onFps: () => {} });

window.addEventListener('resize', () => {
  sizeCanvas();
  if (studio.requestRender) studio.requestRender(); // next frame reallocates the FBO + redraws
});

export const present = {
  studio,
  wrap,
  /** Render a parsed SceneData (the inner v1 scene) into the studio. */
  show(sceneData) {
    return applyStudioScene(studio, sceneData);
  },
  /** Fetch a scene/deck-segment file from scenes/ and render its sceneData. */
  async load(file) {
    const res = await fetch(`${SCENES}/${file}`);
    if (!res.ok) throw new Error(`present: scene ${file} → HTTP ${res.status}`);
    const json = await res.json();
    return this.show(json.sceneData || json);
  },
};
// Exposed for the deck player (Layer 2 sibling). deck-player only calls this —
// never the engine directly.
window.present = present;

// Routing: ?scene=<id> plays one scene; ?deck=<id> is handled by deck-player.js.
const params = new URLSearchParams(location.search);
const sceneId = params.get('scene');
if (sceneId && !params.get('deck')) {
  present.load(`${sceneId}.json`).catch((e) => console.error('[present]', e));
}
