// sdf-js/src/scene/tone.js — deck-wide tone experiments (?tone=<name>).
//
// The deck's visual motif is the near-black rock family (monoliths, dome,
// massing, horizon slabs, decor stelae/boulders). ?tone=white re-dresses that
// whole family as white stone / white plastic (user trial 2026-07-14) WITHOUT
// touching anything that carries meaning through color:
//   • accents survive untouched — reds/golds/blues/greens keep saturation
//     (sat > SAT_MAX never remaps), so data still reads as data;
//   • emissives survive untouched — glow is a lighting decision, not a tone;
//   • tonal ORDER survives — darker rocks stay slightly darker whites, so
//     depth layering (massing behind, subject in front) keeps its cues.
//
// Applied as a post-pass on the assembled scene (figure.js, opt-in URL param)
// — zero renderer knows about it, defaults stay byte-identical, and one rule
// re-themes every dark-family emitter at once (the L05 registry lesson:
// retheme is one lever, not a per-renderer hunt).
const SAT_MAX = 0.35; // above this the color is an accent — never remap
const VALUE_MAX = 0.55; // above this it is already light — leave it alone
const GLOW_MAX = 0.05;

function whiten(m) {
  if (!m || typeof m !== 'object') return m;
  if ((m.glow || 0) > GLOW_MAX) return m;
  if ((m.sat ?? 0) > SAT_MAX) return m;
  if ((m.value ?? 1) > VALUE_MAX) return m;
  return {
    ...m,
    sat: (m.sat ?? 0) * 0.12,
    // 0.1 → 0.83, 0.32 → 0.88, 0.55 → 0.94 — order preserved, all white
    value: 0.8 + (m.value ?? 0) * 0.25,
    roughness: 0.32, // the "white plastic" read: smooth + coated
    clearcoat: Math.max(m.clearcoat || 0, 0.45),
    // Porcelain floor: the black-era silhouettes lived happily in the studio's
    // dark horizon band — turned white, their unlit faces still fell to
    // near-black there and read as un-themed leftovers. A whisper of emission
    // keeps every whitened face reading WHITE without becoming a lamp.
    glow: 0.05,
  };
}

function walk(subject) {
  if (subject.material) subject.material = whiten(subject.material);
  if (Array.isArray(subject.children)) subject.children.forEach(walk);
}

/** Mutates the scene in place and returns it (host-side opt-in post-pass). */
export function applyWhiteTone(scene) {
  if (!scene) return scene;
  // Assembled decks dedup materials into a registry (Wave A) and subjects
  // carry string refs — the ONE place to retheme is the registry itself.
  // Inline materials (solo renderIR scenes, decor children) walk as before.
  if (scene.materials && typeof scene.materials === 'object') {
    for (const key of Object.keys(scene.materials)) {
      scene.materials[key] = whiten(scene.materials[key]);
    }
  }
  if (Array.isArray(scene.subjects)) scene.subjects.forEach(walk);
  return scene;
}
