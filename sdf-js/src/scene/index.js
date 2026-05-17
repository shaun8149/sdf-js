// =============================================================================
// sdf-js/src/scene — SceneData v1 facade
// -----------------------------------------------------------------------------
// Atlas Compositor 4-input lingua franca. See ./SPEC.md for the format.
//
// Quick start:
//   import { parse, compile, stringify } from 'sdf-js/src/scene';
//
//   const scene = parse(jsonString);
//   const { sdf, ground, cameraStatic, evalCamera, evalLight, regionFn } = compile(scene);
//
//   // renderer per frame:
//   const cam = evalCamera(tSeconds);
//   const light = evalLight(tSeconds);
//   myRenderer.render(sdf, { cam, light, ground });
// =============================================================================

export { parse, stringify, validateScene } from './serialize.js';
export { compile } from './compile.js';
export { validate } from './spec.js';
export { parseExpr, stringifyExpr, normalizeChannel } from './expr.js';

// Re-export enum tables for editor / LLM SKILL.md consumers
export {
  PRIMITIVE_TYPES, BOOLEAN_OPS, DOMAIN_OPS,
  SHADOW_MODES, SOURCE_FORMATS,
  SUBJECT_CHANNEL_PATHS, CAMERA_CHANNEL_PATHS, LIGHT_CHANNEL_PATHS,
} from './spec.js';
