// sdf-js/src/scene/tempo-tokens.js — Layer B, the TEMPORAL half.
//
// layout-tokens.js owns the spatial rhythm (module / stride / scale contrast);
// this module owns the BREATHING — how long the camera dwells and how fast it
// travels. Under the total-continuity rule (feedback lock 2026-07-12: the
// camera never cuts, so pacing is the ONLY instrument of emphasis left),
// these durations are the deck's information-density dial: a beat that used
// to be a hard cut now reads as fast-approach-then-dwell, and the dwell
// length IS the emphasis.
//
// Extraction discipline (same as layout-tokens): renderers migrate one at a
// time, output byte-identical, goldens gate it. render-magnitude is the pilot
// (the five-beat grammar's reference implementation); the deck-level beats
// (transit/threshold/overlook/finale) live in assemble-deck and migrate here
// with it.

export const TEMPO = {
  // five-beat station grammar (per-structure renderers)
  hero: 0.9, // beat 1 — low-angle meet-the-champion
  crane: 1.2, // beat 2 — up and over the lineup
  beatHold: 1.1, // beat 3 — per-item dwell during the tracking walk
  superHold: 1.0, // beat 4 — the punch-in dwell (impact lives here)
  payoff: 2.4, // beat 5 — the pull-back read of the whole form

  // deck-level beats (assemble-deck)
  transit: 1.2, // station→station sling
  threshold: 1.1, // chapter-seam sling (courtyard)
  overlook: 2.2, // the TOC map beat (courtyard)
  finale: 3.0, // the whole-deck money shot
};

/** hero + crane — when the tracking walk (beat 3) begins. */
export const introLead = () => TEMPO.hero + TEMPO.crane;
