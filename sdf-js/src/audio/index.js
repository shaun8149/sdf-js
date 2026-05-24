// =============================================================================
// src/audio — Atlas Generator-A audio axis (Sprint A-Phase-2)
// -----------------------------------------------------------------------------
// 6th orthogonal axis in Atlas's thesis (after SDF / renderer / pattern / scene /
// cameraSequence). Audio synths are tradable as independent units, callable
// from compositor or auto-bound to a scene via defaults.audio in future.
//
// Each synth module exports a `create<Name>Synth()` factory returning
//   { start, stop, isOn, getMediaStream, getContext }
// where getMediaStream() returns a MediaStream usable for video recording.
//
// First synth: oxygene (Jean-Michel Jarre "Oxygene Pt.4", srtuss dittytoy ref).
// =============================================================================

import { createOxygeneSynth } from './oxygene.js';

export const SYNTHS = {
  oxygene: createOxygeneSynth,
};

/**
 * Create a synth by name. Returns null if unknown.
 */
export function createSynth(name) {
  const factory = SYNTHS[name];
  if (!factory) {
    console.warn(`[audio] Unknown synth "${name}". Known: ${Object.keys(SYNTHS).join(', ')}`);
    return null;
  }
  return factory();
}
