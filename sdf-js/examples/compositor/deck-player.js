// =============================================================================
// deck-player.js — Layer-2 Atlas Present spatial-narrative deck player.
// -----------------------------------------------------------------------------
// A deck is a PLAYLIST of scene "segments". Two segment kinds, both just scenes:
//   • light "chapter" — many LIGHT atoms in ONE continuous 3D world + a touring
//     cameraSequence (the camera flies between slide-stations). One shader.
//   • heavy "slide"   — one RICH atom (gear / pyramid / org / tree, whose loops
//     + modPolar overflow a shared shader) in its OWN scene/shader.
//
// This is a controllable presenter, not just an auto-reel:
//   • per-segment fade transition (hides the per-scene GLSL compile)
//   • per-STATION caption (overlay): the title switches as the camera reaches
//     each station within a chapter (station.t = seconds from sequence start)
//   • progress dots (click to jump) + keyboard: → / Space next, ← prev,
//     P pause/resume auto-advance, R restart segment.
//
// Text policy (locked): narrative/title text → overlay (this file). Only data
// labels bound to geometry → in-scene SDF. Launch: ?deck=<deckId>.
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

// ---- caption overlay (title + sub-line), fades with each segment ------------
function makeCaption(wrap) {
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'absolute',
    left: '50%',
    bottom: '7%',
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
    set: (m, s) => {
      main.textContent = m || '';
      sub.textContent = s || '';
    },
    setMain: (m) => (main.textContent = m || ''),
    show: () => (el.style.opacity = '1'),
    hide: () => (el.style.opacity = '0'),
  };
}

// ---- progress dots (click to jump) ------------------------------------------
function makeDots(wrap, n, onJump) {
  const row = document.createElement('div');
  Object.assign(row.style, {
    position: 'absolute',
    top: '3.5%',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '9px',
    zIndex: '40',
    padding: '7px 12px',
    borderRadius: '20px',
    background: 'rgba(8,11,18,0.45)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
  });
  const dots = [];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    Object.assign(d.style, {
      width: '9px',
      height: '9px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.28)',
      cursor: 'pointer',
      transition: 'background 0.25s ease, transform 0.25s ease',
    });
    d.addEventListener('click', () => onJump(i));
    row.appendChild(d);
    dots.push(d);
  }
  wrap.appendChild(row);
  return {
    set(cur, paused) {
      dots.forEach((d, i) => {
        const on = i === cur;
        d.style.background = on
          ? paused
            ? 'rgba(255,196,120,0.95)'
            : 'rgba(150,190,255,0.95)'
          : 'rgba(255,255,255,0.28)';
        d.style.transform = on ? 'scale(1.5)' : 'scale(1)';
      });
    },
  };
}

// brief controls hint that self-fades
function showHint(wrap) {
  const h = document.createElement('div');
  h.textContent = '→ / Space  next   ·   ←  prev   ·   P  pause   ·   R  restart';
  Object.assign(h.style, {
    position: 'absolute',
    bottom: '2%',
    left: '50%',
    transform: 'translateX(-50%)',
    font: '500 11px -apple-system,sans-serif',
    color: 'rgba(220,230,245,0.6)',
    background: 'rgba(8,11,18,0.4)',
    padding: '5px 12px',
    borderRadius: '8px',
    zIndex: '40',
    pointerEvents: 'none',
    opacity: '1',
    transition: 'opacity 0.6s ease',
  });
  wrap.appendChild(h);
  setTimeout(() => (h.style.opacity = '0'), 4200);
  setTimeout(() => h.remove(), 5000);
}

async function playDeck(id) {
  const res = await fetch(`./demo-lifts/${id}.json`);
  if (!res.ok) throw new Error(`deck ${id}: HTTP ${res.status}`);
  const deck = await res.json();
  const segments = Array.isArray(deck.segments) ? deck.segments : [];
  if (!segments.length) throw new Error(`deck ${id}: no segments`);
  const n = segments.length;

  await waitFor(() => typeof window.atlasLoadScene === 'function', 10000);

  const wrap = document.getElementById('canvas-wrap');
  if (wrap) wrap.style.transition = 'opacity 0.35s ease';
  const fade = (v) => wrap && (wrap.style.opacity = String(v));
  const caption = makeCaption(wrap);

  const FADE_MS = 380;
  let cur = -1;
  let paused = false;
  let token = 0; // cancels stale async when a newer navigation supersedes it
  let advanceTimer = null;
  let ticker = null;

  const dots = makeDots(wrap, n, (i) => go(i));

  function clearTimers() {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function scheduleAdvance(seg) {
    const dwell = Math.max(1, Number(seg.durationSec) || 6);
    advanceTimer = setTimeout(() => go(cur + 1), dwell * 1000);
  }

  async function go(index) {
    const mine = ++token; // supersede any in-flight transition
    clearTimers();
    cur = ((index % n) + n) % n;
    dots.set(cur, paused);
    caption.hide();
    fade(0);
    await sleep(FADE_MS);
    if (mine !== token) return;
    const seg = segments[cur];
    let seqStart = performance.now();
    try {
      await window.atlasLoadScene({
        id: `${id}-seg${cur}`,
        title: seg.title || `${id} · ${cur + 1}`,
        file: seg.file,
        renderer: 'studio',
      });
      seqStart = performance.now(); // sequence clock starts ~now (post-load)
    } catch (e) {
      console.error('[deck-player] segment load failed', seg, e);
    }
    if (mine !== token) return;
    await sleep(240); // let the new shader compile behind the fade
    if (mine !== token) return;
    fade(1);

    const subline = `${seg.kind === 'chapter' ? 'Chapter' : 'Slide'} ${cur + 1} / ${n}`;
    const stations = Array.isArray(seg.stationTitles) ? seg.stationTitles : [];
    if (stations.length) {
      const pick = () => {
        const el = (performance.now() - seqStart) / 1000;
        let s = stations[0];
        for (const st of stations) if (st.t <= el) s = st;
        caption.set(s.title, subline);
      };
      pick();
      ticker = setInterval(pick, 150);
    } else {
      caption.set(seg.title, subline);
    }
    await sleep(220);
    if (mine !== token) return;
    caption.show();
    if (!paused) scheduleAdvance(seg);
  }

  function togglePause() {
    paused = !paused;
    dots.set(cur, paused);
    if (paused) {
      if (advanceTimer) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
      }
    } else if (!advanceTimer) {
      scheduleAdvance(segments[cur]);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      go(cur + 1);
    } else if (e.key === 'ArrowLeft') {
      go(cur - 1);
    } else if (e.key === 'p' || e.key === 'P') {
      togglePause();
    } else if (e.key === 'r' || e.key === 'R') {
      go(cur);
    }
  });

  showHint(wrap);
  go(0);
}

const deckId = new URLSearchParams(location.search).get('deck');
if (deckId) playDeck(deckId).catch((e) => console.error('[deck-player]', e));
