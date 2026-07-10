// sdf-js/src/scene/render-ir.js
// The structure-renderer dispatcher: IR in, studio SceneData out. This is the
// seam the spec's architecture diagram draws — input adapters produce an IR,
// renderIR picks the structure renderer by ir.structure, and everything
// downstream (studio, camera sequencing, overlay) is shared.
import { renderSequence } from './render-sequence.js';
import { renderHierarchy } from './render-hierarchy.js';
import { renderNetwork } from './render-network.js';
import { renderMagnitude } from './render-magnitude.js';
import { stagePreset } from './environments.js';

const RENDERERS = {
  sequence: renderSequence,
  hierarchy: renderHierarchy,
  network: renderNetwork,
  magnitude: renderMagnitude,
};

// The structures that HAVE a 3D renderer today — 'matrix' (Sprint 28) is a
// valid IR structure the 2D bridges + text-to-ir emit/consume, but has no
// entry here yet. scaffold-to-ir's deckToIR uses this list to keep matrix
// IRs out of assembleDeck until a matrix structure renderer exists (see
// docs/superpowers/ir-matrix-proposal.md).
export const RENDERER_STRUCTURES = Object.keys(RENDERERS);

export function renderIR(ir, opts = {}) {
  const r = RENDERERS[ir?.structure];
  if (!r)
    throw new Error(
      `renderIR: no structure renderer for '${ir?.structure}' (have: ${Object.keys(RENDERERS).join(', ')})`,
    );
  const scene = r(ir, opts);
  // opts.stage → fighting-game stage preset (spotlight rig + platform + DOF);
  // applied here so every structure renderer gets it through one seam.
  return opts.stage ? stagePreset(scene) : scene;
}
