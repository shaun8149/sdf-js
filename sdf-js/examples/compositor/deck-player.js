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
// per-scene GLSL compile (200-500ms), and shows a per-segment title caption.
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

// A title caption overlaid on the canvas: a title line + a "kind · i/N" sub-line.
// Lives in #canvas-wrap so it tracks the render area; fades with each segment.
function makeCaption(wrap) {
  if (!wrap) return null;
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  const el = document.createElement('div');
  el.id = 'deck-caption';
  Object.assign(el.style, {
    position: 'absolute',
    left: '50%',
    bottom: '6%',
    transform: 'translateX(-50%)',
    maxWidth: '80%',
    padding: '10px 20px',
    borderRadius: '12px',
    background: 'rgba(8,11,18,0.62)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#f3f6fb',
    font: '500 17px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    textAlign: 'center',
    letterSpacing: '0.01em',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.45s ease',
    zIndex: '40',
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
  });
  const sub = document.createElement('div');
  Object.assign(sub.style, {
    marginTop: '3px',
    font: '600 11px/1 -apple-system,sans-serif',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(150,180,230,0.85)',
  });
  const main = document.createElement('div');
  el.appendChild(main);
  el.appendChild(sub);
  wrap.appendChild(el);
  return {
    set(mainText, subText) {
      main.textContent = mainText || '';
      sub.textContent = subText || '';
    },
    setMain: (mainText) => (main.textContent = mainText || ''),
    show: () => (el.style.opacity = '1'),
    hide: () => (el.style.opacity = '0'),
  };
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
  const caption = makeCaption(wrap);

  const FADE_MS = 380;
  const n = segments.length;
  let i = 0;
  // Loop the deck forever (a presentation reel). User navigation tears it down.
  for (;;) {
    const seg = segments[i];
    if (caption) caption.hide();
    fade(0);
    await sleep(FADE_MS);
    let seqStart = performance.now();
    try {
      await window.atlasLoadScene({
        id: `${id}-seg${i}`,
        title: seg.title || `${id} · ${i + 1}`,
        file: seg.file,
        renderer: 'studio',
      });
      seqStart = performance.now(); // sequence clock starts ~now (post-load)
    } catch (e) {
      console.error('[deck-player] segment load failed', seg, e);
    }
    await sleep(240); // let the new shader compile behind the fade
    fade(1);
    const dwell = Math.max(1, Number(seg.durationSec) || 6);
    let ticker = null;
    if (caption) {
      const stations = Array.isArray(seg.stationTitles) ? seg.stationTitles : [];
      const subline = `${seg.kind === 'chapter' ? 'Chapter' : 'Slide'} ${i + 1} / ${n}`;
      if (stations.length) {
        // per-station caption: switch the MAIN line as the camera reaches each
        // station (station.t = seconds from sequence start). Sub = deck position.
        const pick = () => {
          const el = (performance.now() - seqStart) / 1000;
          let cur = stations[0];
          for (const s of stations) if (s.t <= el) cur = s;
          caption.set(cur.title, subline);
        };
        pick();
        ticker = setInterval(pick, 150);
      } else {
        caption.set(seg.title, subline);
      }
      await sleep(260);
      caption.show();
      setTimeout(() => caption.hide(), Math.max(600, dwell * 1000 - 700));
    }
    await sleep(dwell * 1000);
    if (ticker) clearInterval(ticker);
    i = (i + 1) % n;
  }
}

const deckId = new URLSearchParams(location.search).get('deck');
if (deckId) playDeck(deckId).catch((e) => console.error('[deck-player]', e));
