// sdf-js/src/scene/assemble-deck.js
// P3 — deck assembly: MULTIPLE IRs → ONE continuous 3D world (one SceneData).
//
// The thesis move: a deck is not N slides, it is one world with N stations.
// Each slide's structure renders at its own station along the deck axis; the
// camera plays each station's five-beat grammar in place, then a TRANSIT shot
// whips to the next station (the fighting-game stage transition — one arena
// finishes, the camera slings to the next).
//
// Division of labour: structure renderers stay pure (they render at the origin
// on their own clock); THIS module owns placement — it shifts each station's
// subjects/labels in SPACE (station origin) and its build-ins/reveals/camera
// in TIME (station start). Build-in exprs are strings the renderers bake, so
// the shift rewrites them with a STRICT parser that throws on any unknown
// shape (fail loud, never silently mis-animate).
import { renderIR } from './render-ir.js';
import { getEnvironment } from './environments.js';

// Every structure renderer emits build-ins of exactly this shape:
//   "<A> - <D> * smoothstep(<t0>, <t1>, t)"   (drop from above)
//   "<A> + <D> * smoothstep(<t0>, <t1>, t)"   (erupt from below)
// Shift: A += dy (the y-channel constant), t0/t1 += dt.
const EXPR_RE = /^(-?[\d.]+) (\+|-) ([\d.]+) \* smoothstep\((-?[\d.]+), (-?[\d.]+), t\)$/;
export function shiftBuildInExpr(expr, dy, dt) {
  const m = String(expr).match(EXPR_RE);
  if (!m) throw new Error(`assemble-deck: unrecognized build-in expr shape: "${expr}"`);
  const [, A, sign, D, t0, t1] = m;
  return `${(Number(A) + dy).toFixed(3)} ${sign} ${D} * smoothstep(${(Number(t0) + dt).toFixed(2)}, ${(Number(t1) + dt).toFixed(2)}, t)`;
}

const addV = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const seqDuration = (shots) => shots.reduce((s, sh) => s + (sh.duration || 0), 0);

/**
 * assembleDeck(deck, opts) → SceneData
 * @param {object} deck  { title?, slides: IR[] }
 * @param {object} opts  { env?, stride?: station spacing (default 16) }
 */
export function assembleDeck(deck, opts = {}) {
  if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0)
    throw new Error('assembleDeck: deck.slides must be a non-empty array of IRs');
  const env = getEnvironment(opts.env);
  const stride = opts.stride ?? 16;

  const subjects = [];
  const overlay = [];
  const shots = [];
  let clock = 0;
  let prevPayoff = null;

  deck.slides.forEach((ir, k) => {
    // Render the station at the origin on its own clock, then transplant.
    const st = renderIR(ir); // no env here — the deck owns the world
    const origin = [k * stride, 0, 0];

    // Transit shot: whip from the previous station's payoff toward this one's
    // hero position (fast lateral sling, a touch of shake — the stage change).
    const hero = st.cameraSequence.shots[0];
    const heroPos = addV(hero.pos, origin);
    const heroTarget = addV(hero.target, origin);
    if (k > 0) {
      const dur = 1.2;
      shots.push({
        duration: dur,
        pos: [
          (prevPayoff.pos[0] + heroPos[0]) / 2,
          Math.max(prevPayoff.pos[1], heroPos[1]) + 1.6,
          Math.max(prevPayoff.pos[2], heroPos[2]) + 2.0,
        ],
        target: [(prevPayoff.target[0] + heroTarget[0]) / 2, heroTarget[1], heroTarget[2]],
        fov: 50,
        transition: 'blend',
        aperture: 0,
        focalDistance: stride * 0.8,
        shake: [0.14, 0.05], // sling settles as the next station arrives
        ease: 'inout',
      });
      clock += dur;
    }

    // Subjects: shift origin (static translate) + rewrite build-ins (y & time).
    for (const s of st.subjects) {
      const moved = JSON.parse(JSON.stringify(s));
      moved.id = `s${k}-${s.id}`;
      moved.transform = moved.transform || {};
      moved.transform.translate = addV(moved.transform.translate || [0, 0, 0], origin);
      if (Array.isArray(moved.animation)) {
        moved.animation = moved.animation.map((a) => ({
          ...a,
          expr: shiftBuildInExpr(
            a.expr,
            a.channel === 'transform.translate.y' ? origin[1] : 0,
            clock,
          ),
        }));
      }
      subjects.push(moved);
    }

    // Overlay: shift anchors + reveal times; station titles reveal with their slide.
    for (const o of st.overlay || []) {
      overlay.push({
        ...o,
        anchor: addV(o.anchor, origin),
        revealAt: (o.revealAt ?? 0) + clock,
      });
    }

    // Camera: shift shots in space + append (time shift is implicit — durations chain).
    st.cameraSequence.shots.forEach((sh) => {
      shots.push({ ...sh, pos: addV(sh.pos, origin), target: addV(sh.target, origin) });
    });
    const stationDur = seqDuration(st.cameraSequence.shots);
    clock += stationDur;
    const last = st.cameraSequence.shots[st.cameraSequence.shots.length - 1];
    prevPayoff = { pos: addV(last.pos, origin), target: addV(last.target, origin) };
  });

  return {
    v: 1,
    name: `(deck) ${deck.title || `${deck.slides.length} stations`}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots },
    // One shared open world — no per-station stage room (walls would slice the
    // deck axis). Ground/sky come from the environment or the page defaults.
    defaults: env
      ? env.defaults
      : {
          camera: {
            yaw: 0,
            pitch: -0.1,
            distance: 12,
            focal: 1.2,
            targetX: 0,
            targetY: 2,
            targetZ: 0,
          },
          light: { azimuth: 0.5, altitude: 0.7, distance: 40, intensity: 1.1 },
        },
  };
}
