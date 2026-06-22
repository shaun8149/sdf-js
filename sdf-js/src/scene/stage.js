// =============================================================================
// stage.js — `defaults.stage` → studio-room expander (SceneData → SceneData).
// -----------------------------------------------------------------------------
// A scene-level "stage": wrap the subjects in an enclosed studio room so they're
// lit BY the room (ceiling softbox panels → area lights) and metals reflect the
// actual walls (reflection-retrace), instead of floating in open sky. This is
// what turns a flat object render into a premium product/keynote shot.
//
// Opt in with `defaults.stage: true` (sensible studio defaults) or an object for
// overrides. The expander, a sibling of expandChartLabels (run at scene-load),
// injects:
//   • room geometry — floor / ceiling / back + 2 side walls (front left open for
//     the camera), all plain boxes (the renderer needs no new primitive);
//   • two emissive ceiling panels (cool key + warm fill) as visible softboxes;
//   • two entries in `defaults.lights[]` at the panels (area lights — see
//     studio.js) so the panels actually illuminate with soft shadows;
//   • `defaults.studioBg='dark'` (dramatic cyclorama) if unset;
//   • a default interior cameraSequence if the scene has none (studio camera
//     ignores defaults.camera for large bounded scenes — a sequence is the
//     reliable way to frame the room).
//
// Everything is additive + namespaced (`__stage_*`), and absent `defaults.stage`
// returns the scene untouched.
// =============================================================================

const box = (id, dims, translate, material) => ({
  id,
  type: 'box',
  args: { dims },
  transform: { translate },
  material,
});

// Default studio palette — neutral mid-grey room so colored subjects + the warm/
// cool panels read against it. Tuned to not blow out under the panel lights.
const WALL = { hue: 0.6, sat: 0.05, value: 0.5, metal: 0, glow: 0 };
const FLOOR = { hue: 0.6, sat: 0.04, value: 0.42, metal: 0.1, glow: 0 };
const CEIL = { hue: 0.6, sat: 0.04, value: 0.34, metal: 0, glow: 0 };
const PANEL_COOL = { hue: 0.6, sat: 0.05, value: 1.0, metal: 0, glow: 1.0 };
const PANEL_WARM = { hue: 0.09, sat: 0.06, value: 1.0, metal: 0, glow: 0.9 };

export function expandStage(sceneData) {
  if (!sceneData || !sceneData.defaults || !sceneData.defaults.stage) return sceneData;
  if (!Array.isArray(sceneData.subjects)) return sceneData;

  const cfg = sceneData.defaults.stage === true ? {} : sceneData.defaults.stage;
  const [w, h, d] = cfg.size || [12, 5, 14];
  const t = 0.3; // wall thickness
  const wall = cfg.wall || WALL;
  const floor = cfg.floor || FLOOR;

  // Room shell. Front (+z) left open for the camera; floor top sits at y=0 so
  // subjects authored on the ground plane rest on it.
  const room = [
    box('__stage_floor', [w + 2 * t, t, d + 2 * t], [0, -t / 2, 0], floor),
    box('__stage_ceiling', [w + 2 * t, t, d + 2 * t], [0, h + t / 2, 0], CEIL),
    box('__stage_wall_back', [w + 2 * t, h + 2 * t, t], [0, h / 2, -d / 2 - t / 2], wall),
    box('__stage_wall_left', [t, h + 2 * t, d + 2 * t], [-w / 2 - t / 2, h / 2, 0], wall),
    box('__stage_wall_right', [t, h + 2 * t, d + 2 * t], [w / 2 + t / 2, h / 2, 0], wall),
  ];

  // Two ceiling softbox panels (cool key left, warm fill right) — visible
  // emissive geometry the metals reflect.
  const panelY = h - 0.12;
  const px = w * 0.2;
  const panelDims = [w * 0.34, 0.15, d * 0.22];
  room.push(box('__stage_panel_l', panelDims, [-px, panelY, 0], PANEL_COOL));
  room.push(box('__stage_panel_r', panelDims, [px, panelY, 0], PANEL_WARM));

  // The matching area lights (just below each panel, aimed down into the room).
  const stageLights = [
    {
      pos: [-px, h - 0.4, 0],
      color: [0.78, 0.84, 1.0],
      intensity: cfg.intensity ?? 3.0,
      radius: 2.3,
    },
    {
      pos: [px, h - 0.4, 0],
      color: [1.0, 0.9, 0.74],
      intensity: cfg.intensity ?? 2.8,
      radius: 2.3,
    },
  ];

  const defaults = { ...sceneData.defaults };
  // Merge lights (existing scene lights first), cap at the shader's 4.
  const existing = Array.isArray(defaults.lights) ? defaults.lights : [];
  defaults.lights = [...existing, ...stageLights].slice(0, 4);
  if (defaults.studioBg == null) defaults.studioBg = 'dark';
  // validate() requires defaults.camera even though studio frames via the
  // sequence below — supply a valid neutral one if the scene authored none.
  if (defaults.camera == null) {
    defaults.camera = {
      yaw: 0,
      pitch: 0.2,
      distance: d / 2 + 3,
      focal: 1.6,
      targetX: 0,
      targetY: h * 0.16,
      targetZ: 0,
    };
  }
  // Soften the sun so the room panels carry the mood (keep a low key for shape).
  if (defaults.light == null) {
    defaults.light = { altitude: 0.85, azimuth: 0.6, distance: 50, intensity: 0.5 };
  }

  const out = { ...sceneData, defaults, subjects: [...room, ...sceneData.subjects] };

  // Default interior camera (only if the scene authored none). studio ignores
  // defaults.camera for large bounded scenes, so we drive it with a sequence.
  if (!out.cameraSequence && !cfg.noCamera) {
    out.cameraSequence = {
      loop: false,
      shots: [
        {
          duration: 0.05,
          pos: [w * 0.26, h * 0.62, d / 2 + 1.5],
          target: [0, h * 0.16, 0],
          fov: 42,
          aperture: 0,
          focalDistance: d / 2 + 2,
          ease: 'linear',
        },
      ],
    };
  }

  return out;
}
