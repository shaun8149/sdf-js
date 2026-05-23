// =============================================================================
// Generator-S — scene-level variant generator (Phase 1: scatter only)
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
// Phase 1 只支持 1 个 op：`scatter`。
// Phase 1 只支持 2 种 region：`rectXZ` (地面) + `box3` (空中)。
//
// 触发场景：航母舰队 / 树林 / 鸟群 / 花海 / 牛群 / 星空 / 浮云 / 灯塔群。
//
// **Flat expand 策略**：1 个 prototype subject + count=5 → 5 个独立 subject
// （id 后缀 -0..-4），每个 transform 独立。代价：N>50 时 GPU 多次 SDF eval；
// 收益：thesis Point #7（可编辑性）— editor 看得见每艘船能单独删/挪。
//
// **Determinism**：同一 sceneHash → 同一 expanded subjects 序列 → 可分享 /
// 可复现。SFC32 PRNG 来自 src/util/random.js，跟 Generator-V 同一个 Random
// class（不同 hash 互不污染）。
// =============================================================================

const SUPPORTED_OPS = new Set(['scatter']);
const SUPPORTED_REGIONS = new Set(['rectXZ', 'box3']);

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
