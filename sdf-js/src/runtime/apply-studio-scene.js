// =============================================================================
// apply-studio-scene.js — the single source of truth for loading a SceneData
// into the studio renderer.
// -----------------------------------------------------------------------------
// WHY this exists (Phase 1 of the studio-decoupling plan): the studio scene-load
// logic used to be split across the compositor's loadDemoScene (expand + compile)
// and its 8-renderer runActiveGpuRenderer dispatch (the setVolumes / setPostFx /
// setSequence / setRenderScale / setAnimated / render wiring). Threading studio's
// rich features through that generic multi-renderer dispatch caused a whole class
// of "forgot to wire feature X to studio" bugs (volumes not fed, rawScene stored
// un-expanded, renderScale gap → seg2 black). Defining it ONCE here kills that
// class and lets a thin Atlas Present host reuse it without dragging in the
// compositor playground.
//
// Three pure pieces (no DOM, no app state):
//   • expandAndCompile(sceneData)  — connectors → SDF
//   • wireStudioScene(studio, …)   — push the scene's features into the renderer
//   • applyStudioScene(studio, …)  — both, for callers that want one call
//
// The studio renderer instance + canvas lifecycle stay the CALLER's job (the
// compositor owns its renderer; Present owns its own). This module never creates
// a renderer or touches the DOM.
// =============================================================================

import { compile as compileSceneData } from '../scene/index.js';
import { expandVariants } from '../scene/generator-s.js';
import { expandChartLabels } from '../scene/chart-labels.js';
import { expandStage } from '../scene/stage.js';
import { union as sdfUnion } from '../sdf/dn.js';

// Does the scene change pixels on its own (no input)? Drives studio's idle-stop:
// volumes (god-rays/fog shimmer) + sea/water materials + city/terrain types all
// animate via u_time. (A playing cameraSequence is handled separately by studio.)
export function sceneHasTimeContent(rawScene) {
  if (!rawScene) return false;
  if (Array.isArray(rawScene.volumes) && rawScene.volumes.length) return true;
  const matStr = (m) => (typeof m === 'string' ? m : (m && m.preset) || '') || '';
  const animMat = (m) => /sea|water/i.test(matStr(m));
  const animType = (t) => /city|terrain|ocean|sea/i.test(t || '');
  const visit = (s) =>
    !!s &&
    (animType(s.type) ||
      animMat(s.material) ||
      (Array.isArray(s.children) && s.children.some(visit)));
  return Array.isArray(rawScene.subjects) && rawScene.subjects.some(visit);
}

// Studio renders at renderScale² SSAA (2.0 = 4× fragment cost). A heavy scene at
// that cost can blow the GPU's ~2s watchdog (TDR) → black + browser hang. Drop
// heavy scenes to 1× (no SSAA); keep crisp 2× for the cheap single-atom scenes.
// "Heavy" = volumes / procedural-city / ANY stage (enclosed room raymarch +
// reflection-retrace + per-light soft shadows) / a dense subject list.
export function pickRenderScale(rawScene) {
  const subjCount = rawScene && Array.isArray(rawScene.subjects) ? rawScene.subjects.length : 0;
  const hasVolumes = rawScene && Array.isArray(rawScene.volumes) && rawScene.volumes.length > 0;
  const hasCity =
    rawScene && Array.isArray(rawScene.subjects)
      ? JSON.stringify(rawScene.subjects).includes('"procedural-city"')
      : false;
  const hasStage = !!(rawScene && rawScene.defaults && rawScene.defaults.stage);
  const heavy = hasVolumes || hasCity || hasStage || subjCount > 16;
  return heavy ? 1.0 : 2.0;
}

/**
 * Run the connector pipeline + compile a SceneData into a renderable SDF.
 *   expandVariants(opt) → expandStage → expandChartLabels → compile → ground-union
 * @param sceneData raw SceneData (v1)
 * @param opts.rng        optional Random — runs Generator-S variant scatter
 * @param opts.tokenHash  optional URL token hash (deterministic pattern seeds)
 * @returns { stagedScene, compiled, sdf } — stagedScene is the post-expandStage
 *          scene to keep as the renderer's rawScene (carries lights/volumes/
 *          cameraSequence the wiring reads); sdf is ground-unioned + ready.
 */
export function expandAndCompile(sceneData, { rng = null, tokenHash } = {}) {
  const variantScene = rng ? expandVariants(sceneData, rng) : sceneData;
  const stagedScene = expandStage(variantScene);
  const labeledScene = expandChartLabels(stagedScene);
  const compiled = compileSceneData(labeledScene, { tokenHash });
  const sdf =
    compiled.groundSdf && compiled.sdf
      ? sdfUnion(compiled.sdf, compiled.groundSdf)
      : compiled.sdf || compiled.groundSdf;
  return { stagedScene, compiled, sdf };
}

/**
 * Push a (raw, expanded) scene's features into a studio renderer and render it.
 * This is the ONE place studio features are wired — add a new studio feature
 * here, not in N renderer dispatch branches.
 * @param studio   a studio renderer instance (from createStudioRenderer)
 * @param rawScene the expandStage output (defaults.camera/lights, volumes,
 *                 cameraSequence live here)
 * @param compiled the compile() result (carries bakedHeightmap)
 * @param sdf      the renderable SDF (ground-unioned)
 * @returns whatever studio.render returns (e.g. { bytes })
 */
export function wireStudioScene(studio, rawScene, compiled, sdf) {
  const cam = (rawScene && rawScene.defaults && rawScene.defaults.camera) || null;
  if (studio.setPostFx) studio.setPostFx(rawScene || {}, cam);
  if (studio.setRuneHeightmap)
    studio.setRuneHeightmap((compiled && compiled.bakedHeightmap) || null);
  if (studio.setVolumes)
    studio.setVolumes(rawScene && Array.isArray(rawScene.volumes) ? rawScene.volumes : []);
  if (studio.setRenderScale) studio.setRenderScale(pickRenderScale(rawScene));
  if (studio.setSequence) studio.setSequence((rawScene && rawScene.cameraSequence) || null);
  if (studio.setAnimated) studio.setAnimated(sceneHasTimeContent(rawScene));
  return studio.render(sdf);
}

/**
 * Convenience: expand+compile a SceneData and render it into the studio in one
 * call. The thin Atlas Present host uses this; the compositor uses the two
 * pieces separately (its flow is split by app state + multi-renderer dispatch).
 */
export function applyStudioScene(studio, sceneData, opts = {}) {
  const { stagedScene, compiled, sdf } = expandAndCompile(sceneData, opts);
  wireStudioScene(studio, stagedScene, compiled, sdf);
  return { stagedScene, compiled, sdf };
}
