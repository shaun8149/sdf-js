// =============================================================================
// deck-player.js — Layer-2 Atlas Present spatial-narrative deck player.
// -----------------------------------------------------------------------------
// A deck is a PLAYLIST of scene "segments". Two segment kinds, both just scenes:
//   • light "chapter" — many LIGHT atoms in ONE continuous 3D world + a touring
//     cameraSequence (the camera flies between slide-stations). One shader.
//   • heavy "slide"   — one RICH atom (gear / pyramid / org / tree, whose loops
//     + modPolar overflow a shared shader) in its OWN scene/shader, with a short
//     orbit/dolly cameraSequence so it isn't a frozen object.
// The player sequences segments, fading the canvas between them to hide the
// per-scene GLSL compile (200-500ms). This is the hybrid the user chose: light
// stays one-world, heavy splits into its own scene.
//
// Launch: open the compositor with ?deck=<deckId> → fetches demo-lifts/<id>.json.
// It ONLY calls the public window.atlasLoadScene hook — never compositor
// internals (compositor = engine/Layer 1; this = app/Layer 2).
// =============================================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs) {
  const t0 = performance.now();
  while (!fn()) {
    if (performance.now() - t0 > timeoutMs) throw new Error('deck-player: waitFor timed out');
    await sleep(60);
  }
}

async function playDeck(id) {
  const res = await fetch(`./demo-lifts/${id}.json`);
  if (!res.ok) throw new Error(`deck ${id}: HTTP ${res.status}`);
  const deck = await res.json();
  const segments = Array.isArray(deck.segments) ? deck.segments : [];
  if (!segments.length) throw new Error(`deck ${id}: no segments`);

  // The compositor module loads async — wait for its public load hook.
  await waitFor(() => typeof window.atlasLoadScene === 'function', 10000);

  const wrap = document.getElementById('canvas-wrap');
  if (wrap) wrap.style.transition = 'opacity 0.35s ease';
  const fade = (v) => {
    if (wrap) wrap.style.opacity = String(v);
  };

  const FADE_MS = 380;
  let i = 0;
  // Loop the deck forever (a presentation reel). User navigation tears it down.
  for (;;) {
    const seg = segments[i];
    fade(0);
    await sleep(FADE_MS);
    try {
      await window.atlasLoadScene({
        id: `${id}-seg${i}`,
        title: seg.title || `${id} · ${i + 1}`,
        file: seg.file,
        renderer: 'studio',
      });
    } catch (e) {
      console.error('[deck-player] segment load failed', seg, e);
    }
    await sleep(240); // let the new shader compile behind the fade
    fade(1);
    const dwell = Math.max(1, Number(seg.durationSec) || 6);
    await sleep(dwell * 1000);
    i = (i + 1) % segments.length;
  }
}

const deckId = new URLSearchParams(location.search).get('deck');
if (deckId) playDeck(deckId).catch((e) => console.error('[deck-player]', e));
