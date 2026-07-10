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
    // A super is the presenter's PUNCHLINE, and it cuts in BEFORE the station
    // payoff on the visual timeline — while a speech puts the punchline after
    // the narration. Resolve the order clash with TWO boundaries per super:
    // 'pre-super' = the wind-up hold right before the punch-in (the presenter
    // narrates over the settled shot), then the punch itself fires on the next
    // press. This also makes pure beat-stepping feel right: arrive → hold →
    // press → BAM.
    if (sh.beat === 'super' && clock > 0) {
      beats.push({ t: clock, station: sh.station ?? null, kind: 'pre-super' });
    }
    clock += sh.duration || 0;
    if (sh.beat) {
      beats.push({ t: clock, station: sh.station ?? null, kind: sh.beat });
    }
  }
  if (beats.length === 0 && clock > 0) beats.push({ t: clock, station: null, kind: 'finale' });
  return beats;
}
