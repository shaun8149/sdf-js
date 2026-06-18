// =============================================================================
// scene/spec.js — SceneData v1 validator + type tables
// -----------------------------------------------------------------------------
// Single source of truth (human-facing) is `SPEC.md`. This file is the
// executable counterpart: validation rules 1-20 implemented as `validate()`,
// plus enum tables consumed by `compile.js` / `serialize.js`.
//
// API:
//   import { validate, PRIMITIVE_TYPES, BOOLEAN_OPS, DOMAIN_OPS, ... } from 'sdf-js/src/scene/spec.js';
//   const { ok, errors, warnings } = validate(sceneData);
//
// `validate()` does NOT throw; it returns a structured result. Callers
// (`parse()`, `compile()`) decide whether to error or proceed.
// =============================================================================

// =============================================================================
// Enum tables
// =============================================================================

// Primitives — match SPEC.md "Primitive registry (v1 set)" exactly.
// `extrude` / `revolve` / `extrude_to` are listed here even though they wrap a
// 2D source; compile.js dispatches them as pseudo-primitives.
export const PRIMITIVE_TYPES = new Set([
  // 2D base
  'circle',
  'ellipse',
  'rectangle',
  'rounded_rectangle',
  'triangle',
  'hexagon',
  'polygon',
  'star',
  'heart',
  'arc',
  'segment',
  'ring',
  'moon',
  'cross',
  'rounded_cross',
  'pie',
  'pie_slice',
  'horseshoe',
  'egg',
  'trapezoid',
  'isosceles_trapezoid',
  'parallelogram',
  'rhombus',
  'oriented_box',
  'quadratic_bezier',
  // 2D legacy / niche
  'flower',
  'line',
  'slab',
  'rounded_x',
  'vesica',
  // Community 2D ports (Track 4 — /port-shader pipeline dogfood)
  'cut-disk',
  // Community 2D ports (Track 4 batch — 2026-05-27: pentagon family + parabola + chamfer)
  'pentagon',
  'octogon',
  'hexagram',
  'chamfer-box',
  'parabola',
  // 3D base
  'sphere',
  'box',
  'rounded_box',
  'torus',
  'capsule',
  'cylinder',
  'capped_cylinder',
  'cone',
  'capped_cone',
  'ellipsoid',
  'plane',
  // 3D decorative + Platonic
  'pyramid',
  'slab3',
  'wireframe_box',
  'tri_prism',
  'prism',
  'tetrahedron',
  'octahedron',
  'dodecahedron',
  'icosahedron',
  // Community-ported (see src/scene/components/community/)
  'solid-angle',
  'link',
  'capped-torus',
  'hex-prism',
  'octagon-prism',
  'round-cone',
  'rhombus',
  'horseshoe',
  'u-shape',
  // Atlas scene atoms (composites; see src/scene/components/atoms/)
  'moon',
  'star',
  'sun',
  'cloud-puff',
  'tree-pine',
  'tree-broadleaf',
  'cottage',
  'flag-on-pole',
  'bird-silhouette',
  // v3.0 atom expansion — 33 new atoms across 7 categories.
  // Animals (6):
  'cow',
  'horse',
  'pig',
  'dog',
  'sheep',
  'cat',
  // Landscape (4):
  'rock-boulder',
  'fence-section',
  'hill-mound',
  'stream-segment',
  // Architecture (5):
  'tower-square',
  'church-spire',
  'gazebo',
  'well',
  'fountain',
  // Vehicles (4):
  'sailboat-small',
  'car-simple',
  'wagon',
  'biplane',
  // Furniture (5):
  'chair',
  'table-round',
  'lamp-standing',
  'bookshelf',
  'wine-bottle',
  // Mechanical (4):
  'gear-flat',
  'pipe-l-bend',
  'smokestack',
  'windmill',
  // Plants (5):
  'flower',
  'mushroom',
  'bush',
  'vine',
  'grass-tuft',
  // Time-aware
  'waves',
  // Heightfield-as-SDF (afl_ext-inspired open-ocean; uses material.kind='sea'
  // shading branch). See src/scene/components/community/aflext-sea-surface.js.
  'sea-surface',
  // Procedural architectural atom — Venice-style box with window grid carved
  // into all 4 facades. Composes with curve DomainGroup for canal scenes.
  'canal-building',
  // Lit window glow planes (separate leaf for emissive shading).
  'canal-windows',
  // Stone arch bridge spanning the canal.
  'canal-bridge',
  // Venice-style streetlamp bulb head (3 spheres). Pair with cylinder for pole.
  'canal-lamp-bulb',
  // IQ Elevated-style mountain terrain (heightfield with gradient-decay fbm).
  'terrain-heightmap',
  'terrain-elevated',
  'terrain-with-lakes',
  'terrain-canyon',
  'arch-bridge',
  'procedural-city',
  // Atlas chart atom (2026-06-18) — first taxonomy charts/hierarchy/ entry.
  // First Atlas-built atom for next-gen Prezi use case lock.
  'pyramid-3d',
  // Atlas chart atom (2026-06-18) — taxonomy charts/data/. Data-driven, array param.
  'bar-3d',
  // Atlas chart atom (2026-06-18) — horizontal variant of bar-3d (axis swap).
  'column-3d',
  // Atlas chart atom (2026-06-18) — polyline + sphere markers, supports closed loop.
  'line-3d',
  // Atlas chart atom (2026-06-18) — pie/donut chart, angular SDF + extrusion.
  'pie-3d',
  // Atlas chart atom (2026-06-18) — KPI dashboard card (rounded box + semantic metadata).
  'kpi-card-3d',
  // Atlas icon set (2026-06-18) — 10-icon business pack (dispatched by name).
  'business-icon',
  // Atlas presentation atom (2026-06-18) — cover slide stage + backdrop.
  'cover-3d',
  // Atlas typography (2026-06-18 Wave 1) — multi-char text composed from IQ
  // 2D primitives (segment/arc/ring/circle), extruded along Z. Wave 1 covers
  // digits 0-9 + KPI symbols (% . - + $). Unknown chars are silently dropped.
  'text-3d',
  // Rune Skovbo Johansen's Advanced Terrain Erosion Filter (MPL-2.0 — see
  // src/scene/components/community/rune-erosion-filter.js). CPU-baked
  // heightmap uploaded to GPU as sampler2D u_heightmap. Box-bounded bonsai
  // landscape. Hash-derived bumps + jittered visual params → NFT-ready.
  'terrain-eroded-rune',
  // Forest sprint atoms (tree + leaf + flower scatter + emissive meteor streak).
  // stylized-tree = 4-layer: wavy trunk + 3 polar-replicated main branch layers
  //   (pModPolar 6/5/3) + cellular leaf instances (pMod3 + maple-leaf) +
  //   wind sway at canopy. Recipe ported from soft-servo/jake's "Tree in the
  //   wind" Shadertoy (re-implemented from idiom analysis, no source copy).
  // maple-leaf = 2D primitive: 3 isoceles triangles (1 main + 2 ±35° sides)
  //   + fract-edge pointy bumps. Extrudable via the standard extrude pseudo-prim.
  // forest-flower = stem + 5-petal polar bloom (compose with `rep` for fields).
  // meteor-streak = time-animated emissive capsule using chunkedTime idiom
  //   (per-particle cycling). Requires material.kind='emissive' (auto-attached).
  'stylized-tree',
  'maple-leaf',
  'forest-flower',
  'meteor-streak',
  // grass-field — pMod2 cellular tapered-cone blades + wind sway. Infinite
  // xz field by default (wrap in rep with count to clip). Translucent-friendly.
  'grass-field',
  // 2D → 3D pseudo-primitives
  'extrude',
  'revolve',
  'extrude_to',
  // 2026-05-23 IQ P2 batch — 8 new 3D primitives
  'cut-sphere',
  'cut-hollow-sphere',
  'death-star',
  'rounded-cylinder',
  'round-cone-ab',
  'vesica-segment',
  'cylinder-inf',
  'cone-inf',
]);

// =============================================================================
// Type name aliasing — snake_case ↔ kebab-case (Track 5.2 follow-on)
// -----------------------------------------------------------------------------
// PRIMITIVE_TYPES is a mixed bag: v1/v2-era types use snake_case
// (`capped_cylinder`, `rounded_box`), v3.4+ ports use kebab-case
// (`capped-torus`, `rounded-cylinder`). LLM stochastically swaps `_` ↔ `-`
// when it sees adjacent names in the prompt — e.g. emits `capped_torus`
// thinking it's the snake sibling of `capped_cylinder`. v3.10 regression
// (2026-05-26) caught vintage-bicycle + dining-setting failing this way.
//
// Fix: auto-build a bidirectional alias map at module load. Any type that
// only exists in ONE form gets its OTHER-form key as an alias pointing back
// to the canonical. normalizeType() does the lookup; validator + factories
// + GLSL emitter all call it before checking membership.
//
// Examples:
//   normalizeType('capped_torus')   → 'capped-torus' (alias)
//   normalizeType('capped-cylinder')→ 'capped_cylinder' (alias)
//   normalizeType('capped_cylinder')→ 'capped_cylinder' (canonical)
//   normalizeType('made_up_name')   → 'made_up_name' (unchanged; validator rejects)
// =============================================================================

function buildPrimitiveAliases(types) {
  const set = types instanceof Set ? types : new Set(types);
  const aliases = {};
  for (const t of set) {
    if (t.includes('_')) {
      const k = t.replace(/_/g, '-');
      if (!set.has(k)) aliases[k] = t;
    }
    if (t.includes('-')) {
      const s = t.replace(/-/g, '_');
      if (!set.has(s)) aliases[s] = t;
    }
  }
  return aliases;
}

export const PRIMITIVE_TYPE_ALIASES = buildPrimitiveAliases(PRIMITIVE_TYPES);

/**
 * Normalize a primitive type string to its canonical registry form.
 * If already canonical, returns as-is. If alias known, returns canonical.
 * If neither, returns input unchanged (caller's responsibility to handle).
 */
export function normalizeType(t) {
  if (typeof t !== 'string') return t;
  if (PRIMITIVE_TYPES.has(t)) return t;
  if (PRIMITIVE_TYPE_ALIASES[t]) return PRIMITIVE_TYPE_ALIASES[t];
  return t;
}

export const BOOLEAN_OPS = new Set([
  'union',
  'difference',
  'intersection',
  'smoothUnion',
  'smoothDifference',
  // hg_sdf-style join variants (Mercury "Hg" library). Architectural /
  // mechanical / furniture detail at boolean boundaries. args.r controls
  // the bevel/round/chamfer size; args.n controls the count of features
  // (stair steps / columnar bumps) for Stairs/Columns families.
  'unionChamfer',
  'intersectionChamfer',
  'differenceChamfer',
  'unionRound',
  'intersectionRound',
  'differenceRound',
  'unionSoft',
  'unionStairs',
  'intersectionStairs',
  'differenceStairs',
  'unionColumns',
  'intersectionColumns',
  'differenceColumns',
  // 2026-05-23 IQ P3 — XOR + IQ P4 smin variants (each takes args.r).
  'xor',
  'unionExp',
  'unionRoot',
  'unionCubic',
  'unionQuartic',
  'unionCircular',
  'unionCircGeo',
]);

// Boolean variants that require an args.r (radius/size) field. Validator
// flags missing (warn — defaults applied) and invalid (error).
export const VARIANT_BOOLEAN_R = new Set([
  'unionChamfer',
  'intersectionChamfer',
  'differenceChamfer',
  'unionRound',
  'intersectionRound',
  'differenceRound',
  'unionSoft',
  'unionStairs',
  'intersectionStairs',
  'differenceStairs',
  'unionColumns',
  'intersectionColumns',
  'differenceColumns',
  // 2026-05-23: smin variant family (all share args.r blend radius)
  'unionExp',
  'unionRoot',
  'unionCubic',
  'unionQuartic',
  'unionCircular',
  'unionCircGeo',
]);

// Boolean variants that ADDITIONALLY require args.n (positive int count).
export const VARIANT_BOOLEAN_N = new Set([
  'unionStairs',
  'intersectionStairs',
  'differenceStairs',
  'unionColumns',
  'intersectionColumns',
  'differenceColumns',
]);

// Surface-modification ops — require EXACTLY 2 children (host + modifier).
// pipe/engrave take args.r; groove/tongue take args.ra + args.rb.
export const PAIR_BOOLEAN_OPS = new Set(['pipe', 'engrave', 'groove', 'tongue']);
export const PAIR_BOOLEAN_RA_RB = new Set(['groove', 'tongue']);
[...PAIR_BOOLEAN_OPS].forEach((t) => BOOLEAN_OPS.add(t));

export const DOMAIN_OPS = new Set([
  'rep',
  'mirror',
  'twist',
  'bend',
  'curve',
  // hg_sdf-style radial repetition + 8-fold symmetry.
  'modPolar',
  'mirrorOctant',
  // 2026-05-23 IQ P3 batch — `elongate` stretches host primitive by h on each
  // axis; `displace` additively perturbs distance by another SDF. Neither
  // changes the child-count semantics (`elongate` is 1-arg op, `displace` is
  // pairwise like `xor`).
  'elongate',
  'displace',
]);

export const SHADOW_MODES = new Set(['channelSwap', 'hueRotate180', 'hueRotate90', 'darken']);

export const SOURCE_FORMATS = new Set([
  'script',
  'graph',
  'llm',
  'llm-lift',
  'generator',
  'hand-authored',
]);

// =============================================================================
// Material presets
// -----------------------------------------------------------------------------
// 5-parameter stylized material model: { hue, sat, value, metal, glow }.
//   hue   ∈ [0,1] — HSV hue (0=red, 0.33=green, 0.66=blue, 1=red)
//   sat   ∈ [0,1] — HSV saturation (0=grey, 1=full color)
//   value ∈ [0,1] — HSV value/brightness (0=black, 1=full bright)
//   metal ∈ [0,1] — fresnel boost + diffuse suppression + base-tinted specular
//   glow  ∈ [0,5] — self-emissive multiplier (ignored by software renderers)
//
// Subject.material may be:
//   - undefined → renderer falls back to hash-by-index palette
//   - string    → preset name (looked up in this dict)
//   - object    → inline { hue, sat, value, metal, glow } (escape hatch)
//
// Preset names are part of the public lift-LLM vocabulary; renaming is a
// breaking change. Add new entries freely; only remove with care.
// =============================================================================

export const MATERIAL_PRESETS = {
  // Neutrals — for paper / silhouette / stone / building bases
  'matte-white': { hue: 0.1, sat: 0.05, value: 0.94, metal: 0.0, glow: 0.0 },
  'matte-black': { hue: 0.6, sat: 0.15, value: 0.2, metal: 0.0, glow: 0.0 },
  stone: { hue: 0.08, sat: 0.12, value: 0.75, metal: 0.0, glow: 0.0 },

  // Earth tones — for cottages / brick / earth / wood
  brick: { hue: 0.02, sat: 0.55, value: 0.55, metal: 0.0, glow: 0.0 },
  wood: { hue: 0.07, sat: 0.45, value: 0.5, metal: 0.0, glow: 0.0 },
  terracotta: { hue: 0.04, sat: 0.65, value: 0.62, metal: 0.0, glow: 0.0 },

  // Nature — for trees / water / sky
  'leaf-green': { hue: 0.3, sat: 0.65, value: 0.55, metal: 0.0, glow: 0.0 },
  'sky-blue': { hue: 0.58, sat: 0.55, value: 0.85, metal: 0.0, glow: 0.0 },

  // Metals — for bells / decorative elements / mechanical
  gold: { hue: 0.13, sat: 0.85, value: 0.92, metal: 0.95, glow: 0.0 },
  silver: { hue: 0.0, sat: 0.0, value: 0.82, metal: 0.95, glow: 0.0 },
  copper: { hue: 0.06, sat: 0.7, value: 0.65, metal: 0.95, glow: 0.0 },

  // Emissive — for lighthouse beacon / candle / sun / moon / LED
  'glow-warm': { hue: 0.1, sat: 0.95, value: 1.0, metal: 0.0, glow: 1.8 },
  'glow-cool': { hue: 0.55, sat: 0.8, value: 1.0, metal: 0.0, glow: 1.8 },

  // v2.2 additions — fill gaps the 8-demo regression hit ("bread" hallucination
  // in dining-setting; clear-glass / linen for vase / table cloth / wineglass).
  // Food / domestic / table-setting:
  bread: { hue: 0.07, sat: 0.55, value: 0.72, metal: 0.0, glow: 0.0 }, // crusty loaf, warm tan
  porcelain: { hue: 0.55, sat: 0.06, value: 0.95, metal: 0.2, glow: 0.0 }, // fine ceramic, slight cool tint + fired sheen
  'clear-glass': { hue: 0.55, sat: 0.12, value: 0.92, metal: 0.5, glow: 0.0 }, // no transparency in v1; high metal fakes fresnel
  linen: { hue: 0.12, sat: 0.1, value: 0.85, metal: 0.0, glow: 0.0 }, // warm-tinted cloth, off-white
  'fruit-red': { hue: 0.0, sat: 0.85, value: 0.65, metal: 0.0, glow: 0.0 }, // apples / cherries / tomatoes

  // Water variants (v2.3+) — "sky-blue" preset is too light for ocean / lake.
  'deep-water': { hue: 0.6, sat: 0.85, value: 0.22, metal: 0.4, glow: 0.0 }, // open Pacific / deep ocean — dark + saturated + fresnel sheen
  'shallow-water': { hue: 0.5, sat: 0.55, value: 0.65, metal: 0.3, glow: 0.0 }, // lagoon / pool / coastal — lighter cyan
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp05 = (x) => Math.max(0, Math.min(5, x));

/**
 * Resolve a Subject.material input into a 4-tuple { hue, sat, metal, glow }
 * or null. Null means "no material specified; renderer should fall back to
 * its default per-leaf palette".
 *
 * @param {string|object|undefined|null} input
 * @returns {{hue:number, sat:number, metal:number, glow:number}|null}
 */
export function resolveMaterial(input) {
  if (input == null) return null;
  if (typeof input === 'string') {
    const preset = MATERIAL_PRESETS[input];
    if (!preset) {
      // Don't throw — unknown name is a warning case. Caller renders with
      // fallback palette so the scene still loads.
      console.warn(
        `[spec] Unknown material preset "${input}". Falling back to default palette. Known: ${Object.keys(MATERIAL_PRESETS).join(', ')}`,
      );
      return null;
    }
    // Defensive default for value — older presets without value field treated
    // as full brightness so existing scenes keep working through schema change.
    // Default kind=0 (standard Lambert); presets that need a special branch
    // (e.g. future 'sea-water' preset) can override.
    return { value: 1.0, kind: 0, ...preset };
  }
  if (typeof input === 'object') {
    return {
      hue: clamp01(input.hue ?? 0),
      sat: clamp01(input.sat ?? 1),
      value: clamp01(input.value ?? 1),
      metal: clamp01(input.metal ?? 0),
      glow: clamp05(input.glow ?? 0),
      // Material kind routes to a specialised shading branch in the renderer.
      //   0 = standard Lambert (default), 1 = sea (fresnel + atmosphere reflection),
      //   reserved: 2 = skin/SSS, 3 = glass, ... (future).
      kind: MATERIAL_KIND_INDEX[input.kind] ?? 0,
    };
  }
  return null;
}

// String-to-int mapping for material.kind. Keeps GLSL side a simple int compare.
// 3 = emissive: bypass lighting equation, render base * (1 + glow*4). Used by
// meteor-streak + future neon/lava/aurora atoms. Reads hue/sat/value/glow from
// the same material LUT; pattern is skipped.
// 4 = translucent: Lambert + Henyey-Greenstein backlight (sun-behind-surface
// glow). For thin organic surfaces — leaves, petals, paper lanterns. Idiom
// from soft-servo/jake "Tree in the wind" (recipe-only port; CC BY-SA hashes
// not used). Renderer adds `backlight = HG_phase(rd · sunDir, 0.5) * albedo² *
// shadow * 4.0` on top of normal Lambert.
export const MATERIAL_KIND_INDEX = {
  normal: 0,
  sea: 1,
  mountain: 2,
  emissive: 3,
  translucent: 4,
  // 5 = snowy: Lambert + snow overlay on upward-facing surfaces (n.y > 0.5)
  // with noise-patched coverage + cosine micro-normal sparkle specular.
  // Recipe-only port of IQ MdXGzr Snow Bridge snow blend. Use on any non-
  // mountain primitive that should look like it has fresh snowfall on it
  // (bridges, statues, buildings, tree foliage, stone walls).
  snowy: 5,
  // 6 = building: Lambert + procedural window grid texture + sky reflection
  // on dark window cells. Used by procedural-city primitive (Otavio Good
  // Skyline CC0 recipe). Each XZ position gets quantized window position;
  // dark-window cells reflect sky for glass tower look.
  building: 6,
  // 7 = eroded-terrain: full Rune-style multi-layer terrain shading reading
  // height/ridgeMap/treeAmount channels from u_heightmap texture. Cliff at
  // high altitude, dirt mid-slope masked by erosion occlusion, grass on flat
  // exposed areas, snow on peaks, sand at water edge, tree splat where
  // treeAmount channel > threshold, drainage darkening along ridgeMap creases.
  // Only valid on terrain-eroded-rune primitive (which uploads the texture).
  'eroded-terrain': 7,
};

// =============================================================================
// Surface patterns — Shane-style cellular / voronoi / brick / hex modulation
// -----------------------------------------------------------------------------
// Separate axis from material: pattern controls SURFACE STRUCTURE (where the
// color goes), material controls COLOR. Any pattern × any material combos.
//
// Subject.pattern may be:
//   - undefined  → renderer uses no pattern (uniform albedo + fbm modulation)
//   - string     → preset name (currently: 'brick', 'hex', 'cells', 'cracked')
//   - object     → { kind, scale, strength } inline override
// =============================================================================

export const PATTERN_KINDS = ['brick', 'hex', 'cells', 'cracked'];

// Internal codes for shader-side dispatch. Stored in vec4.x of u_leafPattern.
// Must match flyLambert.js's pattern-application switch.
const PATTERN_CODES = {
  none: 0,
  brick: 1,
  hex: 2,
  cells: 3,
  cracked: 4,
};

const PATTERN_PRESETS = {
  brick: { kind: 'brick', scale: 6.0, strength: 0.5 },
  hex: { kind: 'hex', scale: 5.0, strength: 0.4 },
  cells: { kind: 'cells', scale: 4.0, strength: 0.45 },
  cracked: { kind: 'cracked', scale: 5.0, strength: 0.55 },
};

/**
 * Resolve a Subject.pattern input into { code, scale, strength } or null.
 * `code` is an integer used by the shader to dispatch which pattern function.
 *
 * @param {string|object|undefined|null} input
 * @returns {{ code: number, scale: number, strength: number }|null}
 */
export function resolvePattern(input) {
  if (input == null) return null;
  if (typeof input === 'string') {
    const preset = PATTERN_PRESETS[input];
    if (!preset) {
      console.warn(
        `[spec] Unknown pattern preset "${input}". Known: ${Object.keys(PATTERN_PRESETS).join(', ')}`,
      );
      return null;
    }
    return { code: PATTERN_CODES[preset.kind], scale: preset.scale, strength: preset.strength };
  }
  if (typeof input === 'object') {
    const kind = input.kind;
    if (!PATTERN_KINDS.includes(kind)) {
      console.warn(
        `[spec] Pattern kind "${kind}" not in registry. Known: ${PATTERN_KINDS.join(', ')}`,
      );
      return null;
    }
    return {
      code: PATTERN_CODES[kind],
      scale: Math.max(0.1, input.scale ?? 5.0),
      strength: clamp01(input.strength ?? 0.5),
    };
  }
  return null;
}

// AnimationChannel.channel dot-paths allowed per host node type.
// Used by validator to reject unknown channels early.
export const SUBJECT_CHANNEL_PATHS = new Set([
  'transform.translate.x',
  'transform.translate.y',
  'transform.translate.z',
  'transform.rotate.x',
  'transform.rotate.y',
  'transform.rotate.z',
  'transform.scale',
  'color.r',
  'color.g',
  'color.b',
  // `args.<any>` is wildcard — handled separately in validator
]);

export const CAMERA_CHANNEL_PATHS = new Set([
  'yaw',
  'pitch',
  'distance',
  'focal',
  'targetX',
  'targetY',
  'targetZ',
]);

export const LIGHT_CHANNEL_PATHS = new Set(['azimuth', 'altitude', 'distance', 'intensity']);

// =============================================================================
// Validate
// =============================================================================

/**
 * Validate a parsed SceneData object. Returns { ok, errors, warnings }.
 * Does not mutate input. Does not throw.
 *
 * @param {object} data - parsed SceneData (already JSON-decoded)
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validate(data) {
  const errors = [];
  const warnings = [];

  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['SceneData must be an object'], warnings: [] };
  }

  // Rule 1: v must be present and === 1
  if (data.v == null) {
    errors.push('Missing required field "v" (version)');
  } else if (data.v !== 1) {
    errors.push(`Unsupported version "v": ${data.v} (only 1 accepted in v1)`);
  }

  // Rule 2: subjects must be present (array, can be empty)
  if (!('subjects' in data)) {
    errors.push('Missing required field "subjects" (use [] for empty scene)');
  } else if (!Array.isArray(data.subjects)) {
    errors.push('"subjects" must be an array');
  }

  // Rule 10: defaults.camera + defaults.light required
  if (data.defaults == null || typeof data.defaults !== 'object') {
    errors.push('Missing required field "defaults" (with .camera and .light)');
  } else {
    validateCamera(data.defaults.camera, errors, warnings);
    validateLight(data.defaults.light, errors, warnings);
    if (data.defaults.shadow != null) validateShadow(data.defaults.shadow, errors, warnings);
    if (data.defaults.postFx != null) validatePostFx(data.defaults.postFx, errors, warnings);
  }

  // Sprint 2 (2026-05-24): cameraSequence is top-level (parallel to subjects),
  // not under defaults — it OVERRIDES defaults.camera at evaluation time.
  if (data.cameraSequence != null) {
    validateCameraSequence(data.cameraSequence, errors, warnings);
  }

  // Sprint 3 (2026-05-24): volumes are top-level (parallel to subjects), NOT
  // primitive Subjects. Reason: volumes integrate density along the eye ray
  // instead of computing SDF distance. Mixing into subjects[] would force the
  // compiler to emit a "+inf distance" dummy SDF per volume → pollutes
  // flattenUnion's leaf list. Cleaner to keep them on their own array.
  if (data.volumes != null) {
    validateVolumes(data.volumes, errors, warnings);
  }

  // Rule 19, 20: source field
  if (data.source != null) validateSource(data.source, errors, warnings);

  // Rule 3: duplicate id check
  // Nested `source` subjects (extrude/revolve/extrude_to/DomainGroup wraps)
  // are admin-only — their id never surfaces in the rendered output, so we
  // auto-generate one if the LLM forgot. Top-level subjects + children still
  // require explicit id (those DO surface in flatlist / animations).
  const idSet = new Set();
  const collectIds = (subj, path, isNestedSource = false) => {
    if (!subj || typeof subj !== 'object') return;
    if (typeof subj.id !== 'string' || subj.id === '') {
      if (isNestedSource) {
        // Auto-fill so the compile pipeline has something stable to log
        const parentId =
          path
            .replace(/\/source$/, '')
            .split('/')
            .pop() || 'anon';
        subj.id = `${parentId.replace(/[[\]]/g, '_')}-source`;
      } else {
        errors.push(`${path}: missing or empty id`);
      }
    }
    if (subj.id) {
      if (idSet.has(subj.id)) {
        errors.push(`Duplicate subject id "${subj.id}" at ${path}`);
      }
      idSet.add(subj.id);
    }
    if (Array.isArray(subj.children)) {
      subj.children.forEach((c, i) => collectIds(c, `${path}/children[${i}]`, false));
    }
    if (subj.source && typeof subj.source === 'object') {
      // DomainGroup / extrude / revolve have nested .source (single Subject)
      collectIds(subj.source, `${path}/source`, true);
    }
  };

  if (Array.isArray(data.subjects)) {
    data.subjects.forEach((s, i) => collectIds(s, `subjects[${i}]`));
  }

  // Subject-level validation
  if (Array.isArray(data.subjects)) {
    data.subjects.forEach((s, i) => validateSubject(s, `subjects[${i}]`, errors, warnings));
  }

  return { ok: errors.length === 0, errors, warnings };
}

// =============================================================================
// Subject validation (recursive)
// =============================================================================

function validateSubject(subj, path, errors, warnings) {
  if (subj == null || typeof subj !== 'object' || Array.isArray(subj)) {
    errors.push(`${path}: must be an object`);
    return;
  }

  if (typeof subj.type !== 'string') {
    errors.push(`${path}: missing or non-string "type"`);
    return;
  }

  // Normalize snake_case ↔ kebab-case aliases before registry lookup.
  // LLM sometimes mis-emits `capped_torus` when canonical is `capped-torus`;
  // see PRIMITIVE_TYPE_ALIASES above.
  const canonicalType = normalizeType(subj.type);
  const isPrimitive = PRIMITIVE_TYPES.has(canonicalType);
  const isBoolean = BOOLEAN_OPS.has(canonicalType);
  const isDomain = DOMAIN_OPS.has(canonicalType);

  if (!isPrimitive && !isBoolean && !isDomain) {
    // Rule 6, 7, 8
    errors.push(
      `${path}: unknown type "${subj.type}" (not in primitive / boolean / domain registries)`,
    );
    return;
  }

  // If LLM emitted an alias form, normalize in place so downstream factories
  // / GLSL emitter see the canonical key. (Mutation here is intentional —
  // validator runs at compile() entry, before the SceneData hits any other
  // stage. Caller's input may be a literal authored by hand; we want their
  // downstream lookups to succeed.)
  if (canonicalType !== subj.type) {
    warnings.push(`${path}.type: "${subj.type}" normalized to canonical "${canonicalType}"`);
    subj.type = canonicalType;
  }

  // Rule 4, 5: BooleanGroup must have children, non-empty
  if (isBoolean) {
    if (!Array.isArray(subj.children) || subj.children.length === 0) {
      errors.push(`${path}: BooleanGroup "${subj.type}" requires non-empty children[]`);
    } else if (subj.children.length === 1) {
      warnings.push(`${path}: BooleanGroup "${subj.type}" with single child will be unwrapped`);
    } else {
      subj.children.forEach((c, i) =>
        validateSubject(c, `${path}/children[${i}]`, errors, warnings),
      );
    }
    // hg_sdf variants need args.r; missing is recoverable (default applied)
    // but worth warning so authors realize the param exists.
    if (VARIANT_BOOLEAN_R.has(subj.type)) {
      const r = subj.args?.r;
      if (r == null) {
        warnings.push(`${path}: "${subj.type}" missing args.r (bevel/round radius); using default`);
      } else if (typeof r !== 'number' || r <= 0) {
        errors.push(`${path}.args.r: must be a positive number (got ${r})`);
      }
    }
    // Stairs / Columns also need args.n (positive integer count of features).
    if (VARIANT_BOOLEAN_N.has(subj.type)) {
      const n = subj.args?.n;
      if (n == null) {
        warnings.push(
          `${path}: "${subj.type}" missing args.n (step/column count); using default 3`,
        );
      } else if (typeof n !== 'number' || n < 1 || n !== Math.floor(n)) {
        errors.push(`${path}.args.n: must be a positive integer (got ${n})`);
      }
    }
    // Surface-modification ops (pipe/engrave/groove/tongue) require EXACTLY
    // 2 children (host + modifier) — they're not commutative folds.
    if (PAIR_BOOLEAN_OPS.has(subj.type)) {
      if (Array.isArray(subj.children) && subj.children.length !== 2) {
        errors.push(
          `${path}: "${subj.type}" requires exactly 2 children (host + modifier), got ${subj.children.length}`,
        );
      }
      // groove/tongue use args.ra + args.rb; pipe/engrave use args.r.
      if (PAIR_BOOLEAN_RA_RB.has(subj.type)) {
        for (const k of ['ra', 'rb']) {
          const v = subj.args?.[k];
          if (v == null) {
            warnings.push(`${path}: "${subj.type}" missing args.${k}; using default`);
          } else if (typeof v !== 'number' || v <= 0) {
            errors.push(`${path}.args.${k}: must be a positive number (got ${v})`);
          }
        }
      } else {
        const r = subj.args?.r;
        if (r == null) {
          warnings.push(`${path}: "${subj.type}" missing args.r; using default 0.05`);
        } else if (typeof r !== 'number' || r <= 0) {
          errors.push(`${path}.args.r: must be a positive number (got ${r})`);
        }
      }
    }
  }

  // Rule 8, 9: DomainGroup must have source
  if (isDomain) {
    if (subj.source == null || typeof subj.source !== 'object') {
      errors.push(`${path}: DomainGroup "${subj.type}" requires a "source" Subject`);
    } else {
      validateSubject(subj.source, `${path}/source`, errors, warnings);
    }
    validateDomainArgs(subj.type, subj.args, `${path}.args`, errors, warnings);
  }

  // Pseudo-primitives extrude/revolve/extrude_to also have source
  if (
    isPrimitive &&
    (subj.type === 'extrude' || subj.type === 'revolve' || subj.type === 'extrude_to')
  ) {
    if (subj.source == null) {
      errors.push(`${path}: "${subj.type}" requires a "source" 2D primitive`);
    } else {
      validateSubject(subj.source, `${path}/source`, errors, warnings);
    }
  }

  // Animation channels
  if (subj.animation != null) {
    if (!Array.isArray(subj.animation)) {
      errors.push(`${path}.animation: must be an array`);
    } else {
      subj.animation.forEach((ch, i) =>
        validateAnimationChannel(ch, `${path}.animation[${i}]`, 'subject', errors, warnings),
      );
    }
  }

  // Generator-S variants (Phase 1: scatter only). Each entry is a variant
  // spec consumed by src/scene/generator-s.js expandVariants() BEFORE this
  // subject is compiled. Validator is lenient — unknown op / region just
  // warn (variant gets skipped, prototype kept as-is).
  if (subj.variants != null) {
    if (!Array.isArray(subj.variants)) {
      errors.push(`${path}.variants: must be an array`);
    } else {
      subj.variants.forEach((v, i) =>
        validateVariantSpec(v, `${path}.variants[${i}]`, errors, warnings),
      );
    }
  }

  // Transform sanity
  if (subj.transform != null && typeof subj.transform !== 'object') {
    errors.push(`${path}.transform: must be an object`);
  }

  // Material — string preset name OR inline {hue, sat, metal, glow} object.
  // Unknown preset string is a WARNING (not error) — renderer falls back to
  // hash palette and the scene still loads. This is forward-compat: future
  // preset packs can ship preset names that older builds don't know yet.
  if (subj.material != null) {
    if (typeof subj.material === 'string') {
      if (!MATERIAL_PRESETS[subj.material]) {
        warnings.push(
          `${path}.material: unknown preset "${subj.material}" — will fall back to default palette. Known: ${Object.keys(MATERIAL_PRESETS).join(', ')}`,
        );
      }
    } else if (typeof subj.material === 'object' && !Array.isArray(subj.material)) {
      const m = subj.material;
      for (const k of ['hue', 'sat', 'value', 'metal', 'glow']) {
        if (m[k] != null && typeof m[k] !== 'number') {
          errors.push(`${path}.material.${k}: must be a number if present`);
        }
      }
    } else {
      errors.push(
        `${path}.material: must be a string preset name or an object {hue, sat, value, metal, glow}`,
      );
    }
  }

  // Pattern — string preset name OR inline { kind, scale, strength } object.
  // Independent axis from material; valid kinds in PATTERN_KINDS.
  if (subj.pattern != null) {
    if (typeof subj.pattern === 'string') {
      if (!PATTERN_KINDS.includes(subj.pattern)) {
        warnings.push(
          `${path}.pattern: unknown preset "${subj.pattern}". Known: ${PATTERN_KINDS.join(', ')}`,
        );
      }
    } else if (typeof subj.pattern === 'object' && !Array.isArray(subj.pattern)) {
      const p = subj.pattern;
      if (p.kind != null && !PATTERN_KINDS.includes(p.kind)) {
        errors.push(
          `${path}.pattern.kind: must be one of ${PATTERN_KINDS.join(' | ')} (got "${p.kind}")`,
        );
      }
      for (const k of ['scale', 'strength']) {
        if (p[k] != null && typeof p[k] !== 'number') {
          errors.push(`${path}.pattern.${k}: must be a number if present`);
        }
      }
    } else {
      errors.push(
        `${path}.pattern: must be a string preset name or an object { kind, scale, strength }`,
      );
    }
  }
}

// =============================================================================
// DomainGroup args
// =============================================================================

function validateDomainArgs(type, args, path, errors, _warnings) {
  if (args == null) args = {};
  if (typeof args !== 'object') {
    errors.push(`${path}: args must be an object`);
    return;
  }

  if (type === 'rep') {
    if (!Array.isArray(args.period) || args.period.length !== 3) {
      errors.push(`${path}: rep requires args.period = [x, y, z]`);
    }
  } else if (type === 'mirror') {
    if (!['x', 'y', 'z'].includes(args.axis)) {
      errors.push(`${path}: mirror requires args.axis ∈ {x, y, z}`);
    }
  } else if (type === 'twist' || type === 'bend') {
    if (!['x', 'y', 'z'].includes(args.axis)) {
      errors.push(`${path}: ${type} requires args.axis ∈ {x, y, z}`);
    }
    if (typeof args.k !== 'number') {
      errors.push(`${path}: ${type} requires args.k (number)`);
    }
  } else if (type === 'curve') {
    if (typeof args.amplitude !== 'number') {
      errors.push(`${path}: curve requires args.amplitude (number)`);
    }
    if (typeof args.frequency !== 'number') {
      errors.push(`${path}: curve requires args.frequency (number)`);
    }
    if (args.axis != null && !['x', 'y', 'z'].includes(args.axis)) {
      errors.push(`${path}: curve args.axis must be 'x' | 'y' | 'z' (default 'z')`);
    }
  } else if (type === 'modPolar') {
    if (args.axis != null && !['x', 'y', 'z'].includes(args.axis)) {
      errors.push(`${path}: modPolar args.axis must be 'x' | 'y' | 'z' (default 'y')`);
    }
    if (args.repetitions != null) {
      if (typeof args.repetitions !== 'number' || args.repetitions < 2) {
        errors.push(
          `${path}: modPolar args.repetitions must be a number >= 2 (got ${args.repetitions})`,
        );
      }
    }
  } else if (type === 'mirrorOctant') {
    if (args.plane != null && !['xz', 'xy', 'yz'].includes(args.plane)) {
      errors.push(`${path}: mirrorOctant args.plane must be 'xz' | 'xy' | 'yz' (default 'xz')`);
    }
    if (
      args.dist != null &&
      (!Array.isArray(args.dist) ||
        args.dist.length !== 2 ||
        !args.dist.every((v) => typeof v === 'number'))
    ) {
      errors.push(`${path}: mirrorOctant args.dist must be [d1, d2] of numbers`);
    }
  }
}

// =============================================================================
// CameraSpec
// =============================================================================

// Variant specs are consumed by Generator-S (src/scene/generator-s.js).
// Phase 2 op set: 'scatter' | 'array' | 'mirror'. Region types: 'rectXZ', 'box3'.
// Unknown values are warnings — Generator-S falls back to keeping prototype.
const VARIANT_OPS = new Set(['scatter', 'array', 'mirror']);
const VARIANT_REGIONS = new Set(['rectXZ', 'box3']);
const VARIANT_AXES = new Set(['x', 'y', 'z']);
const VARIANT_PLANES = new Set(['yz', 'xz', 'xy']);

function validateVariantSpec(v, path, errors, warnings) {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  if (typeof v.op !== 'string') {
    errors.push(`${path}.op: required string`);
    return;
  }
  if (!VARIANT_OPS.has(v.op)) {
    warnings.push(
      `${path}.op: unknown '${v.op}' (Phase 2 supports: ${[...VARIANT_OPS].join(', ')}); Generator-S will skip and keep prototype`,
    );
    return;
  }
  if (v.op === 'scatter') {
    if (
      v.count != null &&
      (typeof v.count !== 'number' || v.count < 1 || v.count !== Math.floor(v.count))
    ) {
      errors.push(`${path}.count: must be a positive integer (got ${v.count})`);
    }
    if (v.region != null) {
      if (typeof v.region !== 'object' || Array.isArray(v.region)) {
        errors.push(`${path}.region: must be an object`);
      } else if (typeof v.region.type !== 'string') {
        errors.push(`${path}.region.type: required string`);
      } else if (!VARIANT_REGIONS.has(v.region.type)) {
        warnings.push(
          `${path}.region.type: unknown '${v.region.type}' (Phase 1 supports: ${[...VARIANT_REGIONS].join(', ')}); Generator-S will skip`,
        );
      } else if (!Array.isArray(v.region.size)) {
        errors.push(`${path}.region.size: required array of numbers`);
      }
    }
    if (v.separation != null && (typeof v.separation !== 'number' || v.separation < 0)) {
      errors.push(`${path}.separation: must be a non-negative number`);
    }
    if (v.heading != null) {
      const h = v.heading;
      const valid =
        h === 'aligned' ||
        h === 'random' ||
        (typeof h === 'object' && h !== null && typeof h.jitter === 'number');
      if (!valid) {
        errors.push(`${path}.heading: must be "aligned" | "random" | { jitter: <radians> }`);
      }
    }
  } else if (v.op === 'array') {
    if (
      v.count != null &&
      (typeof v.count !== 'number' || v.count < 1 || v.count !== Math.floor(v.count))
    ) {
      errors.push(`${path}.count: must be a positive integer (got ${v.count})`);
    }
    if (v.axis != null) {
      const axisOk =
        (typeof v.axis === 'string' && VARIANT_AXES.has(v.axis)) ||
        (Array.isArray(v.axis) &&
          v.axis.length === 3 &&
          v.axis.every((n) => typeof n === 'number'));
      if (!axisOk) {
        errors.push(
          `${path}.axis: must be 'x'|'y'|'z' or a [x,y,z] vector (got ${JSON.stringify(v.axis)})`,
        );
      }
    }
    if (v.spacing != null && typeof v.spacing !== 'number') {
      errors.push(`${path}.spacing: must be a number`);
    }
    if (v.origin != null && v.origin !== 'center' && v.origin !== 'start') {
      errors.push(`${path}.origin: must be 'center' or 'start' (got '${v.origin}')`);
    }
  } else if (v.op === 'mirror') {
    if (v.plane != null && !VARIANT_PLANES.has(v.plane)) {
      errors.push(
        `${path}.plane: must be one of ${[...VARIANT_PLANES].join('|')} (got '${v.plane}')`,
      );
    }
    if (v.phaseFlip != null && typeof v.phaseFlip !== 'number') {
      errors.push(`${path}.phaseFlip: must be a number (radians) if present`);
    }
  }
}

function validateCamera(cam, errors, warnings) {
  if (cam == null || typeof cam !== 'object') {
    errors.push('defaults.camera: missing or not an object');
    return;
  }
  const numFields = ['yaw', 'pitch', 'distance', 'focal', 'targetX', 'targetY', 'targetZ'];
  for (const f of numFields) {
    if (typeof cam[f] !== 'number') {
      errors.push(`defaults.camera.${f}: must be a number`);
    }
  }
  // Rule 11: range clamp + warn (informational, not blocking)
  if (typeof cam.distance === 'number' && (cam.distance < 0.1 || cam.distance > 100)) {
    warnings.push(`defaults.camera.distance ${cam.distance} outside typical [0.5, 50]; will clamp`);
  }
  if (typeof cam.pitch === 'number' && Math.abs(cam.pitch) > Math.PI / 2 - 0.05) {
    warnings.push(`defaults.camera.pitch ${cam.pitch} near singularity (±π/2); will clamp`);
  }
  // Sprint 1 (2026-05-24): cinematic DoF fields. Both optional + backward-compat;
  // aperture=0 (default) disables DoF entirely so existing scenes are unchanged.
  if (cam.aperture != null) {
    if (typeof cam.aperture !== 'number') {
      errors.push('defaults.camera.aperture: must be a number (0 = no DoF; typical 0.3..1.5)');
    } else if (cam.aperture < 0 || cam.aperture > 5) {
      warnings.push(
        `defaults.camera.aperture ${cam.aperture} outside typical [0, 5]; extreme bokeh may clip`,
      );
    }
  }
  if (cam.focalDistance != null) {
    if (typeof cam.focalDistance !== 'number') {
      errors.push(
        'defaults.camera.focalDistance: must be a number (world units to in-focus plane)',
      );
    } else if (cam.focalDistance <= 0) {
      warnings.push(
        `defaults.camera.focalDistance ${cam.focalDistance} non-positive; auto-derived from camera→target distance`,
      );
    }
  }
  if (Array.isArray(cam.animation)) {
    cam.animation.forEach((ch, i) =>
      validateAnimationChannel(ch, `defaults.camera.animation[${i}]`, 'camera', errors, warnings),
    );
  }
}

// =============================================================================
// PostFxSpec (Sprint 1) — defaults.postFx
// -----------------------------------------------------------------------------
// All fields optional + numeric. Renderer falls back to DEFAULT_POSTFX in
// postfx.js for any missing field. Validator just guards against typos /
// wrong types — never blocks scene from rendering.
// =============================================================================
const POSTFX_NUM_FIELDS = [
  'exposure',
  'vignetteStrength',
  'bloomMix',
  'bloomThreshold',
  'lensFlareStrength',
  'gamma',
  'aperture',
  'focalDistance',
  'focalLength',
  'dofMaxRadius',
];

function validatePostFx(pfx, errors, warnings) {
  if (typeof pfx !== 'object' || pfx == null) {
    errors.push('defaults.postFx: must be an object');
    return;
  }
  for (const k of Object.keys(pfx)) {
    if (!POSTFX_NUM_FIELDS.includes(k)) {
      warnings.push(
        `defaults.postFx.${k}: unknown field (known: ${POSTFX_NUM_FIELDS.join(', ')}); ignored at render time`,
      );
      continue;
    }
    if (typeof pfx[k] !== 'number') {
      errors.push(`defaults.postFx.${k}: must be a number`);
    }
  }
  // Soft sanity warnings
  if (typeof pfx.exposure === 'number' && (pfx.exposure < 0 || pfx.exposure > 8)) {
    warnings.push(`defaults.postFx.exposure ${pfx.exposure} outside typical [0, 8]`);
  }
  if (typeof pfx.gamma === 'number' && (pfx.gamma < 1 || pfx.gamma > 3)) {
    warnings.push(`defaults.postFx.gamma ${pfx.gamma} outside typical [1.0, 3.0]`);
  }
  if (
    typeof pfx.vignetteStrength === 'number' &&
    (pfx.vignetteStrength < 0 || pfx.vignetteStrength > 1)
  ) {
    warnings.push(`defaults.postFx.vignetteStrength ${pfx.vignetteStrength} outside [0, 1]`);
  }
}

// =============================================================================
// CameraSequenceSpec (Sprint 2) — top-level cameraSequence
// -----------------------------------------------------------------------------
// Multi-shot timeline that overrides defaults.camera during playback. shot.ease
// 'cut' is the default transition between shots (hard cut); ease='blend' opts
// into smoothly interpolating from the prev shot's end state.
// =============================================================================
const SHOT_EASES = new Set(['smooth', 'linear']);
const SHOT_TRANSITIONS = new Set(['cut', 'blend']);

function validateCameraSequence(seq, errors, warnings) {
  if (typeof seq !== 'object' || seq == null) {
    errors.push('cameraSequence: must be an object');
    return;
  }
  if (!Array.isArray(seq.shots) || seq.shots.length === 0) {
    errors.push('cameraSequence.shots: must be a non-empty array');
    return;
  }
  if (seq.loop != null && typeof seq.loop !== 'boolean') {
    errors.push('cameraSequence.loop: must be a boolean if provided');
  }
  // Sprint 4: subjectMotion = per-subject CarInt physics (cross-phase integral).
  if (seq.subjectMotion != null) {
    if (!Array.isArray(seq.subjectMotion)) {
      errors.push('cameraSequence.subjectMotion: must be an array if provided');
    } else {
      seq.subjectMotion.forEach((m, i) => {
        const tag = `cameraSequence.subjectMotion[${i}]`;
        if (typeof m !== 'object' || m == null) {
          errors.push(`${tag}: must be object`);
          return;
        }
        if (typeof m.subjectId !== 'string') errors.push(`${tag}.subjectId: required string`);
        if (m.axis != null && !['x', 'y', 'z'].includes(m.axis)) {
          errors.push(`${tag}.axis: must be 'x' | 'y' | 'z' (default 'y')`);
        }
        if (!Array.isArray(m.phases) || m.phases.length === 0) {
          errors.push(`${tag}.phases: must be a non-empty array`);
          return;
        }
        m.phases.forEach((p, j) => {
          const ptag = `${tag}.phases[${j}]`;
          if (typeof p.duration !== 'number' || p.duration <= 0) {
            errors.push(`${ptag}.duration: must be a positive number`);
          }
          if (p.v0 != null && typeof p.v0 !== 'number') errors.push(`${ptag}.v0: must be number`);
          if (p.a != null && typeof p.a !== 'number') errors.push(`${ptag}.a: must be number`);
        });
      });
    }
  }
  seq.shots.forEach((shot, i) => {
    const tag = `cameraSequence.shots[${i}]`;
    if (typeof shot !== 'object' || shot == null) {
      errors.push(`${tag}: must be an object`);
      return;
    }
    if (typeof shot.duration !== 'number' || shot.duration <= 0) {
      errors.push(`${tag}.duration: must be a positive number (seconds)`);
    }
    // Sprint 5: pos accepts absolute [x,y,z] OR {relativeTo, offset} — same
    // shape as target. Lets camera position track moving subject so shots
    // stay framed even as subject rises out of the static frame.
    if (Array.isArray(shot.pos)) {
      if (shot.pos.length !== 3 || !shot.pos.every((n) => typeof n === 'number')) {
        errors.push(`${tag}.pos: must be [x, y, z] numbers`);
      }
    } else if (typeof shot.pos === 'object' && shot.pos != null) {
      if (typeof shot.pos.relativeTo !== 'string') {
        errors.push(`${tag}.pos.relativeTo: must be a subject id string`);
      }
      if (
        shot.pos.offset != null &&
        (!Array.isArray(shot.pos.offset) || shot.pos.offset.length !== 3)
      ) {
        errors.push(`${tag}.pos.offset: must be [x, y, z] if provided`);
      }
    } else {
      errors.push(`${tag}.pos: must be [x,y,z] OR { relativeTo, offset }`);
    }
    // Sprint 4: target can be either absolute [x,y,z] OR { relativeTo, offset }
    if (Array.isArray(shot.target)) {
      if (shot.target.length !== 3 || !shot.target.every((n) => typeof n === 'number')) {
        errors.push(`${tag}.target: must be [x, y, z] numbers`);
      }
    } else if (typeof shot.target === 'object' && shot.target != null) {
      if (typeof shot.target.relativeTo !== 'string') {
        errors.push(`${tag}.target.relativeTo: must be a subject id string`);
      }
      if (
        shot.target.offset != null &&
        (!Array.isArray(shot.target.offset) || shot.target.offset.length !== 3)
      ) {
        errors.push(`${tag}.target.offset: must be [x, y, z] if provided`);
      }
    } else {
      errors.push(`${tag}.target: must be [x,y,z] OR { relativeTo, offset }`);
    }
    if (typeof shot.fov !== 'number') {
      errors.push(`${tag}.fov: must be a number (degrees)`);
    } else if (shot.fov < 5 || shot.fov > 90) {
      warnings.push(`${tag}.fov ${shot.fov} outside typical [5, 90]`);
    }
    if (shot.aperture != null && typeof shot.aperture !== 'number') {
      errors.push(`${tag}.aperture: must be a number if provided`);
    }
    if (shot.focalDistance != null && typeof shot.focalDistance !== 'number') {
      errors.push(`${tag}.focalDistance: must be a number if provided`);
    }
    if (shot.ease != null && !SHOT_EASES.has(shot.ease)) {
      errors.push(`${tag}.ease: must be one of ${[...SHOT_EASES].join(' | ')}`);
    }
    if (shot.transition != null && !SHOT_TRANSITIONS.has(shot.transition)) {
      errors.push(`${tag}.transition: must be one of ${[...SHOT_TRANSITIONS].join(' | ')}`);
    }
    // Sprint 4: shake can be number (legacy) OR { amount, velocityScale, scaleWith }
    if (shot.shake != null) {
      if (typeof shot.shake === 'number') {
        if (shot.shake < 0) errors.push(`${tag}.shake: must be a non-negative number`);
      } else if (typeof shot.shake === 'object') {
        if (typeof shot.shake.amount !== 'number' || shot.shake.amount < 0) {
          errors.push(`${tag}.shake.amount: required non-negative number`);
        }
        if (shot.shake.velocityScale != null && typeof shot.shake.velocityScale !== 'number') {
          errors.push(`${tag}.shake.velocityScale: must be number if provided`);
        }
        if (shot.shake.scaleWith != null && typeof shot.shake.scaleWith !== 'string') {
          errors.push(`${tag}.shake.scaleWith: must be subject id string if provided`);
        }
      } else {
        errors.push(`${tag}.shake: must be number OR { amount, velocityScale, scaleWith }`);
      }
    }
    // Sprint 4: per-shot scene state overrides (engine glow, thruster level, smoke amount)
    if (shot.sceneState != null) {
      if (typeof shot.sceneState !== 'object') {
        errors.push(`${tag}.sceneState: must be an object`);
      } else {
        for (const k of Object.keys(shot.sceneState)) {
          if (typeof shot.sceneState[k] !== 'number') {
            errors.push(`${tag}.sceneState.${k}: must be a number (0..1+ multiplier)`);
          }
        }
      }
    }
    // Sprint 8: per-shot exposure curve. Number = static; [from, to] = ramp
    // over the shot's duration. Lets shots fade-from-black, ramp into golden,
    // or peak during ignition without touching defaults.postFx.exposure.
    if (shot.exposure != null) {
      if (typeof shot.exposure === 'number') {
        if (shot.exposure < 0) errors.push(`${tag}.exposure: must be non-negative`);
      } else if (Array.isArray(shot.exposure)) {
        if (
          shot.exposure.length !== 2 ||
          !shot.exposure.every((n) => typeof n === 'number' && n >= 0)
        ) {
          errors.push(`${tag}.exposure: [from, to] must be two non-negative numbers`);
        }
      } else {
        errors.push(`${tag}.exposure: must be number OR [from, to] array`);
      }
    }
    // Sprint 8: per-shot renderer override. Only 'blueprint' supported in v1
    // (renders the scene as a technical schematic — silhouette edges on dark
    // graph-paper background). Future: 'wireframe', 'pen', 'watercolor'.
    if (shot.renderer != null) {
      if (typeof shot.renderer !== 'string') {
        errors.push(`${tag}.renderer: must be a string if provided`);
      } else if (!SHOT_RENDERERS.has(shot.renderer)) {
        errors.push(`${tag}.renderer: must be one of ${[...SHOT_RENDERERS].join(' | ')}`);
      }
    }
  });
}

// Sprint 8: per-shot renderer override (Blueprint-as-shot).
export const SHOT_RENDERERS = new Set(['default', 'blueprint']);

// =============================================================================
// VolumesSpec (Sprint 3) — top-level volumes[] array
// -----------------------------------------------------------------------------
// Each volume: { id, kind, center, size, density, color, noiseScale?, noiseSpeed? }
// kind ∈ {smoke, flame, fog, god-rays}. Renderer (FLY 3D) loops through these
// in a post-surface volume raymarch pass and accumulates density × color along
// the eye ray. BOB GPU intentionally NOT integrated — painterly aesthetic.
// =============================================================================
export const VOLUME_KINDS = new Set(['smoke', 'flame', 'fog', 'god-rays']);

function validateVolumes(vols, errors, _warnings) {
  if (!Array.isArray(vols)) {
    errors.push('volumes: must be an array');
    return;
  }
  vols.forEach((v, i) => {
    const tag = `volumes[${i}]`;
    if (typeof v !== 'object' || v == null) {
      errors.push(`${tag}: must be an object`);
      return;
    }
    if (typeof v.id !== 'string' || v.id === '') {
      errors.push(`${tag}.id: required non-empty string`);
    }
    if (!VOLUME_KINDS.has(v.kind)) {
      errors.push(`${tag}.kind: must be one of ${[...VOLUME_KINDS].join(' | ')}`);
    }
    if (
      !Array.isArray(v.center) ||
      v.center.length !== 3 ||
      !v.center.every((n) => typeof n === 'number')
    ) {
      errors.push(`${tag}.center: must be [x, y, z] numbers`);
    }
    if (
      !Array.isArray(v.size) ||
      v.size.length !== 3 ||
      !v.size.every((n) => typeof n === 'number')
    ) {
      errors.push(`${tag}.size: must be [x, y, z] numbers (bounding box of effect)`);
    }
    if (v.density != null && (typeof v.density !== 'number' || v.density < 0)) {
      errors.push(`${tag}.density: must be a non-negative number`);
    }
    if (v.color != null) {
      if (
        !Array.isArray(v.color) ||
        v.color.length !== 3 ||
        !v.color.every((n) => typeof n === 'number')
      ) {
        errors.push(
          `${tag}.color: must be [r, g, b] numbers (0-255 or 0-1, renderer auto-detects)`,
        );
      }
    }
    if (v.noiseScale != null && typeof v.noiseScale !== 'number') {
      errors.push(`${tag}.noiseScale: must be a number`);
    }
    if (v.colorIntensity != null && typeof v.colorIntensity !== 'number') {
      errors.push(`${tag}.colorIntensity: must be a number (HDR multiplier)`);
    }
    if (v.noiseSpeed != null && typeof v.noiseSpeed !== 'number') {
      errors.push(`${tag}.noiseSpeed: must be a number`);
    }
    // Sprint 4: volume can attach to a moving subject (offset added at render time)
    if (v.attachTo != null && typeof v.attachTo !== 'string') {
      errors.push(`${tag}.attachTo: must be a subject id string if provided`);
    }
    // Sprint 4: volume density can be modulated per-shot via shot.sceneState.{key}
    // The volume's sceneStateKey names which scene-state field scales density.
    // e.g. {sceneStateKey: 'thrusterLevel'} → density *= shot.sceneState.thrusterLevel
    if (v.sceneStateKey != null && typeof v.sceneStateKey !== 'string') {
      errors.push(`${tag}.sceneStateKey: must be a string if provided`);
    }
  });
}

// =============================================================================
// LightSpec
// =============================================================================

function validateLight(light, errors, warnings) {
  if (light == null || typeof light !== 'object') {
    errors.push('defaults.light: missing or not an object');
    return;
  }
  const numFields = ['azimuth', 'altitude', 'distance'];
  for (const f of numFields) {
    if (typeof light[f] !== 'number') {
      errors.push(`defaults.light.${f}: must be a number`);
    }
  }
  if (light.intensity != null && typeof light.intensity !== 'number') {
    errors.push('defaults.light.intensity: must be a number');
  }
  // Rule 12
  if (typeof light.altitude === 'number' && Math.abs(light.altitude) > Math.PI / 2 - 0.05) {
    warnings.push(`defaults.light.altitude ${light.altitude} near singularity; will clamp`);
  }
  if (Array.isArray(light.animation)) {
    light.animation.forEach((ch, i) =>
      validateAnimationChannel(ch, `defaults.light.animation[${i}]`, 'light', errors, warnings),
    );
  }
}

// =============================================================================
// ShadowSpec
// =============================================================================

function validateShadow(shadow, errors, warnings) {
  if (typeof shadow !== 'object' || shadow == null) {
    errors.push('defaults.shadow: must be an object');
    return;
  }
  if (typeof shadow.enabled !== 'boolean') {
    errors.push('defaults.shadow.enabled: must be a boolean');
  }
  // Rule 17
  if (!SHADOW_MODES.has(shadow.mode)) {
    errors.push(`defaults.shadow.mode: must be one of ${[...SHADOW_MODES].join(' | ')}`);
  }
  if (typeof shadow.strength !== 'number') {
    errors.push('defaults.shadow.strength: must be a number');
  } else if (shadow.strength < 0 || shadow.strength > 1) {
    // Rule 18
    warnings.push(`defaults.shadow.strength ${shadow.strength} outside [0, 1]; will clamp`);
  }
  if (Array.isArray(shadow.animation)) {
    shadow.animation.forEach((ch, i) =>
      validateAnimationChannel(ch, `defaults.shadow.animation[${i}]`, 'shadow', errors, warnings),
    );
  }
}

// =============================================================================
// SourceMetadata
// =============================================================================

function validateSource(src, errors, warnings) {
  if (typeof src !== 'object') {
    errors.push('source: must be an object');
    return;
  }
  // Rule 19: unknown source.format is a WARNING not an error.
  // source is metadata; the SDF tree compiles regardless of format value.
  // Forward-compatibility: lets new format values (e.g. 'llm-lift', future
  // 'midjourney-import', etc.) flow through without blocking the renderer.
  if (!SOURCE_FORMATS.has(src.format)) {
    warnings.push(
      `source.format "${src.format}" not in registry (known: ${[...SOURCE_FORMATS].join(' | ')}). Renderer continues; metadata may render as 'unknown' in editors.`,
    );
  }
  // Rule 20: warn if text without script format
  if (src.text != null && src.format !== 'script') {
    warnings.push(
      `source.text present but format is "${src.format}" (text is normally tied to script format)`,
    );
  }
}

// =============================================================================
// AnimationChannel
// =============================================================================

function validateAnimationChannel(ch, path, host, errors, warnings) {
  if (ch == null || typeof ch !== 'object') {
    errors.push(`${path}: must be an object`);
    return;
  }
  if (typeof ch.channel !== 'string') {
    errors.push(`${path}.channel: must be a string dot-path`);
    return;
  }
  // Rule 14: channel dot-path resolvable
  if (host === 'subject') {
    if (!SUBJECT_CHANNEL_PATHS.has(ch.channel) && !ch.channel.startsWith('args.')) {
      errors.push(`${path}.channel: "${ch.channel}" not a recognized subject path`);
    }
  } else if (host === 'camera') {
    if (!CAMERA_CHANNEL_PATHS.has(ch.channel)) {
      errors.push(
        `${path}.channel: "${ch.channel}" not a camera path (valid: ${[...CAMERA_CHANNEL_PATHS].join(', ')})`,
      );
    }
  } else if (host === 'light') {
    if (!LIGHT_CHANNEL_PATHS.has(ch.channel)) {
      errors.push(
        `${path}.channel: "${ch.channel}" not a light path (valid: ${[...LIGHT_CHANNEL_PATHS].join(', ')})`,
      );
    }
  } else if (host === 'shadow') {
    // Only strength is animatable for shadow in v1
    if (ch.channel !== 'strength') {
      errors.push(`${path}.channel: shadow only supports "strength" in v1`);
    }
  }

  // Rule 13: a channel SHOULD have at least one of expr/value. Both is OK —
  // parse() normalizes single-form input to dual-form for round-trip stability.
  // Authors / LLMs should write exactly one in raw JSON; serialize adds the
  // other. If neither is present, compile silently SKIPS the channel (warns
  // but doesn't error). Forward-compat for partial LLM outputs.
  const hasExpr = ch.expr != null;
  const hasValue = ch.value != null;
  if (!hasExpr && !hasValue) {
    warnings.push(
      `${path}: missing both "expr" and "value" — channel will be ignored at compile time`,
    );
    return;
  }
  if (hasExpr && typeof ch.expr !== 'string') {
    errors.push(`${path}.expr: must be a string`);
  }
  if (hasValue) {
    validateTimeExpr(ch.value, `${path}.value`, errors, warnings);
  }
}

function validateTimeExpr(te, path, errors, warnings) {
  if (te == null || typeof te !== 'object') {
    errors.push(`${path}: TimeExpr must be an object`);
    return;
  }
  if (te.kind !== 'time') {
    errors.push(`${path}.kind: must be "time"`);
    return;
  }
  const validForms = ['linear', 'sin', 'cos', 'sum'];
  if (!validForms.includes(te.form)) {
    errors.push(`${path}.form: must be one of ${validForms.join(' | ')}`);
    return;
  }
  if (te.form === 'linear') {
    if (typeof te.coef !== 'number') errors.push(`${path}: linear requires coef (number)`);
  } else if (te.form === 'sin' || te.form === 'cos') {
    if (typeof te.amp !== 'number') errors.push(`${path}: ${te.form} requires amp`);
    if (typeof te.freq !== 'number') errors.push(`${path}: ${te.form} requires freq`);
    if (typeof te.phase !== 'number') errors.push(`${path}: ${te.form} requires phase`);
  } else if (te.form === 'sum') {
    if (!Array.isArray(te.terms)) {
      errors.push(`${path}: sum requires terms (array)`);
    } else {
      te.terms.forEach((t, i) => {
        if (typeof t === 'number') return;
        validateTimeExpr(t, `${path}.terms[${i}]`, errors, warnings);
      });
    }
  }
}
