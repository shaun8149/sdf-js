// sdf-js/src/scene/render-image.js
// Structure renderer #7: image → THE FLOATING SCREEN (浮屏).
//
// Some source pages are irreducibly 2D — app screenshots, dense diagrams,
// annotated photos. Forcing them into geometry loses the page; skipping them
// loses the deck. The floating screen shows the page AS ITSELF: a physical
// white-bezel screen standing in the 3D world (subjects: analytic-safe slabs
// that occupy space, cast shadow, and survive every camera), with the ACTUAL
// page image mounted on its face by the host (overlay role 'plate' — a DOM
// <img> perspective-mapped to the screen's four corners each frame, so it is
// pixel-crisp at native resolution and costs the shader nothing).
//
// Division of labour (two-text-systems rule, extended to pixels): the world
// carries the screen's BODY; the page's pixels ride the DOM layer, projected.
// IR: { structure:'image', title, image:'assets/…png', nodes?: [captions] }.
import { validateIR } from './ir.js';
import { getEnvironment } from './environments.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

// Screen sized to the theater rail (~13): as big as fits under the frame's
// top edge — the page must be READABLE, it is the act's entire content.
// ir.aspect picks the panel shape: '4:3' (2013 deck, 1600×1200 pages) is the
// default; '16:9' (2015 deck, 1600×900) widens the panel instead of letterboxing.
const W = 9.2;

export function renderImage(ir, opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderImage: invalid IR — ${v.errors.join('; ')}`);
  if (ir.structure !== 'image')
    throw new Error(`renderImage: expected structure 'image', got '${ir.structure}'`);
  const env = getEnvironment(opts.env);
  // literal dims (not W*ratio arithmetic): float ulps in computed values would
  // churn the 2013 goldens byte-for-byte without changing a single pixel
  const H = ir.aspect === '16:9' ? 5.175 : 6.9;
  const CY = ir.aspect === '16:9' ? 3.4875 : 4.35; // bottom edge ~0.9 above floor

  const subjects = [
    // the screen body: one white slab, slightly proud of the image plane so
    // side views read a real panel, not a poster in the void
    {
      id: 'screen',
      type: 'rounded_box',
      args: { dims: [W + 0.55, H + 0.55, 0.3], cornerR: 0.1 },
      transform: { translate: [0, CY, -0.22] },
      material: {
        hue: 0.6,
        sat: 0.03,
        value: 0.92,
        kind: 'normal',
        roughness: 0.35,
        clearcoat: 0.4,
      },
    },
    // the stand: a single quiet pylon — the screen STANDS in the world
    {
      id: 'stand',
      type: 'box',
      args: { dims: [1.1, Math.max(0.4, CY - H / 2), 0.5] },
      transform: { translate: [0, (CY - H / 2) / 2, -0.25] },
      material: { hue: 0.6, sat: 0.05, value: 0.5, kind: 'normal', roughness: 0.6 },
    },
  ];

  const overlay = [
    { text: String(ir.title || ''), anchor: [0, CY + H / 2 + 1.0, 0], role: 'title' },
    // the page itself — the host mounts ir.image onto this quad. It lights up
    // DURING the arriving dolly (negative local reveal → deck shifts it to
    // just before the act starts): you fly toward a lit screen, not a dead one.
    {
      role: 'plate',
      image: String(ir.image || ''),
      anchor: [0, CY, -0.06], // ON the slab's front face — off-axis views stay parallax-free
      w: W,
      h: H,
      revealAt: -1.0,
    },
  ];
  // optional spoken captions ride the subtitle column like everywhere else
  (ir.nodes || [])
    .map(label)
    .filter(Boolean)
    .forEach((b, k) => {
      overlay.push({ text: b, anchor: [0, 1.2, 2], role: 'screen', revealAt: 1.4 + k * 1.0 });
    });

  // three quiet frontal beats — the page deserves a still reading, not a tour.
  // Distances follow the panel HEIGHT (a 16:9 panel is shorter → come closer);
  // width is never the binding constraint at these fovs.
  const dwell = Math.max(3.2, 1.4 + (ir.nodes || []).length * 1.0);
  // literal distances per aspect (float-arithmetic here would churn goldens)
  const [d1, d2, d3] = H > 6 ? [12.6, 11.6, 12.8] : [10.6, 9.6, 10.8];
  const shots = [
    {
      duration: 1.6,
      pos: [0.5, CY - 0.3, d1],
      target: [0, CY - 0.1, 0],
      fov: 46,
      aperture: 0.22,
      focalDistance: d1,
      ease: 'out',
    },
    {
      duration: dwell,
      pos: [-0.7, CY - 0.2, d2],
      target: [0.1, CY, 0],
      fov: 46,
      transition: 'blend',
      aperture: 0.18,
      focalDistance: d2,
      ease: 'smooth',
    },
    {
      duration: 2.0,
      pos: [0.3, CY, d3 * (env ? env.payoffZoom : 1)],
      target: [0, CY - 0.1, 0],
      fov: 45,
      transition: 'blend',
      aperture: 0.12,
      focalDistance: d3,
      ease: 'out',
    },
  ];

  return {
    v: 1,
    name: `(image) ${ir.title || 'page'}${env ? ' · alpine' : ''}`,
    subjects: env ? [...subjects, ...env.subjects] : subjects,
    overlay,
    cameraSequence: { loop: false, shots },
    defaults: env ? env.defaults : { stage: { size: [16, 12, 12] } },
  };
}
