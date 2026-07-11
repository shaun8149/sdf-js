// sdf-js/src/scene/render-hold.js
// Structure renderer #6: hold → FLOAT-SCREEN WALL. Reads the IR ONLY.
//
// A hold page has no chartable structure — a cover, a narration beat, a product
// tour. The 3D form for "just words" is the JUMBOTRON: big volumetric screens
// floating in the arena (a beveled shell + an inset glowing face — real bodies
// with thickness, never flat cards), one per bullet, staggered in depth so the
// wall has parallax. The words themselves ride the DOM overlay, but sized to
// the screen via the depth-scaled font pass in figure-core (two-text-systems
// rule intact: geometry carries the SCREEN, the DOM carries the TEXT).
//
// Fighting-game grammar, hold variation — the INTERLUDE:
//   1. slow push-in on the master title screen
//   2. drift along the screen wall while bullet screens swing in one per beat
//   3. payoff pull-back framing the whole wall (auto-tagged 'station')
// No super — hold pages never punch; they set up the next station's hit.
import { validateIR } from './ir.js';
import { getEnvironment } from './environments.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

const SHELL_MAT = {
  hue: 0.62,
  sat: 0.4,
  value: 0.3,
  kind: 'normal',
  roughness: 0.24,
  clearcoat: 0.6,
};
const faceMat = (emphasized) =>
  emphasized
    ? {
        hue: 0.11,
        sat: 0.72,
        value: 0.95,
        glow: 0.3,
        kind: 'normal',
        roughness: 0.3,
        clearcoat: 0.4,
      }
    : {
        hue: 0.58,
        sat: 0.45,
        value: 0.62,
        glow: 0.18,
        kind: 'normal',
        roughness: 0.32,
        clearcoat: 0.4,
      };

// One volumetric screen: beveled shell + glowing face inset just proud of the
// front plane. Two subjects — thickness reads from every angle, and the lit
// face gives the "screen" read without any texture machinery.
function screen(id, [x, y, z], [w, h], yaw, emphasized, anim) {
  const shell = {
    id: `${id}-shell`,
    type: 'rounded_box',
    args: { dims: [w, h, 0.22], cornerR: 0.07 },
    transform: { translate: [x, y, z], ...(yaw ? { rotate: [0, yaw, 0] } : {}) },
    material: SHELL_MAT,
  };
  const face = {
    id: `${id}-face`,
    type: 'rounded_box',
    args: { dims: [w - 0.22, h - 0.22, 0.05], cornerR: 0.05 },
    // face sits proud of the shell front (+z toward the default camera)
    transform: {
      translate: [
        x + (yaw ? -Math.sin(yaw) * 0.1 : 0),
        y,
        z + (yaw ? Math.cos(yaw) * 0.1 : 0.1),
      ],
      ...(yaw ? { rotate: [0, yaw, 0] } : {}),
    },
    material: faceMat(emphasized),
  };
  if (anim) {
    shell.animation = [{ channel: 'transform.translate.y', expr: anim(y) }];
    face.animation = [{ channel: 'transform.translate.y', expr: anim(y) }];
  }
  return [shell, face];
}

export function renderHold(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderHold: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'hold')
    throw new Error(`renderHold: expected structure 'hold', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);

  const bullets = (ir.nodes || []).map(label).filter(Boolean);
  const N = bullets.length;
  const emphasis = new Set(ir.emphasis || []);
  const introLead = 2.2;
  const holdEach = 1.0;

  // Drop-in build: screens settle from above as their beat arrives. The shape
  // is the assembleDeck-transplant-safe smoothstep drop.
  const dropExpr = (k) => (yFinal) => {
    const drop = 0.7;
    const t0 = introLead + k * holdEach - 0.35;
    const t1 = t0 + 0.55;
    return `${(yFinal + drop).toFixed(3)} - ${drop.toFixed(3)} * smoothstep(${t0.toFixed(2)}, ${t1.toFixed(2)}, t)`;
  };

  // ---- geometry: the jumbotron wall ---------------------------------------------
  // Master title screen high centre; bullet screens in two columns fanned
  // around it, staggered in z so the wall reads as a hovering fleet, each
  // yawed a few degrees toward the centre line.
  const titleW = Math.max(4.2, 2.6 + (String(ir.title || '').length > 8 ? 1.8 : 0));
  const subjects = [
    ...screen('title', [0, N > 0 ? 3.35 : 1.9, N > 0 ? -0.8 : 0], [titleW, 1.3], 0, false, null),
  ];
  // One layout, two consumers: the screen geometry AND the overlay text anchors
  // read the same positions, so they can never drift apart. Three-row walls
  // tighten the row step and raise the base so the bottom row's screens clear
  // the platform (screen half-height 0.46 + margin).
  const rows = Math.ceil(N / 2);
  const rowStep = rows > 2 ? 1.08 : 1.15;
  const baseY = rows > 2 ? 2.85 : 2.35;
  const bulletPos = bullets.map((_, k) => {
    const col = k % 2 === 0 ? -1 : 1; // left, right, left, right…
    const row = Math.floor(k / 2);
    return {
      col,
      x: col * 2.05,
      y: baseY - row * rowStep,
      z: -0.3 + row * 0.55 + (col < 0 ? 0 : 0.25), // stagger depth → parallax
    };
  });
  bulletPos.forEach((p, k) => {
    const yaw = p.col * -0.16; // angled inward, facing the aisle
    subjects.push(
      ...screen(`b${k}`, [p.x, p.y, p.z], [3.0, 0.92], yaw, emphasis.has(k), dropExpr(k)),
    );
  });

  // ---- camera: three quiet beats down the aisle -----------------------------------
  const driftDur = Math.max(2.2, N * holdEach + 0.8);
  const wallTop = N > 0 ? 3.35 : 1.9;
  const shots = [
    {
      duration: introLead,
      pos: [0, wallTop - 0.15, 6.2],
      target: [0, wallTop - 0.35, 0],
      fov: 42,
      aperture: 0.35,
      focalDistance: 6.0,
      ease: 'out',
    },
    {
      duration: driftDur,
      pos: [-1.5, 2.0, 5.4],
      target: [0.3, N > 0 ? 2.0 : 1.8, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.28,
      focalDistance: 5.4,
      ease: 'smooth',
    },
    {
      duration: 2.0,
      pos: [0.6, 2.6, 7.6 * (env ? env.payoffZoom : 1)],
      target: [0, N > 0 ? 2.2 : 1.8, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.12,
      focalDistance: 7.6,
      ease: 'out',
    },
  ];

  // ---- overlay: text mapped onto the screens --------------------------------------
  // role 'screen' → figure-core renders it as big depth-scaled type with no
  // chip background (the glowing face IS the background).
  const overlay = [
    {
      text: String(ir.title || bullets[0] || ''),
      anchor: [0, N > 0 ? 3.35 : 1.9, N > 0 ? -0.7 : 0.15],
      role: 'title',
    },
  ];
  bullets.forEach((b, k) => {
    const p = bulletPos[k];
    overlay.push({
      text: b,
      anchor: [p.x, p.y, p.z + 0.16],
      role: 'screen',
      revealAt: introLead + k * holdEach + 0.25,
    });
  });

  return {
    v: 1,
    name: `(hold) ${ir.title || 'interlude'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots },
    defaults: env ? env.defaults : { stage: { size: [14, 10, 10] } },
  };
}
