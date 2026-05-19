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
  'circle', 'ellipse', 'rectangle', 'rounded_rectangle',
  'triangle', 'hexagon', 'polygon', 'star', 'heart',
  'arc', 'segment', 'ring', 'moon', 'cross', 'rounded_cross',
  'pie', 'pie_slice', 'horseshoe', 'egg',
  'trapezoid', 'isosceles_trapezoid', 'parallelogram', 'rhombus',
  'oriented_box', 'quadratic_bezier',
  // 2D legacy / niche
  'flower', 'line', 'slab', 'rounded_x', 'vesica',
  // 3D base
  'sphere', 'box', 'rounded_box', 'torus', 'capsule',
  'cylinder', 'capped_cylinder', 'cone', 'capped_cone',
  'ellipsoid', 'plane',
  // 3D decorative + Platonic
  'pyramid', 'slab3', 'wireframe_box', 'tri_prism', 'prism',
  'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron',
  // Community-ported (see src/scene/components/community/)
  'solid-angle', 'link',
  'capped-torus', 'hex-prism', 'octagon-prism', 'round-cone',
  'rhombus', 'horseshoe', 'u-shape',
  // Atlas scene atoms (composites; see src/scene/components/atoms/)
  'moon', 'star', 'sun', 'cloud-puff',
  'tree-pine', 'tree-broadleaf',
  'cottage', 'flag-on-pole', 'bird-silhouette',
  // Time-aware
  'waves',
  // 2D → 3D pseudo-primitives
  'extrude', 'revolve', 'extrude_to',
]);

export const BOOLEAN_OPS = new Set([
  'union', 'difference', 'intersection', 'smoothUnion', 'smoothDifference',
  // hg_sdf-style join variants (Mercury "Hg" library). Architectural /
  // mechanical / furniture detail at boolean boundaries. args.r controls
  // the bevel/round/chamfer size (default 0.05).
  'unionChamfer', 'intersectionChamfer', 'differenceChamfer',
  'unionRound',   'intersectionRound',   'differenceRound',
]);

// Boolean variants that require an `args.r` (radius/size) field. Used by the
// validator to flag missing or out-of-range r values early.
export const VARIANT_BOOLEAN_R = new Set([
  'unionChamfer', 'intersectionChamfer', 'differenceChamfer',
  'unionRound',   'intersectionRound',   'differenceRound',
]);

export const DOMAIN_OPS = new Set([
  'rep', 'mirror', 'twist', 'bend',
]);

export const SHADOW_MODES = new Set([
  'channelSwap', 'hueRotate180', 'hueRotate90', 'darken',
]);

export const SOURCE_FORMATS = new Set([
  'script', 'graph', 'llm', 'llm-lift', 'generator',
]);

// =============================================================================
// Material presets
// -----------------------------------------------------------------------------
// 4-parameter stylized material model: { hue, sat, metal, glow }.
//   hue   ∈ [0,1] — HSV hue (0=red, 0.33=green, 0.66=blue, 1=red)
//   sat   ∈ [0,1] — saturation mixed against neutral grey
//   metal ∈ [0,1] — fresnel boost + diffuse suppression + base-tinted specular
//   glow  ∈ [0,5] — self-emissive multiplier (ignored by software renderers)
//
// Subject.material may be:
//   - undefined → renderer falls back to hash-by-index palette (current behavior)
//   - string    → preset name (looked up in this dict)
//   - object    → inline { hue, sat, metal, glow } (escape hatch for custom values)
//
// Preset names are part of the public lift-LLM vocabulary; renaming is a
// breaking change. Add new entries freely; only remove with care.
// =============================================================================

export const MATERIAL_PRESETS = {
  // Neutrals — for paper / silhouette / stone / building bases
  'matte-white':  { hue: 0.10, sat: 0.05, metal: 0.0, glow: 0.0 },
  'matte-black':  { hue: 0.60, sat: 0.10, metal: 0.0, glow: 0.0 },
  'stone':        { hue: 0.08, sat: 0.10, metal: 0.0, glow: 0.0 },

  // Earth tones — for cottages / brick / earth / wood
  'brick':        { hue: 0.02, sat: 0.55, metal: 0.0, glow: 0.0 },
  'wood':         { hue: 0.07, sat: 0.45, metal: 0.0, glow: 0.0 },
  'terracotta':   { hue: 0.04, sat: 0.65, metal: 0.0, glow: 0.0 },

  // Nature — for trees / water / sky
  'leaf-green':   { hue: 0.30, sat: 0.65, metal: 0.0, glow: 0.0 },
  'sky-blue':     { hue: 0.58, sat: 0.55, metal: 0.0, glow: 0.0 },

  // Metals — for bells / decorative elements / mechanical
  'gold':         { hue: 0.13, sat: 0.85, metal: 0.95, glow: 0.0 },
  'silver':       { hue: 0.0,  sat: 0.0,  metal: 0.95, glow: 0.0 },
  'copper':       { hue: 0.06, sat: 0.70, metal: 0.95, glow: 0.0 },

  // Emissive — for lighthouse beacon / candle / sun / moon / LED
  'glow-warm':    { hue: 0.10, sat: 0.95, metal: 0.0, glow: 1.5 },
  'glow-cool':    { hue: 0.55, sat: 0.80, metal: 0.0, glow: 1.5 },
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
      console.warn(`[spec] Unknown material preset "${input}". Falling back to default palette. Known: ${Object.keys(MATERIAL_PRESETS).join(', ')}`);
      return null;
    }
    return { ...preset };
  }
  if (typeof input === 'object') {
    return {
      hue:   clamp01(input.hue   ?? 0),
      sat:   clamp01(input.sat   ?? 1),
      metal: clamp01(input.metal ?? 0),
      glow:  clamp05(input.glow  ?? 0),
    };
  }
  return null;
}

// AnimationChannel.channel dot-paths allowed per host node type.
// Used by validator to reject unknown channels early.
export const SUBJECT_CHANNEL_PATHS = new Set([
  'transform.translate.x', 'transform.translate.y', 'transform.translate.z',
  'transform.rotate.x', 'transform.rotate.y', 'transform.rotate.z',
  'transform.scale',
  'color.r', 'color.g', 'color.b',
  // `args.<any>` is wildcard — handled separately in validator
]);

export const CAMERA_CHANNEL_PATHS = new Set([
  'yaw', 'pitch', 'distance', 'focal', 'targetX', 'targetY', 'targetZ',
]);

export const LIGHT_CHANNEL_PATHS = new Set([
  'azimuth', 'altitude', 'distance', 'intensity',
]);

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
        const parentId = path.replace(/\/source$/, '').split('/').pop() || 'anon';
        subj.id = `${parentId.replace(/[\[\]]/g, '_')}-source`;
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

  const isPrimitive = PRIMITIVE_TYPES.has(subj.type);
  const isBoolean = BOOLEAN_OPS.has(subj.type);
  const isDomain = DOMAIN_OPS.has(subj.type);

  if (!isPrimitive && !isBoolean && !isDomain) {
    // Rule 6, 7, 8
    errors.push(`${path}: unknown type "${subj.type}" (not in primitive / boolean / domain registries)`);
    return;
  }

  // Rule 4, 5: BooleanGroup must have children, non-empty
  if (isBoolean) {
    if (!Array.isArray(subj.children) || subj.children.length === 0) {
      errors.push(`${path}: BooleanGroup "${subj.type}" requires non-empty children[]`);
    } else if (subj.children.length === 1) {
      warnings.push(`${path}: BooleanGroup "${subj.type}" with single child will be unwrapped`);
    } else {
      subj.children.forEach((c, i) =>
        validateSubject(c, `${path}/children[${i}]`, errors, warnings));
    }
    // hg_sdf variants need args.r; missing is recoverable (default 0.05) but
    // worth warning so authors realize the param exists.
    if (VARIANT_BOOLEAN_R.has(subj.type)) {
      const r = subj.args?.r;
      if (r == null) {
        warnings.push(`${path}: "${subj.type}" missing args.r (bevel/round radius); using default 0.05`);
      } else if (typeof r !== 'number' || r <= 0) {
        errors.push(`${path}.args.r: must be a positive number (got ${r})`);
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
  if (isPrimitive && (subj.type === 'extrude' || subj.type === 'revolve' || subj.type === 'extrude_to')) {
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
        validateAnimationChannel(ch, `${path}.animation[${i}]`, 'subject', errors, warnings));
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
        warnings.push(`${path}.material: unknown preset "${subj.material}" — will fall back to default palette. Known: ${Object.keys(MATERIAL_PRESETS).join(', ')}`);
      }
    } else if (typeof subj.material === 'object' && !Array.isArray(subj.material)) {
      const m = subj.material;
      for (const k of ['hue', 'sat', 'metal', 'glow']) {
        if (m[k] != null && typeof m[k] !== 'number') {
          errors.push(`${path}.material.${k}: must be a number if present`);
        }
      }
    } else {
      errors.push(`${path}.material: must be a string preset name or an object {hue, sat, metal, glow}`);
    }
  }
}

// =============================================================================
// DomainGroup args
// =============================================================================

function validateDomainArgs(type, args, path, errors, warnings) {
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
  }
}

// =============================================================================
// CameraSpec
// =============================================================================

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
  if (Array.isArray(cam.animation)) {
    cam.animation.forEach((ch, i) =>
      validateAnimationChannel(ch, `defaults.camera.animation[${i}]`, 'camera', errors, warnings));
  }
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
      validateAnimationChannel(ch, `defaults.light.animation[${i}]`, 'light', errors, warnings));
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
      validateAnimationChannel(ch, `defaults.shadow.animation[${i}]`, 'shadow', errors, warnings));
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
    warnings.push(`source.format "${src.format}" not in registry (known: ${[...SOURCE_FORMATS].join(' | ')}). Renderer continues; metadata may render as 'unknown' in editors.`);
  }
  // Rule 20: warn if text without script format
  if (src.text != null && src.format !== 'script') {
    warnings.push(`source.text present but format is "${src.format}" (text is normally tied to script format)`);
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
      errors.push(`${path}.channel: "${ch.channel}" not a camera path (valid: ${[...CAMERA_CHANNEL_PATHS].join(', ')})`);
    }
  } else if (host === 'light') {
    if (!LIGHT_CHANNEL_PATHS.has(ch.channel)) {
      errors.push(`${path}.channel: "${ch.channel}" not a light path (valid: ${[...LIGHT_CHANNEL_PATHS].join(', ')})`);
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
    warnings.push(`${path}: missing both "expr" and "value" — channel will be ignored at compile time`);
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
