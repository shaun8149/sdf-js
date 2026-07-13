// sdf-js/src/scene/modifiers.js — Blender-borrow Wave B: PLACEMENT modifiers.
//
// `subject.modifiers` is an ordered, non-destructive stack that multiplies a
// subject's PLACEMENT (translate + yaw), applied at expansion time. This is a
// deliberate simplification of Blender's modifier stack: Blender's Array/
// Mirror operate in geometry space; ours operate on where copies STAND. Every
// repetition in the corpus (breadcrumb runways, guard pairs, rings, scatter
// fields) is a placement pattern, and placement-space keeps the semantics
// trivially explainable to the lift LLM ("this subject, standing N times").
//
// v1 = EXPANSION ONLY (spec §1.2): compile-time unrolling into N instances —
// the semantic win (small JSON, no hand-unrolled arrays, no id contracts).
// The leaf-count perf win is Wave C's domain-rep lowering; scatter is
// expansion forever (irregular placements can't domain-repeat).
//
// Determinism: scatter uses the repo's named-lane PRNG (makeHashRand) keyed
// by `${seed}:${subject.id}` — same seed, same field, forever (mint-hash
// covenant). No Math.random anywhere.
//
// Limitation (documented, validator-warned): animation exprs produce the FULL
// y for a channel, so instances of a y-offsetting array share the same y
// motion — an array with offset[1] ≠ 0 plus a translate.y animation is
// unsupported in v1.
import { makeHashRand } from '../present/decor/rand.js';

export const MODIFIER_TYPES = ['array', 'radial', 'mirror', 'scatter'];
const MAX_COUNT = 64;

// One instance = { t: [dx,dy,dz] ABSOLUTE translate, yaw, yawFlip }.
const applyOne = {
  array(instances, m) {
    const out = [];
    const [ox, oy, oz] = m.offset;
    for (const inst of instances)
      for (let i = 0; i < m.count; i++)
        out.push({ ...inst, t: [inst.t[0] + ox * i, inst.t[1] + oy * i, inst.t[2] + oz * i] });
    return out;
  },
  radial(instances, m) {
    const out = [];
    const [cx, cz] = m.center || [0, 0];
    const start = m.startAngle || 0;
    for (const inst of instances)
      for (let i = 0; i < m.count; i++) {
        const th = start + (i * 2 * Math.PI) / m.count;
        out.push({
          ...inst,
          t: [cx + Math.sin(th) * m.radius, inst.t[1], cz + Math.cos(th) * m.radius],
          yaw: m.faceCenter ? inst.yaw + th : inst.yaw,
        });
      }
    return out;
  },
  mirror(instances, m) {
    const out = [];
    const [ox, oz] = m.origin || [0, 0]; // mirror PLANE position (world x=ox / z=oz)
    for (const inst of instances) {
      out.push(inst);
      // true geometric mirror for yaw-only subjects (the analytic renderer's
      // rotation constraint anyway): position reflects across the plane,
      // yaw negates
      out.push(
        m.axis === 'x'
          ? { ...inst, t: [2 * ox - inst.t[0], inst.t[1], inst.t[2]], yaw: -inst.yaw }
          : { ...inst, t: [inst.t[0], inst.t[1], 2 * oz - inst.t[2]], yaw: -inst.yaw },
      );
    }
    return out;
  },
  scatter(instances, m, subjectId) {
    const R = makeHashRand(`${m.seed}:${subjectId}`);
    const out = [];
    for (const inst of instances)
      for (let i = 0; i < m.count; i++) {
        let x, z;
        if (m.region.kind === 'annulus') {
          const [cx, cz] = m.region.center || [0, 0];
          const th = R.range(`a${i}`, 0, 2 * Math.PI);
          const r = R.range(`r${i}`, m.region.rMin, m.region.rMax);
          x = cx + Math.sin(th) * r;
          z = cz + Math.cos(th) * r;
        } else {
          x = R.range(`x${i}`, m.region.min[0], m.region.max[0]);
          z = R.range(`z${i}`, m.region.min[1], m.region.max[1]);
        }
        out.push({ ...inst, t: [x, inst.t[1], z], yaw: inst.yaw + R.range(`y${i}`, 0, Math.PI) });
      }
    return out;
  },
};

/**
 * shiftModifier(m, [dx, dy, dz]) → modifier
 * Rewrite a modifier's SPATIAL anchors when its subject is transplanted to a
 * new origin (assembleDeck's job — the same contract as its build-in-expr
 * rewriting: placement shifts, patterns don't). array offsets are relative
 * (unchanged); mirror planes, radial centers and scatter regions are
 * positions and must ride along.
 */
export function shiftModifier(m, [dx, , dz]) {
  if (m.type === 'mirror') {
    const [ox, oz] = m.origin || [0, 0];
    return { ...m, origin: [ox + dx, oz + dz] };
  }
  if (m.type === 'radial') {
    const [cx, cz] = m.center || [0, 0];
    return { ...m, center: [cx + dx, cz + dz] };
  }
  if (m.type === 'scatter') {
    const r = m.region;
    if (r.kind === 'annulus') {
      const [cx, cz] = r.center || [0, 0];
      return { ...m, region: { ...r, center: [cx + dx, cz + dz] } };
    }
    return {
      ...m,
      region: { ...r, min: [r.min[0] + dx, r.min[1] + dz], max: [r.max[0] + dx, r.max[1] + dz] },
    };
  }
  return m; // array: offset is relative
}

/**
 * expandModifiers(scene) → scene
 * Unroll every modifier stack into plain instances. Instance ids are
 * `{id}#{i}` (identity only — routing rides the copied collection tag). A
 * scene without modifiers passes through untouched (referential no-op).
 */
export function expandModifiers(scene) {
  if (!scene || !Array.isArray(scene.subjects)) return scene;
  if (!scene.subjects.some((s) => s && Array.isArray(s.modifiers) && s.modifiers.length))
    return scene;
  const subjects = [];
  for (const s of scene.subjects) {
    if (!s || !Array.isArray(s.modifiers) || !s.modifiers.length) {
      subjects.push(s);
      continue;
    }
    const base = (s.transform && s.transform.translate) || [0, 0, 0];
    const rot = (s.transform && s.transform.rotate) || [0, 0, 0];
    let instances = [{ t: [...base], yaw: rot[1] }];
    for (const m of s.modifiers) instances = applyOne[m.type](instances, m, s.id);
    instances.forEach((inst, i) => {
      const clone = { ...s, id: `${s.id}#${i}` };
      delete clone.modifiers;
      clone.transform = {
        ...(s.transform || {}),
        translate: inst.t,
        // pitch/roll ride through untouched; yaw comes from the instance
        ...(rot[0] || rot[2] || inst.yaw || (s.transform && s.transform.rotate)
          ? { rotate: [rot[0], inst.yaw, rot[2]] }
          : {}),
      };
      subjects.push(clone);
    });
  }
  return { ...scene, subjects };
}
