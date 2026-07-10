// sdf-js/src/scene/render-ir.js
// The structure-renderer dispatcher: IR in, studio SceneData out. This is the
// seam the spec's architecture diagram draws — input adapters produce an IR,
// renderIR picks the structure renderer by ir.structure, and everything
// downstream (studio, camera sequencing, overlay) is shared.
import { renderSequence } from './render-sequence.js';
import { renderHierarchy } from './render-hierarchy.js';
import { renderNetwork } from './render-network.js';
import { renderMagnitude } from './render-magnitude.js';
import { renderMatrix } from './render-matrix.js';
import { stagePreset } from './environments.js';

const RENDERERS = {
  sequence: renderSequence,
  hierarchy: renderHierarchy,
  network: renderNetwork,
  magnitude: renderMagnitude,
  matrix: renderMatrix,
};

// Every IR structure has a 3D renderer now (matrix landed last — the quadrant
// wall; see docs/superpowers/ir-matrix-proposal.md for the IR fields).
export const RENDERER_STRUCTURES = Object.keys(RENDERERS);

export function renderIR(ir, opts = {}) {
  const r = RENDERERS[ir?.structure];
  if (!r)
    throw new Error(
      `renderIR: no structure renderer for '${ir?.structure}' (have: ${Object.keys(RENDERERS).join(', ')})`,
    );
  const scene = r(ir, opts);
  // Beat tag (presenter mode): every structure's LAST shot is its payoff — the
  // 'station' hold boundary. One seam instead of five renderer edits; renderers
  // tag their own 'super' shots (the transition:'cut' punch-ins).
  const shots = scene.cameraSequence && scene.cameraSequence.shots;
  if (shots && shots.length && !shots[shots.length - 1].beat)
    shots[shots.length - 1].beat = 'station';
  // opts.stage → fighting-game stage preset (spotlight rig + platform + DOF);
  // applied here so every structure renderer gets it through one seam.
  return opts.stage ? stagePreset(scene) : scene;
}
