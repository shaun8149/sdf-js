// lift-scaffold.js — end-to-end bridge: a REAL 2D scaffold slot (multi-subject, with
// x/y/w/h layout on a 1280×720 canvas) → a 3D studio scene.
//
// The twin map (lift-2d-to-3d.js) lifts ONE subject and assumes it owns the slide. A
// scaffold slot has 2–5 subjects arranged in 2D. This module adds the missing piece:
// map each subject's 2D box → a 3D position + scale, so the elements lay out in 3D
// instead of stacking on the origin.
//
// FIRST CUT (surfacing the gap): geometry positioned by layout + one slot title.
// Per-subject decorative overlays (cards/values) are dropped for now — re-anchoring
// them to each subject's 3D box is the next step. Types without a 3D twin are skipped
// (logged), not faked.

import { liftSubject, twinTypeOf, pushInCamera } from './lift-2d-to-3d.js';
import { PRIMITIVE_FACTORY_TYPES } from './compile.js';

const FACTORY = new Set(PRIMITIVE_FACTORY_TYPES);

const CANVAS_W = 1280;
const CANVAS_H = 720;
// 3D "wall" the canvas maps onto
const SPAN_X = 11.0; // world width  → X ∈ [-5.5, 5.5]
const SPAN_Y = 5.6; // world height
const CENTER_Y = 2.5; // vertical centre of the content band
const NATURAL = 3.0; // an atom's rough built diameter, for box-fit scaling

export function hasTwin(type2d) {
  return FACTORY.has(twinTypeOf(type2d));
}

// 2D box (top-left origin, +y down) → 3D placement (centre origin, +y up)
function placeBox(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  // NOTE: studio camera is +x → screen-LEFT, so negate to keep 2D-left on screen-left.
  const worldX = -(cx / CANVAS_W - 0.5) * SPAN_X;
  const worldY = -(cy / CANVAS_H - 0.5) * SPAN_Y + CENTER_Y;
  const boxW = (w / CANVAS_W) * SPAN_X;
  const boxH = (h / CANVAS_H) * SPAN_Y;
  const scale = Math.max(0.42, Math.min(1.5, Math.min(boxW, boxH) / NATURAL));
  return { worldX, worldY, scale };
}

/**
 * Lift one scaffold slot (sceneData) → a 3D studio scene.
 * @param {object} sceneData  { name, layout, subjects:[{type,x,y,w,h,args}] }
 * @param {object} [opts]     { title }
 * @returns {{scene: object, skipped: string[]}}
 */
export function liftScaffoldSlot(sceneData, opts = {}) {
  const subjects = [];
  const overlay = [];
  const skipped = [];
  const title = opts.title || sceneData.title || sceneData.name || null;

  (sceneData.subjects || []).forEach((s, i) => {
    if (!hasTwin(s.type)) {
      skipped.push(s.type);
      return;
    }
    const { subject3d } = liftSubject(s);
    subject3d.id = `${subject3d.id}-${i}`; // unique per slot (a slot can hold N of a type)
    const { worldX, worldY, scale } = placeBox(s.x ?? 0, s.y ?? 0, s.w ?? CANVAS_W, s.h ?? CANVAS_H);
    // keep any rotate the twin set (e.g. circle-segmented faces camera); override the
    // position with the 2D-layout mapping and fit-scale into the box.
    const baseRotate = subject3d.transform && subject3d.transform.rotate;
    subject3d.transform = { translate: [worldX, worldY, 0], scale, ...(baseRotate ? { rotate: baseRotate } : {}) };
    subjects.push(subject3d);
  });

  if (title) overlay.push({ text: String(title).toUpperCase(), anchor: [0, 4.9, 0], role: 'title' });

  const target = [0, CENTER_Y, 0];
  const cam = {
    loop: false,
    shots: [
      { duration: 0.01, pos: [1.6, CENTER_Y + 1.2, 15.5], target, fov: 50, aperture: 0, focalDistance: 14, ease: 'smooth' },
      { duration: 14, pos: [0, CENTER_Y + 0.4, 13.0], target, fov: 47, transition: 'blend', aperture: 0, focalDistance: 13, ease: 'smooth' },
    ],
  };

  return {
    scene: {
      v: 1,
      name: `(scaffold) ${sceneData.name || 'slot'}`,
      subjects,
      overlay,
      cameraSequence: cam,
      defaults: { stage: { size: [24, 12, 13] } },
    },
    skipped,
  };
}
