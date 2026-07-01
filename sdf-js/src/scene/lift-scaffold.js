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
const SPAN_X = 10.4; // world width  → X ∈ [-5.2, 5.2]
const SPAN_Y = 5.4; // world height
const CENTER_Y = 2.5; // vertical centre of the content band
const NATURAL = 2.3; // an atom's rough built diameter, for box-fit scaling

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
  const scale = Math.max(0.55, Math.min(1.75, Math.min(boxW, boxH) / NATURAL));
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
    const { subject3d, overlay: ov } = liftSubject(s);
    subject3d.id = `${subject3d.id}-${i}`; // unique per slot (a slot can hold N of a type)
    const { worldX, worldY, scale } = placeBox(s.x ?? 0, s.y ?? 0, s.w ?? CANVAS_W, s.h ?? CANVAS_H);
    // the twin laid out its geometry + overlays around this base translate; capture it
    // before we override, so the overlays can be re-anchored by the same delta.
    const base = (subject3d.transform && subject3d.transform.translate) || [0, 1.5, 0];
    const baseRotate = subject3d.transform && subject3d.transform.rotate;
    subject3d.transform = { translate: [worldX, worldY, 0], scale, ...(baseRotate ? { rotate: baseRotate } : {}) };
    subjects.push(subject3d);

    // re-anchor the subject's overlays to its 3D box: newAnchor = T + scale·(a − base).
    // drop the per-subject title (the slot carries one); shrink value fonts with scale.
    // legend cards sit 3u to the side in single-subject layout — in a packed slide that
    // flings them to the screen edge, so compress the horizontal offset to hug the box.
    const T = [worldX, worldY, 0];
    for (const o of ov) {
      if (o.role === 'title') continue;
      const a = o.anchor || [0, 0, 0];
      const kx = o.role === 'card' ? 0.42 : 1.0; // horizontal compression for legend cards
      overlay.push({
        ...o,
        anchor: [
          T[0] + scale * (a[0] - base[0]) * kx,
          T[1] + scale * (a[1] - base[1]),
          T[2] + scale * (a[2] - base[2]),
        ],
        // keep value readouts legible even on small subjects (don't shrink below a floor)
        ...(typeof o.radius === 'number' ? { radius: Math.max(o.role === 'value' ? 0.36 : 0.2, o.radius * scale) } : {}),
      });
    }
  });

  if (title) overlay.push({ text: String(title).toUpperCase(), anchor: [0, 4.9, 0], role: 'title' });

  const target = [0, CENTER_Y, 0];
  const cam = {
    loop: false,
    shots: [
      { duration: 0.01, pos: [1.4, CENTER_Y + 1.0, 14.0], target, fov: 48, aperture: 0, focalDistance: 12.5, ease: 'smooth' },
      { duration: 14, pos: [0, CENTER_Y + 0.35, 11.8], target, fov: 46, transition: 'blend', aperture: 0, focalDistance: 11.8, ease: 'smooth' },
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
