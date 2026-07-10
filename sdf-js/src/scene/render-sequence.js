// sdf-js/src/scene/render-sequence.js
// Structure renderer #1: sequence → funnel. Reads the IR ONLY (never 2D x/y).
// The "time dimension": camera fly-through + per-stage build-in (each stage is its OWN
// subject that drops into place via a transform.translate.y smoothstep window, staggered
// by order — needs the expr builtins from #193) + revealAt-tagged overlay labels.
import { validateIR } from './ir.js';
import { getEnvironment } from './environments.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

// area-proportional boundary radii (sqrt of magnitude), plus a tip. Length N+1.
export function magnitudeToRadii(magnitude, maxR = 1.4, tipR = 0.12) {
  const m = (magnitude || []).map((x) => Math.max(0, Number(x) || 0));
  const mMax = Math.max(...m, 1);
  const r = m.map((x) => Math.max(tipR, maxR * Math.sqrt(x / mMax)));
  r.push(tipR); // converge to a tip below the last stage
  return r;
}

// Per-stage colour: a cool blue→deep-indigo ramp down the funnel (light mouth,
// darker toward the tip — the descent reads in colour too), with the EMPHASIS
// stage in warm gold so the outcome pops against the cool family. Warm coral on
// every stage rendered muddy-brown under the studio's key light; the blue family
// is proven legible there (sphere-fill gauge).
const stageMat = (i, N, emphasized) => {
  if (emphasized)
    return {
      hue: 0.11,
      sat: 0.78,
      value: 0.95,
      metal: 0,
      glow: 0.22,
      kind: 'normal',
      roughness: 0.22,
      clearcoat: 0.6,
    };
  const k = N > 1 ? i / (N - 1) : 0;
  return {
    hue: 0.55 + 0.09 * k, // cyan-blue → indigo
    sat: 0.62 + 0.16 * k,
    value: 0.85 - 0.3 * k, // light mouth → deep tip
    kind: 'normal',
    roughness: 0.3,
    clearcoat: 0.45,
  };
};

export function renderSequence(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderSequence: invalid IR — ${v.errors.join('; ')}`);
  const env = getEnvironment(opts.env);

  const nodes = ir.nodes.map(label);
  const N = nodes.length;
  const mag = ir.magnitude || nodes.map(() => 1);
  const order = ir.order && ir.order.length === N ? ir.order : nodes.map((_, i) => i);
  const emphasis = new Set(ir.emphasis || [N - 1]);

  const stageHeight = 0.55,
    gap = 0.12;
  const radii = magnitudeToRadii(mag, 1.4, 0.12);
  const totalH = N * stageHeight + (N - 1) * gap;
  const topY = 1.6 + totalH / 2; // funnel centred around y≈1.6
  const stageY = (i) => topY - stageHeight / 2 - i * (stageHeight + gap); // centre Y of stage i
  const holdEach = 1.2; // seconds between successive stage reveals
  const drop = 0.9; // stage starts this far above its slot, then drops in

  // ONE subject per stage (a single-band frustum) so each builds in independently.
  // build-in: translate.y from (yc + drop) → yc over [revealStart, revealEnd], then holds.
  // The translate.y channel REPLACES the static y (applyTransform resolveVec3Field), so the
  // expr must produce the FULL y.
  //
  // Timing (fighting-game staging): the FORM assembles during the intro — a rapid
  // top-to-bottom cascade (0.35s per stage ≈ stages fall almost together, which
  // also keeps a falling stage from interpenetrating the settled one above) while
  // the hero/crane shots play. The DATA then reveals during the spiral tour
  // (labels per stage, below). Geometry spectacle first, narration second.
  const subjects = [];
  order.forEach((i, k) => {
    const yc = stageY(i);
    const revealStart = 0.25 + k * 0.35;
    const revealEnd = revealStart + 0.6;
    const yFull = (yc + drop).toFixed(3);
    subjects.push({
      id: `stage-${i}`,
      type: 'funnel-3d',
      args: { stages: 1, radii: [radii[i], radii[i + 1]], stageHeight, gap: 0 },
      transform: { translate: [0, yc, 0] },
      material: stageMat(i, N, emphasis.has(i)),
      animation: [
        {
          channel: 'transform.translate.y',
          expr: `${yFull} - ${drop} * smoothstep(${revealStart.toFixed(2)}, ${revealEnd.toFixed(2)}, t)`,
        },
      ],
    });
  });

  // Fly-through — fighting-game camera language (GGST / SF6 supers): hold a calm
  // reading plane most of the time, then BREAK it at the big moment. Beats:
  //   1. hero low-angle opening (monumental — looking UP at the mouth)
  //   2. crane up-and-over the rim
  //   3. spiral descent — azimuth orbits as the camera drops stage to stage,
  //      a touch of handheld shake for energy (the 3D-selling move)
  //   4. the SUPER: hard CUT to a tight low-angle punch-in on the gold outcome
  //      stage — heavy shake + an exposure pop that settles (SF6 punish-counter)
  //   5. payoff pull-back — the whole story in one wide frame
  const midY = topY - totalH / 2;
  const emphasisIdx = ir.emphasis && ir.emphasis.length ? ir.emphasis[0] : N - 1;
  const goldY = stageY(emphasisIdx);
  const shots = [
    // 1 — hero low angle, worm's-eye at the mouth
    {
      duration: 0.9,
      pos: [2.3, 0.55, 5.2],
      target: [0, topY - 0.2, 0],
      fov: 54,
      aperture: 0.55, // hero: shallow focus on the subject
      focalDistance: 5.5,
      ease: 'out',
    },
    // 2 — crane up and over the rim
    {
      duration: 1.3,
      pos: [0.9, topY + 2.5, 4.4],
      target: [0, topY - 0.3, 0],
      fov: 50,
      transition: 'blend',
      aperture: 0.3,
      focalDistance: 5,
      ease: 'inout',
    },
  ];
  // 3 — spiral descent: orbit ~0.9 rad per stage while dropping
  for (let i = 0; i < N; i++) {
    const y = stageY(i);
    const theta = 0.9 * (i + 1);
    const dist = Math.max(2.6, radii[i] * 3.2 + 2.2);
    shots.push({
      duration: holdEach,
      pos: [Math.sin(theta) * dist, y + 0.85, Math.cos(theta) * dist],
      target: [0, y, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.25,
      focalDistance: dist,
      shake: 0.05,
      ease: 'smooth',
    });
  }
  // 4 — the super: hard cut, tight low-angle punch-in on the gold stage.
  // Camera stays above the floor (the emphasis stage can sit near y=0) while
  // still looking slightly UP at the stage for the hero read.
  const superAt = shots.reduce((s, sh) => s + sh.duration, 0); // presentation time of the impact
  shots.push({
    duration: 1.0,
    pos: [0.55, Math.max(goldY - 0.15, 0.14), 1.9],
    target: [0, goldY + 0.12, 0],
    fov: 40,
    transition: 'cut',
    beat: 'super',
    aperture: [0.9, 0.45], // rack focus: the world falls away, the subject stays
    focalDistance: 2,
    shake: [0.5, 0.06], // impact-then-settle
    ambient: [0.15, 1.0], // spotlight crash: surroundings collapse on the hit, then recover
    exposure: [1.45, 1.0],
    ease: 'out',
  });
  // 5 — payoff pull-back: the whole funnel, every stage revealed, gold in context.
  // In an open-world env, pull back further — the reveal includes the WORLD.
  const payoffDist = (totalH * 1.7 + radii[0] * 2.6) * (env ? env.payoffZoom : 1);
  shots.push({
    duration: 2.4,
    pos: [1.4, midY + 1.1 + (env ? 0.5 : 0), payoffDist],
    target: [0, midY + 0.2, 0],
    fov: 44,
    transition: 'blend',
    aperture: 0.12, // deep focus: the whole story stays sharp
    focalDistance: payoffDist,
    ease: 'out',
  });

  // labels → overlay, reveal-tagged as the spiral tour reaches each stage
  // (introLead = hero 0.9s + crane 1.3s before the descent begins).
  const introLead = 2.2;
  const overlay = [
    { text: String(ir.title || nodes[0]).toUpperCase(), anchor: [0, topY + 1.4, 0], role: 'title' },
  ];
  order.forEach((i, k) => {
    const y = stageY(i);
    const revealAt = introLead + k * holdEach + 0.45; // as the tour reaches this stage
    overlay.push({
      text: nodes[i],
      anchor: [radii[i] + 0.5, y, 0],
      role: 'card',
      align: 'left',
      revealAt,
    });
    overlay.push({
      text: String(mag[i]),
      anchor: [0, y, radii[i] + 0.2],
      role: 'value',
      radius: emphasis.has(i) ? 0.5 : 0.36,
      revealAt,
    });
  });

  return {
    v: 1,
    name: `(sequence) ${ir.title || 'funnel'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots, hitstops: [{ at: superAt + 0.02, hold: 0.14 }] },
    defaults: env ? env.defaults : { stage: { size: [16, 12, 11] } },
  };
}

// IR → 2D funnel atom args (for the flat counterpart / blind test)
export function renderSequence2d(ir) {
  const nodes = ir.nodes.map(label);
  const mag = ir.magnitude || nodes.map(() => 1);
  return {
    type: 'funnel',
    args: { title: ir.title || '', stages: nodes.map((n, i) => ({ label: n, value: mag[i] })) },
  };
}
