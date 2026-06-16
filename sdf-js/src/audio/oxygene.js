// =============================================================================
// oxygene — Web Audio synth port of "Oxygene Pt. 4" (Jean-Michel Jarre, 1976)
// -----------------------------------------------------------------------------
// Inspired by srtuss's 19KB dittytoy port (2022-12-25, CC reference). This is
// a SIMPLIFIED FAITHFUL reconstruction in Web Audio API — keeps the iconic
// drum machine + bass + lead melody loop. Drops the strings pad / pluck /
// noise / phaser chain for first ship; can be added in a future Audio sprint.
//
// Architecture: native Web Audio (OscillatorNode + GainNode + Biquad) +
// look-ahead scheduler (schedule events 100ms in advance, refill every 25ms).
// No AudioWorklet — DSP stays in native nodes for easier debug + dynamic load.
//
// Sprint A-Phase-2 (2026-05-24): first synth on the Generator-A audio axis.
// =============================================================================

// ---- Note constants (matching dittytoy's c1=24, c4=60 MIDI convention) ----
const N = (() => {
  const o = {};
  // Octaves 1-6 (we use ~ A1 to C7)
  for (let oct = 1; oct <= 7; oct++) {
    const base = (oct + 1) * 12;
    o[`c${oct}`] = base;
    o[`cs${oct}`] = base + 1;
    o[`d${oct}`] = base + 2;
    o[`ds${oct}`] = base + 3;
    o[`e${oct}`] = base + 4;
    o[`f${oct}`] = base + 5;
    o[`fs${oct}`] = base + 6;
    o[`g${oct}`] = base + 7;
    o[`gs${oct}`] = base + 8;
    o[`a${oct}`] = base + 9;
    o[`as${oct}`] = base + 10;
    o[`b${oct}`] = base + 11;
  }
  return o;
})();
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createOxygeneSynth() {
  let ctx = null;
  let master = null;
  let delayBus = null;
  let dryBus = null;
  let isPlaying = false;
  let nextNoteTime = 0;
  let schedulerTimer = null;
  let bar = 0; // global bar counter for pattern selection
  // Caller may want to capture the live audio stream for video recording.
  let mediaStreamDest = null;

  const BPM = 123;
  const SUBDIV = 60 / BPM / 3; // 12 subdivisions per bar — drum step length
  const BAR = SUBDIV * 12; // one bar = 1.463 sec
  const LOOKAHEAD = 0.1; // schedule 100ms in advance
  const TICK = 25; // refill every 25ms

  // ---- Setup ----
  function ensureContext() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.45;
    // Feedback delay = simple tape echo (half-beat repeats with 0.55 feedback)
    delayBus = ctx.createGain();
    delayBus.gain.value = 0.32;
    dryBus = ctx.createGain();
    dryBus.gain.value = 1.0;
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 60 / BPM / 2; // half-beat delay
    const fb = ctx.createGain();
    fb.gain.value = 0.55;
    const dampingHigh = ctx.createBiquadFilter();
    dampingHigh.type = 'lowpass';
    dampingHigh.frequency.value = 4800;
    delayBus.connect(delay).connect(dampingHigh).connect(fb).connect(delay);
    dampingHigh.connect(master);
    dryBus.connect(master);
    master.connect(ctx.destination);
    return ctx;
  }

  // ---- Drum hits ----
  // Each takes (startTime) and schedules its sound.

  // Bass drum: 65Hz sine pitch-bombed down. Korg Minipops style.
  function bassdrum(t) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    osc.connect(gain).connect(dryBus);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // Tank-style tone hits — sine with short envelope. Used for congas / bongos /
  // claves / rimshot, just different pitches + envelopes.
  function tonehit(t, freq, amp, decay) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(amp, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    osc.connect(gain).connect(dryBus);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }
  const conga = (t) => tonehit(t, 195, 0.3, 0.165);
  const smallbongo = (t) => tonehit(t, 600, 0.3, 0.05);
  const largebongo = (t) => tonehit(t, 400, 0.3, 0.08);
  const claves = (t) => tonehit(t, 2200, 0.45, 0.05);
  const rimshot = (t) => tonehit(t, 1860, 0.22, 0.01);

  // Hi-hat / cymbal — filtered noise burst.
  function noise(t, decay, amp, hpCut) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * (decay + 0.05)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpCut;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(amp, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(hp).connect(gain).connect(dryBus);
    src.start(t);
    src.stop(t + decay + 0.05);
  }
  const hihat = (t) => noise(t, 0.04, 0.2, 7000);
  const cymbal = (t) => noise(t, 0.22, 0.18, 5500);

  // Quijada (donkey-jawbone) — ringing 2.7kHz click. Stylized as decaying sine.
  function quijada(t) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 2700;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(dryBus);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  // ---- Bass — varsaw-style detuned saw with quick filter sweep ----
  function playBass(t, midi, dur) {
    const freq = midiHz(midi);
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq * 1.005; // detune
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + Math.min(dur, 0.6));
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
    gain.gain.setValueAtTime(0.3, t + Math.max(0.02, dur - 0.05));
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc1.connect(lp);
    osc2.connect(lp);
    lp.connect(gain).connect(dryBus);
    osc1.start(t);
    osc1.stop(t + dur + 0.05);
    osc2.start(t);
    osc2.stop(t + dur + 0.05);
  }

  // ---- Lead synth1 — bright sawtooth pad with sweep + delay send ----
  function playLead(t, midi, dur) {
    const freq = midiHz(midi);
    // 3 detuned sawtooths for richness
    const oscs = [-7, 0, 7].map((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq * Math.pow(2, cents / 1200);
      return o;
    });
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 4;
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.exponentialRampToValueAtTime(4200, t + 0.12);
    lp.frequency.exponentialRampToValueAtTime(1200, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.04);
    gain.gain.setValueAtTime(0.13, t + Math.max(0.05, dur - 0.1));
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    for (const o of oscs) o.connect(lp);
    lp.connect(gain);
    gain.connect(dryBus);
    gain.connect(delayBus); // echo send
    for (const o of oscs) {
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  // ---- Patterns ----
  // 12-step drum pattern (Korg Minipops 7 dittytoy convention, indices 0..11)
  const DRUM_BEATS = [
    ['x....xx..x.x', bassdrum],
    ['..x..x..x..x', smallbongo],
    ['x.....x..x..', largebongo],
    ['.........x.x', conga],
    ['...x.....x..', rimshot],
    ['xxxxxxxxxxxx', hihat],
    ['..x.........', cymbal],
    ['..........x.', quijada],
  ];

  // Bass pattern — Oxygene's iconic descending arpeggio. C minor.
  // pitch indices (over note registry) + duration-in-subdivisions per step
  const BASS_PATS = [
    {
      p: [N.c2, N.as1, N.c2, N.g1, N.as1, N.g1, N.c2, N.as1, N.c2, N.c2, N.as1, N.g1],
      d: [3, 2, 3, 1, 2, 1, 3, 2, 3, 1, 2, 1],
    },
    {
      p: [N.d2, N.c2, N.d2, N.d2, N.c2, N.a1, N.d2, N.c2, N.d2, N.d2, N.c2, N.a1],
      d: [3, 2, 3, 1, 2, 1, 3, 2, 3, 1, 2, 1],
    },
    {
      p: [N.f2, N.ds2, N.c2, N.f2, N.ds2, N.c2, N.f2, N.ds2, N.c2, N.c2, N.ds2, N.c2],
      d: [3, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 1],
    },
  ];

  // Lead pattern — recognizable Oxygene Pt.4 melody fragment.
  const LEAD_PATS = [
    { p: [N.c6, N.g5, N.ds5, N.g5, N.c5], d: [5, 1, 2, 3, 13] },
    { p: [N.as5, N.a5, N.g5, N.a5, N.d5], d: [5, 1, 2, 3, 13] },
    { p: [N.a5, N.g5, N.f5, N.c5], d: [2, 1, 2, 7] },
  ];

  // ---- Scheduler ----
  // Each bar is 12 sub-steps. Schedule one bar at a time, starting from
  // nextNoteTime. Increment bar counter, loop pattern sequences.

  // Bar-level pattern sequencer for bass (entries are sequences of step events
  // in the SAME bar). We collapse bass duration into events.
  let bassCursor = 0;
  let leadCursor = 0;

  function scheduleBar(barStart, barIdx) {
    // Drums (8 instruments × 12 steps)
    for (let i = 0; i < 12; i++) {
      const t = barStart + i * SUBDIV;
      for (const [pat, hit] of DRUM_BEATS) {
        if (pat[i] === 'x') hit(t);
      }
    }

    // Bass — every other bar, cycle through BASS_PATS
    if (barIdx % 2 === 0) {
      const pat = BASS_PATS[bassCursor % BASS_PATS.length];
      bassCursor++;
      let acc = 0;
      for (let i = 0; i < pat.p.length; i++) {
        const dur = pat.d[i] * SUBDIV;
        playBass(barStart + acc, pat.p[i], dur * 0.92);
        acc += dur;
      }
    }

    // Lead — every 4 bars, cycle. Skip first 2 bars (intro silence).
    if (barIdx >= 2 && barIdx % 4 === 0) {
      const pat = LEAD_PATS[leadCursor % LEAD_PATS.length];
      leadCursor++;
      let acc = 0;
      for (let i = 0; i < pat.p.length; i++) {
        const dur = pat.d[i] * SUBDIV;
        playLead(barStart + acc, pat.p[i], dur * 0.85);
        acc += dur;
      }
    }
  }

  function scheduler() {
    if (!isPlaying) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    while (nextNoteTime < horizon) {
      scheduleBar(nextNoteTime, bar);
      nextNoteTime += BAR;
      bar++;
    }
  }

  // ---- Public API ----
  function start() {
    ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (isPlaying) return;
    isPlaying = true;
    bar = 0;
    bassCursor = 0;
    leadCursor = 0;
    nextNoteTime = ctx.currentTime + 0.1;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 0.2);
    scheduler();
    schedulerTimer = setInterval(scheduler, TICK);
  }

  function stop() {
    if (!isPlaying) return;
    isPlaying = false;
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    if (master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    }
  }

  function isOn() {
    return isPlaying;
  }

  /**
   * Connect the synth output to a MediaStreamDestination for recording.
   * Caller can then mix the returned stream's tracks into MediaRecorder
   * along with canvas.captureStream() for video+audio output.
   * Stream is created lazily on first call + cached.
   */
  function getMediaStream() {
    ensureContext();
    if (!mediaStreamDest) {
      mediaStreamDest = ctx.createMediaStreamDestination();
      master.connect(mediaStreamDest);
    }
    return mediaStreamDest.stream;
  }

  return { start, stop, isOn, getMediaStream, getContext: () => ctx };
}
