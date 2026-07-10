// presenter.js — the presenter runtime: SPACE steps the presentation beat by
// beat; the timeline HOLDS at each boundary (the one-clock engine freezes
// build-ins + postfx with it). With a script, spaces step SPANS instead — the
// teleprompter advances every press, the camera only moves when the next span
// belongs to a later visual beat ("hold" spans talk over a frozen stage).
//
// Keys: Space / → = next beat (or span) · ← = previous · Home = restart.
import { deriveBeats } from '../../src/scene/beats.js';

export function attachPresenter({ studio, scene, script = null }) {
  const beats = deriveBeats(scene.cameraSequence || { shots: [] });
  if (!beats.length) return { dispose() {} };

  // ---- span → beat mapping (script mode) ------------------------------------
  // span: {text, station, kind:'station'|'super'|'hold'}. A span targets the
  // matching beat (same station + kind); 'hold' spans target the previous
  // span's beat (talk, no camera move). Unmatched → nearest station beat.
  let steps; // [{beatIdx, span?}] — beatIdx -1 = the opening hold
  if (script && script.length) {
    steps = [];
    let lastBeatIdx = -1; // before the first press we sit on the opening hold
    for (const span of script) {
      let idx = -1;
      if (span.kind === 'hold') {
        idx = lastBeatIdx; // talk over a frozen stage
      } else if (span.kind === 'station') {
        // narration beat: play up to the wind-up hold BEFORE the station's
        // punch-in (if it has one) — the punchline stays in the presenter's
        // hand; stations without a super go straight to their payoff.
        idx = beats.findIndex((b) => b.station === span.station && b.kind === 'pre-super');
        if (idx < 0) idx = beats.findIndex((b) => b.station === span.station && b.kind === 'station');
      } else {
        // super span: fire the punch-in (its boundary is the punch's end)
        idx = beats.findIndex((b) => b.station === span.station && b.kind === span.kind);
        if (idx < 0) idx = beats.findIndex((b) => b.station === span.station && b.kind === 'station');
      }
      if (idx < 0) {
        console.warn('[presenter] span has no beat, holding:', span);
        idx = lastBeatIdx;
      }
      if (idx < lastBeatIdx) idx = lastBeatIdx; // never step backwards mid-script
      steps.push({ beatIdx: idx, span });
      lastBeatIdx = idx;
    }
    // make sure the finale is reachable even if the script ends early
    if (steps[steps.length - 1].beatIdx < beats.length - 1)
      steps.push({ beatIdx: beats.length - 1, span: null });
  } else {
    steps = beats.map((_, i) => ({ beatIdx: i, span: null }));
  }

  // ---- HUD: beat counter + teleprompter strip --------------------------------
  const hud = document.createElement('div');
  hud.style.cssText =
    'position:fixed;right:14px;bottom:12px;z-index:30;font:600 12px -apple-system,Inter,sans-serif;' +
    'color:#cfd3dc;background:rgba(20,22,28,0.75);padding:5px 10px;border-radius:5px;pointer-events:none;';
  document.body.appendChild(hud);
  const prompter = document.createElement('div');
  prompter.style.cssText =
    'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);max-width:72%;z-index:30;' +
    'font:500 16px/1.45 -apple-system,Inter,sans-serif;color:#f2f3f6;text-align:center;' +
    'background:rgba(16,17,22,0.78);padding:10px 18px;border-radius:9px;pointer-events:none;' +
    'white-space:pre-wrap;display:none;';
  document.body.appendChild(prompter);

  // ---- stepping --------------------------------------------------------------
  let cur = -1; // current step index (-1 = before the first press)
  let playingTo = null; // boundary being played toward
  let raf = 0;

  function renderHud() {
    const b = cur >= 0 ? steps[cur].beatIdx : -1;
    hud.textContent =
      (script && script.length ? `span ${Math.max(0, cur + 1)}/${steps.length} · ` : '') +
      `beat ${b + 1}/${beats.length}`;
    const span = cur >= 0 ? steps[cur].span : null;
    prompter.style.display = span ? 'block' : 'none';
    if (span) prompter.textContent = span.text;
  }

  function holdAt(t) {
    studio.setSequenceTime(Math.max(0, t - 1e-3));
    studio.setSequencePaused(true);
    studio.requestRender && studio.requestRender();
  }

  function playTo(t) {
    playingTo = t;
    studio.setSequencePaused(false);
    cancelAnimationFrame(raf);
    const poll = () => {
      if (playingTo == null) return;
      if (studio.getSequenceTime() >= playingTo - 1e-3) {
        studio.setSequencePaused(true);
        playingTo = null;
        return;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
  }

  function go(next) {
    if (next < -1 || next >= steps.length) return;
    const fromBeat = cur >= 0 ? steps[cur].beatIdx : -1;
    const toBeat = next >= 0 ? steps[next].beatIdx : -1;
    cur = next;
    playingTo = null;
    if (toBeat > fromBeat) playTo(beats[toBeat].t);
    else if (toBeat < fromBeat) holdAt(toBeat >= 0 ? beats[toBeat].t : 0.02); // backwards = seek, no replay
    renderHud();
  }

  function onKey(e) {
    // never fight a text field (the author page's prompt box)
    const tag = e.target && e.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    if (e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      go(cur + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(cur - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      cur = -1;
      playingTo = null;
      holdAt(0.02);
      renderHud();
    }
  }
  window.addEventListener('keydown', onKey);

  // start HELD at t≈0 — the presenter opens the show with the first space
  holdAt(0.02);
  renderHud();

  return {
    dispose() {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      hud.remove();
      prompter.remove();
    },
  };
}
