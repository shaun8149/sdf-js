// sdf-js/scripts/test-figure-pause.mjs — auto-play pause vs shader warm-up.
import { createPauseController } from '../apps/present/figure-core.js';

let pass = 0;
let fail = 0;
const ok = (condition, name) =>
  condition ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.log(`  ✗ ${name}`));
const same = (actual, expected, name) =>
  ok(JSON.stringify(actual) === JSON.stringify(expected), `${name} (${JSON.stringify(actual)})`);

console.log('=== figure pause controller ===\n');

{
  const calls = [];
  const glyph = [];
  const pc = createPauseController({
    setSequencePaused: (p) => calls.push(p),
    setGlyphVisible: (p) => glyph.push(p),
  });
  pc.setWarming(true);
  pc.setPaused(true);
  pc.setWarming(false);
  same(calls, [true, true], 'user pause during warm-up is re-applied after warm-up reset');
  same(glyph, [true], 'pause glyph shows the stored user intent');
  ok(pc.paused === true && pc.warming === false, 'controller remains paused after warm-up');
}

{
  const calls = [];
  let renders = 0;
  const glyph = [];
  const pc = createPauseController({
    setSequencePaused: (p) => calls.push(p),
    requestRender: () => renders++,
    setGlyphVisible: (p) => glyph.push(p),
  });
  pc.setWarming(true);
  pc.setPaused(true);
  pc.setPaused(false);
  pc.setWarming(false);
  same(calls, [true], 'resume intent during warm-up never unpauses the hidden clock');
  ok(renders === 1, 'warm-up completion wakes playback when no user pause remains');
  same(glyph, [true, false], 'glyph tracks pause then resume intent');
}

{
  const calls = [];
  let renders = 0;
  const pc = createPauseController({
    setSequencePaused: (p) => calls.push(p),
    requestRender: () => renders++,
  });
  pc.setPaused(true);
  pc.setPaused(false);
  same(calls, [true, false], 'normal pause/resume forwards to studio immediately');
  ok(renders === 1, 'normal resume requests a frame');
}

{
  const calls = [];
  const glyph = [];
  const pc = createPauseController({
    setSequencePaused: (p) => calls.push(p),
    setGlyphVisible: (p) => glyph.push(p),
  });
  pc.setPaused(true);
  pc.reset();
  same(calls, [true], 'scene reset clears local pause without poking studio before rebind');
  same(glyph, [true, false], 'scene reset hides stale pause glyph');
  ok(pc.paused === false, 'scene reset clears pause intent');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
