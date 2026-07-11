// sdf-js/scripts/test-render-hold.mjs — hold (title-card interlude) invariants.
// Guards the no-structure page path: covers/narration/product-tour pages must
// render as a quiet station (stele + pips, text on the DOM overlay), survive
// deck transplant (build-in exprs must parse under assembleDeck's STRICT
// shifter), and pass through the renderIR seam with a station beat tag.
import { validateIR } from '../src/scene/ir.js';
import { renderHold } from '../src/scene/render-hold.js';
import { renderIR } from '../src/scene/render-ir.js';
import { assembleDeck, shiftBuildInExpr } from '../src/scene/assemble-deck.js';
import { expandAndCompile } from '../src/runtime/apply-studio-scene.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== render-hold (title-card interlude) ===\n');

// ---- IR validation --------------------------------------------------------------
ok(validateIR({ structure: 'hold', title: '封面', nodes: [] }).ok, 'bare cover (empty nodes) is valid');
ok(
  validateIR({ structure: 'hold', title: 't', nodes: ['a', 'b'] }).ok,
  'hold with bullets is valid',
);
ok(!validateIR({ structure: 'hold', title: 't' }).ok, 'hold without nodes array is rejected');
ok(
  !validateIR({ structure: 'sequence', nodes: [] }).ok,
  'other structures still require non-empty nodes',
);

// ---- bare cover ------------------------------------------------------------------
{
  const s = renderHold({ structure: 'hold', title: '最懂你的头条', nodes: [] });
  ok(
    s.subjects.some((x) => x.id === 'mono-title'),
    'cover renders the black title monolith',
  );
  ok(
    s.subjects.filter((x) => x.id.startsWith('floater-')).length >= 4,
    'distant black rocks float behind the stage (the deck motif)',
  );
  ok(s.overlay.length === 1 && s.overlay[0].role === 'title', 'cover overlay is the title only');
  ok(s.cameraSequence.shots.length === 3, 'three quiet beats');
  ok(
    s.subjects.filter((x) => x.id.startsWith('stone-')).length === 0,
    'no bullet stones on a bare cover',
  );
}

// ---- bullets ----------------------------------------------------------------------
const IR = {
  structure: 'hold',
  title: '投资亮点',
  nodes: ['市场', '引擎', '技术', '粘性', '布局', '团队'],
  emphasis: [5],
};
{
  const s = renderHold(IR);
  const stones = s.subjects.filter((x) => /^stone-\d+$/.test(x.id));
  ok(stones.length === 6, 'one black stone per bullet (the COUNT is geometry)');
  ok(
    stones.every((x) => x.args.dims[2] >= 0.3),
    'stones are real bodies with depth, not plaques',
  );
  ok(
    s.overlay.filter((o) => o.role === 'screen').length === 6,
    'one stage-layer bullet per point (screen-space typography)',
  );
  const reveals = s.overlay.filter((o) => o.role === 'screen').map((o) => o.revealAt);
  ok(
    reveals.every((t, i) => i === 0 || t > reveals[i - 1]),
    'bullet reveals are staggered',
  );
  ok(
    JSON.stringify(stones[5].material) !== JSON.stringify(stones[0].material),
    'emphasized bullet stone is gold',
  );
  // deck-transplant safety: every build-in expr (drop + idle bob tails on the
  // floaters) must parse under the STRICT shifter
  let allShift = true;
  const animated = s.subjects.filter((x) => x.animation);
  ok(animated.length >= 10, 'stones drop in and floaters bob (animated bodies)');
  for (const p of animated) {
    try {
      shiftBuildInExpr(p.animation[0].expr, 2.5, 10);
    } catch (e) {
      allShift = false;
    }
  }
  ok(allShift, 'all build-in exprs survive assembleDeck expr shifting');
}

// ---- renderIR seam -----------------------------------------------------------------
{
  const s = renderIR(IR, { stage: true });
  const last = s.cameraSequence.shots[s.cameraSequence.shots.length - 1];
  ok(last.beat === 'station', 'renderIR tags the payoff as a station beat');
  ok(
    Array.isArray(s.defaults.lights) && s.defaults.lights.length > 0,
    'stagePreset applies through the seam (spotlight rig present)',
  );
  ok(!!expandAndCompile(s).sdf, 'staged hold scene compiles to an SDF');
}

// ---- deck assembly with hold stations ----------------------------------------------
{
  const deck = {
    title: 'bp',
    slides: [
      { structure: 'hold', title: '封面', nodes: [] },
      IR,
      { structure: 'magnitude', title: '市场', nodes: ['A', 'B', 'C'], magnitude: [3, 2, 1] },
    ],
  };
  let scene = null;
  try {
    scene = assembleDeck(deck, { stage: true });
  } catch (e) {
    console.log('   assembleDeck threw:', e.message);
  }
  ok(!!scene, 'deck with hold stations assembles (expr shifter accepts hold build-ins)');
  if (scene) {
    ok(scene.deckWindows.length === 3 + 2 + 1, 'hold stations get their own windows');
    ok(!!expandAndCompile(scene).sdf, 'assembled deck compiles');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
