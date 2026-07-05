// sdf-js/src/scene/render-ir.js
// The structure-renderer dispatcher: IR in, studio SceneData out. This is the
// seam the spec's architecture diagram draws — input adapters produce an IR,
// renderIR picks the structure renderer by ir.structure, and everything
// downstream (studio, camera sequencing, overlay) is shared.
import { renderSequence } from './render-sequence.js';
import { renderHierarchy } from './render-hierarchy.js';

const RENDERERS = {
  sequence: renderSequence,
  hierarchy: renderHierarchy,
};

export function renderIR(ir, opts = {}) {
  const r = RENDERERS[ir?.structure];
  if (!r)
    throw new Error(
      `renderIR: no structure renderer for '${ir?.structure}' (have: ${Object.keys(RENDERERS).join(', ')})`,
    );
  return r(ir, opts);
}
