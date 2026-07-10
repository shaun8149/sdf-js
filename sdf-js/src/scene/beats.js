// sdf-js/src/scene/beats.js — beat derivation for presenter mode.
//
// A BEAT is one presenter step: press space, the timeline plays to the beat's
// boundary and HOLDS. Beats are derived, not authored: renderers/assembleDeck
// tag the shots they build (`beat: 'station'|'super'|'finale'` + `station: k`),
// and this walks the shot list collecting boundaries. Untagged lead-in shots
// (establishing, transits) merge into the beat that follows them — a beat is
// "everything since the last boundary, up to and including my tagged shot".
//
// Deterministic on purpose: the LLM's intelligence is already in the IR
// (emphasis → super shots); beat structure is pure translation.

/**
 * @param {object} cameraSequence  { shots: [{duration, beat?, station?}, ...] }
 * @returns {Array<{t: number, station: number|null, kind: string}>}
 *   boundaries in seconds (sequence time), strictly increasing. Untagged
 *   sequences fall back to a single full-span 'finale' beat.
 */
export function deriveBeats(cameraSequence) {
  const shots = (cameraSequence && cameraSequence.shots) || [];
  const beats = [];
  let clock = 0;
  for (const sh of shots) {
    clock += sh.duration || 0;
    if (sh.beat) {
      beats.push({ t: clock, station: sh.station ?? null, kind: sh.beat });
    }
  }
  if (beats.length === 0 && clock > 0) beats.push({ t: clock, station: null, kind: 'finale' });
  return beats;
}
