// =============================================================================
// Generator-S — scene-level variant generator (Phase 2: scatter + array + mirror)
// -----------------------------------------------------------------------------
// "Generator-S" 是 Atlas thesis Point #10 (zero-marginal-cost variant) 在
// **scene 层**的落地。跟 Generator-V（renderer-specific style，BOB GPU 的
// palette/chess/coloration 随机化）平行的独立 layer：
//
//   SceneData (LLM lifted, 1-of-1)
//          ↓ sceneHash
//   Generator-S (this file)   ←—— renderer-agnostic; pure data → pure data
//          ↓
//   VariantSceneData
//          ↓ compile()
//          SDF3
//          ↓
//        Renderer
//
// 输入：SceneData，其中某些 subjects 带 `variants: [...]` 数组
// 输出：SceneData，variants 字段被消化，subjects[] 数组被"展开"
//
// Phase 2 ops:
//   - `scatter`: stochastic placement in rectXZ / box3 region (Phase 1)
//   - `array`:   deterministic equispaced copies along an axis + jitter
//   - `mirror`:  bilateral reflection across a plane (yz/xz/xy) + jitter
//
// Difference vs SDF domain operators (`rep`, domain `mirror`):
//   Generator-S works at SUBJECT level — each copy is a top-level subject
//   with independent material / animation / scale / rotation. SDF-domain
//   rep/mirror is cheaper (one SDF call) but every copy is identical.
//   Use array/mirror when you want per-copy variation (anim phase, hue
//   jitter, scale jitter) — e.g. fighter-jet bilateral wings flapping out
//   of phase, or a colonnade of slightly varying columns.
//
// 触发场景：
//   scatter — 舰队 / 树林 / 鸟群 / 花海 / 牛群 / 星空
//   array   — colonnade / 围栏 / 楼梯踏步 / 路灯排
//   mirror  — bilateral 对称（飞机两翼 / 船左右舷 / 双子塔）
//
// **Flat expand 策略**：1 个 prototype subject + count=5 → 5 个独立 subject
// （id 后缀 -0..-4），每个 transform 独立。代价：N>50 时 GPU 多次 SDF eval；
// 收益：thesis Point #7（可编辑性）— editor 看得见每艘船能单独删/挪。
//
// **Determinism**：同一 sceneHash → 同一 expanded subjects 序列 → 可分享 /
// 可复现。SFC32 PRNG 来自 src/util/random.js，跟 Generator-V 同一个 Random
// class（不同 hash 互不污染）。
// =============================================================================

const SUPPORTED_OPS = new Set(['scatter', 'array', 'mirror']);
const SUPPORTED_REGIONS = new Set(['rectXZ', 'box3']);
const SUPPORTED_AXES = new Set(['x', 'y', 'z']);
const SUPPORTED_PLANES = new Set(['yz', 'xz', 'xy']);

/**
 * Expand subject variants in a SceneData. Returns a NEW SceneData object
 * with `variants` fields removed and matching subjects multiplied.
 *
 * @param {SceneData} scene
 * @param {{random_dec, random_num, random_int}} rng - SFC32 Random instance
 * @returns {SceneData}
 */
export function expandVariants(scene, rng) {
  if (!scene || !Array.isArray(scene.subjects)) return scene;
  // Quick path: no subject has variants → return scene as-is (don't even
  // touch rng; preserves caller's deterministic stream for non-variant scenes)
  const anyVariant = scene.subjects.some(s => Array.isArray(s.variants) && s.variants.length > 0);
  if (!anyVariant) return scene;

  const newSubjects = [];
  for (const subj of scene.subjects) {
    if (!Array.isArray(subj.variants) || subj.variants.length === 0) {
      newSubjects.push(subj);
      continue;
    }
    for (const spec of subj.variants) {
      const expanded = expandOne(subj, spec, rng);
      newSubjects.push(...expanded);
    }
  }
  return { ...scene, subjects: newSubjects };
}

function expandOne(prototype, spec, rng) {
  if (!SUPPORTED_OPS.has(spec.op)) {
    console.warn(`[generator-s] unknown op '${spec.op}', keeping prototype as-is`);
    return [stripVariants(prototype)];
  }
  if (spec.op === 'scatter') return opScatter(prototype, spec, rng);
  if (spec.op === 'array')   return opArray(prototype, spec, rng);
  if (spec.op === 'mirror')  return opMirror(prototype, spec, rng);
  return [stripVariants(prototype)];
}

// =============================================================================
// scatter op
// =============================================================================
//
// Spec schema:
//   {
//     "op": "scatter",
//     "count": 5,
//     "region": { "type": "rectXZ" | "box3", "center"?: [x,y,z], "size": [...] },
//     "separation"?: number,            // min distance between instances; 0 = no check
//     "heading"?: "aligned" | "random" | { "jitter": <radians> },
//     "scale"?: { "jitter": <fraction> },     // per-instance scale variation
//     "translate"?: { "jitter": [jx, jy, jz] } // small per-axis position jitter on top of sampled pos
//   }
//
// Output: array of subjects, each a deep-cloneish copy of prototype with:
//   - id = `${prototype.id}-${i}` (0-indexed)
//   - variants field stripped
//   - transform.translate = sampled-position + prototype.translate + jitter
//   - transform.rotate    = computed-heading (Y-axis only for now)
//   - transform.scale     = prototype.scale × per-instance jitter

function opScatter(prototype, spec, rng) {
  const count = Math.max(1, Math.floor(spec.count ?? 1));
  const region = spec.region ?? { type: 'rectXZ', size: [10, 10] };
  const separation = Math.max(0, spec.separation ?? 0);
  const heading = spec.heading ?? 'aligned';
  const scaleJitter = spec.scale?.jitter ?? 0;
  const translateJitter = asArr3(spec.translate?.jitter ?? 0);

  if (!SUPPORTED_REGIONS.has(region.type)) {
    console.warn(`[generator-s] unknown region '${region.type}'; falling back to single prototype`);
    return [stripVariants(prototype)];
  }

  const positions = samplePositions(region, count, separation, rng);
  const baseTransform = prototype.transform || {};
  const baseTranslate = baseTransform.translate || [0, 0, 0];
  const baseScale = baseTransform.scale;  // can be number, array, or undefined

  return positions.map((basePos, i) => {
    // per-instance position jitter (small, added on top of region sample)
    const tjit = translateJitter.map(v => (rng.random_dec() - 0.5) * 2 * v);
    const translate = [
      basePos[0] + baseTranslate[0] + tjit[0],
      basePos[1] + baseTranslate[1] + tjit[1],
      basePos[2] + baseTranslate[2] + tjit[2],
    ];

    // heading rotation (Y axis only — Phase 1 simplification)
    const rotate = computeHeading(heading, rng);

    // scale jitter
    const sFactor = 1 + (rng.random_dec() - 0.5) * 2 * scaleJitter;
    let scale;
    if (typeof baseScale === 'number') {
      scale = baseScale * sFactor;
    } else if (Array.isArray(baseScale)) {
      scale = baseScale.map(v => v * sFactor);
    } else if (sFactor !== 1) {
      scale = sFactor;
    }
    // else: scale undefined → don't set (renderer treats as identity)

    const cloned = stripVariants(prototype);
    // Rewrite ALL ids inside the prototype's subtree (children of unions,
    // BooleanGroup children, source of revolve/extrude) so the validator
    // doesn't reject duplicates across instances. Suffix matches the
    // top-level instance index.
    const out = {
      ...cloned,
      id: `${prototype.id ?? 'inst'}-${i}`,
      transform: {
        ...baseTransform,
        translate,
        rotate,
        ...(scale !== undefined ? { scale } : {}),
      },
    };
    if (Array.isArray(out.children)) {
      out.children = out.children.map(c => rewriteIds(c, `-${i}`));
    }
    if (out.source) {
      out.source = rewriteIds(out.source, `-${i}`);
    }
    return out;
  });
}

// Recursively suffix all `id` fields in a subject subtree. Used by scatter
// to keep child IDs unique across the N expanded instances.
function rewriteIds(subj, suffix) {
  if (!subj || typeof subj !== 'object') return subj;
  const out = { ...subj };
  if (typeof out.id === 'string') out.id = `${out.id}${suffix}`;
  if (Array.isArray(out.children)) {
    out.children = out.children.map(c => rewriteIds(c, suffix));
  }
  if (out.source) out.source = rewriteIds(out.source, suffix);
  return out;
}

// =============================================================================
// region sampling
// =============================================================================

function samplePositions(region, count, separation, rng) {
  const positions = [];
  // Rejection sampling for separation. Cap at 30× to bound runtime in dense
  // configurations; warn (not error) if we can't place all N.
  const maxAttempts = count * 30;
  let attempts = 0;
  while (positions.length < count && attempts < maxAttempts) {
    attempts++;
    const p = samplePoint(region, rng);
    if (separation > 0 && !meetsMinDistance(p, positions, separation)) continue;
    positions.push(p);
  }
  if (positions.length < count) {
    console.warn(
      `[generator-s] scatter: only ${positions.length}/${count} positions placed ` +
      `(separation=${separation} too tight for region; consider larger region or smaller separation)`
    );
  }
  return positions;
}

function samplePoint(region, rng) {
  const center = region.center ?? [0, 0, 0];
  if (region.type === 'rectXZ') {
    const [w, d] = region.size ?? [10, 10];
    return [
      center[0] + (rng.random_dec() - 0.5) * w,
      center[1],
      center[2] + (rng.random_dec() - 0.5) * d,
    ];
  }
  if (region.type === 'box3') {
    const [w, h, d] = region.size ?? [10, 10, 10];
    return [
      center[0] + (rng.random_dec() - 0.5) * w,
      center[1] + (rng.random_dec() - 0.5) * h,
      center[2] + (rng.random_dec() - 0.5) * d,
    ];
  }
  return [...center];
}

function meetsMinDistance(p, existing, minDist) {
  const minSq = minDist * minDist;
  for (const q of existing) {
    const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2];
    if (dx * dx + dy * dy + dz * dz < minSq) return false;
  }
  return true;
}

// =============================================================================
// array op
// =============================================================================
//
// Spec schema:
//   {
//     "op": "array",
//     "count": 7,
//     "axis": "x" | "y" | "z" | [ax, ay, az],   // default 'x'
//     "spacing": 1.4,                           // world-units between centers
//     "origin"?: "center" | "start",            // default 'center' (sym around proto position)
//     "scale"?:     { "jitter": <fraction> },   // per-instance scale variation
//     "translate"?: { "jitter": [jx, jy, jz] }, // small random offset on top of grid
//     "rotateY"?:   { "jitter": <radians> }     // small heading jitter per copy
//   }
//
// Output: count subjects placed on a line along axis through prototype.translate.
// origin='center' centers the line on prototype; origin='start' uses prototype
// as instance 0 and extrudes count-1 copies in the +axis direction.

function opArray(prototype, spec, rng) {
  const count = Math.max(1, Math.floor(spec.count ?? 1));
  const axis = resolveAxisVec(spec.axis ?? 'x');
  const spacing = typeof spec.spacing === 'number' ? spec.spacing : 1.0;
  const origin = spec.origin === 'start' ? 'start' : 'center';
  const scaleJitter = spec.scale?.jitter ?? 0;
  const translateJitter = asArr3(spec.translate?.jitter ?? 0);
  const rotYJitter = spec.rotateY?.jitter ?? 0;

  const baseTransform = prototype.transform || {};
  const baseTranslate = baseTransform.translate || [0, 0, 0];
  const baseScale = baseTransform.scale;

  // i offset along axis. Center mode: offsets symmetric around 0.
  // Start mode: offsets 0, 1, 2, ... × spacing.
  const offsets = [];
  for (let i = 0; i < count; i++) {
    const t = origin === 'center'
      ? (i - (count - 1) * 0.5) * spacing
      : i * spacing;
    offsets.push(t);
  }

  return offsets.map((off, i) => {
    const tjit = translateJitter.map(v => (rng.random_dec() - 0.5) * 2 * v);
    const translate = [
      baseTranslate[0] + axis[0] * off + tjit[0],
      baseTranslate[1] + axis[1] * off + tjit[1],
      baseTranslate[2] + axis[2] * off + tjit[2],
    ];

    const rotY = (rng.random_dec() - 0.5) * 2 * rotYJitter;
    const rotate = [0, rotY, 0];

    const sFactor = 1 + (rng.random_dec() - 0.5) * 2 * scaleJitter;
    const scale = computeScale(baseScale, sFactor);

    return buildInstance(prototype, i, baseTransform, { translate, rotate, scale });
  });
}

// =============================================================================
// mirror op
// =============================================================================
//
// Spec schema:
//   {
//     "op": "mirror",
//     "plane": "yz" | "xz" | "xy",   // default "yz" (reflect across X=0 → left/right pair)
//     "phaseFlip"?: number,           // radians to add to mirror copy's animation phase
//     "rotateY"?: { "jitter": <radians> }  // small heading drift per copy
//   }
//
// Output: exactly 2 subjects — original (i=0) + mirrored copy (i=1).
// The mirror is bilateral: position reflected across the plane through
// world origin. The prototype's existing translate IS reflected. If you
// want symmetric pair around some other plane, place prototype at origin
// then translate the whole pair afterwards via a parent transform.
//
// phaseFlip: convenience for asymmetric animation. If prototype has
// animation channels, the mirror copy gets phaseFlip added to each channel's
// `phase` field. Lets you do "left wing up while right wing down" without
// authoring two subjects.

function opMirror(prototype, spec, rng) {
  const plane = SUPPORTED_PLANES.has(spec.plane) ? spec.plane : 'yz';
  const phaseFlip = typeof spec.phaseFlip === 'number' ? spec.phaseFlip : 0;
  const rotYJitter = spec.rotateY?.jitter ?? 0;

  const baseTransform = prototype.transform || {};
  const baseTranslate = baseTransform.translate || [0, 0, 0];
  const baseRotate = baseTransform.rotate || [0, 0, 0];
  const baseScale = baseTransform.scale;

  // Original instance
  const orig = buildInstance(prototype, 0, baseTransform, {
    translate: [...baseTranslate],
    rotate: [...baseRotate],
    scale: baseScale,
  });

  // Reflect position across plane
  const refTranslate = [...baseTranslate];
  if (plane === 'yz') refTranslate[0] = -refTranslate[0];
  else if (plane === 'xz') refTranslate[1] = -refTranslate[1];
  else if (plane === 'xy') refTranslate[2] = -refTranslate[2];

  // Reflect rotation: flip the axis that's perpendicular to the mirror plane.
  // (Approximation — true rotation reflection needs a quaternion conjugate;
  //  for Y-up scenes the common case is mirror plane=yz + Y rotation, which
  //  becomes -Y rotation when reflected.)
  const refRotate = [...baseRotate];
  if (plane === 'yz') { refRotate[1] = -refRotate[1]; refRotate[2] = -refRotate[2]; }
  else if (plane === 'xz') { refRotate[0] = -refRotate[0]; refRotate[2] = -refRotate[2]; }
  else if (plane === 'xy') { refRotate[0] = -refRotate[0]; refRotate[1] = -refRotate[1]; }

  // Optional Y-axis jitter on top
  refRotate[1] += (rng.random_dec() - 0.5) * 2 * rotYJitter;

  const mirrored = buildInstance(prototype, 1, baseTransform, {
    translate: refTranslate,
    rotate: refRotate,
    scale: baseScale,
  });

  // Apply phaseFlip to mirror copy's animation channels (top-level only;
  // child animation we leave alone — they're authored on inner subjects
  // and id-rewriting already keeps them distinct).
  // v1 spec: phase lives under ch.value.phase for sin/cos form, or under
  // each term in a sum. Also legacy { phase: ... } at channel level is
  // preserved for back-compat with earlier test scenes.
  if (phaseFlip !== 0 && Array.isArray(mirrored.animation)) {
    mirrored.animation = mirrored.animation.map(ch => addPhaseFlip(ch, phaseFlip));
  }

  return [orig, mirrored];
}

// =============================================================================
// shared instance builder
// =============================================================================
//
// Strips variants from prototype, suffixes all child ids with `-${index}`,
// merges a transform override into the prototype's existing transform.
// Used by all 3 ops.
function buildInstance(prototype, index, baseTransform, override) {
  const cloned = stripVariants(prototype);
  const transform = { ...baseTransform };
  if (override.translate !== undefined) transform.translate = override.translate;
  if (override.rotate !== undefined)    transform.rotate    = override.rotate;
  if (override.scale !== undefined)     transform.scale     = override.scale;

  const out = {
    ...cloned,
    id: `${prototype.id ?? 'inst'}-${index}`,
    transform,
  };
  if (Array.isArray(out.children)) {
    out.children = out.children.map(c => rewriteIds(c, `-${index}`));
  }
  if (out.source) {
    out.source = rewriteIds(out.source, `-${index}`);
  }
  return out;
}

function resolveAxisVec(axis) {
  if (typeof axis === 'string') {
    if (axis === 'x') return [1, 0, 0];
    if (axis === 'y') return [0, 1, 0];
    if (axis === 'z') return [0, 0, 1];
  }
  if (Array.isArray(axis) && axis.length >= 3) {
    const [x, y, z] = axis;
    const len = Math.hypot(x, y, z) || 1;
    return [x / len, y / len, z / len];
  }
  return [1, 0, 0];
}

function computeScale(baseScale, factor) {
  if (factor === 1) return baseScale;
  if (typeof baseScale === 'number') return baseScale * factor;
  if (Array.isArray(baseScale)) return baseScale.map(v => v * factor);
  return factor;
}

// Add a phase offset to an AnimationChannel. Handles:
//   - legacy { phase: N } (old test scenes pre-v1)
//   - v1 { value: { form: 'sin'|'cos', phase: N } }
//   - v1 { value: { form: 'sum', terms: [{ form: 'sin', phase }, ...] } }
// Returns a NEW channel object (immutable).
function addPhaseFlip(ch, flip) {
  if (!ch || typeof ch !== 'object') return ch;
  // Legacy flat form
  if (typeof ch.phase === 'number') {
    return { ...ch, phase: ch.phase + flip };
  }
  // v1 value form
  if (ch.value && typeof ch.value === 'object') {
    return { ...ch, value: addPhaseFlipToTimeExpr(ch.value, flip) };
  }
  return ch;
}

function addPhaseFlipToTimeExpr(te, flip) {
  if (!te || typeof te !== 'object') return te;
  if ((te.form === 'sin' || te.form === 'cos') && typeof te.phase === 'number') {
    return { ...te, phase: te.phase + flip };
  }
  if (te.form === 'sum' && Array.isArray(te.terms)) {
    return { ...te, terms: te.terms.map(t =>
      typeof t === 'number' ? t : addPhaseFlipToTimeExpr(t, flip)) };
  }
  return te;
}

// =============================================================================
// helpers
// =============================================================================

function computeHeading(heading, rng) {
  if (heading === 'aligned') return [0, 0, 0];
  if (heading === 'random') return [0, rng.random_dec() * Math.PI * 2, 0];
  if (typeof heading === 'object' && heading !== null && heading.jitter != null) {
    return [0, (rng.random_dec() - 0.5) * 2 * heading.jitter, 0];
  }
  return [0, 0, 0];
}

function stripVariants(subj) {
  if (!subj.variants) return subj;
  const { variants, ...rest } = subj;
  return rest;
}

function asArr3(v) {
  if (Array.isArray(v)) return [v[0] ?? 0, v[1] ?? v[0] ?? 0, v[2] ?? v[0] ?? 0];
  return [v, v, v];
}

// Exposed for tests / debugging.
export const _SUPPORTED_OPS = SUPPORTED_OPS;
export const _SUPPORTED_REGIONS = SUPPORTED_REGIONS;
export const _SUPPORTED_AXES = SUPPORTED_AXES;
export const _SUPPORTED_PLANES = SUPPORTED_PLANES;
